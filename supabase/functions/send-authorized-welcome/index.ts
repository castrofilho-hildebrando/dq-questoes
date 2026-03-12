import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const PLATFORM_URL = Deno.env.get("APP_URL") ?? "https://db-questoes.dissecandoquestoes.com/auth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar Bearer token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verificar identidade do chamador
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: callerUser },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verificar role admin
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.warn("Access denied for user:", callerUser.id);
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // A partir daqui o chamador é admin confirmado
    const { email, product_id, is_test } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Missing required field: email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Admin ${callerUser.id} sending authorized welcome email to ${email}`, { product_id, is_test });

    // Resolver product_id
    let resolvedProductId = product_id || null;
    let productName = "";

    if (!resolvedProductId && !is_test) {
      const { data: emailProds } = await adminClient
        .from("authorized_email_products")
        .select("product_id")
        .eq("email", email.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(1);

      if (emailProds && emailProds.length > 0) {
        resolvedProductId = emailProds[0].product_id;
      }
    }

    if (resolvedProductId) {
      const { data: prodData } = await adminClient
        .from("product_definitions")
        .select("name")
        .eq("id", resolvedProductId)
        .single();

      if (prodData) {
        productName = prodData.name;
      }
    }

    // Buscar template específico do produto, com fallback para genérico
    let template = null;

    if (resolvedProductId) {
      const { data: productTemplate } = await adminClient
        .from("email_templates")
        .select("subject, body_html")
        .eq("template_type", "authorized_welcome")
        .eq("product_id", resolvedProductId)
        .eq("is_active", true)
        .single();

      if (productTemplate) {
        template = productTemplate;
        console.log(`Using product-specific template for product ${resolvedProductId}`);
      }
    }

    if (!template) {
      const { data: genericTemplate, error: templateError } = await adminClient
        .from("email_templates")
        .select("subject, body_html")
        .eq("template_type", "authorized_welcome")
        .is("product_id", null)
        .eq("is_active", true)
        .single();

      if (templateError || !genericTemplate) {
        console.error("Error fetching email template:", templateError);
        throw new Error("Email template 'authorized_welcome' not found or inactive");
      }
      template = genericTemplate;
      console.log("Using generic template (no product-specific template found)");
    }

    const variables: Record<string, string> = {
      email,
      platform_url: PLATFORM_URL,
      product_name: productName || "Dissecando Questões",
    };

    const subject = replaceTemplateVariables(template.subject, variables);
    const html = replaceTemplateVariables(template.body_html, variables);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Dissecando Questões <noreply@dissecandoquestoes.com>",
        reply_to: "suporte@dissecadordequestoes.com",
        to: [email],
        subject: is_test ? `[TESTE] ${subject}` : subject,
        html,
        headers: {
          "List-Unsubscribe": "<mailto:suporte@dissecadordequestoes.com?subject=unsubscribe>",
          "X-Entity-Ref-ID": crypto.randomUUID(),
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", error);
      throw new Error(`Resend API error: ${error}`);
    }

    const emailResponse = await response.json();
    console.log(`Welcome email sent successfully to ${email}:`, emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: is_test ? "Test email sent" : "Welcome email sent",
        response: emailResponse,
        template_used: resolvedProductId ? "product_specific" : "generic",
        product_name: productName || null,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("Error in send-authorized-welcome:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
