import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { auditLog } from '../middleware/audit.js';
import { db } from '../config/database.js';
import { apartments, buildings } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import multer from 'multer';

export const importRoutes = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max

function parseCSV(buffer: Buffer): string[][] {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => {
    const fields: string[] = [];
    let current = '';
    let inQuote = false;
    for (const char of line) {
      if (char === '"') { inQuote = !inQuote; }
      else if (char === ',' && !inQuote) { fields.push(current.trim()); current = ''; }
      else { current += char; }
    }
    fields.push(current.trim());
    return fields;
  });
}

// Import apartments from CSV
// Expected columns: building_name, apartment_number, floor, type (regular/storage/parking), status (vacant/occupied)
importRoutes.post('/apartments', requireAuth, requireOrgScope, requireRole('admin'), upload.single('file'), auditLog('create', 'apartments'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
    if (!req.organizationId) { res.status(400).json({ error: 'No org context' }); return; }

    const rows = parseCSV(req.file.buffer);
    if (rows.length < 2) { res.status(400).json({ error: 'CSV must have header + at least 1 data row' }); return; }

    const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    const dataRows = rows.slice(1);

    if (dataRows.length > 5000) { res.status(400).json({ error: 'Maximum 5000 rows allowed' }); return; }

    // Get org buildings
    const orgBuildings = await db.select({ id: buildings.id, name: buildings.name })
      .from(buildings)
      .where(eq(buildings.organizationId, req.organizationId));

    const buildingMap = new Map(orgBuildings.map(b => [b.name.toLowerCase(), b.id]));

    let created = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const data: Record<string, string> = {};
      headers.forEach((h, j) => { data[h] = row[j] || ''; });

      const buildingName = data.building_name || data.building || '';
      const apartmentNumber = data.apartment_number || data.apartment || data.number || '';
      const floor = data.floor ? parseInt(data.floor) : null;
      const aptType = data.type || data.apartment_type || 'regular';
      const status = data.status || 'vacant';

      if (!buildingName || !apartmentNumber) {
        errors.push({ row: i + 2, error: 'Missing building_name or apartment_number' });
        continue;
      }

      const buildingId = buildingMap.get(buildingName.toLowerCase());
      if (!buildingId) {
        errors.push({ row: i + 2, error: `Building "${buildingName}" not found` });
        continue;
      }

      try {
        await db.insert(apartments).values({
          buildingId,
          apartmentNumber,
          floor,
          apartmentType: aptType as any,
          status,
          cachedBalance: '0',
        });
        created++;
      } catch (err: any) {
        errors.push({ row: i + 2, error: err.message || 'Insert failed' });
      }
    }

    res.json({ created, errors, total: dataRows.length });
  } catch (err) { next(err); }
});
