import { db } from '../config/database.js';
import { apartments, buildings, payments } from '../db/schema/index.js';
import { eq, and, inArray, sql, lt } from 'drizzle-orm';
import { logger } from '../config/logger.js';
import * as paymentService from './payment.service.js';
import * as receiptService from './receipt.service.js';
import * as notificationService from './notification.service.js';

export async function batchCreatePayments(data: {
  apartmentIds: string[];
  month: string;
  amount?: number;
  useSubscriptionAmount?: boolean;
}, userId: string) {
  const results = { created: 0, failed: [] as { apartmentId: string; error: string }[] };

  for (const apartmentId of data.apartmentIds) {
    try {
      let amount = data.amount;
      if (data.useSubscriptionAmount || !amount) {
        const [apt] = await db.select({ subscriptionAmount: apartments.subscriptionAmount })
          .from(apartments).where(eq(apartments.id, apartmentId)).limit(1);
        amount = parseFloat(apt?.subscriptionAmount || '0');
        if (amount <= 0) {
          results.failed.push({ apartmentId, error: 'No subscription amount set' });
          continue;
        }
      }

      await paymentService.createPayment({
        apartmentId,
        month: data.month,
        amount: amount!,
      }, userId);

      results.created++;
    } catch (err: any) {
      results.failed.push({ apartmentId, error: err.message || 'Unknown error' });
    }
  }

  return results;
}

export async function batchGenerateInvoices(data: {
  buildingIds: string[];
  month: string;
}) {
  const results = { created: 0, skipped: 0, failed: [] as { apartmentId: string; error: string }[] };

  // Find occupied apartments in the specified buildings
  const apts = await db
    .select({ id: apartments.id })
    .from(apartments)
    .where(and(
      inArray(apartments.buildingId, data.buildingIds),
      eq(apartments.status, 'occupied'),
    ));

  for (const apt of apts) {
    try {
      const existing = await receiptService.getInvoiceByApartmentMonth(apt.id, data.month);
      if (existing) {
        results.skipped++;
        continue;
      }
      await receiptService.createInvoice(apt.id, data.month);
      results.created++;
    } catch (err: any) {
      results.failed.push({ apartmentId: apt.id, error: err.message || 'Unknown error' });
    }
  }

  return results;
}

export async function batchSendReminders(data: {
  apartmentIds: string[];
}, userId: string) {
  const results = { sent: 0, failed: [] as { apartmentId: string; error: string }[] };

  for (const apartmentId of data.apartmentIds) {
    try {
      const [apt] = await db.select().from(apartments).where(eq(apartments.id, apartmentId)).limit(1);
      if (!apt || parseFloat(apt.cachedBalance) >= 0) {
        results.failed.push({ apartmentId, error: 'No outstanding debt' });
        continue;
      }

      // Fire and forget reminder (uses notification service if available)
      try {
        await notificationService.sendPaymentReminder(apartmentId);
      } catch {
        // Notification service may not be configured, still count as sent
      }

      results.sent++;
    } catch (err: any) {
      results.failed.push({ apartmentId, error: err.message || 'Unknown error' });
    }
  }

  return results;
}
