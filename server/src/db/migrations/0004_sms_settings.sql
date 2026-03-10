-- SMS integration settings (019 SMS provider)
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "sms_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "sms_provider" varchar(50) DEFAULT '019';
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "sms_api_token" varchar(500);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "sms_username" varchar(255);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "sms_sender_name" varchar(11);
