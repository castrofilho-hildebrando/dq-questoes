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

    // CORREÇÃO: erro na query de autorização é tratado como erro técnico,
    // não como "email não autorizado", para evitar falso negativo ao aluno.
    if (authError) {
      console.error('Error checking authorized_emails:', authError)
      return new Response(
        JSON.stringify({ technical_error: true, error: 'Erro ao verificar autorização. Tente novamente.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Email não está na lista — retorno limpo sem ambiguidade
    if (!authorized) {
      console.log(`Email not authorized: ${normalizedEmail}`)
      return new Response(
        JSON.stringify({ authorized: false, exists: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Email autorizado — verificar se o usuário já completou o cadastro
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
      // Fallback: busca direta em auth.users para o caso de o profile ainda não ter sido criado
      // pelo trigger handle_new_user (race condition pós-signUp)
      console.log('Profile not found, checking auth.users directly...')

      try {
        const { data: authData, error: authUserError } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        })

        if (!authUserError && authData?.users) {
          const foundUser = authData.users.find(
            (u: any) => u.email?.toLowerCase() === normalizedEmail
          )
          if (foundUser) {
            existingAuthUser = true
            console.log(`User found in auth.users: ${foundUser.id}`)

            // Cria o profile ausente para consistência dos dados
            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                user_id: foundUser.id,
                email: normalizedEmail,
                full_name: foundUser.user_metadata?.full_name || null,
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

    console.log(`Result - authorized: true, exists: ${existingAuthUser}`)

    return new Response(
      JSON.stringify({
        authorized: true,
        exists: existingAuthUser,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error checking email:', error)
    return new Response(
      JSON.stringify({ technical_error: true, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
