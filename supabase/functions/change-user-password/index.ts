import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify they're authenticated
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('User is not an admin:', roleError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User is admin');

    // Parse request body
    const { targetUserId, newPassword, adminPassword } = await req.json();

    if (!targetUserId || !newPassword || !adminPassword) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: targetUserId, newPassword, adminPassword' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password strength (14+ chars, uppercase, lowercase, number)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{14,}$/;
    if (!passwordRegex.test(newPassword)) {
      console.error('Password does not meet security requirements');
      return new Response(
        JSON.stringify({ error: 'Password must be at least 14 characters and contain uppercase, lowercase, and numbers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Changing password for user:', targetUserId);

    // Verify admin's password
    const { error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: user.email!,
      password: adminPassword,
    });

    if (signInError) {
      console.error('Admin password verification failed:', signInError);
      return new Response(
        JSON.stringify({ error: 'Invalid admin password' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin password verified');

    // Create admin client to update user password
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Update the target user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Failed to update password:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Password updated successfully for user:', targetUserId);

    // Log audit event
    await supabaseAdmin.rpc('insert_audit_log', {
      p_user_id: user.id,
      p_user_email: user.email,
      p_action_type: 'password_change',
      p_table_name: 'profiles',
      p_record_id: targetUserId,
      p_action_details: {
        target_user_id: targetUserId,
        changed_by_admin: user.email
      }
    });

    return new Response(
      JSON.stringify({ message: 'Password updated successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in change-user-password function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
