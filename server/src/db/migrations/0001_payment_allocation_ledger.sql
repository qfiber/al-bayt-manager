ALTER TABLE "payment_allocations"
  ALTER COLUMN "apartment_expense_id" DROP NOT NULL;

ALTER TABLE "payment_allocations"
  ADD COLUMN "ledger_entry_id" uuid REFERENCES "apartment_ledger"("id") ON DELETE CASCADE;

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_one_target"
  CHECK (
    ("apartment_expense_id" IS NOT NULL AND "ledger_entry_id" IS NULL) OR
    ("apartment_expense_id" IS NULL AND "ledger_entry_id" IS NOT NULL)
  );
