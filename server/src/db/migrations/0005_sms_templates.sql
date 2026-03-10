-- SMS templates table
CREATE TABLE IF NOT EXISTS "sms_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identifier" varchar(255) NOT NULL UNIQUE,
  "name" varchar(255) NOT NULL,
  "description" varchar(500),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- SMS template translations table
CREATE TABLE IF NOT EXISTS "sms_template_translations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL REFERENCES "sms_templates"("id") ON DELETE CASCADE,
  "language" varchar(10) NOT NULL,
  "message" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
