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
    
    // Check if this is a parameterized route (e.g., /apartments/{id})
    // The second-to-last part would be the endpoint name
    const endpoint = pathParts.length > 2 && 
                    ['apartments', 'buildings', 'expenses', 'payments', 'users'].includes(pathParts[pathParts.length - 2])
      ? pathParts[pathParts.length - 2]
      : pathParts[pathParts.length - 1];

    console.log('API request:', endpoint, 'from user:', apiKeyData.user_id);

    // Route to different endpoints - all read-only
    switch (endpoint) {
      case 'apartments': {
        // Check if there's an ID in the path (e.g., /api/apartments/123)
        const apartmentId = pathParts[pathParts.length - 2] === 'apartments' && pathParts.length > 2 
          ? pathParts[pathParts.length - 1] 
          : null;

        if (apartmentId) {
          // Single apartment endpoint
          const { data: apartment, error: aptError } = await supabase
            .from('apartments')
            .select('*, buildings(*)')
            .eq('id', apartmentId)
            .single();
          
          if (aptError) throw aptError;

          // Get user info (owner or beneficiary)
          let userName = null;
          let userPhone = null;
          const userId = apartment.beneficiary_id || apartment.owner_id;
          
          if (userId) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name, phone')
              .eq('id', userId)
              .single();
            
            if (profile) {
              userName = profile.name;
              userPhone = profile.phone;
            }
          }

          // Calculate months occupied and debt
          let monthsOccupied = 0;
          let debtDetails = [];
          let totalDebt = 0;

          if (apartment.occupancy_start) {
            const startDate = new Date(apartment.occupancy_start);
            const now = new Date();
            
            // Calculate months from start to now
            monthsOccupied = (now.getFullYear() - startDate.getFullYear()) * 12 + 
                            (now.getMonth() - startDate.getMonth()) + 1;

            // Calculate debt per month
            const totalOwed = monthsOccupied * apartment.subscription_amount;
            totalDebt = totalOwed + apartment.credit; // credit is negative for debt

            // Generate month-by-month debt details
            for (let i = 0; i < monthsOccupied; i++) {
              const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
              const monthStr = `${String(monthDate.getMonth() + 1).padStart(2, '0')}/${monthDate.getFullYear()}`;
              
              // Check if this month is paid
              const { data: payment } = await supabase
                .from('payments')
                .select('amount')
                .eq('apartment_id', apartment.id)
                .eq('month', monthStr)
                .maybeSingle();

              debtDetails.push({
                month: monthStr,
                amount_due: apartment.subscription_amount,
                amount_paid: payment?.amount || 0,
                balance: apartment.subscription_amount - (payment?.amount || 0)
              });
            }
          }

          return new Response(JSON.stringify({ 
            data: {
              ...apartment,
              user_name: userName,
              user_phone: userPhone,
              months_occupied: monthsOccupied,
              total_debt: totalDebt,
              debt_details: debtDetails
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          // All apartments endpoint
          const { data: apartments, error } = await supabase
            .from('apartments')
            .select('*, buildings(*)');
          
          if (error) throw error;

          // Enrich each apartment with user info and credit
          const enrichedApartments = await Promise.all(apartments.map(async (apt) => {
            let userName = null;
            let userPhone = null;
            const userId = apt.beneficiary_id || apt.owner_id;
            
            if (userId) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('name, phone')
                .eq('id', userId)
                .single();
              
              if (profile) {
                userName = profile.name;
                userPhone = profile.phone;
              }
            }

            return {
              ...apt,
              user_name: userName,
              user_phone: userPhone,
              total_credit: apt.credit
            };
          }));

          return new Response(JSON.stringify({ data: enrichedApartments }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
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
          .select('*, apartments(*, buildings(*))');
        
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
              '/apartments/{id}',
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