import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { scopeToModeratorBuildings } from '../middleware/building-scope.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import * as receiptService from '../services/receipt.service.js';

export const receiptRoutes = Router();

// Download receipt PDF for a payment
receiptRoutes.get('/receipts/:paymentId/download', requireAuth, requireOrgScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const receipt = await receiptService.getReceiptByPaymentId(req.params.paymentId as string);
    if (!receipt) throw new (await import('../middleware/error-handler.js')).AppError(404, 'Receipt not found');

    const pdfBuffer = await receiptService.generateReceiptPdf(receipt.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receipt.receiptNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});

// List invoices
const invoiceListSchema = z.object({
  apartmentId: z.string().uuid().optional(),
  buildingId: z.string().uuid().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

receiptRoutes.get('/invoices', requireAuth, requireRole('admin', 'moderator'), requireOrgScope, scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { apartmentId, buildingId, month } = invoiceListSchema.parse(req.query);
    const result = await receiptService.listInvoices({
      apartmentId,
      buildingId,
      month,
      allowedBuildingIds: req.allowedBuildingIds,
      organizationId: req.organizationId,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// Download invoice PDF
receiptRoutes.get('/invoices/:id/download', requireAuth, requireOrgScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await receiptService.getInvoice(req.params.id as string);
    const pdfBuffer = await receiptService.generateInvoicePdf(invoice.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});

// Generate invoice for apartment + month
const generateInvoiceSchema = z.object({
  apartmentId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM'),
});

receiptRoutes.post('/invoices/generate', requireAuth, requireRole('admin', 'moderator'), requireOrgScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = generateInvoiceSchema.parse(req.body);
    const invoice = await receiptService.createInvoice(data.apartmentId, data.month);
    res.status(201).json(invoice);
  } catch (err) { next(err); }
});
