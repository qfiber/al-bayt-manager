-- =============================================================
-- Al-Bayt Manager — Full database seed (single-file schema)
-- =============================================================

-- ==================== ENUMS ====================

CREATE TYPE "public"."app_role" AS ENUM('admin', 'user', 'moderator');--> statement-breakpoint
CREATE TYPE "public"."audit_action_type" AS ENUM('login', 'logout', 'signup', 'create', 'update', 'delete', 'role_change', 'password_change', 'api_key_created', 'api_key_deleted', 'failed_login', 'account_locked', 'rate_limited', 'unauthorized_access');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."ledger_reference_type" AS ENUM('payment', 'expense', 'subscription', 'waiver', 'occupancy_credit', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."totp_status" AS ENUM('unverified', 'verified');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('open', 'in_progress', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."issue_category" AS ENUM('plumbing', 'electrical', 'elevator', 'water_leak', 'cleaning', 'structural', 'safety', 'other');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('pending', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."occupancy_period_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."document_scope" AS ENUM('building', 'apartment', 'user');--> statement-breakpoint
CREATE TYPE "public"."meeting_decision_status" AS ENUM('pending', 'in_progress', 'completed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."collection_action_type" AS ENUM('email_reminder', 'formal_notice', 'final_warning', 'custom');--> statement-breakpoint

-- ==================== CORE TABLES ====================

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"email_confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);--> statement-breakpoint

CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"phone" varchar(50),
	"preferred_language" varchar(10) DEFAULT 'ar',
	"avatar_url" varchar(500),
	"id_number" varchar(50),
	"birth_date" date,
	"admin_notes" text,
	"email_notifications_enabled" boolean DEFAULT true NOT NULL,
	"sms_notifications_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "totp_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"secret" varchar(255) NOT NULL,
	"friendly_name" varchar(255),
	"status" "totp_status" DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "app_role" NOT NULL,
	CONSTRAINT "user_roles_user_id_role_unique" UNIQUE("user_id","role")
);--> statement-breakpoint

-- ==================== BUILDINGS & APARTMENTS ====================

CREATE TABLE "buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" varchar(500),
	"number_of_floors" integer,
	"underground_floors" integer DEFAULT 0,
	"logo_url" varchar(500),
	"monthly_fee" numeric(12, 2) DEFAULT '0',
	"ntfy_topic_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "apartments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"apartment_number" varchar(50) NOT NULL,
	"floor" integer,
	"building_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'vacant' NOT NULL,
	"cached_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"subscription_amount" numeric(12, 2) DEFAULT '0',
	"subscription_status" varchar(50) DEFAULT 'inactive',
	"owner_id" uuid,
	"beneficiary_id" uuid,
	"occupancy_start" timestamp with time zone,
	"apartment_type" varchar(20) NOT NULL DEFAULT 'regular',
	"parent_apartment_id" uuid,
	"collection_stage_id" uuid,
	"debt_since" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apartments_building_id_apartment_number_unique" UNIQUE("building_id","apartment_number")
);--> statement-breakpoint

CREATE TABLE "user_apartments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"apartment_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "moderator_buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderator_buildings_user_id_building_id_unique" UNIQUE("user_id","building_id")
);--> statement-breakpoint

-- ==================== FINANCIAL ====================

CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"apartment_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"is_canceled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"description" varchar(500),
	"amount" numeric(12, 2) NOT NULL,
	"expense_date" date NOT NULL,
	"category" varchar(255),
	"is_recurring" boolean DEFAULT false,
	"recurring_type" varchar(50),
	"recurring_start_date" date,
	"recurring_end_date" date,
	"parent_expense_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "apartment_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"apartment_id" uuid NOT NULL,
	"expense_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_canceled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"apartment_expense_id" uuid,
	"ledger_entry_id" uuid,
	"amount_allocated" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_allocations_one_target" CHECK (
		("apartment_expense_id" IS NOT NULL AND "ledger_entry_id" IS NULL) OR
		("apartment_expense_id" IS NULL AND "ledger_entry_id" IS NOT NULL)
	)
);--> statement-breakpoint

CREATE TABLE "apartment_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"apartment_id" uuid NOT NULL,
	"entry_type" "ledger_entry_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reference_type" "ledger_reference_type" NOT NULL,
	"reference_id" uuid,
	"description" text,
	"created_by" uuid,
	"occupancy_period_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "occupancy_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"apartment_id" uuid NOT NULL,
	"tenant_id" uuid,
	"tenant_name" varchar(255),
	"status" "occupancy_period_status" NOT NULL DEFAULT 'active',
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"closing_balance" numeric(12, 2),
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

-- ==================== RECEIPTS & INVOICES ====================

CREATE TABLE "document_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"prefix" varchar(10) NOT NULL,
	"year" int NOT NULL,
	"last_number" int NOT NULL DEFAULT 0,
	UNIQUE("prefix", "year")
);--> statement-breakpoint

CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"receipt_number" varchar(50) NOT NULL UNIQUE,
	"payment_id" uuid NOT NULL,
	"apartment_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"generated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
	"created_at" timestamp with time zone NOT NULL DEFAULT NOW()
);--> statement-breakpoint

CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"invoice_number" varchar(50) NOT NULL UNIQUE,
	"apartment_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"items" jsonb NOT NULL DEFAULT '[]',
	"generated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
	"created_at" timestamp with time zone NOT NULL DEFAULT NOW()
);--> statement-breakpoint

-- ==================== DOCUMENTS ====================

CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" varchar(255) NOT NULL,
	"description" text,
	"file_url" varchar(500) NOT NULL,
	"file_type" varchar(50),
	"file_size" int,
	"original_name" varchar(255),
	"scope_type" "document_scope" NOT NULL,
	"scope_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);--> statement-breakpoint

-- ==================== ISSUES & MAINTENANCE ====================

CREATE TABLE "issue_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"floor" integer,
	"category" "issue_category" NOT NULL,
	"description" text NOT NULL,
	"status" "issue_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "issue_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"file_url" varchar(500) NOT NULL,
	"file_type" varchar(20) NOT NULL,
	"original_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "maintenance_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"issue_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"estimated_cost" numeric(12, 2),
	"status" "maintenance_status" DEFAULT 'pending' NOT NULL,
	"expense_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- ==================== MEETINGS ====================

CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"building_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"date" date NOT NULL,
	"location" varchar(500),
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);--> statement-breakpoint

CREATE TABLE "meeting_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"meeting_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"attended" boolean NOT NULL DEFAULT false,
	UNIQUE("meeting_id", "user_id")
);--> statement-breakpoint

CREATE TABLE "meeting_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"meeting_id" uuid NOT NULL,
	"description" text NOT NULL,
	"assigned_to" uuid,
	"due_date" date,
	"status" "meeting_decision_status" NOT NULL DEFAULT 'pending',
	"created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);--> statement-breakpoint

-- ==================== DEBT COLLECTION ====================

CREATE TABLE "debt_collection_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"stage_number" int NOT NULL UNIQUE,
	"name" varchar(255) NOT NULL,
	"days_overdue" int NOT NULL,
	"action_type" "collection_action_type" NOT NULL,
	"template_id" uuid,
	"settings" jsonb NOT NULL DEFAULT '{}',
	"is_active" boolean NOT NULL DEFAULT true,
	"created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);--> statement-breakpoint

CREATE TABLE "debt_collection_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"apartment_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"triggered_at" timestamp with time zone NOT NULL DEFAULT NOW(),
	"action_taken" varchar(255),
	"details" jsonb NOT NULL DEFAULT '{}',
	"created_at" timestamp with time zone NOT NULL DEFAULT NOW()
);--> statement-breakpoint

-- ==================== EMAIL & NOTIFICATIONS ====================

CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_identifier_unique" UNIQUE("identifier")
);--> statement-breakpoint

CREATE TABLE "email_template_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"language" varchar(10) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"html_body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_identifier" varchar(255),
	"recipient_email" varchar(255) NOT NULL,
	"user_id" uuid,
	"status" varchar(50) NOT NULL,
	"failure_reason" text,
	"subject_sent" varchar(500),
	"metadata" jsonb,
	"language_used" varchar(10),
	"user_preferred_language" varchar(10),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "ntfy_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ntfy_templates_identifier_unique" UNIQUE("identifier")
);--> statement-breakpoint

CREATE TABLE "ntfy_template_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"language" varchar(10) NOT NULL,
	"title" varchar(500) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "sms_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL UNIQUE,
	"name" varchar(255) NOT NULL,
	"description" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "sms_template_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL REFERENCES "sms_templates"("id") ON DELETE CASCADE,
	"language" varchar(10) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "sms_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"template_identifier" varchar(255),
	"recipient_phone" varchar(50) NOT NULL,
	"user_id" uuid,
	"status" varchar(50) NOT NULL,
	"failure_reason" text,
	"message_sent" text,
	"language_used" varchar(10),
	"created_at" timestamp with time zone NOT NULL DEFAULT NOW()
);--> statement-breakpoint

-- ==================== SECURITY ====================

CREATE TABLE "account_lockouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "rate_limit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- ==================== SYSTEM ====================

CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"user_email" varchar(255),
	"action_type" "audit_action_type" NOT NULL,
	"table_name" varchar(255),
	"record_id" varchar(255),
	"action_details" jsonb,
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(255),
	"system_language" varchar(10) DEFAULT 'ar' NOT NULL,
	"logo_url" varchar(500),
	"smtp_enabled" boolean DEFAULT false NOT NULL,
	"smtp_from_email" varchar(255),
	"smtp_from_name" varchar(255),
	"resend_api_key" varchar(500),
	"turnstile_enabled" boolean DEFAULT false NOT NULL,
	"turnstile_site_key" varchar(255),
	"turnstile_secret_key" varchar(255),
	"ntfy_enabled" boolean DEFAULT false NOT NULL,
	"ntfy_server_url" varchar(500),
	"currency_code" varchar(10) NOT NULL DEFAULT 'ILS',
	"currency_symbol" varchar(10) NOT NULL DEFAULT '₪',
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"sms_provider" varchar(50) DEFAULT '019',
	"sms_api_token" varchar(500),
	"sms_username" varchar(255),
	"sms_sender_name" varchar(11),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "general_information" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255),
	"text_1" varchar(1000),
	"text_2" varchar(1000),
	"text_3" varchar(1000),
	"display_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- ==================== FOREIGN KEYS ====================

-- Users / Auth
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "totp_factors" ADD CONSTRAINT "totp_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Buildings / Apartments
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_beneficiary_id_profiles_id_fk" FOREIGN KEY ("beneficiary_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_parent_apartment_id_fk" FOREIGN KEY ("parent_apartment_id") REFERENCES "public"."apartments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_collection_stage_id_fk" FOREIGN KEY ("collection_stage_id") REFERENCES "public"."debt_collection_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_apartments" ADD CONSTRAINT "user_apartments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_apartments" ADD CONSTRAINT "user_apartments_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderator_buildings" ADD CONSTRAINT "moderator_buildings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderator_buildings" ADD CONSTRAINT "moderator_buildings_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Financial
ALTER TABLE "payments" ADD CONSTRAINT "payments_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_parent_expense_id_expenses_id_fk" FOREIGN KEY ("parent_expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartment_expenses" ADD CONSTRAINT "apartment_expenses_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartment_expenses" ADD CONSTRAINT "apartment_expenses_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_apartment_expense_id_apartment_expenses_id_fk" FOREIGN KEY ("apartment_expense_id") REFERENCES "public"."apartment_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_ledger_entry_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."apartment_ledger"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartment_ledger" ADD CONSTRAINT "apartment_ledger_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartment_ledger" ADD CONSTRAINT "apartment_ledger_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartment_ledger" ADD CONSTRAINT "apartment_ledger_occupancy_period_id_fk" FOREIGN KEY ("occupancy_period_id") REFERENCES "public"."occupancy_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupancy_periods" ADD CONSTRAINT "occupancy_periods_apartment_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupancy_periods" ADD CONSTRAINT "occupancy_periods_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Receipts & Invoices
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_apartment_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_apartment_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Documents
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Issues & Maintenance
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_reporter_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_attachments" ADD CONSTRAINT "issue_attachments_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_jobs" ADD CONSTRAINT "maintenance_jobs_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_jobs" ADD CONSTRAINT "maintenance_jobs_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_jobs" ADD CONSTRAINT "maintenance_jobs_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_jobs" ADD CONSTRAINT "maintenance_jobs_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Meetings
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_decisions" ADD CONSTRAINT "meeting_decisions_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_decisions" ADD CONSTRAINT "meeting_decisions_assigned_to_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Debt Collection
ALTER TABLE "debt_collection_stages" ADD CONSTRAINT "debt_collection_stages_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_collection_log" ADD CONSTRAINT "debt_collection_log_apartment_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_collection_log" ADD CONSTRAINT "debt_collection_log_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."debt_collection_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Email & Notifications
ALTER TABLE "email_template_translations" ADD CONSTRAINT "email_template_translations_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ntfy_template_translations" ADD CONSTRAINT "ntfy_template_translations_template_id_ntfy_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."ntfy_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- ==================== INDEXES ====================

-- Auth (CRITICAL — token_hash lookup on every authenticated request)
CREATE UNIQUE INDEX "idx_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_expires_at" ON "refresh_tokens" ("expires_at");--> statement-breakpoint

-- Rate limiting (CRITICAL — checked on every rate-limited request)
CREATE INDEX "idx_rate_limit_key_window" ON "rate_limit_entries" ("key", "window_start" DESC);--> statement-breakpoint
CREATE INDEX "idx_rate_limit_created" ON "rate_limit_entries" ("created_at");--> statement-breakpoint

-- Account lockouts
CREATE INDEX "idx_account_lockouts_email" ON "account_lockouts" ("email");--> statement-breakpoint

-- Apartments
CREATE INDEX "idx_apartments_building_id" ON "apartments" ("building_id");--> statement-breakpoint
CREATE INDEX "idx_apartments_building_status_type" ON "apartments" ("building_id", "status", "apartment_type");--> statement-breakpoint
CREATE INDEX "idx_apartments_parent_apartment_id" ON "apartments" ("parent_apartment_id");--> statement-breakpoint

-- User apartments & moderator buildings
CREATE INDEX "idx_user_apartments_user_id" ON "user_apartments" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_apartments_apartment_id" ON "user_apartments" ("apartment_id");--> statement-breakpoint
CREATE INDEX "idx_moderator_buildings_user_id" ON "moderator_buildings" ("user_id");--> statement-breakpoint

-- Payments
CREATE INDEX "idx_payments_apartment_id" ON "payments" ("apartment_id");--> statement-breakpoint
CREATE INDEX "idx_payments_apartment_month" ON "payments" ("apartment_id", "month");--> statement-breakpoint

-- Expenses
CREATE INDEX "idx_expenses_building_id" ON "expenses" ("building_id");--> statement-breakpoint
CREATE INDEX "idx_expenses_building_date" ON "expenses" ("building_id", "expense_date" DESC);--> statement-breakpoint

-- Apartment expenses
CREATE INDEX "idx_apartment_expenses_apartment_id" ON "apartment_expenses" ("apartment_id");--> statement-breakpoint
CREATE INDEX "idx_apartment_expenses_expense_id" ON "apartment_expenses" ("expense_id", "is_canceled");--> statement-breakpoint

-- Payment allocations
CREATE INDEX "idx_payment_allocations_payment_id" ON "payment_allocations" ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_payment_allocations_ledger_entry_id" ON "payment_allocations" ("ledger_entry_id");--> statement-breakpoint
CREATE INDEX "idx_payment_allocations_apartment_expense_id" ON "payment_allocations" ("apartment_expense_id");--> statement-breakpoint

-- Apartment ledger
CREATE INDEX "idx_apartment_ledger_apt_created" ON "apartment_ledger" USING btree ("apartment_id", "created_at");--> statement-breakpoint
CREATE INDEX "idx_apartment_ledger_apt_ref" ON "apartment_ledger" ("apartment_id", "reference_type", "reference_id");--> statement-breakpoint

-- Occupancy periods
CREATE INDEX "idx_occupancy_periods_apartment_id" ON "occupancy_periods" ("apartment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "occupancy_periods_one_active_per_apartment" ON "occupancy_periods" ("apartment_id") WHERE status = 'active';--> statement-breakpoint

-- Receipts & invoices
CREATE INDEX "idx_receipts_payment_id" ON "receipts" ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_receipts_apartment_id" ON "receipts" ("apartment_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_apartment_id" ON "invoices" ("apartment_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_apartment_month" ON "invoices" ("apartment_id", "month");--> statement-breakpoint

-- Documents
CREATE INDEX "idx_documents_scope" ON "documents" ("scope_type", "scope_id");--> statement-breakpoint
CREATE INDEX "idx_documents_uploaded_by" ON "documents" ("uploaded_by");--> statement-breakpoint

-- Issues & maintenance
CREATE INDEX "idx_issue_reports_building_id" ON "issue_reports" ("building_id");--> statement-breakpoint
CREATE INDEX "idx_issue_reports_reporter_id" ON "issue_reports" ("reporter_id");--> statement-breakpoint
CREATE INDEX "idx_issue_reports_status" ON "issue_reports" ("status", "created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_maintenance_jobs_building_id" ON "maintenance_jobs" ("building_id");--> statement-breakpoint

-- Meetings
CREATE INDEX "idx_meetings_building_id" ON "meetings" ("building_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_decisions_meeting_id" ON "meeting_decisions" ("meeting_id");--> statement-breakpoint

-- Debt collection
CREATE INDEX "idx_debt_collection_log_apartment" ON "debt_collection_log" ("apartment_id");--> statement-breakpoint

-- Audit logs
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" ("created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_created" ON "audit_logs" ("user_id", "created_at" DESC);--> statement-breakpoint

-- Email logs
CREATE INDEX "idx_email_logs_created_at" ON "email_logs" ("created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_email_logs_status_created" ON "email_logs" ("status", "created_at" DESC);--> statement-breakpoint

-- SMS logs
CREATE INDEX "idx_sms_logs_created_at" ON "sms_logs" ("created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_sms_logs_status_created" ON "sms_logs" ("status", "created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_sms_logs_template" ON "sms_logs" ("template_identifier");--> statement-breakpoint

-- ==================== SEED DATA ====================

-- Email templates
INSERT INTO "email_templates" ("id", "identifier", "name", "description")
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'new_issue_report', 'New Issue Report', 'Sent to admins/moderators when a new issue is reported'),
  ('a0000000-0000-0000-0000-000000000002', 'issue_resolved', 'Issue Resolved', 'Sent to the reporter when their issue is resolved'),
  ('a0000000-0000-0000-0000-000000000003', 'payment_reminder', 'Payment Reminder', 'Sent to tenants to remind them of outstanding balance'),
  ('a0000000-0000-0000-0000-000000000004', 'otp_email_change', 'Email Change Verification', 'Sends OTP code when user requests email change')
ON CONFLICT ("identifier") DO NOTHING;--> statement-breakpoint

INSERT INTO "email_template_translations" ("template_id", "language", "subject", "html_body")
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'ar', 'تقرير عطل جديد', '<h2 style="margin:0 0 16px;color:#92400e;">⚠️ تقرير عطل جديد</h2><p style="margin:0 0 16px;color:#374151;">تم الإبلاغ عن عطل جديد في النظام:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fef3c7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#92400e;font-weight:600;width:100px;">الفئة:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">الوصف:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">المُبلّغ:</td><td style="padding:6px 0;color:#1f2937;">{{reporterName}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">الطابق:</td><td style="padding:6px 0;color:#1f2937;">{{floor}}</td></tr></table></td></tr></table><p style="margin:0;color:#6b7280;font-size:13px;">يرجى التعامل مع هذا العطل في أقرب وقت ممكن.</p>'),
  ('a0000000-0000-0000-0000-000000000001', 'he', 'דיווח תקלה חדש', '<h2 style="margin:0 0 16px;color:#92400e;">⚠️ דיווח תקלה חדש</h2><p style="margin:0 0 16px;color:#374151;">דווחה תקלה חדשה במערכת:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fef3c7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#92400e;font-weight:600;width:100px;">קטגוריה:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">תיאור:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">מדווח:</td><td style="padding:6px 0;color:#1f2937;">{{reporterName}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">קומה:</td><td style="padding:6px 0;color:#1f2937;">{{floor}}</td></tr></table></td></tr></table><p style="margin:0;color:#6b7280;font-size:13px;">אנא טפלו בתקלה בהקדם האפשרי.</p>'),
  ('a0000000-0000-0000-0000-000000000001', 'en', 'New Issue Report', '<h2 style="margin:0 0 16px;color:#92400e;">⚠️ New Issue Report</h2><p style="margin:0 0 16px;color:#374151;">A new issue has been reported in the system:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fef3c7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#92400e;font-weight:600;width:100px;">Category:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">Description:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">Reporter:</td><td style="padding:6px 0;color:#1f2937;">{{reporterName}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">Floor:</td><td style="padding:6px 0;color:#1f2937;">{{floor}}</td></tr></table></td></tr></table><p style="margin:0;color:#6b7280;font-size:13px;">Please address this issue as soon as possible.</p>'),
  ('a0000000-0000-0000-0000-000000000002', 'ar', 'تم حل العطل', '<h2 style="margin:0 0 16px;color:#15803d;">✅ تم حل العطل</h2><p style="margin:0 0 16px;color:#374151;">نود إعلامك بأن العطل التالي قد تم حله بنجاح:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#dcfce7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#15803d;font-weight:600;width:100px;">الفئة:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#15803d;font-weight:600;">الوصف:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr></table></td></tr></table><p style="margin:0;color:#374151;">شكراً لتبليغك. نحن نسعى دائماً لتقديم أفضل خدمة.</p>'),
  ('a0000000-0000-0000-0000-000000000002', 'he', 'התקלה טופלה', '<h2 style="margin:0 0 16px;color:#15803d;">✅ התקלה טופלה</h2><p style="margin:0 0 16px;color:#374151;">ברצוננו לעדכן אותך שהתקלה הבאה טופלה בהצלחה:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#dcfce7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#15803d;font-weight:600;width:100px;">קטגוריה:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#15803d;font-weight:600;">תיאור:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr></table></td></tr></table><p style="margin:0;color:#374151;">תודה על הדיווח. אנו שואפים תמיד לספק את השירות הטוב ביותר.</p>'),
  ('a0000000-0000-0000-0000-000000000002', 'en', 'Issue Resolved', '<h2 style="margin:0 0 16px;color:#15803d;">✅ Issue Resolved</h2><p style="margin:0 0 16px;color:#374151;">We would like to inform you that the following issue has been resolved successfully:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#dcfce7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#15803d;font-weight:600;width:100px;">Category:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#15803d;font-weight:600;">Description:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr></table></td></tr></table><p style="margin:0;color:#374151;">Thank you for reporting. We always strive to provide the best service.</p>'),
  ('a0000000-0000-0000-0000-000000000003', 'ar', 'تذكير بالدفع', '<h2 style="margin:0 0 16px;color:#dc2626;">💳 تذكير بالدفع</h2><p style="margin:0 0 16px;color:#374151;">نود تذكيرك بوجود رصيد مستحق على شقتك:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fee2e2;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;width:120px;">المبنى:</td><td style="padding:6px 0;color:#1f2937;">{{buildingName}}</td></tr><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;">شقة:</td><td style="padding:6px 0;color:#1f2937;">{{apartmentNumber}}</td></tr></table></td></tr></table><div style="text-align:center;margin:0 0 20px;"><p style="margin:0 0 4px;color:#6b7280;font-size:13px;">الرصيد المستحق</p><p style="margin:0;font-size:32px;font-weight:700;color:#dc2626;">₪{{balance}}</p></div><p style="margin:0;color:#374151;">يرجى الدفع في أقرب وقت ممكن لتجنب أي رسوم إضافية.</p>'),
  ('a0000000-0000-0000-0000-000000000003', 'he', 'תזכורת תשלום', '<h2 style="margin:0 0 16px;color:#dc2626;">💳 תזכורת תשלום</h2><p style="margin:0 0 16px;color:#374151;">ברצוננו להזכיר לך על יתרת חוב בדירתך:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fee2e2;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;width:120px;">בניין:</td><td style="padding:6px 0;color:#1f2937;">{{buildingName}}</td></tr><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;">דירה:</td><td style="padding:6px 0;color:#1f2937;">{{apartmentNumber}}</td></tr></table></td></tr></table><div style="text-align:center;margin:0 0 20px;"><p style="margin:0 0 4px;color:#6b7280;font-size:13px;">יתרת חוב</p><p style="margin:0;font-size:32px;font-weight:700;color:#dc2626;">₪{{balance}}</p></div><p style="margin:0;color:#374151;">אנא בצע תשלום בהקדם האפשרי כדי למנוע חיובים נוספים.</p>'),
  ('a0000000-0000-0000-0000-000000000003', 'en', 'Payment Reminder', '<h2 style="margin:0 0 16px;color:#dc2626;">💳 Payment Reminder</h2><p style="margin:0 0 16px;color:#374151;">This is a reminder that you have an outstanding balance on your apartment:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fee2e2;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;width:120px;">Building:</td><td style="padding:6px 0;color:#1f2937;">{{buildingName}}</td></tr><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;">Apartment:</td><td style="padding:6px 0;color:#1f2937;">{{apartmentNumber}}</td></tr></table></td></tr></table><div style="text-align:center;margin:0 0 20px;"><p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Balance Due</p><p style="margin:0;font-size:32px;font-weight:700;color:#dc2626;">₪{{balance}}</p></div><p style="margin:0;color:#374151;">Please make a payment at your earliest convenience to avoid any additional charges.</p>'),
  ('a0000000-0000-0000-0000-000000000004', 'ar', 'رمز التحقق لتغيير البريد الإلكتروني', '<h2 style="margin:0 0 16px;color:#1d4ed8;">🔐 رمز التحقق</h2><p style="margin:0 0 20px;color:#374151;">رمز التحقق الخاص بك لتغيير البريد الإلكتروني هو:</p><div style="text-align:center;margin:0 0 20px;"><div style="display:inline-block;padding:16px 32px;background:#dbeafe;border-radius:12px;border:2px dashed #93c5fd;"><span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1d4ed8;font-family:monospace;">{{otp}}</span></div></div><p style="margin:0 0 8px;color:#374151;">هذا الرمز صالح لمدة <strong>10 دقائق</strong>.</p><p style="margin:0;color:#6b7280;font-size:13px;">إذا لم تطلب تغيير بريدك الإلكتروني، يرجى تجاهل هذه الرسالة.</p>'),
  ('a0000000-0000-0000-0000-000000000004', 'he', 'קוד אימות לשינוי כתובת אימייל', '<h2 style="margin:0 0 16px;color:#1d4ed8;">🔐 קוד אימות</h2><p style="margin:0 0 20px;color:#374151;">קוד האימות שלך לשינוי כתובת אימייל:</p><div style="text-align:center;margin:0 0 20px;"><div style="display:inline-block;padding:16px 32px;background:#dbeafe;border-radius:12px;border:2px dashed #93c5fd;"><span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1d4ed8;font-family:monospace;">{{otp}}</span></div></div><p style="margin:0 0 8px;color:#374151;">הקוד תקף למשך <strong>10 דקות</strong>.</p><p style="margin:0;color:#6b7280;font-size:13px;">אם לא ביקשת לשנות את כתובת האימייל שלך, התעלם מהודעה זו.</p>'),
  ('a0000000-0000-0000-0000-000000000004', 'en', 'Verification code for email change', '<h2 style="margin:0 0 16px;color:#1d4ed8;">🔐 Verification Code</h2><p style="margin:0 0 20px;color:#374151;">Your verification code for email change is:</p><div style="text-align:center;margin:0 0 20px;"><div style="display:inline-block;padding:16px 32px;background:#dbeafe;border-radius:12px;border:2px dashed #93c5fd;"><span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1d4ed8;font-family:monospace;">{{otp}}</span></div></div><p style="margin:0 0 8px;color:#374151;">This code is valid for <strong>10 minutes</strong>.</p><p style="margin:0;color:#6b7280;font-size:13px;">If you did not request an email change, please ignore this message.</p>')
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Ntfy templates
INSERT INTO "ntfy_templates" ("id", "identifier", "name", "description")
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'ntfy_new_issue', 'New Issue Notification', 'Push notification sent when a new issue is reported'),
  ('b0000000-0000-0000-0000-000000000002', 'ntfy_payment_reminder', 'Payment Reminder Notification', 'Push notification sent for outstanding payment balance')
ON CONFLICT ("identifier") DO NOTHING;--> statement-breakpoint

INSERT INTO "ntfy_template_translations" ("template_id", "language", "title", "message")
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'ar', 'عطل جديد: {{category}}', '{{reporterName}}: {{description}}'),
  ('b0000000-0000-0000-0000-000000000001', 'he', 'תקלה חדשה: {{category}}', '{{reporterName}}: {{description}}'),
  ('b0000000-0000-0000-0000-000000000001', 'en', 'New Issue: {{category}}', '{{reporterName}}: {{description}}'),
  ('b0000000-0000-0000-0000-000000000002', 'ar', 'تذكير بالدفع', 'شقة {{apartmentNumber}} - رصيد مستحق: ₪{{balance}}'),
  ('b0000000-0000-0000-0000-000000000002', 'he', 'תזכורת תשלום', 'דירה {{apartmentNumber}} - יתרת חוב: ₪{{balance}}'),
  ('b0000000-0000-0000-0000-000000000002', 'en', 'Payment Reminder', 'Apartment {{apartmentNumber}} has outstanding balance: ₪{{balance}}')
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- SMS templates
INSERT INTO "sms_templates" ("id", "identifier", "name", "description")
VALUES
  ('c0000000-0000-0000-0000-000000000005', 'sms_issue_resolved', 'Issue Resolved', 'Sent to the reporter when their issue is resolved')
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO "sms_template_translations" ("template_id", "language", "message")
SELECT 'c0000000-0000-0000-0000-000000000005', v.language, v.message
FROM (VALUES
  ('ar', 'مرحباً {{tenantName}}، تم حل العطل الذي أبلغت عنه ({{category}}). شكراً لبلاغك.'),
  ('he', 'שלום {{tenantName}}, התקלה שדיווחת עליה ({{category}}) טופלה. תודה על הדיווח.'),
  ('en', 'Hello {{tenantName}}, your reported issue ({{category}}) has been resolved. Thank you for reporting.')
) AS v(language, message)
WHERE NOT EXISTS (
  SELECT 1 FROM sms_template_translations WHERE template_id = 'c0000000-0000-0000-0000-000000000005'
);
