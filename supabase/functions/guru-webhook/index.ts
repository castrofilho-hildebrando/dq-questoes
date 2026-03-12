import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Legacy env token — kept for backward compatibility during transition
const WEBHOOK_TOKEN = Deno.env.get("WEBHOOK_TOKEN");

// Helper function to verify webhook token:
// 1) Try product_offer_tokens table (multi-product)
// 2) Fall back to env WEBHOOK_TOKEN (legacy)
async function verifyWebhookAuth(
  req: Request,
  supabase: any
): Promise<{ valid: boolean; error?: string; product_id?: string; is_legacy?: boolean }> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return { valid: false, error: "Missing token parameter" };
  }

  // 1) Check product_offer_tokens table first
  const { data: offerToken, error } = await supabase
    .from("product_offer_tokens")
    .select("product_id, is_active")
    .eq("offer_token", token)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!error && offerToken) {
    console.log("Webhook authenticated via product_offer_tokens, product_id:", offerToken.product_id);
    return { valid: true, product_id: offerToken.product_id, is_legacy: false };
  }

  // 2) Fall back to legacy env token
  if (WEBHOOK_TOKEN && token === WEBHOOK_TOKEN) {
    console.log("Webhook authenticated via legacy WEBHOOK_TOKEN env");
    return { valid: true, is_legacy: true };
  }

  return { valid: false, error: "Invalid token" };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify webhook authentication
    const authResult = await verifyWebhookAuth(req, supabase);
    if (!authResult.valid) {
      console.error("Webhook authentication failed:", authResult.error);
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await req.json();
    const transactionStatus = (payload.status || "").toLowerCase().trim();
    console.log("Guru webhook received — status:", transactionStatus, "payload:", JSON.stringify(payload));

    // Determine action based on transaction status
    const GRANT_STATUSES = ["approved", "confirmed"];
    const REVOKE_STATUSES = ["refunded", "canceled", "chargedback", "chargeback"];
    const isGrant = GRANT_STATUSES.includes(transactionStatus);
    const isRevoke = REVOKE_STATUSES.includes(transactionStatus);

    // Log the webhook request for audit
    await supabase
      .from("offer_webhook_logs")
      .insert({
        payload,
        status: isGrant ? "processing_grant" : isRevoke ? "processing_revoke" : "ignored_status",
        processed_email: null
      });

    // If status is not actionable, acknowledge but do nothing
    if (!isGrant && !isRevoke) {
      console.log(`Ignoring webhook with non-actionable status: "${transactionStatus}"`);
      return new Response(
        JSON.stringify({ success: true, action: "ignored", reason: `Status "${transactionStatus}" is not actionable` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Helper function to get nested value from object using dot notation
    const getNestedValue = (obj: any, path: string): string | undefined => {
      const keys = path.split('.');
      let value = obj;
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return undefined;
        }
      }
      return typeof value === 'string' ? value : undefined;
    };

    // Fetch configured email fields from database
    const { data: emailFields } = await supabase
      .from("webhook_email_fields")
      .select("field_name")
      .eq("is_active", true)
      .order("display_order");

    // Default fields if none configured
    const fieldsToCheck = emailFields?.map((f: any) => f.field_name) || [
      "contact.email",
      "email",
      "buyer_email",
      "customer_email",
      "contact_email",
      "subscriber.email",
      "user.email"
    ];

    // Extract email from payload
    let email = "";
    for (const field of fieldsToCheck) {
      let value = getNestedValue(payload, field);

      if (!value && field.startsWith("payload.")) {
        const cleanField = field.substring(8);
        value = getNestedValue(payload, cleanField);
        if (value) {
          console.log(`Email found in field: ${field} (resolved without payload prefix as: ${cleanField})`);
        }
      }

      if (value) {
        email = value.toLowerCase().trim();
        if (email) {
          console.log(`Email found in field: ${field}`);
          break;
        }
      }
    }

    if (!email) {
      console.error("No email found in payload. Checked fields:", fieldsToCheck);
      return new Response(
        JSON.stringify({ error: "Email not found in payload", checked_fields: fieldsToCheck }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === REVOKE ACCESS ===
    if (isRevoke) {
      console.log(`Revoking access for ${email} due to status: ${transactionStatus}`);

      const { data: existing } = await supabase
        .from("authorized_emails")
        .select("id, is_active")
        .eq("email", email)
        .single();

      if (existing && existing.is_active) {
        await supabase
          .from("authorized_emails")
          .update({ is_active: false })
          .eq("id", existing.id);
        console.log(`Email ${email} deactivated (revoked)`);
      } else {
        console.log(`Email ${email} not found or already inactive — nothing to revoke`);
      }

      // Also revoke product-specific access if applicable
      if (authResult.product_id) {
        await supabase
          .from("authorized_email_products")
          .delete()
          .eq("email", email)
          .eq("product_id", authResult.product_id);
        console.log(`Product mapping removed: ${email} -> ${authResult.product_id}`);
      }

      return new Response(
        JSON.stringify({ success: true, action: "revoked", email, product_id: authResult.product_id || null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === GRANT ACCESS (approved/confirmed) ===
    const { data: existing } = await supabase
      .from("authorized_emails")
      .select("id, is_active")
      .eq("email", email)
      .single();

    if (existing) {
      if (!existing.is_active) {
        await supabase
          .from("authorized_emails")
          .update({ is_active: true, authorized_by: "webhook", authorized_at: new Date().toISOString() })
          .eq("id", existing.id);
        console.log(`Email ${email} reactivated via webhook`);
      } else {
        console.log(`Email ${email} already authorized`);
      }
    } else {
      const { error } = await supabase
        .from("authorized_emails")
        .insert({ email, authorized_by: "webhook" });

      if (error) {
        console.error("Error inserting email:", error);
        return new Response(
          JSON.stringify({ error: "Failed to authorize email" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`Email ${email} authorized via webhook`);
    }

    // Map to product if multi-product token
    if (authResult.product_id) {
      const { error: bridgeError } = await supabase
        .from("authorized_email_products")
        .upsert(
          { email, product_id: authResult.product_id, access_end: null },
          { onConflict: "email,product_id" }
        );

      if (bridgeError) {
        console.error("Error upserting authorized_email_products:", bridgeError);
      } else {
        console.log(`Email ${email} mapped to product ${authResult.product_id}`);
      }
    } else if (authResult.is_legacy) {
      console.log(`Legacy token used — email authorized without product mapping`);
    }

    return new Response(
      JSON.stringify({ success: true, action: "granted", email, product_id: authResult.product_id || null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
