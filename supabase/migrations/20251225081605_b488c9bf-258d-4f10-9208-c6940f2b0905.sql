-- Add preferred_language to profiles table
ALTER TABLE public.profiles 
ADD COLUMN preferred_language TEXT DEFAULT 'ar' 
CHECK (preferred_language IN ('ar', 'en', 'he'));

-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on email_templates
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Admin policies for email_templates
CREATE POLICY "Admins can view email templates" 
ON public.email_templates 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert email templates" 
ON public.email_templates 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update email templates" 
ON public.email_templates 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete email templates" 
ON public.email_templates 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- Create email_template_translations table
CREATE TABLE public.email_template_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.email_templates(id) ON DELETE CASCADE NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('ar', 'en', 'he')),
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(template_id, language)
);

-- Enable RLS on email_template_translations
ALTER TABLE public.email_template_translations ENABLE ROW LEVEL SECURITY;

-- Admin policies for email_template_translations
CREATE POLICY "Admins can view template translations" 
ON public.email_template_translations 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert template translations" 
ON public.email_template_translations 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update template translations" 
ON public.email_template_translations 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete template translations" 
ON public.email_template_translations 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- Create email_logs table (separate from audit_logs)
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  template_identifier TEXT NOT NULL,
  user_preferred_language TEXT,
  language_used TEXT,
  subject_sent TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  failure_reason TEXT,
  metadata JSONB
);

-- Enable RLS on email_logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Admin/Moderator can view email logs
CREATE POLICY "Admins can view email logs" 
ON public.email_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can view email logs" 
ON public.email_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'moderator'));

-- Create updated_at trigger for email_templates
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for email_template_translations
CREATE TRIGGER update_email_template_translations_updated_at
BEFORE UPDATE ON public.email_template_translations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default templates
INSERT INTO public.email_templates (identifier, name, description) VALUES
('payment_confirmation', 'Payment Confirmation', 'Sent when a payment is recorded for an apartment'),
('expense_notification', 'Expense Notification', 'Sent when an expense is added to an apartment'),
('building_expense_alert', 'Building Expense Alert', 'Sent when a building-wide expense is added');

-- Seed default Arabic translations
INSERT INTO public.email_template_translations (template_id, language, subject, html_body)
SELECT id, 'ar', 'تأكيد الدفع - {{building_name}}', 
'<div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
<h2>مرحباً {{username}}</h2>
<p>تم تسجيل دفعة لشقتك رقم {{apartment_number}} في {{building_name}}.</p>
<p>شكراً لك!</p>
</div>'
FROM public.email_templates WHERE identifier = 'payment_confirmation';

INSERT INTO public.email_template_translations (template_id, language, subject, html_body)
SELECT id, 'ar', 'إشعار مصروف جديد - {{building_name}}',
'<div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
<h2>مرحباً {{username}}</h2>
<p>تمت إضافة مصروف جديد لشقتك رقم {{apartment_number}} في {{building_name}}.</p>
<p>يرجى مراجعة التفاصيل في لوحة التحكم.</p>
</div>'
FROM public.email_templates WHERE identifier = 'expense_notification';

INSERT INTO public.email_template_translations (template_id, language, subject, html_body)
SELECT id, 'ar', 'تنبيه مصروف المبنى - {{building_name}}',
'<div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
<h2>مرحباً {{username}}</h2>
<p>تمت إضافة مصروف جديد للمبنى {{building_name}}.</p>
<p>هذا المصروف يؤثر على جميع الشقق في المبنى.</p>
</div>'
FROM public.email_templates WHERE identifier = 'building_expense_alert';