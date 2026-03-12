import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek } from "date-fns";

export interface StudentCronogramaStats {
  // Study stats
  totalStudyHours: number;
  studyHoursThisWeek: number;
  currentStreak: number;
  
  // Today's progress
  todayTasksTotal: number;
  todayTasksCompleted: number;
  todayProgressPercent: number;
  
  // Overall progress
  totalTasksCompleted: number;
  completionRate: number;
}

export function useStudentCronogramaStats(userId?: string) {
  return useQuery({
    queryKey: ["student-cronograma-stats", userId],
    queryFn: async (): Promise<StudentCronogramaStats> => {
      if (!userId) {
        return {
          totalStudyHours: 0,
          studyHoursThisWeek: 0,
          currentStreak: 0,
          todayTasksTotal: 0,
          todayTasksCompleted: 0,
          todayProgressPercent: 0,
          totalTasksCompleted: 0,
          completionRate: 0,
        };
      }

      const today = format(new Date(), "yyyy-MM-dd");
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 0 }), "yyyy-MM-dd");

      // Fetch all user tasks
      const { data: allTasks } = await supabase
        .from("user_cronograma_tasks")
        .select("id, duration_minutes, is_completed, scheduled_date")
        .eq("user_id", userId);

      const tasks = allTasks || [];

      // Calculate total study hours (completed tasks)
      const completedTasks = tasks.filter(t => t.is_completed);
      const totalMinutes = completedTasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
      const totalStudyHours = Math.round((totalMinutes / 60) * 10) / 10;

      // Week study hours
      const weekCompletedTasks = completedTasks.filter(t => t.scheduled_date >= weekStart);
      const weekMinutes = weekCompletedTasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
      const studyHoursThisWeek = Math.round((weekMinutes / 60) * 10) / 10;

      // Calculate streak (consecutive days with completed tasks)
      let currentStreak = 0;
      const completedDates = new Set(
        completedTasks.map(t => t.scheduled_date)
      );

      for (let i = 0; i <= 365; i++) {
        const checkDate = format(subDays(new Date(), i), "yyyy-MM-dd");
        if (completedDates.has(checkDate)) {
          currentStreak++;
        } else if (i > 0) {
          break;
        }
      }

      // Today's tasks
      const todayTasks = tasks.filter(t => t.scheduled_date === today);
      const todayTasksTotal = todayTasks.length;
      const todayTasksCompleted = todayTasks.filter(t => t.is_completed).length;
      const todayProgressPercent = todayTasksTotal > 0
        ? Math.round((todayTasksCompleted / todayTasksTotal) * 100)
        : 0;

      // Overall completion rate
      const totalTasksCompleted = completedTasks.length;
      const pastTasks = tasks.filter(t => t.scheduled_date <= today);
      const completionRate = pastTasks.length > 0
        ? Math.round((totalTasksCompleted / pastTasks.length) * 100)
        : 0;

      return {
        totalStudyHours,
        studyHoursThisWeek,
        currentStreak,
        todayTasksTotal,
        todayTasksCompleted,
        todayProgressPercent,
        totalTasksCompleted,
        completionRate,
      };
    },
    enabled: !!userId,
    refetchInterval: 60000, // Refresh every minute
  });
}
