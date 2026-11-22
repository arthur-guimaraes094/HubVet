const EXACT_PUSH_HOSTNAMES = new Set<string>([
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'updates-autopush.stage.mozaws.net',
  'web.push.apple.com',
]);

const PUSH_HOSTNAME_SUFFIXES = ['.notify.windows.com', '.push.apple.com'] as const;

export function isTrustedPushEndpoint(endpoint: string): boolean {
  if (typeof endpoint !== 'string' || !endpoint || endpoint !== endpoint.trim() || endpoint.length > 2048) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') {
    return false;
  }

  if (parsed.username !== '' || parsed.password !== '') {
    return false;
  }

  if (parsed.port !== '' && parsed.port !== '443') {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || hostname.endsWith('.')) {
    return false;
  }

  if (EXACT_PUSH_HOSTNAMES.has(hostname)) {
    return true;
  }

  return PUSH_HOSTNAME_SUFFIXES.some(
    (suffix) => hostname.length > suffix.length && hostname.endsWith(suffix)
  );
}
