import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-backup-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const secret = req.headers.get("x-backup-secret");
  if (secret !== Deno.env.get("BACKUP_SECRET")) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const bucket = url.searchParams.get("bucket");
    const filePath = url.searchParams.get("path");

    // Mode 1: list buckets
    if (!bucket) {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw error;
      const buckets = (data || []).map((b) => ({ name: b.name }));
      return new Response(JSON.stringify(buckets), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode 2b: download specific file
    if (filePath) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(filePath);
      if (error) throw error;

      const ext = filePath.split(".").pop()?.toLowerCase() || "";
      const mimeMap: Record<string, string> = {
        pdf: "application/pdf",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        svg: "image/svg+xml",
        webp: "image/webp",
        mp4: "video/mp4",
        json: "application/json",
        csv: "text/csv",
        txt: "text/plain",
        html: "text/html",
        css: "text/css",
        js: "application/javascript",
        zip: "application/zip",
      };
      const contentType = mimeMap[ext] || "application/octet-stream";

      return new Response(data.stream(), {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filePath.split("/").pop()}"`,
        },
      });
    }

    // Mode 2a: list files recursively
    const allFiles: { name: string; path: string; size: number }[] = [];

    async function listRecursive(prefix: string) {
      const { data, error } = await supabase.storage
        .from(bucket!)
        .list(prefix, { limit: 1000 });
      if (error) throw error;
      if (!data) return;

      for (const item of data) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id) {
          // it's a file
          allFiles.push({
            name: item.name,
            path: fullPath,
            size: (item.metadata as any)?.size ?? 0,
          });
        } else {
          // it's a folder
          await listRecursive(fullPath);
        }
      }
    }

    await listRecursive("");

    return new Response(JSON.stringify(allFiles), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("STORAGE BACKUP ERROR:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
