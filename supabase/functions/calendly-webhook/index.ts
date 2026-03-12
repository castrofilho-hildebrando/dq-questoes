import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const calendlyWebhookToken = Deno.env.get("CALENDLY_WEBHOOK_TOKEN");

    // Optional: verify webhook signing token via query param or header
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (calendlyWebhookToken && token !== calendlyWebhookToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const event = body.event; // "invitee.created" or "invitee.canceled"
    const payload = body.payload;

    if (!payload) {
      return new Response(JSON.stringify({ error: "No payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inviteeEmail = payload.invitee?.email?.toLowerCase();
    const scheduledAt = payload.event?.start_time || payload.scheduled_event?.start_time;

    if (!inviteeEmail) {
      return new Response(JSON.stringify({ error: "No invitee email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find user by email in profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", inviteeEmail)
      .single();

    if (!profile) {
      console.log(`No profile found for email: ${inviteeEmail}`);
      return new Response(
        JSON.stringify({ ok: true, message: "User not found, skipped" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = profile.user_id;

    if (event === "invitee.created") {
      // Find the first "disponivel" slot for this user and mark it as "agendado"
      const { data: slots } = await supabase
        .from("conselho_mentor_slots")
        .select("id, slot_number, status")
        .eq("user_id", userId)
        .eq("status", "disponivel")
        .order("slot_number", { ascending: true })
        .limit(1);

      if (slots && slots.length > 0) {
        // Update existing slot
        await supabase
          .from("conselho_mentor_slots")
          .update({
            status: "agendado",
            scheduled_at: scheduledAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", slots[0].id);

        console.log(`Slot ${slots[0].slot_number} marked as agendado for ${inviteeEmail}`);
      } else {
        // No existing disponivel slot — find next slot number
        const { data: allSlots } = await supabase
          .from("conselho_mentor_slots")
          .select("slot_number")
          .eq("user_id", userId)
          .order("slot_number", { ascending: false })
          .limit(1);

        const nextSlot = allSlots && allSlots.length > 0 ? allSlots[0].slot_number + 1 : 1;
        if (nextSlot <= 5) {
          await supabase.from("conselho_mentor_slots").insert({
            user_id: userId,
            slot_number: nextSlot,
            status: "agendado",
            scheduled_at: scheduledAt || new Date().toISOString(),
            booking_link: "",
          });
          console.log(`Created slot ${nextSlot} as agendado for ${inviteeEmail}`);
        }
      }
    } else if (event === "invitee.canceled") {
      // Find the most recent "agendado" slot and revert to "disponivel"
      const { data: slots } = await supabase
        .from("conselho_mentor_slots")
        .select("id, slot_number")
        .eq("user_id", userId)
        .eq("status", "agendado")
        .order("slot_number", { ascending: false })
        .limit(1);

      if (slots && slots.length > 0) {
        await supabase
          .from("conselho_mentor_slots")
          .update({
            status: "disponivel",
            scheduled_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", slots[0].id);

        console.log(`Slot ${slots[0].slot_number} reverted to disponivel for ${inviteeEmail}`);
      }
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Calendly webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
