import { db } from '../config/database.js';
import {
  receipts, invoices, documentSequences, payments, apartments, buildings,
  apartmentExpenses, expenses, profiles,
} from '../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';
import * as pdfService from './pdf.service.js';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

type TxOrDb = NodePgDatabase<any> | typeof db;

export async function getNextNumber(prefix: 'R' | 'INV', txOrDb: TxOrDb = db): Promise<string> {
  const year = new Date().getFullYear();

  // Upsert: insert or increment
  const [seq] = await txOrDb
    .insert(documentSequences)
    .values({ prefix, year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [documentSequences.prefix, documentSequences.year],
      set: { lastNumber: sql`${documentSequences.lastNumber} + 1` },
    })
    .returning();

  const padded = String(seq.lastNumber).padStart(4, '0');
  return `${prefix}-${year}-${padded}`;
}

export async function createReceipt(
  paymentId: string,
  apartmentId: string,
  buildingId: string,
  amount: number,
  txOrDb: TxOrDb = db,
) {
  const receiptNumber = await getNextNumber('R', txOrDb);
  const [receipt] = await txOrDb
    .insert(receipts)
    .values({
      receiptNumber,
      paymentId,
      apartmentId,
      buildingId,
      amount: amount.toFixed(2),
    })
    .returning();
  return receipt;
}

export async function getReceiptByPaymentId(paymentId: string) {
  const [receipt] = await db.select().from(receipts).where(eq(receipts.paymentId, paymentId)).limit(1);
  return receipt || null;
}

export async function generateReceiptPdf(receiptId: string): Promise<Buffer> {
  const [receipt] = await db.select().from(receipts).where(eq(receipts.id, receiptId)).limit(1);
  if (!receipt) throw new AppError(404, 'Receipt not found');

  const [payment] = await db.select().from(payments).where(eq(payments.id, receipt.paymentId)).limit(1);
  const [apartment] = await db.select().from(apartments).where(eq(apartments.id, receipt.apartmentId)).limit(1);
  const [building] = await db.select().from(buildings).where(eq(buildings.id, receipt.buildingId)).limit(1);

  const branding = await pdfService.getBranding();
  const companyName = branding?.companyName || 'Al-Bayt Manager';

  const doc = pdfService.createPdfDocument({ title: `Receipt ${receipt.receiptNumber}` });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    pdfService.addHeader(doc, companyName, 'Payment Receipt / إيصال دفع / קבלה');

    pdfService.addInfoRow(doc, 'Receipt Number', receipt.receiptNumber);
    pdfService.addInfoRow(doc, 'Date', new Date(receipt.generatedAt).toLocaleDateString('en-GB'));
    pdfService.addInfoRow(doc, 'Building', building?.name || '');
    pdfService.addInfoRow(doc, 'Apartment', apartment?.apartmentNumber || '');
    pdfService.addInfoRow(doc, 'Month', payment?.month || '');
    doc.moveDown(1);

    pdfService.addTable(doc, ['Description', 'Amount'], [
      ['Payment', parseFloat(receipt.amount).toFixed(2)],
    ]);

    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Bold').text(`Total: ${parseFloat(receipt.amount).toFixed(2)}`, { align: 'right' });
    doc.font('Helvetica');

    pdfService.addFooter(doc, `${receipt.receiptNumber} | Generated ${new Date().toLocaleDateString('en-GB')}`);

    doc.end();
  });
}

export async function createInvoice(apartmentId: string, month: string) {
  // Check if invoice already exists
  const [existing] = await db.select().from(invoices)
    .where(and(eq(invoices.apartmentId, apartmentId), eq(invoices.month, month)))
    .limit(1);
  if (existing) return existing;

  const [apartment] = await db.select().from(apartments).where(eq(apartments.id, apartmentId)).limit(1);
  if (!apartment) throw new AppError(404, 'Apartment not found');

  const items: { description: string; amount: number }[] = [];

  // Add subscription charge
  const subscriptionAmount = parseFloat(apartment.subscriptionAmount || '0');
  if (subscriptionAmount > 0) {
    items.push({ description: `Monthly subscription ${month}`, amount: subscriptionAmount });
  }

  // Add expense charges for this month
  const expenseCharges = await db
    .select({
      amount: apartmentExpenses.amount,
      description: expenses.description,
    })
    .from(apartmentExpenses)
    .innerJoin(expenses, eq(apartmentExpenses.expenseId, expenses.id))
    .where(
      and(
        eq(apartmentExpenses.apartmentId, apartmentId),
        eq(apartmentExpenses.isCanceled, false),
        sql`TO_CHAR(${expenses.expenseDate}::date, 'YYYY-MM') = ${month}`,
      ),
    );

  for (const charge of expenseCharges) {
    items.push({
      description: charge.description || 'Building expense',
      amount: parseFloat(charge.amount),
    });
  }

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const invoiceNumber = await getNextNumber('INV');

  const [invoice] = await db
    .insert(invoices)
    .values({
      invoiceNumber,
      apartmentId,
      buildingId: apartment.buildingId,
      month,
      totalAmount: totalAmount.toFixed(2),
      items: JSON.stringify(items),
    })
    .returning();

  return invoice;
}

export async function getInvoice(id: string) {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!invoice) throw new AppError(404, 'Invoice not found');
  return invoice;
}

export async function getInvoiceByApartmentMonth(apartmentId: string, month: string) {
  const [invoice] = await db.select().from(invoices)
    .where(and(eq(invoices.apartmentId, apartmentId), eq(invoices.month, month)))
    .limit(1);
  return invoice || null;
}

export async function listInvoices(filters?: {
  apartmentId?: string;
  buildingId?: string;
  month?: string;
  allowedBuildingIds?: string[];
}) {
  let query = db
    .select({
      invoice: invoices,
      apartmentNumber: apartments.apartmentNumber,
      buildingName: buildings.name,
    })
    .from(invoices)
    .innerJoin(apartments, eq(invoices.apartmentId, apartments.id))
    .innerJoin(buildings, eq(invoices.buildingId, buildings.id));

  const conditions: any[] = [];
  if (filters?.apartmentId) conditions.push(eq(invoices.apartmentId, filters.apartmentId));
  if (filters?.buildingId) conditions.push(eq(invoices.buildingId, filters.buildingId));
  if (filters?.month) conditions.push(eq(invoices.month, filters.month));
  if (filters?.allowedBuildingIds?.length) {
    const { inArray } = await import('drizzle-orm');
    conditions.push(inArray(invoices.buildingId, filters.allowedBuildingIds));
  }

  if (conditions.length > 0) {
    const { and } = await import('drizzle-orm');
    query = query.where(and(...conditions)) as any;
  }

  return query;
}

export async function generateInvoicePdf(invoiceId: string): Promise<Buffer> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!invoice) throw new AppError(404, 'Invoice not found');

  const [apartment] = await db.select().from(apartments).where(eq(apartments.id, invoice.apartmentId)).limit(1);
  const [building] = await db.select().from(buildings).where(eq(buildings.id, invoice.buildingId)).limit(1);

  const branding = await pdfService.getBranding();
  const companyName = branding?.companyName || 'Al-Bayt Manager';

  const doc = pdfService.createPdfDocument({ title: `Invoice ${invoice.invoiceNumber}` });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    pdfService.addHeader(doc, companyName, 'Invoice / فاتورة / חשבונית');

    pdfService.addInfoRow(doc, 'Invoice Number', invoice.invoiceNumber);
    pdfService.addInfoRow(doc, 'Date', new Date(invoice.generatedAt).toLocaleDateString('en-GB'));
    pdfService.addInfoRow(doc, 'Building', building?.name || '');
    pdfService.addInfoRow(doc, 'Apartment', apartment?.apartmentNumber || '');
    pdfService.addInfoRow(doc, 'Month', invoice.month);
    doc.moveDown(1);

    const items = (typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items) as { description: string; amount: number }[];
    const rows = items.map((item) => [item.description, item.amount.toFixed(2)]);

    pdfService.addTable(doc, ['Description', 'Amount'], rows);

    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Bold').text(`Total: ${parseFloat(invoice.totalAmount).toFixed(2)}`, { align: 'right' });
    doc.font('Helvetica');

    pdfService.addFooter(doc, `${invoice.invoiceNumber} | Generated ${new Date().toLocaleDateString('en-GB')}`);

    doc.end();
  });
}
