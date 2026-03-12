import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email, error_code, error_message, error_type } = await req.json()
    
    if (!error_message) {
      return new Response(
        JSON.stringify({ success: false, error: 'error_message is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user agent and IP from request headers
    const userAgent = req.headers.get('user-agent') || 'unknown'
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      req.headers.get('x-real-ip') || 
                      'unknown'

    // Insert the error log
    const { error } = await supabase
      .from('auth_error_logs')
      .insert({
        email: email?.toLowerCase()?.trim() || null,
        error_code: error_code || null,
        error_message: error_message,
        error_type: error_type || 'unknown',
        user_agent: userAgent,
        ip_address: ipAddress,
      })

    if (error) {
      console.error('Error inserting auth error log:', error)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to log error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error in log-auth-error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})