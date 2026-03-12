import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Multi-action edge function for the dissertative pipeline.
 * Actions: generate_question | generate_answer_key | generate_model_answer
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const userId = user.id;
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, model: overrideModel } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "action is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle extract_topics action separately (no prompt template needed)
    if (action === "extract_topics") {
      const { pdf_url } = body;
      if (!pdf_url) {
        return new Response(JSON.stringify({ error: "pdf_url is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract storage path from the public URL and download via service role
      console.log("Downloading PDF from:", pdf_url);
      const bucketName = "dissertative-pdfs";
      const bucketPrefix = `/storage/v1/object/public/${bucketName}/`;
      const idx = pdf_url.indexOf(bucketPrefix);
      let pdfBytes: Uint8Array;

      if (idx !== -1) {
        // Download via Supabase Storage using service role (works for private buckets too)
        const storagePath = decodeURIComponent(pdf_url.substring(idx + bucketPrefix.length));
        console.log("Storage path:", storagePath);
        const { data: fileData, error: dlError } = await supabaseAdmin.storage
          .from(bucketName)
          .download(storagePath);
        if (dlError || !fileData) {
          console.error("Storage download error:", dlError);
          return new Response(JSON.stringify({ error: "Failed to download PDF from storage" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        pdfBytes = new Uint8Array(await fileData.arrayBuffer());
      } else {
        // Fallback: direct fetch for external URLs
        const pdfResponse = await fetch(pdf_url);
        if (!pdfResponse.ok) {
          console.error("Direct fetch failed:", pdfResponse.status, pdfResponse.statusText);
          return new Response(JSON.stringify({ error: "Failed to download PDF" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
      }
      
      // Chunked base64 conversion to avoid stack overflow on large files
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < pdfBytes.length; i += chunkSize) {
        const chunk = pdfBytes.subarray(i, Math.min(i + chunkSize, pdfBytes.length));
        for (let j = 0; j < chunk.length; j++) {
          binary += String.fromCharCode(chunk[j]);
        }
      }
      const base64Pdf = btoa(binary);

      console.log("Sending PDF to AI for topic extraction, size:", pdfBytes.length);

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extraia todos os tópicos/temas deste PDF de edital. Retorne SOMENTE a lista de tópicos, um por linha, sem numeração, sem explicação, sem cabeçalho. Cada linha deve conter apenas o nome do tópico. Não inclua linhas em branco."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:application/pdf;base64,${base64Pdf}`
                  }
                }
              ]
            }
          ],
          temperature: 0.1,
        }),
      });

      if (!aiResp.ok) {
        const errText = await aiResp.text();
        console.error("AI extraction error:", aiResp.status, errText);
        if (aiResp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI extraction error: ${aiResp.status}`);
      }

      const aiData = await aiResp.json();
      const extractedText = aiData.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ topics: extractedText }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine prompt_type based on action
    let promptType: string;
    let requiredFields: string[];

    switch (action) {
      case "generate_question":
        promptType = "generate_question";
        requiredFields = ["course_id", "discipline_id", "topic_id"];
        break;
      case "generate_answer_key":
        promptType = "generate_answer_key";
        requiredFields = ["question_id"];
        break;
      case "generate_model_answer":
        promptType = "generate_model_answer";
        requiredFields = ["question_id"];
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Validate required fields
    for (const field of requiredFields) {
      if (!body[field]) {
        return new Response(JSON.stringify({ error: `${field} is required` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get context for prompt
    let courseId = body.course_id;
    let disciplineId = body.discipline_id;
    let topicTitle = "";
    let topicId = body.topic_id || "";
    let disciplineName = "";
    let courseName = "";
    let questionStatement = "";
    let questionAnswerKey = "";

    if (action === "generate_question") {
      // Fetch topic
      const { data: topic } = await supabaseAdmin
        .from("dissertative_topics")
        .select("title, course_id, discipline_id")
        .eq("id", body.topic_id)
        .single();
      if (!topic) {
        return new Response(JSON.stringify({ error: "Topic not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      topicTitle = topic.title;
      courseId = topic.course_id;
      disciplineId = topic.discipline_id;

      // Fetch discipline name
      const { data: disc } = await supabaseAdmin
        .from("study_disciplines")
        .select("name")
        .eq("id", disciplineId)
        .single();
      disciplineName = disc?.name || "Disciplina";
    } else {
      // Fetch question for answer_key / model_answer generation
      const { data: question } = await supabaseAdmin
        .from("dissertative_questions")
        .select("id, statement, answer_key, model_answer, course_id, discipline_id, topic_id")
        .eq("id", body.question_id)
        .single();
      if (!question) {
        return new Response(JSON.stringify({ error: "Question not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      courseId = question.course_id;
      disciplineId = question.discipline_id;
      questionStatement = question.statement;
      questionAnswerKey = question.answer_key || "";

      if (action === "generate_model_answer" && !questionAnswerKey) {
        return new Response(JSON.stringify({ error: "Answer key must be generated first" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch topic title if exists
      if (question.topic_id) {
        topicId = question.topic_id;
        const { data: topic } = await supabaseAdmin
          .from("dissertative_topics")
          .select("title")
          .eq("id", question.topic_id)
          .single();
        topicTitle = topic?.title || "";
      }

      // Fetch discipline name
      if (disciplineId) {
        const { data: disc } = await supabaseAdmin
          .from("study_disciplines")
          .select("name")
          .eq("id", disciplineId)
          .single();
        disciplineName = disc?.name || "";
      }
    }

    // Fetch course name
    const { data: courseData } = await supabaseAdmin
      .from("dissertative_courses")
      .select("title")
      .eq("id", courseId)
      .single();
    courseName = courseData?.title || "";

    // ── Fetch exam context (required for course) ──
    let examContextJson = "";
    const { data: examCtx } = await supabaseAdmin
      .from("dissertative_exam_contexts")
      .select("context_json")
      .eq("course_id", courseId)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (examCtx) {
      examContextJson = JSON.stringify(examCtx.context_json, null, 2);
    }

    if (!examContextJson) {
      return new Response(
        JSON.stringify({ error: "EXAM_CONTEXT_NOT_CONFIGURED", message: "Nenhum contexto da banca ativo encontrado para este curso. Configure em Admin > Dissertativa > Contexto da Banca." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating for course:", courseName, "| discipline:", disciplineName, "| topic:", topicTitle);

    // Fetch prompt for this course (unique per course)
    const { data: promptData } = await supabaseAdmin
      .from("dissertative_prompt_templates")
      .select("prompt_text, model_settings")
      .eq("prompt_type", promptType)
      .eq("course_id", courseId)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!promptData) {
      return new Response(
        JSON.stringify({ error: `No active prompt found for type: ${promptType}. Configure it in Admin > Dissertativa > Prompts.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const promptTemplate = promptData.prompt_text;
    const modelSettings = promptData.model_settings as Record<string, unknown> | null;

    // ── Extract structured fields from JSON statement for prompt variables ──
    // When the statement is JSON (e.g. Fundação Osório), extract tema/comando/topico
    // so they're available as standalone prompt variables
    let statementTema = "";
    let statementComando = "";
    let statementTopico = "";
    if (questionStatement) {
      try {
        const stmtParsed = JSON.parse(questionStatement.trim().replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim());
        if (typeof stmtParsed === "object" && stmtParsed !== null) {
          // Flat structure: {tema, comando, topico}
          statementTema = stmtParsed.tema || stmtParsed.question?.tema || "";
          statementComando = stmtParsed.comando || stmtParsed.question?.comando || "";
          statementTopico = stmtParsed.topico || stmtParsed.ponto_tematico || stmtParsed.question?.ponto_tematico || "";
        }
      } catch {
        // Not JSON — plain text statement, keep defaults empty
      }
    }

    // Build prompt with variable substitution
    // Support both {var} and {{var}} formats used in prompts
    // IMPORTANT: Map ALL variable names used in prompt templates
    const replacements: Record<string, string> = {
      // Topic
      topico: topicTitle || statementTopico,
      topic_title: topicTitle || statementTopico,
      topic_id: topicId,
      // Statement / Enunciado (prompts use both names)
      enunciado: questionStatement,
      statement: questionStatement,
      // Extracted fields from JSON statements
      tema: statementTema,
      comando: statementComando,
      // Answer key / Padrão de resposta (prompts use both names)
      padrao_resposta: questionAnswerKey,
      padrao_resposta_json: questionAnswerKey,
      // Discipline
      disciplina: disciplineName,
      discipline_name: disciplineName,
      // Course
      course_name: courseName,
      // Exam context
      exam_context_json: examContextJson,
    };

    let fullPrompt = promptTemplate;
    for (const [key, value] of Object.entries(replacements)) {
      // Match both {key} and {{key}} patterns
      const regex = new RegExp(`\\{\\{?${key}\\}?\\}`, "g");
      fullPrompt = fullPrompt.replace(regex, value);
    }

    const model = overrideModel || (modelSettings as any)?.model || "google/gemini-2.5-flash";

    // Call AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "user", content: fullPrompt },
        ],
        temperature: (modelSettings as any)?.temperature ?? 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errBody = await aiResponse.text();
      console.error("AI gateway error:", status, errBody);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const rawGeneratedText = aiData.choices?.[0]?.message?.content || "";

    // ── Clean AI output: extract text from JSON wrapper if present ──
    function extractCleanText(raw: string, fieldAction: string): string {
      const trimmed = raw.trim()
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

      // If it doesn't look like JSON, return as-is
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return trimmed;

      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed !== "object" || parsed === null) return trimmed;

        // For statements: the AI sometimes wraps in {question: {comando: "..."}}
        // We KEEP the full JSON for statements — the renderer handles it
        if (fieldAction === "generate_question") return trimmed;

        // For answer_key: keep full JSON — renderer handles T1-T5 structure
        if (fieldAction === "generate_answer_key") return trimmed;

        // For model_answer: extract the actual text content — NEVER save JSON
        if (fieldAction === "generate_model_answer") {
          // Try common keys for the answer text (top-level and nested)
          const textKeys = ["resposta", "resposta_modelo", "model_answer", "modelo_resposta", "texto", "text", "answer", "content"];
          for (const key of textKeys) {
            if (parsed[key]) {
              const val = parsed[key];
              if (typeof val === "string" && val.length > 50) return val;
              if (typeof val === "object" && val !== null) {
                // Deep extract: check .text, .content, .resposta inside nested object
                for (const innerKey of ["text", "content", "resposta", "modelo"]) {
                  if ((val as Record<string, unknown>)[innerKey] && typeof (val as Record<string, unknown>)[innerKey] === "string") {
                    return String((val as Record<string, unknown>)[innerKey]);
                  }
                }
              }
            }
          }
          // Last resort: find the longest string value in the object (likely the essay)
          let longestStr = "";
          function findLongestString(obj: Record<string, unknown>) {
            for (const v of Object.values(obj)) {
              if (typeof v === "string" && v.length > longestStr.length) longestStr = v;
              if (typeof v === "object" && v !== null && !Array.isArray(v)) findLongestString(v as Record<string, unknown>);
            }
          }
          findLongestString(parsed);
          if (longestStr.length > 100) return longestStr;
          // If we truly can't find text, return JSON but log warning
          console.warn("Could not extract text from model_answer JSON, returning raw");
          return trimmed;
        }

        return trimmed;
      } catch {
        return trimmed; // Not valid JSON, return as-is
      }
    }

    // Detect truncation in AI output
    function detectTruncation(text: string): boolean {
      const t = text.trim();
      const openBraces = (t.match(/{/g) || []).length;
      const closeBraces = (t.match(/}/g) || []).length;
      const openBrackets = (t.match(/\[/g) || []).length;
      const closeBrackets = (t.match(/]/g) || []).length;
      if (openBraces !== closeBraces || openBrackets !== closeBrackets) return true;
      return /\.\.\.$/m.test(t) || /\[truncated\]/i.test(t) || /\[continued\]/i.test(t);
    }

    const generatedText = extractCleanText(rawGeneratedText, action);
    const isTruncated = detectTruncation(rawGeneratedText);

    if (isTruncated) {
      console.warn("AI output appears truncated for action:", action);
    }

    // Save result based on action
    let result: Record<string, unknown> = { generated_text: generatedText, truncated: isTruncated };

    if (action === "generate_question") {
      // Validate: statement must not be empty or just whitespace
      if (!generatedText || generatedText.trim().length < 20) {
        return new Response(JSON.stringify({ error: "AI generated empty or too short statement. Try again." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Create new question
      const { data: newQ, error: qErr } = await supabaseAdmin
        .from("dissertative_questions")
        .insert({
          course_id: courseId,
          discipline_id: disciplineId,
          topic_id: body.topic_id,
          statement: generatedText,
          answer_key: "",
          status: "draft",
          version: 1,
          is_active: false,
          display_order: 0,
        })
        .select("id")
        .single();

      if (qErr) throw new Error(qErr.message);
      result.question_id = newQ.id;
    } else if (action === "generate_answer_key") {
      if (!generatedText || generatedText.trim().length < 20) {
        return new Response(JSON.stringify({ error: "AI generated empty or too short answer key. Try again." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabaseAdmin
        .from("dissertative_questions")
        .update({ answer_key: generatedText, updated_at: new Date().toISOString() })
        .eq("id", body.question_id);
      if (error) throw new Error(error.message);
      result.question_id = body.question_id;
    } else if (action === "generate_model_answer") {
      if (!generatedText || generatedText.trim().length < 20) {
        return new Response(JSON.stringify({ error: "AI generated empty or too short model answer. Try again." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabaseAdmin
        .from("dissertative_questions")
        .update({ model_answer: generatedText, updated_at: new Date().toISOString() })
        .eq("id", body.question_id);
      if (error) throw new Error(error.message);
      result.question_id = body.question_id;
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-dissertative error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
