import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  BookOpen,
  Plus, 
  Edit, 
  Trash2, 
  Loader2,
  ChevronRight,
  RefreshCw,
  Link2,
  Unlink,
  CheckCircle2,
  XCircle,
  FileQuestion,
  GripVertical,
  Upload
} from 'lucide-react';
import { EditalSchoolFilter, useEditalFilter } from './EditalFilter';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface Discipline {
  id: string;
  name: string;
  description: string | null;
  display_order: number | null;
  is_active: boolean | null;
  created_at: string;
  source_notebook_folder_id: string | null;
  area_id: string | null;
  linkedEditais?: string[];
  question_count?: number;
  generation_type?: string | null;
  is_source?: boolean | null;
}

interface Area {
  id: string;
  name: string;
  description?: string | null;
}

interface Topic {
  id: string;
  study_discipline_id: string;
  name: string;
  description: string | null;
  display_order: number | null;
  is_active: boolean | null;
  source_notebook_id: string | null;
  question_count?: number;
}

interface SchoolDiscipline {
  id: string;
  school_id: string;
  discipline_id: string;
  is_active: boolean;
}

type DialogMode = 'discipline' | 'topic' | 'link-edital' | null;
type StatusFilter = 'all' | 'active' | 'inactive';

export function AdminDisciplines() {
  const navigate = useNavigate();
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [allDisciplines, setAllDisciplines] = useState<Discipline[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [schoolDisciplines, setSchoolDisciplines] = useState<SchoolDiscipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterEditalId, setFilterEditalId] = useState('');
  const [filterEdital, setFilterEdital] = useState(''); // School ID
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  
  const { editais, refresh: refreshEditais } = useEditalFilter();
  
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingItem, setEditingItem] = useState<Discipline | Topic | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  
  // For linking disciplines to editais
  const [linkingDiscipline, setLinkingDiscipline] = useState<Discipline | null>(null);
  const [selectedEditais, setSelectedEditais] = useState<string[]>([]);
  
  // Batch selection state
  const [selectedDisciplineIds, setSelectedDisciplineIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Areas for discipline linking
  const [areas, setAreas] = useState<Area[]>([]);

  // Form states
  const [disciplineForm, setDisciplineForm] = useState({
    name: '',
    description: '',
    display_order: 0,
    is_active: true,
    area_id: '' as string,
  });

  const [topicForm, setTopicForm] = useState({
    name: '',
    description: '',
    display_order: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchAll();
    fetchAreas();
  }, []);

  const fetchAreas = async () => {
    const { data, error } = await supabase
      .from('areas')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching areas:', error);
    } else {
      setAreas(data || []);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchDisciplines(), fetchTopics(), fetchSchoolDisciplines()]);
    setLoading(false);
  };

  const fetchSchoolDisciplines = async () => {
    const { data, error } = await supabase
      .from('school_disciplines')
      .select('*');

    if (error) {
      console.error('Error fetching school disciplines:', error);
    } else {
      setSchoolDisciplines(data || []);
    }
  };

  const fetchDisciplines = async () => {
    // Fetch all disciplines (including inactive for admin view)
    const { data, error } = await supabase
      .from('study_disciplines')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching disciplines:', error);
      toast.error('Erro ao carregar disciplinas');
      return;
    }

    // Fetch school_disciplines to know which schools each discipline is linked to
    const { data: sdData } = await supabase
      .from('school_disciplines')
      .select('school_id, discipline_id')
      .eq('is_active', true);

    const disciplineSchoolsMap: Record<string, string[]> = {};
    (sdData || []).forEach((sd: { school_id: string; discipline_id: string }) => {
      if (!disciplineSchoolsMap[sd.discipline_id]) {
        disciplineSchoolsMap[sd.discipline_id] = [];
      }
      disciplineSchoolsMap[sd.discipline_id].push(sd.school_id);
    });

    // Also fetch edital_disciplines to know which editals each discipline is linked to
    const { data: edData } = await supabase
      .from('edital_disciplines')
      .select('edital_id, discipline_id')
      .eq('is_active', true);

    const disciplineEditalsMap: Record<string, string[]> = {};
    (edData || []).forEach((ed: { edital_id: string; discipline_id: string }) => {
      if (!disciplineEditalsMap[ed.discipline_id]) {
        disciplineEditalsMap[ed.discipline_id] = [];
      }
      disciplineEditalsMap[ed.discipline_id].push(ed.edital_id);
    });

    // Fetch editals to check if selected edital is pre-edital (is_default=true)
    const { data: editalsData } = await supabase
      .from('editals')
      .select('id, is_default')
      .eq('is_active', true);
    
    const selectedEditalIsPreEdital = (editalsData || []).find((e: any) => e.id === filterEditalId)?.is_default === true;
    
    // Get the pre-edital ID for filtering
    const preEditalData = (editalsData || []).find((e: any) => e.is_default === true);

    // Fetch admin_notebook_folders to identify which disciplines were created via mapping
    // Disciplines created via mapping have source_notebook_folder_id pointing to folders with school_id = NULL
    const { data: foldersData } = await supabase
      .from('admin_notebook_folders')
      .select('id, school_id');
    
    const folderSchoolMap: Record<string, string | null> = {};
    (foldersData || []).forEach((f: { id: string; school_id: string | null }) => {
      folderSchoolMap[f.id] = f.school_id;
    });

    // Get all discipline IDs
    const disciplineIds = (data || []).map((d: any) => d.id);

    // Compute accurate counts in the database (avoids 1000-row client limit)
    // Use smaller batches to prevent timeout
    const DISCIPLINE_BATCH_SIZE = 30;
    const disciplineBatches: string[][] = [];
    for (let i = 0; i < disciplineIds.length; i += DISCIPLINE_BATCH_SIZE) {
      disciplineBatches.push(disciplineIds.slice(i, i + DISCIPLINE_BATCH_SIZE));
    }

    const disciplineCountMap: Record<string, number> = {};

    if (disciplineBatches.length > 0) {
      console.log(`[AdminDisciplines] Fetching discipline counts for ${disciplineIds.length} disciplines in ${disciplineBatches.length} parallel batches`);
      
      const discResults = await Promise.allSettled(
        disciplineBatches.map(batch => 
          supabase.rpc('get_discipline_question_counts', { discipline_ids: batch })
        )
      );

      discResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { data: countsData, error: countsError } = result.value;
          if (countsError) {
            console.error(`Error fetching discipline question counts (batch ${index + 1}):`, countsError);
          } else {
            (countsData || []).forEach((row: any) => {
              if (row?.discipline_id) disciplineCountMap[row.discipline_id] = Number(row.question_count || 0);
            });
          }
        } else {
          console.error(`Discipline batch ${index + 1} failed:`, result.reason);
        }
      });
    }

    const disciplinesWithEditais = (data || []).map((d: any) => {
      // Check if this discipline was created via mapping (folder has no school)
      const folderSchoolId = d.source_notebook_folder_id ? folderSchoolMap[d.source_notebook_folder_id] : undefined;
      const isCreatedViaMapping = d.source_notebook_folder_id && folderSchoolId === null;
      
      return {
        ...d,
        linkedEditais: disciplineSchoolsMap[d.id] || [],
        linkedToEditals: disciplineEditalsMap[d.id] || [],
        question_count: disciplineCountMap[d.id] ?? 0,
        isCreatedViaMapping,
      };
    });

    setAllDisciplines(disciplinesWithEditais);

    // Apply filters
    let filtered = disciplinesWithEditais;

    // Filter logic:
    // 1. If a school is selected (filterEdital), filter by school_disciplines
    // 2. If edital is pre-edital (is_default), filter by edital_disciplines
    // 3. If only regular edital is selected (filterEditalId), filter by edital_disciplines
    //    Show disciplines that are either:
    //    - Created via mapping (folder.school_id IS NULL) OR
    //    - Created via edital_mapping (generation_type === 'edital_mapping' and is_source === false)
    if (filterEdital && filterEdital !== 'all') {
      // Filter by selected school
      filtered = filtered.filter((d: Discipline & { linkedToEditals?: string[]; isCreatedViaMapping?: boolean }) => 
        d.linkedEditais?.includes(filterEdital)
      );
    } else if (filterEditalId && filterEditalId !== 'all') {
      if (selectedEditalIsPreEdital) {
        // Pré-edital: show disciplines linked to the pre-edital via edital_disciplines
        filtered = filtered.filter((d: Discipline & { linkedToEditals?: string[]; isCreatedViaMapping?: boolean }) => {
          const linkedToPreEdital = (d as any).linkedToEditals?.includes(filterEditalId);
          return linkedToPreEdital;
        });
      } else {
        // Regular edital (pós-edital): show disciplines that belong to this specific edital
        // A discipline belongs to a post-edital if:
        // 1. It was created via mapping (isCreatedViaMapping === true) OR
        // 2. It was created via edital_mapping (generation_type === 'edital_mapping' AND is_source === false)
        // AND it is linked to this edital via edital_disciplines
        
        filtered = filtered.filter((d: Discipline & { linkedToEditals?: string[]; isCreatedViaMapping?: boolean }) => {
          // Check if linked to this specific edital via edital_disciplines
          const linkedViaEdital = (d as any).linkedToEditals?.includes(filterEditalId);
          if (!linkedViaEdital) return false;
          
          // Allow if created via mapping (folder.school_id IS NULL)
          if ((d as any).isCreatedViaMapping === true) return true;
          
          // Also allow if created via edital_mapping and NOT a source discipline
          const isEditalMappingGenerated = (d as any).generation_type === 'edital_mapping' && (d as any).is_source === false;
          if (isEditalMappingGenerated) return true;
          
          // Exclude pre-edital source disciplines
          return false;
        });
      }
    }

    // Filter by status
    if (filterStatus === 'active') {
      filtered = filtered.filter((d: Discipline) => d.is_active !== false);
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter((d: Discipline) => d.is_active === false);
    }

    setDisciplines(filtered);
  };

  useEffect(() => {
    fetchDisciplines();
    refreshEditais();
  }, [filterEditalId, filterEdital, filterStatus]);

  // Auto-refresh when disciplines, topics, or question links change
  // DEBOUNCED to prevent flickering when bulk operations trigger multiple changes
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    const handleChange = () => {
      // Clear any pending refresh
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // Debounce: wait 1.5 seconds before refreshing to batch multiple changes
      debounceTimerRef.current = setTimeout(() => {
        console.log('[AdminDisciplines] Debounced refresh triggered by realtime change');
        void fetchDisciplines();
        void fetchTopics();
      }, 1500);
    };

    const channel = supabase.channel('admin-disciplines-refresh');

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'study_disciplines' },
      handleChange
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'study_topics' },
      handleChange
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'school_disciplines' },
      handleChange
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'question_disciplines' },
      handleChange
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'question_topics' },
      handleChange
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'admin_notebook_questions' },
      handleChange
    );

    channel.subscribe();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTopics = async () => {
    // Fetch all topics (including inactive for admin view)
    // NOTE: the backend enforces a 1000-row cap per request; we page to avoid truncation.
    const PAGE_SIZE = 1000;
    const allTopics: any[] = [];

    console.log('[AdminDisciplines] Starting fetchTopics with pagination...');

    for (let from = 0; from < 50000; from += PAGE_SIZE) {
      const { data: page, error } = await supabase
        .from('study_topics')
        .select('*')
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('Error fetching topics:', error);
        return;
      }

      console.log(`[AdminDisciplines] Page ${from / PAGE_SIZE + 1}: fetched ${page?.length || 0} topics`);

      if (!page || page.length === 0) break;
      allTopics.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    console.log(`[AdminDisciplines] Total topics fetched: ${allTopics.length}`);

    // Contagem precisa de questões por tópico usando a mesma função RPC unificada
    // que considera: question_topics (N:N), questions.study_topic_id (direto),
    // e admin_notebook_questions (via source_notebook_id)
    const topicIds = allTopics.map((t: any) => t.id);

    const topicCountMap: Record<string, number> = {};

    if (topicIds.length > 0) {
      // Processar em lotes MENORES e em PARALELO para evitar timeout
      const BATCH_SIZE = 50; // Reduzido de 500 para 50 para evitar timeout
      const batches: string[][] = [];
      for (let i = 0; i < topicIds.length; i += BATCH_SIZE) {
        batches.push(topicIds.slice(i, i + BATCH_SIZE));
      }

      console.log(`[AdminDisciplines] Fetching question counts for ${topicIds.length} topics in ${batches.length} parallel batches`);

      // Executar todas as chamadas em paralelo (mais rápido e evita timeout sequencial)
      const results = await Promise.allSettled(
        batches.map(batch => 
          supabase.rpc('get_topic_question_counts', { topic_ids: batch })
        )
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { data: countsData, error: countsError } = result.value;
          if (countsError) {
            console.error(`Error fetching topic question counts (batch ${index + 1}):`, countsError);
          } else {
            (countsData || []).forEach((row: any) => {
              if (row?.topic_id) topicCountMap[row.topic_id] = Number(row.question_count || 0);
            });
          }
        } else {
          console.error(`Batch ${index + 1} failed:`, result.reason);
        }
      });

      console.log(`[AdminDisciplines] Topic counts fetched: ${Object.keys(topicCountMap).length} topics with counts`);
    }

    // Check specific discipline: Português Geral
    const portuguesGeralTopics = allTopics.filter((t: any) => t.study_discipline_id === '4e03dd64-107e-4a38-8f4a-7a3efbe724ff');
    console.log(`[AdminDisciplines] Português Geral topics in allTopics: ${portuguesGeralTopics.length}`, portuguesGeralTopics.map((t: any) => t.name));

    setTopics(
      (allTopics as any[]).map((t) => ({
        ...t,
        study_discipline_id: t.study_discipline_id,
        source_notebook_id: t.source_notebook_id,
        question_count: topicCountMap[t.id] ?? 0,
      }))
    );
  };

  // Discipline handlers
  const openNewDiscipline = () => {
    setEditingItem(null);
    setDisciplineForm({
      name: '',
      description: '',
      display_order: disciplines.length,
      is_active: true,
      area_id: '',
    });
    setDialogMode('discipline');
  };

  const openEditDiscipline = (discipline: Discipline) => {
    setEditingItem(discipline);
    setDisciplineForm({
      name: discipline.name,
      description: discipline.description || '',
      display_order: discipline.display_order || 0,
      is_active: discipline.is_active ?? true,
      area_id: discipline.area_id || '',
    });
    setDialogMode('discipline');
  };

  const saveDiscipline = async () => {
    if (!disciplineForm.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSaving(true);

    if (editingItem) {
      const discipline = editingItem as Discipline;
      
      // Update discipline
      const { error } = await supabase
        .from('study_disciplines')
        .update({
          name: disciplineForm.name,
          description: disciplineForm.description || null,
          display_order: disciplineForm.display_order,
          is_active: disciplineForm.is_active,
          area_id: disciplineForm.area_id || null,
        })
        .eq('id', discipline.id);

      if (error) {
        toast.error('Erro ao atualizar disciplina');
        setSaving(false);
        return;
      }

      // Also update the corresponding folder if exists
      if (discipline.source_notebook_folder_id) {
        await supabase
          .from('admin_notebook_folders')
          .update({
            name: disciplineForm.name,
            is_active: disciplineForm.is_active,
          })
          .eq('id', discipline.source_notebook_folder_id);
      }

      toast.success('Disciplina atualizada!');
      setDialogMode(null);
      fetchDisciplines();
    } else {
      // Create new folder first
      const { data: folderData, error: folderError } = await supabase
        .from('admin_notebook_folders')
        .insert({
          name: disciplineForm.name,
          is_active: disciplineForm.is_active,
        })
        .select()
        .single();

      if (folderError) {
        toast.error('Erro ao criar pasta');
        setSaving(false);
        return;
      }

      // Then create discipline linked to folder
      const { error } = await supabase
        .from('study_disciplines')
        .insert({
          name: disciplineForm.name,
          description: disciplineForm.description || null,
          display_order: disciplineForm.display_order,
          is_active: disciplineForm.is_active,
          source_notebook_folder_id: folderData.id,
          is_auto_generated: true,
          area_id: disciplineForm.area_id || null,
        });

      if (error) {
        // Rollback folder creation
        await supabase.from('admin_notebook_folders').delete().eq('id', folderData.id);
        toast.error('Erro ao criar disciplina');
      } else {
        toast.success('Disciplina criada!');
        setDialogMode(null);
        fetchDisciplines();
      }
    }

    setSaving(false);
  };

  const [deleting, setDeleting] = useState(false);

  const deleteDiscipline = async (discipline: Discipline) => {
    if (!confirm(`⚠️ ATENÇÃO: Excluir disciplina "${discipline.name}"?\n\nISTO IRÁ EXCLUIR PERMANENTEMENTE:\n- Todos os tópicos desta disciplina\n- Todos os cadernos vinculados\n- Todas as questões relacionadas\n- Todos os dados de respostas dos usuários\n\nEsta ação NÃO pode ser desfeita!`)) return;

    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc('delete_discipline_cascade', {
        discipline_id_param: discipline.id
      });

      if (error) throw error;

      // Handle both possible formats - direct object or JSON string
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      
      if (result && result.success === false) {
        throw new Error(result.error || 'Erro desconhecido');
      }
      
      const deletedQuestions = result?.deleted_questions ?? 0;
      const updatedQuestions = result?.updated_questions ?? 0;
      const deletedTopics = result?.deleted_topics ?? 0;
      const deletedNotebooks = result?.deleted_notebooks ?? 0;
      
      const parts: string[] = [];
      if (deletedQuestions > 0) parts.push(`${deletedQuestions} questões excluídas`);
      if (updatedQuestions > 0) parts.push(`${updatedQuestions} questões atualizadas`);
      if (deletedTopics > 0) parts.push(`${deletedTopics} tópicos`);
      if (deletedNotebooks > 0) parts.push(`${deletedNotebooks} cadernos`);
      
      toast.success(`Disciplina excluída! ${parts.length > 0 ? 'Removidos: ' + parts.join(', ') + '.' : ''}`);
      fetchAll();
    } catch (error: any) {
      console.error('Error deleting discipline:', error);
      toast.error('Erro ao excluir disciplina: ' + error.message);
    } finally {
      setDeleting(false);
    }
  };

  // Topic handlers
  const openNewTopic = (disciplineId: string) => {
    setEditingItem(null);
    setParentId(disciplineId);
    const existingTopics = topics.filter(t => t.study_discipline_id === disciplineId);
    setTopicForm({
      name: '',
      description: '',
      display_order: existingTopics.length,
      is_active: true,
    });
    setDialogMode('topic');
  };

  const openEditTopic = (topic: Topic) => {
    setEditingItem(topic);
    setParentId(topic.study_discipline_id);
    setTopicForm({
      name: topic.name,
      description: topic.description || '',
      display_order: topic.display_order || 0,
      is_active: topic.is_active ?? true,
    });
    setDialogMode('topic');
  };

  const saveTopic = async () => {
    if (!topicForm.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSaving(true);

    if (editingItem) {
      const topic = editingItem as Topic;
      
      // Update topic
      const { error } = await supabase
        .from('study_topics')
        .update({
          name: topicForm.name,
          description: topicForm.description || null,
          display_order: topicForm.display_order,
          is_active: topicForm.is_active,
        })
        .eq('id', topic.id);

      if (error) {
        toast.error('Erro ao atualizar tópico');
        setSaving(false);
        return;
      }

      // Also update the corresponding notebook if exists
      if (topic.source_notebook_id) {
        await supabase
          .from('admin_question_notebooks')
          .update({
            name: topicForm.name,
            is_active: topicForm.is_active,
          })
          .eq('id', topic.source_notebook_id);
      }

      toast.success('Tópico atualizado!');
      setDialogMode(null);
      fetchTopics();
    } else {
      // Find parent discipline to get folder_id
      const parentDiscipline = disciplines.find(d => d.id === parentId);
      
      // Create notebook first if discipline has a folder
      let notebookId: string | null = null;
      if (parentDiscipline?.source_notebook_folder_id) {
        const { data: notebookData, error: notebookError } = await supabase
          .from('admin_question_notebooks')
          .insert({
            name: topicForm.name,
            folder_id: parentDiscipline.source_notebook_folder_id,
            is_active: topicForm.is_active,
          })
          .select()
          .single();

        if (!notebookError && notebookData) {
          notebookId = notebookData.id;
        }
      }

      // Create topic
      const { error } = await supabase
        .from('study_topics')
        .insert({
          study_discipline_id: parentId,
          name: topicForm.name,
          description: topicForm.description || null,
          display_order: topicForm.display_order,
          is_active: topicForm.is_active,
          source_notebook_id: notebookId,
        });

      if (error) {
        // Rollback notebook creation
        if (notebookId) {
          await supabase.from('admin_question_notebooks').delete().eq('id', notebookId);
        }
        toast.error('Erro ao criar tópico');
      } else {
        toast.success('Tópico criado!');
        setDialogMode(null);
        fetchTopics();
      }
    }

    setSaving(false);
  };

  const deleteTopic = async (topic: Topic) => {
    if (!confirm(`Excluir tópico "${topic.name}"?`)) return;

    const { error } = await supabase
      .from('study_topics')
      .delete()
      .eq('id', topic.id);

    if (error) {
      toast.error('Erro ao excluir tópico');
    } else {
      toast.success('Tópico excluído!');
      fetchAll();
    }
  };

  // Toggle selection for a discipline
  const toggleDisciplineSelection = (disciplineId: string) => {
    setSelectedDisciplineIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(disciplineId)) {
        newSet.delete(disciplineId);
      } else {
        newSet.add(disciplineId);
      }
      return newSet;
    });
  };

  // Select/deselect all visible disciplines
  const toggleSelectAll = () => {
    if (selectedDisciplineIds.size === disciplines.length) {
      setSelectedDisciplineIds(new Set());
    } else {
      setSelectedDisciplineIds(new Set(disciplines.map(d => d.id)));
    }
  };

  // Batch activate/deactivate disciplines
  const batchSetDisciplinesActive = async (active: boolean) => {
    if (selectedDisciplineIds.size === 0) {
      toast.error('Selecione ao menos uma disciplina');
      return;
    }

    setBatchProcessing(true);
    try {
      const ids = Array.from(selectedDisciplineIds);
      
      // Update disciplines
      const { error } = await supabase
        .from('study_disciplines')
        .update({ is_active: active })
        .in('id', ids);

      if (error) throw error;

      // Also update corresponding folders
      const disciplinesToUpdate = disciplines.filter(d => ids.includes(d.id) && d.source_notebook_folder_id);
      const folderIds = disciplinesToUpdate.map(d => d.source_notebook_folder_id).filter(Boolean) as string[];
      
      if (folderIds.length > 0) {
        await supabase
          .from('admin_notebook_folders')
          .update({ is_active: active })
          .in('id', folderIds);
      }

      toast.success(`${ids.length} disciplina(s) ${active ? 'ativada(s)' : 'desativada(s)'}!`);
      setSelectedDisciplineIds(new Set());
      fetchDisciplines();
    } catch (error: any) {
      console.error('Error batch updating disciplines:', error);
      toast.error('Erro ao atualizar disciplinas');
    } finally {
      setBatchProcessing(false);
    }
  };

  // Activate all topics within a discipline
  const activateAllTopics = async (disciplineId: string) => {
    const disciplineTopics = topics.filter(t => t.study_discipline_id === disciplineId);
    const inactiveTopics = disciplineTopics.filter(t => !t.is_active);
    
    if (inactiveTopics.length === 0) {
      toast.info('Todos os tópicos já estão ativos');
      return;
    }

    setSaving(true);
    try {
      const topicIds = inactiveTopics.map(t => t.id);
      
      // Update topics
      const { error } = await supabase
        .from('study_topics')
        .update({ is_active: true })
        .in('id', topicIds);

      if (error) throw error;

      // Also update corresponding notebooks
      const notebookIds = inactiveTopics.map(t => t.source_notebook_id).filter(Boolean) as string[];
      if (notebookIds.length > 0) {
        await supabase
          .from('admin_question_notebooks')
          .update({ is_active: true })
          .in('id', notebookIds);
      }

      toast.success(`${topicIds.length} tópico(s) ativado(s)!`);
      fetchTopics();
    } catch (error: any) {
      console.error('Error activating topics:', error);
      toast.error('Erro ao ativar tópicos');
    } finally {
      setSaving(false);
    }
  };

  // Deactivate all topics within a discipline
  const deactivateAllTopics = async (disciplineId: string) => {
    const disciplineTopics = topics.filter(t => t.study_discipline_id === disciplineId);
    const activeTopics = disciplineTopics.filter(t => t.is_active);
    
    if (activeTopics.length === 0) {
      toast.info('Todos os tópicos já estão inativos');
      return;
    }

    setSaving(true);
    try {
      const topicIds = activeTopics.map(t => t.id);
      
      // Update topics
      const { error } = await supabase
        .from('study_topics')
        .update({ is_active: false })
        .in('id', topicIds);

      if (error) throw error;

      // Also update corresponding notebooks
      const notebookIds = activeTopics.map(t => t.source_notebook_id).filter(Boolean) as string[];
      if (notebookIds.length > 0) {
        await supabase
          .from('admin_question_notebooks')
          .update({ is_active: false })
          .in('id', notebookIds);
      }

      toast.success(`${topicIds.length} tópico(s) desativado(s)!`);
      fetchTopics();
    } catch (error: any) {
      console.error('Error deactivating topics:', error);
      toast.error('Erro ao desativar tópicos');
    } finally {
      setSaving(false);
    }
  };

  const getTopicsForDiscipline = (disciplineId: string) => {
    return topics
      .filter(t => t.study_discipline_id === disciplineId)
      .sort((a, b) => {
        // Sort by display_order first (nulls last), then by name
        const orderA = a.display_order ?? 999999;
        const orderB = b.display_order ?? 999999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
  };

  // Handle topic reordering via drag-and-drop
  const [reorderingSaving, setReorderingSaving] = useState(false);

  const handleTopicDragEnd = useCallback(async (result: DropResult, disciplineId: string) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    if (sourceIndex === destinationIndex) return;

    // Get topics for this discipline
    const disciplineTopics = getTopicsForDiscipline(disciplineId);
    
    // Reorder the array
    const reorderedTopics = Array.from(disciplineTopics);
    const [movedTopic] = reorderedTopics.splice(sourceIndex, 1);
    reorderedTopics.splice(destinationIndex, 0, movedTopic);

    // Optimistic update - update local state immediately
    const newDisplayOrders = reorderedTopics.map((topic, index) => ({
      ...topic,
      display_order: index
    }));

    // Update local state
    setTopics(prevTopics => {
      const otherTopics = prevTopics.filter(t => t.study_discipline_id !== disciplineId);
      return [...otherTopics, ...newDisplayOrders];
    });

    // Save to database
    setReorderingSaving(true);
    try {
      // Update each topic's display_order - use Promise.allSettled for better error handling
      const updatePromises = newDisplayOrders.map((topic, index) => 
        supabase
          .from('study_topics')
          .update({ display_order: index })
          .eq('id', topic.id)
          .then(({ error }) => {
            if (error) throw new Error(`Topic ${topic.id}: ${error.message}`);
            return { id: topic.id, success: true };
          })
      );

      const results = await Promise.allSettled(updatePromises);
      const failures = results.filter(r => r.status === 'rejected');
      
      if (failures.length > 0) {
        console.error('Some topic order updates failed:', failures);
        toast.error(`${failures.length} tópico(s) não foram atualizados`);
      } else {
        console.log(`[AdminDisciplines] Topic order saved successfully for ${newDisplayOrders.length} topics`);
        toast.success('Ordem dos tópicos atualizada!');
      }
    } catch (error) {
      console.error('Error saving topic order:', error);
      toast.error('Erro ao salvar ordem dos tópicos');
      // Revert on error
      fetchTopics();
    } finally {
      setReorderingSaving(false);
    }
  }, [topics]);

  const getEditaisForDiscipline = (disciplineId: string): string[] => {
    return schoolDisciplines
      .filter(sd => sd.discipline_id === disciplineId && sd.is_active)
      .map(sd => sd.school_id);
  };

  const getEditalNames = (editalIds: string[]): string[] => {
    return editalIds
      .map(id => editais.find(e => e.id === id)?.name)
      .filter(Boolean) as string[];
  };

  const openLinkEdital = (discipline: Discipline) => {
    setLinkingDiscipline(discipline);
    setSelectedEditais(discipline.linkedEditais || []);
    setDialogMode('link-edital');
  };

  const saveLinkEditais = async () => {
    if (!linkingDiscipline) return;

    setSaving(true);
    try {
      // Get current links
      const currentLinks = schoolDisciplines.filter(
        sd => sd.discipline_id === linkingDiscipline.id
      );
      const currentEditalIds = currentLinks.map(sd => sd.school_id);

      // Editais to add (in selectedEditais but not in currentLinks)
      const toAdd = selectedEditais.filter(id => !currentEditalIds.includes(id));
      
      // Editais to remove (in currentLinks but not in selectedEditais)
      const toRemove = currentEditalIds.filter(id => !selectedEditais.includes(id));

      // Add new links
      if (toAdd.length > 0) {
        const insertData = toAdd.map(schoolId => ({
          school_id: schoolId,
          discipline_id: linkingDiscipline.id,
          is_active: true
        }));
        
        const { error: insertError } = await supabase
          .from('school_disciplines')
          .insert(insertData);

        if (insertError) throw insertError;
      }

      // Remove old links
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('school_disciplines')
          .delete()
          .eq('discipline_id', linkingDiscipline.id)
          .in('school_id', toRemove);

        if (deleteError) throw deleteError;
      }

      toast.success('Vínculos atualizados com sucesso!');
      setDialogMode(null);
      setLinkingDiscipline(null);
      fetchAll();
      refreshEditais();
    } catch (error: any) {
      console.error('Error updating edital links:', error);
      toast.error('Erro ao atualizar vínculos: ' + error.message);
    } finally {
      setSaving(false);
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Disciplinas e Tópicos
              </CardTitle>
              <CardDescription>
                Gerencie disciplinas e tópicos para categorizar questões
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchAll}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
              <Button size="sm" onClick={openNewDiscipline}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Disciplina
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 pb-4 mb-4 border-b">
            <EditalSchoolFilter 
              editalValue={filterEditalId}
              schoolValue={filterEdital}
              onEditalChange={(v) => setFilterEditalId(v === 'all' ? '' : v)}
              onSchoolChange={(v) => setFilterEdital(v === 'all' ? '' : v)}
              showQuestionCount={false}
            />
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Status:</Label>
              <div className="flex gap-1">
                <Button 
                  variant={filterStatus === 'all' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setFilterStatus('all')}
                >
                  Todos
                </Button>
                <Button 
                  variant={filterStatus === 'active' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setFilterStatus('active')}
                  className="gap-1"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Ativos
                </Button>
                <Button 
                  variant={filterStatus === 'inactive' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setFilterStatus('inactive')}
                  className="gap-1"
                >
                  <XCircle className="w-3 h-3" />
                  Inativos
                </Button>
              </div>
            </div>
          </div>

          {/* Batch Actions */}
          {disciplines.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 py-3 px-4 mb-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedDisciplineIds.size === disciplines.length && disciplines.length > 0} 
                  onCheckedChange={toggleSelectAll}
                  id="select-all-disciplines"
                />
                <Label htmlFor="select-all-disciplines" className="text-sm font-medium cursor-pointer">
                  Selecionar tudo ({disciplines.length})
                </Label>
              </div>
              
              {selectedDisciplineIds.size > 0 && (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedDisciplineIds.size} selecionada(s)
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => batchSetDisciplinesActive(true)}
                    disabled={batchProcessing}
                    className="gap-1"
                  >
                    {batchProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
                    Ativar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => batchSetDisciplinesActive(false)}
                    disabled={batchProcessing}
                    className="gap-1"
                  >
                    {batchProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 text-red-600" />}
                    Desativar
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedDisciplineIds(new Set())}
                  >
                    Limpar seleção
                  </Button>
                </>
              )}
            </div>
          )}

          {disciplines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {filterEdital ? 'Nenhuma disciplina encontrada para este edital' : 'Nenhuma disciplina cadastrada'}
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {disciplines.map((discipline) => {
                const disciplineTopics = getTopicsForDiscipline(discipline.id);
                const linkedEditalNames = getEditalNames(discipline.linkedEditais || []);
                const activeTopicsCount = disciplineTopics.filter(t => t.is_active).length;
                const inactiveTopicsCount = disciplineTopics.filter(t => !t.is_active).length;
                return (
                  <AccordionItem key={discipline.id} value={discipline.id} className="border rounded-lg">
                    <div className="flex items-center gap-3 py-3 px-4">
                      {/* Checkbox for batch selection */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedDisciplineIds.has(discipline.id)}
                          onCheckedChange={() => toggleDisciplineSelection(discipline.id)}
                        />
                      </div>
                      
                      {/* Main content area with accordion trigger */}
                      <AccordionTrigger className="hover:no-underline flex-1 py-0 [&>svg]:ml-auto">
                        <div className="flex flex-col items-start text-left flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{discipline.name}</span>
                            {!discipline.is_active && (
                              <Badge variant="outline" className="text-xs bg-muted">Inativo</Badge>
                            )}
                            <Badge variant="secondary" className="text-xs gap-1">
                              <FileQuestion className="w-3 h-3" />
                              {(discipline.question_count || 0).toLocaleString()}
                            </Badge>
                            {discipline.area_id && (
                              <Badge variant="outline" className="text-xs text-primary border-primary/50">
                                {areas.find(a => a.id === discipline.area_id)?.name || 'Área'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              {disciplineTopics.length} tópico{disciplineTopics.length !== 1 ? 's' : ''}
                            </span>
                            {linkedEditalNames.length > 0 && (
                              <>
                                <span className="text-xs text-muted-foreground">•</span>
                                <div className="flex flex-wrap gap-1">
                                  {linkedEditalNames.map((name, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {name}
                                    </Badge>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      
                      {/* Action buttons */}
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openLinkEdital(discipline); }} title="Vincular a editais">
                          <Link2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEditDiscipline(discipline); }} title="Editar disciplina">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteDiscipline(discipline); }} disabled={deleting} title="Excluir disciplina">
                          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <AccordionContent className="px-4 pb-4">
                      <div className="pt-2 space-y-4">
                        {/* Topic batch actions */}
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => openNewTopic(discipline.id)}>
                            <Plus className="w-4 h-4 mr-1" />
                            Novo Tópico
                          </Button>
                          {inactiveTopicsCount > 0 && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => activateAllTopics(discipline.id)}
                              disabled={saving}
                              className="gap-1"
                            >
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              Ativar todos ({inactiveTopicsCount})
                            </Button>
                          )}
                          {activeTopicsCount > 0 && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => deactivateAllTopics(discipline.id)}
                              disabled={saving}
                              className="gap-1"
                            >
                              <XCircle className="w-4 h-4 text-red-600" />
                              Desativar todos ({activeTopicsCount})
                            </Button>
                          )}
                        </div>

                        {/* Topics */}
                        {disciplineTopics.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium">Tópicos</h4>
                              <span className="text-xs text-muted-foreground">
                                {reorderingSaving ? (
                                  <span className="flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Salvando...
                                  </span>
                                ) : (
                                  'Arraste para reordenar'
                                )}
                              </span>
                            </div>
                            <DragDropContext onDragEnd={(result) => handleTopicDragEnd(result, discipline.id)}>
                              <Droppable droppableId={`topics-${discipline.id}`}>
                                {(provided) => (
                                  <table className="w-full caption-bottom text-sm">
                                    <thead className="[&_tr]:border-b">
                                      <tr className="border-b transition-colors hover:bg-muted/50">
                                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground w-[40px]"></th>
                                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Nome</th>
                                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Questões</th>
                                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Status</th>
                                        <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground w-[100px]">Ações</th>
                                      </tr>
                                    </thead>
                                    <tbody 
                                      ref={provided.innerRef} 
                                      {...provided.droppableProps}
                                      className="[&_tr:last-child]:border-0"
                                    >
                                      {disciplineTopics.map((topic, index) => (
                                        <Draggable key={topic.id} draggableId={topic.id} index={index}>
                                          {(provided, snapshot) => (
                                            <tr 
                                              ref={provided.innerRef}
                                              {...provided.draggableProps}
                                              className={`border-b transition-colors hover:bg-muted/50 ${snapshot.isDragging ? 'bg-muted shadow-lg' : ''}`}
                                            >
                                              <td className="p-2 align-middle w-[40px]">
                                                <div 
                                                  {...provided.dragHandleProps}
                                                  className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
                                                >
                                                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                              </td>
                                              <td className="p-2 align-middle">
                                                <div className="flex items-center gap-2">
                                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                  {topic.name}
                                                </div>
                                              </td>
                                              <td className="p-2 align-middle">
                                                <Badge variant="secondary" className="text-xs gap-1">
                                                  <FileQuestion className="w-3 h-3" />
                                                  {(topic.question_count || 0).toLocaleString()}
                                                </Badge>
                                              </td>
                                              <td className="p-2 align-middle">
                                                <Badge variant={topic.is_active ? "default" : "outline"}>
                                                  {topic.is_active ? "Ativo" : "Inativo"}
                                                </Badge>
                                              </td>
                                              <td className="p-2 align-middle">
                                                <div className="flex gap-1">
                                                  {discipline.is_source === false && (
                                                    <Button 
                                                      variant="ghost" 
                                                      size="icon" 
                                                      onClick={() => {
                                                        const params = new URLSearchParams({
                                                          tab: 'importar',
                                                          topicId: topic.id,
                                                          disciplineId: discipline.id,
                                                          ...(filterEditalId && filterEditalId !== 'all' ? { editalId: filterEditalId } : {}),
                                                        });
                                                        navigate(`/admin?${params.toString()}`);
                                                        // Force page reload to pick up params
                                                        window.location.href = `/admin?${params.toString()}`;
                                                      }}
                                                      title="Importar questões neste tópico"
                                                    >
                                                      <Upload className="w-4 h-4 text-primary" />
                                                    </Button>
                                                  )}
                                                  <Button variant="ghost" size="icon" onClick={() => openEditTopic(topic)}>
                                                    <Edit className="w-4 h-4" />
                                                  </Button>
                                                  <Button variant="ghost" size="icon" onClick={() => deleteTopic(topic)}>
                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                  </Button>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </Draggable>
                                      ))}
                                      {provided.placeholder}
                                    </tbody>
                                  </table>
                                )}
                              </Droppable>
                            </DragDropContext>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Discipline Dialog */}
      <Dialog open={dialogMode === 'discipline'} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Disciplina' : 'Nova Disciplina'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Atualize as informações da disciplina' : 'Crie uma nova disciplina para categorizar questões'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={disciplineForm.name}
                onChange={(e) => setDisciplineForm({ ...disciplineForm, name: e.target.value })}
                placeholder="Ex: Direito Constitucional"
              />
            </div>
            <div className="space-y-2">
              <Label>Área</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={disciplineForm.area_id}
                onChange={(e) => setDisciplineForm({ ...disciplineForm, area_id: e.target.value })}
              >
                <option value="">Selecione uma área...</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                A área vincula a disciplina ao Robô Tutor correspondente
              </p>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={disciplineForm.description}
                onChange={(e) => setDisciplineForm({ ...disciplineForm, description: e.target.value })}
                placeholder="Descrição da disciplina..."
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch
                checked={disciplineForm.is_active}
                onCheckedChange={(checked) => setDisciplineForm({ ...disciplineForm, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>Cancelar</Button>
            <Button onClick={saveDiscipline} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingItem ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Topic Dialog */}
      <Dialog open={dialogMode === 'topic'} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Tópico' : 'Novo Tópico'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Atualize as informações do tópico' : 'Crie um novo tópico dentro da disciplina'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={topicForm.name}
                onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })}
                placeholder="Ex: Direitos Fundamentais"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={topicForm.description}
                onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
                placeholder="Descrição do tópico..."
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch
                checked={topicForm.is_active}
                onCheckedChange={(checked) => setTopicForm({ ...topicForm, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>Cancelar</Button>
            <Button onClick={saveTopic} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingItem ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Edital Dialog */}
      <Dialog open={dialogMode === 'link-edital'} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular a Editais</DialogTitle>
            <DialogDescription>
              Selecione os editais aos quais a disciplina "{linkingDiscipline?.name}" deve estar vinculada
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {editais.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                Nenhum edital cadastrado
              </div>
            ) : (
              editais.map((edital) => (
                <div key={edital.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                  <Checkbox
                    id={`edital-${edital.id}`}
                    checked={selectedEditais.includes(edital.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedEditais([...selectedEditais, edital.id]);
                      } else {
                        setSelectedEditais(selectedEditais.filter(id => id !== edital.id));
                      }
                    }}
                  />
                  <Label htmlFor={`edital-${edital.id}`} className="flex-1 cursor-pointer">
                    <div className="font-medium">{edital.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {edital.discipline_count || 0} disciplina{(edital.discipline_count || 0) !== 1 ? 's' : ''} vinculada{(edital.discipline_count || 0) !== 1 ? 's' : ''}
                    </div>
                  </Label>
                  {selectedEditais.includes(edital.id) ? (
                    <Link2 className="w-4 h-4 text-primary" />
                  ) : (
                    <Unlink className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>Cancelar</Button>
            <Button onClick={saveLinkEditais} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Vínculos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
