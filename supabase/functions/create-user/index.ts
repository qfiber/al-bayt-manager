import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create Supabase admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Extract the JWT token
    const token = authHeader.replace('Bearer ', '');

    // Verify the user's JWT token using admin client
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Unauthorized - invalid token');
    }

    console.log('Authenticated user:', user.id);

    // Check if user is admin using service role (bypasses RLS)
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      console.error('Not an admin:', { userId: user.id, role: roleData?.role, error: roleError });
      throw new Error('Unauthorized - user is not an admin');
    }

    console.log('User is admin, proceeding with user creation');

    // Parse request body
    const { email, password, name, phone, role } = await req.json();

    console.log('Creating new user:', { email, name, role });

    // Validate required fields
    if (!email || !password || !name) {
      throw new Error('Email, password, and name are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format. Please provide a valid email address.');
    }

    // Validate password length
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    // Create the user in auth.users
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name,
      },
    });

    if (createError) {
      console.error('Error creating user:', createError);
      
      // Handle specific error cases with user-friendly messages
      if (createError.message?.includes('already been registered')) {
        throw new Error('A user with this email already exists. Please use a different email address.');
      }
      
      throw createError;
    }

    console.log('User created in auth:', newUser.user.id);

    // Upsert the profile (trigger may have already created it)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ 
        id: newUser.user.id,
        name,
        phone: phone || null
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      console.error('Error upserting profile:', profileError);
      throw profileError;
    }

    console.log('Profile created/updated');

    // Handle the user role (trigger may have already created it)
    // First, delete any existing role for this user
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', newUser.user.id);

    // Then insert the desired role
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({ 
        user_id: newUser.user.id, 
        role: role || 'user' 
      });

    if (roleInsertError) {
      console.error('Error inserting role:', roleInsertError);
      throw roleInsertError;
    }

    console.log('User role set');

    console.log('User creation complete:', newUser.user.id);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          name,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in create-user function:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
})
