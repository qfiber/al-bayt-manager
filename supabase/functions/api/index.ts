import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key required. Include x-api-key header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash the API key to compare with stored hash
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Validate API key
    const { data: apiKeyData, error: keyError } = await supabase
      .from('api_keys')
      .select('id, user_id, is_active')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (keyError || !apiKeyData) {
      console.error('Invalid API key:', keyError);
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_used_at
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyData.id);

    // Parse URL to get endpoint and query params
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(p => p);
    const endpoint = pathParts[pathParts.length - 1]; // Last part after /api/

    console.log('API request:', endpoint, 'from user:', apiKeyData.user_id);

    // Route to different endpoints - all read-only
    switch (endpoint) {
      case 'apartments': {
        const { data, error } = await supabase
          .from('apartments')
          .select('*, buildings(*)');
        
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'buildings': {
        const { data, error } = await supabase
          .from('buildings')
          .select('*');
        
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'expenses': {
        const { data, error } = await supabase
          .from('expenses')
          .select('*, buildings(*)');
        
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'payments': {
        const { data, error } = await supabase
          .from('payments')
          .select('*, apartments(*, buildings(*))');
        
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'users': {
        const { data, error } = await supabase
          .from('profiles')
          .select('*');
        
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'user-apartments': {
        const { data, error } = await supabase
          .from('user_apartments')
          .select('*, apartments(*, buildings(*)), profiles:user_id(*)');
        
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default: {
        return new Response(
          JSON.stringify({ 
            error: 'Unknown endpoint',
            available_endpoints: [
              '/apartments',
              '/buildings', 
              '/expenses',
              '/payments',
              '/users',
              '/user-apartments'
            ]
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
  } catch (error) {
    console.error('Error in API function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});