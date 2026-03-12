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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify admin access
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      // Check if user is admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle()

      if (!roles) {
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        )
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    console.log('Starting user profile sync...')

    // Get all existing profile emails for fast lookup
    const { data: existingProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('email, user_id')

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      throw profilesError
    }

    const existingEmails = new Set(existingProfiles?.map(p => p.email.toLowerCase()) || [])
    const existingUserIds = new Set(existingProfiles?.map(p => p.user_id) || [])
    
    console.log(`Found ${existingEmails.size} existing profiles`)

    // Get all auth users (paginate through all)
    const missingProfiles: Array<{
      user_id: string
      email: string
      full_name: string | null
    }> = []

    let page = 1
    let hasMore = true

    while (hasMore) {
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
        page,
        perPage: 100
      })

      if (authError) {
        console.error(`Error fetching auth users page ${page}:`, authError)
        throw authError
      }

      if (!authData?.users || authData.users.length === 0) {
        hasMore = false
        break
      }

      console.log(`Processing page ${page} with ${authData.users.length} users`)

      for (const user of authData.users) {
        const email = user.email?.toLowerCase()
        if (!email) continue

        // Check if profile exists by user_id or email
        if (!existingUserIds.has(user.id) && !existingEmails.has(email)) {
          missingProfiles.push({
            user_id: user.id,
            email: email,
            full_name: user.user_metadata?.full_name || null
          })
        }
      }

      // Check if there are more pages
      if (authData.users.length < 100) {
        hasMore = false
      } else {
        page++
      }
    }

    console.log(`Found ${missingProfiles.length} users without profiles`)

    // Insert missing profiles
    let inserted = 0
    let errors: string[] = []

    for (const profile of missingProfiles) {
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          user_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name
        })

      if (insertError) {
        console.error(`Error inserting profile for ${profile.email}:`, insertError)
        errors.push(`${profile.email}: ${insertError.message}`)
      } else {
        inserted++
        console.log(`Created profile for ${profile.email}`)
      }
    }

    // Also ensure all users have the default 'user' role
    let rolesCreated = 0
    for (const profile of missingProfiles) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: profile.user_id,
          role: 'user'
        })
        .select()
        .maybeSingle()

      if (!roleError) {
        rolesCreated++
      }
    }

    const result = {
      success: true,
      summary: {
        total_auth_users_checked: page * 100,
        existing_profiles: existingEmails.size,
        missing_profiles_found: missingProfiles.length,
        profiles_created: inserted,
        roles_created: rolesCreated,
        errors: errors.length > 0 ? errors : undefined
      }
    }

    console.log('Sync completed:', result)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    console.error('Sync error:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
