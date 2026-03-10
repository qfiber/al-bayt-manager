import { readFile } from 'fs/promises';

interface MagicSignature {
  offset: number;
  bytes: number[];
}

// Magic number signatures for supported file types
const SIGNATURES: Record<string, MagicSignature[]> = {
  '.png': [{ offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
  '.jpg': [{ offset: 0, bytes: [0xFF, 0xD8, 0xFF] }],
  '.jpeg': [{ offset: 0, bytes: [0xFF, 0xD8, 0xFF] }],
  '.webp': [
    // RIFF....WEBP
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },  // "RIFF"
    // bytes 8-11 should be "WEBP"
  ],
  '.mp4': [
    // ftyp box at offset 4
    { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // "ftyp"
  ],
  '.mov': [
    // ftyp or moov or free at offset 4
    { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // "ftyp" (modern QuickTime)
  ],
  '.webm': [
    // EBML header
    { offset: 0, bytes: [0x1A, 0x45, 0xDF, 0xA3] },
  ],
};

/**
 * Validate a file's magic number matches its claimed extension.
 * Returns true if valid, false if the magic number doesn't match.
 */
export async function validateMagicNumber(filePath: string, extension: string): Promise<boolean> {
  const ext = extension.toLowerCase();
  const signatures = SIGNATURES[ext];

  if (!signatures) {
    // Unknown extension — skip magic number check
    return true;
  }

  try {
    // Read first 16 bytes (enough for all our signatures)
    const fd = await readFile(filePath);
    const header = fd.subarray(0, 16);

    if (header.length < 4) return false;

    for (const sig of signatures) {
      const end = sig.offset + sig.bytes.length;
      if (header.length < end) return false;

      const match = sig.bytes.every((byte, i) => header[sig.offset + i] === byte);
      if (!match) return false;
    }

    // Additional check for WebP: bytes 8-11 must be "WEBP"
    if (ext === '.webp') {
      if (header.length < 12) return false;
      const webpTag = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
      const webpMatch = webpTag.every((byte, i) => header[8 + i] === byte);
      if (!webpMatch) return false;
    }

    return true;
  } catch {
    return false;
  }
}
