import { useState, useMemo, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useCronogramaTaskGenerator } from "@/hooks/useCronogramaTaskGenerator";
import { fetchRevisionTasksForCronograma, generateRevisionAvailableDays, distributeRevisionTasks } from "@/hooks/useCreateRevisionCronograma";
import { normalizeCronogramaConfig } from "@/lib/cronograma/normalizeCronogramaConfig";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { EndDateWarning } from "@/components/cronograma/EndDateWarning";
import { TasksExcludedDialog } from "@/components/cronograma/TasksExcludedDialog";

interface AdminCronogramaEditorProps {
  cronogramaId: string;
  userId: string;
  onBack: () => void;
  onSuccess: () => void;
}

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

export function AdminCronogramaEditor({ cronogramaId, userId, onBack, onSuccess }: AdminCronogramaEditorProps) {
  const { generateTasks, recalculateTasks } = useCronogramaTaskGenerator();
  
  const [step, setStep] = useState<Step>(1);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [useCustomHoursPerDay, setUseCustomHoursPerDay] = useState(false);
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set());
  const [isLoadingCronograma, setIsLoadingCronograma] = useState(true);
  const [cronogramaType, setCronogramaType] = useState<string | null>(null);
  
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
    selectedTopics: {} as Record<string, string[]>,
    topicOrder: {} as Record<string, string[]>,
  });

  // Load existing cronograma data
  useEffect(() => {
    const loadCronograma = async () => {
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
          .single();
        
        if (error) throw error;
        if (!data) {
          toast.error("Cronograma não encontrado");
          onBack();
          return;
        }
        
        const hasCustomHours = data.hours_per_weekday && 
          Object.keys(data.hours_per_weekday as Record<string, number>).length > 0;
        setUseCustomHoursPerDay(hasCustomHours);
        setCronogramaType((data as any).cronograma_type || 'normal');
        
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
        onBack();
      } finally {
        setIsLoadingCronograma(false);
      }
    };
    
    loadCronograma();
  }, [cronogramaId, onBack]);

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

  // Fetch topics for selected disciplines
  const { data: topics, isLoading: topicsLoading } = useQuery({
    queryKey: ["discipline-topics", formData.selectedDisciplines],
    queryFn: async (): Promise<StudyTopic[]> => {
      if (formData.selectedDisciplines.length === 0) return [];
      
      const { data, error } = await supabase
        .from("study_topics")
        .select("id, name, study_discipline_id, display_order")
        .in("study_discipline_id", formData.selectedDisciplines)
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      return data || [];
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

  // Fetch real topic_goals durations for selected topics (for accurate EndDateWarning)
  const allSelectedTopicIds = useMemo(() => 
    Object.values(formData.selectedTopics).flat(), 
    [formData.selectedTopics]
  );

  const { data: topicGoalsDurations } = useQuery({
    queryKey: ["topic-goals-durations", allSelectedTopicIds],
    queryFn: async () => {
      if (allSelectedTopicIds.length === 0) return 0;
      // Query in batches to avoid URL length limits
      const batchSize = 200;
      let totalMinutes = 0;
      for (let i = 0; i < allSelectedTopicIds.length; i += batchSize) {
        const batch = allSelectedTopicIds.slice(i, i + batchSize);
        const { data } = await supabase
          .from("topic_goals")
          .select("duration_minutes")
          .in("topic_id", batch)
          .eq("is_active", true);
        totalMinutes += (data || []).reduce((sum, g) => sum + (g.duration_minutes || 0), 0);
      }
      // Add revision estimates: 30min per active revision cycle per topic
      const { data: revisions } = await supabase
        .from("topic_revisions")
        .select("revision_1_days, revision_2_days, revision_3_days, revision_4_days, revision_5_days, revision_6_days")
        .in("topic_id", allSelectedTopicIds)
        .eq("is_active", true);
      for (const rev of revisions || []) {
        if (rev.revision_1_days && rev.revision_1_days > 0) totalMinutes += 30;
        if (rev.revision_2_days && rev.revision_2_days > 0) totalMinutes += 30;
        if (rev.revision_3_days && rev.revision_3_days > 0) totalMinutes += 30;
        if (rev.revision_4_days && rev.revision_4_days > 0) totalMinutes += 30;
        if (rev.revision_5_days && rev.revision_5_days > 0) totalMinutes += 30;
        if (rev.revision_6_days && rev.revision_6_days > 0) totalMinutes += 30;
      }
      return totalMinutes;
    },
    enabled: allSelectedTopicIds.length > 0,
    staleTime: 30000,
  });

  const estimatedTotalMinutes = topicGoalsDurations ?? (allSelectedTopicIds.length * 30);

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

  // Handlers
  const handleDayToggle = (dayId: string) => {
    setFormData(prev => ({
      ...prev,
      availableDays: prev.availableDays.includes(dayId)
        ? prev.availableDays.filter(d => d !== dayId)
        : [...prev.availableDays, dayId],
    }));
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
      
      if (isSelected) {
        const newSelectedTopics = { ...prev.selectedTopics };
        delete newSelectedTopics[disciplineId];
        const newTopicOrder = { ...prev.topicOrder };
        delete newTopicOrder[disciplineId];
        
        return {
          ...prev,
          selectedDisciplines: prev.selectedDisciplines.filter(id => id !== disciplineId),
          disciplineOrder: prev.disciplineOrder.filter(id => id !== disciplineId),
          selectedTopics: newSelectedTopics,
          topicOrder: newTopicOrder,
        };
      } else {
        const disciplineTopics = topics?.filter(t => t.study_discipline_id === disciplineId) || [];
        const topicIds = disciplineTopics.map(t => t.id);
        
        return {
          ...prev,
          selectedDisciplines: [...prev.selectedDisciplines, disciplineId],
          disciplineOrder: [...prev.disciplineOrder, disciplineId],
          selectedTopics: {
            ...prev.selectedTopics,
            [disciplineId]: topicIds,
          },
          topicOrder: {
            ...prev.topicOrder,
            [disciplineId]: topicIds,
          },
        };
      }
    });
  };

  const handleDisciplineDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const items = [...formData.disciplineOrder];
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setFormData(prev => ({
      ...prev,
      disciplineOrder: items,
    }));
  };

  const handleTopicToggle = (disciplineId: string, topicId: string) => {
    setFormData(prev => {
      const currentTopics = prev.selectedTopics[disciplineId] || [];
      const isSelected = currentTopics.includes(topicId);
      
      const newSelectedTopics = isSelected
        ? currentTopics.filter(id => id !== topicId)
        : [...currentTopics, topicId];
      
      let newTopicOrder = prev.topicOrder[disciplineId] || [];
      if (!isSelected) {
        newTopicOrder = [...newTopicOrder, topicId];
      } else {
        newTopicOrder = newTopicOrder.filter(id => id !== topicId);
      }
      
      return {
        ...prev,
        selectedTopics: {
          ...prev.selectedTopics,
          [disciplineId]: newSelectedTopics,
        },
        topicOrder: {
          ...prev.topicOrder,
          [disciplineId]: newTopicOrder,
        },
      };
    });
  };

  const handleSelectAllTopicsForDiscipline = (disciplineId: string) => {
    const disciplineTopics = topicsByDiscipline.get(disciplineId) || [];
    const allTopicIds = disciplineTopics.map(t => t.id);
    const currentSelected = formData.selectedTopics[disciplineId] || [];
    
    const allSelected = allTopicIds.every(id => currentSelected.includes(id));
    
    setFormData(prev => ({
      ...prev,
      selectedTopics: {
        ...prev.selectedTopics,
        [disciplineId]: allSelected ? [] : allTopicIds,
      },
      topicOrder: {
        ...prev.topicOrder,
        [disciplineId]: allSelected ? [] : allTopicIds,
      },
    }));
  };

  const handleTopicDragEnd = (disciplineId: string) => (result: DropResult) => {
    if (!result.destination) return;
    
    const items = [...(formData.topicOrder[disciplineId] || formData.selectedTopics[disciplineId] || [])];
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setFormData(prev => ({
      ...prev,
      topicOrder: {
        ...prev.topicOrder,
        [disciplineId]: items,
      },
    }));
  };

  const handleNext = () => {
    if (step < 5) setStep((step + 1) as Step);
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.editalId && formData.schoolId;
      case 2:
        return formData.startDate && formData.availableDays.length > 0;
      case 3:
        return formData.hoursPerDay > 0 || Object.keys(formData.hoursPerWeekday).length > 0;
      case 4:
        return formData.selectedDisciplines.length > 0;
      case 5:
        return Object.values(formData.selectedTopics).some(arr => arr.length > 0);
      default:
        return false;
    }
  };

  const handleSave = async () => {
    setIsGeneratingTasks(true);
    
    try {
      // CORREÇÃO: Sanitizar configuração para evitar UUIDs fantasmas
      const normalized = normalizeCronogramaConfig({
        selected_disciplines: formData.selectedDisciplines,
        discipline_order: formData.disciplineOrder,
        selected_topics: formData.selectedTopics,
        topic_order: formData.topicOrder,
      });
      
      const cronogramaData = {
        name: formData.name || `Cronograma ${new Date().toLocaleDateString()}`,
        school_id: formData.schoolId,
        start_date: formData.startDate,
        end_date: formData.endDate || null,
        available_days: formData.availableDays,
        hours_per_day: formData.hoursPerDay,
        hours_per_weekday: useCustomHoursPerDay ? formData.hoursPerWeekday : null,
        selected_disciplines: normalized.selected_disciplines,
        discipline_order: normalized.discipline_order,
        selected_topics: normalized.selected_topics,
        topic_order: normalized.topic_order,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      
      const { error } = await supabase
        .from("user_cronogramas")
        .update(cronogramaData)
        .eq("id", cronogramaId);
      
      if (error) throw error;

      // === BRANCH: revision_only usa gerador de revisão, nunca o gerador padrão ===
      if (cronogramaType === 'revision_only') {
        await handleSaveRevisionOnly(normalized);
      } else {
        await handleSaveNormal(normalized);
      }
    } catch (error) {
      console.error("Error saving cronograma:", error);
      toast.error("Erro ao salvar cronograma");
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  /** Salva cronograma normal com recalculateTasks padrão */
  const handleSaveNormal = async (normalized: ReturnType<typeof normalizeCronogramaConfig>) => {
    const result = await recalculateTasks({
      id: cronogramaId,
      user_id: userId,
      school_id: formData.schoolId,
      start_date: formData.startDate,
      end_date: formData.endDate || null,
      available_days: formData.availableDays,
      hours_per_day: formData.hoursPerDay,
      selected_disciplines: normalized.selected_disciplines,
      hours_per_weekday: useCustomHoursPerDay ? formData.hoursPerWeekday : undefined,
      discipline_order: normalized.discipline_order,
      selected_topics: normalized.selected_topics,
      topic_order: normalized.topic_order,
    });

    if (result.success) {
      if (result.tasksExcluded && result.tasksExcluded > 0 && result.minutesExcluded) {
        setExcludedDialogData({
          tasksCreated: result.tasksCreated,
          tasksExcluded: result.tasksExcluded,
          minutesExcluded: result.minutesExcluded,
          cronogramaId: cronogramaId,
        });
        setExcludedDialogOpen(true);
      } else {
        toast.success(`Cronograma atualizado! ${result.tasksCreated} tarefas geradas.`);
        onSuccess();
      }
    } else {
      toast.error(result.error || "Erro ao gerar tarefas");
    }
  };

  /** Salva cronograma revision_only: gera APENAS tarefas de revisão */
  const handleSaveRevisionOnly = async (normalized: ReturnType<typeof normalizeCronogramaConfig>) => {
    try {
      // Coletar todos os tópicos selecionados
      const allSelectedTopicIds: string[] = [];
      for (const topicIds of Object.values(normalized.selected_topics)) {
        allSelectedTopicIds.push(...topicIds);
      }

      if (allSelectedTopicIds.length === 0) {
        toast.error("Nenhum tópico selecionado para revisão");
        return;
      }

      // Buscar revisões configuradas para os tópicos selecionados
      const { data: revisions, error: revError } = await supabase
        .from("topic_revisions")
        .select("topic_id, revision_1_days, revision_2_days, revision_3_days, revision_4_days, revision_5_days, revision_6_days")
        .in("topic_id", allSelectedTopicIds)
        .eq("is_active", true);

      if (revError) throw revError;

      if (!revisions || revisions.length === 0) {
        toast.error("Nenhuma revisão configurada para os tópicos selecionados");
        return;
      }

      // Buscar info dos tópicos
      const revTopicIds = revisions.map(r => r.topic_id);
      const { data: topicsData } = await supabase
        .from("study_topics")
        .select("id, name, study_discipline_id")
        .in("id", revTopicIds);

      const topicMap = new Map((topicsData || []).map(t => [t.id, t]));

      // Montar revisionTopics
      const revisionTopics: { topicId: string; disciplineId: string; revisionCycles: number }[] = [];
      for (const rev of revisions) {
        const topic = topicMap.get(rev.topic_id);
        if (!topic) continue;
        let cycles = 0;
        if (rev.revision_1_days && rev.revision_1_days > 0) cycles++;
        if (rev.revision_2_days && rev.revision_2_days > 0) cycles++;
        if (rev.revision_3_days && rev.revision_3_days > 0) cycles++;
        if (rev.revision_4_days && rev.revision_4_days > 0) cycles++;
        if (rev.revision_5_days && rev.revision_5_days > 0) cycles++;
        if (rev.revision_6_days && rev.revision_6_days > 0) cycles++;
        if (cycles > 0) {
          revisionTopics.push({
            topicId: rev.topic_id,
            disciplineId: topic.study_discipline_id,
            revisionCycles: cycles,
          });
        }
      }

      if (revisionTopics.length === 0) {
        toast.error("Nenhum tópico possui ciclos de revisão configurados");
        return;
      }

      // Gerar dias disponíveis
      const hoursPerWeekday = useCustomHoursPerDay ? formData.hoursPerWeekday : {};
      const days = generateRevisionAvailableDays(
        new Date(formData.startDate),
        formData.availableDays,
        hoursPerWeekday,
        formData.hoursPerDay
      );

      // Distribuir tarefas de revisão
      const { tasks: revTasks, tasksExcluded } = distributeRevisionTasks(
        revisionTopics,
        days,
        cronogramaId,
        userId
      );

      // Deletar tarefas antigas
      const { error: deleteError } = await supabase
        .from("user_cronograma_tasks")
        .delete()
        .eq("cronograma_id", cronogramaId);

      if (deleteError) throw deleteError;

      // Inserir novas tarefas em lotes
      if (revTasks.length > 0) {
        for (let i = 0; i < revTasks.length; i += 100) {
          const batch = revTasks.slice(i, i + 100);
          const { error: insertError } = await supabase
            .from("user_cronograma_tasks")
            .insert(batch);
          if (insertError) throw insertError;
        }
      }

      // Atualizar end_date baseado na última tarefa
      const lastDate = revTasks.length > 0 ? revTasks[revTasks.length - 1].scheduled_date : null;
      if (lastDate) {
        await supabase
          .from("user_cronogramas")
          .update({ end_date: lastDate })
          .eq("id", cronogramaId);
      }

      if (tasksExcluded > 0) {
        setExcludedDialogData({
          tasksCreated: revTasks.length,
          tasksExcluded,
          minutesExcluded: tasksExcluded * 30,
          cronogramaId,
        });
        setExcludedDialogOpen(true);
      } else {
        toast.success(`Cronograma de revisão atualizado! ${revTasks.length} tarefas de revisão geradas.`);
        onSuccess();
      }
    } catch (error) {
      console.error("[RevisionEditor] Error:", error);
      toast.error("Erro ao gerar tarefas de revisão");
    }
  };

  if (isLoadingCronograma) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const stepTitles = [
    { step: 1, title: "Edital e Escola", icon: GraduationCap },
    { step: 2, title: "Período e Dias", icon: Calendar },
    { step: 3, title: "Horas de Estudo", icon: Clock },
    { step: 4, title: "Disciplinas", icon: BookOpen },
    { step: 5, title: "Tópicos", icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            Editar Cronograma
            {cronogramaType === 'revision_only' && (
              <span className="text-sm font-normal bg-accent text-accent-foreground px-2 py-0.5 rounded">🔄 Revisão</span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formData.name || "Novo cronograma"}
            {cronogramaType === 'revision_only' && " — Ao salvar, serão geradas apenas tarefas de revisão"}
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex justify-center gap-2">
        {stepTitles.map(({ step: s, title, icon: Icon }) => (
          <div
            key={s}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${
              s === step
                ? "bg-primary text-primary-foreground"
                : s < step
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{title}</span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Edital e Escola
                </CardTitle>
                <CardDescription>Selecione o edital e a escola do cronograma</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Cronograma (opcional)</Label>
                  <Input
                    placeholder="Meu cronograma de estudos"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Edital</Label>
                  <Select
                    value={formData.editalId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, editalId: value, schoolId: "" }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um edital" />
                    </SelectTrigger>
                    <SelectContent>
                      {editals?.map((edital) => (
                        <SelectItem key={edital.id} value={edital.id}>
                          {edital.name} {edital.areas?.name && `(${edital.areas.name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Escola</Label>
                  <Select
                    value={formData.schoolId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, schoolId: value }))}
                    disabled={!formData.editalId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma escola" />
                    </SelectTrigger>
                    <SelectContent>
                      {schools?.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Período e Dias Disponíveis
                </CardTitle>
                <CardDescription>Defina o período e quais dias você pode estudar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data de Início</Label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de Término (opcional)</Label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      min={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>

                {formData.endDate && (
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

                <div className="space-y-3">
                  <Label>Dias Disponíveis</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <Button
                        key={day.id}
                        variant={formData.availableDays.includes(day.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleDayToggle(day.id)}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Horas de Estudo
                </CardTitle>
                <CardDescription>Defina quantas horas por dia você vai estudar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <Switch
                    checked={useCustomHoursPerDay}
                    onCheckedChange={setUseCustomHoursPerDay}
                  />
                  <Label>Definir horas diferentes por dia da semana</Label>
                </div>

                {!useCustomHoursPerDay ? (
                  <div className="space-y-2">
                    <Label>Horas por Dia</Label>
                    <Select
                      value={String(formData.hoursPerDay)}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, hoursPerDay: parseFloat(value) }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12].map((h) => (
                          <SelectItem key={h} value={String(h)}>
                            {h < 1 ? `${h * 60} minutos` : h % 1 === 0 ? `${h} hora${h > 1 ? "s" : ""}` : `${Math.floor(h)}h ${(h % 1) * 60}min`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {formData.availableDays.map((dayId) => {
                      const day = DAYS_OF_WEEK.find(d => d.id === dayId);
                      if (!day) return null;
                      
                      return (
                        <div key={dayId} className="space-y-2">
                          <Label>{day.fullLabel}</Label>
                          <Select
                            value={String(formData.hoursPerWeekday[dayId] || formData.hoursPerDay)}
                            onValueChange={(value) => handleHoursPerWeekdayChange(dayId, parseFloat(value))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12].map((h) => (
                                <SelectItem key={h} value={String(h)}>
                                  {h < 1 ? `${h * 60}min` : h % 1 === 0 ? `${h}h` : `${Math.floor(h)}h${(h % 1) * 60}min`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Disciplinas
                </CardTitle>
                <CardDescription>Selecione e ordene as disciplinas do cronograma</CardDescription>
              </CardHeader>
              <CardContent>
                {disciplinesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <DragDropContext onDragEnd={handleDisciplineDragEnd}>
                    <Droppable droppableId="disciplines">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                          {schoolDisciplines?.map((sd, index) => {
                            const isSelected = formData.selectedDisciplines.includes(sd.discipline_id);
                            const orderIndex = formData.disciplineOrder.indexOf(sd.discipline_id);
                            
                            return (
                              <Draggable
                                key={sd.discipline_id}
                                draggableId={sd.discipline_id}
                                index={orderIndex !== -1 ? orderIndex : index}
                                isDragDisabled={!isSelected}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                                      isSelected ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                                    } ${snapshot.isDragging ? "shadow-lg" : ""}`}
                                  >
                                    {isSelected && (
                                      <div {...provided.dragHandleProps}>
                                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                      </div>
                                    )}
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => handleDisciplineToggle(sd.discipline_id)}
                                    />
                                    <span className="flex-1">{sd.study_disciplines.name}</span>
                                    {sd.is_mandatory && (
                                      <span className="text-xs text-muted-foreground">(obrigatória)</span>
                                    )}
                                    {isSelected && orderIndex !== -1 && (
                                      <span className="text-xs font-medium text-primary">#{orderIndex + 1}</span>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                )}
              </CardContent>
            </Card>
          )}

          {step === 5 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Tópicos
                </CardTitle>
                <CardDescription>Selecione e ordene os tópicos de cada disciplina</CardDescription>
              </CardHeader>
              <CardContent>
                {topicsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orderedDisciplines.map((sd) => {
                      const disciplineTopics = topicsByDiscipline.get(sd.discipline_id) || [];
                      const selectedTopicIds = formData.selectedTopics[sd.discipline_id] || [];
                      const isExpanded = expandedDisciplines.has(sd.discipline_id);
                      
                      return (
                        <div key={sd.discipline_id} className="border rounded-lg">
                          <div
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              setExpandedDisciplines(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(sd.discipline_id)) {
                                  newSet.delete(sd.discipline_id);
                                } else {
                                  newSet.add(sd.discipline_id);
                                }
                                return newSet;
                              });
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <span className="font-medium flex-1">{sd.study_disciplines.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {selectedTopicIds.length}/{disciplineTopics.length}
                            </span>
                          </div>
                          
                          {isExpanded && (
                            <div className="p-3 pt-0">
                              <div className="flex justify-end mb-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSelectAllTopicsForDiscipline(sd.discipline_id)}
                                >
                                  {selectedTopicIds.length === disciplineTopics.length ? "Desmarcar todos" : "Selecionar todos"}
                                </Button>
                              </div>
                              
                              <DragDropContext onDragEnd={handleTopicDragEnd(sd.discipline_id)}>
                                <Droppable droppableId={`topics-${sd.discipline_id}`}>
                                  {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
                                      {disciplineTopics.map((topic, idx) => {
                                        const isSelected = selectedTopicIds.includes(topic.id);
                                        const orderIdx = (formData.topicOrder[sd.discipline_id] || []).indexOf(topic.id);
                                        
                                        return (
                                          <Draggable
                                            key={topic.id}
                                            draggableId={topic.id}
                                            index={orderIdx !== -1 ? orderIdx : idx}
                                            isDragDisabled={!isSelected}
                                          >
                                            {(provided, snapshot) => (
                                              <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={`flex items-center gap-2 p-2 rounded ${
                                                  isSelected ? "bg-primary/5" : ""
                                                } ${snapshot.isDragging ? "shadow-md" : ""}`}
                                              >
                                                {isSelected && (
                                                  <div {...provided.dragHandleProps}>
                                                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                                                  </div>
                                                )}
                                                <Checkbox
                                                  checked={isSelected}
                                                  onCheckedChange={() => handleTopicToggle(sd.discipline_id, topic.id)}
                                                />
                                                <span className="text-sm flex-1">{topic.name}</span>
                                                {isSelected && orderIdx !== -1 && (
                                                  <span className="text-xs text-muted-foreground">#{orderIdx + 1}</span>
                                                )}
                                              </div>
                                            )}
                                          </Draggable>
                                        );
                                      })}
                                      {provided.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                              </DragDropContext>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={step === 1}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        
        {step < 5 ? (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Próximo
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={!canProceed() || isGeneratingTasks}>
            {isGeneratingTasks ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Salvar Cronograma
              </>
            )}
          </Button>
        )}
      </div>

      {/* Tasks Excluded Dialog */}
      <TasksExcludedDialog
        open={excludedDialogOpen}
        onOpenChange={setExcludedDialogOpen}
        tasksCreated={excludedDialogData?.tasksCreated || 0}
        tasksExcluded={excludedDialogData?.tasksExcluded || 0}
        minutesExcluded={excludedDialogData?.minutesExcluded || 0}
        onContinue={() => {
          setExcludedDialogOpen(false);
          onSuccess();
        }}
      />
    </div>
  );
}
