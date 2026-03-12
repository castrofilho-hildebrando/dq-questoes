import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfWeek, addDays } from "date-fns";

interface SubjectStats {
  subject: string;
  disciplineId: string;
  total: number;
  correct: number;
  percentage: number;
}

interface WeeklyPerformance {
  name: string;
  acertos: number;
  questoes: number;
}

interface ScheduleItem {
  id: string;
  title: string;
  subject: string;
  time: string;
  duration: string;
  isCompleted: boolean;
  goalType?: string;
}

interface Activity {
  id: string;
  type: "question" | "task";
  title: string;
  description: string;
  time: string;
  status?: "correct" | "incorrect";
}

export interface CronogramaDashboardData {
  // Question Stats
  totalQuestionsResolved: number;
  questionsThisWeek: number;
  questionsTrend: number;
  accuracyRate: number;
  accuracyTrend: number;

  // Study Stats
  totalStudyHours: number;
  studyHoursThisMonth: number;
  currentStreak: number;

  // Subject stats
  subjectStats: SubjectStats[];

  // Weekly Performance
  weeklyPerformance: WeeklyPerformance[];

  // Today's Schedule
  todaySchedule: ScheduleItem[];
  todayProgress: {
    completed: number;
    total: number;
    percentage: number;
  };

  // Recent Activity
  recentActivity: Activity[];

  loading: boolean;
}

const emptyData: CronogramaDashboardData = {
  totalQuestionsResolved: 0,
  questionsThisWeek: 0,
  questionsTrend: 0,
  accuracyRate: 0,
  accuracyTrend: 0,
  totalStudyHours: 0,
  studyHoursThisMonth: 0,
  currentStreak: 0,
  subjectStats: [],
  weeklyPerformance: [],
  todaySchedule: [],
  todayProgress: { completed: 0, total: 0, percentage: 0 },
  recentActivity: [],
  loading: true,
};

export function useCronogramaDashboardData(cronogramaId?: string, filterFrom?: Date, filterTo?: Date) {
  const { user } = useAuth();
  const [data, setData] = useState<CronogramaDashboardData>(emptyData);

  const filterFromStr = filterFrom ? format(filterFrom, "yyyy-MM-dd") : undefined;
  const filterToStr = filterTo ? format(filterTo, "yyyy-MM-dd") : undefined;

  const fetchData = useCallback(async () => {
    if (!user?.id || !cronogramaId) {
      setData({ ...emptyData, loading: false });
      return;
    }

    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 0 }), "yyyy-MM-dd");
      const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");

      // Fetch today's tasks
      const { data: todayTasks } = await supabase
        .from("user_cronograma_tasks")
        .select(`
          *,
          topic_goals (
            id, name, goal_type,
            study_topics (
              id, name,
              study_disciplines (id, name)
            )
          ),
          study_topics (
            id, name,
            study_disciplines (id, name)
          )
        `)
        .eq("cronograma_id", cronogramaId)
        .eq("user_id", user.id)
        .eq("scheduled_date", today)
        .order("start_time", { ascending: true, nullsFirst: false });

      // Fetch all completed tasks for study hours
      const { data: allTasks } = await supabase
        .from("user_cronograma_tasks")
        .select("duration_minutes, is_completed, scheduled_date")
        .eq("cronograma_id", cronogramaId)
        .eq("user_id", user.id)
        .eq("is_completed", true);

      // Fetch all tasks to get the source_topic_ids for this cronograma
      const { data: cronogramaTasks } = await supabase
        .from("user_cronograma_tasks")
        .select("id, is_completed, goal_id, source_topic_id")
        .eq("cronograma_id", cronogramaId)
        .eq("user_id", user.id);

      // Get unique source_topic_ids and their discipline_ids from this cronograma
      const topicIds = new Set<string>();
      (cronogramaTasks || []).forEach(t => {
        if (t.source_topic_id) topicIds.add(t.source_topic_id);
      });

      // Fetch topics with their source chain to resolve derived→source mapping
      const topicIdArray = Array.from(topicIds);
      let cronogramaDisciplineIds = new Set<string>();
      if (topicIdArray.length > 0) {
        const { data: topics } = await supabase
          .from("study_topics")
          .select("id, study_discipline_id, source_topic_id")
          .in("id", topicIdArray);
        
        // Collect source_topic_ids that need resolving
        const sourceTopicIdsToResolve: string[] = [];
        (topics || []).forEach(t => {
          if (t.study_discipline_id) cronogramaDisciplineIds.add(t.study_discipline_id);
          // If this is a derived topic, also track its real source
          if (t.source_topic_id) {
            topicIds.add(t.source_topic_id);
            sourceTopicIdsToResolve.push(t.source_topic_id);
          }
        });

        // Resolve source topics to get their discipline_ids too
        if (sourceTopicIdsToResolve.length > 0) {
          const { data: sourceTopics } = await supabase
            .from("study_topics")
            .select("id, study_discipline_id")
            .in("id", sourceTopicIdsToResolve);
          (sourceTopics || []).forEach(t => {
            if (t.study_discipline_id) cronogramaDisciplineIds.add(t.study_discipline_id);
          });
        }
      }

      // Fetch user answers for question stats - ALL answers, then filter client-side
      const { data: allAnswers } = await supabase
        .from("user_answers")
        .select(`
          id, is_correct, answered_at, question_id,
          questions:question_id (
            study_discipline_id,
            study_topic_id,
            study_disciplines:study_discipline_id (name)
          )
        `)
        .eq("user_id", user.id)
        .order("answered_at", { ascending: false });

      // Filter answers to only those matching this cronograma's disciplines
      let filteredAnswers = (allAnswers || []).filter(a => {
        const question = a.questions as any;
        const disciplineId = question?.study_discipline_id;
        const topicId = question?.study_topic_id;
        return (topicId && topicIds.has(topicId)) || (disciplineId && cronogramaDisciplineIds.has(disciplineId));
      });

      // Apply date range filter
      if (filterFromStr) {
        filteredAnswers = filteredAnswers.filter(a => a.answered_at && a.answered_at >= filterFromStr);
      }
      if (filterToStr) {
        const toEnd = filterToStr + "T23:59:59";
        filteredAnswers = filteredAnswers.filter(a => a.answered_at && a.answered_at <= toEnd);
      }

      // Process today's schedule
      const todaySchedule: ScheduleItem[] = (todayTasks || []).map(task => {
        const goal = task.topic_goals;
        const topic = goal?.study_topics || task.study_topics;
        const discipline = topic?.study_disciplines;

        return {
          id: task.id,
          title: goal?.name || topic?.name || "Meta de estudo",
          subject: discipline?.name || "",
          time: task.start_time?.slice(0, 5) || "",
          duration: `${task.duration_minutes}min`,
          isCompleted: task.is_completed || false,
          goalType: goal?.goal_type || undefined,
        };
      });

      const completedToday = todaySchedule.filter(t => t.isCompleted).length;
      const totalToday = todaySchedule.length;

      // Calculate study hours
      const totalMinutes = (allTasks || []).reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
      const totalStudyHours = Math.round((totalMinutes / 60) * 10) / 10;

      const monthTasks = (allTasks || []).filter(t => t.scheduled_date >= monthStart);
      const monthMinutes = monthTasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
      const studyHoursThisMonth = Math.round((monthMinutes / 60) * 10) / 10;

      // Calculate streak (consecutive days with completed tasks)
      let currentStreak = 0;
      const tasksByDate = new Map<string, boolean>();
      (allTasks || []).forEach(t => {
        tasksByDate.set(t.scheduled_date, true);
      });

      for (let i = 0; i <= 365; i++) {
        const checkDate = format(subDays(new Date(), i), "yyyy-MM-dd");
        if (tasksByDate.has(checkDate)) {
          currentStreak++;
        } else if (i > 0) {
          break;
        }
      }

      // Process question stats
      const answers = filteredAnswers;
      const totalQuestionsResolved = answers.length;
      const correctAnswers = answers.filter(a => a.is_correct).length;
      const accuracyRate = totalQuestionsResolved > 0
        ? Math.round((correctAnswers / totalQuestionsResolved) * 100)
        : 0;

      const weekAnswers = answers.filter(a => 
        a.answered_at && a.answered_at >= weekStart
      );
      const questionsThisWeek = weekAnswers.length;

      // Subject stats
      const subjectMap = new Map<string, { total: number; correct: number; name: string; id: string }>();
      answers.forEach(answer => {
        const question = answer.questions as any;
        const disciplineId = question?.study_discipline_id;
        const disciplineName = question?.study_disciplines?.name || "Outras";
        
        if (disciplineId) {
          const existing = subjectMap.get(disciplineId) || { 
            total: 0, 
            correct: 0, 
            name: disciplineName,
            id: disciplineId 
          };
          existing.total++;
          if (answer.is_correct) existing.correct++;
          subjectMap.set(disciplineId, existing);
        }
      });

      const subjectStats: SubjectStats[] = Array.from(subjectMap.values())
        .map(s => ({
          subject: s.name,
          disciplineId: s.id,
          total: s.total,
          correct: s.correct,
          percentage: Math.round((s.correct / s.total) * 100),
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);

      // Weekly performance
      const weeklyPerformance: WeeklyPerformance[] = [];
      const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const weekStartDate = startOfWeek(new Date(), { weekStartsOn: 0 });

      for (let i = 0; i < 7; i++) {
        const dayDate = format(addDays(weekStartDate, i), "yyyy-MM-dd");
        const dayAnswers = answers.filter(a => 
          a.answered_at && a.answered_at.startsWith(dayDate)
        );
        const dayCorrect = dayAnswers.filter(a => a.is_correct).length;

        weeklyPerformance.push({
          name: dayNames[i],
          questoes: dayAnswers.length,
          acertos: dayCorrect,
        });
      }

      // Recent activity
      const recentActivity: Activity[] = answers.slice(0, 10).map(answer => ({
        id: answer.id,
        type: "question" as const,
        title: "Questão respondida",
        description: answer.is_correct ? "Resposta correta" : "Resposta incorreta",
        time: answer.answered_at 
          ? formatRelativeTime(new Date(answer.answered_at))
          : "",
        status: answer.is_correct ? "correct" : "incorrect",
      }));

      setData({
        totalQuestionsResolved,
        questionsThisWeek,
        questionsTrend: 0,
        accuracyRate,
        accuracyTrend: 0,
        totalStudyHours,
        studyHoursThisMonth,
        currentStreak,
        subjectStats,
        weeklyPerformance,
        todaySchedule,
        todayProgress: {
          completed: completedToday,
          total: totalToday,
          percentage: totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0,
        },
        recentActivity,
        loading: false,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setData({ ...emptyData, loading: false });
    }
  }, [user?.id, cronogramaId, filterFromStr, filterToStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscriptions
  useEffect(() => {
    if (!user?.id || !cronogramaId) return;

    const tasksChannel = supabase
      .channel(`dashboard-tasks-${cronogramaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_cronograma_tasks",
          filter: `cronograma_id=eq.${cronogramaId}`,
        },
        () => fetchData()
      )
      .subscribe();

    const answersChannel = supabase
      .channel(`dashboard-answers-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_answers",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(answersChannel);
    };
  }, [user?.id, cronogramaId, fetchData]);

  return data;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins}min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays === 1) return "ontem";
  return `${diffDays} dias atrás`;
}
