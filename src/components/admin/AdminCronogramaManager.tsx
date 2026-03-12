import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  BookOpen,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Save,
  RefreshCw,
  Loader2,
  AlertCircle,
  History,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface AdminCronogramaManagerProps {
  cronogramaId: string;
  onBack: () => void;
}

interface CronogramaDetails {
  id: string;
  name: string;
  school_id: string;
  user_id: string;
  start_date: string;
  end_date: string | null;
  hours_per_day: number | null;
  hours_per_weekday: Record<string, number> | null;
  available_days: string[];
  selected_disciplines: string[];
  discipline_order: string[];
  selected_topics: Record<string, string[]>;
  topic_order: Record<string, string[]>;
  pending_admin_changes: boolean;
  admin_changes_description: string | null;
  schools: { name: string } | null;
  profiles: { full_name: string | null; email: string } | null;
}

interface Discipline {
  id: string;
  name: string;
  is_mandatory?: boolean;
}

interface Topic {
  id: string;
  name: string;
  study_discipline_id: string;
}

interface ChangeHistoryItem {
  id: string;
  change_type: string;
  change_description: string | null;
  created_at: string;
  mentor_name?: string;
}

const WEEKDAYS = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

export function AdminCronogramaManager({ cronogramaId, onBack }: AdminCronogramaManagerProps) {
  const [cronograma, setCronograma] = useState<CronogramaDetails | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [topicsByDiscipline, setTopicsByDiscipline] = useState<Record<string, Topic[]>>({});
  const [changeHistory, setChangeHistory] = useState<ChangeHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRecalcConfirm, setShowRecalcConfirm] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  
  // Editable state
  const [hoursPerWeekday, setHoursPerWeekday] = useState<Record<string, number>>({});
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [disciplineOrder, setDisciplineOrder] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Record<string, string[]>>({});
  const [topicOrder, setTopicOrder] = useState<Record<string, string[]>>({});
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set());

  const loadCronograma = useCallback(async () => {
    setLoading(true);
    try {
      // Load cronograma details
      const { data: cronData, error: cronError } = await supabase
        .from('user_cronogramas')
        .select(`
          *,
          schools(name)
        `)
        .eq('id', cronogramaId)
        .single();

      if (cronError) throw cronError;

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', cronData.user_id)
        .single();

      const cronogramaWithProfile: CronogramaDetails = {
        ...cronData,
        hours_per_weekday: cronData.hours_per_weekday as Record<string, number> | null,
        selected_topics: cronData.selected_topics as Record<string, string[]> | null || {},
        topic_order: cronData.topic_order as Record<string, string[]> | null || {},
        profiles: profile,
      };

      setCronograma(cronogramaWithProfile);

      // Initialize editable state
      const hpw = cronogramaWithProfile.hours_per_weekday || {};
      const defaultHours = cronogramaWithProfile.hours_per_day || 2;
      const availableDays = cronogramaWithProfile.available_days || [];
      
      // Set hours per weekday with defaults
      const initialHours: Record<string, number> = {};
      WEEKDAYS.forEach(day => {
        if (availableDays.includes(day.key)) {
          initialHours[day.key] = hpw[day.key] ?? defaultHours;
        }
      });
      setHoursPerWeekday(initialHours);

      setSelectedDisciplines(cronogramaWithProfile.selected_disciplines || []);
      setDisciplineOrder(cronogramaWithProfile.discipline_order || cronogramaWithProfile.selected_disciplines || []);
      setSelectedTopics(cronogramaWithProfile.selected_topics || {});
      setTopicOrder(cronogramaWithProfile.topic_order || {});

      // Load disciplines for this school
      const { data: schoolDisciplines } = await supabase
        .from('school_disciplines')
        .select(`
          discipline_id,
          is_mandatory,
          study_disciplines(id, name)
        `)
        .eq('school_id', cronData.school_id)
        .eq('is_active', true)
        .order('display_order');

      const discList: Discipline[] = (schoolDisciplines || []).map((sd: any) => ({
        id: sd.study_disciplines.id,
        name: sd.study_disciplines.name,
        is_mandatory: sd.is_mandatory,
      })).sort((a: Discipline, b: Discipline) => a.name.localeCompare(b.name, 'pt-BR'));
      setDisciplines(discList);

      // Load topics for each discipline
      const disciplineIds = discList.map(d => d.id);
      const { data: allTopics } = await supabase
        .from('study_topics')
        .select('id, name, study_discipline_id')
        .in('study_discipline_id', disciplineIds)
        .eq('is_active', true)
        .order('display_order');

      const topicsMap: Record<string, Topic[]> = {};
      (allTopics || []).forEach((topic: any) => {
        if (!topicsMap[topic.study_discipline_id]) {
          topicsMap[topic.study_discipline_id] = [];
        }
        topicsMap[topic.study_discipline_id].push(topic);
      });
      setTopicsByDiscipline(topicsMap);

      // Load change history
      const { data: history } = await supabase
        .from('mentor_cronograma_changes')
        .select('id, change_type, change_description, created_at, mentor_id')
        .eq('cronograma_id', cronogramaId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (history && history.length > 0) {
        const mentorIds = [...new Set(history.map(h => h.mentor_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', mentorIds);

        const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

        setChangeHistory(history.map(h => ({
          ...h,
          mentor_name: profileMap.get(h.mentor_id) || 'Admin',
        })));
      }
    } catch (error) {
      console.error('Error loading cronograma:', error);
      toast.error('Erro ao carregar cronograma');
    } finally {
      setLoading(false);
    }
  }, [cronogramaId]);

  useEffect(() => {
    loadCronograma();
  }, [loadCronograma]);

  const handleDisciplineDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(disciplineOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setDisciplineOrder(items);
  };

  const handleTopicDragEnd = (disciplineId: string) => (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(topicOrder[disciplineId] || selectedTopics[disciplineId] || []);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setTopicOrder(prev => ({
      ...prev,
      [disciplineId]: items,
    }));
  };

  const toggleDiscipline = (disciplineId: string, checked: boolean) => {
    if (checked) {
      setSelectedDisciplines(prev => [...prev, disciplineId]);
      if (!disciplineOrder.includes(disciplineId)) {
        setDisciplineOrder(prev => [...prev, disciplineId]);
      }
      // Select all topics by default
      const allTopicIds = (topicsByDiscipline[disciplineId] || []).map(t => t.id);
      setSelectedTopics(prev => ({
        ...prev,
        [disciplineId]: allTopicIds,
      }));
      setTopicOrder(prev => ({
        ...prev,
        [disciplineId]: allTopicIds,
      }));
    } else {
      setSelectedDisciplines(prev => prev.filter(id => id !== disciplineId));
      setDisciplineOrder(prev => prev.filter(id => id !== disciplineId));
      setSelectedTopics(prev => {
        const newTopics = { ...prev };
        delete newTopics[disciplineId];
        return newTopics;
      });
      setTopicOrder(prev => {
        const newOrder = { ...prev };
        delete newOrder[disciplineId];
        return newOrder;
      });
    }
  };

  const toggleTopic = (disciplineId: string, topicId: string, checked: boolean) => {
    setSelectedTopics(prev => {
      const current = prev[disciplineId] || [];
      if (checked) {
        return { ...prev, [disciplineId]: [...current, topicId] };
      } else {
        return { ...prev, [disciplineId]: current.filter(id => id !== topicId) };
      }
    });
    
    if (checked && !topicOrder[disciplineId]?.includes(topicId)) {
      setTopicOrder(prev => ({
        ...prev,
        [disciplineId]: [...(prev[disciplineId] || []), topicId],
      }));
    } else if (!checked) {
      setTopicOrder(prev => ({
        ...prev,
        [disciplineId]: (prev[disciplineId] || []).filter(id => id !== topicId),
      }));
    }
  };

  const handleSaveChanges = async (recalculate: boolean = false) => {
    if (!cronograma) return;
    
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Capture previous state
      const previousState = {
        hours_per_weekday: cronograma.hours_per_weekday,
        selected_disciplines: cronograma.selected_disciplines,
        discipline_order: cronograma.discipline_order,
        selected_topics: cronograma.selected_topics,
        topic_order: cronograma.topic_order,
      };

      const newState = {
        hours_per_weekday: hoursPerWeekday,
        selected_disciplines: selectedDisciplines,
        discipline_order: disciplineOrder,
        selected_topics: selectedTopics,
        topic_order: topicOrder,
      };

      // Update cronograma
      const { error: updateError } = await supabase
        .from('user_cronogramas')
        .update({
          hours_per_weekday: hoursPerWeekday,
          selected_disciplines: selectedDisciplines,
          discipline_order: disciplineOrder,
          selected_topics: selectedTopics,
          topic_order: topicOrder,
          pending_admin_changes: true,
          admin_changes_description: 'Alterações feitas pelo mentor aguardando aplicação',
          updated_at: new Date().toISOString(),
        })
        .eq('id', cronogramaId);

      if (updateError) throw updateError;

      // Log the change
      await supabase
        .from('mentor_cronograma_changes')
        .insert({
          cronograma_id: cronogramaId,
          mentor_id: user.id,
          change_type: 'full_config',
          change_description: generateChangeDescription(previousState, newState),
          previous_state: previousState,
          new_state: newState,
        });

      // Optionally delete future uncompleted tasks
      if (recalculate) {
        await supabase
          .from('user_cronograma_tasks')
          .delete()
          .eq('cronograma_id', cronogramaId)
          .eq('is_completed', false)
          .gte('scheduled_date', format(new Date(), 'yyyy-MM-dd'));
      }

      toast.success('Alterações salvas com sucesso');
      setShowRecalcConfirm(false);
      await loadCronograma();
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  const generateChangeDescription = (prev: any, next: any): string => {
    const changes: string[] = [];
    
    if (JSON.stringify(prev.hours_per_weekday) !== JSON.stringify(next.hours_per_weekday)) {
      changes.push('Horas por dia da semana alteradas');
    }
    if (JSON.stringify(prev.selected_disciplines) !== JSON.stringify(next.selected_disciplines)) {
      const added = next.selected_disciplines.filter((d: string) => !prev.selected_disciplines?.includes(d)).length;
      const removed = prev.selected_disciplines?.filter((d: string) => !next.selected_disciplines.includes(d)).length || 0;
      if (added > 0) changes.push(`${added} disciplina(s) adicionada(s)`);
      if (removed > 0) changes.push(`${removed} disciplina(s) removida(s)`);
    }
    if (JSON.stringify(prev.discipline_order) !== JSON.stringify(next.discipline_order)) {
      changes.push('Ordem das disciplinas alterada');
    }
    if (JSON.stringify(prev.selected_topics) !== JSON.stringify(next.selected_topics)) {
      changes.push('Tópicos selecionados alterados');
    }
    
    return changes.length > 0 ? changes.join(', ') : 'Configurações atualizadas';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!cronograma) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
        <p>Cronograma não encontrado</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  const orderedDisciplines = disciplineOrder
    .filter(id => selectedDisciplines.includes(id))
    .map(id => disciplines.find(d => d.id === id))
    .filter(Boolean) as Discipline[];

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
              {cronograma.profiles?.full_name || cronograma.profiles?.email} • {cronograma.schools?.name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowHistoryDialog(true)}>
            <History className="h-4 w-4 mr-2" />
            Histórico
          </Button>
          <Button onClick={() => setShowRecalcConfirm(true)} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Alterações
          </Button>
        </div>
      </div>

      {cronograma.pending_admin_changes && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <span className="font-medium text-yellow-800 dark:text-yellow-200">
              Alterações pendentes de aplicação pelo aluno
            </span>
          </div>
          {cronograma.admin_changes_description && (
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              {cronograma.admin_changes_description}
            </p>
          )}
        </div>
      )}

      {/* Hours per weekday */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horas por Dia da Semana
          </CardTitle>
          <CardDescription>
            Configure as horas de estudo para cada dia disponível
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {WEEKDAYS.filter(day => cronograma.available_days?.includes(day.key)).map(day => (
              <div key={day.key} className="space-y-2">
                <Label>{day.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0.5"
                    max="12"
                    step="0.5"
                    value={hoursPerWeekday[day.key] || 0}
                    onChange={(e) => setHoursPerWeekday(prev => ({
                      ...prev,
                      [day.key]: parseFloat(e.target.value) || 0,
                    }))}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">h</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Disciplines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Disciplinas e Tópicos
          </CardTitle>
          <CardDescription>
            Selecione e ordene as disciplinas e tópicos do cronograma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DragDropContext onDragEnd={handleDisciplineDragEnd}>
            <Droppable droppableId="disciplines">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {orderedDisciplines.map((discipline, index) => (
                    <Draggable key={discipline.id} draggableId={discipline.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`border rounded-lg ${snapshot.isDragging ? 'shadow-lg bg-accent' : 'bg-card'}`}
                        >
                          <Collapsible
                            open={expandedDisciplines.has(discipline.id)}
                            onOpenChange={(open) => {
                              setExpandedDisciplines(prev => {
                                const next = new Set(prev);
                                if (open) next.add(discipline.id);
                                else next.delete(discipline.id);
                                return next;
                              });
                            }}
                          >
                            <div className="flex items-center gap-3 p-3">
                              <div {...provided.dragHandleProps}>
                                <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                              </div>
                              <Checkbox
                                checked={selectedDisciplines.includes(discipline.id)}
                                onCheckedChange={(checked) => toggleDiscipline(discipline.id, !!checked)}
                              />
                              <CollapsibleTrigger className="flex items-center gap-2 flex-1 hover:underline">
                                {expandedDisciplines.has(discipline.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <span className="font-medium">{discipline.name}</span>
                              </CollapsibleTrigger>
                              {discipline.is_mandatory && (
                                <Badge variant="secondary">Obrigatória</Badge>
                              )}
                              <Badge variant="outline">
                                {selectedTopics[discipline.id]?.length || 0}/{topicsByDiscipline[discipline.id]?.length || 0} tópicos
                              </Badge>
                            </div>

                            <CollapsibleContent>
                              <div className="border-t px-3 py-2 bg-muted/30">
                                <DragDropContext onDragEnd={handleTopicDragEnd(discipline.id)}>
                                  <Droppable droppableId={`topics-${discipline.id}`}>
                                    {(provided) => (
                                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
                                        {(topicOrder[discipline.id] || topicsByDiscipline[discipline.id]?.map(t => t.id) || [])
                                          .map(topicId => topicsByDiscipline[discipline.id]?.find(t => t.id === topicId))
                                          .filter(Boolean)
                                          .map((topic, topicIndex) => (
                                            <Draggable key={topic!.id} draggableId={topic!.id} index={topicIndex}>
                                              {(provided) => (
                                                <div
                                                  ref={provided.innerRef}
                                                  {...provided.draggableProps}
                                                  className="flex items-center gap-2 p-2 rounded bg-background"
                                                >
                                                  <div {...provided.dragHandleProps}>
                                                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                                  </div>
                                                  <Checkbox
                                                    checked={selectedTopics[discipline.id]?.includes(topic!.id)}
                                                    onCheckedChange={(checked) => 
                                                      toggleTopic(discipline.id, topic!.id, !!checked)
                                                    }
                                                  />
                                                  <span className="text-sm">{topic!.name}</span>
                                                </div>
                                              )}
                                            </Draggable>
                                          ))}
                                        {provided.placeholder}
                                      </div>
                                    )}
                                  </Droppable>
                                </DragDropContext>
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

          {/* Unselected disciplines */}
          {disciplines.filter(d => !selectedDisciplines.includes(d.id)).length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Disciplinas disponíveis (não selecionadas)
              </h4>
              <div className="space-y-1">
                {disciplines.filter(d => !selectedDisciplines.includes(d.id)).map(discipline => (
                  <div key={discipline.id} className="flex items-center gap-3 p-2 rounded border bg-muted/20">
                    <Checkbox
                      checked={false}
                      onCheckedChange={(checked) => toggleDiscipline(discipline.id, !!checked)}
                    />
                    <span className="text-sm text-muted-foreground">{discipline.name}</span>
                    {discipline.is_mandatory && (
                      <Badge variant="outline" className="text-xs">Obrigatória</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Confirmation Dialog */}
      <AlertDialog open={showRecalcConfirm} onOpenChange={setShowRecalcConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvar Alterações</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja recalcular as tarefas futuras não concluídas com as novas configurações?
              <br /><br />
              <strong>Sim, recalcular:</strong> Remove tarefas futuras não concluídas e o aluno precisará regenerar o cronograma.
              <br />
              <strong>Apenas salvar:</strong> Mantém as tarefas existentes. O aluno será notificado sobre as alterações pendentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={() => handleSaveChanges(false)} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apenas Salvar
            </Button>
            <AlertDialogAction onClick={() => handleSaveChanges(true)} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar e Recalcular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History Dialog */}
      <AlertDialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Alterações
            </AlertDialogTitle>
          </AlertDialogHeader>
          <ScrollArea className="h-[300px] pr-4">
            {changeHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma alteração registrada
              </p>
            ) : (
              <div className="space-y-3">
                {changeHistory.map((change) => (
                  <div key={change.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline">{change.change_type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(change.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm">{change.change_description || 'Configurações alteradas'}</p>
                    <p className="text-xs text-muted-foreground mt-1">Por: {change.mentor_name}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
