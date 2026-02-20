import { pgEnum } from 'drizzle-orm/pg-core';

export const appRoleEnum = pgEnum('app_role', ['admin', 'user', 'moderator']);

export const auditActionTypeEnum = pgEnum('audit_action_type', [
  'login',
  'logout',
  'signup',
  'create',
  'update',
  'delete',
  'role_change',
  'password_change',
  'api_key_created',
  'api_key_deleted',
]);

export const totpStatusEnum = pgEnum('totp_status', ['unverified', 'verified']);

export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', ['debit', 'credit']);

export const ledgerReferenceTypeEnum = pgEnum('ledger_reference_type', [
  'payment',
  'expense',
  'subscription',
  'waiver',
  'occupancy_credit',
  'reversal',
]);
