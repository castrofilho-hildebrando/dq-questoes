import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, ArrowLeft, Clock, CheckCircle2,
  CalendarDays, List, RefreshCw, Plus
} from "lucide-react";
import { useCronogramaTaskGenerator } from "@/hooks/useCronogramaTaskGenerator";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CronogramaMonthlyCalendar } from "@/components/cronograma/CronogramaMonthlyCalendar";
import { GoalDetailDialog } from "@/components/cronograma/GoalDetailDialog";
import { WeekCalendar } from "@/components/cronograma/WeekCalendar";
import { TaskCard } from "@/components/cronograma/TaskCard";

interface AdminCronogramaViewerProps {
  cronogramaId: string;
  userId: string;
  onBack: () => void;
}

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
    topic_id?: string;
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
  discipline_order?: string[];
  selected_disciplines?: string[];
  topic_order?: Record<string, string[]>;
  available_days?: string[];
  hours_per_day?: number;
  hours_per_weekday?: Record<string, number>;
  selected_topics?: Record<string, string[]>;
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

export function AdminCronogramaViewer({ cronogramaId, userId, onBack }: AdminCronogramaViewerProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [viewMode, setViewMode] = useState<"day" | "calendar">("day");
  const [selectedTask, setSelectedTask] = useState<CronogramaTask | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isRecalculatingIncremental, setIsRecalculatingIncremental] = useState(false);
  
  const { recalculateTasks, recalculateTasksIncremental } = useCronogramaTaskGenerator();
  const queryClient = useQueryClient();

  const handleToggleComplete = useCallback(async (taskId: string, isCompleted: boolean) => {
    const newStatus = !isCompleted;
    const { error } = await supabase
      .from("user_cronograma_tasks")
      .update({
        is_completed: newStatus,
        completed_at: newStatus ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);
    
    if (error) {
      toast.error("Erro ao atualizar tarefa");
      return;
    }
    
    queryClient.invalidateQueries({ queryKey: ["admin-cronograma-tasks", cronogramaId] });
    queryClient.invalidateQueries({ queryKey: ["admin-cronograma-month-tasks", cronogramaId] });
    toast.success(newStatus ? "Tarefa concluída!" : "Tarefa reaberta!");
    if (newStatus) setDialogOpen(false);
  }, [cronogramaId, queryClient]);

  // Fetch cronograma details
  const { data: cronograma, isLoading: loadingCronograma } = useQuery({
    queryKey: ["admin-cronograma", cronogramaId],
    queryFn: async (): Promise<Cronograma | null> => {
      const { data, error } = await supabase
        .from("user_cronogramas")
        .select(`*, schools (id, name, has_flashcards, has_robo_tutor, has_banco_questoes, has_materials, has_videos)`)
        .eq("id", cronogramaId)
        .single();
      
      if (error) throw error;
      return data as Cronograma;
    },
  });

  // Fetch tasks for selected date
  const { data: tasks, isLoading: loadingTasks } = useQuery({
    queryKey: ["admin-cronograma-tasks", cronogramaId, format(selectedDate, "yyyy-MM-dd")],
    queryFn: async (): Promise<CronogramaTask[]> => {
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
        .eq("cronograma_id", cronogramaId)
        .eq("user_id", userId)
        .eq("scheduled_date", format(selectedDate, "yyyy-MM-dd"))
        .order("start_time", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return (data as CronogramaTask[]) || [];
    },
  });

  // Fetch all tasks for the month (for calendar view)
  const { data: monthTasks } = useQuery({
    queryKey: ["admin-cronograma-month-tasks", cronogramaId, format(calendarMonth, "yyyy-MM")],
    queryFn: async (): Promise<CronogramaTask[]> => {
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
        .eq("cronograma_id", cronogramaId)
        .eq("user_id", userId)
        .gte("scheduled_date", monthStart)
        .lte("scheduled_date", monthEnd)
        .order("scheduled_date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: false });
      
      if (error) throw error;
      return (data as CronogramaTask[]) || [];
    },
  });

  const handleTaskClick = (task: CronogramaTask) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  const goToToday = () => setSelectedDate(new Date());
  const goToPreviousWeek = () => setSelectedDate(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setSelectedDate(prev => addWeeks(prev, 1));

  // Recalculate tasks (full)
  const handleRecalculateTasks = async () => {
    if (!cronograma) return;
    
    setIsRecalculating(true);
    
    try {
      const result = await recalculateTasks({
        id: cronograma.id,
        user_id: userId,
        school_id: cronograma.school_id,
        start_date: cronograma.start_date,
        end_date: cronograma.end_date || undefined,
        selected_disciplines: cronograma.selected_disciplines || [],
        discipline_order: cronograma.discipline_order || cronograma.selected_disciplines || [],
        topic_order: (cronograma.topic_order || {}) as Record<string, string[]>,
        available_days: cronograma.available_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        hours_per_day: cronograma.hours_per_day || 2,
        hours_per_weekday: cronograma.hours_per_weekday,
        selected_topics: cronograma.selected_topics,
      });
      
      if (result.success) {
        toast.success(`Cronograma recalculado: ${result.tasksCreated} tarefas geradas`);
        queryClient.invalidateQueries({ queryKey: ["admin-cronograma-tasks", cronogramaId] });
        queryClient.invalidateQueries({ queryKey: ["admin-cronograma-month-tasks", cronogramaId] });
      } else {
        toast.error(result.error || "Não foi possível recalcular as tarefas");
      }
    } catch (err) {
      console.error("Error recalculating tasks:", err);
      toast.error("Erro ao recalcular tarefas");
    } finally {
      setIsRecalculating(false);
    }
  };

  // Recalculate tasks (incremental - preserves existing tasks)
  const handleRecalculateIncremental = async () => {
    if (!cronograma) return;
    
    setIsRecalculatingIncremental(true);
    
    try {
      const result = await recalculateTasksIncremental({
        id: cronograma.id,
        user_id: userId,
        school_id: cronograma.school_id,
        start_date: cronograma.start_date,
        end_date: cronograma.end_date || undefined,
        selected_disciplines: cronograma.selected_disciplines || [],
        discipline_order: cronograma.discipline_order || cronograma.selected_disciplines || [],
        topic_order: (cronograma.topic_order || {}) as Record<string, string[]>,
        available_days: cronograma.available_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        hours_per_day: cronograma.hours_per_day || 2,
        hours_per_weekday: cronograma.hours_per_weekday,
        selected_topics: cronograma.selected_topics,
      });
      
      if (result.success) {
        toast.success(`Recálculo incremental: ${result.tasksCreated} tarefas adicionadas`);
        queryClient.invalidateQueries({ queryKey: ["admin-cronograma-tasks", cronogramaId] });
        queryClient.invalidateQueries({ queryKey: ["admin-cronograma-month-tasks", cronogramaId] });
      } else {
        toast.error(result.error || "Não foi possível realizar recálculo incremental");
      }
    } catch (err) {
      console.error("Error in incremental recalculation:", err);
      toast.error("Erro no recálculo incremental");
    } finally {
      setIsRecalculatingIncremental(false);
    }
  };

  // Task counts by date for the week calendar
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (monthTasks || []).forEach(task => {
      const key = task.scheduled_date;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [monthTasks]);

  // Sorting logic (same as student view)
  const sortedTasks = useMemo(() => {
    if (!tasks) return [];

    const disciplineOrder = cronograma?.discipline_order || cronograma?.selected_disciplines || [];
    const topicOrder = (cronograma?.topic_order || {}) as Record<string, string[]>;

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
      const aIsRev = a.is_revision === true;
      const bIsRev = b.is_revision === true;
      if (aIsRev !== bIsRev) return aIsRev ? 1 : -1;

      const goalTypeOrder = (type: string | null | undefined) => {
        if (type === 'pdf' || type === 'pdf_study' || type === 'study') return 0;
        if (type === 'questions') return 1;
        return 0;
      };
      const aGoalType = a.topic_goals?.goal_type;
      const bGoalType = b.topic_goals?.goal_type;
      const goalTypeCmp = goalTypeOrder(aGoalType) - goalTypeOrder(bGoalType);
      if (goalTypeCmp !== 0) return goalTypeCmp;

      const aTopic = a.topic_goals?.study_topics || a.study_topics;
      const bTopic = b.topic_goals?.study_topics || b.study_topics;
      const aDiscId = aTopic?.study_disciplines?.id || null;
      const bDiscId = bTopic?.study_disciplines?.id || null;
      const aTopicId = aTopic?.id || a.source_topic_id;
      const bTopicId = bTopic?.id || b.source_topic_id;

      const discCmp = getDiscIndex(aDiscId) - getDiscIndex(bDiscId);
      if (discCmp !== 0) return discCmp;

      const topicCmp = getTopicIndex(aDiscId, aTopicId) - getTopicIndex(bDiscId, bTopicId);
      if (topicCmp !== 0) return topicCmp;

      const partA = a.part_number ?? 0;
      const partB = b.part_number ?? 0;
      if (partA !== partB) return partA - partB;

      return (a.topic_goals?.name || aTopic?.name || '').localeCompare(b.topic_goals?.name || bTopic?.name || '');
    });
  }, [tasks, cronograma]);

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

  if (loadingCronograma) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cronograma) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Cronograma não encontrado</p>
        <Button onClick={onBack}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{cronograma.name}</h2>
            <p className="text-sm text-muted-foreground">
              {cronograma.schools?.name} • Visualização do aluno
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleRecalculateIncremental}
            disabled={isRecalculatingIncremental || isRecalculating}
            title="Adiciona tasks faltantes sem deletar as existentes"
          >
            {isRecalculatingIncremental ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Incremental
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculateTasks}
            disabled={isRecalculating || isRecalculatingIncremental}
            title="Recalcula todo o cronograma (preserva completadas)"
          >
            {isRecalculating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Recalcular
          </Button>
          <div className="flex bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === "day" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("day")}
              className="gap-1"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Dia</span>
            </Button>
            <Button
              variant={viewMode === "calendar" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className="gap-1"
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Mês</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === "calendar" ? (
        <CronogramaMonthlyCalendar
          tasks={monthTasks || []}
          selectedDate={selectedDate}
          currentMonth={calendarMonth}
          onMonthChange={setCalendarMonth}
          onDateSelect={setSelectedDate}
        />
      ) : (
        <>
          {/* Week Calendar */}
          <WeekCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPreviousWeek={goToPreviousWeek}
            onNextWeek={goToNextWeek}
            onToday={goToToday}
            taskCounts={taskCounts}
          />

          {/* Progress Summary */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm">{completedTasks}/{totalTasks} tarefas</span>
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                  <Progress value={progressPercent} className="h-2 flex-1" />
                  <span className="text-sm font-medium w-10">{progressPercent}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{formatDuration(completedMinutes)}/{formatDuration(totalMinutes)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tasks List */}
          {loadingTasks ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : sortedTasks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Nenhuma tarefa para esta data</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {sortedTasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.02 }}
                  >
                    <TaskCard
                      task={task}
                      onToggle={() => handleToggleComplete(task.id, task.is_completed)}
                      onClick={() => handleTaskClick(task)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* Goal Detail Dialog */}
      <GoalDetailDialog
        task={selectedTask}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onToggleComplete={handleToggleComplete}
        school={cronograma.schools}
        targetUserId={userId}
      />
    </div>
  );
}
