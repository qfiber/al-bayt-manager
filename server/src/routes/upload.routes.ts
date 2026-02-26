import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { env } from '../config/env.js';
import { getLogoUrl, getIssueAttachmentUrl, getAvatarUrl } from '../services/storage.service.js';

const storage = multer.diskStorage({
  destination: path.join(env.PUBLIC_UPLOAD_DIR, 'logos'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

export const uploadRoutes = Router();

uploadRoutes.post('/logo', requireAuth, requireRole('admin'), upload.single('file'), (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }
    const url = getLogoUrl(req.file.filename);
    res.json({ url });
  } catch (err) { next(err); }
});

// Issue attachment upload (any authenticated user)
const issueStorage = multer.diskStorage({
  destination: path.join(env.UPLOAD_DIR, 'issues'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const issueUpload = multer({
  storage: issueStorage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.mp4', '.mov', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

uploadRoutes.post('/issue-attachment', requireAuth, issueUpload.single('file'), (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }
    const url = getIssueAttachmentUrl(req.file.filename);
    const ext = path.extname(req.file.originalname).toLowerCase();
    const videoExts = ['.mp4', '.mov', '.webm'];
    const fileType = videoExts.includes(ext) ? 'video' : 'image';
    res.json({ url, fileType, originalName: req.file.originalname });
  } catch (err) { next(err); }
});

// Avatar upload (any authenticated user)
const avatarStorage = multer.diskStorage({
  destination: path.join(env.UPLOAD_DIR, 'avatars'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

uploadRoutes.post('/avatar', requireAuth, avatarUpload.single('file'), (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }
    const url = getAvatarUrl(req.file.filename);
    res.json({ url });
  } catch (err) { next(err); }
});
