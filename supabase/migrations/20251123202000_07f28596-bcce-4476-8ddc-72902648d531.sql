-- Add recurring expense fields to expenses table
ALTER TABLE public.expenses
ADD COLUMN is_recurring BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN recurring_type TEXT CHECK (recurring_type IN ('monthly', 'yearly')),
ADD COLUMN recurring_start_date DATE,
ADD COLUMN recurring_end_date DATE,
ADD COLUMN parent_expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL;

-- Add index for better performance when querying recurring expenses
CREATE INDEX idx_expenses_recurring ON public.expenses(is_recurring, recurring_start_date) WHERE is_recurring = true;

-- Add index for parent expense references
CREATE INDEX idx_expenses_parent ON public.expenses(parent_expense_id) WHERE parent_expense_id IS NOT NULL;