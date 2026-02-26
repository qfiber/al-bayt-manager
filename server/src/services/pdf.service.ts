import PDFDocument from 'pdfkit';
import { db } from '../config/database.js';
import { settings } from '../db/schema/index.js';

interface PdfOptions {
  title?: string;
  direction?: 'ltr' | 'rtl';
}

export async function getBranding() {
  const [result] = await db.select({
    companyName: settings.companyName,
    logoUrl: settings.logoUrl,
  }).from(settings).limit(1);
  return result;
}

export function createPdfDocument(options: PdfOptions = {}): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: options.title || 'Document',
      Creator: 'Al-Bayt Manager',
    },
  });

  return doc;
}

export function addHeader(doc: PDFKit.PDFDocument, companyName: string, documentTitle: string) {
  doc.fontSize(18).text(companyName, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).text(documentTitle, { align: 'center' });
  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
  doc.moveDown(1);
}

export function addInfoRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.fontSize(10).text(`${label}: ${value}`);
  doc.moveDown(0.3);
}

export function addTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][]) {
  const colWidth = (545 - 50) / headers.length;
  const startX = 50;
  let y = doc.y;

  // Header row
  doc.fontSize(9).font('Helvetica-Bold');
  headers.forEach((header, i) => {
    doc.text(header, startX + i * colWidth, y, { width: colWidth, align: 'left' });
  });
  y = doc.y + 5;
  doc.moveTo(startX, y).lineTo(545, y).stroke('#cccccc');
  y += 10;

  // Data rows
  doc.font('Helvetica').fontSize(9);
  rows.forEach((row) => {
    if (y > 750) {
      doc.addPage();
      y = 50;
    }
    const rowY = y;
    row.forEach((cell, i) => {
      doc.text(cell, startX + i * colWidth, rowY, { width: colWidth, align: 'left' });
    });
    y = doc.y + 5;
  });

  doc.y = y;
}

export function addFooter(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(2);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
  doc.moveDown(0.5);
  doc.fontSize(8).fillColor('#666666').text(text, { align: 'center' });
  doc.fillColor('#000000');
}
