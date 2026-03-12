import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subDays, parseISO, startOfDay, differenceInDays } from 'date-fns';

export interface UserPerformanceStats {
  totalQuestionsAnswered: number;
  correctAnswers: number;
  accuracyPercentage: number;
  currentStreak: number;
  longestStreak: number;
  totalStudyHours: number;
  lastActivityDate: string | null;
}

export interface UserCronogramaInfo {
  id: string;
  name: string;
  school_name: string;
  created_at: string;
  is_active: boolean;
  total_tasks: number;
  completed_tasks: number;
  pending_admin_changes: boolean;
  admin_changes_description: string | null;
  start_date: string;
  end_date: string | null;
}

export interface MentoringNote {
  id: string;
  user_id: string;
  mentor_id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  mentor_name?: string;
}

export interface PerformanceReport {
  id: string;
  user_id: string;
  generated_by: string;
  cronograma_id: string | null;
  report_type: string;
  report_data: any;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  generator_name?: string;
}

export interface UserManagementData {
  cronogramas: UserCronogramaInfo[];
  mentoringNotes: MentoringNote[];
  performanceReports: PerformanceReport[];
  performanceStats: UserPerformanceStats | null;
  loading: boolean;
  refresh: () => Promise<void>;
  addMentoringNote: (content: string) => Promise<boolean>;
  deleteMentoringNote: (noteId: string) => Promise<boolean>;
  toggleNotePinned: (noteId: string, isPinned: boolean) => Promise<boolean>;
  generatePerformanceReport: (cronogramaId?: string, periodDays?: number) => Promise<boolean>;
}

function calculateStreak(dates: string[]): { current: number; longest: number } {
  if (dates.length === 0) return { current: 0, longest: 0 };

  // Get unique dates and sort descending
  const uniqueDates = [...new Set(dates.map(d => format(startOfDay(parseISO(d)), 'yyyy-MM-dd')))]
    .sort()
    .reverse();

  if (uniqueDates.length === 0) return { current: 0, longest: 0 };

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;
  
  // Check if today or yesterday is the most recent activity
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const mostRecent = uniqueDates[0];
  
  const isCurrentlyActive = mostRecent === today || mostRecent === yesterday;
  
  // Calculate streaks
  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = parseISO(uniqueDates[i - 1]);
    const currDate = parseISO(uniqueDates[i]);
    const diff = differenceInDays(prevDate, currDate);
    
    if (diff === 1) {
      tempStreak++;
    } else {
      if (tempStreak > longestStreak) longestStreak = tempStreak;
      tempStreak = 1;
    }
  }
  
  if (tempStreak > longestStreak) longestStreak = tempStreak;
  
  // Current streak is from most recent going back
  if (isCurrentlyActive) {
    currentStreak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = parseISO(uniqueDates[i - 1]);
      const currDate = parseISO(uniqueDates[i]);
      const diff = differenceInDays(prevDate, currDate);
      
      if (diff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return { current: currentStreak, longest: longestStreak };
}

export function useUserManagement(userId: string | null): UserManagementData {
  const [cronogramas, setCronogramas] = useState<UserCronogramaInfo[]>([]);
  const [mentoringNotes, setMentoringNotes] = useState<MentoringNote[]>([]);
  const [performanceReports, setPerformanceReports] = useState<PerformanceReport[]>([]);
  const [performanceStats, setPerformanceStats] = useState<UserPerformanceStats | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCronogramas = useCallback(async () => {
    if (!userId) return;

    const { data: cronogramasData, error } = await supabase
      .from('user_cronogramas')
      .select(`
        id,
        name,
        school_id,
        created_at,
        is_active,
        pending_admin_changes,
        admin_changes_description,
        start_date,
        end_date,
        schools(name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading cronogramas:', error);
      return;
    }

    // Get task counts for each cronograma
    const cronogramasWithTasks: UserCronogramaInfo[] = await Promise.all(
      (cronogramasData || []).map(async (cron: any) => {
        const { count: totalTasks } = await supabase
          .from('user_cronograma_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('cronograma_id', cron.id);

        const { count: completedTasks } = await supabase
          .from('user_cronograma_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('cronograma_id', cron.id)
          .eq('is_completed', true);

        return {
          id: cron.id,
          name: cron.name,
          school_name: cron.schools?.name || 'Escola não definida',
          created_at: cron.created_at,
          is_active: cron.is_active,
          total_tasks: totalTasks || 0,
          completed_tasks: completedTasks || 0,
          pending_admin_changes: cron.pending_admin_changes || false,
          admin_changes_description: cron.admin_changes_description,
          start_date: cron.start_date,
          end_date: cron.end_date,
        };
      })
    );

    setCronogramas(cronogramasWithTasks);
  }, [userId]);

  const loadMentoringNotes = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('user_mentoring_notes')
      .select(`
        id,
        user_id,
        mentor_id,
        content,
        is_pinned,
        created_at,
        updated_at
      `)
      .eq('user_id', userId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading mentoring notes:', error);
      return;
    }

    // Get mentor names
    const mentorIds = [...new Set((data || []).map(n => n.mentor_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', mentorIds);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

    setMentoringNotes((data || []).map(note => ({
      ...note,
      mentor_name: profileMap.get(note.mentor_id) || 'Mentor',
    })));
  }, [userId]);

  const loadPerformanceReports = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('user_performance_reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error loading performance reports:', error);
      return;
    }

    // Get generator names
    const generatorIds = [...new Set((data || []).map(r => r.generated_by))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', generatorIds);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

    setPerformanceReports((data || []).map(report => ({
      ...report,
      generator_name: profileMap.get(report.generated_by) || 'Admin',
    })));
  }, [userId]);

  const loadPerformanceStats = useCallback(async () => {
    if (!userId) return;

    // Get user answers
    const { data: answers, error: answersError } = await supabase
      .from('user_answers')
      .select('is_correct, answered_at')
      .eq('user_id', userId);

    if (answersError) {
      console.error('Error loading answers:', answersError);
      return;
    }

    const totalQuestionsAnswered = answers?.length || 0;
    const correctAnswers = answers?.filter(a => a.is_correct).length || 0;
    const accuracyPercentage = totalQuestionsAnswered > 0 
      ? Math.round((correctAnswers / totalQuestionsAnswered) * 100) 
      : 0;

    // Calculate streak
    const answerDates = (answers || []).map(a => a.answered_at);
    const { current: currentStreak, longest: longestStreak } = calculateStreak(answerDates);

    // Get study hours from completed tasks
    const { data: tasks } = await supabase
      .from('user_cronograma_tasks')
      .select('duration_minutes')
      .eq('user_id', userId)
      .eq('is_completed', true);

    const totalMinutes = (tasks || []).reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
    const totalStudyHours = Math.round((totalMinutes / 60) * 10) / 10;

    // Get last activity date
    const sortedAnswers = [...(answers || [])].sort((a, b) => 
      new Date(b.answered_at).getTime() - new Date(a.answered_at).getTime()
    );
    const lastActivityDate = sortedAnswers[0]?.answered_at || null;

    setPerformanceStats({
      totalQuestionsAnswered,
      correctAnswers,
      accuracyPercentage,
      currentStreak,
      longestStreak,
      totalStudyHours,
      lastActivityDate,
    });
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      await Promise.all([
        loadCronogramas(),
        loadMentoringNotes(),
        loadPerformanceReports(),
        loadPerformanceStats(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [userId, loadCronogramas, loadMentoringNotes, loadPerformanceReports, loadPerformanceStats]);

  const addMentoringNote = useCallback(async (content: string): Promise<boolean> => {
    if (!userId) return false;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Não autenticado');
      return false;
    }

    const { error } = await supabase
      .from('user_mentoring_notes')
      .insert({
        user_id: userId,
        mentor_id: user.id,
        content,
      });

    if (error) {
      console.error('Error adding note:', error);
      toast.error('Erro ao adicionar nota');
      return false;
    }

    toast.success('Nota adicionada com sucesso');
    await loadMentoringNotes();
    return true;
  }, [userId, loadMentoringNotes]);

  const deleteMentoringNote = useCallback(async (noteId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('user_mentoring_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      console.error('Error deleting note:', error);
      toast.error('Erro ao excluir nota');
      return false;
    }

    toast.success('Nota excluída');
    await loadMentoringNotes();
    return true;
  }, [loadMentoringNotes]);

  const toggleNotePinned = useCallback(async (noteId: string, isPinned: boolean): Promise<boolean> => {
    const { error } = await supabase
      .from('user_mentoring_notes')
      .update({ is_pinned: isPinned })
      .eq('id', noteId);

    if (error) {
      console.error('Error toggling pin:', error);
      toast.error('Erro ao fixar nota');
      return false;
    }

    await loadMentoringNotes();
    return true;
  }, [loadMentoringNotes]);

  const generatePerformanceReport = useCallback(async (
    cronogramaId?: string, 
    periodDays: number = 30
  ): Promise<boolean> => {
    if (!userId) return false;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Não autenticado');
      return false;
    }

    try {
      const periodStart = periodDays > 0 
        ? format(subDays(new Date(), periodDays), 'yyyy-MM-dd')
        : null;
      const periodEnd = format(new Date(), 'yyyy-MM-dd');

      // Build query
      let answersQuery = supabase
        .from('user_answers')
        .select(`
          id,
          is_correct,
          answered_at,
          questions(
            id,
            study_discipline_id,
            study_topic_id,
            study_disciplines(name),
            study_topics(name)
          )
        `)
        .eq('user_id', userId);

      if (periodStart) {
        answersQuery = answersQuery.gte('answered_at', periodStart);
      }

      const { data: answers, error: answersError } = await answersQuery;

      if (answersError) throw answersError;

      // Get cronograma tasks if specified
      let tasksData: any[] = [];
      if (cronogramaId) {
        const { data } = await supabase
          .from('user_cronograma_tasks')
          .select('*')
          .eq('cronograma_id', cronogramaId);
        tasksData = data || [];
      }

      // Calculate metrics
      const totalQuestions = answers?.length || 0;
      const correctAnswers = answers?.filter((a: any) => a.is_correct).length || 0;
      const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

      // Group by discipline
      const disciplineBreakdown: Record<string, { name: string; total: number; correct: number }> = {};
      answers?.forEach((answer: any) => {
        const discName = answer.questions?.study_disciplines?.name || 'Sem disciplina';
        if (!disciplineBreakdown[discName]) {
          disciplineBreakdown[discName] = { name: discName, total: 0, correct: 0 };
        }
        disciplineBreakdown[discName].total++;
        if (answer.is_correct) disciplineBreakdown[discName].correct++;
      });

      const reportData = {
        generatedAt: new Date().toISOString(),
        metrics: {
          questionsAnswered: totalQuestions,
          correctAnswers,
          accuracy,
          studyHours: performanceStats?.totalStudyHours || 0,
          currentStreak: performanceStats?.currentStreak || 0,
          tasksCompleted: tasksData.filter(t => t.is_completed).length,
          tasksTotal: tasksData.length,
          disciplineBreakdown: Object.values(disciplineBreakdown),
        },
        trends: {
          accuracyTrend: 'stable',
          studyHoursTrend: 'stable',
        },
      };

      const { error } = await supabase
        .from('user_performance_reports')
        .insert({
          user_id: userId,
          generated_by: user.id,
          cronograma_id: cronogramaId || null,
          report_type: cronogramaId ? 'cronograma' : 'general',
          report_data: reportData,
          period_start: periodStart,
          period_end: periodEnd,
        });

      if (error) throw error;

      toast.success('Relatório gerado com sucesso');
      await loadPerformanceReports();
      return true;
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Erro ao gerar relatório');
      return false;
    }
  }, [userId, performanceStats, loadPerformanceReports]);

  return {
    cronogramas,
    mentoringNotes,
    performanceReports,
    performanceStats,
    loading,
    refresh,
    addMentoringNote,
    deleteMentoringNote,
    toggleNotePinned,
    generatePerformanceReport,
  };
}
