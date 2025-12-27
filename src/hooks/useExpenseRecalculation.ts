import { supabase } from '@/integrations/supabase/client';

/**
 * SIMPLIFIED CREDIT/DEBIT CALCULATION SYSTEM
 * 
 * Core Principle: Balance = Total Payments - Total Obligations
 * 
 * Where:
 * - Total Payments = sum of all payments.amount (active only)
 * - Total Obligations = sum of apartment_expenses.amount + subscription_amount
 * 
 * Positive balance = credit (overpaid)
 * Negative balance = debt (owes money)
 */

/**
 * Recalculate an apartment's balance from scratch.
 * This is THE single source of truth for apartment balance.
 * 
 * Formula: balance = totalPayments - totalExpenses - subscriptionAmount
 */
export async function recalculateApartmentBalance(apartmentId: string): Promise<{
  success: boolean;
  message: string;
  newCredit: number;
  newStatus: string;
}> {
  try {
    // Get apartment details
    const { data: apartment, error: aptError } = await supabase
      .from('apartments')
      .select('id, building_id, subscription_amount, status')
      .eq('id', apartmentId)
      .single();

    if (aptError || !apartment) {
      return { success: false, message: 'Apartment not found', newCredit: 0, newStatus: 'due' };
    }

    // Get all ACTIVE payments for this apartment (not canceled)
    const { data: payments, error: payError } = await supabase
      .from('payments')
      .select('amount')
      .eq('apartment_id', apartmentId)
      .eq('is_canceled', false);

    if (payError) {
      return { success: false, message: payError.message, newCredit: 0, newStatus: 'due' };
    }

    // Get all ACTIVE apartment expenses (not canceled)
    const { data: expenses, error: expError } = await supabase
      .from('apartment_expenses')
      .select('amount')
      .eq('apartment_id', apartmentId)
      .eq('is_canceled', false);

    if (expError) {
      return { success: false, message: expError.message, newCredit: 0, newStatus: 'due' };
    }

    // Simple calculation:
    // 1. Total what was paid
    const totalPayments = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    
    // 2. Total what is owed (expenses + subscription)
    const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
    const subscriptionAmount = apartment.status === 'occupied' ? (apartment.subscription_amount || 0) : 0;
    const totalOwed = totalExpenses + subscriptionAmount;
    
    // 3. Balance = paid - owed
    // Positive = credit (overpaid), Negative = debt (owes money)
    const newCredit = totalPayments - totalOwed;

    // Determine subscription status
    let newStatus = 'due';
    if (apartment.status !== 'occupied') {
      newStatus = 'due';
    } else if (newCredit >= 0) {
      newStatus = 'paid';
    } else if (totalPayments > 0) {
      newStatus = 'partial';
    }

    // Update the apartment
    const { error: updateError } = await supabase
      .from('apartments')
      .update({
        credit: newCredit,
        subscription_status: newStatus
      })
      .eq('id', apartmentId);

    if (updateError) {
      return { success: false, message: updateError.message, newCredit, newStatus };
    }

    console.log(`Apartment ${apartmentId} recalculated: payments=${totalPayments}, expenses=${totalExpenses}, subscription=${subscriptionAmount}, balance=${newCredit}`);

    return { success: true, message: 'Balance recalculated', newCredit, newStatus };
  } catch (error: any) {
    return { success: false, message: error.message, newCredit: 0, newStatus: 'due' };
  }
}

/**
 * Recalculates expense distribution for a building.
 * After redistribution, recalculates all apartment balances.
 */
export async function recalculateBuildingExpenses(buildingId: string): Promise<{
  success: boolean;
  message: string;
  adjustments: Array<{ apartmentId: string; creditChange: number }>;
}> {
  const adjustments: Array<{ apartmentId: string; creditChange: number }> = [];

  try {
    // Fetch all apartments in the building
    const { data: apartments, error: aptError } = await supabase
      .from('apartments')
      .select('id, building_id, occupancy_start, status, credit')
      .eq('building_id', buildingId);

    if (aptError || !apartments) {
      return { success: false, message: aptError?.message || 'Failed to fetch apartments', adjustments };
    }

    // Fetch all expenses for this building
    const { data: expenses, error: expError } = await supabase
      .from('expenses')
      .select('id, amount, expense_date')
      .eq('building_id', buildingId);

    if (expError || !expenses) {
      return { success: false, message: expError?.message || 'Failed to fetch expenses', adjustments };
    }

    // Fetch all apartment_expenses for apartments in this building
    const apartmentIds = apartments.map(a => a.id);
    if (apartmentIds.length === 0) {
      return { success: true, message: 'No apartments in building', adjustments };
    }

    const { data: apartmentExpenses, error: aeError } = await supabase
      .from('apartment_expenses')
      .select('*')
      .in('apartment_id', apartmentIds)
      .eq('is_canceled', false);

    if (aeError) {
      return { success: false, message: aeError.message, adjustments };
    }

    // For each expense, recalculate the distribution
    for (const expense of expenses) {
      const expenseDate = new Date(expense.expense_date);
      const expenseMonth = expenseDate.getMonth();
      const expenseYear = expenseDate.getFullYear();
      
      // Find apartments that were occupied during this expense's month
      const eligibleApartments = apartments.filter(apt => {
        if (!apt.occupancy_start) return false;
        
        const occupancyStart = new Date(apt.occupancy_start);
        const occupancyMonth = occupancyStart.getMonth();
        const occupancyYear = occupancyStart.getFullYear();
        
        // Apartment is eligible if occupancy started on or before the expense date
        if (occupancyYear < expenseYear) return true;
        if (occupancyYear === expenseYear && occupancyMonth <= expenseMonth) {
          const firstDayOfExpenseMonth = new Date(expenseYear, expenseMonth, 1);
          return occupancyStart <= firstDayOfExpenseMonth || 
                 (occupancyStart.getMonth() === expenseMonth && occupancyStart.getDate() === 1);
        }
        return false;
      });

      if (eligibleApartments.length === 0) continue;

      const correctAmountPerApartment = Math.round(expense.amount / eligibleApartments.length);
      
      // Get current apartment_expenses for this expense
      const currentExpenseRecords = (apartmentExpenses || []).filter(ae => ae.expense_id === expense.id);

      // Update each apartment's expense allocation
      for (const apt of apartments) {
        const isEligible = eligibleApartments.some(ea => ea.id === apt.id);
        const currentRecord = currentExpenseRecords.find(r => r.apartment_id === apt.id);
        const currentAmount = currentRecord?.amount || 0;
        const targetAmount = isEligible ? correctAmountPerApartment : 0;

        if (Math.abs(currentAmount - targetAmount) > 0.01) {
          if (isEligible && !currentRecord) {
            // Create a new record
            await supabase
              .from('apartment_expenses')
              .insert({
                apartment_id: apt.id,
                expense_id: expense.id,
                amount: targetAmount
              });
          } else if (!isEligible && currentRecord) {
            // Mark as canceled
            await supabase
              .from('apartment_expenses')
              .update({ is_canceled: true })
              .eq('id', currentRecord.id);
          } else if (currentRecord && isEligible) {
            // Update the amount
            await supabase
              .from('apartment_expenses')
              .update({ amount: targetAmount })
              .eq('id', currentRecord.id);
          }

          adjustments.push({ apartmentId: apt.id, creditChange: currentAmount - targetAmount });
        }
      }
    }

    // After redistributing expenses, recalculate ALL apartment balances in the building
    for (const apt of apartments) {
      await recalculateApartmentBalance(apt.id);
    }

    return { success: true, message: 'Expenses recalculated successfully', adjustments };
  } catch (error: any) {
    return { success: false, message: error.message || 'Unknown error', adjustments };
  }
}

/**
 * Get unpaid expenses for an apartment with their remaining balances.
 * Used for the payment allocation UI.
 */
export async function getUnpaidExpensesForApartment(apartmentId: string): Promise<{
  id: string;
  expense_id: string;
  description: string;
  category: string | null;
  expense_date: string;
  amount: number;
  amount_paid: number;
  remaining: number;
  isSubscription?: boolean;
}[]> {
  const results: {
    id: string;
    expense_id: string;
    description: string;
    category: string | null;
    expense_date: string;
    amount: number;
    amount_paid: number;
    remaining: number;
    isSubscription?: boolean;
  }[] = [];

  // Get apartment details for subscription info
  const { data: apartment } = await supabase
    .from('apartments')
    .select('id, subscription_amount, credit, subscription_status, status')
    .eq('id', apartmentId)
    .maybeSingle();

  // Add subscription as an expense if apartment is occupied and owes money
  if (apartment && apartment.status === 'occupied' && apartment.subscription_amount > 0) {
    // Calculate how much of subscription is unpaid
    // Get all payments and expenses to see the breakdown
    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .eq('apartment_id', apartmentId)
      .eq('is_canceled', false);
    
    const { data: expenses } = await supabase
      .from('apartment_expenses')
      .select('amount, amount_paid')
      .eq('apartment_id', apartmentId)
      .eq('is_canceled', false);

    const totalPayments = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
    const totalPaidToExpenses = expenses?.reduce((sum, e) => sum + (e.amount_paid || 0), 0) || 0;
    
    // What's left after paying expenses goes to subscription
    const availableForSubscription = Math.max(0, totalPayments - totalExpenses);
    const paidTowardSubscription = Math.min(availableForSubscription, apartment.subscription_amount);
    const subscriptionRemaining = apartment.subscription_amount - paidTowardSubscription;

    if (subscriptionRemaining > 0) {
      const now = new Date();
      results.push({
        id: `subscription_${apartmentId}`,
        expense_id: `subscription_${apartmentId}`,
        description: 'Monthly Subscription',
        category: 'subscription',
        expense_date: now.toISOString().split('T')[0],
        amount: apartment.subscription_amount,
        amount_paid: paidTowardSubscription,
        remaining: subscriptionRemaining,
        isSubscription: true
      });
    }
  }

  // Fetch regular apartment expenses
  const { data, error } = await supabase
    .from('apartment_expenses')
    .select(`
      id,
      expense_id,
      amount,
      amount_paid,
      is_canceled,
      expense:expenses(description, category, expense_date)
    `)
    .eq('apartment_id', apartmentId)
    .eq('is_canceled', false)
    .order('created_at', { ascending: true });

  if (!error && data) {
    const expensesList = data
      .filter(ae => ae.amount > (ae.amount_paid || 0))
      .map(ae => ({
        id: ae.id,
        expense_id: ae.expense_id,
        description: (ae.expense as any)?.description || 'Unknown',
        category: (ae.expense as any)?.category || null,
        expense_date: (ae.expense as any)?.expense_date || '',
        amount: ae.amount,
        amount_paid: ae.amount_paid || 0,
        remaining: ae.amount - (ae.amount_paid || 0),
        isSubscription: false
      }));
    
    results.push(...expensesList);
  }

  return results;
}

/**
 * Apply a payment to specific expenses (updates amount_paid for display purposes).
 * Then recalculates the apartment balance.
 */
export async function applyPaymentToExpenses(
  paymentId: string,
  apartmentId: string,
  allocations: Array<{ apartmentExpenseId: string; amount: number }>
): Promise<{ success: boolean; message: string; creditRemaining: number }> {
  try {
    for (const alloc of allocations) {
      // Skip subscription allocations (these don't have actual records)
      if (alloc.apartmentExpenseId.startsWith('subscription_')) {
        // Create a payment allocation record for tracking only
        continue;
      }

      // Get current expense record
      const { data: expenseRecord, error: fetchError } = await supabase
        .from('apartment_expenses')
        .select('amount, amount_paid')
        .eq('id', alloc.apartmentExpenseId)
        .single();

      if (fetchError || !expenseRecord) {
        continue;
      }

      const newAmountPaid = (expenseRecord.amount_paid || 0) + alloc.amount;

      // Update the apartment_expense amount_paid (for display only)
      await supabase
        .from('apartment_expenses')
        .update({ amount_paid: newAmountPaid })
        .eq('id', alloc.apartmentExpenseId);

      // Create payment allocation record for audit trail
      await supabase
        .from('payment_allocations')
        .insert({
          payment_id: paymentId,
          apartment_expense_id: alloc.apartmentExpenseId,
          amount_allocated: alloc.amount
        });
    }

    // Recalculate apartment balance (this is what actually matters)
    const result = await recalculateApartmentBalance(apartmentId);

    return { success: true, message: 'Payment applied successfully', creditRemaining: Math.max(0, result.newCredit) };
  } catch (error: any) {
    return { success: false, message: error.message, creditRemaining: 0 };
  }
}

/**
 * Cancel a payment and recalculate balances.
 * This marks the payment as canceled and reverses allocation tracking.
 */
export async function cancelPaymentAndRecalculate(
  paymentId: string,
  apartmentId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Get all payment allocations for this payment
    const { data: paymentAllocations, error: allocError } = await supabase
      .from('payment_allocations')
      .select('apartment_expense_id, amount_allocated')
      .eq('payment_id', paymentId);

    if (allocError) {
      return { success: false, message: allocError.message };
    }

    // Reverse each allocation's amount_paid (for display purposes)
    for (const alloc of paymentAllocations || []) {
      const { data: expenseRecord } = await supabase
        .from('apartment_expenses')
        .select('amount_paid')
        .eq('id', alloc.apartment_expense_id)
        .single();

      if (expenseRecord) {
        const newAmountPaid = Math.max(0, (expenseRecord.amount_paid || 0) - alloc.amount_allocated);
        await supabase
          .from('apartment_expenses')
          .update({ amount_paid: newAmountPaid })
          .eq('id', alloc.apartment_expense_id);
      }
    }

    // Delete the payment allocations
    await supabase
      .from('payment_allocations')
      .delete()
      .eq('payment_id', paymentId);

    // Mark the payment as canceled
    const { error: cancelError } = await supabase
      .from('payments')
      .update({ is_canceled: true })
      .eq('id', paymentId);

    if (cancelError) {
      return { success: false, message: cancelError.message };
    }

    // Recalculate apartment balance (this is what matters)
    const result = await recalculateApartmentBalance(apartmentId);

    return { success: result.success, message: result.success ? 'Payment canceled and balance recalculated' : result.message };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Delete a payment completely (hard delete) and recalculate.
 */
export async function deletePaymentAndRecalculate(
  paymentId: string,
  apartmentId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Get all payment allocations for this payment
    const { data: paymentAllocations } = await supabase
      .from('payment_allocations')
      .select('apartment_expense_id, amount_allocated')
      .eq('payment_id', paymentId);

    // Reverse each allocation's amount_paid
    for (const alloc of paymentAllocations || []) {
      const { data: expenseRecord } = await supabase
        .from('apartment_expenses')
        .select('amount_paid')
        .eq('id', alloc.apartment_expense_id)
        .single();

      if (expenseRecord) {
        const newAmountPaid = Math.max(0, (expenseRecord.amount_paid || 0) - alloc.amount_allocated);
        await supabase
          .from('apartment_expenses')
          .update({ amount_paid: newAmountPaid })
          .eq('id', alloc.apartment_expense_id);
      }
    }

    // Delete the payment allocations
    await supabase
      .from('payment_allocations')
      .delete()
      .eq('payment_id', paymentId);

    // Delete the payment
    const { error: deleteError } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId);

    if (deleteError) {
      return { success: false, message: deleteError.message };
    }

    // Recalculate apartment balance
    const result = await recalculateApartmentBalance(apartmentId);

    return { success: result.success, message: result.success ? 'Payment deleted and balance recalculated' : result.message };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
