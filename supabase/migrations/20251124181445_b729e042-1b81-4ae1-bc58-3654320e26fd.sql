-- Create enum for audit action types
CREATE TYPE public.audit_action_type AS ENUM (
  'login',
  'logout',
  'signup',
  'create',
  'update',
  'delete',
  'role_change',
  'password_change',
  'api_key_created',
  'api_key_deleted'
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action_type audit_action_type NOT NULL,
  table_name TEXT,
  record_id UUID,
  action_details JSONB,
  ip_address TEXT,
  user_agent TEXT
);

-- Create indexes for performance
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can view all audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'moderator'));

-- Create function to insert audit log (bypasses RLS)
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_user_id UUID,
  p_user_email TEXT,
  p_action_type audit_action_type,
  p_table_name TEXT,
  p_record_id UUID,
  p_action_details JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    user_email,
    action_type,
    table_name,
    record_id,
    action_details
  ) VALUES (
    p_user_id,
    p_user_email,
    p_action_type,
    p_table_name,
    p_record_id,
    p_action_details
  );
END;
$$;

-- Generic trigger function for audit logging
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email TEXT;
  v_action_type audit_action_type;
  v_action_details JSONB;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();

  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'create';
    v_action_details := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_action_type := 'update';
    v_action_details := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'delete';
    v_action_details := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  -- Insert audit log
  PERFORM insert_audit_log(
    auth.uid(),
    v_user_email,
    v_action_type,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_action_details
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create triggers for all critical tables
CREATE TRIGGER audit_apartments
  AFTER INSERT OR UPDATE OR DELETE ON public.apartments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_buildings
  AFTER INSERT OR UPDATE OR DELETE ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_general_information
  AFTER INSERT OR UPDATE OR DELETE ON public.general_information
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_user_apartments
  AFTER INSERT OR UPDATE OR DELETE ON public.user_apartments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_api_keys
  AFTER INSERT OR UPDATE OR DELETE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Function to cleanup old audit logs (older than 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Schedule daily cleanup using pg_cron (requires pg_cron extension)
-- First enable the extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup to run daily at midnight
SELECT cron.schedule(
  'cleanup-old-audit-logs',
  '0 0 * * *', -- At 00:00 every day
  $$SELECT public.cleanup_old_audit_logs()$$
);