import ConselhoThemeWrapper from "@/components/ConselhoThemeWrapper";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DissertativeContentRenderer } from "@/components/dissertativa/DissertativeContentRenderer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Send, Loader2, Star, AlertCircle, CheckCircle2, BookOpen, FileText, PenLine, RotateCcw, Lock, FileBarChart } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { toast } from "sonner";

const MAX_SUBMISSIONS = 2;

interface AiFeedback {
  nota: number;
  resumo_avaliativo?: string;
  criterios: Array<{ nome: string; nota: number; peso?: number; comentario: string }>;
  pontos_fortes: string[];
  pontos_melhoria: string[];
  sugestao_reescrita: string;
  checklist?: Array<{ item: string; atendido: boolean }>;
}

function QuestionContent() {
  const { courseId, disciplineId, questionId } = useParams<{
    courseId: string;
    disciplineId: string;
    questionId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fromSuffix } = useBackNavigation();
  const queryClient = useQueryClient();
  const [answer, setAnswer] = useState("");
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const { data: question, isLoading } = useQuery({
    queryKey: ["dissertative-question", questionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dissertative_questions")
        .select("*")
        .eq("id", questionId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!questionId,
  });

  const { data: pastSubmissions } = useQuery({
    queryKey: ["dissertative-submissions", questionId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dissertative_submissions")
        .select("*")
        .eq("question_id", questionId!)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!questionId && !!user?.id,
  });

  const submissionCount = pastSubmissions?.length ?? 0;
  const canSubmit = submissionCount < MAX_SUBMISSIONS;

  const submitMutation = useMutation({
    mutationFn: async (studentAnswer: string) => {
      // Force token refresh to avoid sending expired JWT to the edge function
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session) {
        // If refresh fails, try getting existing session as fallback
        const { data: fallback } = await supabase.auth.getSession();
        if (!fallback.session) throw new Error("Sua sessão expirou. Faça login novamente.");
      }

      const response = await supabase.functions.invoke("correct-dissertative", {
        body: {
          course_id: courseId,
          question_id: questionId,
          student_answer: studentAnswer,
        },
      });

      if (response.error) {
        // Extract the real error message from the edge function response body
        let realMessage = "Erro na correção";
        try {
          const ctx = response.error.context;
          if (ctx instanceof Response) {
            const body = await ctx.json();
            realMessage = body.message || body.error || realMessage;
          } else if (response.error.message) {
            realMessage = response.error.message;
          }
        } catch {
          realMessage = response.error.message || realMessage;
        }

        if (realMessage.includes("Rate limit") || realMessage.includes("429")) {
          throw new Error("Servidor sobrecarregado. Tente novamente em alguns segundos.");
        }
        if (realMessage.includes("credits") || realMessage.includes("402")) {
          throw new Error("Créditos de IA esgotados. Entre em contato com o suporte.");
        }
        if (realMessage === "Unauthorized" || realMessage.includes("401")) {
          throw new Error("Sua sessão expirou. Recarregue a página e tente novamente.");
        }
        throw new Error(realMessage);
      }
      if (response.data?.error) throw new Error(response.data.message || response.data.error);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("Resposta corrigida com sucesso!");
      setAnswer("");
      setExpandedReport(data?.submission_id || null);
      queryClient.invalidateQueries({ queryKey: ["dissertative-submissions", questionId] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao enviar: ${err.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Questão não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/dissertativa/${courseId}/${disciplineId}${fromSuffix}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Questão Dissertativa</h1>
        </div>

        {/* Enunciado */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Enunciado
            </CardTitle>
          </CardHeader>
          <CardContent>
             <DissertativeContentRenderer content={question.statement} type="statement" />
          </CardContent>
        </Card>

        {/* Accordion sections */}
        <Accordion type="multiple" className="space-y-2">
          {/* Gabarito Comentado */}
          {question.answer_key && (
            <AccordionItem value="answer_key" className="border rounded-lg px-1">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Gabarito Comentado
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <DissertativeContentRenderer content={question.answer_key} type="answer_key" />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Resposta-Modelo */}
          {(question as any).model_answer && (
            <AccordionItem value="model_answer" className="border rounded-lg px-1">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Resposta-Modelo
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <DissertativeContentRenderer content={(question as any).model_answer} type="model_answer" />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Responder */}
          <AccordionItem value="respond" className="border rounded-lg px-1">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-medium">
                <PenLine className="w-4 h-4 text-orange-500" />
                Responder
                <Badge variant="outline" className="ml-2 text-xs">
                  {submissionCount}/{MAX_SUBMISSIONS}
                </Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4">
              {canSubmit ? (
                <>
                  <Textarea
                    placeholder="Escreva sua resposta aqui..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={10}
                    className="resize-y"
                    disabled={submitMutation.isPending}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {answer.length} caracteres · {MAX_SUBMISSIONS - submissionCount} tentativa{MAX_SUBMISSIONS - submissionCount !== 1 ? "s" : ""} restante{MAX_SUBMISSIONS - submissionCount !== 1 ? "s" : ""}
                    </span>
                    <Button
                      onClick={() => submitMutation.mutate(answer)}
                      disabled={!answer.trim() || submitMutation.isPending}
                    >
                      {submitMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Corrigindo...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Enviar para Correção
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
                  <Lock className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Limite de submissões atingido</p>
                    <p className="text-xs text-muted-foreground">
                      Você já utilizou suas {MAX_SUBMISSIONS} tentativas para esta questão. Revise os relatórios abaixo para identificar pontos de melhoria.
                    </p>
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Submissões e Relatórios */}
        {pastSubmissions && pastSubmissions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Suas Submissões
            </h2>
            {pastSubmissions.map((sub, index) => (
              <SubmissionCard
                key={sub.id}
                submission={sub}
                index={pastSubmissions.length - index}
                isExpanded={expandedReport === sub.id}
                onToggleReport={() => setExpandedReport(expandedReport === sub.id ? null : sub.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SubmissionCard({
  submission,
  index,
  isExpanded,
  onToggleReport,
}: {
  submission: any;
  index: number;
  isExpanded: boolean;
  onToggleReport: () => void;
}) {
  const feedback = submission.ai_feedback as unknown as AiFeedback | null;
  const rawNota = feedback?.nota ?? submission.score ?? 0;
  // Normalize: if AI returned a score > 10, cap/normalize to 0-10
  const nota = rawNota > 10 ? Math.round((rawNota / 50) * 10 * 10) / 10 : Math.round(Math.max(0, Math.min(10, rawNota)) * 10) / 10;

  return (
    <Card className={isExpanded ? "border-primary/50 shadow-md" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Tentativa {index} · Nota: {nota}/10
            </span>
            <Badge variant="outline" className="text-xs">
              {new Date(submission.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onToggleReport} className="gap-1.5">
            <FileBarChart className="w-3.5 h-3.5" />
            {isExpanded ? "Fechar Relatório" : "Ver Relatório"}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && feedback && (
        <CardContent className="space-y-4 text-sm pt-2">
          {/* Resumo avaliativo */}
          {feedback.resumo_avaliativo && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm text-foreground leading-relaxed">{feedback.resumo_avaliativo}</p>
            </div>
          )}

          {/* Critérios */}
          {feedback.criterios?.length > 0 && (
            <div>
              <h4 className="font-medium mb-2 text-foreground">Critérios de Avaliação</h4>
              <div className="space-y-2">
                {feedback.criterios.map((c, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-foreground">{c.nome}</span>
                      <span className="text-primary">{c.nota}/10</span>
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed">{c.comentario}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pontos fortes */}
          {feedback.pontos_fortes?.length > 0 && (
            <div>
              <h4 className="font-medium mb-1 text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Pontos Fortes
              </h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                {feedback.pontos_fortes.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

          {/* Pontos de melhoria */}
          {feedback.pontos_melhoria?.length > 0 && (
            <div>
              <h4 className="font-medium mb-1 text-foreground flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-yellow-500" /> Pontos de Melhoria
              </h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                {feedback.pontos_melhoria.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

          {/* Checklist */}
          {feedback.checklist && feedback.checklist.length > 0 && (
            <div>
              <h4 className="font-medium mb-1 text-foreground">Checklist</h4>
              <div className="space-y-1">
                {feedback.checklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {item.atendido ? (
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-red-500" />
                    )}
                    <span className={item.atendido ? "text-foreground" : "text-muted-foreground"}>{item.item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sugestão de reescrita */}
          {feedback.sugestao_reescrita && (
            <div>
              <h4 className="font-medium mb-1 text-foreground">Sugestão de Reescrita</h4>
              <p className="text-muted-foreground whitespace-pre-wrap text-xs leading-relaxed">{feedback.sugestao_reescrita}</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function DissertativaQuestion() {
  return <ConselhoThemeWrapper><QuestionContent /></ConselhoThemeWrapper>;
}
