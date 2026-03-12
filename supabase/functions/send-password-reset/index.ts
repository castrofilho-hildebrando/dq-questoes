import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const CUSTOM_DOMAIN = Deno.env.get("APP_URL") ?? "https://db-questoes.dissecandoquestoes.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Dissecando Questões <noreply@dissecandoquestoes.com>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return response.json();
}

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
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: templateData, error: templateError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_type", "password_recovery")
      .eq("is_active", true)
      .single();

    if (templateError || !templateData) {
      console.log("Password recovery template is inactive or not found, skipping email");
      return new Response(JSON.stringify({ success: true, message: "If the email exists, a recovery link was sent" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email.toLowerCase().trim(),
    });

    if (linkError) {
      console.error("Error generating recovery link:", linkError);
      return new Response(JSON.stringify({ success: true, message: "If the email exists, a recovery link was sent" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("Recovery link generated successfully for:", email);

    const actionLink = linkData?.properties?.action_link;

    if (!actionLink) {
      console.error("No action link returned from generateLink");
      return new Response(JSON.stringify({ success: true, message: "If the email exists, a recovery link was sent" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const actionUrl = new URL(actionLink);
    actionUrl.searchParams.set("redirect_to", `${CUSTOM_DOMAIN}/reset-password`);
    const customResetUrl = actionUrl.toString();

    console.log("Custom reset URL built:", customResetUrl);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("email", email.toLowerCase().trim())
      .single();

    const userName = profile?.full_name || "Usuário";

    const variables = {
      name: userName,
      email: email.toLowerCase().trim(),
      reset_url: customResetUrl,
      expires_in: "24 horas",
    };

    const emailSubject = replaceTemplateVariables(templateData.subject, variables);
    const emailBody = replaceTemplateVariables(templateData.body_html, variables);

    const emailResponse = await sendEmail(email.toLowerCase().trim(), emailSubject, emailBody);
    console.log("Password reset email sent successfully via Resend:", emailResponse);

    return new Response(JSON.stringify({ success: true, message: "Recovery email sent" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-password-reset:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
