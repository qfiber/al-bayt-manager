import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get the JWT from the request header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user is an admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: adminUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !adminUser) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the user is an admin
    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUser.id)
      .single();

    if (roleError || adminRole?.role !== 'admin') {
      console.error('Not admin:', roleError);
      return new Response(
        JSON.stringify({ error: 'Only admins can disable 2FA for other users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the request body
    const body = await req.json();
    const { action, targetUserId } = body;

    // Handle list-status action - returns 2FA status for all non-admin users
    if (action === 'list-status') {
      // Get all non-admin users
      const { data: userRoles, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, role')
        .neq('role', 'admin');

      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch users' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const users2FAStatus: Record<string, boolean> = {};

      // Check 2FA status for each user
      for (const userRole of userRoles || []) {
        try {
          const { data: factorsData } = await supabaseAdmin.auth.admin.mfa.listFactors({
            userId: userRole.user_id,
          });

          const totpFactors = factorsData?.factors?.filter(f => f.factor_type === 'totp' && f.status === 'verified') || [];
          users2FAStatus[userRole.user_id] = totpFactors.length > 0;
        } catch (error) {
          console.error(`Error checking 2FA for user ${userRole.user_id}:`, error);
          users2FAStatus[userRole.user_id] = false;
        }
      }

      return new Response(
        JSON.stringify({ success: true, users2FAStatus }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default action: disable 2FA for a specific user
    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'Target user ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check target user role - only allow disabling 2FA for users and moderators, not admins
    const { data: targetRole, error: targetRoleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', targetUserId)
      .single();

    if (targetRoleError) {
      console.error('Error fetching target user role:', targetRoleError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify target user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetRole?.role === 'admin') {
      return new Response(
        JSON.stringify({ error: 'Cannot disable 2FA for admin users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // List the user's MFA factors
    const { data: factorsData, error: factorsError } = await supabaseAdmin.auth.admin.mfa.listFactors({
      userId: targetUserId,
    });

    if (factorsError) {
      console.error('Error listing factors:', factorsError);
      return new Response(
        JSON.stringify({ error: 'Failed to list 2FA factors' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get TOTP factors
    const totpFactors = factorsData?.factors?.filter(f => f.factor_type === 'totp') || [];

    if (totpFactors.length === 0) {
      return new Response(
        JSON.stringify({ error: 'User does not have 2FA enabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete all TOTP factors
    for (const factor of totpFactors) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
        userId: targetUserId,
        id: factor.id,
      });

      if (deleteError) {
        console.error('Error deleting factor:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Failed to disable 2FA' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Admin ${adminUser.email} disabled 2FA for user ${targetUserId}`);

    return new Response(
      JSON.stringify({ success: true, message: '2FA disabled successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
