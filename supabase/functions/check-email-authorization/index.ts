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
    const { email } = await req.json()
    
    if (!email) {
      return new Response(
        JSON.stringify({ authorized: false, error: 'Email is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const normalizedEmail = email.toLowerCase().trim()

    console.log(`Checking authorization for email: ${normalizedEmail}`)

    // Check if email is authorized (fast indexed query)
    const { data: authorized, error: authError } = await supabase
      .from('authorized_emails')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('is_active', true)
      .maybeSingle()

    if (authError) {
      console.error('Error checking authorized_emails:', authError)
    }

    // Check if user exists using indexed query on profiles table (O(1) with index)
    // This is the primary method - fast and scalable for any number of users
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', normalizedEmail)
      .maybeSingle()
    
    let existingAuthUser = false
    
    if (profileData && !profileError) {
      existingAuthUser = true
      console.log(`User found in profiles: ${profileData.user_id}`)
    } else {
      // Fallback: Direct lookup using admin API (for edge case where profile doesn't exist)
      // This should rarely happen if sync is working properly
      console.log('Profile not found, checking auth.users directly...')
      
      try {
        // Use admin API to list users and find by email
        // We paginate in small chunks for efficiency
        const { data: authData, error: authUserError } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        })
        
        if (!authUserError && authData?.users) {
          const foundUser = authData.users.find(
            (u: any) => u.email?.toLowerCase() === normalizedEmail
          )
          if (foundUser) {
            existingAuthUser = true
            console.log(`User found in auth.users: ${foundUser.id}`)
            
            // Auto-create missing profile for data consistency
            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                user_id: foundUser.id,
                email: normalizedEmail,
                full_name: foundUser.user_metadata?.full_name || null
              })
            
            if (!insertError) {
              console.log(`Auto-created missing profile for ${normalizedEmail}`)
            }
          }
        }
      } catch (e) {
        console.error('Error in auth.users fallback:', e)
      }
    }

    console.log(`Result - authorized: ${!!authorized}, exists: ${existingAuthUser}`)

    return new Response(
      JSON.stringify({ 
        authorized: !!authorized,
        exists: existingAuthUser
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error checking email:', error)
    return new Response(
      JSON.stringify({ authorized: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})