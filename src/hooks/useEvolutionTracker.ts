import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type FilterLevel = "school" | "discipline" | "topic";
export type MetricType = "goals" | "questions";

export interface EvolutionItem {
  id: string;
  name: string;
  // Goals metrics
  totalGoals: number;
  completedGoals: number;
  goalsProgress: number;
  // Question metrics
  totalQuestions: number;
  correctQuestions: number;
  accuracyRate: number;
  // For drill-down
  hasChildren: boolean;
  parentId?: string;
}

export interface EvolutionTrackerData {
  items: EvolutionItem[];
  loading: boolean;
  currentLevel: FilterLevel;
  selectedSchoolId?: string;
  selectedDisciplineId?: string;
  schoolName?: string;
  disciplineName?: string;
}

const emptyData: EvolutionTrackerData = {
  items: [],
  loading: true,
  currentLevel: "school",
};

export function useEvolutionTracker(cronogramaId?: string) {
  const { user } = useAuth();
  const [data, setData] = useState<EvolutionTrackerData>(emptyData);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | undefined>();
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string | undefined>();
  const [schoolName, setSchoolName] = useState<string | undefined>();
  const [disciplineName, setDisciplineName] = useState<string | undefined>();

  const fetchSchoolLevel = useCallback(async () => {
    if (!user?.id || !cronogramaId) {
      setData({ ...emptyData, loading: false });
      return;
    }

    try {
      // Get the cronograma's school
      const { data: cronograma } = await supabase
        .from("user_cronogramas")
        .select("school_id, schools(id, name)")
        .eq("id", cronogramaId)
        .single();

      if (!cronograma?.school_id) {
        setData({ ...emptyData, loading: false });
        return;
      }

      const schoolId = cronograma.school_id;
      const school = cronograma.schools as any;

      // Get all tasks for this cronograma
      const { data: tasks } = await supabase
        .from("user_cronograma_tasks")
        .select("id, is_completed, goal_id, source_topic_id")
        .eq("cronograma_id", cronogramaId)
        .eq("user_id", user.id);

      // Get question answers with their topics/disciplines
      const { data: answers } = await supabase
        .from("user_answers")
        .select(`
          id, is_correct,
          questions:question_id (
            study_topic_id,
            study_discipline_id
          )
        `)
        .eq("user_id", user.id);

      const totalGoals = tasks?.length || 0;
      const completedGoals = tasks?.filter(t => t.is_completed).length || 0;
      const goalsProgress = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

      const totalQuestions = answers?.length || 0;
      const correctQuestions = answers?.filter(a => a.is_correct).length || 0;
      const accuracyRate = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0;

      const items: EvolutionItem[] = [{
        id: schoolId,
        name: school?.name || "Escola",
        totalGoals,
        completedGoals,
        goalsProgress,
        totalQuestions,
        correctQuestions,
        accuracyRate,
        hasChildren: true,
      }];

      setData({
        items,
        loading: false,
        currentLevel: "school",
      });
    } catch (error) {
      console.error("Error fetching school level data:", error);
      setData({ ...emptyData, loading: false });
    }
  }, [user?.id, cronogramaId]);

  const fetchDisciplineLevel = useCallback(async (schoolId: string, sName?: string) => {
    if (!user?.id || !cronogramaId) return;

    setData(prev => ({ ...prev, loading: true }));

    try {
      // Get disciplines for this school
      const { data: schoolDisciplines } = await supabase
        .from("school_disciplines")
        .select(`
          discipline_id,
          study_disciplines (id, name)
        `)
        .eq("school_id", schoolId)
        .eq("is_active", true);

      // Get all tasks grouped by topic -> discipline
      const { data: tasks } = await supabase
        .from("user_cronograma_tasks")
        .select(`
          id, is_completed, goal_id, source_topic_id,
          topic_goals (
            topic_id,
            study_topics (study_discipline_id)
          ),
          study_topics (study_discipline_id)
        `)
        .eq("cronograma_id", cronogramaId)
        .eq("user_id", user.id);

      // Get question answers grouped by discipline
      const { data: answers } = await supabase
        .from("user_answers")
        .select(`
          id, is_correct,
          questions:question_id (study_discipline_id)
        `)
        .eq("user_id", user.id);

      const disciplineMap = new Map<string, EvolutionItem>();

      // Initialize disciplines
      (schoolDisciplines || []).forEach(sd => {
        const disc = sd.study_disciplines as any;
        if (disc) {
          disciplineMap.set(disc.id, {
            id: disc.id,
            name: disc.name,
            totalGoals: 0,
            completedGoals: 0,
            goalsProgress: 0,
            totalQuestions: 0,
            correctQuestions: 0,
            accuracyRate: 0,
            hasChildren: true,
            parentId: schoolId,
          });
        }
      });

      // Count goals per discipline
      (tasks || []).forEach(task => {
        const disciplineId = 
          task.topic_goals?.study_topics?.study_discipline_id ||
          task.study_topics?.study_discipline_id;
        
        if (disciplineId && disciplineMap.has(disciplineId)) {
          const item = disciplineMap.get(disciplineId)!;
          item.totalGoals++;
          if (task.is_completed) item.completedGoals++;
        }
      });

      // Count questions per discipline
      (answers || []).forEach(answer => {
        const question = answer.questions as any;
        const disciplineId = question?.study_discipline_id;
        
        if (disciplineId && disciplineMap.has(disciplineId)) {
          const item = disciplineMap.get(disciplineId)!;
          item.totalQuestions++;
          if (answer.is_correct) item.correctQuestions++;
        }
      });

      // Calculate percentages
      const items = Array.from(disciplineMap.values()).map(item => ({
        ...item,
        goalsProgress: item.totalGoals > 0 ? Math.round((item.completedGoals / item.totalGoals) * 100) : 0,
        accuracyRate: item.totalQuestions > 0 ? Math.round((item.correctQuestions / item.totalQuestions) * 100) : 0,
      })).filter(item => item.totalGoals > 0 || item.totalQuestions > 0)
        .sort((a, b) => b.totalGoals - a.totalGoals);

      setSelectedSchoolId(schoolId);
      setSchoolName(sName);
      setData({
        items,
        loading: false,
        currentLevel: "discipline",
        selectedSchoolId: schoolId,
        schoolName: sName,
      });
    } catch (error) {
      console.error("Error fetching discipline level data:", error);
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [user?.id, cronogramaId]);

  const fetchTopicLevel = useCallback(async (disciplineId: string, dName?: string) => {
    if (!user?.id || !cronogramaId) return;

    setData(prev => ({ ...prev, loading: true }));

    try {
      // Get topics for this discipline
      const { data: topics } = await supabase
        .from("study_topics")
        .select("id, name")
        .eq("study_discipline_id", disciplineId)
        .eq("is_active", true)
        .order("display_order", { ascending: true, nullsFirst: false });

      // Get tasks grouped by topic
      const { data: tasks } = await supabase
        .from("user_cronograma_tasks")
        .select(`
          id, is_completed, goal_id, source_topic_id,
          topic_goals (topic_id)
        `)
        .eq("cronograma_id", cronogramaId)
        .eq("user_id", user.id);

      // Get question answers grouped by topic
      const { data: answers } = await supabase
        .from("user_answers")
        .select(`
          id, is_correct,
          questions:question_id (study_topic_id)
        `)
        .eq("user_id", user.id);

      const topicMap = new Map<string, EvolutionItem>();

      // Initialize topics
      (topics || []).forEach(topic => {
        topicMap.set(topic.id, {
          id: topic.id,
          name: topic.name,
          totalGoals: 0,
          completedGoals: 0,
          goalsProgress: 0,
          totalQuestions: 0,
          correctQuestions: 0,
          accuracyRate: 0,
          hasChildren: false,
          parentId: disciplineId,
        });
      });

      // Count goals per topic
      (tasks || []).forEach(task => {
        const topicId = task.topic_goals?.topic_id || task.source_topic_id;
        
        if (topicId && topicMap.has(topicId)) {
          const item = topicMap.get(topicId)!;
          item.totalGoals++;
          if (task.is_completed) item.completedGoals++;
        }
      });

      // Count questions per topic
      (answers || []).forEach(answer => {
        const question = answer.questions as any;
        const topicId = question?.study_topic_id;
        
        if (topicId && topicMap.has(topicId)) {
          const item = topicMap.get(topicId)!;
          item.totalQuestions++;
          if (answer.is_correct) item.correctQuestions++;
        }
      });

      // Calculate percentages
      const items = Array.from(topicMap.values()).map(item => ({
        ...item,
        goalsProgress: item.totalGoals > 0 ? Math.round((item.completedGoals / item.totalGoals) * 100) : 0,
        accuracyRate: item.totalQuestions > 0 ? Math.round((item.correctQuestions / item.totalQuestions) * 100) : 0,
      })).filter(item => item.totalGoals > 0 || item.totalQuestions > 0);

      setSelectedDisciplineId(disciplineId);
      setDisciplineName(dName);
      setData(prev => ({
        ...prev,
        items,
        loading: false,
        currentLevel: "topic",
        selectedDisciplineId: disciplineId,
        disciplineName: dName,
      }));
    } catch (error) {
      console.error("Error fetching topic level data:", error);
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [user?.id, cronogramaId]);

  const drillDown = useCallback((item: EvolutionItem) => {
    if (!item.hasChildren) return;

    if (data.currentLevel === "school") {
      fetchDisciplineLevel(item.id, item.name);
    } else if (data.currentLevel === "discipline") {
      fetchTopicLevel(item.id, item.name);
    }
  }, [data.currentLevel, fetchDisciplineLevel, fetchTopicLevel]);

  const goBack = useCallback(() => {
    if (data.currentLevel === "topic" && selectedSchoolId) {
      fetchDisciplineLevel(selectedSchoolId, schoolName);
    } else if (data.currentLevel === "discipline") {
      setSelectedSchoolId(undefined);
      setSchoolName(undefined);
      fetchSchoolLevel();
    }
  }, [data.currentLevel, selectedSchoolId, schoolName, fetchDisciplineLevel, fetchSchoolLevel]);

  const goToLevel = useCallback((level: FilterLevel) => {
    if (level === "school") {
      setSelectedSchoolId(undefined);
      setSelectedDisciplineId(undefined);
      setSchoolName(undefined);
      setDisciplineName(undefined);
      fetchSchoolLevel();
    } else if (level === "discipline" && selectedSchoolId) {
      setSelectedDisciplineId(undefined);
      setDisciplineName(undefined);
      fetchDisciplineLevel(selectedSchoolId, schoolName);
    }
  }, [selectedSchoolId, schoolName, fetchSchoolLevel, fetchDisciplineLevel]);

  useEffect(() => {
    fetchSchoolLevel();
  }, [fetchSchoolLevel]);

  return {
    ...data,
    selectedSchoolId,
    selectedDisciplineId,
    schoolName,
    disciplineName,
    drillDown,
    goBack,
    goToLevel,
  };
}
