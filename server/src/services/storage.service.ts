import path from 'path';
import fs from 'fs';
import { env } from '../config/env.js';

// Public files (nginx-served)
const LOGOS_DIR = path.join(env.PUBLIC_UPLOAD_DIR, 'logos');

// Private files (Express-served, behind auth)
const ISSUES_DIR = path.join(env.UPLOAD_DIR, 'issues');
const AVATARS_DIR = path.join(env.UPLOAD_DIR, 'avatars');
const DOCUMENTS_DIR = path.join(env.UPLOAD_DIR, 'documents');

// Ensure upload directories exist
for (const dir of [LOGOS_DIR, ISSUES_DIR, AVATARS_DIR, DOCUMENTS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getLogoPath(filename: string): string {
  return path.join(LOGOS_DIR, filename);
}

export function getLogoUrl(filename: string): string {
  return `/public-uploads/logos/${filename}`;
}

export function getIssueAttachmentPath(filename: string): string {
  return path.join(ISSUES_DIR, filename);
}

export function getIssueAttachmentUrl(filename: string): string {
  return `/api/uploads/issues/${filename}`;
}

export function getAvatarPath(filename: string): string {
  return path.join(AVATARS_DIR, filename);
}

export function getAvatarUrl(filename: string): string {
  return `/api/uploads/avatars/${filename}`;
}

export function getDocumentPath(filename: string): string {
  return path.join(DOCUMENTS_DIR, filename);
}

export function getDocumentUrl(filename: string): string {
  return `/api/uploads/documents/${filename}`;
}

export function deleteFile(filepath: string): void {
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}
