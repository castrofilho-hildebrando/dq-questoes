import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  RefreshCw, 
  HelpCircle, 
  CheckCircle2, 
  Circle, 
  Clock, 
  FileText, 
  Video, 
  Lightbulb,
  Bot,
  ExternalLink,
  Undo2,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { validateNotebookIds, NotebookValidationResult } from "@/hooks/useValidateNotebooks";
import { toast } from "@/hooks/use-toast";

interface CronogramaTask {
  id: string;
  cronograma_id: string;
  goal_id: string | null;
  scheduled_date: string;
  start_time: string | null;
  duration_minutes: number;
  is_completed: boolean;
  completed_at: string | null;
  notes: string | null;
  is_revision: boolean;
  revision_number: number | null;
  source_topic_id: string | null;
  part_number: number | null;
  total_parts: number | null;
  topic_goals?: {
    id: string;
    name: string;
    description: string | null;
    goal_type: string | null;
    duration_minutes: number | null;
    topic_id?: string; // Canonical FK to study_topics
    video_links: any;
    pdf_links: any;
    flashcard_links: string[] | null;
    question_notebook_ids?: string[] | null;
    study_topics?: {
      id: string;
      name: string;
      source_notebook_id?: string | null;
      study_disciplines?: {
        id: string;
        name: string;
      };
    };
  } | null;
  study_topics?: {
    id: string;
    name: string;
    source_notebook_id?: string | null;
    study_disciplines?: {
      id: string;
      name: string;
    };
  } | null;
}

interface CronogramaSchool {
  id: string;
  name: string;
  has_flashcards?: boolean;
  has_robo_tutor?: boolean;
  has_banco_questoes?: boolean;
  has_materials?: boolean;
  has_videos?: boolean;
}

interface GoalDetailDialogProps {
  task: CronogramaTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleComplete: (taskId: string, isCompleted: boolean) => void;
  school?: CronogramaSchool | null;
  hideResources?: boolean;
  targetUserId?: string; // Used when admin views student's cronograma
}

const GOAL_TYPE_CONFIG = {
  study: {
    label: "Estudo",
    icon: BookOpen,
    color: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  },
  review: {
    label: "Revisão",
    icon: RefreshCw,
    color: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  },
  questions: {
    label: "Questões",
    icon: HelpCircle,
    color: "bg-green-500/10 text-green-500 border-green-500/30",
  },
};

export function GoalDetailDialog({
  task,
  open,
  onOpenChange,
  onToggleComplete,
  school,
  hideResources = false,
  targetUserId,
}: GoalDetailDialogProps) {
  const location = useLocation();
  const [pdfMaterials, setPdfMaterials] = useState<{ id: string; name: string; url: string }[]>([]);
  const [loadingPdfs, setLoadingPdfs] = useState(false);
  const [validatingNotebooks, setValidatingNotebooks] = useState(false);

  // Get current URL to use as returnTo parameter
  const returnToUrl = encodeURIComponent(location.pathname + location.search);

  // Derive values safely (can be undefined if task is null)
  const goal = task?.topic_goals;
  const topic = goal?.study_topics || task?.study_topics;
  const discipline = topic?.study_disciplines;
  
  // For revisions, always use review config; otherwise use goal type
  const isRevision = task?.is_revision === true;
  const effectiveGoalType = isRevision ? "review" : ((goal?.goal_type || "study") as keyof typeof GOAL_TYPE_CONFIG);
  const typeConfig = GOAL_TYPE_CONFIG[effectiveGoalType] || GOAL_TYPE_CONFIG.study;
  const TypeIcon = typeConfig.icon;

  // Resource availability from school config
  const hasFlashcards = school?.has_flashcards ?? true;
  const hasRoboTutor = school?.has_robo_tutor ?? true;
  const hasBancoQuestoes = school?.has_banco_questoes ?? true;
  const hasMaterials = school?.has_materials ?? true;
  const hasVideos = school?.has_videos ?? true;

  // Resources from goal - memoized to avoid infinite loops in useEffect
  const pdfLinks = useMemo(() => goal?.pdf_links || [], [goal?.pdf_links]);
  const videoLinks = useMemo(() => goal?.video_links || [], [goal?.video_links]);
  const questionNotebookIds = useMemo(() => goal?.question_notebook_ids || [], [goal?.question_notebook_ids]);
  const flashcardLinks = useMemo(() => goal?.flashcard_links || [], [goal?.flashcard_links]);
  
  // Get source_notebook_id from topic as fallback for questions
  const topicSourceNotebookId = topic?.source_notebook_id || goal?.study_topics?.source_notebook_id;

  // Fetch PDF materials when dialog opens
  useEffect(() => {
    if (!open || !task || !Array.isArray(pdfLinks) || pdfLinks.length === 0) {
      setPdfMaterials([]);
      return;
    }

    const fetchPdfMaterials = async () => {
      setLoadingPdfs(true);
      try {
        // Extract pdf_material_ids from the links
        const pdfMaterialIds = pdfLinks
          .map((link: any) => link?.pdf_material_id)
          .filter(Boolean);

        if (pdfMaterialIds.length === 0) {
          // Fallback: maybe pdf_links has url directly
          const directLinks = pdfLinks
            .filter((link: any) => link?.url)
            .map((link: any, idx: number) => ({
              id: `direct-${idx}`,
              name: link.name || `Material ${idx + 1}`,
              url: link.url
            }));
          setPdfMaterials(directLinks);
          return;
        }

        const { data, error } = await supabase
          .from('pdf_materials')
          .select('id, name, current_file_url')
          .in('id', pdfMaterialIds);

        if (error) throw error;

        setPdfMaterials((data || []).map(m => ({
          id: m.id,
          name: m.name,
          url: m.current_file_url
        })));
      } catch (err) {
        console.error('Error fetching PDF materials:', err);
        setPdfMaterials([]);
      } finally {
        setLoadingPdfs(false);
      }
    };

    fetchPdfMaterials();
  }, [open, task, pdfLinks]);

  const hasPdfResources = pdfMaterials.length > 0 || (Array.isArray(pdfLinks) && pdfLinks.length > 0);
  const hasVideoResources = Array.isArray(videoLinks) && videoLinks.length > 0;
  const hasNotebookResources = (Array.isArray(questionNotebookIds) && questionNotebookIds.length > 0) || !!topicSourceNotebookId;
  const hasFlashcardResources = Array.isArray(flashcardLinks) && flashcardLinks.length > 0;

  // Show "Questões" button if there are notebook resources OR a topic ID to fall back to
  // (handleQuestionsClick already handles fallback to banco-questoes filtered by topic)
  // Only hide for topics that truly have no question path (no notebooks AND no topic ID)
  const canShowQuestionsButton = hasNotebookResources || !!(goal?.topic_id || topic?.id || task?.source_topic_id);

  // Base params for navigation (safe even if task is null)
  const baseParams = {
    fromGoal: "true",
    cronogramaId: task?.cronograma_id || "",
    taskId: task?.id || "",
    topicId: task?.source_topic_id || topic?.id || "",
    disciplineId: discipline?.id || "",
    disciplineName: discipline?.name || "",
    topicName: topic?.name || goal?.name || "",
    schoolId: school?.id || "",
  };

  // Format duration helper
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutos`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours} hora${hours > 1 ? 's' : ''}`;
  };

  const handleQuestionsClick = useCallback(async () => {
    // FIX: Open window SYNC to avoid popup blocker, then navigate after async validation
    const newWindow = window.open('about:blank', '_blank');
    if (!newWindow) {
      toast({
        title: "Popup bloqueado",
        description: "Por favor, permita popups para abrir as questões.",
        variant: "destructive",
      });
      return;
    }

    setValidatingNotebooks(true);
    
    try {
      // Log inicial para debugging
      console.log('[GoalDetailDialog] Starting notebook validation:', {
        questionNotebookIds,
        topicSourceNotebookId,
        goalTopicId: goal?.topic_id,
        topicId: topic?.id,
        taskSourceTopicId: task?.source_topic_id
      });
      
      // Validate notebooks using the resilient validator
      // CORREÇÃO: Agora o validator também verifica se o caderno tem questões
      const validation = await validateNotebookIds(
        questionNotebookIds,
        topicSourceNotebookId
      );
      
      console.log('[GoalDetailDialog] Validation result:', validation);
      
      // FIX: Use goal.topic_id (canonical field, not study_topics.id or task.source_topic_id)
      const topicId = goal?.topic_id || topic?.id || task?.source_topic_id;
      
      if (validation.validNotebookIds.length > 0) {
        // Primary path: Use validated notebook IDs (guaranteed to have questions)
        const params = new URLSearchParams({
          notebookIds: validation.validNotebookIds.join(","),
          topicName: baseParams.topicName,
          disciplineName: baseParams.disciplineName,
          taskId: task.id,
          cronogramaId: task.cronograma_id,
          fromCronograma: "true",
        });
        // Pass targetUserId for admin viewing student's cronograma
        if (targetUserId) {
          params.set("targetUserId", targetUserId);
        }
        console.log('[GoalDetailDialog] Opening notebook with IDs:', validation.validNotebookIds);
        newWindow.location.assign(`/caderno-questoes?${params.toString()}`);
      } else if (validation.fallbackNotebookId) {
        // Fallback path: Use source_notebook_id from topic (guaranteed to have questions)
        const params = new URLSearchParams({
          notebookIds: validation.fallbackNotebookId,
          topicName: baseParams.topicName,
          disciplineName: baseParams.disciplineName,
          taskId: task.id,
          cronogramaId: task.cronograma_id,
          fromCronograma: "true",
        });
        // Pass targetUserId for admin viewing student's cronograma
        if (targetUserId) {
          params.set("targetUserId", targetUserId);
        }
        console.log('[GoalDetailDialog] Using fallback notebook:', validation.fallbackNotebookId);
        toast({
          title: "Usando caderno fonte",
          description: "O caderno específico não está disponível, abrindo o caderno base do tópico.",
        });
        newWindow.location.assign(`/caderno-questoes?${params.toString()}`);
      } else if (topicId) {
        // Ultimate fallback: Open Banco de Questões filtered by topic
        // Isso garante que mesmo sem caderno, o aluno acessa questões do tópico
        const params = new URLSearchParams({
          ...baseParams,
          filterByTopic: "true",
          topicId: topicId,
          fromCronograma: "true",
        });
        // Pass targetUserId for admin viewing student's cronograma
        if (targetUserId) {
          params.set("targetUserId", targetUserId);
        }
        console.log('[GoalDetailDialog] No valid notebooks, falling back to Banco de Questões for topic:', topicId);
        toast({
          title: "Abrindo banco de questões",
          description: "Nenhum caderno com questões disponível. Abrindo o banco de questões filtrado pelo tópico.",
        });
        newWindow.location.assign(`/banco-questoes?${params.toString()}`);
      } else {
        // No topic ID available - open general question bank
        console.warn('[GoalDetailDialog] No topic ID available, opening general banco-questoes');
        toast({
          title: "Caderno indisponível",
          description: "Não foi possível identificar as questões para este tópico.",
          variant: "destructive",
        });
        newWindow.location.assign(`/banco-questoes?fromCronograma=true`);
      }
    } catch (error) {
      console.error('[GoalDetailDialog] Error validating notebooks:', error);
      // On error, fall back to banco-questoes filtered by topic if possible
      const topicId = goal?.topic_id || topic?.id || task?.source_topic_id;
      const params = new URLSearchParams({
        ...baseParams,
        filterByTopic: topicId ? "true" : "false",
        topicId: topicId || "",
        fromCronograma: "true",
      });
      newWindow.location.assign(`/banco-questoes?${params.toString()}`);
    } finally {
      setValidatingNotebooks(false);
    }
  }, [questionNotebookIds, topicSourceNotebookId, task, topic, goal, baseParams]);

  const handleFlashcardsClick = () => {
    const params = new URLSearchParams({
      ...baseParams,
      autoStart: "true",
      filterByTopic: "true",
    });
    if (hasFlashcardResources) {
      params.set("deckIds", flashcardLinks.join(","));
    }
    window.open(`/flashcards?${params.toString()}`, '_blank');
  };

  const handleRoboTutorClick = () => {
    const params = new URLSearchParams({
      ...baseParams,
      filterByTopic: "true",
      fromCronograma: "true",
    });
    window.open(`/tutor?${params.toString()}`, '_blank');
  };

  const handleMaterialClick = (materialId: string, taskId: string) => {
    // Navigate to the internal PDF viewer with task context - opens in new tab
    window.open(`/cronograma/material/${materialId}?taskId=${taskId}&fromCronograma=true`, '_blank');
  };

  const handleVideoClick = (url: string) => {
    window.open(url, '_blank');
  };

  const handleToggle = () => {
    if (!task) return;
    onToggleComplete(task.id, task.is_completed);
    if (!task.is_completed) {
      onOpenChange(false);
    }
  };

  // Early return AFTER all hooks are declared
  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto p-6 overflow-hidden">
        <DialogHeader className="pr-6">
          <div className="flex items-start gap-3">
            <div className={cn("p-2 rounded-lg flex-shrink-0", typeConfig.color)}>
              <TypeIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <DialogTitle className="text-lg mb-1 leading-tight break-words">
                {goal?.name || topic?.name || "Tarefa de estudo"}
              </DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {discipline && (
                  <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                    {discipline.name}
                  </span>
                )}
                <Badge variant="outline" className={cn("text-xs flex-shrink-0", typeConfig.color)}>
                  {isRevision ? `Revisão ${task.revision_number}` : typeConfig.label}
                </Badge>
                {task.total_parts && task.total_parts > 1 && (
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    Parte {task.part_number}/{task.total_parts}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          {/* Status and Duration */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {task.is_completed ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-green-500" />
              ) : (
                <Circle className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
              )}
              <span className={cn(
                "font-medium",
                task.is_completed ? "text-green-600" : "text-muted-foreground"
              )}>
                {task.is_completed ? "Concluída" : "Pendente"}
              </span>
              {task.is_completed && task.completed_at && (
                <span className="text-xs text-muted-foreground">
                  às {format(new Date(task.completed_at), "HH:mm", { locale: ptBR })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
              <Clock className="w-4 h-4" />
              <span className="text-sm whitespace-nowrap">{formatDuration(task.duration_minutes)}</span>
            </div>
          </div>

          {/* Description */}
          {goal?.description && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Descrição</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {goal.description}
              </p>
            </div>
          )}

          {/* Resources */}
          {!hideResources && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Recursos de Estudo</h4>
                <span className="text-xs text-muted-foreground">(abre em nova aba)</span>
              </div>
              
              <div className="flex flex-col gap-2">
                {/* Banco de Questões - show if school allows AND there's any question path (notebooks or topic fallback) */}
                {hasBancoQuestoes && canShowQuestionsButton && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 w-full"
                    onClick={handleQuestionsClick}
                    disabled={validatingNotebooks}
                  >
                    {validatingNotebooks ? (
                      <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
                    ) : (
                      <HelpCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="flex-1 text-left">
                      {validatingNotebooks ? "Validando..." : "Questões"}
                    </span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                  </Button>
                )}

                {/* Flashcards - Em breve */}
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start gap-2 w-full opacity-60 cursor-not-allowed"
                  disabled
                >
                  <Lightbulb className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">Flashcards</span>
                  <span className="text-xs text-muted-foreground">(em breve)</span>
                </Button>

                {/* Robô Tutor */}
                {hasRoboTutor && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 w-full"
                    onClick={handleRoboTutorClick}
                  >
                    <Bot className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left">Robô Tutor</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                  </Button>
                )}
              </div>

              {/* PDFs/Materials */}
              {hasMaterials && hasPdfResources && (
                <div className="space-y-2">
                  <h5 className="text-xs font-medium text-muted-foreground uppercase">Materiais</h5>
                  <div className="space-y-1">
                    {loadingPdfs ? (
                      <div className="flex items-center gap-2 py-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Carregando materiais...</span>
                      </div>
                    ) : pdfMaterials.length > 0 ? (
                      pdfMaterials.map((pdf) => (
                        <Button
                          key={pdf.id}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2 h-auto py-2 text-left"
                          onClick={() => handleMaterialClick(pdf.id, task.id)}
                        >
                          <FileText className="w-4 h-4 flex-shrink-0 text-red-500" />
                          <span className="truncate flex-1 min-w-0">{pdf.name}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                        </Button>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground py-2">Nenhum material encontrado</p>
                    )}
                  </div>
                </div>
              )}

              {/* Videos */}
              {hasVideos && hasVideoResources && (
                <div className="space-y-2">
                  <h5 className="text-xs font-medium text-muted-foreground uppercase">Vídeos</h5>
                  <div className="space-y-1">
                    {videoLinks.map((video: any, idx: number) => (
                      <Button
                        key={idx}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2 h-auto py-2"
                        onClick={() => handleVideoClick(video.url || video)}
                      >
                        <Video className="w-4 h-4 text-purple-500" />
                        <span className="truncate">{video.name || `Vídeo ${idx + 1}`}</span>
                        <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Button */}
        <Button
          onClick={handleToggle}
          className={cn(
            "w-full gap-2",
            task.is_completed 
              ? "bg-muted text-muted-foreground hover:bg-muted/80" 
              : "bg-green-600 hover:bg-green-700 text-white"
          )}
        >
          {task.is_completed ? (
            <>
              <Undo2 className="w-4 h-4" />
              Reabrir Tarefa
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Marcar como Concluída
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
