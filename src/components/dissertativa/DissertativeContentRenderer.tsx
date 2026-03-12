import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

/**
 * Attempts to extract and parse JSON from AI-generated content.
 */
function extractJson(text: string): Record<string, unknown> | null {
  if (!text || typeof text !== "string") return null;
  
  // If it's already an object (e.g. Supabase returned parsed JSON)
  if (typeof text === "object") return text as unknown as Record<string, unknown>;
  
  let cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .replace(/^\s*\n/, "") // leading newline
    .trim();

  // Remove BOM and zero-width characters
  cleaned = cleaned.replace(/[\uFEFF\u200B\u200C\u200D]/g, "");

  // Attempt 1: direct parse
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch {}

  // Attempt 2: find JSON boundaries
  const jsonStart = cleaned.search(/[\{]/);
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    const substring = cleaned.substring(jsonStart, jsonEnd + 1);
    try {
      const parsed = JSON.parse(substring);
      if (typeof parsed === "object" && parsed !== null) return parsed;
    } catch {}

    // Attempt 3: fix common LLM issues
    try {
      const fixed = substring
        .replace(/,\s*}/g, "}") // trailing commas before }
        .replace(/,\s*]/g, "]") // trailing commas before ]
        .replace(/[\x00-\x1F\x7F]/g, (ch) => ch === "\n" || ch === "\t" ? ch : "") // control chars except newline/tab
        .replace(/\n/g, "\\n") // escape literal newlines inside strings
        .replace(/\t/g, "\\t");
      const parsed = JSON.parse(fixed);
      if (typeof parsed === "object" && parsed !== null) return parsed;
    } catch {}

    // Attempt 4: truncation recovery - try closing open braces
    try {
      let recovered = substring;
      const openBraces = (recovered.match(/{/g) || []).length;
      const closeBraces = (recovered.match(/}/g) || []).length;
      const openBrackets = (recovered.match(/\[/g) || []).length;
      const closeBrackets = (recovered.match(/]/g) || []).length;
      
      // Remove any trailing partial key/value
      recovered = recovered.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*$/, "");
      
      for (let i = 0; i < openBrackets - closeBrackets; i++) recovered += "]";
      for (let i = 0; i < openBraces - closeBraces; i++) recovered += "}";
      
      const parsed = JSON.parse(recovered);
      if (typeof parsed === "object" && parsed !== null) return parsed;
    } catch {}
  }

  return null;
}

// Keys to hide from rendering
const HIDDEN_KEYS = new Set([
  "answer_key_commented", "answer key commented", "model_answer", "model answer",
  "text", "word_count", "word count", "structure", "has_introduction", "has introduction",
  "has_development", "has development", "has_conclusion", "has conclusion",
  "meta", "validation", "error", "question", "estrutura_avaliativa",
  // Flat statement fields rendered explicitly by RenderStatement
  "exam", "disciplina", "topico", "tema", "comando", "numero_linhas_esperado",
  "tipo_textual", "criterios_avaliacao", "ponto_tematico",
  // Flat answer key fields rendered explicitly by RenderAnswerKey
  "estrutura_esperada",
]);

function shouldHideKey(key: string): boolean {
  return HIDDEN_KEYS.has(key.toLowerCase().replace(/_/g, " "));
}

/**
 * Strips T1-T5 topic descriptions from the comando text.
 * These belong in the Gabarito Comentado, not the statement.
 */
function stripTopicsFromComando(comando: string): string {
  // Remove lines starting with T1., T2., etc. and everything after them
  // Pattern: matches "T1." or "\nT1." followed by content until end or next section
  const lines = comando.split("\n");
  const filtered: string[] = [];
  let insideTopics = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // Detect T1-T9 pattern at start of line
    if (/^T\d+[\.\)]\s/.test(trimmed)) {
      insideTopics = true;
      continue; // skip this line
    }
    // If we're inside topics and line is continuation (non-empty, no new section header)
    if (insideTopics && trimmed && !/^[A-Z]/.test(trimmed)) {
      continue; // skip continuation lines of topic descriptions
    }
    if (insideTopics && !trimmed) {
      // Empty line after topics, keep skipping
      continue;
    }
    insideTopics = false;
    filtered.push(line);
  }

  return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Renders a question statement from JSON format */
function RenderStatement({ data }: { data: Record<string, unknown> }) {
  const meta = data.meta as Record<string, unknown> | undefined;
  const question = data.question as Record<string, unknown> | undefined;

  // Detect flat statement structure (Fundação Osório style: {exam, disciplina, topico, tema, comando, criterios_avaliacao})
  const isFlat = !question && (data.comando || data.tema || data.topico);
  const src = question || (isFlat ? data : null);

  return (
    <div className="space-y-4">
      {meta && (
        <div className="flex flex-wrap gap-2">
          {meta.course && <Badge variant="outline" className="text-xs">{String(meta.course)}</Badge>}
          {meta.discipline && <Badge variant="outline" className="text-xs">{String(meta.discipline)}</Badge>}
          {meta.topic_title && <Badge variant="secondary" className="text-xs">{String(meta.topic_title)}</Badge>}
        </div>
      )}

      {/* Flat badges for exam/disciplina/tipo_textual */}
      {isFlat && (
        <div className="flex flex-wrap gap-2">
          {data.exam && <Badge variant="outline" className="text-xs">{String(data.exam)}</Badge>}
          {data.disciplina && <Badge variant="outline" className="text-xs">{String(data.disciplina)}</Badge>}
          {data.tipo_textual && <Badge variant="secondary" className="text-xs">{String(data.tipo_textual)}</Badge>}
          {data.numero_linhas_esperado && <Badge variant="secondary" className="text-xs">{String(data.numero_linhas_esperado)}</Badge>}
        </div>
      )}

      {src && (
        <div className="space-y-4">
          {(src.ponto_tematico || src.topico) && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">
                {src.ponto_tematico ? "Ponto Temático" : "Tópico"}
              </h3>
              <p className="text-sm text-foreground font-medium leading-relaxed">{String(src.ponto_tematico || src.topico)}</p>
            </div>
          )}

          {src.tema && (
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tema</h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{String(src.tema)}</p>
            </div>
          )}

          {src.comando && (
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comando</h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {stripTopicsFromComando(String(src.comando))}
              </p>
            </div>
          )}

          {/* Critérios de avaliação (array of {code, name, max_points}) */}
          {src.criterios_avaliacao && Array.isArray(src.criterios_avaliacao) && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Critérios de Avaliação</h3>
              <div className="space-y-1.5">
                {(src.criterios_avaliacao as Array<Record<string, unknown>>).map((c, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/30 border border-border/50">
                    <Badge variant="secondary" className="text-xs font-mono shrink-0">{String(c.code || c.codigo || String.fromCharCode(65 + i))}</Badge>
                    <span className="text-xs text-foreground flex-1">{String(c.name || c.nome || "")}</span>
                    {(c.max_points || c.pontos) && (
                      <Badge variant="outline" className="text-xs shrink-0">{String(c.max_points || c.pontos)} pts</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Render non-topic, non-hidden fields from statement (original nested structure fallback) */}
      {!src && (
        <div className="space-y-3">
          {renderFallbackFields(data, true)}
        </div>
      )}
    </div>
  );
}

/** Renders answer key / gabarito with collapsible T1-T5 topics */
function RenderAnswerKey({ data }: { data: Record<string, unknown> }) {
  // Check multiple possible locations for topic data
  const questionObj = data.question as Record<string, unknown> | undefined;
  const answerKeyCommented = data.answer_key_commented as Record<string, unknown> | undefined;
  const topics = answerKeyCommented
    || data.topicos || data.topics || data.estrutura_avaliativa
    || questionObj?.estrutura_avaliativa;
  const generalComments = data.comentarios_gerais || data.general_comments;

  // Detect Fundação Osório style: {tema, estrutura_esperada: {introducao, desenvolvimento: [{eixo, ...}], conclusao}}
  const estruturaEsperada = data.estrutura_esperada as Record<string, unknown> | undefined;
  const hasFlatGabarito = !topics && (estruturaEsperada || data.tema);

  return (
    <div className="space-y-4">
      {topics && typeof topics === "object" && (
        <Accordion type="multiple" className="space-y-1">
          {Object.entries(topics as Record<string, unknown>)
            .filter(([key, value]) => {
              // Only show T1-T9 topic keys for students; CR keys are internal grading criteria
              if (/^CR\d/i.test(key)) return false;
              // Skip error/meta/noise keys
              if (["error", "meta", "validation", "question_id", "version"].includes(key.toLowerCase())) return false;
              // Skip null/undefined values
              if (value === null || value === undefined || value === "null") return false;
              return true;
            })
            .map(([key, value]) => {
            const topicData = typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
            const topicName = topicData?.nome || topicData?.name || "";
            // For CR-type keys, show max_points info if no name
            const crLabel = !topicName && topicData?.max_points 
              ? `Critério ${key} — ${topicData.max_points} pontos`
              : "";
            const displayName = topicName ? String(topicName) : crLabel;

            return (
              <AccordionItem key={key} value={key} className="border rounded-lg px-1">
                <AccordionTrigger className="px-3 py-2.5 hover:no-underline">
                  <span className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary" className="text-xs font-mono shrink-0">{key}</Badge>
                    {displayName && (
                      <span className="text-xs font-medium text-foreground text-left">{displayName}</span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  {topicData ? (
                    <div className="space-y-2">
                      {topicData.subcriteria && Array.isArray(topicData.subcriteria) && (
                        <div>
                          <span className="text-xs font-medium text-primary">Subcritérios: </span>
                          <ul className="list-disc list-inside text-xs text-foreground mt-1 space-y-0.5">
                            {(topicData.subcriteria as Array<Record<string, unknown>>).map((sc, i) => (
                              <li key={i}>{sc.code ? `${sc.code}) ` : ""}{String(sc.name || "")} {sc.max_points ? `(${sc.max_points} pts)` : ""}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {topicData.fundamentacao_esperada && (
                        <div>
                          <span className="text-xs font-medium text-primary">Fundamentação esperada: </span>
                          <span className="text-xs text-foreground">{String(topicData.fundamentacao_esperada)}</span>
                        </div>
                      )}
                      {topicData.elementos_indispensaveis && (
                        <div>
                          <span className="text-xs font-medium text-primary">Elementos indispensáveis: </span>
                          <span className="text-xs text-foreground">
                            {Array.isArray(topicData.elementos_indispensaveis)
                              ? (topicData.elementos_indispensaveis as string[]).join("; ")
                              : String(topicData.elementos_indispensaveis)}
                          </span>
                        </div>
                      )}
                      {topicData.conceitos_chave && (
                        <div>
                          <span className="text-xs font-medium text-primary">Conceitos-chave: </span>
                          <span className="text-xs text-foreground">
                            {Array.isArray(topicData.conceitos_chave)
                              ? (topicData.conceitos_chave as string[]).join("; ")
                              : String(topicData.conceitos_chave)}
                          </span>
                        </div>
                      )}
                      {topicData.erros_comuns && (
                        <div>
                          <span className="text-xs font-medium text-destructive">Erros comuns: </span>
                          <span className="text-xs text-foreground">
                            {Array.isArray(topicData.erros_comuns)
                              ? (topicData.erros_comuns as string[]).join("; ")
                              : String(topicData.erros_comuns)}
                          </span>
                        </div>
                      )}
                      {/* Render any other fields not already shown */}
                      {Object.entries(topicData)
                        .filter(([k]) => !["nome", "name", "fundamentacao_esperada", "elementos_indispensaveis", "conceitos_chave", "erros_comuns"].includes(k))
                        .map(([k, v]) => {
                          if (v === null || v === undefined) return null;
                          const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                          return (
                            <div key={k}>
                              <span className="text-xs font-medium text-muted-foreground">{label}: </span>
                              <span className="text-xs text-foreground">{typeof v === "string" ? v : JSON.stringify(v)}</span>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-xs text-foreground">{String(value)}</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Fundação Osório style gabarito: {tema, estrutura_esperada: {introducao, desenvolvimento: [{eixo, ...}], conclusao}} */}
      {hasFlatGabarito && (
        <div className="space-y-4">
          {data.tema && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <h4 className="text-xs font-semibold text-primary uppercase mb-1">Tema</h4>
              <p className="text-sm text-foreground leading-relaxed">{String(data.tema)}</p>
            </div>
          )}

          {estruturaEsperada && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estrutura Esperada</h4>

              {/* Introdução */}
              {estruturaEsperada.introducao && (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <h5 className="text-xs font-semibold text-primary uppercase mb-1">Introdução</h5>
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{String(estruturaEsperada.introducao)}</p>
                </div>
              )}

              {/* Desenvolvimento — array of eixos */}
              {estruturaEsperada.desenvolvimento && (
                <div className="space-y-1">
                  <h5 className="text-xs font-semibold text-primary uppercase mb-1">Desenvolvimento</h5>
                  <Accordion type="multiple" className="space-y-1">
                    {(Array.isArray(estruturaEsperada.desenvolvimento)
                      ? estruturaEsperada.desenvolvimento as Array<Record<string, unknown>>
                      : [estruturaEsperada.desenvolvimento as Record<string, unknown>]
                    ).map((eixo, i) => {
                      const eixoTitle = eixo.eixo || eixo.titulo || eixo.title || `Eixo ${i + 1}`;
                      return (
                        <AccordionItem key={i} value={`eixo-${i}`} className="border rounded-lg px-1">
                          <AccordionTrigger className="px-3 py-2.5 hover:no-underline">
                            <span className="flex items-center gap-2 text-sm text-left">
                              <Badge variant="secondary" className="text-xs font-mono shrink-0">Eixo {i + 1}</Badge>
                              <span className="text-xs font-medium text-foreground">{String(eixoTitle)}</span>
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pb-3">
                            <div className="space-y-2">
                              {eixo.criterios_relacionados && (
                                <div>
                                  <span className="text-xs font-medium text-primary">Critérios relacionados: </span>
                                  <span className="text-xs text-foreground">
                                    {Array.isArray(eixo.criterios_relacionados)
                                      ? (eixo.criterios_relacionados as string[]).join(", ")
                                      : String(eixo.criterios_relacionados)}
                                  </span>
                                </div>
                              )}
                              {eixo.fundamentacao_teorica && (
                                <div>
                                  <span className="text-xs font-medium text-primary">Fundamentação teórica: </span>
                                  <span className="text-xs text-foreground">{String(eixo.fundamentacao_teorica)}</span>
                                </div>
                              )}
                              {eixo.argumentos_esperados && (
                                <div>
                                  <span className="text-xs font-medium text-primary">Argumentos esperados: </span>
                                  {Array.isArray(eixo.argumentos_esperados) ? (
                                    <ul className="list-disc list-inside text-xs text-foreground mt-1 space-y-0.5">
                                      {(eixo.argumentos_esperados as string[]).map((arg, j) => (
                                        <li key={j}>{arg}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <span className="text-xs text-foreground">{String(eixo.argumentos_esperados)}</span>
                                  )}
                                </div>
                              )}
                              {/* Render remaining eixo fields */}
                              {Object.entries(eixo)
                                .filter(([k]) => !["eixo", "titulo", "title", "criterios_relacionados", "fundamentacao_teorica", "argumentos_esperados"].includes(k))
                                .map(([k, v]) => {
                                  if (v === null || v === undefined) return null;
                                  const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                                  return (
                                    <div key={k}>
                                      <span className="text-xs font-medium text-muted-foreground">{label}: </span>
                                      <span className="text-xs text-foreground">
                                        {typeof v === "string" ? v : Array.isArray(v) ? (v as string[]).join("; ") : JSON.stringify(v)}
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              )}

              {/* Conclusão */}
              {estruturaEsperada.conclusao && (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <h5 className="text-xs font-semibold text-primary uppercase mb-1">Conclusão</h5>
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{String(estruturaEsperada.conclusao)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {generalComments && (
        <div className="p-3 rounded-lg bg-accent/30">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Comentários Gerais</h4>
          <p className="text-sm text-foreground whitespace-pre-wrap">{String(generalComments)}</p>
        </div>
      )}

      {!topics && !hasFlatGabarito && renderFallbackFields(data)}
    </div>
  );
}

/** Renders model answer from JSON or text */
function RenderModelAnswer({ data }: { data: Record<string, unknown> }) {
  // Check if this is an error response from failed generation
  const hasError = data.error || (data.meta as Record<string, unknown>)?.question_id === "error";
  
  if (hasError) {
    const errorMsg = typeof data.error === "string" ? data.error 
      : typeof data.error === "object" && data.error !== null ? (data.error as Record<string, unknown>).message || JSON.stringify(data.error)
      : null;
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
        <span className="text-muted-foreground text-sm">
          ⚠️ Resposta-modelo não disponível. {errorMsg ? `Motivo: ${String(errorMsg).substring(0, 150)}` : "É necessário regenerar esta etapa."}
        </span>
      </div>
    );
  }

  // model_answer is hidden from generic rendering but we explicitly use it here
  const raw = data.resposta || data.resposta_modelo || data.model_answer || data.modelo_resposta || data.texto || data.text;
  
  // Handle both string and object {text: "..."} formats
  let text: string | null = null;
  if (typeof raw === "string") {
    text = raw;
  } else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.text === "string") {
      text = obj.text;
    }
  }

  if (text) {
    return (
      <div className="prose prose-sm max-w-none text-foreground">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    );
  }

  // If model_answer exists but text is null/empty, show unavailable
  if (raw !== undefined) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
        <span className="text-muted-foreground text-sm">
          ⚠️ Resposta-modelo gerada mas sem conteúdo textual. Regenere esta etapa.
        </span>
      </div>
    );
  }

  // Fallback: render all non-hidden fields except meta/error/validation
  const renderableData = Object.fromEntries(
    Object.entries(data).filter(([k]) => !["meta", "validation", "error"].includes(k))
  );
  return <div className="space-y-3">{renderFallbackFields(renderableData)}</div>;
}

/** Generic fallback renderer for unknown JSON structures */
function renderFallbackFields(data: Record<string, unknown>, excludeTopics = false) {
  return Object.entries(data)
    .filter(([key]) => !shouldHideKey(key))
    .filter(([key]) => {
      if (excludeTopics && /^[tT]\d/.test(key)) return false;
      if (key === "topicos" || key === "topics" || key === "estrutura_avaliativa") return !excludeTopics;
      return true;
    })
    .map(([key, value]) => {
      if (value === null || value === undefined) return null;

      const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      if (typeof value === "string") {
        return (
          <div key={key}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</h4>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{value}</p>
          </div>
        );
      }

      if (Array.isArray(value)) {
        return (
          <div key={key}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</h4>
            <ul className="list-disc list-inside text-sm text-foreground space-y-0.5">
              {value.map((item, i) => (
                <li key={i}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
              ))}
            </ul>
          </div>
        );
      }

      if (typeof value === "object") {
        return (
          <div key={key} className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</h4>
            {renderFallbackFields(value as Record<string, unknown>)}
          </div>
        );
      }

      if (typeof value === "boolean" || typeof value === "number") return null; // hide booleans/numbers like word_count, has_introduction

      return (
        <div key={key}>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</h4>
          <p className="text-sm text-foreground">{String(value)}</p>
        </div>
      );
    });
}

/**
 * Main renderer component.
 */
export function DissertativeContentRenderer({
  content,
  type = "generic",
}: {
  content: string;
  type?: "statement" | "answer_key" | "model_answer" | "generic";
}) {
  const parsed = useMemo(() => extractJson(content), [content]);

  // Detect truncated JSON that shouldn't reach students
  const isTruncated = useMemo(() => {
    if (!content || typeof content !== "string") return false;
    const t = content.trim();
    if (!t.startsWith("{") && !t.startsWith("[")) return false;
    const openB = (t.match(/{/g) || []).length;
    const closeB = (t.match(/}/g) || []).length;
    return openB !== closeB;
  }, [content]);

  if (isTruncated) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
        <span className="text-destructive text-sm">
          ⚠️ Conteúdo corrompido ou incompleto. Solicite a regeneração ao administrador.
        </span>
      </div>
    );
  }

  if (!parsed) {
    // Never show raw JSON to students - detect if content looks like JSON
    const looksLikeJson = content.trim().startsWith("{") || content.trim().startsWith("[");
    if (looksLikeJson) {
      return (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
          <span className="text-muted-foreground text-sm">
            ⚠️ Conteúdo indisponível no momento. Tente novamente mais tarde.
          </span>
        </div>
      );
    }
    return <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{content}</p>;
  }

  switch (type) {
    case "statement":
      return <RenderStatement data={parsed} />;
    case "answer_key":
      return <RenderAnswerKey data={parsed} />;
    case "model_answer":
      return <RenderModelAnswer data={parsed} />;
    default:
      return <div className="space-y-3">{renderFallbackFields(parsed)}</div>;
  }
}
