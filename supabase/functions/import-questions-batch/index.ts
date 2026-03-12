import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers - MUST be in every response (success, error, preflight)
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper to create JSON response with CORS
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ==========================================
// Transport shielding decode (matches frontend)
// ==========================================
const B64_PREFIX = "__b64__:";

function decodeMaybeB64(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return String(value);
  if (!value.startsWith(B64_PREFIX)) return value;

  const b64 = value.slice(B64_PREFIX.length);
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch (e) {
    console.error("[import-questions-batch] Failed to decode base64 payload:", e);
    // Fallback: return original to avoid crashing the whole chunk
    return value;
  }
}

function decodeOptions(options: unknown): Record<string, string> {
  if (!options || typeof options !== "object") return {};
  const o = options as Record<string, unknown>;
  return {
    a: decodeMaybeB64(o.a),
    b: decodeMaybeB64(o.b),
    c: decodeMaybeB64(o.c),
    d: decodeMaybeB64(o.d),
    e: decodeMaybeB64(o.e),
  };
}

interface TopicPayload {
  name: string;
  order?: number;
}

interface QuestionPayload {
  topic_name?: string;         // V1: single topic
  topicos?: string[];          // V2: flat array of topic names
  question: string;
  answer?: string;
  associated_text?: string;
  prof_comment?: string;       // V1: plain text
  prof_comment_json?: Record<string, unknown>;  // V2: structured JSONB
  prof_comment_citations?: string[];  // V2: source URLs
  prof_comment_videos?: string[];     // V2: video URLs
  question_type?: string;
  year?: number | string;
  banca?: string;
  orgao?: string;
  prova?: string;
  options?: {
    a?: string;
    b?: string;
    c?: string;
    d?: string;
    e?: string;
  };
  images?: string[];
  external_code?: string;      // V2: external matching key
}

interface ImportPayload {
  discipline_id: string;
  zip_filename?: string;
  mode: "merge" | "create";
  batch_id: string; // REQUIRED - must be created before sending chunks
  topics: TopicPayload[];
  questions: QuestionPayload[];
  chunk_index: number;
  total_chunks: number;
}

interface ImportStats {
  topics_created: number;
  topics_reused: number;
  questions_inserted: number;
  questions_updated: number;
  questions_skipped: number;
  low_quality: number;
  updated_details?: Array<{ question_id: string; changes: Record<string, unknown> }>;
}

Deno.serve(async (req) => {
  // ========== PREFLIGHT: Return 204 with CORS headers ==========
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ========== Wrap EVERYTHING in try/catch to guarantee CORS on errors ==========
  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error("[import-questions-batch] Auth error:", userError);
      return jsonResponse({ success: false, error: "Invalid token" }, 401);
    }

    const userId = user.id;

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      console.error("[import-questions-batch] Role check failed:", roleError);
      return jsonResponse({ success: false, error: "Admin access required" }, 403);
    }

    // Parse and validate payload
    const payload: ImportPayload = await req.json();

    // Validate required fields
    if (!payload.discipline_id) {
      return jsonResponse({ success: false, error: "discipline_id is required" }, 400);
    }

    if (!payload.mode || !["merge", "create"].includes(payload.mode)) {
      return jsonResponse({ success: false, error: "mode must be 'merge' or 'create'" }, 400);
    }

    // batch_id is REQUIRED - must be created by frontend before sending chunks
    if (!payload.batch_id) {
      return jsonResponse({ success: false, error: "batch_id is required. Create import_batch before sending chunks." }, 400);
    }

    console.log(`[import-questions-batch] Received request with batch_id: ${payload.batch_id}`);

    if (!Array.isArray(payload.questions)) {
      return jsonResponse({ success: false, error: "questions must be an array" }, 400);
    }

    // Validate chunking parameters
    const chunkIndex = payload.chunk_index;
    const totalChunks = payload.total_chunks;

    if (typeof chunkIndex !== 'number' || chunkIndex < 0) {
      return jsonResponse({ success: false, error: "chunk_index must be a non-negative integer" }, 400);
    }

    if (typeof totalChunks !== 'number' || totalChunks < 1) {
      return jsonResponse({ success: false, error: "total_chunks must be a positive integer" }, 400);
    }

    if (chunkIndex >= totalChunks) {
      return jsonResponse({ success: false, error: `chunk_index (${chunkIndex}) must be less than total_chunks (${totalChunks})` }, 400);
    }

    // topics is required as array (can be empty for chunks > 0)
    if (!Array.isArray(payload.topics)) {
      return jsonResponse({ success: false, error: "topics must be an array" }, 400);
    }

    // Validate payload size (max 500 questions per request)
    if (payload.questions.length > 500) {
      return jsonResponse({ 
        success: false, 
        error: `Too many questions in single request (${payload.questions.length}). Max is 500.` 
      }, 400);
    }

    // Determine if this is the last chunk (should finalize)
    const isLastChunk = chunkIndex === totalChunks - 1;

    console.log(`[import-questions-batch] Processing chunk ${chunkIndex + 1}/${totalChunks} with ${payload.questions.length} questions for discipline ${payload.discipline_id}. Finalize: ${isLastChunk}`);

    // Prepare topics JSONB (only send on first chunk)
    const topicsJsonb = chunkIndex === 0 
      ? payload.topics.map((t, idx) => ({
          name: t.name,
          order: t.order ?? idx,
        }))
      : [];

    // Prepare questions JSONB (supports V1 and V2 formats)
    const questionsJsonb = payload.questions.map((q) => ({
      // V1 legacy field
      topic_name: q.topic_name || (q.topicos && q.topicos.length > 0 ? q.topicos[0] : ""),
      // V2 flat topics array
      topicos: q.topicos || (q.topic_name ? [q.topic_name] : []),
      question: decodeMaybeB64(q.question),
      answer: q.answer || "",
      associated_text: decodeMaybeB64(q.associated_text || ""),
      prof_comment: typeof q.prof_comment === "string" && q.prof_comment.trim() ? decodeMaybeB64(q.prof_comment) : null,
      prof_comment_json: q.prof_comment_json || null,
      prof_comment_citations: q.prof_comment_citations || null,
      prof_comment_videos: q.prof_comment_videos || null,
      question_type: q.question_type || "mult",
      year: q.year ? String(q.year) : "",
      banca: q.banca || "",
      orgao: q.orgao || "",
      prova: q.prova || "",
      options: decodeOptions(q.options || {}),
      images: q.images || [],
      external_code: q.external_code || null,
    }));

    // Call the transactional RPC with batch_id (always set)
    const { data: rpcResult, error: rpcError } = await supabase.rpc("upsert_import_batch", {
      p_discipline_id: payload.discipline_id,
      p_zip_filename: chunkIndex === 0 ? (payload.zip_filename || null) : null,
      p_mode: payload.mode,
      p_batch_id: payload.batch_id, // Always set - created by frontend
      p_topics: topicsJsonb,
      p_questions: questionsJsonb,
      p_chunk_index: chunkIndex,
      p_total_chunks: totalChunks,
      p_finalize: isLastChunk,
    });

    console.log(`[import-questions-batch] RPC called with batch_id: ${payload.batch_id}, chunk: ${chunkIndex}/${totalChunks}`);

    if (rpcError) {
      console.error("[import-questions-batch] RPC error:", rpcError);
      return jsonResponse({ success: false, error: rpcError.message }, 500);
    }

    console.log("[import-questions-batch] RPC result:", JSON.stringify(rpcResult));

    // RPC may return either nested {stats:{...}} or flat {inserted, updated, ...}
    const result = rpcResult as Record<string, unknown>;

    if (!result.success) {
      console.error("[import-questions-batch] RPC returned failure:", result.error);
      return jsonResponse({ success: false, error: result.error || "Unknown error", batch_id: result.batch_id }, 400);
    }

    // Normalize stats: if RPC returns flat fields, wrap them into the stats object the frontend expects
    let stats = result.stats as Record<string, unknown> | undefined;
    if (!stats || typeof stats !== "object") {
      stats = {
        questions_inserted: result.inserted ?? 0,
        questions_updated: result.updated ?? 0,
        questions_skipped: result.skipped ?? 0,
        questions_linked: result.linked ?? 0,
        questions_reactivated: result.reactivated ?? 0,
        topics_created: result.topics_created ?? 0,
        topics_reused: result.topics_reused ?? 0,
        low_quality: result.low_quality ?? 0,
        updated_details: result.updated_details ?? [],
      };
    }

    // Derive is_finalized from the edge function context (RPC doesn't return it)
    const isFinalized = isLastChunk && (result.errors ?? 0) === 0;

    return jsonResponse({
      success: true,
      batch_id: result.batch_id,
      mode: payload.mode,
      chunk_index: chunkIndex,
      is_finalized: isFinalized,
      stats,
    });

  } catch (error: unknown) {
    // CRITICAL: Always return CORS headers even on unhandled errors
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("[import-questions-batch] Unhandled error:", error);
    return jsonResponse({ success: false, error: errorMessage }, 500);
  }
});
