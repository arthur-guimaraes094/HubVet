export const ALLOWED_IMAGE_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type ImageValidationResult =
  | { valid: true; extension: string; contentType: string }
  | { valid: false; error: string };

export type PreparedImageUploadResult =
  | { valid: true; extension: string; contentType: string; bytes: Uint8Array }
  | { valid: false; error: string };

const STRIP_PNG_CHUNKS = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

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

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const chunk of chunks) {
    totalLength += chunk.length;
  }

  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function findJpegScanEnd(bytes: Uint8Array, sosOffset: number): number {
  if (sosOffset + 2 > bytes.length) {
    return bytes.length;
  }

  const sosHeaderLen = (bytes[sosOffset] << 8) | bytes[sosOffset + 1];
  if (sosHeaderLen < 2 || sosOffset + sosHeaderLen > bytes.length) {
    return bytes.length;
  }

  let p = sosOffset + sosHeaderLen;
  while (p < bytes.length) {
    if (bytes[p] !== 0xff) {
      p++;
      continue;
    }

    while (p < bytes.length && bytes[p] === 0xff) {
      p++;
    }
    if (p >= bytes.length) {
      return bytes.length;
    }

    const marker = bytes[p];
    p++;

    // FF 00 byte stuffing and RST0..RST7 remain inside the entropy-coded stream
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    if (marker === 0xd9) {
      return p;
    }

    if (p + 2 > bytes.length) {
      return bytes.length;
    }
    const segLen = (bytes[p] << 8) | bytes[p + 1];
    if (segLen < 2 || p + segLen > bytes.length) {
      return bytes.length;
    }
    p += segLen;
  }

  return bytes.length;
}

function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (!matchesMagicBytes(bytes, 'image/jpeg') || bytes.length < 4) {
    return bytes;
  }

  const chunks: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return bytes;
    }

    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset++;
    }
    if (offset >= bytes.length) {
      return bytes;
    }

    const marker = bytes[offset];
    offset++;

    if (marker === 0x00) {
      return bytes;
    }

    if (marker === 0xd9) {
      chunks.push(Uint8Array.of(0xff, 0xd9));
      const result = concatUint8Arrays(chunks);
      return result.length > 0 ? result : bytes;
    }

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xd8) {
      chunks.push(Uint8Array.of(0xff, marker));
      continue;
    }

    if (marker === 0xda) {
      chunks.push(Uint8Array.of(0xff, 0xda));
      const sosEnd = findJpegScanEnd(bytes, offset);
      chunks.push(bytes.subarray(offset, sosEnd));
      const result = concatUint8Arrays(chunks);
      return result.length > 0 ? result : bytes;
    }

    if (offset + 2 > bytes.length) {
      return bytes;
    }

    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      return bytes;
    }

    // Strip APP1..APP15 (EXIF/XMP/IPTC/ICC) and COM segments; keep APP0 (JFIF) and image tables
    const shouldStrip = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!shouldStrip) {
      chunks.push(Uint8Array.of(0xff, marker));
      chunks.push(bytes.subarray(offset, offset + segmentLength));
    }

    offset += segmentLength;
  }

  const result = concatUint8Arrays(chunks);
  return result.length > 2 ? result : bytes;
}

function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  if (!matchesMagicBytes(bytes, 'image/png')) {
    return bytes;
  }

  const chunks: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  let sawIend = false;

  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) {
      return bytes;
    }

    const length =
      ((bytes[offset] << 24) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) |
        bytes[offset + 3]) >>>
      0;

    const chunkTotal = 12 + length;
    if (offset + chunkTotal > bytes.length) {
      return bytes;
    }

    const chunkType = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );

    if (!STRIP_PNG_CHUNKS.has(chunkType)) {
      chunks.push(bytes.subarray(offset, offset + chunkTotal));
    }

    offset += chunkTotal;
    if (chunkType === 'IEND') {
      sawIend = true;
      break;
    }
  }

  if (!sawIend && offset !== bytes.length) {
    return bytes;
  }

  const result = concatUint8Arrays(chunks);
  return result.length > 8 ? result : bytes;
}

function stripWebpMetadata(bytes: Uint8Array): Uint8Array {
  if (!matchesMagicBytes(bytes, 'image/webp')) {
    return bytes;
  }

  if (bytes.length === 12) {
    return bytes;
  }

  const subchunks: Uint8Array[] = [];
  let offset = 12;

  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) {
      return bytes;
    }

    const fourcc = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    const chunkSize =
      (bytes[offset + 4] |
        (bytes[offset + 5] << 8) |
        (bytes[offset + 6] << 16) |
        (bytes[offset + 7] << 24)) >>>
      0;

    const padByte = chunkSize % 2;
    const neededWithPad = 8 + chunkSize + padByte;
    let chunkByteLength = neededWithPad;
    let needsSyntheticPad = false;

    if (offset + neededWithPad > bytes.length) {
      if (offset + 8 + chunkSize === bytes.length && padByte === 1) {
        chunkByteLength = 8 + chunkSize;
        needsSyntheticPad = true;
      } else {
        return bytes;
      }
    }

    if (fourcc !== 'EXIF' && fourcc !== 'XMP ') {
      if (fourcc === 'VP8X') {
        if (chunkSize < 1) {
          return bytes;
        }
        const vp8xChunk = bytes.slice(offset, offset + chunkByteLength);
        vp8xChunk[8] = vp8xChunk[8] & ~(0x08 | 0x04);
        subchunks.push(vp8xChunk);
      } else {
        subchunks.push(bytes.subarray(offset, offset + chunkByteLength));
      }

      if (needsSyntheticPad) {
        subchunks.push(Uint8Array.of(0));
      }
    }

    offset += chunkByteLength;
  }

  if (subchunks.length === 0) {
    return bytes;
  }

  let subchunksLen = 0;
  for (const chunk of subchunks) {
    subchunksLen += chunk.length;
  }

  const out = new Uint8Array(12 + subchunksLen);
  const riffFileSize = 4 + subchunksLen;
  out.set(bytes.subarray(0, 4), 0);
  out[4] = riffFileSize & 0xff;
  out[5] = (riffFileSize >>> 8) & 0xff;
  out[6] = (riffFileSize >>> 16) & 0xff;
  out[7] = (riffFileSize >>> 24) & 0xff;
  out.set(bytes.subarray(8, 12), 8);

  let writeOffset = 12;
  for (const chunk of subchunks) {
    out.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  return out.length > 0 ? out : bytes;
}

/**
 * Strips EXIF/GPS/IPTC/XMP/text metadata chunks from JPEG, PNG, and WebP buffers in pure TypeScript.
 */
export function stripImageMetadata(bytes: Uint8Array, mimeType: string): Uint8Array {
  if (!bytes || bytes.length === 0) {
    return bytes;
  }

  switch (mimeType) {
    case 'image/jpeg':
      return stripJpegMetadata(bytes);
    case 'image/png':
      return stripPngMetadata(bytes);
    case 'image/webp':
      return stripWebpMetadata(bytes);
    default:
      return bytes;
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
      error: 'Formato de imagem não suportado. Use JPG, PNG ou WebP.',
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

export async function prepareValidatedImageUpload(
  file: File | null | undefined,
  maxSizeBytes = 4 * 1024 * 1024
): Promise<PreparedImageUploadResult> {
  const validation = await validateImageUpload(file, maxSizeBytes);
  if (!validation.valid) {
    return validation;
  }

  const rawBytes = new Uint8Array(await file!.arrayBuffer());
  if (rawBytes.length === 0) {
    return { valid: false, error: 'Nenhum arquivo enviado.' };
  }

  if (rawBytes.length > maxSizeBytes) {
    const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
    return { valid: false, error: `A imagem deve ter no máximo ${maxMb}MB.` };
  }

  if (!matchesMagicBytes(rawBytes, validation.contentType)) {
    return {
      valid: false,
      error: 'Conteúdo do arquivo não corresponde a uma imagem válida.',
    };
  }

  const sanitizedBytes = stripImageMetadata(rawBytes, validation.contentType);
  if (sanitizedBytes.length === 0) {
    return { valid: false, error: 'Não foi possível processar o arquivo de imagem.' };
  }

  return {
    valid: true,
    extension: validation.extension,
    contentType: validation.contentType,
    bytes: sanitizedBytes,
  };
}
