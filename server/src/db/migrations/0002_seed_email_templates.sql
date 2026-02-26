-- =============================================================
-- Seed default email + ntfy templates with translations
-- =============================================================

-- ==================== EMAIL TEMPLATES ====================

-- 1) new_issue_report
INSERT INTO "email_templates" ("id", "identifier", "name", "description")
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'new_issue_report',
  'New Issue Report',
  'Sent to admins/moderators when a new issue is reported'
) ON CONFLICT ("identifier") DO NOTHING;--> statement-breakpoint

INSERT INTO "email_template_translations" ("template_id", "language", "subject", "html_body")
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'ar', 'تقرير عطل جديد', '<h2 style="margin:0 0 16px;color:#92400e;">⚠️ تقرير عطل جديد</h2><p style="margin:0 0 16px;color:#374151;">تم الإبلاغ عن عطل جديد في النظام:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fef3c7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#92400e;font-weight:600;width:100px;">الفئة:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">الوصف:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">المُبلّغ:</td><td style="padding:6px 0;color:#1f2937;">{{reporterName}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">الطابق:</td><td style="padding:6px 0;color:#1f2937;">{{floor}}</td></tr></table></td></tr></table><p style="margin:0;color:#6b7280;font-size:13px;">يرجى التعامل مع هذا العطل في أقرب وقت ممكن.</p>'),
  ('a0000000-0000-0000-0000-000000000001', 'he', 'דיווח תקלה חדש', '<h2 style="margin:0 0 16px;color:#92400e;">⚠️ דיווח תקלה חדש</h2><p style="margin:0 0 16px;color:#374151;">דווחה תקלה חדשה במערכת:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fef3c7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#92400e;font-weight:600;width:100px;">קטגוריה:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">תיאור:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">מדווח:</td><td style="padding:6px 0;color:#1f2937;">{{reporterName}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">קומה:</td><td style="padding:6px 0;color:#1f2937;">{{floor}}</td></tr></table></td></tr></table><p style="margin:0;color:#6b7280;font-size:13px;">אנא טפלו בתקלה בהקדם האפשרי.</p>'),
  ('a0000000-0000-0000-0000-000000000001', 'en', 'New Issue Report', '<h2 style="margin:0 0 16px;color:#92400e;">⚠️ New Issue Report</h2><p style="margin:0 0 16px;color:#374151;">A new issue has been reported in the system:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fef3c7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#92400e;font-weight:600;width:100px;">Category:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">Description:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">Reporter:</td><td style="padding:6px 0;color:#1f2937;">{{reporterName}}</td></tr><tr><td style="padding:6px 0;color:#92400e;font-weight:600;">Floor:</td><td style="padding:6px 0;color:#1f2937;">{{floor}}</td></tr></table></td></tr></table><p style="margin:0;color:#6b7280;font-size:13px;">Please address this issue as soon as possible.</p>')
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- 2) issue_resolved
INSERT INTO "email_templates" ("id", "identifier", "name", "description")
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'issue_resolved',
  'Issue Resolved',
  'Sent to the reporter when their issue is resolved'
) ON CONFLICT ("identifier") DO NOTHING;--> statement-breakpoint

INSERT INTO "email_template_translations" ("template_id", "language", "subject", "html_body")
VALUES
  ('a0000000-0000-0000-0000-000000000002', 'ar', 'تم حل العطل', '<h2 style="margin:0 0 16px;color:#15803d;">✅ تم حل العطل</h2><p style="margin:0 0 16px;color:#374151;">نود إعلامك بأن العطل التالي قد تم حله بنجاح:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#dcfce7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#15803d;font-weight:600;width:100px;">الفئة:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#15803d;font-weight:600;">الوصف:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr></table></td></tr></table><p style="margin:0;color:#374151;">شكراً لتبليغك. نحن نسعى دائماً لتقديم أفضل خدمة.</p>'),
  ('a0000000-0000-0000-0000-000000000002', 'he', 'התקלה טופלה', '<h2 style="margin:0 0 16px;color:#15803d;">✅ התקלה טופלה</h2><p style="margin:0 0 16px;color:#374151;">ברצוננו לעדכן אותך שהתקלה הבאה טופלה בהצלחה:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#dcfce7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#15803d;font-weight:600;width:100px;">קטגוריה:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#15803d;font-weight:600;">תיאור:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr></table></td></tr></table><p style="margin:0;color:#374151;">תודה על הדיווח. אנו שואפים תמיד לספק את השירות הטוב ביותר.</p>'),
  ('a0000000-0000-0000-0000-000000000002', 'en', 'Issue Resolved', '<h2 style="margin:0 0 16px;color:#15803d;">✅ Issue Resolved</h2><p style="margin:0 0 16px;color:#374151;">We would like to inform you that the following issue has been resolved successfully:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#dcfce7;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#15803d;font-weight:600;width:100px;">Category:</td><td style="padding:6px 0;color:#1f2937;">{{category}}</td></tr><tr><td style="padding:6px 0;color:#15803d;font-weight:600;">Description:</td><td style="padding:6px 0;color:#1f2937;">{{description}}</td></tr></table></td></tr></table><p style="margin:0;color:#374151;">Thank you for reporting. We always strive to provide the best service.</p>')
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- 3) payment_reminder
INSERT INTO "email_templates" ("id", "identifier", "name", "description")
VALUES (
  'a0000000-0000-0000-0000-000000000003',
  'payment_reminder',
  'Payment Reminder',
  'Sent to tenants to remind them of outstanding balance'
) ON CONFLICT ("identifier") DO NOTHING;--> statement-breakpoint

INSERT INTO "email_template_translations" ("template_id", "language", "subject", "html_body")
VALUES
  ('a0000000-0000-0000-0000-000000000003', 'ar', 'تذكير بالدفع', '<h2 style="margin:0 0 16px;color:#dc2626;">💳 تذكير بالدفع</h2><p style="margin:0 0 16px;color:#374151;">نود تذكيرك بوجود رصيد مستحق على شقتك:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fee2e2;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;width:120px;">المبنى:</td><td style="padding:6px 0;color:#1f2937;">{{buildingName}}</td></tr><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;">شقة:</td><td style="padding:6px 0;color:#1f2937;">{{apartmentNumber}}</td></tr></table></td></tr></table><div style="text-align:center;margin:0 0 20px;"><p style="margin:0 0 4px;color:#6b7280;font-size:13px;">الرصيد المستحق</p><p style="margin:0;font-size:32px;font-weight:700;color:#dc2626;">₪{{balance}}</p></div><p style="margin:0;color:#374151;">يرجى الدفع في أقرب وقت ممكن لتجنب أي رسوم إضافية.</p>'),
  ('a0000000-0000-0000-0000-000000000003', 'he', 'תזכורת תשלום', '<h2 style="margin:0 0 16px;color:#dc2626;">💳 תזכורת תשלום</h2><p style="margin:0 0 16px;color:#374151;">ברצוננו להזכיר לך על יתרת חוב בדירתך:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fee2e2;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;width:120px;">בניין:</td><td style="padding:6px 0;color:#1f2937;">{{buildingName}}</td></tr><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;">דירה:</td><td style="padding:6px 0;color:#1f2937;">{{apartmentNumber}}</td></tr></table></td></tr></table><div style="text-align:center;margin:0 0 20px;"><p style="margin:0 0 4px;color:#6b7280;font-size:13px;">יתרת חוב</p><p style="margin:0;font-size:32px;font-weight:700;color:#dc2626;">₪{{balance}}</p></div><p style="margin:0;color:#374151;">אנא בצע תשלום בהקדם האפשרי כדי למנוע חיובים נוספים.</p>'),
  ('a0000000-0000-0000-0000-000000000003', 'en', 'Payment Reminder', '<h2 style="margin:0 0 16px;color:#dc2626;">💳 Payment Reminder</h2><p style="margin:0 0 16px;color:#374151;">This is a reminder that you have an outstanding balance on your apartment:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:#fee2e2;border-radius:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;width:120px;">Building:</td><td style="padding:6px 0;color:#1f2937;">{{buildingName}}</td></tr><tr><td style="padding:6px 0;color:#991b1b;font-weight:600;">Apartment:</td><td style="padding:6px 0;color:#1f2937;">{{apartmentNumber}}</td></tr></table></td></tr></table><div style="text-align:center;margin:0 0 20px;"><p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Balance Due</p><p style="margin:0;font-size:32px;font-weight:700;color:#dc2626;">₪{{balance}}</p></div><p style="margin:0;color:#374151;">Please make a payment at your earliest convenience to avoid any additional charges.</p>')
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- 4) otp_email_change
INSERT INTO "email_templates" ("id", "identifier", "name", "description")
VALUES (
  'a0000000-0000-0000-0000-000000000004',
  'otp_email_change',
  'Email Change Verification',
  'Sends OTP code when user requests email change'
) ON CONFLICT ("identifier") DO NOTHING;--> statement-breakpoint

INSERT INTO "email_template_translations" ("template_id", "language", "subject", "html_body")
VALUES
  ('a0000000-0000-0000-0000-000000000004', 'ar', 'رمز التحقق لتغيير البريد الإلكتروني', '<h2 style="margin:0 0 16px;color:#1d4ed8;">🔐 رمز التحقق</h2><p style="margin:0 0 20px;color:#374151;">رمز التحقق الخاص بك لتغيير البريد الإلكتروني هو:</p><div style="text-align:center;margin:0 0 20px;"><div style="display:inline-block;padding:16px 32px;background:#dbeafe;border-radius:12px;border:2px dashed #93c5fd;"><span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1d4ed8;font-family:monospace;">{{otp}}</span></div></div><p style="margin:0 0 8px;color:#374151;">هذا الرمز صالح لمدة <strong>10 دقائق</strong>.</p><p style="margin:0;color:#6b7280;font-size:13px;">إذا لم تطلب تغيير بريدك الإلكتروني، يرجى تجاهل هذه الرسالة.</p>'),
  ('a0000000-0000-0000-0000-000000000004', 'he', 'קוד אימות לשינוי כתובת אימייל', '<h2 style="margin:0 0 16px;color:#1d4ed8;">🔐 קוד אימות</h2><p style="margin:0 0 20px;color:#374151;">קוד האימות שלך לשינוי כתובת אימייל:</p><div style="text-align:center;margin:0 0 20px;"><div style="display:inline-block;padding:16px 32px;background:#dbeafe;border-radius:12px;border:2px dashed #93c5fd;"><span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1d4ed8;font-family:monospace;">{{otp}}</span></div></div><p style="margin:0 0 8px;color:#374151;">הקוד תקף למשך <strong>10 דקות</strong>.</p><p style="margin:0;color:#6b7280;font-size:13px;">אם לא ביקשת לשנות את כתובת האימייל שלך, התעלם מהודעה זו.</p>'),
  ('a0000000-0000-0000-0000-000000000004', 'en', 'Verification code for email change', '<h2 style="margin:0 0 16px;color:#1d4ed8;">🔐 Verification Code</h2><p style="margin:0 0 20px;color:#374151;">Your verification code for email change is:</p><div style="text-align:center;margin:0 0 20px;"><div style="display:inline-block;padding:16px 32px;background:#dbeafe;border-radius:12px;border:2px dashed #93c5fd;"><span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1d4ed8;font-family:monospace;">{{otp}}</span></div></div><p style="margin:0 0 8px;color:#374151;">This code is valid for <strong>10 minutes</strong>.</p><p style="margin:0;color:#6b7280;font-size:13px;">If you did not request an email change, please ignore this message.</p>')
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- ==================== NTFY TABLES ====================

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

ALTER TABLE "ntfy_template_translations" ADD CONSTRAINT "ntfy_template_translations_template_id_ntfy_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."ntfy_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- ==================== NTFY TEMPLATE SEEDS ====================

-- 1) ntfy_new_issue
INSERT INTO "ntfy_templates" ("id", "identifier", "name", "description")
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'ntfy_new_issue',
  'New Issue Notification',
  'Push notification sent when a new issue is reported'
) ON CONFLICT ("identifier") DO NOTHING;--> statement-breakpoint

INSERT INTO "ntfy_template_translations" ("template_id", "language", "title", "message")
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'ar', 'عطل جديد: {{category}}', '{{reporterName}}: {{description}}'),
  ('b0000000-0000-0000-0000-000000000001', 'he', 'תקלה חדשה: {{category}}', '{{reporterName}}: {{description}}'),
  ('b0000000-0000-0000-0000-000000000001', 'en', 'New Issue: {{category}}', '{{reporterName}}: {{description}}')
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- 2) ntfy_payment_reminder
INSERT INTO "ntfy_templates" ("id", "identifier", "name", "description")
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'ntfy_payment_reminder',
  'Payment Reminder Notification',
  'Push notification sent for outstanding payment balance'
) ON CONFLICT ("identifier") DO NOTHING;--> statement-breakpoint

INSERT INTO "ntfy_template_translations" ("template_id", "language", "title", "message")
VALUES
  ('b0000000-0000-0000-0000-000000000002', 'ar', 'تذكير بالدفع', 'شقة {{apartmentNumber}} - رصيد مستحق: ₪{{balance}}'),
  ('b0000000-0000-0000-0000-000000000002', 'he', 'תזכורת תשלום', 'דירה {{apartmentNumber}} - יתרת חוב: ₪{{balance}}'),
  ('b0000000-0000-0000-0000-000000000002', 'en', 'Payment Reminder', 'Apartment {{apartmentNumber}} has outstanding balance: ₪{{balance}}')
ON CONFLICT DO NOTHING;
