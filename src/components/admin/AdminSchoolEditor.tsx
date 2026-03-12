import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, School, BookOpen, Target, RefreshCw, 
  AlertTriangle, Clock, Users, FileText, Save, 
  Import, Trash2, Ban, FolderPlus
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ImportDisciplineDialog } from './ImportDisciplineDialog';
import { DeleteDisciplineDialog } from './DeleteDisciplineDialog';
import { AddSourceTopicsDialog } from './AddSourceTopicsDialog';
import { AddSourceDisciplinesDialog } from './AddSourceDisciplinesDialog';
import { AddSourceDisciplinesToEditalDialog } from './AddSourceDisciplinesToEditalDialog';

interface SchoolWithDetails {
  id: string;
  name: string;
  edital_id: string | null;
  is_active: boolean;
  discipline_count?: number;
  cronograma_count?: number;
}

interface DisciplineWithTopics {
  id: string;
  name: string;
  is_source: boolean;
  topics: TopicWithGoals[];
}

interface TopicWithGoals {
  id: string;
  name: string;
  goals: GoalConfig[];
  revision?: RevisionConfig;
}

interface GoalConfig {
  id?: string;
  name: string;
  goal_type: 'pdf_study' | 'questions';
  duration_minutes: number;
  display_order: number;
  pdf_links?: any[];
  video_links?: any[];
  flashcard_links?: string[];
  question_notebook_ids?: string[];
}

interface RevisionConfig {
  id?: string;
  revision_1_days: number | null;
  revision_2_days: number | null;
  revision_3_days: number | null;
  revision_4_days: number | null;
  revision_5_days: number | null;
  revision_6_days: number | null;
}

interface PendingConfig {
  discipline_id: string;
  discipline_name: string;
  pending_type: string;
}

interface Edital {
  id: string;
  name: string;
}

export function AdminSchoolEditor() {
  const { toast } = useToast();
  
  // Filters
  const [editals, setEditals] = useState<Edital[]>([]);
  const [selectedEditalId, setSelectedEditalId] = useState<string>('');
  const [schools, setSchools] = useState<SchoolWithDetails[]>([]);
  const [filteredSchools, setFilteredSchools] = useState<SchoolWithDetails[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [selectedSchool, setSelectedSchool] = useState<SchoolWithDetails | null>(null);
  
  const [loading, setLoading] = useState(true);
  
  // Discipline editing
  const [disciplines, setDisciplines] = useState<DisciplineWithTopics[]>([]);
  const [loadingDisciplines, setLoadingDisciplines] = useState(false);
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>('');
  const [selectedDiscipline, setSelectedDiscipline] = useState<DisciplineWithTopics | null>(null);
  
  // Inline editing state (replaces dialog)
  const [editingTopics, setEditingTopics] = useState<TopicWithGoals[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState<string>('metas');
  
  // Bulk config state
  const [bulkQuestionsPerHour, setBulkQuestionsPerHour] = useState<string>('');
  const [bulkRevisions, setBulkRevisions] = useState<{
    revision_1_days: string;
    revision_2_days: string;
    revision_3_days: string;
    revision_4_days: string;
    revision_5_days: string;
    revision_6_days: string;
  }>({
    revision_1_days: '',
    revision_2_days: '',
    revision_3_days: '',
    revision_4_days: '',
    revision_5_days: '',
    revision_6_days: ''
  });
  
  // Confirmation dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [affectedCronogramas, setAffectedCronogramas] = useState<number>(0);
  
  // Progress for batch operations
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; label?: string } | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);
  
  // Pending configs
  const [pendingConfigs, setPendingConfigs] = useState<PendingConfig[]>();
  
  // Import/Delete/Add Source Topics/Add Source Disciplines dialogs
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addSourceTopicsDialogOpen, setAddSourceTopicsDialogOpen] = useState(false);
  const [addSourceDisciplinesDialogOpen, setAddSourceDisciplinesDialogOpen] = useState(false);
  const [addSourceDisciplinesToEditalDialogOpen, setAddSourceDisciplinesToEditalDialogOpen] = useState(false);
  const [deactivatingPending, setDeactivatingPending] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'school' | 'edital'>('school');
  const [disciplineToDelete, setDisciplineToDelete] = useState<{ id: string; name: string } | null>(null);

  // Fetch editals on mount
  const fetchEditals = async () => {
    try {
      const { data, error } = await supabase
        .from('editals')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setEditals(data || []);
    } catch (error) {
      console.error('Error fetching editals:', error);
    }
  };

  const fetchSchools = async () => {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, edital_id, is_active')
        .eq('is_active', true)
        .not('edital_id', 'is', null)
        .order('name');

      if (error) throw error;

      // Get counts for each school
      const schoolsWithCounts = await Promise.all((data || []).map(async (school) => {
        const [discResult, cronResult] = await Promise.all([
          supabase
            .from('school_disciplines')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', school.id)
            .eq('is_active', true),
          supabase
            .from('user_cronogramas')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', school.id)
            .eq('is_active', true)
        ]);

        return {
          ...school,
          discipline_count: discResult.count || 0,
          cronograma_count: cronResult.count || 0
        };
      }));

      setSchools(schoolsWithCounts);
    } catch (error) {
      console.error('Error fetching schools:', error);
      toast({ title: 'Erro ao carregar escolas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchSchoolDisciplines = async (schoolId: string) => {
    setLoadingDisciplines(true);
    try {
      // Get school disciplines
      const { data: schoolDiscs, error: discError } = await supabase
        .from('school_disciplines')
        .select(`
          discipline_id,
          study_disciplines (
            id, name, is_source
          )
        `)
        .eq('school_id', schoolId)
        .eq('is_active', true);

      if (discError) throw discError;

      // For each discipline, get topics with goals and revisions
      const disciplinesWithData = await Promise.all(
        (schoolDiscs || []).map(async (sd: any) => {
          const discipline = sd.study_disciplines;
          if (!discipline) return null;

          // Get topics
          const { data: topics } = await supabase
            .from('study_topics')
            .select('id, name')
            .eq('study_discipline_id', discipline.id)
            .eq('is_active', true)
            .order('display_order');

          // For each topic, get goals and revision
          const topicsWithGoals = await Promise.all(
            (topics || []).map(async (topic) => {
              const [goalsResult, revisionResult] = await Promise.all([
                supabase
                  .from('topic_goals')
                  .select('*')
                  .eq('topic_id', topic.id)
                  .eq('is_active', true)
                  .order('display_order'),
                supabase
                  .from('topic_revisions')
                  .select('*')
                  .eq('topic_id', topic.id)
                  .eq('is_active', true)
                  .single()
              ]);

              return {
                ...topic,
                goals: goalsResult.data || [],
                revision: revisionResult.data || undefined
              };
            })
          );

          return {
            id: discipline.id,
            name: discipline.name,
            is_source: discipline.is_source || false,
            topics: topicsWithGoals
          };
        })
      );

      setDisciplines(disciplinesWithData.filter(Boolean) as DisciplineWithTopics[]);

      // Check for pending configs
      const { data: pendingResult } = await supabase
        .rpc('check_pending_config', { p_school_id: schoolId });
      
      const pendingData = pendingResult as unknown as { has_pending: boolean; pending_count: number; pending_disciplines: PendingConfig[] } | null;
      if (pendingData?.pending_disciplines) {
        setPendingConfigs(pendingData.pending_disciplines);
      } else {
        setPendingConfigs([]);
      }
    } catch (error) {
      console.error('Error fetching disciplines:', error);
      toast({ title: 'Erro ao carregar disciplinas', variant: 'destructive' });
    } finally {
      setLoadingDisciplines(false);
    }
  };

  // Load editals and schools on mount
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchEditals(), fetchSchools()]);
      setLoading(false);
    };
    init();
  }, []);

  // Filter schools when edital changes
  useEffect(() => {
    if (selectedEditalId) {
      setFilteredSchools(schools.filter(s => s.edital_id === selectedEditalId));
    } else {
      setFilteredSchools(schools);
    }
    // Reset downstream selections
    setSelectedSchoolId('');
    setSelectedSchool(null);
    setSelectedDisciplineId('');
    setSelectedDiscipline(null);
    setDisciplines([]);
    setPendingConfigs([]);
  }, [selectedEditalId, schools]);

  // Load disciplines when school changes
  useEffect(() => {
    if (selectedSchoolId) {
      const school = schools.find(s => s.id === selectedSchoolId);
      setSelectedSchool(school || null);
      if (school) {
        fetchSchoolDisciplines(school.id);
      }
    } else {
      setSelectedSchool(null);
      setDisciplines([]);
      setPendingConfigs([]);
    }
    // Reset discipline selection
    setSelectedDisciplineId('');
    setSelectedDiscipline(null);
  }, [selectedSchoolId]);

  // Set selected discipline when discipline ID changes - initialize editing topics
  useEffect(() => {
    if (selectedDisciplineId) {
      const disc = disciplines.find(d => d.id === selectedDisciplineId);
      setSelectedDiscipline(disc || null);
      // Initialize editing topics when discipline is selected
      if (disc) {
        setEditingTopics(JSON.parse(JSON.stringify(disc.topics)));
        setHasUnsavedChanges(false);
        // Reset bulk config fields
        setBulkQuestionsPerHour('');
        setBulkRevisions({
          revision_1_days: '',
          revision_2_days: '',
          revision_3_days: '',
          revision_4_days: '',
          revision_5_days: '',
          revision_6_days: ''
        });
      }
    } else {
      setSelectedDiscipline(null);
      setEditingTopics([]);
      setHasUnsavedChanges(false);
    }
  }, [selectedDisciplineId, disciplines]);

  const updateGoalDuration = (topicIndex: number, goalIndex: number, duration: number) => {
    setEditingTopics(prev => {
      const updated = [...prev];
      if (updated[topicIndex]?.goals[goalIndex]) {
        updated[topicIndex].goals[goalIndex].duration_minutes = duration;
      }
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  const updateRevisionDays = (topicIndex: number, revisionField: keyof RevisionConfig, value: number | null) => {
    setEditingTopics(prev => {
      const updated = [...prev];
      if (updated[topicIndex]) {
        if (!updated[topicIndex].revision) {
          updated[topicIndex].revision = {
            revision_1_days: null,
            revision_2_days: null,
            revision_3_days: null,
            revision_4_days: null,
            revision_5_days: null,
            revision_6_days: null
          };
        }
        (updated[topicIndex].revision as any)[revisionField] = value;
      }
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  // Apply bulk questions per hour to all question goals
  const applyBulkQuestionsPerHour = () => {
    const qph = parseInt(bulkQuestionsPerHour);
    if (!qph || qph < 1) {
      toast({ title: 'Digite um valor válido para questões por hora', variant: 'destructive' });
      return;
    }

    setEditingTopics(prev => {
      const updated = [...prev];
      updated.forEach(topic => {
        topic.goals.forEach(goal => {
          if (goal.goal_type === 'questions') {
            // Calculate duration based on questions per hour
            // For now, we set a standard duration - the actual calculation
            // happens at generation time based on question count
            goal.duration_minutes = Math.ceil(60 / qph * 10) * 6; // ~10 questions as base
          }
        });
      });
      return updated;
    });
    
    setHasUnsavedChanges(true);
    toast({ 
      title: 'Configuração aplicada!',
      description: `Taxa de ${qph} questões/hora aplicada em todas as metas de questões.`
    });
  };

  // Apply bulk revisions to all topics
  const applyBulkRevisions = () => {
    const hasAnyValue = Object.values(bulkRevisions).some(v => v !== '');
    if (!hasAnyValue) {
      toast({ title: 'Configure ao menos um intervalo de revisão', variant: 'destructive' });
      return;
    }

    setEditingTopics(prev => {
      const updated = [...prev];
      updated.forEach(topic => {
        if (!topic.revision) {
          topic.revision = {
            revision_1_days: null,
            revision_2_days: null,
            revision_3_days: null,
            revision_4_days: null,
            revision_5_days: null,
            revision_6_days: null
          };
        }
        // Apply each revision value
        Object.entries(bulkRevisions).forEach(([key, value]) => {
          (topic.revision as any)[key] = value ? parseInt(value) : null;
        });
      });
      return updated;
    });
    
    setHasUnsavedChanges(true);
    const configuredCount = Object.values(bulkRevisions).filter(v => v !== '').length;
    toast({ 
      title: 'Revisões aplicadas!',
      description: `${configuredCount} intervalos de revisão aplicados em ${editingTopics.length} tópicos.`
    });
  };

  const handleSaveConfirm = async () => {
    if (!selectedSchool) return;

    // Count affected cronogramas
    const { count } = await supabase
      .from('user_cronogramas')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', selectedSchool.id)
      .eq('is_active', true);

    setAffectedCronogramas(count || 0);
    setConfirmDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedDiscipline || !selectedSchool) return;

    setSaving(true);
    setConfirmDialogOpen(false);

    try {
      // Prepare goals data
      const goalsToInsert = editingTopics.flatMap(topic => 
        topic.goals.map((goal, idx) => ({
          topic_id: topic.id,
          name: goal.name,
          goal_type: goal.goal_type,
          duration_minutes: goal.duration_minutes,
          display_order: idx,
          pdf_links: goal.pdf_links || [],
          video_links: goal.video_links || [],
          flashcard_links: goal.flashcard_links || [],
          question_notebook_ids: goal.question_notebook_ids || []
        }))
      );

      // Call overwrite RPC for goals
      const { data: goalsResult, error: goalsError } = await supabase.rpc(
        'overwrite_discipline_goals',
        {
          p_discipline_id: selectedDiscipline.id,
          p_new_goals: goalsToInsert
        }
      );

      if (goalsError) throw goalsError;

      // Prepare revisions data
      const revisionsToInsert = editingTopics
        .filter(topic => topic.revision)
        .map(topic => ({
          topic_id: topic.id,
          revision_1_days: topic.revision?.revision_1_days,
          revision_2_days: topic.revision?.revision_2_days,
          revision_3_days: topic.revision?.revision_3_days,
          revision_4_days: topic.revision?.revision_4_days,
          revision_5_days: topic.revision?.revision_5_days,
          revision_6_days: topic.revision?.revision_6_days
        }));

      if (revisionsToInsert.length > 0) {
        const { error: revError } = await supabase.rpc(
          'overwrite_discipline_revisions',
          {
            p_discipline_id: selectedDiscipline.id,
            p_new_revisions: revisionsToInsert
          }
        );

        if (revError) throw revError;
      }

      const goalsData = goalsResult as unknown as { inserted_goals: number } | null;
      
      toast({
        title: 'Configurações salvas!',
        description: `${goalsData?.inserted_goals || 0} metas atualizadas. ${affectedCronogramas} cronogramas marcados para atualização.`
      });

      setHasUnsavedChanges(false);
      fetchSchoolDisciplines(selectedSchool.id);
      fetchSchools(); // Refresh to update counts

    } catch (error) {
      console.error('Error saving:', error);
      toast({ title: 'Erro ao salvar configurações', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getTotalMinutes = (topics: TopicWithGoals[]) => {
    return topics.reduce((sum, topic) => 
      sum + topic.goals.reduce((gSum, g) => gSum + g.duration_minutes, 0), 0
    );
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  };

  // Bulk apply to all schools in edital
  const applyToAllSchoolsInEdital = async () => {
    if (!selectedEditalId || selectedEditalId === 'all') {
      toast({ title: 'Selecione um edital específico', variant: 'destructive' });
      return;
    }

    const schoolsInEdital = schools.filter(s => s.edital_id === selectedEditalId);
    if (schoolsInEdital.length === 0) {
      toast({ title: 'Nenhuma escola encontrada no edital', variant: 'destructive' });
      return;
    }

    if (!confirm(`Marcar cronogramas de TODAS as ${schoolsInEdital.length} escolas do edital para recálculo?`)) return;

    setBulkApplying(true);
    setBatchProgress({ current: 0, total: schoolsInEdital.length, label: 'Marcando cronogramas...' });

    try {
      let totalCronogramas = 0;
      for (let i = 0; i < schoolsInEdital.length; i++) {
        const school = schoolsInEdital[i];
        setBatchProgress({ current: i + 1, total: schoolsInEdital.length, label: `Escola: ${school.name}` });

        const { data, error } = await supabase.rpc('mark_cronogramas_for_recalc', {
          p_school_id: school.id,
          p_reason: `Atualização em massa - Edital`
        });

        if (error) throw error;
        const result = data as { success: boolean; marked_count: number } | null;
        totalCronogramas += result?.marked_count || 0;
      }

      toast({
        title: 'Cronogramas marcados!',
        description: `${totalCronogramas} cronogramas de ${schoolsInEdital.length} escolas marcados para recálculo.`
      });
      
      // Refresh schools to update counts
      fetchSchools();
    } catch (error) {
      console.error('Error applying to all schools:', error);
      toast({ title: 'Erro ao aplicar em massa', variant: 'destructive' });
    } finally {
      setBulkApplying(false);
      setBatchProgress(null);
    }
  };

  // Bulk apply to all disciplines in selected school
  const applyToAllDisciplinesInSchool = async () => {
    if (!selectedSchool) {
      toast({ title: 'Selecione uma escola', variant: 'destructive' });
      return;
    }

    if (disciplines.length === 0) {
      toast({ title: 'Nenhuma disciplina encontrada', variant: 'destructive' });
      return;
    }

    if (!confirm(`Marcar cronogramas da escola "${selectedSchool.name}" para recálculo?\n\nIsso afetará todos os alunos desta escola.`)) return;

    setBulkApplying(true);
    
    try {
      const { data, error } = await supabase.rpc('mark_cronogramas_for_recalc', {
        p_school_id: selectedSchool.id,
        p_reason: `Atualização em massa - Todas disciplinas`
      });

      if (error) throw error;
      const result = data as { success: boolean; marked_count: number } | null;

      toast({
        title: 'Cronogramas marcados!',
        description: `${result?.marked_count || 0} cronogramas marcados para recálculo.`
      });
      
      // Refresh schools to update counts
      fetchSchools();
    } catch (error) {
      console.error('Error applying to school:', error);
      toast({ title: 'Erro ao aplicar em massa', variant: 'destructive' });
    } finally {
      setBulkApplying(false);
    }
  };

  // Bulk apply for single discipline
  const applyToDiscipline = async () => {
    if (!selectedSchool || !selectedDiscipline) {
      toast({ title: 'Selecione uma escola e disciplina', variant: 'destructive' });
      return;
    }

    if (!confirm(`Marcar cronogramas da escola "${selectedSchool.name}" para recálculo devido a mudanças na disciplina "${selectedDiscipline.name}"?`)) return;

    setBulkApplying(true);
    
    try {
      const { data, error } = await supabase.rpc('mark_cronogramas_for_recalc', {
        p_school_id: selectedSchool.id,
        p_reason: `Atualização - ${selectedDiscipline.name}`
      });

      if (error) throw error;
      const result = data as { success: boolean; marked_count: number } | null;

      toast({
        title: 'Cronogramas marcados!',
        description: `${result?.marked_count || 0} cronogramas marcados para recálculo.`
      });
      
      // Refresh schools to update counts
      fetchSchools();
    } catch (error) {
      console.error('Error applying to discipline:', error);
      toast({ title: 'Erro ao aplicar', variant: 'destructive' });
    } finally {
      setBulkApplying(false);
    }
  };

  // Deactivate all pending goals for a single discipline
  const deactivatePendingGoalsForDiscipline = async (disciplineId: string, disciplineName: string) => {
    if (!selectedSchool) return;

    if (!confirm(`Desativar TODAS as metas pendentes da disciplina "${disciplineName}"?\n\nIsso removerá as metas do cronograma dos alunos.`)) return;

    setDeactivatingPending(true);
    try {
      const { data, error } = await supabase.rpc('deactivate_pending_goals_for_discipline', {
        p_school_id: selectedSchool.id,
        p_discipline_id: disciplineId
      });

      if (error) throw error;

      const result = data as { success: boolean; deactivated_goals: number; deactivated_revisions: number } | null;

      toast({
        title: 'Metas desativadas!',
        description: `${result?.deactivated_goals || 0} metas e ${result?.deactivated_revisions || 0} revisões desativadas.`
      });

      // Refresh data
      fetchSchoolDisciplines(selectedSchool.id);
      fetchSchools();
    } catch (error) {
      console.error('Error deactivating pending goals:', error);
      toast({ title: 'Erro ao desativar metas', variant: 'destructive' });
    } finally {
      setDeactivatingPending(false);
    }
  };

  // Deactivate all pending goals for ALL disciplines with pending config
  const deactivateAllPendingGoals = async () => {
    if (!selectedSchool || !pendingConfigs || pendingConfigs.length === 0) return;

    if (!confirm(`Desativar TODAS as metas pendentes de ${pendingConfigs.length} disciplinas?\n\nIsso removerá as metas do cronograma de TODOS os alunos desta escola.`)) return;

    setDeactivatingPending(true);
    try {
      const { data, error } = await supabase.rpc('deactivate_all_pending_goals_for_school', {
        p_school_id: selectedSchool.id
      });

      if (error) throw error;

      const result = data as { success: boolean; disciplines_processed: number; total_deactivated_goals: number; total_deactivated_revisions: number } | null;

      toast({
        title: 'Metas desativadas em massa!',
        description: `${result?.disciplines_processed || 0} disciplinas processadas. ${result?.total_deactivated_goals || 0} metas e ${result?.total_deactivated_revisions || 0} revisões desativadas.`
      });

      // Refresh data
      fetchSchoolDisciplines(selectedSchool.id);
      fetchSchools();
    } catch (error) {
      console.error('Error deactivating all pending goals:', error);
      toast({ title: 'Erro ao desativar metas em massa', variant: 'destructive' });
    } finally {
      setDeactivatingPending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Editor de Metas e Revisões
          </CardTitle>
          <CardDescription>
            Configure metas e intervalos de revisão por disciplina. Alterações serão aplicadas quando o aluno optar por atualizar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Edital Filter */}
            <div className="space-y-2">
              <Label>Edital</Label>
              <Select 
                value={selectedEditalId || 'all'} 
                onValueChange={(val) => setSelectedEditalId(val === 'all' ? '' : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os editais" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os editais</SelectItem>
                  {editals.map((edital) => (
                    <SelectItem key={edital.id} value={edital.id}>
                      {edital.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* School Filter */}
            <div className="space-y-2">
              <Label>Escola</Label>
              <Select 
                value={selectedSchoolId} 
                onValueChange={setSelectedSchoolId}
                disabled={filteredSchools.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma escola" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSchools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      <div className="flex items-center gap-2">
                        <School className="w-4 h-4" />
                        <span className="truncate max-w-[180px]">{school.name}</span>
                        <Badge variant="outline" className="ml-1 text-xs">
                          {school.cronograma_count} alunos
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Discipline Filter */}
            <div className="space-y-2">
              <Label>Disciplina</Label>
              <Select 
                value={selectedDisciplineId} 
                onValueChange={setSelectedDisciplineId}
                disabled={!selectedSchool || disciplines.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingDisciplines ? "Carregando..." : "Selecione uma disciplina"} />
                </SelectTrigger>
                <SelectContent>
                  {disciplines.map((discipline) => (
                    <SelectItem key={discipline.id} value={discipline.id}>
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        <span className="truncate max-w-[180px]">{discipline.name}</span>
                        {discipline.is_source && (
                          <Badge variant="secondary" className="ml-1 text-xs">ZIP</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bulk Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {batchProgress && (
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 mb-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">{batchProgress.label}</span>
                </div>
                <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {batchProgress.current} de {batchProgress.total}
                </p>
              </div>
            )}
            
            <div className="flex flex-wrap gap-2 ml-auto">
              {/* Add Source Disciplines to ALL schools of edital */}
              {selectedEditalId && !selectedSchool && (
                <Button 
                  variant="outline" 
                  onClick={() => setAddSourceDisciplinesToEditalDialogOpen(true)}
                  disabled={bulkApplying}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Adicionar Disciplinas da Fonte (Todas as Escolas)
                </Button>
              )}

              {/* Add Source Disciplines Button (single school) */}
              {selectedSchool && (
                <Button 
                  variant="outline" 
                  onClick={() => setAddSourceDisciplinesDialogOpen(true)}
                  disabled={bulkApplying}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Adicionar Disciplinas da Fonte
                </Button>
              )}

              {/* Import Discipline Button */}
              {selectedSchool && (
                <Button 
                  variant="outline" 
                  onClick={() => setImportDialogOpen(true)}
                  disabled={bulkApplying}
                >
                  <Import className="w-4 h-4 mr-2" />
                  Importar Disciplina
                </Button>
              )}
              
              {selectedEditalId && selectedEditalId !== 'all' && (
                <Button 
                  variant="outline" 
                  onClick={applyToAllSchoolsInEdital}
                  disabled={bulkApplying}
                >
                  {bulkApplying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <FileText className="w-4 h-4 mr-2" />
                  Marcar Todas Escolas do Edital
                </Button>
              )}
              
              {selectedSchool && (
                <Button 
                  variant="outline" 
                  onClick={applyToAllDisciplinesInSchool}
                  disabled={bulkApplying}
                >
                  {bulkApplying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <School className="w-4 h-4 mr-2" />
                  Marcar Escola Inteira
                </Button>
              )}

              {selectedDiscipline && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      disabled={bulkApplying}
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      Ações da Disciplina
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* Add Source Topics - only for derived disciplines */}
                    {!selectedDiscipline.is_source && (
                      <>
                        <DropdownMenuItem onClick={() => setAddSourceTopicsDialogOpen(true)}>
                          <FolderPlus className="w-4 h-4 mr-2" />
                          Adicionar Tópicos da Fonte
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={applyToDiscipline}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Marcar para Recálculo
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => {
                        setDisciplineToDelete({ 
                          id: selectedDiscipline.id, 
                          name: selectedDiscipline.name 
                        });
                        setDeleteMode('school');
                        setDeleteDialogOpen(true);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir da Escola
                    </DropdownMenuItem>
                    {selectedEditalId && (
                      <DropdownMenuItem 
                        onClick={() => {
                          setDisciplineToDelete({ 
                            id: selectedDiscipline.id, 
                            name: selectedDiscipline.name 
                          });
                          setDeleteMode('edital');
                          setDeleteDialogOpen(true);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir do Edital Inteiro
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Pending Configs Warning */}
          {pendingConfigs && pendingConfigs.length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">Configurações pendentes</span>
                  <Badge variant="secondary">{pendingConfigs.length} disciplinas</Badge>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deactivateAllPendingGoals}
                  disabled={deactivatingPending}
                >
                  {deactivatingPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4 mr-2" />
                  )}
                  Desativar Todas em Massa
                </Button>
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-500 mt-2">
                As seguintes disciplinas precisam de configuração antes que os cronogramas possam ser atualizados:
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {pendingConfigs.map((pc, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <Badge variant="outline" className="border-amber-500 pr-1">
                      {pc.discipline_name} ({pc.pending_type})
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 ml-1 hover:bg-destructive/20"
                        onClick={() => deactivatePendingGoalsForDiscipline(pc.discipline_id, pc.discipline_name)}
                        disabled={deactivatingPending}
                        title={`Desativar metas de ${pc.discipline_name}`}
                      >
                        <Ban className="w-3 h-3 text-destructive" />
                      </Button>
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Discipline Details with Inline Tabs */}
          {selectedDiscipline && editingTopics.length > 0 && (
            <Card className="border-primary/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{selectedDiscipline.name}</CardTitle>
                      <CardDescription>
                        {selectedDiscipline.topics.length} tópicos • {formatDuration(getTotalMinutes(editingTopics))} total
                      </CardDescription>
                    </div>
                    {selectedDiscipline.is_source && (
                      <Badge variant="secondary">Fonte ZIP</Badge>
                    )}
                  </div>
                  {hasUnsavedChanges && (
                    <Badge variant="destructive" className="animate-pulse">
                      Alterações não salvas
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Tabs value={activeEditTab} onValueChange={setActiveEditTab}>
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="metas" className="gap-2">
                      <Target className="w-4 h-4" />
                      Metas de Estudo
                    </TabsTrigger>
                    <TabsTrigger value="revisoes" className="gap-2">
                      <RefreshCw className="w-4 h-4" />
                      Revisões
                    </TabsTrigger>
                  </TabsList>

                  {/* Metas Tab */}
                  <TabsContent value="metas" className="mt-0">
                    {/* Bulk Questions Per Hour Config */}
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">Configuração em Massa - Questões</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Defina quantas questões por hora deseja aplicar em todas as metas de questões desta disciplina.
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm whitespace-nowrap">Questões por hora:</Label>
                          <Input
                            type="number"
                            min={1}
                            max={60}
                            placeholder="Ex: 20"
                            value={bulkQuestionsPerHour}
                            onChange={(e) => setBulkQuestionsPerHour(e.target.value)}
                            className="w-24 h-8"
                          />
                        </div>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={applyBulkQuestionsPerHour}
                          disabled={!bulkQuestionsPerHour}
                        >
                          Aplicar em Todas
                        </Button>
                      </div>
                    </div>

                    <ScrollArea className="h-[340px] pr-4">
                      <div className="space-y-3">
                        {editingTopics.map((topic, topicIndex) => (
                          <Card key={topic.id} className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="font-medium text-sm">{topic.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {topic.goals.length} metas
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              {topic.goals.map((goal, goalIndex) => (
                                <div key={goalIndex} className="flex items-center gap-4 p-2 bg-muted/30 rounded-lg">
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm truncate block">{goal.name}</span>
                                    <Badge variant="outline" className="text-xs mt-1">
                                      {goal.goal_type === 'pdf_study' ? 'Estudo PDF' : 'Questões'}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Label className="text-xs text-muted-foreground">Duração:</Label>
                                    <Input
                                      type="number"
                                      min={30}
                                      step={30}
                                      value={goal.duration_minutes}
                                      onChange={(e) => updateGoalDuration(topicIndex, goalIndex, parseInt(e.target.value) || 30)}
                                      className="w-20 h-8"
                                    />
                                    <span className="text-xs text-muted-foreground">min</span>
                                  </div>
                                </div>
                              ))}
                              {topic.goals.length === 0 && (
                                <p className="text-sm text-muted-foreground italic">Nenhuma meta configurada</p>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Revisões Tab */}
                  <TabsContent value="revisoes" className="mt-0">
                    {/* Bulk Revisions Config */}
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <RefreshCw className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">Configuração em Massa - Revisões</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Defina os intervalos de revisão e aplique em todos os tópicos desta disciplina de uma vez.
                      </p>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="grid grid-cols-6 gap-2">
                          {[1, 2, 3, 4, 5, 6].map((num) => (
                            <div key={num} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Rev {num}</Label>
                              <Input
                                type="number"
                                min={1}
                                placeholder="-"
                                value={bulkRevisions[`revision_${num}_days` as keyof typeof bulkRevisions]}
                                onChange={(e) => setBulkRevisions(prev => ({
                                  ...prev,
                                  [`revision_${num}_days`]: e.target.value
                                }))}
                                className="h-8 text-center w-16"
                              />
                            </div>
                          ))}
                        </div>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={applyBulkRevisions}
                          disabled={!Object.values(bulkRevisions).some(v => v !== '')}
                        >
                          Aplicar em Todos
                        </Button>
                      </div>
                    </div>

                    <ScrollArea className="h-[300px] pr-4">
                      <div className="space-y-3">
                        {editingTopics.map((topic, topicIndex) => (
                          <Card key={topic.id} className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="font-medium text-sm">{topic.name}</span>
                              {topic.revision && Object.values(topic.revision).some(v => v !== null) && (
                                <Badge variant="secondary" className="text-xs">
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                  Configurado
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-6 gap-2">
                              {[1, 2, 3, 4, 5, 6].map((num) => (
                                <div key={num} className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Rev {num}</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    placeholder="-"
                                    value={topic.revision?.[`revision_${num}_days` as keyof RevisionConfig] ?? ''}
                                    onChange={(e) => updateRevisionDays(
                                      topicIndex,
                                      `revision_${num}_days` as keyof RevisionConfig,
                                      e.target.value ? parseInt(e.target.value) : null
                                    )}
                                    className="h-8 text-center"
                                  />
                                </div>
                              ))}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>

                {/* Save Actions */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    Total: {formatDuration(getTotalMinutes(editingTopics))}
                    {selectedSchool && (
                      <span className="ml-2">
                        • {selectedSchool.cronograma_count || 0} cronogramas afetados
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        if (selectedDiscipline) {
                          setEditingTopics(JSON.parse(JSON.stringify(selectedDiscipline.topics)));
                          setHasUnsavedChanges(false);
                        }
                      }}
                      disabled={saving || !hasUnsavedChanges}
                    >
                      Descartar
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleSaveConfirm} 
                      disabled={saving || !hasUnsavedChanges}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Salvar Alterações
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty States */}
          {!selectedSchool && (
            <div className="text-center py-8 text-muted-foreground">
              <School className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Selecione um edital e uma escola para visualizar as disciplinas</p>
            </div>
          )}

          {selectedSchool && !loadingDisciplines && disciplines.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma disciplina configurada para esta escola</p>
            </div>
          )}

          {selectedSchool && loadingDisciplines && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-muted-foreground">Carregando disciplinas...</span>
            </div>
          )}

          {selectedSchool && !selectedDisciplineId && disciplines.length > 0 && !loadingDisciplines && (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Selecione uma disciplina para editar metas e revisões</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirmar Alterações
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a atualizar as metas e revisões da disciplina <strong>{selectedDiscipline?.name}</strong>.
              </p>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Users className="w-4 h-4" />
                  <span className="font-medium">{affectedCronogramas} cronogramas serão afetados</span>
                </div>
                <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                  Os alunos verão um botão "Atualizar Cronograma" para aplicar as mudanças.
                  Tarefas pendentes serão reorganizadas ao atualizar.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                As tarefas já concluídas serão preservadas.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave} className="bg-amber-600 hover:bg-amber-700">
              Confirmar e Salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Progress */}
      {batchProgress && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-[400px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Processando...
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={(batchProgress.current / batchProgress.total) * 100} />
              <p className="text-sm text-center text-muted-foreground">
                {batchProgress.current} de {batchProgress.total} cronogramas
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Import Discipline Dialog */}
      {selectedSchool && (
        <ImportDisciplineDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          targetSchoolId={selectedSchool.id}
          targetSchoolName={selectedSchool.name}
          existingDisciplineIds={disciplines.map(d => d.id)}
          onSuccess={() => {
            fetchSchoolDisciplines(selectedSchool.id);
            fetchSchools();
          }}
        />
      )}

      {/* Delete Discipline Dialog */}
      {disciplineToDelete && selectedSchool && (
        <DeleteDisciplineDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setDisciplineToDelete(null);
          }}
          mode={deleteMode}
          disciplineId={disciplineToDelete.id}
          disciplineName={disciplineToDelete.name}
          schoolId={selectedSchool.id}
          schoolName={selectedSchool.name}
          editalId={selectedEditalId}
          editalName={editals.find(e => e.id === selectedEditalId)?.name}
          affectedSchoolsCount={deleteMode === 'edital' ? filteredSchools.length : undefined}
          onSuccess={() => {
            setSelectedDisciplineId('');
            fetchSchoolDisciplines(selectedSchool.id);
            fetchSchools();
          }}
        />
      )}

      {/* Add Source Topics Dialog */}
      {selectedDiscipline && !selectedDiscipline.is_source && (
        <AddSourceTopicsDialog
          open={addSourceTopicsDialogOpen}
          onOpenChange={setAddSourceTopicsDialogOpen}
          disciplineId={selectedDiscipline.id}
          disciplineName={selectedDiscipline.name}
          onSuccess={() => {
            if (selectedSchool) {
              fetchSchoolDisciplines(selectedSchool.id);
            }
          }}
        />
      )}

      {/* Add Source Disciplines Dialog */}
      {selectedSchool && (
        <AddSourceDisciplinesDialog
          open={addSourceDisciplinesDialogOpen}
          onOpenChange={setAddSourceDisciplinesDialogOpen}
          schoolId={selectedSchool.id}
          schoolName={selectedSchool.name}
          onSuccess={() => {
            fetchSchoolDisciplines(selectedSchool.id);
            fetchSchools();
          }}
        />
      )}

      {/* Add Source Disciplines to Edital Dialog */}
      {selectedEditalId && (
        <AddSourceDisciplinesToEditalDialog
          open={addSourceDisciplinesToEditalDialogOpen}
          onOpenChange={setAddSourceDisciplinesToEditalDialogOpen}
          editalId={selectedEditalId}
          editalName={editals.find(e => e.id === selectedEditalId)?.name || ''}
          onSuccess={() => {
            if (selectedSchool) {
              fetchSchoolDisciplines(selectedSchool.id);
            }
            fetchSchools();
          }}
        />
      )}
    </div>
  );
}
