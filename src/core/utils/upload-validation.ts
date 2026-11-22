export const ALLOWED_IMAGE_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export type ImageValidationResult =
  | { valid: true; extension: string; contentType: string }
  | { valid: false; error: string };

function matchesMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case 'image/png':
      return (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );
    case 'image/gif':
      return (
        bytes.length >= 4 &&
        bytes[0] === 0x47 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x38
      );
    case 'image/webp':
      return (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    default:
      return false;
  }
}

export async function validateImageUpload(
  file: File | null | undefined,
  maxSizeBytes = 4 * 1024 * 1024
): Promise<ImageValidationResult> {
  if (!file || file.size === 0) {
    return { valid: false, error: 'Nenhum arquivo enviado.' };
  }

  if (file.size > maxSizeBytes) {
    const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
    return { valid: false, error: `A imagem deve ter no máximo ${maxMb}MB.` };
  }

  if (!Object.prototype.hasOwnProperty.call(ALLOWED_IMAGE_MIME_TO_EXT, file.type)) {
    return {
      valid: false,
      error: 'Formato de imagem não suportado. Use JPG, PNG, WebP ou GIF.',
    };
  }

  const headerBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!matchesMagicBytes(headerBytes, file.type)) {
    return {
      valid: false,
      error: 'Conteúdo do arquivo não corresponde a uma imagem válida.',
    };
  }

  return {
    valid: true,
    extension: ALLOWED_IMAGE_MIME_TO_EXT[file.type],
    contentType: file.type,
  };
}
