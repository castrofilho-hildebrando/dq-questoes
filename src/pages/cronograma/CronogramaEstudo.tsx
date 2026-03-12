import ConselhoThemeWrapper from "@/components/ConselhoThemeWrapper";
import { useState, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, ArrowLeft, Clock, CheckCircle2,
  RefreshCw, Sparkles, CalendarDays, List, RotateCcw, Lock
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, addDays, subDays, isToday, isBefore, isAfter, startOfMonth, endOfMonth, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCronogramaTaskGenerator } from "@/hooks/useCronogramaTaskGenerator";
import { useCreateRevisionCronograma } from "@/hooks/useCreateRevisionCronograma";
import { CronogramaMonthlyCalendar } from "@/components/cronograma/CronogramaMonthlyCalendar";
import { GoalDetailDialog } from "@/components/cronograma/GoalDetailDialog";
import { WeekCalendar } from "@/components/cronograma/WeekCalendar";
import { TaskCard } from "@/components/cronograma/TaskCard";
import { TasksExcludedDialog } from "@/components/cronograma/TasksExcludedDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

interface Cronograma {
  id: string;
  name: string;
  school_id: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  needs_recalc?: boolean;
  recalc_reason?: string | null;
  recalc_pending_since?: string | null;
  is_frozen?: boolean;
  cronograma_type?: string;
  schools?: {
    id: string;
    name: string;
    has_flashcards?: boolean;
    has_robo_tutor?: boolean;
    has_banco_questoes?: boolean;
    has_materials?: boolean;
    has_videos?: boolean;
  };
}

export default function CronogramaEstudo() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { fromSuffix } = useBackNavigation();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<"day" | "calendar">("day");
  const { generateTasks, recalculateTasks } = useCronogramaTaskGenerator();
  const { createRevisionCronograma, isCreating: isCreatingRevision } = useCreateRevisionCronograma();

  // State for goal detail dialog
  const [selectedTask, setSelectedTask] = useState<CronogramaTask | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // State for tasks excluded dialog
  const [excludedDialogOpen, setExcludedDialogOpen] = useState(false);
  const [excludedDialogData, setExcludedDialogData] = useState<{
    tasksCreated: number;
    tasksExcluded: number;
    minutesExcluded: number;
  } | null>(null);

  // Fetch cronograma details
  const { data: cronograma, isLoading: loadingCronograma } = useQuery({
    queryKey: ["cronograma", id],
    queryFn: async (): Promise<Cronograma | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("user_cronogramas")
        .select(`*, schools (id, name, has_flashcards, has_robo_tutor, has_banco_questoes, has_materials, has_videos)`)
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return {
        ...data,
        needs_recalc: data.needs_recalc ?? false,
        recalc_reason: data.recalc_reason ?? null,
        recalc_pending_since: data.recalc_pending_since ?? null,
        is_frozen: (data as any).is_frozen ?? false,
        cronograma_type: (data as any).cronograma_type ?? 'normal',
      } as Cronograma;
    },
    enabled: !!id,
    refetchInterval: 5 * 60 * 1000, // 5 min - propagate admin changes
  });

  // Fetch tasks for selected date
  const { data: tasks, isLoading: loadingTasks } = useQuery({
    queryKey: ["cronograma-tasks", id, format(selectedDate, "yyyy-MM-dd")],
    queryFn: async (): Promise<CronogramaTask[]> => {
      if (!id || !user?.id) return [];
      
      const { data, error } = await supabase
        .from("user_cronograma_tasks")
        .select(`
          *,
          topic_goals (
            id, name, description, goal_type, duration_minutes, topic_id,
            video_links, pdf_links, flashcard_links, question_notebook_ids,
            study_topics (
              id, name, source_notebook_id,
              study_disciplines (id, name)
            )
          ),
          study_topics (
            id, name, source_notebook_id,
            study_disciplines (id, name)
          )
        `)
        .eq("cronograma_id", id)
        .eq("user_id", user.id)
        .eq("scheduled_date", format(selectedDate, "yyyy-MM-dd"))
        .order("start_time", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return (data as CronogramaTask[]) || [];
    },
    enabled: !!id && !!user?.id,
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch all tasks for the month (for calendar view)
  const { data: monthTasks } = useQuery({
    queryKey: ["cronograma-month-tasks", id, format(calendarMonth, "yyyy-MM")],
    queryFn: async (): Promise<CronogramaTask[]> => {
      if (!id || !user?.id) return [];
      
      const monthStart = format(startOfMonth(calendarMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(calendarMonth), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("user_cronograma_tasks")
        .select(`
          *,
          topic_goals (
            id, name, description, goal_type, duration_minutes, topic_id,
            video_links, pdf_links, flashcard_links, question_notebook_ids,
            study_topics (
              id, name, source_notebook_id,
              study_disciplines (id, name)
            )
          ),
          study_topics (
            id, name, source_notebook_id,
            study_disciplines (id, name)
          )
        `)
        .eq("cronograma_id", id)
        .eq("user_id", user.id)
        .gte("scheduled_date", monthStart)
        .lte("scheduled_date", monthEnd)
        .order("scheduled_date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: false });
      
      if (error) throw error;
      return (data as CronogramaTask[]) || [];
    },
    enabled: !!id && !!user?.id,
    refetchInterval: 5 * 60 * 1000,
  });
  // Fetch ALL tasks for the cronograma (for 100% completion check)
  const { data: allCronogramaTasks } = useQuery({
    queryKey: ["cronograma-all-tasks-count", id],
    queryFn: async () => {
      if (!id || !user?.id) return { total: 0, completed: 0 };
      const { data, error } = await supabase
        .from("user_cronograma_tasks")
        .select("is_completed")
        .eq("cronograma_id", id)
        .eq("user_id", user.id);
      if (error) throw error;
      const total = data?.length || 0;
      const completed = data?.filter(t => t.is_completed).length || 0;
      return { total, completed };
    },
    enabled: !!id && !!user?.id,
    refetchInterval: 5 * 60 * 1000,
  });

  const isFullyCompleted = (allCronogramaTasks?.total || 0) > 0 && 
    allCronogramaTasks?.completed === allCronogramaTasks?.total;
  const isFrozen = cronograma?.is_frozen === true;
  const isRevisionOnly = cronograma?.cronograma_type === 'revision_only';

  // Toggle task completion
  const toggleMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      const { error } = await supabase
        .from("user_cronograma_tasks")
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cronograma-tasks", id] });
      queryClient.invalidateQueries({ queryKey: ["cronograma-month-tasks", id] });
      queryClient.invalidateQueries({ queryKey: ["today-tasks"] });
    },
    onError: () => {
      toast.error("Erro ao atualizar tarefa");
    },
  });

  // Reorder task mutation (change date)
  const reorderMutation = useMutation({
    mutationFn: async ({ taskId, newDate }: { taskId: string; newDate: string }) => {
      const { error } = await supabase
        .from("user_cronograma_tasks")
        .update({
          scheduled_date: newDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cronograma-tasks", id] });
      queryClient.invalidateQueries({ queryKey: ["cronograma-month-tasks", id] });
      queryClient.invalidateQueries({ queryKey: ["today-tasks"] });
      toast.success("Tarefa movida com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao mover tarefa");
    },
  });

  const handleToggleTask = (taskId: string, currentStatus: boolean) => {
    toggleMutation.mutate({ taskId, isCompleted: !currentStatus });
  };

  const handleTaskClick = (task: CronogramaTask) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  const handleDialogToggleComplete = (taskId: string, isCompleted: boolean) => {
    toggleMutation.mutate({ taskId, isCompleted: !isCompleted });
  };

  const goToToday = () => setSelectedDate(new Date());

  // Gerar/Recalcular tarefas
  const handleGenerateTasks = async () => {
    if (!cronograma || !user?.id) return;
    
    setIsGenerating(true);
    toast.info("Gerando tarefas do cronograma...");
    
    try {
      const result = await generateTasks({
        id: cronograma.id,
        user_id: user.id,
        school_id: cronograma.school_id,
        start_date: cronograma.start_date,
        end_date: cronograma.end_date,
        available_days: (cronograma as any).available_days || [],
        hours_per_day: (cronograma as any).hours_per_day || 4,
        selected_disciplines: (cronograma as any).selected_disciplines || [],
        hours_per_weekday: (cronograma as any).hours_per_weekday || {},
        discipline_order: (cronograma as any).discipline_order || [],
        selected_topics: (cronograma as any).selected_topics || {},
        topic_order: (cronograma as any).topic_order || {},
      });
      
      if (result.success) {
        if (result.tasksExcluded && result.tasksExcluded > 0 && result.minutesExcluded) {
          // Show dialog with excluded tasks info
          setExcludedDialogData({
            tasksCreated: result.tasksCreated,
            tasksExcluded: result.tasksExcluded,
            minutesExcluded: result.minutesExcluded,
          });
          setExcludedDialogOpen(true);
        } else {
          toast.success(`${result.tasksCreated} tarefas criadas com sucesso!`);
        }
        queryClient.invalidateQueries({ queryKey: ["cronograma-tasks", id] });
        queryClient.invalidateQueries({ queryKey: ["cronograma-month-tasks", id] });
      } else {
        toast.error(result.error || "Não foi possível gerar as tarefas");
      }
    } catch (err) {
      console.error("Error generating tasks:", err);
      toast.error("Erro ao gerar tarefas do cronograma");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRecalculateTasks = async () => {
    if (!cronograma || !user?.id) return;
    
    setIsGenerating(true);
    
    toast.info("Aplicando atualizações ao cronograma...");
    
    try {
      const result = await recalculateTasks({
        id: cronograma.id,
        user_id: user.id,
        school_id: cronograma.school_id,
        start_date: cronograma.start_date,
        end_date: cronograma.end_date,
        available_days: (cronograma as any).available_days || [],
        hours_per_day: (cronograma as any).hours_per_day || 4,
        selected_disciplines: (cronograma as any).selected_disciplines || [],
        hours_per_weekday: (cronograma as any).hours_per_weekday || {},
        discipline_order: (cronograma as any).discipline_order || [],
        selected_topics: (cronograma as any).selected_topics || {},
        topic_order: (cronograma as any).topic_order || {},
      });
      
      if (result.success) {
        // Limpar o flag de recálculo
        await supabase.rpc('clear_recalc_flag', { p_cronograma_id: cronograma.id });
        
        if (result.tasksExcluded && result.tasksExcluded > 0 && result.minutesExcluded) {
          setExcludedDialogData({
            tasksCreated: result.tasksCreated,
            tasksExcluded: result.tasksExcluded,
            minutesExcluded: result.minutesExcluded,
          });
          setExcludedDialogOpen(true);
        } else {
          toast.success(`Cronograma atualizado! ${result.tasksCreated} tarefas reorganizadas.`);
        }
        
        // Invalidar queries para refletir o novo estado
        queryClient.invalidateQueries({ queryKey: ["cronograma", id] });
        queryClient.invalidateQueries({ queryKey: ["cronograma-tasks", id] });
        queryClient.invalidateQueries({ queryKey: ["cronograma-month-tasks", id] });
      } else {
        toast.error(result.error || "Não foi possível atualizar o cronograma");
      }
    } catch (err) {
      console.error("Error recalculating tasks:", err);
      toast.error("Erro ao atualizar cronograma");
    } finally {
      setIsGenerating(false);
    }
  };

  // Criar cronograma de revisão
  const handleCreateRevisionCronograma = async () => {
    if (!cronograma || !user?.id) return;

    toast.info("Criando cronograma de revisão...");

    const result = await createRevisionCronograma(cronograma.id, user.id);

    if (result.success && result.newCronogramaId) {
      toast.success(`Cronograma de revisão criado com ${result.tasksCreated} tarefas!`);
      queryClient.invalidateQueries({ queryKey: ["cronograma", id] });
      queryClient.invalidateQueries({ queryKey: ["user-cronogramas"] });
      navigate(`/cronograma/${result.newCronogramaId}${fromSuffix}`);
    } else {
      toast.error(result.error || "Erro ao criar cronograma de revisão");
    }
  };

  const completedTasks = tasks?.filter(t => t.is_completed).length || 0;
  const totalTasks = tasks?.length || 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const totalMinutes = tasks?.reduce((sum, t) => sum + t.duration_minutes, 0) || 0;
  const completedMinutes = tasks?.filter(t => t.is_completed).reduce((sum, t) => sum + t.duration_minutes, 0) || 0;

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  // Week navigation
  const goToPreviousWeek = () => setSelectedDate(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setSelectedDate(prev => addWeeks(prev, 1));

  // Task counts by date for the week calendar
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (monthTasks || []).forEach(task => {
      const key = task.scheduled_date;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [monthTasks]);

  // Ordenação estável no front (created_at costuma empatar quando o gerador cria tudo de uma vez)
  const sortedTasks = useMemo(() => {
    if (!tasks) return [];

    const disciplineOrder =
      ((cronograma as any)?.discipline_order as string[] | null) ||
      ((cronograma as any)?.selected_disciplines as string[] | null) ||
      [];

    const topicOrder = (((cronograma as any)?.topic_order as any) || {}) as Record<string, string[]>;

    const getDiscIndex = (disciplineId?: string | null) => {
      if (!disciplineId) return 999;
      const idx = disciplineOrder.indexOf(disciplineId);
      return idx === -1 ? 999 : idx;
    };

    const getTopicIndex = (disciplineId?: string | null, topicId?: string | null) => {
      if (!disciplineId || !topicId) return 999;
      const list = topicOrder[disciplineId] || [];
      if (list.length === 0) return 999;
      const idx = list.indexOf(topicId);
      return idx === -1 ? 999 : idx;
    };

    return [...tasks].sort((a, b) => {
      // 1) Revisões por último
      const aIsRev = a.is_revision === true;
      const bIsRev = b.is_revision === true;
      if (aIsRev !== bIsRev) return aIsRev ? 1 : -1;

      // 2) Ordenar por goal_type: pdf/study primeiro, depois questions
      const goalTypeOrder = (type: string | null | undefined) => {
        if (type === 'pdf' || type === 'pdf_study' || type === 'study') return 0;
        if (type === 'questions') return 1;
        return 0; // default to study-like
      };
      const aGoalType = a.topic_goals?.goal_type;
      const bGoalType = b.topic_goals?.goal_type;
      const goalTypeCmp = goalTypeOrder(aGoalType) - goalTypeOrder(bGoalType);
      if (goalTypeCmp !== 0) return goalTypeCmp;

      // 3) Ordenar por disciplina
      const aTopic = a.topic_goals?.study_topics || a.study_topics;
      const bTopic = b.topic_goals?.study_topics || b.study_topics;
      const aDiscId = aTopic?.study_disciplines?.id || null;
      const bDiscId = bTopic?.study_disciplines?.id || null;
      const aTopicId = aTopic?.id || a.source_topic_id;
      const bTopicId = bTopic?.id || b.source_topic_id;

      const discCmp = getDiscIndex(aDiscId) - getDiscIndex(bDiscId);
      if (discCmp !== 0) return discCmp;

      // 4) Ordenar por tópico
      const topicCmp = getTopicIndex(aDiscId, aTopicId) - getTopicIndex(bDiscId, bTopicId);
      if (topicCmp !== 0) return topicCmp;

      // 5) Ordenar por parte
      const partA = a.part_number ?? 0;
      const partB = b.part_number ?? 0;
      if (partA !== partB) return partA - partB;

      return (a.topic_goals?.name || aTopic?.name || '').localeCompare(b.topic_goals?.name || bTopic?.name || '');
    });
  }, [tasks, cronograma]);

  if (authLoading || loadingCronograma) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (!cronograma) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Cronograma não encontrado</p>
        <Button onClick={() => navigate(`/cronograma${fromSuffix}`)}>Voltar</Button>
      </div>
    );
  }

  return (
    <ConselhoThemeWrapper>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(`/cronograma${fromSuffix}`)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
               <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-heading text-xl font-bold">{cronograma.name}</h1>
                  {isFrozen && (
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="w-3 h-3" />
                      Concluído
                    </Badge>
                  )}
                  {isRevisionOnly && (
                    <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                      <RotateCcw className="w-3 h-3" />
                      Revisão
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{cronograma.schools?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <TooltipProvider>
                <div className="flex items-center border rounded-lg p-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant={viewMode === "day" ? "default" : "ghost"} 
                        size="sm"
                        onClick={() => setViewMode("day")}
                        className="h-8"
                      >
                        <List className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Vista diária</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant={viewMode === "calendar" ? "default" : "ghost"} 
                        size="sm"
                        onClick={() => setViewMode("calendar")}
                        className="h-8"
                      >
                        <CalendarDays className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Calendário mensal</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>

              {/* Botão de Recalcular - oculto se congelado */}
              {!isFrozen && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant={cronograma?.needs_recalc ? "default" : "outline"}
                        size="sm" 
                        onClick={handleRecalculateTasks}
                        disabled={isGenerating || isCreatingRevision}
                        className={cn(
                          "hidden sm:flex",
                          cronograma?.needs_recalc && "bg-amber-600 hover:bg-amber-700 text-white animate-pulse"
                        )}
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        {cronograma?.needs_recalc ? "Atualizar Cronograma" : "Recalcular"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {cronograma?.needs_recalc ? (
                        <>
                          <p className="font-semibold">Atualizações disponíveis!</p>
                          <p className="text-xs text-muted-foreground">
                            {cronograma.recalc_reason || 'Novas metas ou revisões foram configuradas.'}
                          </p>
                          <p className="text-xs text-amber-500 mt-1">
                            ⚠️ Tarefas pendentes serão reorganizadas
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold">Recalcular cronograma</p>
                          <p className="text-xs text-muted-foreground">
                            Reorganiza tarefas pendentes a partir de hoje.
                          </p>
                        </>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Botão Gerar Revisão - aparece quando 100% concluído e tipo normal */}
              {isFullyCompleted && !isFrozen && !isRevisionOnly && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="default"
                        size="sm" 
                        onClick={handleCreateRevisionCronograma}
                        disabled={isCreatingRevision || isGenerating}
                        className="hidden sm:flex"
                      >
                        {isCreatingRevision ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4 mr-2" />
                        )}
                        Gerar Revisão
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold">Gerar cronograma de revisão</p>
                      <p className="text-xs text-muted-foreground">
                        Cria um novo cronograma apenas com as revisões configuradas, distribuídas na sua carga horária.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        O cronograma atual será congelado como histórico.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="container mx-auto px-6 py-6">
          <CronogramaMonthlyCalendar
            tasks={monthTasks || []}
            selectedDate={selectedDate}
            currentMonth={calendarMonth}
            onMonthChange={setCalendarMonth}
            onDateSelect={(date) => {
              setSelectedDate(date);
              setViewMode("day");
            }}
          />
        </div>
      )}

      {/* Day View with Week Calendar */}
      {viewMode === "day" && (
        <>
          {/* Week Calendar Navigation */}
          <div className="border-b border-border bg-card/50">
            <div className="container mx-auto px-6 py-4">
              <WeekCalendar
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onPreviousWeek={goToPreviousWeek}
                onNextWeek={goToNextWeek}
                onToday={goToToday}
                taskCounts={taskCounts}
              />
            </div>
          </div>

          {/* Selected Day Header */}
          <div className="container mx-auto px-6 pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold capitalize">
                  {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </h2>
                {isToday(selectedDate) && (
                  <Badge className="bg-primary text-primary-foreground">Hoje</Badge>
                )}
                {isBefore(selectedDate, new Date()) && !isToday(selectedDate) && (
                  <Badge variant="outline" className="text-muted-foreground">Passado</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Progress Summary */}
          {totalTasks > 0 && (
            <div className="container mx-auto px-6 py-3">
              <Card className="bg-card/50">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Progresso do dia</span>
                    </div>
                    <span className="text-sm font-semibold text-primary">{progressPercent}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-2 mb-3" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{completedTasks} de {totalTasks} tarefas concluídas</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(completedMinutes)} / {formatDuration(totalMinutes)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tasks List */}
          <main className="container mx-auto px-6 py-4 pb-8">
            {loadingTasks ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : sortedTasks.length > 0 ? (
              <AnimatePresence mode="popLayout">
                <div className="space-y-3">
                  {sortedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => handleTaskClick(task)}
                      onToggle={() => handleToggleTask(task.id, task.is_completed)}
                    />
                  ))}
                </div>
              </AnimatePresence>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium mb-2">Nenhuma tarefa para este dia</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                  {isToday(selectedDate) 
                    ? "Você não tem tarefas agendadas para hoje. Gere as tarefas do seu cronograma!"
                    : isBefore(selectedDate, new Date())
                      ? "Este dia não tinha tarefas agendadas."
                      : "Ainda não há tarefas programadas para este dia."
                  }
                </p>
                {isToday(selectedDate) && (
                  <Button 
                    onClick={handleGenerateTasks} 
                    disabled={isGenerating}
                    className="gap-2"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Gerar Tarefas do Cronograma
                  </Button>
                )}
              </motion.div>
            )}
          </main>
        </>
      )}

      {/* Goal Detail Dialog */}
      <GoalDetailDialog
        task={selectedTask}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onToggleComplete={handleDialogToggleComplete}
        school={cronograma?.schools}
      />

      {/* Tasks Excluded Dialog */}
      <TasksExcludedDialog
        open={excludedDialogOpen}
        onOpenChange={setExcludedDialogOpen}
        tasksCreated={excludedDialogData?.tasksCreated || 0}
        tasksExcluded={excludedDialogData?.tasksExcluded || 0}
        minutesExcluded={excludedDialogData?.minutesExcluded || 0}
        onContinue={() => setExcludedDialogOpen(false)}
        onAdjustSettings={() => navigate(`/cronograma/${id}/configurar${fromSuffix}`)}
      />
    </div>
    </ConselhoThemeWrapper>
  );
}
