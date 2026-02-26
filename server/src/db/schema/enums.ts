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

export const issueStatusEnum = pgEnum('issue_status', ['open', 'in_progress', 'resolved']);

export const issueCategoryEnum = pgEnum('issue_category', [
  'plumbing',
  'electrical',
  'elevator',
  'water_leak',
  'cleaning',
  'structural',
  'safety',
  'other',
]);

export const maintenanceStatusEnum = pgEnum('maintenance_status', ['pending', 'in_progress', 'completed']);

export const occupancyPeriodStatusEnum = pgEnum('occupancy_period_status', ['active', 'closed']);

export const documentScopeEnum = pgEnum('document_scope', ['building', 'apartment', 'user']);

export const meetingDecisionStatusEnum = pgEnum('meeting_decision_status', ['pending', 'in_progress', 'completed', 'canceled']);

export const collectionActionTypeEnum = pgEnum('collection_action_type', ['email_reminder', 'formal_notice', 'final_warning', 'custom']);
