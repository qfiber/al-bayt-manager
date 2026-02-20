import path from 'path';
import fs from 'fs';
import { env } from '../config/env.js';

const LOGOS_DIR = path.join(env.UPLOAD_DIR, 'logos');

// Ensure upload directory exists
if (!fs.existsSync(LOGOS_DIR)) {
  fs.mkdirSync(LOGOS_DIR, { recursive: true });
}

export function getLogoPath(filename: string): string {
  return path.join(LOGOS_DIR, filename);
}

export function getLogoUrl(filename: string): string {
  return `/api/uploads/logos/${filename}`;
}

export function deleteFile(filepath: string): void {
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}
