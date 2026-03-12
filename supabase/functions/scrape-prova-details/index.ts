const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface PdfLink {
  titulo: string;
  url: string;
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
    const { url } = await req.json();

    if (!url) {
      return new Response(JSON.stringify({ success: false, error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(JSON.stringify({ success: false, error: "Firecrawl not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Admin ${callerUser.id} scraping prova details from:`, url);

    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["html"],
        onlyMainContent: false,
        waitFor: 2000,
      }),
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("Firecrawl returned non-JSON response:", responseText.substring(0, 200));
      return new Response(
        JSON.stringify({ success: false, error: `Firecrawl error: ${responseText.substring(0, 100)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!response.ok) {
      console.error("Firecrawl API error:", data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const html = data.data?.html || data.html || "";
    console.log("HTML length:", html.length);

    const pdfLinks: PdfLink[] = [];

    const downloadSectionRegex =
      /<div[^>]*class="[^"]*arquivo_tipo[^"]*"[^>]*>[\s\S]*?<i[^>]*class="[^"]*fa-download[^"]*"[^>]*>[\s\S]*?Download[\s\S]*?<\/div>([\s\S]*?)(?=<div[^>]*class="[^"]*arquivo_tipo[^"]*"|<\/div>\s*<\/div>\s*<\/div>\s*$)/i;

    let downloadSectionMatch = html.match(downloadSectionRegex);

    if (!downloadSectionMatch) {
      const altPattern =
        /Download\s+dos\s+arquivos\s+PDF([\s\S]*?)(?=Compartilhar\s+os\s+arquivos|Visualizar\s+os\s+arquivos|<div[^>]*class="[^"]*arquivo_tipo[^"]*"|$)/i;
      downloadSectionMatch = html.match(altPattern);
    }

    if (!downloadSectionMatch) {
      const downloadRowPattern =
        /<div[^>]*>[\s\S]*?fa-download[\s\S]*?<a[^>]*href="([^"]+\.pdf[^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/div>/gi;
      let match;
      while ((match = downloadRowPattern.exec(html)) !== null) {
        const pdfUrl = match[1].startsWith("http") ? match[1] : `https://www.pciconcursos.com.br${match[1]}`;
        const titulo = match[2].replace(/<[^>]+>/g, "").trim() || "Arquivo PDF";
        if (!pdfLinks.some((p) => p.url === pdfUrl)) {
          pdfLinks.push({ titulo, url: pdfUrl });
        }
      }
    }

    if (downloadSectionMatch && downloadSectionMatch[1]) {
      const sectionHtml = downloadSectionMatch[1];
      console.log("Found download section, length:", sectionHtml.length);

      const pdfLinkRegex = /<a[^>]*href="([^"]+\.pdf[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = pdfLinkRegex.exec(sectionHtml)) !== null) {
        const pdfUrl = match[1].startsWith("http") ? match[1] : `https://www.pciconcursos.com.br${match[1]}`;
        const titulo = match[2].replace(/<[^>]+>/g, "").trim() || "Arquivo PDF";
        if (!pdfLinks.some((p) => p.url === pdfUrl)) {
          pdfLinks.push({ titulo, url: pdfUrl });
        }
      }
    }

    if (pdfLinks.length === 0) {
      console.log("No PDFs found in download section, trying fallback pattern");

      const fallbackPattern =
        /<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="[^"]*seta-download[^"]*"[\s\S]*?([^<]+\.pdf)/gi;
      let match;
      while ((match = fallbackPattern.exec(html)) !== null) {
        const pdfUrl = match[1].startsWith("http") ? match[1] : `https://www.pciconcursos.com.br${match[1]}`;
        const titulo = match[2].trim() || "Arquivo PDF";
        if (!pdfLinks.some((p) => p.url === pdfUrl)) {
          pdfLinks.push({ titulo, url: pdfUrl });
        }
      }

      if (pdfLinks.length === 0) {
        const downloadRowRegex =
          /<div[^>]*class="[^"]*arquivo[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+\.pdf[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
        const sectionsWithDownload = html.split(/Download\s+dos\s+arquivos\s+PDF/i);
        if (sectionsWithDownload.length > 1) {
          let downloadSection = sectionsWithDownload[1];
          const compartilharIdx = downloadSection.indexOf("Compartilhar");
          if (compartilharIdx > 0) {
            downloadSection = downloadSection.substring(0, compartilharIdx);
          }

          while ((match = downloadRowRegex.exec(downloadSection)) !== null) {
            const pdfUrl = match[1].startsWith("http") ? match[1] : `https://www.pciconcursos.com.br${match[1]}`;
            const titulo = match[2].replace(/<[^>]+>/g, "").trim() || "Arquivo PDF";
            if (!pdfLinks.some((p) => p.url === pdfUrl)) {
              pdfLinks.push({ titulo, url: pdfUrl });
            }
          }
        }
      }
    }

    console.log(`Found ${pdfLinks.length} PDF links from download section`);

    return new Response(JSON.stringify({ success: true, data: pdfLinks, count: pdfLinks.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error scraping prova details:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to scrape";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
