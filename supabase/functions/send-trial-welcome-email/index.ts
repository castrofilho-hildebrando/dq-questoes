import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailTemplate {
  id: string;
  template_type: string;
  subject: string;
  body_html: string;
}

interface WelcomeEmailRequest {
  name: string;
  email: string;
  expires_at: string;
}

function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { name, email, expires_at }: WelcomeEmailRequest = await req.json();

    if (!name || !email || !expires_at) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, email, expires_at" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Sending welcome email to ${email}`);

    // Get email template from database
    const { data: templateData, error: templateError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_type", "trial_welcome")
      .eq("is_active", true)
      .single();

    if (templateError) {
      console.error("Error fetching email template:", templateError);
      throw new Error("Email template not found");
    }

    const template = templateData as EmailTemplate;
    console.log("Using email template:", template.template_type);

    // Format expiration date
    const expiresDate = new Date(expires_at);
    const formattedExpiresAt = expiresDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const variables = {
      name: name,
      email: email,
      expires_at: formattedExpiresAt,
    };

    const emailSubject = replaceTemplateVariables(template.subject, variables);
    const emailBody = replaceTemplateVariables(template.body_html, variables);

    const emailResponse = await sendEmail(
      email,
      emailSubject,
      emailBody
    );

    console.log(`Welcome email sent successfully to ${email}:`, emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Welcome email sent successfully",
        response: emailResponse 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-trial-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
