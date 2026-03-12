import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-backup-secret",
};

const PAGE_SIZE = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const secret = req.headers.get("x-backup-secret");
  if (secret !== Deno.env.get("BACKUP_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const url = new URL(req.url);
    const table = url.searchParams.get("table");

    // Sem ?table= → retorna lista de tabelas
    if (!table) {
      const { data, error } = await supabase.rpc("get_public_tables");
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Com ?table=X&count=true → retorna apenas o total de registros
    const countOnly = url.searchParams.get("count") === "true";
    if (countOnly) {
      const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
      if (error) throw error;
      return new Response(JSON.stringify({ count }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Com ?table=X&page=N → retorna página de dados com ORDER BY id
    const page = parseInt(url.searchParams.get("page") ?? "0");
    const pageSize = parseInt(url.searchParams.get("page_size") ?? String(PAGE_SIZE));
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const fields = url.searchParams.get("fields") ?? "*";

    const { data, error } = await supabase.from(table).select(fields).order("id").range(from, to);

    if (error) throw error;

    return new Response(JSON.stringify(data ?? []), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("BACKUP ERROR:", JSON.stringify(error));
    return new Response(JSON.stringify({ success: false, error: JSON.stringify(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
