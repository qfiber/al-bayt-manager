import { supabase } from '@/integrations/supabase/client';

type AuditActionType = 
  | 'login' 
  | 'logout' 
  | 'signup' 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'role_change' 
  | 'password_change' 
  | 'api_key_created' 
  | 'api_key_deleted';

interface AuditLogParams {
  action_type: AuditActionType;
  table_name?: string;
  record_id?: string;
  action_details?: any;
}

export const logAuditEvent = async (params: AuditLogParams) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('No user found for audit logging');
      return;
    }

    await supabase.rpc('insert_audit_log', {
      p_user_id: user.id,
      p_user_email: user.email || null,
      p_action_type: params.action_type,
      p_table_name: params.table_name || null,
      p_record_id: params.record_id || null,
      p_action_details: params.action_details || null
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
};
