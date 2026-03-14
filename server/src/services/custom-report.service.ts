import { db } from '../config/database.js';
import { sql } from 'drizzle-orm';
import { savedReports } from '../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

interface ReportConfig {
  dataSource: 'payments' | 'expenses' | 'apartments' | 'leases';
  columns: string[];
  filters: {
    dateFrom?: string;
    dateTo?: string;
    buildingId?: string;
    status?: string;
    minAmount?: number;
    maxAmount?: number;
  };
  groupBy?: string; // building, month, category, status
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

const DATA_SOURCE_QUERIES: Record<string, { baseQuery: string; availableColumns: Record<string, string> }> = {
  payments: {
    baseQuery: `
      SELECT p.id, p.amount::text, p.month, p.is_canceled, p.created_at,
        a.apartment_number, b.name AS building_name, b.id AS building_id
      FROM payments p
      JOIN apartments a ON p.apartment_id = a.id
      JOIN buildings b ON a.building_id = b.id
    `,
    availableColumns: {
      amount: 'p.amount::numeric',
      month: 'p.month',
      apartment: 'a.apartment_number',
      building: 'b.name',
      date: 'p.created_at',
      status: "CASE WHEN p.is_canceled THEN 'cancelled' ELSE 'active' END",
    },
  },
  expenses: {
    baseQuery: `
      SELECT ae.id, ae.amount::text, ae.is_canceled, ae.created_at,
        a.apartment_number, b.name AS building_name, b.id AS building_id,
        e.description, e.category, e.expense_date
      FROM apartment_expenses ae
      JOIN apartments a ON ae.apartment_id = a.id
      JOIN buildings b ON a.building_id = b.id
      JOIN expenses e ON ae.expense_id = e.id
    `,
    availableColumns: {
      amount: 'ae.amount::numeric',
      description: 'e.description',
      category: 'e.category',
      apartment: 'a.apartment_number',
      building: 'b.name',
      date: 'e.expense_date',
      status: "CASE WHEN ae.is_canceled THEN 'cancelled' ELSE 'active' END",
    },
  },
  apartments: {
    baseQuery: `
      SELECT a.id, a.apartment_number, a.floor, a.status, a.cached_balance::text,
        a.subscription_amount::text, a.apartment_type, a.occupancy_start,
        b.name AS building_name, b.id AS building_id
      FROM apartments a
      JOIN buildings b ON a.building_id = b.id
    `,
    availableColumns: {
      apartment: 'a.apartment_number',
      floor: 'a.floor',
      status: 'a.status',
      balance: 'a.cached_balance::numeric',
      subscription: 'a.subscription_amount::numeric',
      type: 'a.apartment_type',
      building: 'b.name',
      occupancy_start: 'a.occupancy_start',
    },
  },
  leases: {
    baseQuery: `
      SELECT l.id, l.tenant_name, l.tenant_email, l.start_date, l.end_date,
        l.monthly_rent::text, l.security_deposit::text, l.status,
        a.apartment_number, b.name AS building_name, b.id AS building_id
      FROM leases l
      JOIN apartments a ON l.apartment_id = a.id
      JOIN buildings b ON a.building_id = b.id
    `,
    availableColumns: {
      tenant: 'l.tenant_name',
      email: 'l.tenant_email',
      start_date: 'l.start_date',
      end_date: 'l.end_date',
      rent: 'l.monthly_rent::numeric',
      deposit: 'l.security_deposit::numeric',
      status: 'l.status',
      apartment: 'a.apartment_number',
      building: 'b.name',
    },
  },
};

// UUID validation helper
function isUUID(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

// Allowed status values per data source (whitelist)
const ALLOWED_STATUSES: Record<string, string[]> = {
  payments: ['active', 'cancelled'],
  apartments: ['occupied', 'vacant'],
  leases: ['active', 'expired', 'terminated'],
  expenses: ['active', 'cancelled'],
};

export async function executeReport(config: ReportConfig, organizationId: string) {
  const source = DATA_SOURCE_QUERIES[config.dataSource];
  if (!source) throw new AppError(400, 'Invalid data source');

  // Validate organizationId
  if (!isUUID(organizationId)) throw new AppError(400, 'Invalid organization ID');

  // Validate buildingId
  if (config.filters.buildingId && !isUUID(config.filters.buildingId)) throw new AppError(400, 'Invalid building ID');

  // Validate dates
  if (config.filters.dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(config.filters.dateFrom)) throw new AppError(400, 'Invalid dateFrom format');
  if (config.filters.dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(config.filters.dateTo)) throw new AppError(400, 'Invalid dateTo format');

  // Build WHERE conditions
  const conditions: string[] = [`b.organization_id = '${organizationId}'`];

  if (config.filters.dateFrom) {
    const dateCol = config.dataSource === 'payments' ? 'p.created_at' :
      config.dataSource === 'expenses' ? 'e.expense_date' :
      config.dataSource === 'leases' ? 'l.start_date' : 'a.created_at';
    conditions.push(`${dateCol} >= '${config.filters.dateFrom}'`);
  }
  if (config.filters.dateTo) {
    const dateCol = config.dataSource === 'payments' ? 'p.created_at' :
      config.dataSource === 'expenses' ? 'e.expense_date' :
      config.dataSource === 'leases' ? 'l.start_date' : 'a.created_at';
    conditions.push(`${dateCol} <= '${config.filters.dateTo}'`);
  }
  if (config.filters.buildingId) {
    conditions.push(`b.id = '${config.filters.buildingId}'`);
  }
  if (config.filters.status) {
    const validStatuses = ALLOWED_STATUSES[config.dataSource] || [];
    if (!validStatuses.includes(config.filters.status)) {
      throw new AppError(400, 'Invalid status filter');
    }
    if (config.dataSource === 'payments') {
      conditions.push(config.filters.status === 'cancelled' ? 'p.is_canceled = true' : 'p.is_canceled = false');
    } else if (config.dataSource === 'apartments') {
      conditions.push(`a.status = '${config.filters.status}'`);
    } else if (config.dataSource === 'leases') {
      conditions.push(`l.status = '${config.filters.status}'`);
    }
  }
  if (config.filters.minAmount != null) {
    const safeMin = Number(config.filters.minAmount);
    if (!Number.isFinite(safeMin)) throw new AppError(400, 'Invalid minAmount');
    const amountCol = config.dataSource === 'payments' ? 'p.amount::numeric' : config.dataSource === 'expenses' ? 'ae.amount::numeric' : config.dataSource === 'leases' ? 'l.monthly_rent::numeric' : 'a.cached_balance::numeric';
    conditions.push(`${amountCol} >= ${safeMin}`);
  }
  if (config.filters.maxAmount != null) {
    const safeMax = Number(config.filters.maxAmount);
    if (!Number.isFinite(safeMax)) throw new AppError(400, 'Invalid maxAmount');
    const amountCol = config.dataSource === 'payments' ? 'p.amount::numeric' : config.dataSource === 'expenses' ? 'ae.amount::numeric' : config.dataSource === 'leases' ? 'l.monthly_rent::numeric' : 'a.cached_balance::numeric';
    conditions.push(`${amountCol} <= ${safeMax}`);
  }

  let query = `${source.baseQuery} WHERE ${conditions.join(' AND ')}`;

  // Group by
  if (config.groupBy) {
    const groupCol = config.groupBy === 'building' ? 'b.name' :
      config.groupBy === 'month' ? (config.dataSource === 'payments' ? "to_char(p.created_at, 'YYYY-MM')" : "to_char(e.expense_date, 'YYYY-MM')") :
      config.groupBy === 'category' ? 'e.category' :
      config.groupBy === 'status' ? (config.dataSource === 'payments' ? 'p.is_canceled' : 'a.status') : null;

    if (groupCol) {
      const amountCol = config.dataSource === 'payments' ? 'p.amount' : config.dataSource === 'expenses' ? 'ae.amount' : config.dataSource === 'leases' ? 'l.monthly_rent' : 'a.cached_balance';
      query = `SELECT ${groupCol} AS group_key, count(*)::int AS count, COALESCE(SUM(${amountCol}::numeric), 0)::text AS total_amount FROM (${source.baseQuery}) sub WHERE ${conditions.join(' AND ')} GROUP BY ${groupCol}`;
    }
  }

  // Sort
  if (config.sortBy && !config.groupBy) {
    const sortCol = source.availableColumns[config.sortBy];
    if (sortCol) {
      query += ` ORDER BY ${sortCol} ${config.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    }
  } else if (config.groupBy) {
    query += ` ORDER BY total_amount::numeric DESC`;
  }

  // Limit
  query += ` LIMIT ${Math.min(config.limit || 500, 1000)}`;

  const result = await db.execute(sql.raw(query));
  return {
    rows: result.rows,
    rowCount: result.rows.length,
    columns: config.groupBy ? ['group_key', 'count', 'total_amount'] : Object.keys(result.rows[0] || {}),
  };
}

// Saved reports CRUD
export async function listSavedReports(organizationId: string) {
  return db.select().from(savedReports)
    .where(eq(savedReports.organizationId, organizationId))
    .orderBy(desc(savedReports.updatedAt));
}

export async function saveReport(data: { organizationId: string; createdBy: string; name: string; config: any }) {
  const [report] = await db.insert(savedReports).values(data).returning();
  return report;
}

export async function deleteSavedReport(id: string, organizationId: string) {
  const [report] = await db.delete(savedReports)
    .where(and(eq(savedReports.id, id), eq(savedReports.organizationId, organizationId)))
    .returning();
  return report;
}

export function getAvailableColumns(dataSource: string) {
  const source = DATA_SOURCE_QUERIES[dataSource];
  if (!source) return [];
  return Object.keys(source.availableColumns);
}
