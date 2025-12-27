import { supabase } from '@/integrations/supabase/client';

interface Apartment {
  id: string;
  building_id: string;
  occupancy_start: string | null;
  status: string;
  credit: number;
}

interface ApartmentExpense {
  id: string;
  apartment_id: string;
  expense_id: string;
  amount: number;
  is_canceled: boolean;
}

/**
 * Recalculates expense distribution for a building when an apartment's occupancy changes.
 * This considers occupancy_start dates to determine which apartments should share each expense.
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
        if (apt.status !== 'occupied' || !apt.occupancy_start) {
          // Check if they were occupied during that month
          // If currently vacant but was occupied during the expense month, still include
        }
        
        if (!apt.occupancy_start) return false;
        
        const occupancyStart = new Date(apt.occupancy_start);
        const occupancyMonth = occupancyStart.getMonth();
        const occupancyYear = occupancyStart.getFullYear();
        
        // Apartment is eligible if occupancy started on or before the expense date
        // More specifically: if occupancy started in the same month or earlier
        if (occupancyYear < expenseYear) return true;
        if (occupancyYear === expenseYear && occupancyMonth <= expenseMonth) {
          // Check if occupancy started on first day of month
          const firstDayOfExpenseMonth = new Date(expenseYear, expenseMonth, 1);
          return occupancyStart <= firstDayOfExpenseMonth || 
                 (occupancyStart.getMonth() === expenseMonth && occupancyStart.getDate() === 1);
        }
        return false;
      });

      if (eligibleApartments.length === 0) continue;

      const correctAmountPerApartment = expense.amount / eligibleApartments.length;
      
      // Get current apartment_expenses for this expense
      const currentExpenseRecords = (apartmentExpenses || []).filter(ae => ae.expense_id === expense.id);

      // Calculate what each apartment should have vs what they currently have
      for (const apt of apartments) {
        const isEligible = eligibleApartments.some(ea => ea.id === apt.id);
        const currentRecord = currentExpenseRecords.find(r => r.apartment_id === apt.id);
        const currentAmount = currentRecord?.amount || 0;
        const targetAmount = isEligible ? correctAmountPerApartment : 0;

        if (Math.abs(currentAmount - targetAmount) > 0.01) {
          const creditChange = currentAmount - targetAmount;
          
          if (isEligible && !currentRecord) {
            // Need to create a new record for this apartment
            await supabase
              .from('apartment_expenses')
              .insert({
                apartment_id: apt.id,
                expense_id: expense.id,
                amount: targetAmount
              });
          } else if (!isEligible && currentRecord) {
            // This apartment shouldn't have this expense, mark as canceled
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

          // Update apartment credit
          const { data: currentApt } = await supabase
            .from('apartments')
            .select('credit')
            .eq('id', apt.id)
            .single();

          if (currentApt) {
            const newCredit = currentApt.credit + creditChange;
            await supabase
              .from('apartments')
              .update({ credit: newCredit })
              .eq('id', apt.id);
            
            adjustments.push({ apartmentId: apt.id, creditChange });
          }
        }
      }
    }

    return { success: true, message: 'Expenses recalculated successfully', adjustments };
  } catch (error: any) {
    return { success: false, message: error.message || 'Unknown error', adjustments };
  }
}

/**
 * Get unpaid expenses for an apartment with their remaining balances
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
}[]> {
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

  if (error || !data) return [];

  return data
    .filter(ae => ae.amount > (ae.amount_paid || 0))
    .map(ae => ({
      id: ae.id,
      expense_id: ae.expense_id,
      description: (ae.expense as any)?.description || 'Unknown',
      category: (ae.expense as any)?.category || null,
      expense_date: (ae.expense as any)?.expense_date || '',
      amount: ae.amount,
      amount_paid: ae.amount_paid || 0,
      remaining: ae.amount - (ae.amount_paid || 0)
    }));
}

/**
 * Apply a payment to specific expenses
 */
export async function applyPaymentToExpenses(
  paymentId: string,
  apartmentId: string,
  allocations: Array<{ apartmentExpenseId: string; amount: number }>
): Promise<{ success: boolean; message: string; creditRemaining: number }> {
  try {
    let totalAllocated = 0;

    for (const alloc of allocations) {
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

      // Update the apartment_expense amount_paid
      await supabase
        .from('apartment_expenses')
        .update({ amount_paid: newAmountPaid })
        .eq('id', alloc.apartmentExpenseId);

      // Create payment allocation record
      await supabase
        .from('payment_allocations')
        .insert({
          payment_id: paymentId,
          apartment_expense_id: alloc.apartmentExpenseId,
          amount_allocated: alloc.amount
        });

      totalAllocated += alloc.amount;
    }

    // Get the payment amount
    const { data: payment } = await supabase
      .from('payments')
      .select('amount')
      .eq('id', paymentId)
      .single();

    const paymentAmount = payment?.amount || 0;
    const creditRemaining = paymentAmount - totalAllocated;

    // Update apartment credit with any remaining amount
    if (creditRemaining > 0) {
      const { data: apt } = await supabase
        .from('apartments')
        .select('credit')
        .eq('id', apartmentId)
        .single();

      if (apt) {
        await supabase
          .from('apartments')
          .update({ credit: apt.credit + creditRemaining })
          .eq('id', apartmentId);
      }
    }

    return { success: true, message: 'Payment applied successfully', creditRemaining };
  } catch (error: any) {
    return { success: false, message: error.message, creditRemaining: 0 };
  }
}
