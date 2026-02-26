import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as apartmentService from '../services/apartment.service.js';
import * as receiptService from '../services/receipt.service.js';
import { AppError } from '../middleware/error-handler.js';
import { db } from '../config/database.js';
import { userApartments } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';

export const myApartmentRoutes = Router();

// Helper: verify user owns the apartment
async function verifyOwnership(userId: string, apartmentId: string) {
  const [assignment] = await db.select().from(userApartments)
    .where(and(eq(userApartments.userId, userId), eq(userApartments.apartmentId, apartmentId)))
    .limit(1);
  if (!assignment) throw new AppError(403, 'Access denied');
}

myApartmentRoutes.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await apartmentService.getMyApartments(req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

myApartmentRoutes.get('/:apartmentId/payments', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await verifyOwnership(req.user!.userId, req.params.apartmentId as string);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await apartmentService.getPaymentHistory(req.params.apartmentId as string, limit, offset);
    res.json(result);
  } catch (err) { next(err); }
});

myApartmentRoutes.get('/:apartmentId/upcoming-charges', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await verifyOwnership(req.user!.userId, req.params.apartmentId as string);
    const result = await apartmentService.getUpcomingCharges(req.params.apartmentId as string);
    res.json(result);
  } catch (err) { next(err); }
});

myApartmentRoutes.get('/:apartmentId/receipts/:paymentId/download', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await verifyOwnership(req.user!.userId, req.params.apartmentId as string);
    const receipt = await receiptService.getReceiptByPaymentId(req.params.paymentId as string);
    if (!receipt) throw new AppError(404, 'Receipt not found');

    const pdfBuffer = await receiptService.generateReceiptPdf(receipt.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receipt.receiptNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});
