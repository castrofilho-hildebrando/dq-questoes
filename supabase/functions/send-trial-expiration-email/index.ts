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

interface TrialRegistration {
  id: string;
  name: string;
  email: string;
  expires_at: string;
  is_active: boolean;
}

interface EmailTemplate {
  id: string;
  template_type: string;
  subject: string;
  body_html: string;
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

    // Get email template from database
    const { data: templateData, error: templateError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_type", "trial_expiration")
      .eq("is_active", true)
      .single();

    if (templateError) {
      console.error("Error fetching email template:", templateError);
      throw new Error("Email template not found");
    }

    const template = templateData as EmailTemplate;
    console.log("Using email template:", template.template_type);

    // Get trials expiring in the next 2 days that are still active
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    
    console.log("Checking for trials expiring between now and:", twoDaysFromNow.toISOString());

    const { data: expiringTrials, error: fetchError } = await supabase
      .from("trial_registrations")
      .select("*")
      .eq("is_active", true)
      .eq("converted_to_user", false)
      .gte("expires_at", now.toISOString())
      .lte("expires_at", twoDaysFromNow.toISOString());

    if (fetchError) {
      console.error("Error fetching expiring trials:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiringTrials?.length || 0} expiring trials`);

    const emailResults = [];

    for (const trial of expiringTrials || []) {
      const expiresAt = new Date(trial.expires_at);
      const hoursRemaining = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
      const daysRemaining = Math.round(hoursRemaining / 24);
      
      let timeMessage = "";
      if (daysRemaining >= 1) {
        timeMessage = `${daysRemaining} dia${daysRemaining > 1 ? 's' : ''}`;
      } else if (hoursRemaining > 0) {
        timeMessage = `${hoursRemaining} hora${hoursRemaining > 1 ? 's' : ''}`;
      } else {
        timeMessage = "algumas horas";
      }

      console.log(`Sending expiration email to ${trial.email} - ${timeMessage} remaining`);

      try {
        const variables = {
          name: trial.name,
          email: trial.email,
          time_remaining: timeMessage,
          upgrade_url: "https://db-questoes.dissecandoquestoes.com",
        };

        const emailSubject = replaceTemplateVariables(template.subject, variables);
        const emailBody = replaceTemplateVariables(template.body_html, variables);

        const emailResponse = await sendEmail(
          trial.email,
          emailSubject,
          emailBody
        );

        console.log(`Email sent successfully to ${trial.email}:`, emailResponse);
        emailResults.push({ email: trial.email, status: "sent", response: emailResponse });
      } catch (emailError: any) {
        console.error(`Error sending email to ${trial.email}:`, emailError);
        emailResults.push({ email: trial.email, status: "error", error: emailError.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        trialsChecked: expiringTrials?.length || 0,
        emailsSent: emailResults.filter(r => r.status === "sent").length,
        results: emailResults 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-trial-expiration-email function:", error);
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
