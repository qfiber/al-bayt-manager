import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { scopeToModeratorBuildings } from '../middleware/building-scope.js';
import * as documentService from '../services/document.service.js';
import * as storageService from '../services/storage.service.js';

export const documentRoutes = Router();

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png', 'image/jpeg', 'image/webp',
];

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, storageService.getDocumentPath('').replace(/\/$/, ''));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

documentRoutes.get('/', requireAuth, requireRole('admin', 'moderator'), scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scopeType, scopeId } = req.query as any;
    const result = await documentService.listDocuments({
      scopeType,
      scopeId,
      allowedBuildingIds: req.allowedBuildingIds,
    });
    res.json(result);
  } catch (err) { next(err); }
});

documentRoutes.post('/', requireAuth, requireRole('admin', 'moderator'), upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const { title, description, scopeType, scopeId } = req.body;
    if (!title || !scopeType || !scopeId) {
      return res.status(400).json({ error: 'title, scopeType, and scopeId are required' });
    }

    const doc = await documentService.createDocument({
      title,
      description,
      fileUrl: storageService.getDocumentUrl(req.file.filename),
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      originalName: req.file.originalname,
      scopeType,
      scopeId,
    }, req.user!.userId);

    res.status(201).json(doc);
  } catch (err) { next(err); }
});

documentRoutes.delete('/:id', requireAuth, requireRole('admin', 'moderator'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await documentService.deleteDocument(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});
