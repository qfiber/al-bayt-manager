-- SMS delivery logs
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_identifier VARCHAR(255),
  recipient_phone VARCHAR(50) NOT NULL,
  user_id UUID,
  status VARCHAR(50) NOT NULL,
  failure_reason TEXT,
  message_sent TEXT,
  language_used VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sms_logs_created_at ON sms_logs (created_at DESC);
CREATE INDEX idx_sms_logs_status ON sms_logs (status);
CREATE INDEX idx_sms_logs_template ON sms_logs (template_identifier);

-- SMS opt-out per tenant
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN NOT NULL DEFAULT true;

-- SMS issue resolved template
INSERT INTO sms_templates (id, identifier, name, description)
VALUES (
  'c0000000-0000-0000-0000-000000000005',
  'sms_issue_resolved',
  'Issue Resolved',
  'Sent to the reporter when their issue is resolved'
) ON CONFLICT DO NOTHING;

INSERT INTO sms_template_translations (template_id, language, message)
SELECT 'c0000000-0000-0000-0000-000000000005', v.language, v.message
FROM (VALUES
  ('ar', 'مرحباً {{tenantName}}، تم حل العطل الذي أبلغت عنه ({{category}}). شكراً لبلاغك.'),
  ('he', 'שלום {{tenantName}}, התקלה שדיווחת עליה ({{category}}) טופלה. תודה על הדיווח.'),
  ('en', 'Hello {{tenantName}}, your reported issue ({{category}}) has been resolved. Thank you for reporting.')
) AS v(language, message)
WHERE NOT EXISTS (
  SELECT 1 FROM sms_template_translations WHERE template_id = 'c0000000-0000-0000-0000-000000000005'
);
