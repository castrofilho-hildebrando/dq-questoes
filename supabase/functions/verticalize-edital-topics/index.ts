import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('JWT validation failed:', claimsError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('User authenticated:', claimsData.claims.sub);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const { editalText, disciplineName, model, systemPrompt: customPrompt } = await req.json();

    if (!editalText || typeof editalText !== 'string' || editalText.trim().length === 0) {
      throw new Error("Texto do edital é obrigatório");
    }

    console.log(`Verticalizing edital topics for discipline: ${disciplineName}`);

    const defaultPrompt = `Você é um especialista em concursos públicos e organização de conteúdo para estudo.

Sua tarefa é "verticalizar" os tópicos de um edital, ou seja:
1. Separar cada tópico do texto informado em itens distintos
2. MANTER OS NOMES EXATOS como estão no edital – os alunos precisam reconhecer os tópicos pelo nome original
3. Remover apenas redundâncias claras (mesmo texto repetido)
4. **MANTER A ORDEM EXATA em que os tópicos aparecem no edital** - isso é CRÍTICO para o cronograma de estudos
5. Se um tópico for longo demais (mais de 200 caracteres), divida-o mantendo o texto literal de cada parte

REGRAS CRÍTICAS:
- NÃO altere a redação dos tópicos (não parafraseie, não simplifique, não "traduza")
- NÃO crie tópicos genéricos como "Introdução", "Conceitos básicos", "Fundamentos"
- NÃO agrupe tópicos diferentes em um só
- Se houver numeração (1, 2, 3...) ou marcadores, mantenha como prefixo do nome
- Siglas e termos técnicos devem permanecer exatamente como aparecem
- **PRESERVE A ORDEM SEQUENCIAL** - o primeiro tópico do array deve ser o primeiro que aparece no edital

Responda usando a função verticalize_topics.`;

    const systemPrompt = customPrompt || defaultPrompt;
    const selectedModel = model || "gpt-4o";

    const userPrompt = `## Disciplina: ${disciplineName || 'Não especificada'}

## Tópicos do Edital (texto bruto):
${editalText}

Separe cada tópico preservando o texto exato como está no edital. Não altere a redação.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "verticalize_topics",
              description: "Retorna os tópicos verticalizados e organizados NA ORDEM EXATA do edital original",
              parameters: {
                type: "object",
                properties: {
                  topics: {
                    type: "array",
                    description: "Lista de tópicos NA ORDEM em que aparecem no edital original (primeiro item = primeiro do edital)",
                    items: {
                      type: "object",
                      properties: {
                        name: {
                          type: "string",
                          description: "Nome do tópico verticalizado"
                        },
                        original_text: {
                          type: "string",
                          description: "Texto original do edital que gerou este tópico (pode ser parcial)"
                        },
                        suggestion_reason: {
                          type: "string",
                          description: "Breve explicação de por que este tópico foi sugerido ou modificado"
                        }
                      },
                      required: ["name"],
                      additionalProperties: false
                    }
                  },
                  summary: {
                    type: "string",
                    description: "Resumo das alterações feitas (quantos tópicos originais, quantos finais, etc)"
                  }
                },
                required: ["topics", "summary"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "verticalize_topics" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    console.log("AI response received for verticalization");

    // Extract the tool call result
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "verticalize_topics") {
      throw new Error("Resposta da IA não contém tópicos verticalizados válidos");
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log(`Verticalized ${result.topics?.length || 0} topics`);

    // Add order_index to each topic to preserve the original edital order
    if (result.topics && Array.isArray(result.topics)) {
      result.topics = result.topics.map((topic: any, index: number) => ({
        ...topic,
        order_index: index
      }));
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in verticalize-edital-topics:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});