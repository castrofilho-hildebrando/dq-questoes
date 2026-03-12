import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProvaToSave {
  nome_prova: string;
  ano?: string;
  orgao?: string;
  banca?: string;
  url_pdf: string;
  url_origem?: string;
  area_id?: string;
}

function isGabarito(title: string): boolean {
  const normalized = title.toLowerCase();
  return (
    normalized.includes("gabarito") ||
    normalized.includes("gab_") ||
    normalized.includes("gab.") ||
    normalized.includes("respostas") ||
    normalized.includes("_gab") ||
    /\bgab\b/.test(normalized)
  );
}

function extractBaseName(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*-\s*(gabarito|prova|gab\.?|questões|questoes|caderno)\s*/gi, "")
    .replace(/\s*(gabarito|prova|gab\.?|questões|questoes|caderno)\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function groupProvas(provas: ProvaToSave[]): Map<string, ProvaToSave[]> {
  const groups = new Map<string, ProvaToSave[]>();

  const byOrigin = new Map<string, ProvaToSave[]>();
  provas.forEach((prova) => {
    const origin = prova.url_origem || prova.url_pdf;
    if (!byOrigin.has(origin)) byOrigin.set(origin, []);
    byOrigin.get(origin)!.push(prova);
  });

  let groupIndex = 0;
  byOrigin.forEach((originProvas) => {
    const provasOnly: ProvaToSave[] = [];
    const gabaritosOnly: ProvaToSave[] = [];

    originProvas.forEach((p) => {
      if (isGabarito(p.nome_prova)) gabaritosOnly.push(p);
      else provasOnly.push(p);
    });

    const usedGabaritos = new Set<number>();

    provasOnly.forEach((prova) => {
      const provaBase = extractBaseName(prova.nome_prova);
      let matched = false;

      for (let i = 0; i < gabaritosOnly.length; i++) {
        if (usedGabaritos.has(i)) continue;
        const gabBase = extractBaseName(gabaritosOnly[i].nome_prova);
        if (
          gabBase === provaBase ||
          gabBase.includes(provaBase) ||
          provaBase.includes(gabBase) ||
          (provasOnly.length === 1 && gabaritosOnly.length === 1)
        ) {
          groups.set(`group_${groupIndex++}`, [prova, gabaritosOnly[i]]);
          usedGabaritos.add(i);
          matched = true;
          break;
        }
      }

      if (!matched) groups.set(`group_${groupIndex++}`, [prova]);
    });

    gabaritosOnly.forEach((gab, i) => {
      if (!usedGabaritos.has(i)) groups.set(`group_${groupIndex++}`, [gab]);
    });
  });

  return groups;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar Bearer token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // A partir daqui o chamador é admin confirmado
    const { provas } = (await req.json()) as { provas: ProvaToSave[] };

    if (!provas || !Array.isArray(provas) || provas.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Provas array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Admin ${callerUser.id} processing ${provas.length} provas`);

    const groups = groupProvas(provas);
    console.log(`Created ${groups.size} groups`);

    const provasToInsert: Array<{
      nome_prova: string;
      ano: string | null;
      orgao: string | null;
      banca: string | null;
      url_pdf: string;
      url_origem: string | null;
      area_id: string | null;
      group_id: string;
      pdf_type: string;
      is_active: boolean;
    }> = [];

    groups.forEach((groupProvas) => {
      const groupId = crypto.randomUUID();
      groupProvas.forEach((p) => {
        provasToInsert.push({
          nome_prova: p.nome_prova,
          ano: p.ano || null,
          orgao: p.orgao || null,
          banca: p.banca || null,
          url_pdf: p.url_pdf,
          url_origem: p.url_origem || null,
          area_id: p.area_id || null,
          group_id: groupId,
          pdf_type: isGabarito(p.nome_prova) ? "gabarito" : "prova",
          is_active: true,
        });
      });
    });

    console.log(`Inserting ${provasToInsert.length} provas with grouping`);

    const { data, error } = await adminClient
      .from("provas_if")
      .upsert(provasToInsert, {
        onConflict: "url_pdf",
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error("Database error:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const savedCount = data?.length || 0;
    console.log(`Successfully saved ${savedCount} provas in ${groups.size} groups`);

    return new Response(
      JSON.stringify({
        success: true,
        saved: savedCount,
        groups: groups.size,
        total: provas.length,
        message: `${savedCount} provas salvas em ${groups.size} grupos`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error saving provas:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to save";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
