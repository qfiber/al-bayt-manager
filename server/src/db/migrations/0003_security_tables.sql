-- Account lockouts table for brute-force protection
CREATE TABLE IF NOT EXISTS "account_lockouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) NOT NULL UNIQUE,
  "failed_attempts" integer DEFAULT 0 NOT NULL,
  "locked_until" timestamp with time zone,
  "last_failed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Rate limit entries table for distributed rate limiting
CREATE TABLE IF NOT EXISTS "rate_limit_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(255) NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "count" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Index for fast rate limit lookups
CREATE INDEX IF NOT EXISTS "idx_rate_limit_key_window" ON "rate_limit_entries" ("key", "window_start");
--> statement-breakpoint
-- Index for cleanup of old rate limit entries
CREATE INDEX IF NOT EXISTS "idx_rate_limit_created" ON "rate_limit_entries" ("created_at");
--> statement-breakpoint
-- Add new audit action types for security events
ALTER TYPE "audit_action_type" ADD VALUE IF NOT EXISTS 'failed_login';
--> statement-breakpoint
ALTER TYPE "audit_action_type" ADD VALUE IF NOT EXISTS 'account_locked';
--> statement-breakpoint
ALTER TYPE "audit_action_type" ADD VALUE IF NOT EXISTS 'rate_limited';
--> statement-breakpoint
ALTER TYPE "audit_action_type" ADD VALUE IF NOT EXISTS 'unauthorized_access';
