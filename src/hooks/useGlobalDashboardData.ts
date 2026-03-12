import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfWeek, addDays } from "date-fns";
import type { CronogramaDashboardData } from "./useCronogramaDashboardData";

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

export function useGlobalDashboardData(filterFrom?: Date, filterTo?: Date) {
  const { user } = useAuth();
  const [data, setData] = useState<CronogramaDashboardData>(emptyData);

  const filterFromStr = filterFrom ? format(filterFrom, "yyyy-MM-dd") : undefined;
  const filterToStr = filterTo ? format(filterTo, "yyyy-MM-dd") : undefined;

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      setData({ ...emptyData, loading: false });
      return;
    }

    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 0 }), "yyyy-MM-dd");
      const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");

      // Fetch all completed tasks (across all cronogramas)
      const { data: allTasks } = await supabase
        .from("user_cronograma_tasks")
        .select("duration_minutes, is_completed, scheduled_date")
        .eq("user_id", user.id)
        .eq("is_completed", true);

      // Fetch today's tasks (all cronogramas)
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
        .eq("user_id", user.id)
        .eq("scheduled_date", today)
        .order("start_time", { ascending: true, nullsFirst: false });

      // Fetch ALL user answers (no cronograma filter)
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

      // Apply date range filter
      let answers = allAnswers || [];
      if (filterFromStr) {
        answers = answers.filter(a => a.answered_at && a.answered_at >= filterFromStr);
      }
      if (filterToStr) {
        const toEnd = filterToStr + "T23:59:59";
        answers = answers.filter(a => a.answered_at && a.answered_at <= toEnd);
      }

      // Today's schedule
      const todaySchedule = (todayTasks || []).map(task => {
        const goal = task.topic_goals as any;
        const topic = goal?.study_topics || (task.study_topics as any);
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

      // Study hours
      const totalMinutes = (allTasks || []).reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
      const totalStudyHours = Math.round((totalMinutes / 60) * 10) / 10;
      const monthTasks = (allTasks || []).filter(t => t.scheduled_date >= monthStart);
      const monthMinutes = monthTasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
      const studyHoursThisMonth = Math.round((monthMinutes / 60) * 10) / 10;

      // Streak
      let currentStreak = 0;
      const tasksByDate = new Map<string, boolean>();
      (allTasks || []).forEach(t => tasksByDate.set(t.scheduled_date, true));
      for (let i = 0; i <= 365; i++) {
        const checkDate = format(subDays(new Date(), i), "yyyy-MM-dd");
        if (tasksByDate.has(checkDate)) {
          currentStreak++;
        } else if (i > 0) {
          break;
        }
      }

      // Question stats
      const totalQuestionsResolved = answers.length;
      const correctAnswers = answers.filter(a => a.is_correct).length;
      const accuracyRate = totalQuestionsResolved > 0
        ? Math.round((correctAnswers / totalQuestionsResolved) * 100) : 0;
      const questionsThisWeek = answers.filter(a => a.answered_at && a.answered_at >= weekStart).length;

      // Subject stats
      const subjectMap = new Map<string, { total: number; correct: number; name: string; id: string }>();
      answers.forEach(answer => {
        const question = answer.questions as any;
        const disciplineId = question?.study_discipline_id;
        const disciplineName = question?.study_disciplines?.name || "Outras";
        if (disciplineId) {
          const existing = subjectMap.get(disciplineId) || { total: 0, correct: 0, name: disciplineName, id: disciplineId };
          existing.total++;
          if (answer.is_correct) existing.correct++;
          subjectMap.set(disciplineId, existing);
        }
      });

      const subjectStats = Array.from(subjectMap.values())
        .map(s => ({
          subject: s.name, disciplineId: s.id, total: s.total, correct: s.correct,
          percentage: Math.round((s.correct / s.total) * 100),
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);

      // Weekly performance
      const weeklyPerformance = [];
      const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const weekStartDate = startOfWeek(new Date(), { weekStartsOn: 0 });
      for (let i = 0; i < 7; i++) {
        const dayDate = format(addDays(weekStartDate, i), "yyyy-MM-dd");
        const dayAnswers = answers.filter(a => a.answered_at && a.answered_at.startsWith(dayDate));
        weeklyPerformance.push({
          name: dayNames[i],
          questoes: dayAnswers.length,
          acertos: dayAnswers.filter(a => a.is_correct).length,
        });
      }

      // Recent activity
      const recentActivity = answers.slice(0, 10).map(answer => ({
        id: answer.id,
        type: "question" as const,
        title: "Questão respondida",
        description: answer.is_correct ? "Resposta correta" : "Resposta incorreta",
        time: answer.answered_at ? formatRelativeTime(new Date(answer.answered_at)) : "",
        status: (answer.is_correct ? "correct" : "incorrect") as "correct" | "incorrect",
      }));

      setData({
        totalQuestionsResolved, questionsThisWeek, questionsTrend: 0,
        accuracyRate, accuracyTrend: 0, totalStudyHours, studyHoursThisMonth,
        currentStreak, subjectStats, weeklyPerformance, todaySchedule,
        todayProgress: {
          completed: completedToday, total: totalToday,
          percentage: totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0,
        },
        recentActivity, loading: false,
      });
    } catch (error) {
      console.error("Error fetching global dashboard data:", error);
      setData({ ...emptyData, loading: false });
    }
  }, [user?.id, filterFromStr, filterToStr]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
