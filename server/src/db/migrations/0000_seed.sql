-- =============================================================
-- Al-Bayt Manager — Full database seed (single-file schema)
-- =============================================================

-- ==================== ENUMS ====================

CREATE TYPE "public"."app_role" AS ENUM('admin', 'user', 'moderator');--> statement-breakpoint
CREATE TYPE "public"."audit_action_type" AS ENUM('login', 'logout', 'signup', 'create', 'update', 'delete', 'role_change', 'password_change', 'api_key_created', 'api_key_deleted');--> statement-breakpoint
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
	"apartment_expense_id" uuid NOT NULL,
	"amount_allocated" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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

-- Email
ALTER TABLE "email_template_translations" ADD CONSTRAINT "email_template_translations_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- ==================== INDEXES ====================

CREATE INDEX "apartment_ledger_apartment_id_created_at_idx" ON "apartment_ledger" USING btree ("apartment_id","created_at");--> statement-breakpoint
CREATE INDEX "occupancy_periods_apartment_id_idx" ON "occupancy_periods" ("apartment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "occupancy_periods_one_active_per_apartment" ON "occupancy_periods" ("apartment_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "idx_receipts_payment_id" ON "receipts" ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_receipts_apartment_id" ON "receipts" ("apartment_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_apartment_id" ON "invoices" ("apartment_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_apartment_month" ON "invoices" ("apartment_id", "month");--> statement-breakpoint
CREATE INDEX "idx_documents_scope" ON "documents" ("scope_type", "scope_id");--> statement-breakpoint
CREATE INDEX "idx_documents_uploaded_by" ON "documents" ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_meetings_building_id" ON "meetings" ("building_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_decisions_meeting_id" ON "meeting_decisions" ("meeting_id");--> statement-breakpoint
CREATE INDEX "idx_debt_collection_log_apartment" ON "debt_collection_log" ("apartment_id");
