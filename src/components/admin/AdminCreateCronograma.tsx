import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ArrowLeft,
  Calendar,
  Clock,
  BookOpen,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Save,
  Loader2,
  GraduationCap,
  School,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useCronogramaTaskGenerator } from '@/hooks/useCronogramaTaskGenerator';
import { normalizeCronogramaConfig } from '@/lib/cronograma/normalizeCronogramaConfig';

interface AdminCreateCronogramaProps {
  userId: string;
  userName: string | null;
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

const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Seg', fullLabel: 'Segunda-feira' },
  { id: 'tuesday', label: 'Ter', fullLabel: 'Terça-feira' },
  { id: 'wednesday', label: 'Qua', fullLabel: 'Quarta-feira' },
  { id: 'thursday', label: 'Qui', fullLabel: 'Quinta-feira' },
  { id: 'friday', label: 'Sex', fullLabel: 'Sexta-feira' },
  { id: 'saturday', label: 'Sáb', fullLabel: 'Sábado' },
  { id: 'sunday', label: 'Dom', fullLabel: 'Domingo' },
];

export function AdminCreateCronograma({
  userId,
  userName,
  onBack,
  onSuccess,
}: AdminCreateCronogramaProps) {
  const { generateTasks } = useCronogramaTaskGenerator();
  const [saving, setSaving] = useState(false);
  const [useCustomHoursPerDay, setUseCustomHoursPerDay] = useState(false);
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    name: '',
    editalId: '',
    schoolId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    hoursPerDay: 2,
    hoursPerWeekday: {} as Record<string, number>,
    selectedDisciplines: [] as string[],
    disciplineOrder: [] as string[],
    selectedTopics: {} as Record<string, string[]>,
    topicOrder: {} as Record<string, string[]>,
  });

  // Fetch editals
  const { data: editals } = useQuery({
    queryKey: ['editals-admin'],
    queryFn: async (): Promise<Edital[]> => {
      const { data, error } = await supabase
        .from('editals')
        .select('id, name, area_id, areas(name)')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as Edital[];
    },
  });

  // Fetch schools filtered by selected edital
  const { data: schools } = useQuery({
    queryKey: ['schools-by-edital-admin', formData.editalId],
    queryFn: async (): Promise<SchoolFromEdital[]> => {
      if (!formData.editalId) return [];
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, edital_id')
        .eq('edital_id', formData.editalId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!formData.editalId,
  });

  // Fetch disciplines for selected school
  const { data: schoolDisciplines } = useQuery({
    queryKey: ['school-disciplines-admin', formData.schoolId],
    queryFn: async (): Promise<SchoolDiscipline[]> => {
      if (!formData.schoolId) return [];
      const { data, error } = await supabase
        .from('school_disciplines')
        .select(`
          id,
          discipline_id,
          is_mandatory,
          display_order,
          study_disciplines (id, name)
        `)
        .eq('school_id', formData.schoolId)
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return (data || []) as SchoolDiscipline[];
    },
    enabled: !!formData.schoolId,
  });

  // Fetch topics for selected school
  const { data: studyTopics } = useQuery({
    queryKey: ['study-topics-admin', formData.schoolId],
    queryFn: async (): Promise<StudyTopic[]> => {
      if (!formData.schoolId || !schoolDisciplines?.length) return [];
      const disciplineIds = schoolDisciplines.map((sd) => sd.study_disciplines.id);
      const { data, error } = await supabase
        .from('study_topics')
        .select('id, name, study_discipline_id, display_order')
        .in('study_discipline_id', disciplineIds)
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!formData.schoolId && !!schoolDisciplines?.length,
  });

  const topicsByDiscipline = useMemo(() => {
    if (!studyTopics) return {};
    return studyTopics.reduce((acc, topic) => {
      if (!acc[topic.study_discipline_id]) {
        acc[topic.study_discipline_id] = [];
      }
      acc[topic.study_discipline_id].push(topic);
      return acc;
    }, {} as Record<string, StudyTopic[]>);
  }, [studyTopics]);

  const orderedDisciplines = useMemo(() => {
    if (!schoolDisciplines) return [];
    const disciplineMap = new Map(
      schoolDisciplines.map((sd) => [sd.study_disciplines.id, sd])
    );
    return formData.disciplineOrder
      .filter((id) => formData.selectedDisciplines.includes(id))
      .map((id) => disciplineMap.get(id))
      .filter(Boolean) as SchoolDiscipline[];
  }, [schoolDisciplines, formData.disciplineOrder, formData.selectedDisciplines]);

  const handleDayToggle = (dayId: string) => {
    setFormData((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(dayId)
        ? prev.availableDays.filter((d) => d !== dayId)
        : [...prev.availableDays, dayId],
    }));
  };

  const handleHoursPerWeekdayChange = (dayId: string, hours: number) => {
    setFormData((prev) => ({
      ...prev,
      hoursPerWeekday: { ...prev.hoursPerWeekday, [dayId]: hours },
    }));
  };

  const handleDisciplineToggle = (disciplineId: string) => {
    setFormData((prev) => {
      const isSelected = prev.selectedDisciplines.includes(disciplineId);
      if (isSelected) {
        // Remove discipline and its topics
        const newSelectedTopics = { ...prev.selectedTopics };
        delete newSelectedTopics[disciplineId];
        const newTopicOrder = { ...prev.topicOrder };
        delete newTopicOrder[disciplineId];
        return {
          ...prev,
          selectedDisciplines: prev.selectedDisciplines.filter((id) => id !== disciplineId),
          disciplineOrder: prev.disciplineOrder.filter((id) => id !== disciplineId),
          selectedTopics: newSelectedTopics,
          topicOrder: newTopicOrder,
        };
      } else {
        // Add discipline with all topics selected
        const allTopics = topicsByDiscipline[disciplineId] || [];
        const topicIds = allTopics.map((t) => t.id);
        return {
          ...prev,
          selectedDisciplines: [...prev.selectedDisciplines, disciplineId],
          disciplineOrder: [...prev.disciplineOrder, disciplineId],
          selectedTopics: { ...prev.selectedTopics, [disciplineId]: topicIds },
          topicOrder: { ...prev.topicOrder, [disciplineId]: topicIds },
        };
      }
    });
  };

  const handleTopicToggle = (disciplineId: string, topicId: string) => {
    setFormData((prev) => {
      const currentTopics = prev.selectedTopics[disciplineId] || [];
      const isSelected = currentTopics.includes(topicId);
      const newTopics = isSelected
        ? currentTopics.filter((id) => id !== topicId)
        : [...currentTopics, topicId];

      const currentOrder = prev.topicOrder[disciplineId] || [];
      const newOrder = isSelected
        ? currentOrder.filter((id) => id !== topicId)
        : [...currentOrder, topicId];

      return {
        ...prev,
        selectedTopics: { ...prev.selectedTopics, [disciplineId]: newTopics },
        topicOrder: { ...prev.topicOrder, [disciplineId]: newOrder },
      };
    });
  };

  const handleSelectAllTopicsForDiscipline = (disciplineId: string) => {
    const allTopics = topicsByDiscipline[disciplineId] || [];
    const topicIds = allTopics.map((t) => t.id);
    setFormData((prev) => ({
      ...prev,
      selectedTopics: { ...prev.selectedTopics, [disciplineId]: topicIds },
      topicOrder: { ...prev.topicOrder, [disciplineId]: topicIds },
    }));
  };

  const handleDisciplineDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(formData.disciplineOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setFormData((prev) => ({ ...prev, disciplineOrder: items }));
  };

  const handleTopicDragEnd = (disciplineId: string) => (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(formData.topicOrder[disciplineId] || []);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setFormData((prev) => ({
      ...prev,
      topicOrder: { ...prev.topicOrder, [disciplineId]: items },
    }));
  };

  const canSave = () => {
    return (
      formData.name.trim() &&
      formData.schoolId &&
      formData.startDate &&
      formData.availableDays.length > 0 &&
      formData.selectedDisciplines.length > 0
    );
  };

  const handleSave = async () => {
    if (!canSave()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      // Build hours_per_weekday
      const hoursPerWeekday: Record<string, number> = {};
      if (useCustomHoursPerDay) {
        formData.availableDays.forEach((day) => {
          hoursPerWeekday[day] = formData.hoursPerWeekday[day] ?? formData.hoursPerDay;
        });
      } else {
        formData.availableDays.forEach((day) => {
          hoursPerWeekday[day] = formData.hoursPerDay;
        });
      }

      // CORREÇÃO: Sanitizar configuração para evitar UUIDs fantasmas
      const normalized = normalizeCronogramaConfig({
        selected_disciplines: formData.selectedDisciplines,
        discipline_order: formData.disciplineOrder,
        selected_topics: formData.selectedTopics,
        topic_order: formData.topicOrder,
      });

      // Create cronograma com dados sanitizados
      const { data: newCronograma, error } = await supabase
        .from('user_cronogramas')
        .insert({
          user_id: userId,
          name: formData.name,
          school_id: formData.schoolId,
          start_date: formData.startDate,
          end_date: formData.endDate || null,
          available_days: formData.availableDays,
          hours_per_day: formData.hoursPerDay,
          hours_per_weekday: hoursPerWeekday,
          selected_disciplines: normalized.selected_disciplines,
          discipline_order: normalized.discipline_order,
          selected_topics: normalized.selected_topics,
          topic_order: normalized.topic_order,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Generate tasks com dados sanitizados
      const result = await generateTasks({
        id: newCronograma.id,
        user_id: userId,
        school_id: formData.schoolId,
        start_date: formData.startDate,
        end_date: formData.endDate || null,
        available_days: formData.availableDays,
        hours_per_day: formData.hoursPerDay,
        selected_disciplines: normalized.selected_disciplines,
        hours_per_weekday: hoursPerWeekday,
        discipline_order: normalized.discipline_order,
        selected_topics: normalized.selected_topics,
        topic_order: normalized.topic_order,
      });

      if (result.success) {
        toast.success(`Cronograma criado com ${result.tasksCreated} tarefas!`);
        onSuccess();
      } else {
        toast.error('Cronograma criado, mas erro ao gerar tarefas');
      }
    } catch (error) {
      console.error('Error creating cronograma:', error);
      toast.error('Erro ao criar cronograma');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Criar Cronograma</h2>
            <p className="text-sm text-muted-foreground">
              Criando cronograma para: {userName || 'Aluno'}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || !canSave()}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Criar Cronograma
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Informações Básicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Cronograma *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Cronograma PRF 2025"
              />
            </div>

            <div className="space-y-2">
              <Label>Edital *</Label>
              <Select
                value={formData.editalId}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    editalId: value,
                    schoolId: '',
                    selectedDisciplines: [],
                    disciplineOrder: [],
                    selectedTopics: {},
                    topicOrder: {},
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o edital" />
                </SelectTrigger>
                <SelectContent>
                  {editals?.map((edital) => (
                    <SelectItem key={edital.id} value={edital.id}>
                      {edital.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cargo/Escola *</Label>
              <Select
                value={formData.schoolId}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    schoolId: value,
                    selectedDisciplines: [],
                    disciplineOrder: [],
                    selectedTopics: {},
                    topicOrder: {},
                  }))
                }
                disabled={!formData.editalId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cargo" />
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

        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Datas e Horários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Início *</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Término (opcional)</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dias Disponíveis *</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Button
                    key={day.id}
                    type="button"
                    variant={formData.availableDays.includes(day.id) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleDayToggle(day.id)}
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Horas por dia</Label>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Personalizar por dia</Label>
                  <Switch
                    checked={useCustomHoursPerDay}
                    onCheckedChange={setUseCustomHoursPerDay}
                  />
                </div>
              </div>

              {useCustomHoursPerDay ? (
                <div className="grid grid-cols-2 gap-2">
                  {formData.availableDays.map((dayId) => {
                    const day = DAYS_OF_WEEK.find((d) => d.id === dayId);
                    return (
                      <div key={dayId} className="flex items-center gap-2">
                        <Label className="w-16 text-sm">{day?.label}</Label>
                        <Input
                          type="number"
                          min={0.5}
                          max={12}
                          step={0.5}
                          value={formData.hoursPerWeekday[dayId] ?? formData.hoursPerDay}
                          onChange={(e) =>
                            handleHoursPerWeekdayChange(dayId, parseFloat(e.target.value))
                          }
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">h</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0.5}
                    max={12}
                    step={0.5}
                    value={formData.hoursPerDay}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        hoursPerDay: parseFloat(e.target.value),
                      }))
                    }
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">horas por dia</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Disciplines & Topics */}
      {formData.schoolId && schoolDisciplines && schoolDisciplines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Disciplinas e Tópicos
            </CardTitle>
            <CardDescription>
              Selecione as disciplinas e tópicos para o cronograma. Arraste para reordenar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              {/* Available disciplines to add */}
              <div className="mb-4">
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Disciplinas Disponíveis
                </Label>
                <div className="flex flex-wrap gap-2">
                  {schoolDisciplines
                    .filter((sd) => !formData.selectedDisciplines.includes(sd.study_disciplines.id))
                    .map((sd) => (
                      <Button
                        key={sd.study_disciplines.id}
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisciplineToggle(sd.study_disciplines.id)}
                      >
                        + {sd.study_disciplines.name}
                      </Button>
                    ))}
                </div>
              </div>

              {/* Selected disciplines with drag & drop */}
              {orderedDisciplines.length > 0 && (
                <DragDropContext onDragEnd={handleDisciplineDragEnd}>
                  <Droppable droppableId="disciplines">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                        {orderedDisciplines.map((sd, index) => (
                          <Draggable
                            key={sd.study_disciplines.id}
                            draggableId={sd.study_disciplines.id}
                            index={index}
                          >
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="border rounded-lg bg-card"
                              >
                                <Collapsible
                                  open={expandedDisciplines.has(sd.study_disciplines.id)}
                                  onOpenChange={(open) => {
                                    setExpandedDisciplines((prev) => {
                                      const next = new Set(prev);
                                      if (open) next.add(sd.study_disciplines.id);
                                      else next.delete(sd.study_disciplines.id);
                                      return next;
                                    });
                                  }}
                                >
                                  <div className="flex items-center p-3">
                                    <div {...provided.dragHandleProps} className="mr-2 cursor-grab">
                                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <CollapsibleTrigger className="flex items-center gap-2 flex-1">
                                      {expandedDisciplines.has(sd.study_disciplines.id) ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                      <span className="font-medium">{sd.study_disciplines.name}</span>
                                      <span className="text-sm text-muted-foreground">
                                        ({formData.selectedTopics[sd.study_disciplines.id]?.length || 0} tópicos)
                                      </span>
                                    </CollapsibleTrigger>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDisciplineToggle(sd.study_disciplines.id)}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      Remover
                                    </Button>
                                  </div>
                                  <CollapsibleContent>
                                    <div className="px-4 pb-3 pl-10 space-y-2">
                                      <div className="flex gap-2 mb-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            handleSelectAllTopicsForDiscipline(sd.study_disciplines.id)
                                          }
                                        >
                                          Selecionar todos
                                        </Button>
                                      </div>
                                      <DragDropContext onDragEnd={handleTopicDragEnd(sd.study_disciplines.id)}>
                                        <Droppable droppableId={`topics-${sd.study_disciplines.id}`}>
                                          {(provided) => (
                                            <div
                                              {...provided.droppableProps}
                                              ref={provided.innerRef}
                                              className="space-y-1"
                                            >
                                              {(
                                                formData.topicOrder[sd.study_disciplines.id] ||
                                                topicsByDiscipline[sd.study_disciplines.id]?.map((t) => t.id) ||
                                                []
                                              )
                                                .filter((topicId) =>
                                                  formData.selectedTopics[sd.study_disciplines.id]?.includes(
                                                    topicId
                                                  )
                                                )
                                                .map((topicId, idx) => {
                                                  const topic = topicsByDiscipline[
                                                    sd.study_disciplines.id
                                                  ]?.find((t) => t.id === topicId);
                                                  if (!topic) return null;
                                                  return (
                                                    <Draggable
                                                      key={topic.id}
                                                      draggableId={topic.id}
                                                      index={idx}
                                                    >
                                                      {(provided) => (
                                                        <div
                                                          ref={provided.innerRef}
                                                          {...provided.draggableProps}
                                                          className="flex items-center gap-2 p-2 rounded bg-muted/50"
                                                        >
                                                          <div
                                                            {...provided.dragHandleProps}
                                                            className="cursor-grab"
                                                          >
                                                            <GripVertical className="h-3 w-3 text-muted-foreground" />
                                                          </div>
                                                          <Checkbox
                                                            checked
                                                            onCheckedChange={() =>
                                                              handleTopicToggle(
                                                                sd.study_disciplines.id,
                                                                topic.id
                                                              )
                                                            }
                                                          />
                                                          <span className="text-sm">{topic.name}</span>
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

                                      {/* Unselected topics */}
                                      {topicsByDiscipline[sd.study_disciplines.id]
                                        ?.filter(
                                          (t) =>
                                            !formData.selectedTopics[sd.study_disciplines.id]?.includes(
                                              t.id
                                            )
                                        )
                                        .map((topic) => (
                                          <div
                                            key={topic.id}
                                            className="flex items-center gap-2 p-2 rounded opacity-50"
                                          >
                                            <div className="w-3" />
                                            <Checkbox
                                              checked={false}
                                              onCheckedChange={() =>
                                                handleTopicToggle(sd.study_disciplines.id, topic.id)
                                              }
                                            />
                                            <span className="text-sm">{topic.name}</span>
                                          </div>
                                        ))}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
