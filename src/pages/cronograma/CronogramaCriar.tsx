import ConselhoThemeWrapper from "@/components/ConselhoThemeWrapper";
import { useState, useMemo, useEffect } from "react";
import { startOfDay } from "date-fns";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { 
  Loader2, Calendar, ArrowLeft, ArrowRight, GraduationCap, 
  Clock, BookOpen, Check, FileText, School, GripVertical, ChevronDown, ChevronRight, ListOrdered
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useCronogramaTaskGenerator } from "@/hooks/useCronogramaTaskGenerator";
import { 
  fetchRevisionTasksForCronograma, 
  generateRevisionAvailableDays, 
  distributeRevisionTasks 
} from "@/hooks/useCreateRevisionCronograma";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { EndDateWarning } from "@/components/cronograma/EndDateWarning";
import { TasksExcludedDialog } from "@/components/cronograma/TasksExcludedDialog";

interface Edital {
  id: string;
  name: string;
  area_id: string | null;
  areas?: { name: string } | null;
}

interface SchoolFromEdital {
  id: string;
  name: string;
  edital_id: string | null;
}

interface SchoolDiscipline {
  id: string;
  discipline_id: string;
  is_mandatory: boolean;
  display_order: number | null;
  study_disciplines: {
    id: string;
    name: string;
  };
}

interface StudyTopic {
  id: string;
  name: string;
  study_discipline_id: string;
  display_order: number | null;
}

type Step = 1 | 2 | 3 | 4 | 5;

const DAYS_OF_WEEK = [
  { id: "seg", label: "Seg", fullLabel: "Segunda-feira" },
  { id: "ter", label: "Ter", fullLabel: "Terça-feira" },
  { id: "qua", label: "Qua", fullLabel: "Quarta-feira" },
  { id: "qui", label: "Qui", fullLabel: "Quinta-feira" },
  { id: "sex", label: "Sex", fullLabel: "Sexta-feira" },
  { id: "sab", label: "Sáb", fullLabel: "Sábado" },
  { id: "dom", label: "Dom", fullLabel: "Domingo" },
];

export default function CronogramaCriar() {
  const navigate = useNavigate();
  const { id: cronogramaId } = useParams<{ id: string }>();
  const { fromSuffix } = useBackNavigation();
  const isEditMode = !!cronogramaId;
  const { user, loading: authLoading } = useAuth();
  const { generateTasks, recalculateTasks } = useCronogramaTaskGenerator();
  
  const [step, setStep] = useState<Step>(1);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [useCustomHoursPerDay, setUseCustomHoursPerDay] = useState(false);
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set());
  const [isLoadingCronograma, setIsLoadingCronograma] = useState(isEditMode);
  const [cronogramaType, setCronogramaType] = useState<string>('normal');
  const [revisionSourceId, setRevisionSourceId] = useState<string | null>(null);
  
  // State for tasks excluded dialog
  const [excludedDialogOpen, setExcludedDialogOpen] = useState(false);
  const [excludedDialogData, setExcludedDialogData] = useState<{
    tasksCreated: number;
    tasksExcluded: number;
    minutesExcluded: number;
    cronogramaId: string;
  } | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    editalId: "",
    schoolId: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    availableDays: ["seg", "ter", "qua", "qui", "sex"],
    hoursPerDay: 4,
    hoursPerWeekday: {} as Record<string, number>,
    selectedDisciplines: [] as string[],
    disciplineOrder: [] as string[],
    selectedTopics: {} as Record<string, string[]>, // disciplineId -> topicIds[]
    topicOrder: {} as Record<string, string[]>, // disciplineId -> ordered topicIds[]
  });

  // Load existing cronograma data if in edit mode
  useEffect(() => {
    const loadCronograma = async () => {
      if (!cronogramaId || !user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from("user_cronogramas")
          .select(`
            *,
            schools (
              id,
              name,
              edital_id
            )
          `)
          .eq("id", cronogramaId)
          .eq("user_id", user.id)
          .single();
        
        if (error) throw error;
        if (!data) {
          toast.error("Cronograma não encontrado");
          navigate(`/cronograma${fromSuffix}`);
          return;
        }
        
        // Set useCustomHoursPerDay if hours_per_weekday is set
        const hasCustomHours = data.hours_per_weekday && 
          Object.keys(data.hours_per_weekday as Record<string, number>).length > 0;
        setUseCustomHoursPerDay(hasCustomHours);
        
        // Track cronograma_type for revision-only schedules
        setCronogramaType((data as any).cronograma_type || 'normal');
        setRevisionSourceId((data as any).revision_source_id || null);
        
        setFormData({
          name: data.name || "",
          editalId: data.schools?.edital_id || "",
          schoolId: data.school_id,
          startDate: data.start_date,
          endDate: data.end_date || "",
          availableDays: data.available_days || ["seg", "ter", "qua", "qui", "sex"],
          hoursPerDay: data.hours_per_day || 4,
          hoursPerWeekday: (data.hours_per_weekday as Record<string, number>) || {},
          selectedDisciplines: data.selected_disciplines || [],
          disciplineOrder: data.discipline_order || [],
          selectedTopics: (data.selected_topics as Record<string, string[]>) || {},
          topicOrder: (data.topic_order as Record<string, string[]>) || {},
        });
      } catch (error) {
        console.error("Error loading cronograma:", error);
        toast.error("Erro ao carregar cronograma");
        navigate(`/cronograma${fromSuffix}`);
      } finally {
        setIsLoadingCronograma(false);
      }
    };
    
    if (isEditMode && user?.id) {
      loadCronograma();
    }
  }, [cronogramaId, user?.id, isEditMode, navigate]);
  // Fetch editals
  const { data: editals } = useQuery({
    queryKey: ["editals"],
    queryFn: async (): Promise<Edital[]> => {
      const { data, error } = await supabase
        .from("editals")
        .select("id, name, area_id, areas(name)")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as Edital[];
    },
  });

  // Fetch schools filtered by selected edital
  const { data: schools } = useQuery({
    queryKey: ["schools-by-edital", formData.editalId],
    queryFn: async (): Promise<SchoolFromEdital[]> => {
      if (!formData.editalId) return [];
      
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, edital_id")
        .eq("edital_id", formData.editalId)
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!formData.editalId,
  });

  // Fetch disciplines for selected school
  const { data: schoolDisciplines, isLoading: disciplinesLoading } = useQuery({
    queryKey: ["school-disciplines", formData.schoolId],
    queryFn: async (): Promise<SchoolDiscipline[]> => {
      if (!formData.schoolId) return [];
      
      const { data, error } = await supabase
        .from("school_disciplines")
        .select(`
          id,
          discipline_id,
          is_mandatory,
          display_order,
          study_disciplines (id, name)
        `)
        .eq("school_id", formData.schoolId)
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      return (data || []) as SchoolDiscipline[];
    },
    enabled: !!formData.schoolId,
  });

  // Fetch topics for selected disciplines (only those with questions)
  const { data: topics, isLoading: topicsLoading } = useQuery({
    queryKey: ["discipline-topics-with-questions", formData.selectedDisciplines],
    queryFn: async (): Promise<StudyTopic[]> => {
      if (formData.selectedDisciplines.length === 0) return [];
      
      // First, get all topics for the selected disciplines
      const { data: allTopics, error: topicsError } = await supabase
        .from("study_topics")
        .select("id, name, study_discipline_id, display_order")
        .in("study_discipline_id", formData.selectedDisciplines)
        .eq("is_active", true)
        .order("display_order");
      
      if (topicsError) throw topicsError;
      if (!allTopics || allTopics.length === 0) return [];
      
      // Get question counts for each topic using the RPC function
      const topicIds = allTopics.map(t => t.id);
      
      // Call RPC - it expects uuid[] but supabase-js handles string[] conversion
      const { data: questionCounts, error: countsError } = await supabase
        .rpc("get_topic_question_counts", { topic_ids: topicIds });
      
      if (countsError) {
        console.error("Error fetching question counts:", countsError);
        // Fallback: return all topics (shouldn't happen in production)
        return allTopics;
      }
      
      // Create a map of topic ID to question count
      const countMap = new Map<string, number>();
      for (const item of questionCounts || []) {
        countMap.set(item.topic_id, Number(item.question_count) || 0);
      }
      
      // Check which topics have study/pdf_reading goals (for manual_standalone disciplines)
      const { data: studyGoals } = await supabase
        .from("topic_goals")
        .select("topic_id")
        .in("topic_id", topicIds)
        .in("goal_type", ["study", "pdf_reading"])
        .eq("is_active", true);
      
      const topicsWithStudyGoals = new Set((studyGoals || []).map(g => g.topic_id));
      
      console.log(`Topic question counts: ${countMap.size} topics analyzed`);
      
      // Filter to topics that have at least 1 question OR have study goals
      const topicsWithContent = allTopics.filter(topic => {
        const hasQuestions = (countMap.get(topic.id) || 0) > 0;
        const hasStudyGoals = topicsWithStudyGoals.has(topic.id);
        if (!hasQuestions && !hasStudyGoals) {
          console.log(`Filtering out topic without questions or study goals: ⚠️ ${topic.name}`);
        }
        return hasQuestions || hasStudyGoals;
      });
      
      console.log(`Filtered: ${topicsWithContent.length}/${allTopics.length} topics have content`);
      
      return topicsWithContent;
    },
    enabled: formData.selectedDisciplines.length > 0,
  });

  // Group topics by discipline
  const topicsByDiscipline = useMemo(() => {
    if (!topics) return new Map<string, StudyTopic[]>();
    
    const grouped = new Map<string, StudyTopic[]>();
    for (const topic of topics) {
      const existing = grouped.get(topic.study_discipline_id) || [];
      existing.push(topic);
      grouped.set(topic.study_discipline_id, existing);
    }
    return grouped;
  }, [topics]);

  // Get all selected topic IDs for estimation
  const allSelectedTopicIds = useMemo(() => {
    return Object.values(formData.selectedTopics).flat();
  }, [formData.selectedTopics]);

  // Fetch estimated time from topic_goals for selected topics
  // IMPORTANT: Uses questions_per_hour from each discipline (configured in admin)
  const { data: topicGoalsTime } = useQuery({
    queryKey: ["topic-goals-time", allSelectedTopicIds, formData.selectedDisciplines],
    queryFn: async (): Promise<number> => {
      if (allSelectedTopicIds.length === 0) return 0;
      
      const DEFAULT_QUESTIONS_PER_HOUR = 10;
      const MIN_GOAL_DURATION = 30;
      
      // First, get question counts and discipline mapping for all selected topics
      const { data: topics, error: topicsError } = await supabase
        .from("study_topics")
        .select("id, study_discipline_id")
        .in("id", allSelectedTopicIds);
      
      if (topicsError) throw topicsError;
      
      const topicToDiscipline = new Map<string, string>();
      for (const t of topics || []) {
        topicToDiscipline.set(t.id, t.study_discipline_id);
      }
      
      // Get unique discipline IDs
      const disciplineIds = [...new Set(topics?.map(t => t.study_discipline_id) || [])];
      
      // Fetch questions_per_hour for each discipline
      const { data: disciplines, error: discError } = await supabase
        .from("study_disciplines")
        .select("id, questions_per_hour")
        .in("id", disciplineIds);
      
      if (discError) throw discError;
      
      const disciplineQPH = new Map<string, number>();
      for (const d of disciplines || []) {
        disciplineQPH.set(d.id, d.questions_per_hour || DEFAULT_QUESTIONS_PER_HOUR);
      }
      
      // Get question counts for all selected topics
      const { data: questionCounts, error: countsError } = await supabase
        .rpc("get_topic_question_counts", { topic_ids: allSelectedTopicIds });
      
      if (countsError) {
        console.error("Error fetching question counts:", countsError);
        throw countsError;
      }
      
       const questionCountMap = new Map<string, number>();
       for (const item of questionCounts || []) {
         questionCountMap.set(item.topic_id, Number(item.question_count) || 0);
       }

       // Fetch goals duration for selected topics
       const { data: goals, error: goalsError } = await supabase
         .from("topic_goals")
         .select("duration_minutes, topic_id, goal_type")
         .in("topic_id", allSelectedTopicIds)
         .eq("is_active", true);

       if (goalsError) throw goalsError;

       // Calculate duration based on questions_per_hour from discipline
       const calculateDuration = (questionCount: number, questionsPerHour: number): number => {
         if (questionCount === 0) return 0;
         const minutesPerQuestion = 60 / questionsPerHour;
         let duration = Math.ceil(questionCount * minutesPerQuestion);
         duration = Math.max(duration, MIN_GOAL_DURATION);
         duration = Math.ceil(duration / 30) * 30; // Round to 30 min blocks
         return duration;
       };

       // Sum up duration from goals
       let totalMinutes = 0;
       const topicsWithGoals = new Set<string>();

       for (const goal of goals || []) {
         topicsWithGoals.add(goal.topic_id);

         const questionCount = questionCountMap.get(goal.topic_id) || 0;
         const disciplineId = topicToDiscipline.get(goal.topic_id) || "";
         const qph = disciplineQPH.get(disciplineId) || DEFAULT_QUESTIONS_PER_HOUR;

         // Para metas de QUESTÕES, sempre calcular via questions_per_hour (duration_minutes pode ser placeholder)
         if (goal.goal_type === "questions") {
           totalMinutes += calculateDuration(questionCount, qph);
           continue;
         }

         // Para outros tipos, usar duration_minutes (se existir), senão um mínimo conservador
         if (goal.duration_minutes !== null && goal.duration_minutes !== undefined) {
           totalMinutes += Number(goal.duration_minutes) || 0;
         } else {
           totalMinutes += MIN_GOAL_DURATION;
         }
       }

       // For topics without goals, calculate based on question count and discipline's questions_per_hour
       const topicsWithoutGoals = allSelectedTopicIds.filter(id => !topicsWithGoals.has(id));

       for (const topicId of topicsWithoutGoals) {
         const questionCount = questionCountMap.get(topicId) || 0;
         const disciplineId = topicToDiscipline.get(topicId) || "";
         const qph = disciplineQPH.get(disciplineId) || DEFAULT_QUESTIONS_PER_HOUR;
        totalMinutes += calculateDuration(questionCount, qph);
        }

       // === REVISÕES: somar tempo de revisões configuradas para os tópicos selecionados ===
       const { data: revisionConfigs, error: revError } = await supabase
         .from("topic_revisions")
         .select("topic_id, revision_1_days, revision_2_days, revision_3_days, revision_4_days, revision_5_days, revision_6_days")
         .in("topic_id", allSelectedTopicIds)
         .eq("is_active", true);

       if (!revError && revisionConfigs) {
         let revisionMinutes = 0;
         for (const rev of revisionConfigs) {
           let revCount = 0;
           if (rev.revision_1_days) revCount++;
           if (rev.revision_2_days) revCount++;
           if (rev.revision_3_days) revCount++;
           if (rev.revision_4_days) revCount++;
           if (rev.revision_5_days) revCount++;
           if (rev.revision_6_days) revCount++;
           revisionMinutes += revCount * 30; // Each revision = 30min
         }
         console.log(`Revision time: ${(revisionMinutes / 60).toFixed(1)}h (${revisionConfigs.length} topics with revisions)`);
         totalMinutes += revisionMinutes;
       }

       console.log(`Estimated total time (with revisions): ${(totalMinutes / 60).toFixed(1)} hours for ${allSelectedTopicIds.length} topics`);
       return totalMinutes;
    },
    enabled: allSelectedTopicIds.length > 0,
  });

  // Estimated total minutes (from topic goals or default estimate)
  const estimatedTotalMinutes = useMemo(() => {
    if (topicGoalsTime && topicGoalsTime > 0) {
      return topicGoalsTime;
    }
    // Fallback: 30 minutes per selected topic
    return allSelectedTopicIds.length * 30;
  }, [topicGoalsTime, allSelectedTopicIds]);

  // Get ordered disciplines for display
  const orderedDisciplines = useMemo(() => {
    if (!schoolDisciplines) return [];
    
    const selected = schoolDisciplines.filter(sd => 
      formData.selectedDisciplines.includes(sd.discipline_id)
    );
    
    if (formData.disciplineOrder.length > 0) {
      return [...selected].sort((a, b) => {
        const indexA = formData.disciplineOrder.indexOf(a.discipline_id);
        const indexB = formData.disciplineOrder.indexOf(b.discipline_id);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }
    
    return selected;
  }, [schoolDisciplines, formData.selectedDisciplines, formData.disciplineOrder]);

  // Create/Update cronograma mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      
      // VALIDATION: Ensure all selected_disciplines exist in the database
      // This prevents "ghost IDs" from being saved
      if (formData.selectedDisciplines.length > 0) {
        const { data: validDisciplines, error: validationError } = await supabase
          .from("study_disciplines")
          .select("id")
          .in("id", formData.selectedDisciplines)
          .eq("is_active", true);
        
        if (validationError) {
          console.error("Error validating disciplines:", validationError);
          throw new Error("Erro ao validar disciplinas selecionadas");
        }
        
        const validIds = new Set(validDisciplines?.map(d => d.id) || []);
        const invalidIds = formData.selectedDisciplines.filter(id => !validIds.has(id));
        
        if (invalidIds.length > 0) {
          console.error("Invalid discipline IDs detected:", invalidIds);
          throw new Error(`Disciplinas inválidas detectadas (${invalidIds.length}). Por favor, recarregue a página e tente novamente.`);
        }
      }
      
      // Filter discipline_order to only include validated disciplines
      const validatedDisciplineOrder = formData.disciplineOrder.filter(
        id => formData.selectedDisciplines.includes(id)
      );
      
      const cronogramaData = {
        name: formData.name || `Cronograma ${new Date().toLocaleDateString()}`,
        school_id: formData.schoolId,
        start_date: formData.startDate,
        end_date: formData.endDate || null,
        available_days: formData.availableDays,
        hours_per_day: formData.hoursPerDay,
        hours_per_weekday: useCustomHoursPerDay ? formData.hoursPerWeekday : null,
        selected_disciplines: formData.selectedDisciplines,
        discipline_order: validatedDisciplineOrder,
        selected_topics: formData.selectedTopics,
        topic_order: formData.topicOrder,
        is_active: true,
      };
      
      if (isEditMode && cronogramaId) {
        // Update existing
        const { data, error } = await supabase
          .from("user_cronogramas")
          .update(cronogramaData)
          .eq("id", cronogramaId)
          .eq("user_id", user.id)
          .select()
          .single();
        
        if (error) throw error;
        return { data, isUpdate: true };
      } else {
        // Create new
        const { data, error } = await supabase
          .from("user_cronogramas")
          .insert({
            user_id: user.id,
            ...cronogramaData,
          })
          .select()
          .single();
        
        if (error) throw error;
        return { data, isUpdate: false };
      }
    },
    onSuccess: async ({ data, isUpdate }) => {
      toast.success(isUpdate ? "Cronograma atualizado!" : "Cronograma criado!");
      
      // Regenerate tasks
      setIsGeneratingTasks(true);
      toast.info(isUpdate ? "Regenerando tarefas..." : "Gerando tarefas...");
      
      try {
        // CRITICAL: For revision_only cronogramas, use revision generator instead of normal
        const isRevisionOnly = cronogramaType === 'revision_only';
        
        let result: { success: boolean; tasksCreated: number; tasksExcluded?: number; minutesExcluded?: number; error?: string };
        
        if (isRevisionOnly && revisionSourceId) {
          // Use revision-specific task generation
          console.log("[CronogramaCriar] Detected revision_only cronograma, using revision generator");
          
          // 1. Delete existing tasks
          await supabase
            .from("user_cronograma_tasks")
            .delete()
            .eq("cronograma_id", data.id);
          
          // 2. Fetch revision topics from the SOURCE cronograma
          const revisionTopics = await fetchRevisionTasksForCronograma(revisionSourceId, data.user_id);
          
          if (revisionTopics.length === 0) {
            result = { success: false, tasksCreated: 0, error: "Nenhuma revisão configurada para os tópicos" };
          } else {
            // 3. Generate available days
            const today = startOfDay(new Date());
            const parsedStart = data.start_date ? startOfDay(new Date(data.start_date + "T12:00:00")) : today;
            const effectiveStart = parsedStart > today ? parsedStart : today;
            
            const days = generateRevisionAvailableDays(
              effectiveStart,
              data.available_days || [],
              (data.hours_per_weekday as Record<string, number>) || {},
              data.hours_per_day || 2
            );
            
            // 4. Distribute revision tasks
            const { tasks: revTasks, tasksExcluded } = distributeRevisionTasks(
              revisionTopics,
              days,
              data.id,
              data.user_id
            );
            
            // 5. Insert revision tasks
            if (revTasks.length > 0) {
              for (let i = 0; i < revTasks.length; i += 100) {
                const batch = revTasks.slice(i, i + 100);
                await supabase.from("user_cronograma_tasks").insert(batch);
              }
            }
            
            // 6. Update end_date based on last task
            const lastDate = revTasks.length > 0 ? revTasks[revTasks.length - 1].scheduled_date : null;
            if (lastDate) {
              await supabase
                .from("user_cronogramas")
                .update({ end_date: lastDate } as any)
                .eq("id", data.id);
            }
            
            result = { 
              success: true, 
              tasksCreated: revTasks.length,
              tasksExcluded: tasksExcluded > 0 ? tasksExcluded : undefined,
              minutesExcluded: tasksExcluded > 0 ? tasksExcluded * 30 : undefined,
            };
          }
        } else {
          // Normal cronograma: use standard generator
          const taskFn = isUpdate ? recalculateTasks : generateTasks;
          result = await taskFn({
            id: data.id,
            user_id: data.user_id,
            school_id: data.school_id,
            start_date: data.start_date,
            end_date: data.end_date,
            available_days: data.available_days || [],
            hours_per_day: data.hours_per_day || 4,
            selected_disciplines: data.selected_disciplines || [],
            hours_per_weekday: (data.hours_per_weekday as Record<string, number>) || {},
            discipline_order: data.discipline_order || [],
            selected_topics: (data.selected_topics as Record<string, string[]>) || {},
            topic_order: (data.topic_order as Record<string, string[]>) || {},
          });
        }
        
        if (result.success) {
          if (result.tasksExcluded && result.tasksExcluded > 0 && result.minutesExcluded) {
            // Show dialog with excluded tasks info
            setExcludedDialogData({
              tasksCreated: result.tasksCreated,
              tasksExcluded: result.tasksExcluded,
              minutesExcluded: result.minutesExcluded,
              cronogramaId: data.id,
            });
            setExcludedDialogOpen(true);
            setIsGeneratingTasks(false);
            // Don't navigate yet - wait for user to close dialog
            return;
          } else {
            toast.success(`${result.tasksCreated} tarefas ${isUpdate ? 'atualizadas' : 'criadas'}!`);
          }
        } else {
          toast.warning(result.error || "Não foi possível gerar as tarefas");
        }
      } catch (err) {
        console.error("Error generating tasks:", err);
        toast.error("Erro ao gerar tarefas do cronograma");
      } finally {
        setIsGeneratingTasks(false);
      }
      
      navigate(`/cronograma/${data.id}${fromSuffix}`);
    },
    onError: (error) => {
      toast.error(isEditMode ? "Erro ao atualizar cronograma" : "Erro ao criar cronograma");
      console.error(error);
    },
  });

  const handleDayToggle = (dayId: string) => {
    setFormData(prev => {
      const newDays = prev.availableDays.includes(dayId)
        ? prev.availableDays.filter(d => d !== dayId)
        : [...prev.availableDays, dayId];
      
      // Remove hours for unchecked days
      const newHoursPerWeekday = { ...prev.hoursPerWeekday };
      if (!newDays.includes(dayId)) {
        delete newHoursPerWeekday[dayId];
      } else if (useCustomHoursPerDay && !newHoursPerWeekday[dayId]) {
        newHoursPerWeekday[dayId] = prev.hoursPerDay;
      }
      
      return {
        ...prev,
        availableDays: newDays,
        hoursPerWeekday: newHoursPerWeekday,
      };
    });
  };

  const handleHoursPerWeekdayChange = (dayId: string, hours: number) => {
    setFormData(prev => ({
      ...prev,
      hoursPerWeekday: {
        ...prev.hoursPerWeekday,
        [dayId]: hours,
      },
    }));
  };

  const handleDisciplineToggle = (disciplineId: string) => {
    setFormData(prev => {
      const isSelected = prev.selectedDisciplines.includes(disciplineId);
      const newSelected = isSelected
        ? prev.selectedDisciplines.filter(d => d !== disciplineId)
        : [...prev.selectedDisciplines, disciplineId];
      
      // Update discipline order
      let newOrder = [...prev.disciplineOrder];
      if (isSelected) {
        newOrder = newOrder.filter(d => d !== disciplineId);
      } else if (!newOrder.includes(disciplineId)) {
        newOrder.push(disciplineId);
      }
      
      // Clean up topics for unselected disciplines
      const newSelectedTopics = { ...prev.selectedTopics };
      const newTopicOrder = { ...prev.topicOrder };
      if (isSelected) {
        delete newSelectedTopics[disciplineId];
        delete newTopicOrder[disciplineId];
      }
      
      return {
        ...prev,
        selectedDisciplines: newSelected,
        disciplineOrder: newOrder,
        selectedTopics: newSelectedTopics,
        topicOrder: newTopicOrder,
      };
    });
  };

  const handleSelectAllMandatory = () => {
    const mandatoryIds = schoolDisciplines
      ?.filter(sd => sd.is_mandatory)
      .map(sd => sd.discipline_id) || [];
    
    setFormData(prev => {
      const newSelected = [...new Set([...prev.selectedDisciplines, ...mandatoryIds])];
      const newOrder = [...prev.disciplineOrder];
      for (const id of mandatoryIds) {
        if (!newOrder.includes(id)) {
          newOrder.push(id);
        }
      }
      return {
        ...prev,
        selectedDisciplines: newSelected,
        disciplineOrder: newOrder,
      };
    });
  };

  const handleDisciplineDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const newOrder = Array.from(formData.disciplineOrder);
    const [removed] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, removed);
    
    setFormData(prev => ({
      ...prev,
      disciplineOrder: newOrder,
    }));
  };

  const handleTopicToggle = (disciplineId: string, topicId: string) => {
    setFormData(prev => {
      const currentTopics = prev.selectedTopics[disciplineId] || [];
      const isSelected = currentTopics.includes(topicId);
      
      const newTopics = isSelected
        ? currentTopics.filter(t => t !== topicId)
        : [...currentTopics, topicId];
      
      // Update topic order
      let newOrder = [...(prev.topicOrder[disciplineId] || [])];
      if (isSelected) {
        newOrder = newOrder.filter(t => t !== topicId);
      } else if (!newOrder.includes(topicId)) {
        newOrder.push(topicId);
      }
      
      return {
        ...prev,
        selectedTopics: {
          ...prev.selectedTopics,
          [disciplineId]: newTopics,
        },
        topicOrder: {
          ...prev.topicOrder,
          [disciplineId]: newOrder,
        },
      };
    });
  };

  const handleSelectAllTopicsForDiscipline = (disciplineId: string) => {
    const disciplineTopics = topicsByDiscipline.get(disciplineId) || [];
    const allTopicIds = disciplineTopics.map(t => t.id);
    
    setFormData(prev => ({
      ...prev,
      selectedTopics: {
        ...prev.selectedTopics,
        [disciplineId]: allTopicIds,
      },
      topicOrder: {
        ...prev.topicOrder,
        [disciplineId]: allTopicIds,
      },
    }));
  };

  const handleTopicDragEnd = (disciplineId: string) => (result: DropResult) => {
    if (!result.destination) return;
    
    const currentOrder = formData.topicOrder[disciplineId] || [];
    const newOrder = Array.from(currentOrder);
    const [removed] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, removed);
    
    setFormData(prev => ({
      ...prev,
      topicOrder: {
        ...prev.topicOrder,
        [disciplineId]: newOrder,
      },
    }));
  };

  const toggleDisciplineExpanded = (disciplineId: string) => {
    setExpandedDisciplines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(disciplineId)) {
        newSet.delete(disciplineId);
      } else {
        newSet.add(disciplineId);
      }
      return newSet;
    });
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.editalId !== "" && formData.schoolId !== "";
      case 2:
        return formData.startDate && formData.availableDays.length > 0 && formData.hoursPerDay > 0;
      case 3:
        return formData.selectedDisciplines.length > 0;
      case 4:
        // At least one topic selected for at least one discipline
        return Object.values(formData.selectedTopics).some(topics => topics.length > 0);
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < 5) {
      // Auto-select all topics when entering step 4
      if (step === 3) {
        const newSelectedTopics: Record<string, string[]> = {};
        const newTopicOrder: Record<string, string[]> = {};
        
        for (const disciplineId of formData.selectedDisciplines) {
          const disciplineTopics = topicsByDiscipline.get(disciplineId) || [];
          const topicIds = disciplineTopics.map(t => t.id);
          newSelectedTopics[disciplineId] = topicIds;
          newTopicOrder[disciplineId] = topicIds;
        }
        
        setFormData(prev => ({
          ...prev,
          selectedTopics: newSelectedTopics,
          topicOrder: newTopicOrder,
        }));
        
        // Expand all disciplines
        setExpandedDisciplines(new Set(formData.selectedDisciplines));
      }
      setStep((step + 1) as Step);
    } else {
      saveMutation.mutate();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    } else {
      navigate(`/cronograma${fromSuffix}`);
    }
  };

  const getSelectedEditalName = () => {
    return editals?.find(e => e.id === formData.editalId)?.name || "";
  };

  const getSelectedSchoolName = () => {
    return schools?.find(s => s.id === formData.schoolId)?.name || "";
  };

  const getTotalSelectedTopics = () => {
    return Object.values(formData.selectedTopics).reduce((sum, topics) => sum + topics.length, 0);
  };

  const getOrderedTopicsForDiscipline = (disciplineId: string) => {
    const disciplineTopics = topicsByDiscipline.get(disciplineId) || [];
    const selectedTopicIds = formData.selectedTopics[disciplineId] || [];
    const order = formData.topicOrder[disciplineId] || [];
    
    return disciplineTopics
      .filter(t => selectedTopicIds.includes(t.id))
      .sort((a, b) => {
        const indexA = order.indexOf(a.id);
        const indexB = order.indexOf(b.id);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
  };

  if (authLoading || isLoadingCronograma) {
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

  return (
    <ConselhoThemeWrapper>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-bold">
                  {isEditMode ? "Editar Cronograma" : "Criar Cronograma"}
                </h1>
                <p className="text-sm text-muted-foreground">Passo {step} de 5</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-muted h-1">
        <div 
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${(step / 5) * 100}%` }}
        />
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {/* Step 1: Escolha do Edital e Escola */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <GraduationCap className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle>Escolha o Edital e a Escola</CardTitle>
                        <CardDescription>Para qual concurso você vai estudar?</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Edital Selection */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Edital *
                      </Label>
                      <Select 
                        value={formData.editalId} 
                        onValueChange={(v) => setFormData(prev => ({ 
                          ...prev, 
                          editalId: v, 
                          schoolId: "",
                          selectedDisciplines: [],
                          disciplineOrder: [],
                          selectedTopics: {},
                          topicOrder: {},
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o edital" />
                        </SelectTrigger>
                        <SelectContent>
                          {editals?.map((edital) => (
                            <SelectItem key={edital.id} value={edital.id}>
                              {edital.name}
                              {edital.areas && (
                                <span className="text-muted-foreground ml-1">({edital.areas.name})</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* School Selection */}
                    {formData.editalId && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <School className="w-4 h-4" />
                          Escola *
                        </Label>
                        {schools && schools.length > 0 ? (
                          <Select 
                            value={formData.schoolId} 
                            onValueChange={(v) => setFormData(prev => ({ 
                              ...prev, 
                              schoolId: v,
                              selectedDisciplines: [],
                              disciplineOrder: [],
                              selectedTopics: {},
                              topicOrder: {},
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a escola" />
                            </SelectTrigger>
                            <SelectContent>
                              {schools.map((school) => (
                                <SelectItem key={school.id} value={school.id}>
                                  {school.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
                            Nenhuma escola encontrada para este edital. Entre em contato com o administrador.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cronograma Name (Optional) */}
                    {formData.schoolId && (
                      <div className="space-y-2">
                        <Label>Nome do Cronograma (opcional)</Label>
                        <Input
                          placeholder="Ex: Meu cronograma principal"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 2: Configuração de Tempo */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle>Configure seu Tempo</CardTitle>
                        <CardDescription>Quando e quanto você vai estudar?</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Date Range */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Data de Início *</Label>
                        <Input
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data Final (opcional)</Label>
                        <Input
                          type="date"
                          value={formData.endDate}
                          min={formData.startDate}
                          onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                          placeholder="Deixe vazio para cálculo automático"
                        />
                        <p className="text-xs text-muted-foreground">
                          Se não definir, a data será calculada automaticamente com base nos tópicos selecionados
                        </p>
                      </div>
                    </div>

                    {/* Days of Week */}
                    <div className="space-y-3">
                      <Label>Dias Disponíveis *</Label>
                      <div className="flex flex-wrap gap-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => handleDayToggle(day.id)}
                            className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                              formData.availableDays.includes(day.id)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border hover:border-primary/50"
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Hours per Day */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Horas de Estudo por Dia *</Label>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="custom-hours" className="text-sm text-muted-foreground">
                            Horas por dia da semana
                          </Label>
                          <Switch
                            id="custom-hours"
                            checked={useCustomHoursPerDay}
                            onCheckedChange={(checked) => {
                              setUseCustomHoursPerDay(checked);
                              if (checked) {
                                // Initialize hours per weekday with default
                                const newHours: Record<string, number> = {};
                                for (const day of formData.availableDays) {
                                  newHours[day] = formData.hoursPerDay;
                                }
                                setFormData(prev => ({
                                  ...prev,
                                  hoursPerWeekday: newHours,
                                }));
                              }
                            }}
                          />
                        </div>
                      </div>

                      {!useCustomHoursPerDay ? (
                        <Select 
                          value={formData.hoursPerDay.toString()} 
                          onValueChange={(v) => setFormData(prev => ({ ...prev, hoursPerDay: parseFloat(v) }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione as horas" />
                          </SelectTrigger>
                          <SelectContent>
                            {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12].map((h) => (
                              <SelectItem key={h} value={h.toString()}>
                                {h < 1 ? `${h * 60} minutos` : h % 1 === 0 ? `${h} hora${h > 1 ? "s" : ""}` : `${Math.floor(h)}h ${(h % 1) * 60}min`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="space-y-3">
                          {formData.availableDays.map((dayId) => {
                            const day = DAYS_OF_WEEK.find(d => d.id === dayId);
                            return (
                              <div key={dayId} className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                                <span className="w-32 font-medium">{day?.fullLabel}</span>
                                <Select 
                                  value={(formData.hoursPerWeekday[dayId] || formData.hoursPerDay).toString()} 
                                  onValueChange={(v) => handleHoursPerWeekdayChange(dayId, parseFloat(v))}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12].map((h) => (
                                      <SelectItem key={h} value={h.toString()}>
                                        {h < 1 ? `${h * 60} min` : h % 1 === 0 ? `${h} hora${h > 1 ? "s" : ""}` : `${Math.floor(h)}h${(h % 1) * 60}min`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 3: Seleção e Ordenação de Disciplinas */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle>Selecione e Ordene as Disciplinas</CardTitle>
                          <CardDescription>Arraste para reordenar a prioridade</CardDescription>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleSelectAllMandatory}>
                        <Check className="w-4 h-4 mr-2" />
                        Obrigatórias
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {disciplinesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : schoolDisciplines && schoolDisciplines.length > 0 ? (
                      <>
                        {/* Selection */}
                        <div className="space-y-3 max-h-[300px] overflow-y-auto mb-6">
                          {schoolDisciplines.map((sd) => (
                            <label
                              key={sd.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                formData.selectedDisciplines.includes(sd.discipline_id)
                                  ? "bg-primary/5 border-primary"
                                  : "bg-background border-border hover:bg-muted/50"
                              }`}
                            >
                              <Checkbox
                                checked={formData.selectedDisciplines.includes(sd.discipline_id)}
                                onCheckedChange={() => handleDisciplineToggle(sd.discipline_id)}
                              />
                              <div className="flex-1">
                                <span className="font-medium">{sd.study_disciplines.name}</span>
                              </div>
                              {sd.is_mandatory && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                  Obrigatória
                                </span>
                              )}
                            </label>
                          ))}
                        </div>

                        {/* Order */}
                        {formData.selectedDisciplines.length > 0 && (
                          <>
                            <div className="border-t pt-4 mb-3">
                              <Label className="flex items-center gap-2 mb-3">
                                <ListOrdered className="w-4 h-4" />
                                Ordem de Estudo (arraste para reordenar)
                              </Label>
                            </div>
                            <DragDropContext onDragEnd={handleDisciplineDragEnd}>
                              <Droppable droppableId="disciplines">
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className="space-y-2"
                                  >
                                    {orderedDisciplines.map((sd, index) => (
                                      <Draggable 
                                        key={sd.discipline_id} 
                                        draggableId={sd.discipline_id} 
                                        index={index}
                                      >
                                        {(provided, snapshot) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            className={`flex items-center gap-3 p-3 rounded-lg border bg-background transition-colors ${
                                              snapshot.isDragging ? "border-primary shadow-lg" : "border-border"
                                            }`}
                                          >
                                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                                            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-medium">
                                              {index + 1}
                                            </span>
                                            <span className="flex-1 font-medium">{sd.study_disciplines.name}</span>
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            </DragDropContext>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhuma disciplina encontrada para esta escola.
                      </div>
                    )}

                    {schoolDisciplines && schoolDisciplines.length > 0 && (
                      <div className="mt-4 pt-4 border-t text-sm text-muted-foreground text-center">
                        {formData.selectedDisciplines.length} de {schoolDisciplines.length} disciplinas selecionadas
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 4: Seleção e Ordenação de Tópicos */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <ListOrdered className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle>Selecione e Ordene os Tópicos</CardTitle>
                        <CardDescription>Escolha e ordene os tópicos de cada disciplina</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {topicsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[500px] overflow-y-auto">
                        {orderedDisciplines.map((sd) => {
                          const disciplineTopics = topicsByDiscipline.get(sd.discipline_id) || [];
                          const selectedTopicIds = formData.selectedTopics[sd.discipline_id] || [];
                          const isExpanded = expandedDisciplines.has(sd.discipline_id);
                          const orderedSelectedTopics = getOrderedTopicsForDiscipline(sd.discipline_id);

                          return (
                            <div key={sd.discipline_id} className="border rounded-lg">
                              <button
                                type="button"
                                onClick={() => toggleDisciplineExpanded(sd.discipline_id)}
                                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  {isExpanded ? (
                                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                  )}
                                  <span className="font-medium">{sd.study_disciplines.name}</span>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {selectedTopicIds.length}/{disciplineTopics.length} tópicos
                                </span>
                              </button>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="p-4 pt-0 space-y-4">
                                      {/* Select all button */}
                                      <div className="flex justify-end">
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => handleSelectAllTopicsForDiscipline(sd.discipline_id)}
                                        >
                                          <Check className="w-4 h-4 mr-2" />
                                          Selecionar Todos
                                        </Button>
                                      </div>

                                      {/* Topic selection */}
                                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                        {disciplineTopics.map((topic) => (
                                          <label
                                            key={topic.id}
                                            className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                                              selectedTopicIds.includes(topic.id)
                                                ? "bg-primary/5 border-primary"
                                                : "bg-background border-border hover:bg-muted/50"
                                            }`}
                                          >
                                            <Checkbox
                                              checked={selectedTopicIds.includes(topic.id)}
                                              onCheckedChange={() => handleTopicToggle(sd.discipline_id, topic.id)}
                                            />
                                            <span className="text-sm">{topic.name}</span>
                                          </label>
                                        ))}
                                      </div>

                                      {/* Topic order */}
                                      {orderedSelectedTopics.length > 1 && (
                                        <>
                                          <div className="border-t pt-3">
                                            <Label className="text-sm text-muted-foreground mb-2 block">
                                              Ordem dos tópicos (arraste para reordenar)
                                            </Label>
                                          </div>
                                          <DragDropContext onDragEnd={handleTopicDragEnd(sd.discipline_id)}>
                                            <Droppable droppableId={`topics-${sd.discipline_id}`}>
                                              {(provided) => (
                                                <div
                                                  ref={provided.innerRef}
                                                  {...provided.droppableProps}
                                                  className="space-y-1"
                                                >
                                                  {orderedSelectedTopics.map((topic, index) => (
                                                    <Draggable 
                                                      key={topic.id} 
                                                      draggableId={topic.id} 
                                                      index={index}
                                                    >
                                                      {(provided, snapshot) => (
                                                        <div
                                                          ref={provided.innerRef}
                                                          {...provided.draggableProps}
                                                          {...provided.dragHandleProps}
                                                          className={`flex items-center gap-2 p-2 rounded border bg-background text-sm transition-colors ${
                                                            snapshot.isDragging ? "border-primary shadow-lg" : "border-border"
                                                          }`}
                                                        >
                                                          <GripVertical className="w-3 h-3 text-muted-foreground" />
                                                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                                                            {index + 1}
                                                          </span>
                                                          <span className="flex-1 truncate">{topic.name}</span>
                                                        </div>
                                                      )}
                                                    </Draggable>
                                                  ))}
                                                  {provided.placeholder}
                                                </div>
                                              )}
                                            </Droppable>
                                          </DragDropContext>
                                        </>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t text-sm text-muted-foreground text-center">
                      {getTotalSelectedTopics()} tópicos selecionados no total
                    </div>

                    {/* End Date Warning - Show after topics are selected */}
                    {estimatedTotalMinutes > 0 && (
                      <div className="mt-4">
                        <EndDateWarning
                          startDate={formData.startDate}
                          endDate={formData.endDate}
                          availableDays={formData.availableDays}
                          hoursPerDay={formData.hoursPerDay}
                          hoursPerWeekday={formData.hoursPerWeekday}
                          useCustomHoursPerDay={useCustomHoursPerDay}
                          estimatedTotalMinutes={estimatedTotalMinutes}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 5: Confirmação */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Check className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <CardTitle>Confirme seu Cronograma</CardTitle>
                        <CardDescription>Revise as informações antes de criar</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4">
                      <div className="bg-muted p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">Edital</p>
                        <p className="font-medium flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          {getSelectedEditalName()}
                        </p>
                      </div>

                      <div className="bg-muted p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">Escola</p>
                        <p className="font-medium flex items-center gap-2">
                          <School className="w-4 h-4" />
                          {getSelectedSchoolName()}
                        </p>
                      </div>

                      {formData.name && (
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-sm text-muted-foreground">Nome</p>
                          <p className="font-medium">{formData.name}</p>
                        </div>
                      )}

                      <div className="bg-muted p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">Período</p>
                        <p className="font-medium">
                          {new Date(formData.startDate).toLocaleDateString()}
                          {formData.endDate && ` até ${new Date(formData.endDate).toLocaleDateString()}`}
                        </p>
                      </div>

                      <div className="bg-muted p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">Dias de Estudo</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {formData.availableDays.map((day) => {
                            const dayData = DAYS_OF_WEEK.find(d => d.id === day);
                            const hours = useCustomHoursPerDay 
                              ? formData.hoursPerWeekday[day] || formData.hoursPerDay
                              : formData.hoursPerDay;
                            return (
                              <span 
                                key={day} 
                                className="px-2 py-1 bg-primary/10 text-primary text-sm rounded"
                              >
                                {dayData?.label} {useCustomHoursPerDay && `(${hours}h)`}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {!useCustomHoursPerDay && (
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-sm text-muted-foreground">Horas por Dia</p>
                          <p className="font-medium">{formData.hoursPerDay} hora{formData.hoursPerDay > 1 ? "s" : ""}</p>
                        </div>
                      )}

                      <div className="bg-muted p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">Disciplinas ({formData.selectedDisciplines.length})</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {orderedDisciplines.map((sd, index) => (
                            <span 
                              key={sd.discipline_id} 
                              className="px-2 py-1 bg-secondary text-secondary-foreground text-sm rounded"
                            >
                              {index + 1}. {sd.study_disciplines.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="bg-muted p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">Tópicos Selecionados</p>
                        <p className="font-medium">{getTotalSelectedTopics()} tópicos</p>
                      </div>

                      {/* Estimated Study Time */}
                      <div className="bg-muted p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">Tempo Total Estimado</p>
                        <p className="font-medium">
                          {estimatedTotalMinutes >= 60 
                            ? `${Math.floor(estimatedTotalMinutes / 60)}h${estimatedTotalMinutes % 60 > 0 ? ` ${estimatedTotalMinutes % 60}min` : ''}`
                            : `${estimatedTotalMinutes}min`
                          }
                        </p>
                      </div>
                    </div>

                    {/* End Date Warning - Show when we have end date */}
                    {estimatedTotalMinutes > 0 && (
                      <EndDateWarning
                        startDate={formData.startDate}
                        endDate={formData.endDate}
                        availableDays={formData.availableDays}
                        hoursPerDay={formData.hoursPerDay}
                        hoursPerWeekday={formData.hoursPerWeekday}
                        useCustomHoursPerDay={useCustomHoursPerDay}
                        estimatedTotalMinutes={estimatedTotalMinutes}
                      />
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={handleNext} disabled={!canProceed() || saveMutation.isPending || isGeneratingTasks}>
              {(saveMutation.isPending || isGeneratingTasks) ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : step === 5 ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              {step === 5 ? (isEditMode ? "Salvar Alterações" : "Criar Cronograma") : "Próximo"}
            </Button>
          </div>
        </div>
      </main>

      {/* Tasks Excluded Dialog */}
      <TasksExcludedDialog
        open={excludedDialogOpen}
        onOpenChange={(open) => {
          setExcludedDialogOpen(open);
          // If dialog is closed, navigate to cronograma
          if (!open && excludedDialogData?.cronogramaId) {
            navigate(`/cronograma/${excludedDialogData.cronogramaId}${fromSuffix}`);
          }
        }}
        tasksCreated={excludedDialogData?.tasksCreated || 0}
        tasksExcluded={excludedDialogData?.tasksExcluded || 0}
        minutesExcluded={excludedDialogData?.minutesExcluded || 0}
        onContinue={() => {
          if (excludedDialogData?.cronogramaId) {
            navigate(`/cronograma/${excludedDialogData.cronogramaId}${fromSuffix}`);
          }
        }}
        onAdjustSettings={() => {
          setExcludedDialogOpen(false);
          setStep(1);
        }}
      />
    </div>
    </ConselhoThemeWrapper>
  );
}
