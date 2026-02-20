import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../../config/database.js';
import { apartments, buildings } from '../../db/schema/index.js';
import * as ledgerService from '../../services/ledger.service.js';

let testApartmentId: string;

describe('Ledger service', () => {
  beforeAll(async () => {
    // Create a test building + apartment
    const [building] = await db.insert(buildings).values({
      name: `Ledger Test ${Date.now()}`,
      address: 'Test Address',
    }).returning();

    const [apartment] = await db.insert(apartments).values({
      apartmentNumber: 'L1',
      buildingId: building.id,
      status: 'occupied',
    }).returning();

    testApartmentId = apartment.id;
  });

  it('getBalance returns 0 for new apartment', async () => {
    const balance = await ledgerService.getBalance(testApartmentId);
    expect(balance).toBe(0);
  });

  it('recordPayment creates a credit entry', async () => {
    const paymentId = crypto.randomUUID();
    await ledgerService.recordPayment(testApartmentId, paymentId, 100, crypto.randomUUID());

    const balance = await ledgerService.getBalance(testApartmentId);
    expect(balance).toBe(100);
  });

  it('recordExpenseCharge creates a debit entry', async () => {
    const expenseId = crypto.randomUUID();
    await ledgerService.recordExpenseCharge(testApartmentId, expenseId, 40, 'Test expense', crypto.randomUUID());

    const balance = await ledgerService.getBalance(testApartmentId);
    expect(balance).toBe(60); // 100 - 40
  });

  it('recordReversal creates an opposite entry', async () => {
    const refId = crypto.randomUUID();
    // Reverse a credit (becomes a debit)
    await ledgerService.recordReversal(testApartmentId, refId, 10, 'credit', 'Reversal test', crypto.randomUUID());

    const balance = await ledgerService.getBalance(testApartmentId);
    expect(balance).toBe(50); // 60 - 10
  });

  it('refreshCachedBalance updates the apartment row', async () => {
    const balance = await ledgerService.refreshCachedBalance(testApartmentId);
    expect(balance).toBe(50);
  });
});
