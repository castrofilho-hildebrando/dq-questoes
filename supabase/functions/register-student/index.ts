// ============================================================
// ARQUIVO NOVO: supabase/functions/register-student/index.ts
//
// Edge function para auto-cadastro de alunos autorizados.
// Substitui o uso de supabase.auth.signUp no frontend,
// criando o usuário via admin API com email já confirmado.
//
// Não exige que o chamador seja admin — a autorização é
// validada internamente via tabela authorized_emails.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email, password, full_name, cpf } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email e senha são obrigatórios.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const normalizedEmail = email.toLowerCase().trim()

    // Verificar se o email está autorizado antes de criar o usuário
    const { data: authorized, error: authError } = await adminClient
      .from('authorized_emails')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('is_active', true)
      .maybeSingle()

    if (authError) {
      console.error('Error checking authorized_emails:', authError)
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao verificar autorização. Tente novamente.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    if (!authorized) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email não autorizado pelo administrador.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Criar o usuário com email já confirmado (sem exigir clique em link)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || null,
        cpf: cpf || null,
      },
    })

    if (createError) {
      console.error('Error creating user:', createError)

      // Usuário já existe — orientar para login
      if (createError.message.includes('already registered') || createError.message.includes('already been registered')) {
        return new Response(
          JSON.stringify({ success: false, already_exists: true, error: 'Este email já está cadastrado.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
        )
      }

      return new Response(
        JSON.stringify({ success: false, error: createError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log(`Student registered successfully: ${newUser.user.id}`)

    // Garante que o perfil existe com CPF e nome preenchidos.
    // O trigger handle_new_user pode criar o perfil, mas não copia CPF do user_metadata.
    // Upsert garante que o dado esteja disponível imediatamente após o cadastro.
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert(
        {
          user_id: newUser.user.id,
          email: normalizedEmail,
          full_name: full_name || null,
          cpf: cpf || null,
        },
        { onConflict: 'user_id' }
      )

    if (profileError) {
      console.error('Error upserting profile (non-fatal):', profileError)
    } else {
      console.log(`Profile upserted for: ${newUser.user.id}`)
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error in register-student:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno. Tente novamente.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
