import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_SUBMISSIONS_PER_QUESTION = 2;

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
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // Parse body
    const { course_id, question_id, student_answer } = await req.json();
    if (!course_id || !question_id || !student_answer) {
      return new Response(
        JSON.stringify({ error: "course_id, question_id and student_answer are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Check submission limit ──
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { count: existingCount } = await supabaseAdmin
      .from("dissertative_submissions")
      .select("id", { count: "exact", head: true })
      .eq("question_id", question_id)
      .eq("user_id", userId);

    if ((existingCount ?? 0) >= MAX_SUBMISSIONS_PER_QUESTION) {
      return new Response(
        JSON.stringify({ error: "SUBMISSION_LIMIT_REACHED", message: `Você já atingiu o limite de ${MAX_SUBMISSIONS_PER_QUESTION} submissões para esta questão.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch question
    const { data: question, error: qErr } = await supabase
      .from("dissertative_questions")
      .select("id, statement, answer_key, model_answer, discipline_id, course_id, topic_id")
      .eq("id", question_id)
      .eq("is_active", true)
      .single();

    if (qErr || !question) {
      return new Response(JSON.stringify({ error: "Question not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Enrich context from DB ──
    let courseName = "";
    let disciplineName = "";
    let topicTitle = "";

    const { data: courseData } = await supabaseAdmin
      .from("dissertative_courses")
      .select("title")
      .eq("id", course_id)
      .single();
    if (courseData) courseName = courseData.title;

    if (question.discipline_id) {
      const { data: discData } = await supabaseAdmin
        .from("study_disciplines")
        .select("name")
        .eq("id", question.discipline_id)
        .single();
      if (discData) disciplineName = discData.name;
    }

    if (question.topic_id) {
      const { data: topicData } = await supabaseAdmin
        .from("dissertative_topics")
        .select("title")
        .eq("id", question.topic_id)
        .single();
      if (topicData) topicTitle = topicData.title;
    }

    // ── Fetch exam context (required) ──
    let examContextJson = "";
    const { data: examCtx } = await supabaseAdmin
      .from("dissertative_exam_contexts")
      .select("context_json")
      .eq("course_id", course_id)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (examCtx) {
      examContextJson = JSON.stringify(examCtx.context_json, null, 2);
    }

    if (!examContextJson) {
      return new Response(
        JSON.stringify({ error: "EXAM_CONTEXT_NOT_CONFIGURED", message: "Nenhum contexto da banca ativo encontrado para este curso." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch prompt template
    let promptTemplate: string | null = null;
    let modelSettings: Record<string, unknown> | null = null;

    const { data: coursePrompt } = await supabaseAdmin
      .from("dissertative_prompt_templates")
      .select("prompt_text, model_settings")
      .eq("prompt_type", "correct_answer")
      .eq("course_id", course_id)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (coursePrompt) {
      promptTemplate = coursePrompt.prompt_text;
      modelSettings = coursePrompt.model_settings as Record<string, unknown> | null;
    }

    if (!promptTemplate) {
      return new Response(
        JSON.stringify({ error: "No active prompt template found for correction" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const submissionNumber = (existingCount ?? 0) + 1;

    // Build full prompt with all variable replacements
    // Map ALL possible variable names used in prompt templates
    const replacements: Record<string, string> = {
      enunciado: question.statement,
      statement: question.statement,
      padrao_resposta: question.answer_key,
      padrao_resposta_json: question.answer_key,
      resposta_aluno: student_answer,
      student_answer: student_answer,
      model_answer: question.model_answer || "",
      submission_id: `submission_${submissionNumber}`,
      exam_context_json: examContextJson,
      topico: topicTitle,
      topic_title: topicTitle,
      disciplina: disciplineName,
      discipline_name: disciplineName,
      course_name: courseName,
    };

    let fullPrompt = promptTemplate;
    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`\\{\\{?${key}\\}?\\}`, "g");
      fullPrompt = fullPrompt.replace(regex, value);
    }




    const model = "gpt-4o";

    // Call OpenAI API
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `Você é um corretor especializado em questões dissertativas de concursos públicos. 
Esta é a submissão ${submissionNumber} de ${MAX_SUBMISSIONS_PER_QUESTION} do aluno para esta questão.

REGRA OBRIGATÓRIA DE PONTUAÇÃO:
- Todas as notas (nota geral e nota de cada critério) DEVEM estar na escala de 0 a 10 (podendo usar decimais, ex: 7.5).
- NUNCA use escalas diferentes (como 0-50, 0-100, 0-20, etc.).
- Se o gabarito/padrão de resposta usar outra escala, você DEVE converter/normalizar para 0-10 antes de retornar.
- Exemplo: se a escala original é 0-50 e o aluno tiraria 9/50, a nota normalizada é ${(9/50*10).toFixed(1)} = 1.8/10.

Responda APENAS com JSON válido (sem markdown) no seguinte formato:
{
  "nota": <number 0-10, escala obrigatória>,
  "resumo_avaliativo": "<string com 2-3 frases resumindo a avaliação geral>",
  "criterios": [
    { "nome": "<nome do critério>", "nota": <number 0-10>, "peso": <number>, "comentario": "<explicação detalhada da nota atribuída>" }
  ],
  "pontos_fortes": ["<ponto forte 1>", ...],
  "pontos_melhoria": ["<ponto de melhoria com explicação de como melhorar>", ...],
  "sugestao_reescrita": "<trecho reescrito como sugestão de melhoria>",
  "checklist": [
    { "item": "<item avaliado>", "atendido": <boolean> }
  ]
}`
          },
          { role: "user", content: fullPrompt },
        ],
        temperature: (modelSettings as any)?.temperature ?? 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const body = await aiResponse.text();
      console.error("AI gateway error:", status, body);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse AI JSON response
    let aiFeedback: Record<string, unknown>;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      aiFeedback = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      aiFeedback = { raw_response: rawContent, parse_error: true };
    }

    // Normalize score: clamp to 0-10 range (safety net against AI returning wrong scale)
    let score: number | null = null;
    const rawScore = typeof (aiFeedback as any).nota === "number"
      ? (aiFeedback as any).nota
      : (typeof (aiFeedback as any).score === "number" ? (aiFeedback as any).score : null);

    if (rawScore !== null) {
      // If score > 10, assume it's on a different scale and normalize
      if (rawScore > 10) {
        // Try to detect the scale from criterios weights
        const totalWeight = ((aiFeedback as any).criterios || []).reduce(
          (sum: number, c: any) => sum + (typeof c.peso === "number" ? c.peso : 0), 0
        );
        const denominator = totalWeight > 10 ? totalWeight : (rawScore <= 50 ? 50 : 100);
        score = Math.round((rawScore / denominator) * 10 * 10) / 10; // one decimal
        console.log(`Score normalized: ${rawScore} -> ${score}/10 (denominator: ${denominator})`);
        // Also fix the nota field in the feedback object
        (aiFeedback as any).nota = score;
      } else {
        score = Math.round(Math.max(0, Math.min(10, rawScore)) * 10) / 10;
        (aiFeedback as any).nota = score;
      }
    }

    // Normalize individual criteria scores to 0-10 as well
    if (Array.isArray((aiFeedback as any).criterios)) {
      for (const criterio of (aiFeedback as any).criterios) {
        if (typeof criterio.nota === "number" && criterio.nota > 10) {
          const peso = typeof criterio.peso === "number" && criterio.peso > 0 ? criterio.peso : 10;
          criterio.nota = Math.round((criterio.nota / peso) * 10 * 10) / 10;
        }
      }
    }

    // Save submission
    const { data: submission, error: subErr } = await supabaseAdmin
      .from("dissertative_submissions")
      .insert({
        user_id: userId,
        course_id,
        question_id,
        discipline_id: question.discipline_id,
        student_answer,
        ai_feedback: aiFeedback,
        score,
      })
      .select("id, created_at")
      .single();

    if (subErr) {
      console.error("Submission save error:", subErr);
      return new Response(
        JSON.stringify({ feedback: aiFeedback, score, save_error: subErr.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        feedback: aiFeedback,
        score,
        submission_id: submission.id,
        created_at: submission.created_at,
        submissions_remaining: MAX_SUBMISSIONS_PER_QUESTION - submissionNumber,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("correct-dissertative error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
