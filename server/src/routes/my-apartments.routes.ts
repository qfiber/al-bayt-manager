import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as apartmentService from '../services/apartment.service.js';
import * as receiptService from '../services/receipt.service.js';
import * as pdfService from '../services/pdf.service.js';
import { AppError } from '../middleware/error-handler.js';
import { db } from '../config/database.js';
import { userApartments, apartments, buildings } from '../db/schema/index.js';
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

myApartmentRoutes.get('/:apartmentId/statement/download', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await verifyOwnership(req.user!.userId, req.params.apartmentId as string);

    const [apt] = await db.select().from(apartments).where(eq(apartments.id, req.params.apartmentId as string)).limit(1);
    if (!apt) throw new AppError(404, 'Apartment not found');

    const [building] = await db.select().from(buildings).where(eq(buildings.id, apt.buildingId)).limit(1);

    const details = await apartmentService.getDebtDetails(req.params.apartmentId as string);
    const branding = await pdfService.getBranding();

    const doc = pdfService.createPdfDocument({ title: 'Account Statement' });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    const pdfReady = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });

    pdfService.addHeader(doc, branding?.companyName || 'Al-Bayt Manager', 'Account Statement');
    pdfService.addInfoRow(doc, 'Building', building?.name || '');
    pdfService.addInfoRow(doc, 'Apartment', apt.apartmentNumber);
    pdfService.addInfoRow(doc, 'Balance', `${parseFloat(apt.cachedBalance).toFixed(2)}`);
    pdfService.addInfoRow(doc, 'Date', new Date().toLocaleDateString('en-GB'));
    doc.moveDown(1);

    // Payments table
    if (details.payments.length > 0) {
      doc.fontSize(12).text('Payments', { underline: true });
      doc.moveDown(0.5);
      pdfService.addTable(
        doc,
        ['Date', 'Month', 'Amount', 'Status'],
        details.payments.map((p: any) => [
          new Date(p.createdAt).toLocaleDateString('en-GB'),
          p.month,
          parseFloat(p.amount).toFixed(2),
          p.isCanceled ? 'Canceled' : 'Paid',
        ]),
      );
      doc.moveDown(1);
    }

    // Expenses table
    if (details.expenses.length > 0) {
      doc.fontSize(12).text('Expenses', { underline: true });
      doc.moveDown(0.5);
      pdfService.addTable(
        doc,
        ['Date', 'Description', 'Amount', 'Status'],
        details.expenses.map((e: any) => [
          new Date(e.createdAt).toLocaleDateString('en-GB'),
          e.expenseDescription || 'Building expense',
          parseFloat(e.amount).toFixed(2),
          e.isCanceled ? 'Canceled' : 'Active',
        ]),
      );
    }

    pdfService.addFooter(doc, `Generated on ${new Date().toLocaleDateString('en-GB')} by Al-Bayt Manager`);
    doc.end();

    const pdfBuffer = await pdfReady;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="statement-${apt.apartmentNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});
