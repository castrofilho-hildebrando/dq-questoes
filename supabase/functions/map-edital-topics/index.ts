import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Whitelisted emails with internal access (besides admins)
const INTERNAL_ACCESS_EMAILS = [
  "dissecadordequestoes@gmail.com",
];

// ============================================================
// POST-AI VALIDATION: Deduplicate bank_topic_ids across clusters
// and auto-merge conflicting clusters deterministically.
// ============================================================

interface AICluster {
  cluster_name: string;
  bank_topic_ids: string[];
  edital_items: string[];
  confidence: number;
  reasoning: string;
}

interface AIUncoveredCluster {
  cluster_name: string;
  edital_items: string[];
  reasoning: string;
  suggested_disciplines?: string[];
}

interface AIResult {
  clusters: AICluster[];
  uncovered_clusters: AIUncoveredCluster[];
  summary: string;
}

/**
 * Validates and deduplicates bank_topic_ids across all clusters.
 * If two clusters share any bank_topic_id, they are merged automatically.
 * Fusion is applied repeatedly until no duplicates remain.
 */
function deduplicateAndFuseClusters(clusters: AICluster[]): { fused: AICluster[]; fusionLog: string[] } {
  const fusionLog: string[] = [];
  let result = [...clusters];
  let changed = true;

  while (changed) {
    changed = false;
    // Build a map: bank_topic_id -> list of cluster indices that use it
    const topicToClusterIndices = new Map<string, number[]>();

    for (let i = 0; i < result.length; i++) {
      for (const topicId of result[i].bank_topic_ids) {
        if (!topicId) continue;
        const indices = topicToClusterIndices.get(topicId) || [];
        indices.push(i);
        topicToClusterIndices.set(topicId, indices);
      }
    }

    // Find any bank_topic_id that appears in more than one cluster
    for (const [topicId, indices] of topicToClusterIndices.entries()) {
      if (indices.length <= 1) continue;

      // Merge all clusters at these indices into the first one
      const uniqueIndices = [...new Set(indices)].sort((a, b) => a - b);
      const primaryIdx = uniqueIndices[0];
      const primary = result[primaryIdx];

      const mergedEditalItems = new Set(primary.edital_items);
      const mergedBankTopicIds = new Set(primary.bank_topic_ids);
      const mergedReasonings: string[] = [primary.reasoning];
      let maxConfidence = primary.confidence;

      for (let i = 1; i < uniqueIndices.length; i++) {
        const other = result[uniqueIndices[i]];
        other.edital_items.forEach(item => mergedEditalItems.add(item));
        other.bank_topic_ids.forEach(id => mergedBankTopicIds.add(id));
        mergedReasonings.push(other.reasoning);
        maxConfidence = Math.max(maxConfidence, other.confidence);
      }

      const mergedCluster: AICluster = {
        cluster_name: primary.cluster_name,
        bank_topic_ids: Array.from(mergedBankTopicIds).filter(Boolean),
        edital_items: Array.from(mergedEditalItems),
        confidence: maxConfidence,
        reasoning: `[Auto-fusão] ${mergedReasonings.join(' | ')}`
      };

      const mergedNames = uniqueIndices.map(i => result[i].cluster_name);
      fusionLog.push(`Fusão automática: clusters [${mergedNames.join(', ')}] compartilhavam bank_topic_id=${topicId}`);

      // Remove merged clusters (in reverse order to preserve indices)
      const indicesToRemove = new Set(uniqueIndices.slice(1));
      result = result.filter((_, i) => !indicesToRemove.has(i));
      // Replace primary with merged
      result[primaryIdx] = mergedCluster;

      changed = true;
      break; // restart the while loop after a merge
    }
  }

  return { fused: result, fusionLog };
}

/**
 * Backward compatibility: convert old format (bank_topic_id: string) 
 * to new format (bank_topic_ids: string[])
 */
function normalizeAIClusters(rawClusters: any[]): AICluster[] {
  return rawClusters.map(c => {
    let bankTopicIds: string[] = [];
    
    // New format: bank_topic_ids array
    if (Array.isArray(c.bank_topic_ids)) {
      bankTopicIds = c.bank_topic_ids.filter((id: any) => typeof id === 'string' && id.length > 0);
    }
    // Old format: single bank_topic_id
    else if (c.bank_topic_id && typeof c.bank_topic_id === 'string') {
      bankTopicIds = [c.bank_topic_id];
    }

    return {
      cluster_name: c.cluster_name || '',
      bank_topic_ids: bankTopicIds,
      edital_items: Array.isArray(c.edital_items) ? c.edital_items : [],
      confidence: typeof c.confidence === 'number' ? c.confidence : 0,
      reasoning: c.reasoning || ''
    };
  });
}

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

    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string | undefined;
    console.log('User authenticated:', userId, 'email:', userEmail);

    // ============ PERMISSION CHECK ============
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    const isAdmin = !roleError && roleData !== null;
    const isWhitelisted = userEmail && INTERNAL_ACCESS_EMAILS.includes(userEmail.toLowerCase());

    if (!isAdmin && !isWhitelisted) {
      console.warn('Access denied for user:', userId, 'email:', userEmail);
      return new Response(JSON.stringify({ error: 'forbidden', message: 'Acesso não autorizado a esta funcionalidade' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Access granted - isAdmin:', isAdmin, 'isWhitelisted:', isWhitelisted);
    // ============ END PERMISSION CHECK ============

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { editalTopics, bankTopics, model: requestModel, systemPrompt: customPrompt } = await req.json();

    if (!editalTopics || !Array.isArray(editalTopics) || editalTopics.length === 0) {
      throw new Error("Lista de tópicos do edital é obrigatória");
    }

    if (!bankTopics || !Array.isArray(bankTopics) || bankTopics.length === 0) {
      throw new Error("Lista de tópicos do banco é obrigatória");
    }

    console.log(`Mapping ${editalTopics.length} edital topics to ${bankTopics.length} bank topics with CLUSTERING`);

    // Fetch AI config from database
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const { data: aiConfig, error: configError } = await adminSupabase
      .from('ai_config')
      .select('system_prompt, model')
      .eq('id', 'edital_mapping')
      .maybeSingle();
    
    if (configError) {
      console.error('Error fetching AI config:', configError);
    }
    
    const dbPrompt = aiConfig?.system_prompt || null;
    const dbModel = aiConfig?.model || null;
    
    console.log('Using prompt from:', customPrompt ? 'request' : (dbPrompt ? 'database' : 'default'));

    // Format bank topics WITH question counts for better AI decisions
    const bankTopicsText = bankTopics.map((t: any) => {
      const questionInfo = t.question_count !== undefined && t.question_count > 0 
        ? ` | Questões: ${t.question_count}` 
        : ' | Questões: 0';
      return `- ID: ${t.id} | Nome: ${t.name} | Disciplina: ${t.discipline_name}${questionInfo}`;
    }).join('\n');
    const editalTopicsText = editalTopics.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n');

    // Calculate total questions available
    const totalQuestions = bankTopics.reduce((sum: number, t: any) => sum + (t.question_count || 0), 0);
    console.log(`Total questions available in bank topics: ${totalQuestions}`);

    const defaultPrompt = `Você é um especialista em concursos públicos e organização de conteúdo de estudo.

OBJETIVO PRINCIPAL: AGRUPAMENTO INTELIGENTE E ABRANGENTE
Sua tarefa é criar CLUSTERS (agrupamentos) de tópicos do edital que podem ser estudados JUNTOS usando tópicos do banco de questões.

IMPORTANTE: Cada tópico do banco tem uma contagem de QUESTÕES disponíveis. Priorize tópicos com mais questões para maximizar o conteúdo de estudo.

LÓGICA DO AGRUPAMENTO:
1. Analise TODOS os tópicos do edital e identifique quais deles tratam de assuntos relacionados que podem ser cobertos pelos MESMOS tópicos do banco
2. Crie GRUPOS onde: um ou mais tópicos do banco cobrem múltiplos tópicos do edital
3. Um cluster pode vincular MÚLTIPLOS tópicos do banco (bank_topic_ids) se necessário para cobrir os itens do edital
4. Os tópicos do edital agrupados serão listados como "edital_items" dentro do grupo
5. PRIORIZE tópicos do banco que tenham MAIS QUESTÕES disponíveis

REGRAS CRÍTICAS PARA CLUSTERS COBERTOS:
1. MAXIMIZE os agrupamentos - quanto menos clusters finais, melhor (desde que faça sentido)
2. Mantenha os nomes EXATOS dos tópicos do edital em "edital_items"
3. O nome do cluster DEVE representar a área temática coberta
4. Score de confiança: 0.0-1.0 (qual % dos tópicos do edital esse banco cobre)
5. Um tópico do edital só pode aparecer em UM cluster
6. NÃO IGNORE tópicos do banco que tenham muitas questões - eles são valiosos para o estudo
7. REGRA DE EXCLUSIVIDADE: Cada tópico do banco (bank_topic_id) deve aparecer em APENAS UM cluster. Não repita o mesmo ID em clusters diferentes.

REGRAS PARA TÓPICOS NÃO COBERTOS (MUITO IMPORTANTE):
8. Tópicos do edital SEM correspondência no banco TAMBÉM devem ser agrupados em "uncovered_clusters"
9. Agrupe os tópicos não cobertos usando lógica semântica (assuntos relacionados, mesma área temática)
10. Cada cluster não coberto deve ter um nome descritivo que represente a área temática do agrupamento
11. Inclua reasoning explicando por que esses tópicos foram agrupados juntos

Responda usando a função create_clusters.`;

    // Priority: request > database > default
    const systemPrompt = customPrompt || dbPrompt || defaultPrompt;
    const selectedModel = requestModel || dbModel || "google/gemini-3.1-flash-lite-preview";

    const userPrompt = `## Tópicos Disponíveis no Banco de Questões (total: ${totalQuestions} questões):
${bankTopicsText}

## Tópicos do Edital para Agrupar (${editalTopics.length} tópicos):
${editalTopicsText}

IMPORTANTE: 
- Maximize a cobertura de questões! Analise os tópicos do banco com mais questões e priorize incluí-los no mapeamento quando fizerem sentido para o conteúdo do edital.
- Cada bank_topic_id deve aparecer em NO MÁXIMO UM cluster. Se precisar de vários cadernos num cluster, liste todos em bank_topic_ids.

Analise e crie CLUSTERS INTELIGENTES, agrupando o máximo possível de tópicos do edital em cada tópico do banco.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
              name: "create_clusters",
              description: "Retorna clusters de agrupamento entre tópicos do edital e tópicos do banco, incluindo clusters para tópicos não cobertos",
              parameters: {
                type: "object",
                properties: {
                  clusters: {
                    type: "array",
                    description: "Lista de clusters COBERTOS, cada um representando tópicos do banco que cobrem múltiplos itens do edital",
                    items: {
                      type: "object",
                      properties: {
                        cluster_name: { 
                          type: "string",
                          description: "Nome do cluster = Nome representativo da área temática ou do tópico principal do banco"
                        },
                        bank_topic_ids: {
                          type: "array",
                          items: { type: "string" },
                          description: "Lista de IDs (UUIDs) dos tópicos do banco que cobrem este cluster. CADA ID deve aparecer em apenas UM cluster em todo o mapeamento."
                        },
                        edital_items: {
                          type: "array",
                          items: { type: "string" },
                          description: "Lista de tópicos do edital (nomes EXATOS) cobertos por este cluster"
                        },
                        confidence: {
                          type: "number",
                          description: "Score de confiança do agrupamento (0.0-1.0)"
                        },
                        reasoning: {
                          type: "string",
                          description: "Explicação de por que estes tópicos do edital foram agrupados nestes tópicos do banco"
                        }
                      },
                      required: ["cluster_name", "bank_topic_ids", "edital_items", "confidence", "reasoning"],
                      additionalProperties: false
                    }
                  },
                  uncovered_clusters: {
                    type: "array",
                    description: "Lista de clusters para tópicos NÃO cobertos, agrupados por área temática/semântica",
                    items: {
                      type: "object",
                      properties: {
                        cluster_name: { 
                          type: "string",
                          description: "Nome descritivo do agrupamento (área temática)"
                        },
                        edital_items: {
                          type: "array",
                          items: { type: "string" },
                          description: "Lista de tópicos do edital (nomes EXATOS) agrupados por área temática"
                        },
                        reasoning: {
                          type: "string",
                          description: "Explicação de por que estes tópicos foram agrupados (área temática em comum)"
                        },
                        suggested_disciplines: {
                          type: "array",
                          items: { type: "string" },
                          description: "Sugestão de áreas/disciplinas que poderiam cobrir este cluster"
                        }
                      },
                      required: ["cluster_name", "edital_items", "reasoning"],
                      additionalProperties: false
                    }
                  },
                  summary: {
                    type: "string",
                    description: "Resumo: X tópicos do edital agrupados em Y clusters cobertos, Z tópicos em W clusters não cobertos"
                  }
                },
                required: ["clusters", "uncovered_clusters", "summary"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_clusters" } }
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
    console.log("AI response received for clustering");
    console.log("AI response structure:", JSON.stringify(aiResult, null, 2).substring(0, 2000));

    // Extract the tool call result - handle different response formats
    let rawResult: any = null;
    
    // Try tool_calls format first
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function?.name === "create_clusters") {
      try {
        rawResult = JSON.parse(toolCall.function.arguments);
      } catch (parseError) {
        console.error("Failed to parse tool_calls arguments:", parseError);
      }
    }
    
    // Try function_call format (older format)
    if (!rawResult) {
      const functionCall = aiResult.choices?.[0]?.message?.function_call;
      if (functionCall && functionCall.name === "create_clusters") {
        try {
          rawResult = JSON.parse(functionCall.arguments);
        } catch (parseError) {
          console.error("Failed to parse function_call arguments:", parseError);
        }
      }
    }
    
    // Try to extract from content if it's JSON
    if (!rawResult) {
      const content = aiResult.choices?.[0]?.message?.content;
      if (content) {
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.clusters !== undefined) {
              rawResult = parsed;
            }
          }
        } catch (parseError) {
          console.error("Failed to parse content as JSON:", parseError);
        }
      }
    }
    
    if (!rawResult || !Array.isArray(rawResult.clusters)) {
      console.error("Invalid AI response - no clusters found. Full response:", JSON.stringify(aiResult));
      throw new Error("Resposta da IA não contém clusters válidos. Tente novamente.");
    }

    // ============================================================
    // POST-AI PROCESSING: Normalize, validate, deduplicate, fuse
    // ============================================================
    
    // 1. Normalize clusters (backward compat: bank_topic_id -> bank_topic_ids)
    const normalizedClusters = normalizeAIClusters(rawResult.clusters);
    
    console.log(`[PRE-FUSION] ${normalizedClusters.length} clusters from AI`);
    
    // 2. Deduplicate and fuse clusters with shared bank_topic_ids
    const { fused: fusedClusters, fusionLog } = deduplicateAndFuseClusters(normalizedClusters);
    
    if (fusionLog.length > 0) {
      console.log(`[FUSION] ${fusionLog.length} fusion(s) applied:`);
      fusionLog.forEach(log => console.log(`  - ${log}`));
    }
    
    console.log(`[POST-FUSION] ${fusedClusters.length} clusters after deduplication`);
    
    // 3. Final validation: ensure no bank_topic_id appears in multiple clusters
    const finalTopicSet = new Set<string>();
    let validationPassed = true;
    for (const cluster of fusedClusters) {
      for (const topicId of cluster.bank_topic_ids) {
        if (finalTopicSet.has(topicId)) {
          console.error(`[VALIDATION FAILED] bank_topic_id ${topicId} still duplicated after fusion!`);
          validationPassed = false;
        }
        finalTopicSet.add(topicId);
      }
    }
    
    if (!validationPassed) {
      throw new Error("Erro interno: duplicidade de cadernos persiste após fusão. Tente novamente.");
    }

    // 3b. COMPLETENESS VALIDATION: ensure ALL edital topics appear in output
    const allCoveredEditalItems = new Set<string>();
    for (const cluster of fusedClusters) {
      for (const item of cluster.edital_items) {
        allCoveredEditalItems.add(item.trim());
      }
    }
    const allUncoveredEditalItems = new Set<string>();
    const uncoveredClusters: AIUncoveredCluster[] = rawResult.uncovered_clusters || [];
    for (const uc of uncoveredClusters) {
      for (const item of (uc.edital_items || [])) {
        allUncoveredEditalItems.add(item.trim());
      }
    }

    // Find edital topics missing from both covered and uncovered
    const missingEditalTopics: string[] = [];
    for (const topic of editalTopics) {
      const trimmed = topic.trim();
      if (!allCoveredEditalItems.has(trimmed) && !allUncoveredEditalItems.has(trimmed)) {
        // Try fuzzy match (AI may have slightly altered the text)
        const fuzzyMatch = [...allCoveredEditalItems, ...allUncoveredEditalItems].some(
          existing => existing.toLowerCase().includes(trimmed.toLowerCase()) || 
                      trimmed.toLowerCase().includes(existing.toLowerCase())
        );
        if (!fuzzyMatch) {
          missingEditalTopics.push(trimmed);
        }
      }
    }

    if (missingEditalTopics.length > 0) {
      console.warn(`[COMPLETENESS] ${missingEditalTopics.length} edital topic(s) missing from AI response. Auto-adding to uncovered_clusters.`);
      console.warn(`[COMPLETENESS] Missing topics:`, missingEditalTopics);
      uncoveredClusters.push({
        cluster_name: `Tópicos não mapeados pela IA (${missingEditalTopics.length})`,
        edital_items: missingEditalTopics,
        reasoning: 'Tópicos do edital que a IA não incluiu em nenhum cluster. Adicionados automaticamente para garantir cobertura completa.',
        suggested_disciplines: []
      });
    }

    // 4. Build question count map from bankTopics input for enrichment
    const questionCountMap = new Map<string, number>();
    for (const t of bankTopics) {
      if (t.id && t.question_count !== undefined) {
        questionCountMap.set(t.id, t.question_count);
      }
    }

    // 5. Enrich clusters with total_questoes
    const enrichedClusters = fusedClusters.map(c => ({
      ...c,
      total_questoes: c.bank_topic_ids.reduce((sum, id) => sum + (questionCountMap.get(id) || 0), 0)
    }));

    const result: any = {
      clusters: enrichedClusters,
      uncovered_clusters: uncoveredClusters,
      summary: rawResult.summary || '',
      fusion_log: fusionLog
    };

    console.log(`Created ${result.clusters?.length || 0} covered clusters and ${result.uncovered_clusters?.length || 0} uncovered clusters`);
    // Log per-cluster question totals for audit
    for (const c of enrichedClusters) {
      console.log(`  [CLUSTER] "${c.cluster_name}" → ${c.bank_topic_ids.length} cadernos, ${c.total_questoes} questões, ${c.edital_items.length} itens edital`);
    }
    if (missingEditalTopics.length > 0) {
      console.log(`  [AUTO-ADDED] ${missingEditalTopics.length} tópicos faltantes adicionados a uncovered_clusters`);
    }
    if (fusionLog.length > 0) {
      console.log(`Applied ${fusionLog.length} automatic fusion(s) to resolve duplicate bank_topic_ids`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in map-edital-topics:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
