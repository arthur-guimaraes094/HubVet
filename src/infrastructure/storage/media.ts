import type { SupabaseClient } from '@supabase/supabase-js';

export type AllowedStorageBucket = 'patients' | 'consultations' | 'avatars';

const DEFAULT_SUPABASE_HOST = 'afggyuhfcbwocfcgxgkl.supabase.co';
const STORAGE_REF_REGEX = /^storage:\/\/(patients|consultations|avatars)\/(.+)$/;
const SUPABASE_OBJECT_PATH_REGEX =
  /^\/storage\/v1\/object\/(?:public|sign|authenticated)\/(patients|consultations|avatars)\/(.+)$/;

function getAllowedSupabaseHost(): string {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).hostname.toLowerCase();
    } catch {
      return DEFAULT_SUPABASE_HOST;
    }
  }
  return DEFAULT_SUPABASE_HOST;
}

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

function isSafeStoragePath(path: string): boolean {
  if (!path || hasControlChars(path)) return false;
  if (path.includes('\\') || path.includes('..') || path.includes('?') || path.includes('#')) {
    return false;
  }

  try {
    const decoded = decodeURIComponent(path);
    if (decoded.includes('\\') || decoded.includes('..') || hasControlChars(decoded)) {
      return false;
    }
  } catch {
    // Path may contain literal '%' characters; keep raw segment checks below
  }

  const segments = path.split('/');
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

export function buildStorageRef(bucket: AllowedStorageBucket, path: string): string {
  return `storage://${bucket}/${path.replace(/^\/+/, '')}`;
}

export function parseStorageRef(
  value: string | null | undefined,
  defaultBucket?: AllowedStorageBucket
): { bucket: AllowedStorageBucket; path: string } | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('javascript:') ||
    trimmed.includes('..') ||
    trimmed.includes('\\')
  ) {
    return null;
  }

  const refMatch = STORAGE_REF_REGEX.exec(trimmed);
  if (refMatch) {
    const bucket = refMatch[1] as AllowedStorageBucket;
    const path = refMatch[2];
    if (!isSafeStoragePath(path)) return null;
    return { bucket, path };
  }

  if (lower.startsWith('https://')) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }

    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      url.hostname.toLowerCase() !== getAllowedSupabaseHost()
    ) {
      return null;
    }

    const pathMatch = SUPABASE_OBJECT_PATH_REGEX.exec(url.pathname);
    if (!pathMatch) return null;

    const bucket = pathMatch[1] as AllowedStorageBucket;
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(pathMatch[2]);
    } catch {
      return null;
    }

    if (!isSafeStoragePath(decodedPath)) return null;
    return { bucket, path: decodedPath };
  }

  if (
    defaultBucket &&
    !trimmed.includes(':') &&
    !trimmed.includes('/') &&
    !trimmed.includes('\\') &&
    isSafeStoragePath(trimmed)
  ) {
    return { bucket: defaultBucket, path: trimmed };
  }

  return null;
}

export function isAllowedStorageRef(value: string | null | undefined): boolean {
  return Boolean(parseStorageRef(value));
}

export function normalizeStorageRef(
  value: string | null | undefined,
  defaultBucket?: AllowedStorageBucket
): string | null {
  const parsed = parseStorageRef(value, defaultBucket);
  return parsed ? buildStorageRef(parsed.bucket, parsed.path) : null;
}

export async function signStorageUrl(
  supabase: SupabaseClient,
  value: string | null | undefined,
  defaultBucket?: AllowedStorageBucket,
  expiresInSeconds = 3600
): Promise<string | null> {
  const parsed = parseStorageRef(value, defaultBucket);
  if (!parsed) return null;

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function signStorageUrls(
  supabase: SupabaseClient,
  values: (string | null | undefined)[],
  defaultBucket?: AllowedStorageBucket,
  expiresInSeconds = 3600
): Promise<(string | null)[]> {
  if (values.length === 0) return [];

  const results: (string | null)[] = new Array(values.length).fill(null);
  const parsedEntries: Array<{ index: number; bucket: AllowedStorageBucket; path: string }> = [];
  const pathsByBucket = new Map<AllowedStorageBucket, Set<string>>();

  values.forEach((value, index) => {
    const parsed = parseStorageRef(value, defaultBucket);
    if (!parsed) return;

    parsedEntries.push({ index, bucket: parsed.bucket, path: parsed.path });
    let bucketPaths = pathsByBucket.get(parsed.bucket);
    if (!bucketPaths) {
      bucketPaths = new Set<string>();
      pathsByBucket.set(parsed.bucket, bucketPaths);
    }
    bucketPaths.add(parsed.path);
  });

  if (parsedEntries.length === 0) {
    return results;
  }

  const signedByBucket = new Map<AllowedStorageBucket, Map<string, string>>();

  await Promise.all(
    Array.from(pathsByBucket.entries()).map(async ([bucket, pathSet]) => {
      const uniquePaths = Array.from(pathSet);
      const bucketMap = new Map<string, string>();
      signedByBucket.set(bucket, bucketMap);

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrls(uniquePaths, expiresInSeconds);

      if (error || !Array.isArray(data)) {
        return;
      }

      data.forEach((item, idx) => {
        if (!item.error && item.signedUrl) {
          const resolvedPath = item.path || uniquePaths[idx];
          if (resolvedPath) {
            bucketMap.set(resolvedPath, item.signedUrl);
          }
        }
      });
    })
  );

  for (const entry of parsedEntries) {
    results[entry.index] = signedByBucket.get(entry.bucket)?.get(entry.path) ?? null;
  }

  return results;
}
