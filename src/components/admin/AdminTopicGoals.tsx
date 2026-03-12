import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Trash2, Target, ChevronRight, FileText, Clock, BookOpen, HelpCircle, Wand2, Video, Layers, School, GraduationCap, RefreshCw, AlertTriangle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sanitizeNotebookIds, createResolutionResult, NotebookResolutionResult } from '@/lib/sanitizeNotebookIds';
import { cronogramaLogger } from '@/lib/cronograma/cronogramaLogger';

interface Edital {
  id: string;
  name: string;
}

interface School {
  id: string;
  name: string;
  edital_id: string | null;
}

interface Discipline {
  id: string;
  name: string;
  questions_per_hour: number | null;
}

interface Topic {
  id: string;
  name: string;
  study_discipline_id: string;
  source_notebook_id: string | null;
}

interface TopicGoal {
  id: string;
  topic_id: string;
  name: string;
  description: string | null;
  goal_type: string;
  duration_minutes: number;
  display_order: number;
  pdf_links: { name: string; url: string }[];
  video_links: { name: string; url: string }[];
  flashcard_links: string[];
  question_notebook_ids: string[];
  is_active: boolean;
}

interface Notebook {
  id: string;
  name: string;
  study_topic_id: string | null;
}

export function AdminTopicGoals() {
  const { toast } = useToast();
  const [editais, setEditais] = useState<Edital[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [goals, setGoals] = useState<TopicGoal[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [topicsWithoutGoals, setTopicsWithoutGoals] = useState<string[]>([]);
  const [missingGoalsDisciplines, setMissingGoalsDisciplines] = useState<{ id: string; name: string; missing: number; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMetric, setSavingMetric] = useState<string | null>(null);
  const [disciplineQuestionCounts, setDisciplineQuestionCounts] = useState<Record<string, number>>({});
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, label: '' });
  
  const [selectedEdital, setSelectedEdital] = useState<string>('');
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<TopicGoal | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    goal_type: 'study',
    duration_minutes: 60,
    display_order: 0,
    pdf_links: [] as { name: string; url: string }[],
    video_links: [] as { name: string; url: string }[],
    flashcard_links: [] as string[],
    question_notebook_ids: [] as string[],
    is_active: true
  });
  const [newPdfName, setNewPdfName] = useState('');
  const [newPdfUrl, setNewPdfUrl] = useState('');
  const [newVideoName, setNewVideoName] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');

  const fetchEditais = async () => {
    try {
      const { data, error } = await supabase
        .from('editals')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setEditais((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching editais:', error);
    }
  };

  const fetchSchools = async (editalId: string) => {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, edital_id')
        .eq('edital_id', editalId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSchools(data || []);
      
      // If no schools found, we'll load disciplines directly from edital
      if (!data || data.length === 0) {
        fetchDisciplinesFromEdital(editalId);
      }
    } catch (error) {
      console.error('Error fetching schools:', error);
    }
  };

  // Fetch disciplines directly from edital (when no school is selected or edital has no schools)
  const fetchDisciplinesFromEdital = async (editalId: string) => {
    try {
      const { data, error } = await supabase
        .from('edital_disciplines')
        .select(`
          discipline_id,
          discipline:study_disciplines(id, name, questions_per_hour)
        `)
        .eq('edital_id', editalId)
        .eq('is_active', true);

      if (error) throw error;
      
      const formattedDisciplines = (data || [])
        .map(item => item.discipline as unknown as Discipline)
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      
      setDisciplines(formattedDisciplines);
      fetchDisciplineQuestionCounts(formattedDisciplines.map(d => d.id));
      checkMissingGoalsForDisciplines(formattedDisciplines);
    } catch (error) {
      console.error('Error fetching disciplines from edital:', error);
    }
  };

  const fetchDisciplines = async (schoolId: string) => {
    try {
      // Get disciplines linked to this school
      const { data, error } = await supabase
        .from('school_disciplines')
        .select(`
          discipline_id,
          discipline:study_disciplines(id, name, questions_per_hour)
        `)
        .eq('school_id', schoolId)
        .eq('is_active', true);

      if (error) throw error;
      
      const formattedDisciplines = (data || [])
        .map(item => item.discipline as unknown as Discipline)
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      
      setDisciplines(formattedDisciplines);
      fetchDisciplineQuestionCounts(formattedDisciplines.map(d => d.id));
      checkMissingGoalsForDisciplines(formattedDisciplines);
    } catch (error) {
      console.error('Error fetching disciplines:', error);
    }
  };

  const fetchDisciplineQuestionCounts = async (disciplineIds: string[]) => {
    if (disciplineIds.length === 0) return;
    try {
      const { data, error } = await supabase
        .rpc('get_discipline_question_counts', { discipline_ids: disciplineIds });
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.discipline_id] = Number(row.question_count) || 0;
      }
      setDisciplineQuestionCounts(counts);
    } catch (error) {
      console.error('Error fetching question counts:', error);
    }
  };

  // Check which disciplines have topics without any active question goals
  const checkMissingGoalsForDisciplines = async (
    discs: Discipline[]
  ): Promise<{ id: string; name: string; missing: number; total: number }[]> => {
    if (discs.length === 0) {
      setMissingGoalsDisciplines([]);
      return [];
    }
    
    try {
      const discIds = discs.map(d => d.id);
      
      // Get all active topics for these disciplines
      const { data: allTopics } = await supabase
        .from('study_topics')
        .select('id, study_discipline_id')
        .in('study_discipline_id', discIds)
        .eq('is_active', true);
      
      if (!allTopics || allTopics.length === 0) {
        setMissingGoalsDisciplines([]);
        return [];
      }
      
      const topicIds = allTopics.map(t => t.id);
      
      // Batch topic IDs to avoid URI too large
      const BATCH = 200;
      const topicsWithGoalsSet = new Set<string>();
      for (let i = 0; i < topicIds.length; i += BATCH) {
        const batch = topicIds.slice(i, i + BATCH);
        const { data: goalsData } = await supabase
          .from('topic_goals')
          .select('topic_id')
          .in('topic_id', batch)
          .eq('is_active', true)
          .eq('goal_type', 'questions');
        
        for (const g of goalsData || []) {
          topicsWithGoalsSet.add(g.topic_id);
        }
      }
      
      // Group by discipline
      const discStats: Record<string, { total: number; missing: number }> = {};
      for (const t of allTopics) {
        if (!discStats[t.study_discipline_id]) {
          discStats[t.study_discipline_id] = { total: 0, missing: 0 };
        }
        discStats[t.study_discipline_id].total++;
        if (!topicsWithGoalsSet.has(t.id)) {
          discStats[t.study_discipline_id].missing++;
        }
      }
      
      const missing = discs
        .filter(d => discStats[d.id]?.missing > 0)
        .map(d => ({
          id: d.id,
          name: d.name,
          missing: discStats[d.id].missing,
          total: discStats[d.id].total,
        }));
      
      setMissingGoalsDisciplines(missing);
      return missing;
    } catch (error) {
      console.error('Error checking missing goals:', error);
      return [];
    }
  };

  const fetchTopics = async (disciplineId: string) => {
    try {
      const { data, error } = await supabase
        .from('study_topics')
        .select('id, name, study_discipline_id, source_notebook_id')
        .eq('study_discipline_id', disciplineId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setTopics(data || []);
      
      // Check which topics have NO active goals
      if (data && data.length > 0) {
        const topicIds = data.map(t => t.id);
        const { data: goalsData } = await supabase
          .from('topic_goals')
          .select('topic_id')
          .in('topic_id', topicIds)
          .eq('is_active', true);
        
        const topicsWithGoals = new Set((goalsData || []).map(g => g.topic_id));
        const pendingTopics = topicIds.filter(id => !topicsWithGoals.has(id));
        setTopicsWithoutGoals(pendingTopics);
      } else {
        setTopicsWithoutGoals([]);
      }
    } catch (error) {
      console.error('Error fetching topics:', error);
    }
  };

  const fetchGoals = async (topicId: string) => {
    try {
      const { data, error } = await supabase
        .from('topic_goals')
        .select('*')
        .eq('topic_id', topicId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setGoals((data || []).map(g => ({
        ...g,
        pdf_links: (g.pdf_links as { name: string; url: string }[]) || [],
        video_links: (g.video_links as { name: string; url: string }[]) || [],
        flashcard_links: (g.flashcard_links as string[]) || [],
        question_notebook_ids: g.question_notebook_ids || []
      })));
    } catch (error) {
      console.error('Error fetching goals:', error);
    }
  };

  const fetchNotebooks = async () => {
    try {
      // Paginate to load ALL notebooks (Supabase default limit is 1000)
      const allNotebooks: Notebook[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('admin_question_notebooks')
          .select('id, name, study_topic_id')
          .eq('is_active', true)
          .order('name', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        
        const page = data || [];
        allNotebooks.push(...page);
        
        if (page.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          from += PAGE_SIZE;
        }
      }

      console.info(`[AdminTopicGoals] Loaded ${allNotebooks.length} notebooks (paginated)`);
      setNotebooks(allNotebooks);
    } catch (error) {
      console.error('Error fetching notebooks:', error);
    }
  };

  // Debounced metric updates to prevent rapid-fire DB calls
  const metricTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [localMetrics, setLocalMetrics] = useState<Record<string, string>>({});

  const handleMetricChange = (disciplineId: string, rawValue: string) => {
    // Update local state immediately (controlled input)
    setLocalMetrics(prev => ({ ...prev, [disciplineId]: rawValue }));

    // Clear previous timer for this discipline
    if (metricTimers.current[disciplineId]) {
      clearTimeout(metricTimers.current[disciplineId]);
    }

    // Debounce the actual save
    metricTimers.current[disciplineId] = setTimeout(() => {
      const parsed = parseInt(rawValue);
      if (!parsed || parsed < 1 || parsed > 500) return;
      updateQuestionsPerHour(disciplineId, parsed);
    }, 800);
  };

  const updateQuestionsPerHour = async (disciplineId: string, value: number) => {
    setSavingMetric(disciplineId);
    try {
      // 1. Update the discipline itself
      const { error } = await supabase
        .from('study_disciplines')
        .update({ questions_per_hour: value })
        .eq('id', disciplineId);

      if (error) throw error;

      // 2. Propagate to all derived disciplines (source_discipline_id = this one)
      const { data: derivedCount, error: propError } = await supabase
        .from('study_disciplines')
        .update({ questions_per_hour: value })
        .eq('source_discipline_id', disciplineId)
        .select('id');

      if (propError) {
        console.warn('Propagation warning:', propError);
      }
      
      // Update local state
      setDisciplines(prev => prev.map(d => 
        d.id === disciplineId ? { ...d, questions_per_hour: value } : d
      ));
      // Clear local override since it's now saved
      setLocalMetrics(prev => {
        const next = { ...prev };
        delete next[disciplineId];
        return next;
      });

      const propagated = derivedCount?.length || 0;
      toast({ title: `Métrica atualizada!${propagated > 0 ? ` Propagada para ${propagated} escola(s).` : ''}` });
    } catch (error) {
      console.error('Error updating metric:', error);
      // Rollback local override
      setLocalMetrics(prev => {
        const next = { ...prev };
        delete next[disciplineId];
        return next;
      });
      toast({ title: 'Erro ao atualizar métrica', variant: 'destructive' });
    } finally {
      setSavingMetric(null);
    }
  };

  useEffect(() => {
    Promise.all([fetchEditais(), fetchNotebooks()]).then(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedEdital) {
      fetchSchools(selectedEdital);
      setSelectedSchool('');
      setSelectedDiscipline('');
      setSelectedTopic('');
      setSchools([]);
      setDisciplines([]);
      setTopics([]);
      setGoals([]);
    }
  }, [selectedEdital]);

  // When school is selected or when edital has no schools, load disciplines
  useEffect(() => {
    if (selectedSchool && selectedSchool !== 'all') {
      fetchDisciplines(selectedSchool);
      setSelectedDiscipline('');
      setSelectedTopic('');
      setTopics([]);
      setGoals([]);
    } else if ((selectedSchool === 'all' || selectedSchool === '') && selectedEdital) {
      // Load disciplines directly from edital when "all" is selected or no school is selected
      fetchDisciplinesFromEdital(selectedEdital);
      setSelectedDiscipline('');
      setSelectedTopic('');
      setTopics([]);
      setGoals([]);
    }
  }, [selectedSchool, selectedEdital]);

  useEffect(() => {
    if (selectedDiscipline) {
      fetchTopics(selectedDiscipline);
      setSelectedTopic('');
      setGoals([]);
    }
  }, [selectedDiscipline]);

  useEffect(() => {
    if (selectedTopic) {
      fetchGoals(selectedTopic);
    }
  }, [selectedTopic]);

  const handleSubmit = async () => {
    try {
      if (!formData.name.trim()) {
        toast({ title: 'Nome é obrigatório', variant: 'destructive' });
        return;
      }

      const payload = {
        topic_id: selectedTopic,
        name: formData.name,
        description: formData.description || null,
        goal_type: formData.goal_type,
        duration_minutes: formData.duration_minutes,
        display_order: formData.display_order,
        pdf_links: formData.pdf_links,
        video_links: formData.video_links,
        flashcard_links: formData.flashcard_links,
        question_notebook_ids: formData.question_notebook_ids,
        is_active: formData.is_active
      };

      if (editingGoal) {
        const { error } = await supabase
          .from('topic_goals')
          .update(payload)
          .eq('id', editingGoal.id);

        if (error) throw error;
        toast({ title: 'Meta atualizada com sucesso!' });
      } else {
        const { error } = await supabase
          .from('topic_goals')
          .insert(payload);

        if (error) throw error;
        toast({ title: 'Meta criada com sucesso!' });
      }

      setDialogOpen(false);
      setEditingGoal(null);
      resetForm();
      fetchGoals(selectedTopic);
    } catch (error) {
      console.error('Error saving goal:', error);
      toast({ title: 'Erro ao salvar meta', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      goal_type: 'study',
      duration_minutes: 60,
      display_order: goals.length,
      pdf_links: [],
      video_links: [],
      flashcard_links: [],
      question_notebook_ids: [],
      is_active: true
    });
    setNewPdfName('');
    setNewPdfUrl('');
    setNewVideoName('');
    setNewVideoUrl('');
  };

  const handleEdit = (goal: TopicGoal) => {
    setEditingGoal(goal);
    setFormData({
      name: goal.name,
      description: goal.description || '',
      goal_type: goal.goal_type,
      duration_minutes: goal.duration_minutes,
      display_order: goal.display_order,
      pdf_links: goal.pdf_links,
      video_links: goal.video_links,
      flashcard_links: goal.flashcard_links,
      question_notebook_ids: goal.question_notebook_ids,
      is_active: goal.is_active
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta meta?')) return;

    try {
      const { error } = await supabase
        .from('topic_goals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Meta excluída com sucesso!' });
      fetchGoals(selectedTopic);
    } catch (error) {
      console.error('Error deleting goal:', error);
      toast({ title: 'Erro ao excluir meta', variant: 'destructive' });
    }
  };

  const openNewDialog = () => {
    setEditingGoal(null);
    resetForm();
    setDialogOpen(true);
  };

  const addPdfLink = () => {
    if (newPdfName && newPdfUrl) {
      setFormData(prev => ({
        ...prev,
        pdf_links: [...prev.pdf_links, { name: newPdfName, url: newPdfUrl }]
      }));
      setNewPdfName('');
      setNewPdfUrl('');
    }
  };

  const removePdfLink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      pdf_links: prev.pdf_links.filter((_, i) => i !== index)
    }));
  };

  const addVideoLink = () => {
    if (newVideoName && newVideoUrl) {
      setFormData(prev => ({
        ...prev,
        video_links: [...prev.video_links, { name: newVideoName, url: newVideoUrl }]
      }));
      setNewVideoName('');
      setNewVideoUrl('');
    }
  };

  const removeVideoLink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      video_links: prev.video_links.filter((_, i) => i !== index)
    }));
  };

  // Helper function to validate notebook IDs exist in database
  // Returns string[] (not uuid[]) since question_notebook_ids is text[]
  async function validateNotebooksExist(
    candidateIds: string[],
    requireActive: boolean = true
  ): Promise<string[]> {
    if (candidateIds.length === 0) return [];
    
    let query = supabase
      .from('admin_question_notebooks')
      .select('id')
      .in('id', candidateIds);
    
    if (requireActive) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    const foundIds = (data || []).map(n => n.id);
    const foundSet = new Set(foundIds);
    // Preserve original order
    return candidateIds.filter(id => foundSet.has(id));
  };

  // Helper function to create or update question goal for a topic
  const createQuestionGoalForTopic = async (
    topic: Topic, 
    questionsPerHour: number,
    allNotebooks: Notebook[],
    updateExisting: boolean = false
  ): Promise<{ created: boolean; skipped: boolean; updated: boolean; noNotebook: boolean; noQuestions: boolean }> => {
    // Step 1: Determine notebook source and collect raw IDs
    let source: NotebookResolutionResult['source'] = 'NONE';
    let rawNotebookIds: string[] = [];
    
    // Try TOPIC_DIRECT first (notebooks linked directly to this topic)
    // Use filter + map to support MULTIPLE notebooks per topic
    const directNotebooks = allNotebooks.filter(n => n.study_topic_id === topic.id);
    if (directNotebooks.length > 0) {
      source = 'TOPIC_DIRECT';
      rawNotebookIds = directNotebooks.map(n => String(n.id));
    } 
    // Then try TOPIC_SOURCE_FALLBACK (topic.source_notebook_id)
    else if (topic.source_notebook_id) {
      source = 'TOPIC_SOURCE_FALLBACK';
      rawNotebookIds = [String(topic.source_notebook_id)];
    }
    
    // Step 2: Sanitize IDs (trim + UUID validation + dedup)
    const sanitizedIds = sanitizeNotebookIds(rawNotebookIds);
    
    // Step 3: Validate existence in database (only active notebooks)
    let validatedIds: string[] = [];
    if (sanitizedIds.length > 0) {
      validatedIds = await validateNotebooksExist(sanitizedIds, true);
    }
    
    // Step 4: Create resolution result for logging
    const resolution = createResolutionResult(source, rawNotebookIds, sanitizedIds, validatedIds);
    
    // LOG/AUDIT - Always log for traceability
    console.info('[AdminTopicGoals] Notebook resolution:', {
      topicId: topic.id,
      topicName: topic.name,
      ...resolution,
    });
    
    // Step 5: Get question count (sum from ALL validated notebooks)
    let questionCount = 0;
    
    if (validatedIds.length > 0) {
      // Get question_count from ALL validated notebooks and SUM them
      const { data: notebookData } = await supabase
        .from('admin_question_notebooks')
        .select('question_count')
        .in('id', validatedIds);
      
      questionCount = (notebookData || []).reduce(
        (sum, nb) => sum + (nb.question_count || 0), 
        0
      );
    } else {
      // No valid notebook - count questions linked via question_topics (for derived topics)
      const { count, error: countError } = await supabase
        .from('question_topics')
        .select('question_id', { count: 'exact', head: true })
        .eq('study_topic_id', topic.id);
      
      if (!countError && count !== null) {
        questionCount = count;
      }
    }
    
    // Skip if no questions found at all
    if (questionCount === 0) {
      return { created: false, skipped: false, updated: false, noNotebook: true, noQuestions: true };
    }

    // Check if already has an ACTIVE questions goal
    const { data: existingGoals } = await supabase
      .from('topic_goals')
      .select('id')
      .eq('topic_id', topic.id)
      .eq('goal_type', 'questions')
      .eq('is_active', true)
      .limit(1);

    // Calculate duration
    let calculatedDuration = Math.ceil((questionCount / questionsPerHour) * 60);
    // Arredondar para múltiplos de 30, mínimo 30min (sem cap máximo)
    calculatedDuration = Math.max(30, Math.ceil(calculatedDuration / 30) * 30);

    const noNotebook = validatedIds.length === 0;

    if (existingGoals && existingGoals.length > 0) {
      // If updateExisting is true, update the existing goal
      if (updateExisting) {
        const { error } = await supabase
          .from('topic_goals')
          .update({
            duration_minutes: calculatedDuration,
            description: `Resolver ${questionCount} questões`,
            question_notebook_ids: validatedIds, // ALWAYS save validated IDs only
          })
          .eq('id', existingGoals[0].id);
        
        return { created: false, skipped: false, updated: !error, noNotebook, noQuestions: false };
      }
      return { created: false, skipped: true, updated: false, noNotebook: false, noQuestions: false };
    }

    // INSERT: Always save validated IDs only (may be empty array)
    const { error } = await supabase
      .from('topic_goals')
      .insert({
        topic_id: topic.id,
        name: `Questões - ${topic.name.substring(0, 100)}`,
        description: `Resolver ${questionCount} questões`,
        goal_type: 'questions',
        duration_minutes: calculatedDuration,
        display_order: 0,
        question_notebook_ids: validatedIds, // NEVER save unvalidated IDs
        pdf_links: [],
        is_active: true
      });

    return { created: !error, skipped: false, updated: false, noNotebook, noQuestions: false };
  };

  // Auto-create question goals for all topics in selected discipline
  const autoCreateQuestionGoals = async (updateExisting: boolean = false) => {
    if (!selectedDiscipline) {
      toast({ title: 'Selecione uma disciplina primeiro', variant: 'destructive' });
      return;
    }

    // Flush any pending debounced metric save for the selected discipline
    if (metricTimers.current[selectedDiscipline]) {
      clearTimeout(metricTimers.current[selectedDiscipline]);
      delete metricTimers.current[selectedDiscipline];
      const pendingValue = localMetrics[selectedDiscipline];
      if (pendingValue) {
        const parsed = parseInt(pendingValue);
        if (parsed && parsed >= 1 && parsed <= 500) {
          await updateQuestionsPerHour(selectedDiscipline, parsed);
        }
      }
    }

    const discipline = disciplines.find(d => d.id === selectedDiscipline);
    // Use local override if available, otherwise use persisted value
    const localOverride = localMetrics[selectedDiscipline];
    const questionsPerHour = localOverride ? (parseInt(localOverride) || discipline?.questions_per_hour || 30) : (discipline?.questions_per_hour || 30);

    try {
      let created = 0;
      let skipped = 0;
      let updated = 0;
      let noNotebookCount = 0;
      
      for (const topic of topics) {
        const result = await createQuestionGoalForTopic(topic, questionsPerHour, notebooks, updateExisting);
        if (result.created) created++;
        if (result.skipped) skipped++;
        if (result.updated) updated++;
        if (result.noNotebook) noNotebookCount++;
      }

      const parts = [];
      if (created > 0) parts.push(`${created} criadas`);
      if (updated > 0) parts.push(`${updated} atualizadas`);
      if (skipped > 0) parts.push(`${skipped} sem alteração`);

      toast({ 
        title: 'Metas processadas!', 
        description: parts.join(', ') 
      });
      
      // Alert about topics without valid notebooks (for curation)
      if (noNotebookCount > 0) {
        toast({
          title: `⚠️ ${noNotebookCount} tópico(s) sem caderno válido`,
          description: 'Estes tópicos precisam de curadoria. O aluno usará o Banco de Questões como fallback.',
          variant: 'destructive',
        });
      }
      
      if (selectedTopic) {
        fetchGoals(selectedTopic);
      }
    } catch (error) {
      console.error('Error auto-creating goals:', error);
      toast({ title: 'Erro ao criar metas automaticamente', variant: 'destructive' });
    }
  };

  // Auto-create for entire discipline (all topics)
  const autoCreateForDiscipline = async (updateExisting: boolean = false) => {
    if (!selectedDiscipline) {
      toast({ title: 'Selecione uma disciplina primeiro', variant: 'destructive' });
      return;
    }

    setBulkCreating(true);
    
    // Refresh notebooks cache before bulk processing
    await fetchNotebooks();

    // Flush any pending debounced metric save for the selected discipline
    if (metricTimers.current[selectedDiscipline]) {
      clearTimeout(metricTimers.current[selectedDiscipline]);
      delete metricTimers.current[selectedDiscipline];
      const pendingValue = localMetrics[selectedDiscipline];
      if (pendingValue) {
        const parsed = parseInt(pendingValue);
        if (parsed && parsed >= 1 && parsed <= 500) {
          await updateQuestionsPerHour(selectedDiscipline, parsed);
        }
      }
    }
    
    const discipline = disciplines.find(d => d.id === selectedDiscipline);
    // Use local override if available, otherwise use persisted value
    const localOverride = localMetrics[selectedDiscipline];
    const questionsPerHour = localOverride ? (parseInt(localOverride) || discipline?.questions_per_hour || 30) : (discipline?.questions_per_hour || 30);

    try {
      // Fetch all topics for this discipline
      const { data: allTopics, error: topicsError } = await supabase
        .from('study_topics')
        .select('id, name, study_discipline_id, source_notebook_id')
        .eq('study_discipline_id', selectedDiscipline)
        .eq('is_active', true);

      if (topicsError) throw topicsError;

      let created = 0;
      let skipped = 0;
      let updated = 0;
      let noQuestions = 0;
      const total = allTopics?.length || 0;
      
      setBulkProgress({ current: 0, total, label: discipline?.name || '' });

      for (let i = 0; i < (allTopics || []).length; i++) {
        const topic = allTopics![i];
        setBulkProgress({ current: i + 1, total, label: topic.name });
        
        const result = await createQuestionGoalForTopic(topic, questionsPerHour, notebooks, updateExisting);
        if (result.created) created++;
        if (result.skipped) skipped++;
        if (result.updated) updated++;
        if (result.noQuestions) noQuestions++;
      }

      const parts = [];
      if (created > 0) parts.push(`${created} criadas`);
      if (updated > 0) parts.push(`${updated} atualizadas`);
      if (skipped > 0) parts.push(`${skipped} sem alteração`);
      if (noQuestions > 0) parts.push(`${noQuestions} sem questões/caderno`);

      toast({ 
        title: `Disciplina "${discipline?.name}" processada!`,
        description: parts.join(', ')
      });
      
      // Refresh missing goals alert
      await checkMissingGoalsForDisciplines(
        discipline ? [{ id: discipline.id, name: discipline.name, questions_per_hour: discipline.questions_per_hour }] : disciplines
      );
      
      if (selectedTopic) {
        fetchGoals(selectedTopic);
      }
      if (selectedDiscipline) {
        fetchTopics(selectedDiscipline);
      }
    } catch (error) {
      console.error('Error auto-creating goals for discipline:', error);
      toast({ title: 'Erro ao criar metas para disciplina', variant: 'destructive' });
    } finally {
      setBulkCreating(false);
      setBulkProgress({ current: 0, total: 0, label: '' });
    }
  };

  // Auto-create for all disciplines in selected school or edital
  const autoCreateForAllDisciplines = async (updateExisting: boolean = false) => {
    const isSpecificSchoolSelected = Boolean(selectedSchool && selectedSchool !== 'all');

    if (!selectedEdital && !isSpecificSchoolSelected) {
      toast({ title: 'Selecione um edital ou escola primeiro', variant: 'destructive' });
      return;
    }

    const action = updateExisting ? 'criará/atualizará' : 'criará';
    const targetLabel = isSpecificSchoolSelected
      ? 'disciplinas desta escola'
      : 'disciplinas deste edital';

    if (!confirm(`Isso ${action} metas de questões para TODAS as ${targetLabel}. Continuar?`)) {
      return;
    }

    setBulkCreating(true);

    try {
      // Refresh notebooks cache before bulk processing to avoid stale data
      await fetchNotebooks();
      for (const [discId, timer] of Object.entries(metricTimers.current)) {
        clearTimeout(timer);
        delete metricTimers.current[discId];
        const pendingValue = localMetrics[discId];
        if (pendingValue) {
          const parsed = parseInt(pendingValue);
          if (parsed && parsed >= 1 && parsed <= 500) {
            await updateQuestionsPerHour(discId, parsed);
          }
        }
      }

      let disciplinesData: { id: string; name: string; questions_per_hour: number | null }[] = [];
      let targetName = '';
      let schoolIdsAffected: string[] = [];
      
      if (isSpecificSchoolSelected) {
        // Get disciplines from school
        const school = schools.find(s => s.id === selectedSchool);
        targetName = school?.name || 'Escola';
        schoolIdsAffected = [selectedSchool];
        
        const { data: schoolDisciplines, error: discError } = await supabase
          .from('school_disciplines')
          .select('discipline:study_disciplines(id, name, questions_per_hour)')
          .eq('school_id', selectedSchool)
          .eq('is_active', true);

        if (discError) throw discError;

        disciplinesData = (schoolDisciplines || [])
          .map(item => item.discipline as unknown as { id: string; name: string; questions_per_hour: number | null })
          .filter(Boolean);
      } else {
        // Get disciplines directly from edital
        const edital = editais.find(e => e.id === selectedEdital);
        targetName = edital?.name || 'Edital';
        
        // Collect all school IDs for this edital for needs_recalc
        const { data: editalSchoolsForRecalc } = await supabase
          .from('schools')
          .select('id')
          .eq('edital_id', selectedEdital)
          .eq('is_active', true);
        schoolIdsAffected = (editalSchoolsForRecalc || []).map(s => s.id);
        
        const { data: editalDisciplines, error: discError } = await supabase
          .from('edital_disciplines')
          .select('discipline:study_disciplines(id, name, questions_per_hour)')
          .eq('edital_id', selectedEdital)
          .eq('is_active', true);

        if (discError) throw discError;

        disciplinesData = (editalDisciplines || [])
          .map(item => item.discipline as unknown as { id: string; name: string; questions_per_hour: number | null })
          .filter(Boolean);
      }

      if (disciplinesData.length === 0) {
        toast({ title: 'Nenhuma disciplina encontrada para processar', variant: 'destructive' });
        return;
      }

      let totalCreated = 0;
      let totalSkipped = 0;
      let totalUpdated = 0;
      let totalNoQuestions = 0;

      for (const disc of disciplinesData) {
        const localOverride = localMetrics[disc.id];
        const questionsPerHour = localOverride 
          ? (parseInt(localOverride) || disc.questions_per_hour || 30) 
          : (disc.questions_per_hour || 30);

        // Get all topics for this discipline
        const { data: discTopics } = await supabase
          .from('study_topics')
          .select('id, name, study_discipline_id, source_notebook_id')
          .eq('study_discipline_id', disc.id)
          .eq('is_active', true);

        setBulkProgress({ 
          current: totalCreated + totalSkipped + totalUpdated, 
          total: 0, 
          label: `${disc.name}` 
        });

        for (const topic of (discTopics || [])) {
          const result = await createQuestionGoalForTopic(topic, questionsPerHour, notebooks, updateExisting);
          if (result.created) totalCreated++;
          if (result.skipped) totalSkipped++;
          if (result.updated) totalUpdated++;
          if (result.noQuestions) totalNoQuestions++;
        }
      }

      // Flag affected student cronogramas for recalculation
      if (schoolIdsAffected.length > 0 && (totalCreated > 0 || totalUpdated > 0)) {
        const { error: recalcError } = await supabase
          .from('user_cronogramas')
          .update({ 
            needs_recalc: true, 
            recalc_reason: 'Metas de questões atualizadas em massa pelo admin',
            recalc_pending_since: new Date().toISOString()
          })
          .in('school_id', schoolIdsAffected)
          .eq('is_active', true);
        
        if (recalcError) console.warn('Erro ao marcar recálculo:', recalcError);
      }

      const parts = [];
      if (totalCreated > 0) parts.push(`${totalCreated} criadas`);
      if (totalUpdated > 0) parts.push(`${totalUpdated} atualizadas`);
      if (totalSkipped > 0) parts.push(`${totalSkipped} sem alteração`);
      if (totalNoQuestions > 0) parts.push(`${totalNoQuestions} sem questões/caderno`);

      toast({ 
        title: `"${targetName}" processado!`,
        description: `${parts.join(', ')} em ${disciplinesData.length} disciplina(s)`
      });
      
      // Refresh missing goals alert with the exact processed scope
      const missingAfterRun = await checkMissingGoalsForDisciplines(disciplinesData);

      if (missingAfterRun.length > 0) {
        const remainingTopics = missingAfterRun.reduce((acc, disc) => acc + disc.missing, 0);
        toast({
          title: 'Ainda restam tópicos sem metas',
          description: `${remainingTopics} tópico(s) pendente(s). Geralmente isso ocorre quando o tópico não possui questões vinculadas.`,
          variant: 'destructive',
        });
      }
      
      if (selectedTopic) {
        fetchGoals(selectedTopic);
      }
      if (selectedDiscipline) {
        fetchTopics(selectedDiscipline);
      }
    } catch (error) {
      console.error('Error auto-creating goals for all disciplines:', error);
      toast({ title: 'Erro ao criar metas para todas disciplinas', variant: 'destructive' });
    } finally {
      setBulkCreating(false);
      setBulkProgress({ current: 0, total: 0, label: '' });
    }
  };

  // Auto-create for all schools in edital
  const autoCreateForAllSchools = async (updateExisting: boolean = false) => {
    if (!selectedEdital) {
      toast({ title: 'Selecione um edital primeiro', variant: 'destructive' });
      return;
    }

    const action = updateExisting ? 'criará/atualizará' : 'criará';
    if (!confirm(`Isso ${action} metas de questões para TODAS as disciplinas e tópicos de TODAS as escolas deste edital. Continuar?`)) {
      return;
    }

    setBulkCreating(true);

    try {
      // Refresh notebooks cache before bulk processing
      await fetchNotebooks();

      // Flush ALL pending debounces before bulk processing
      for (const [discId, timer] of Object.entries(metricTimers.current)) {
        clearTimeout(timer);
        delete metricTimers.current[discId];
        const pendingValue = localMetrics[discId];
        if (pendingValue) {
          const parsed = parseInt(pendingValue);
          if (parsed && parsed >= 1 && parsed <= 500) {
            await updateQuestionsPerHour(discId, parsed);
          }
        }
      }

      // Get all schools for this edital
      const { data: editalSchools, error: schoolsError } = await supabase
        .from('schools')
        .select('id, name')
        .eq('edital_id', selectedEdital)
        .eq('is_active', true);

      if (schoolsError) throw schoolsError;

      // If no schools, get disciplines directly from edital
      const schoolsToProcess = editalSchools && editalSchools.length > 0 
        ? editalSchools 
        : [{ id: 'edital-direct', name: 'Edital Direto' }];

      const schoolIdsAffected = (editalSchools || []).map(s => s.id);

      let totalCreated = 0;
      let totalSkipped = 0;
      let totalUpdated = 0;
      let totalNoQuestions = 0;
      const processedDisciplines = new Map<string, { id: string; name: string; questions_per_hour: number | null }>();

      for (const school of schoolsToProcess) {
        // Get disciplines for this school or edital
        let disciplinesData: { id: string; name: string; questions_per_hour: number | null }[] = [];
        
        if (school.id === 'edital-direct') {
          const { data } = await supabase
            .from('edital_disciplines')
            .select('discipline:study_disciplines(id, name, questions_per_hour)')
            .eq('edital_id', selectedEdital)
            .eq('is_active', true);
          
          disciplinesData = (data || [])
            .map(item => item.discipline as unknown as { id: string; name: string; questions_per_hour: number | null })
            .filter(Boolean);
        } else {
          const { data } = await supabase
            .from('school_disciplines')
            .select('discipline:study_disciplines(id, name, questions_per_hour)')
            .eq('school_id', school.id)
            .eq('is_active', true);
          
          disciplinesData = (data || [])
            .map(item => item.discipline as unknown as { id: string; name: string; questions_per_hour: number | null })
            .filter(Boolean);
        }

        for (const disc of disciplinesData) {
          processedDisciplines.set(disc.id, disc);

          const localOverride = localMetrics[disc.id];
          const questionsPerHour = localOverride 
            ? (parseInt(localOverride) || disc.questions_per_hour || 30) 
            : (disc.questions_per_hour || 30);

          // Get all topics for this discipline
          const { data: discTopics } = await supabase
            .from('study_topics')
            .select('id, name, study_discipline_id, source_notebook_id')
            .eq('study_discipline_id', disc.id)
            .eq('is_active', true);

          setBulkProgress({ 
            current: totalCreated + totalSkipped + totalUpdated, 
            total: 0, 
            label: `${school.name} → ${disc.name}` 
          });

          for (const topic of (discTopics || [])) {
            const result = await createQuestionGoalForTopic(topic, questionsPerHour, notebooks, updateExisting);
            if (result.created) totalCreated++;
            if (result.skipped) totalSkipped++;
            if (result.updated) totalUpdated++;
            if (result.noQuestions) totalNoQuestions++;
          }
        }
      }

      // Flag affected student cronogramas for recalculation
      if (schoolIdsAffected.length > 0 && (totalCreated > 0 || totalUpdated > 0)) {
        const { error: recalcError } = await supabase
          .from('user_cronogramas')
          .update({ 
            needs_recalc: true, 
            recalc_reason: 'Metas de questões atualizadas em massa pelo admin',
            recalc_pending_since: new Date().toISOString()
          })
          .in('school_id', schoolIdsAffected)
          .eq('is_active', true);
        
        if (recalcError) console.warn('Erro ao marcar recálculo:', recalcError);
      }

      const parts = [];
      if (totalCreated > 0) parts.push(`${totalCreated} criadas`);
      if (totalUpdated > 0) parts.push(`${totalUpdated} atualizadas`);
      if (totalSkipped > 0) parts.push(`${totalSkipped} sem alteração`);
      if (totalNoQuestions > 0) parts.push(`${totalNoQuestions} sem questões/caderno`);

      toast({ 
        title: `Processamento completo!`,
        description: `${parts.join(', ')} em ${schoolsToProcess.length} escola(s)`
      });
      
      // Refresh missing goals alert
      const missingAfterRun = await checkMissingGoalsForDisciplines(Array.from(processedDisciplines.values()));

      if (missingAfterRun.length > 0) {
        const remainingTopics = missingAfterRun.reduce((acc, disc) => acc + disc.missing, 0);
        toast({
          title: 'Ainda restam tópicos sem metas',
          description: `${remainingTopics} tópico(s) pendente(s). Geralmente isso ocorre quando o tópico não possui questões vinculadas.`,
          variant: 'destructive',
        });
      }
      
      if (selectedTopic) {
        fetchGoals(selectedTopic);
      }
    } catch (error) {
      console.error('Error auto-creating goals for all schools:', error);
      toast({ title: 'Erro ao criar metas para todas escolas', variant: 'destructive' });
    } finally {
      setBulkCreating(false);
      setBulkProgress({ current: 0, total: 0, label: '' });
    }
  };

  const getGoalTypeIcon = (type: string) => {
    switch (type) {
      case 'study': return <BookOpen className="w-4 h-4" />;
      case 'questions': return <HelpCircle className="w-4 h-4" />;
      case 'review': return <Target className="w-4 h-4" />;
      default: return <Target className="w-4 h-4" />;
    }
  };

  const getGoalTypeLabel = (type: string) => {
    switch (type) {
      case 'study': return 'Estudo';
      case 'questions': return 'Questões';
      case 'review': return 'Revisão';
      default: return type;
    }
  };

  const getNotebookName = (id: string) => {
    return notebooks.find(n => n.id === id)?.name || 'Caderno removido';
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
            Metas por Tópico
          </CardTitle>
          <CardDescription>
            Configure as metas de estudo para cada tópico. Selecione o edital, escola, disciplina e tópico.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Edital</Label>
              <Select value={selectedEdital} onValueChange={setSelectedEdital}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um edital" />
                </SelectTrigger>
                <SelectContent>
                  {editais.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Escola (opcional)</Label>
              <Select 
                value={selectedSchool} 
                onValueChange={setSelectedSchool}
                disabled={!selectedEdital || schools.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={schools.length === 0 ? "Nenhuma escola" : "Todas as disciplinas"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as disciplinas do edital</SelectItem>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedEdital && schools.length === 0 && (
                <p className="text-xs text-muted-foreground">Este edital não possui escolas. Disciplinas carregadas diretamente do edital.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Disciplina</Label>
              <Select 
                value={selectedDiscipline} 
                onValueChange={setSelectedDiscipline}
                disabled={!selectedEdital || (schools.length > 0 && !selectedSchool)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma disciplina" />
                </SelectTrigger>
                <SelectContent>
                  {disciplines.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tópico</Label>
              <Select 
                value={selectedTopic} 
                onValueChange={setSelectedTopic}
                disabled={!selectedDiscipline}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um tópico" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Global Alert: Disciplines with missing goals */}
          {!selectedDiscipline && missingGoalsDisciplines.length > 0 && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-destructive text-sm">
                    {missingGoalsDisciplines.length} disciplina(s) com tópicos sem metas de questões
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use "Metas para Todas Disciplinas" para criar as metas faltantes automaticamente.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {missingGoalsDisciplines.map(d => (
                      <Badge 
                        key={d.id} 
                        variant="outline" 
                        className="text-xs bg-destructive/10 cursor-pointer hover:bg-destructive/20"
                        onClick={() => setSelectedDiscipline(d.id)}
                      >
                        {d.name} ({d.missing}/{d.total})
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Alert: Topics without goals */}
          {selectedDiscipline && topicsWithoutGoals.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-amber-700 text-sm">
                    ⚠️ {topicsWithoutGoals.length} tópico(s) neste edital/escola sem metas configuradas
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Esses tópicos existem na disciplina mas ainda não possuem metas de estudo definidas.
                    Use "Metas para Disciplina" ou "Metas para Tópicos Exibidos" para criar automaticamente, 
                    ou selecione cada tópico individualmente para configuração manual.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {topicsWithoutGoals.slice(0, 5).map(topicId => {
                      const topic = topics.find(t => t.id === topicId);
                      return topic ? (
                        <Badge 
                          key={topicId} 
                          variant="outline" 
                          className="text-xs bg-amber-500/10 cursor-pointer hover:bg-amber-500/20"
                          onClick={() => setSelectedTopic(topicId)}
                        >
                          {topic.name}
                        </Badge>
                      ) : null;
                    })}
                    {topicsWithoutGoals.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{topicsWithoutGoals.length - 5} mais
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Bulk creation progress */}
          {bulkCreating && (
            <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">Criando metas automaticamente...</span>
              </div>
              {bulkProgress.label && (
                <p className="text-sm text-muted-foreground truncate">{bulkProgress.label}</p>
              )}
              {bulkProgress.total > 0 && (
                <Progress value={(bulkProgress.current / bulkProgress.total) * 100} className="h-2" />
              )}
            </div>
          )}

          {/* Bulk action buttons */}
          <div className="flex flex-wrap gap-2 justify-end">
            {selectedEdital && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={bulkCreating}>
                    <School className="w-4 h-4 mr-2" />
                    Metas para Todas Escolas
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => autoCreateForAllSchools(false)}>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Criar novas metas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => autoCreateForAllSchools(true)}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Criar e atualizar existentes
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {(selectedSchool || selectedEdital) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={bulkCreating}>
                    <BookOpen className="w-4 h-4 mr-2" />
                    Metas para Todas Disciplinas
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => autoCreateForAllDisciplines(false)}>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Criar novas metas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => autoCreateForAllDisciplines(true)}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Criar e atualizar existentes
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {selectedDiscipline && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={bulkCreating}>
                    <GraduationCap className="w-4 h-4 mr-2" />
                    Metas para Disciplina
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => autoCreateForDiscipline(false)}>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Criar novas metas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => autoCreateForDiscipline(true)}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Criar e atualizar existentes
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {selectedDiscipline && topics.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" disabled={bulkCreating}>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Metas para Tópicos Exibidos
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => autoCreateQuestionGoals(false)}>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Criar novas metas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => autoCreateQuestionGoals(true)}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Criar e atualizar existentes
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Discipline Metrics Card */}
      {selectedEdital && disciplines.length > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-5 h-5" />
              Métrica de Questões por Disciplina
            </CardTitle>
            <CardDescription>
              Defina quantas questões podem ser resolvidas por hora em cada disciplina. O cronograma usará essa referência para calcular o tempo das metas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {disciplines.map((discipline) => {
                const qPerHour = Number(localMetrics[discipline.id] ?? (discipline.questions_per_hour || 20));
                const totalQuestions = disciplineQuestionCounts[discipline.id] || 0;
                const estimatedHours = qPerHour > 0 ? totalQuestions / qPerHour : 0;
                const displayHours = estimatedHours >= 1 
                  ? `${Math.floor(estimatedHours)}h${Math.round((estimatedHours % 1) * 60) > 0 ? Math.round((estimatedHours % 1) * 60) + 'min' : ''}`
                  : estimatedHours > 0 ? `${Math.round(estimatedHours * 60)}min` : '0h';

                return (
                  <div key={discipline.id} className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{discipline.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {totalQuestions} questões · <span className="font-semibold text-primary">{displayHours}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={500}
                        className="w-20 text-center"
                        value={qPerHour}
                        onChange={(e) => handleMetricChange(discipline.id, e.target.value)}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">q/hora</span>
                      {savingMetric === discipline.id && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedTopic && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChevronRight className="w-5 h-5" />
                <span className="font-medium">
                  Metas do tópico: {topics.find(t => t.id === selectedTopic)?.name}
                </span>
              </div>
              <Button onClick={openNewDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Meta
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>PDFs</TableHead>
                  <TableHead>Vídeos</TableHead>
                  <TableHead>Flashcards</TableHead>
                  <TableHead>Cadernos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.map((goal) => (
                  <TableRow key={goal.id}>
                    <TableCell className="font-medium">{goal.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        {getGoalTypeIcon(goal.goal_type)}
                        {getGoalTypeLabel(goal.goal_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        {goal.duration_minutes} min
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        {goal.pdf_links.length}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Video className="w-4 h-4 text-muted-foreground" />
                        {goal.video_links.length}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Layers className="w-4 h-4 text-muted-foreground" />
                        {goal.flashcard_links.length}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <HelpCircle className="w-4 h-4 text-muted-foreground" />
                        {goal.question_notebook_ids.length}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={goal.is_active ? 'default' : 'secondary'}>
                        {goal.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(goal)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(goal.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {goals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Nenhuma meta cadastrada para este tópico
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingGoal ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Meta</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Estudar teoria de ácidos e bases"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Meta</Label>
                  <Select 
                    value={formData.goal_type} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, goal_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="study">Estudo</SelectItem>
                      <SelectItem value="questions">Questões</SelectItem>
                      <SelectItem value="review">Revisão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição opcional da meta"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">Duração (minutos)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={30}
                    step={30}
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 60 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order">Ordem de exibição</Label>
                  <Input
                    id="order"
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {/* PDFs Section */}
              <div className="space-y-3">
                <Label>Links de PDF</Label>
                <div className="grid grid-cols-5 gap-2">
                  <Input
                    className="col-span-2"
                    placeholder="Nome do PDF"
                    value={newPdfName}
                    onChange={(e) => setNewPdfName(e.target.value)}
                  />
                  <Input
                    className="col-span-2"
                    placeholder="URL do PDF"
                    value={newPdfUrl}
                    onChange={(e) => setNewPdfUrl(e.target.value)}
                  />
                  <Button type="button" variant="outline" onClick={addPdfLink}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {formData.pdf_links.length > 0 && (
                  <div className="space-y-2">
                    {formData.pdf_links.map((pdf, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <FileText className="w-4 h-4" />
                        <span className="flex-1 text-sm truncate">{pdf.name}</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removePdfLink(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Videos Section */}
              <div className="space-y-3">
                <Label>Links de Vídeo</Label>
                <div className="grid grid-cols-5 gap-2">
                  <Input
                    className="col-span-2"
                    placeholder="Nome do vídeo"
                    value={newVideoName}
                    onChange={(e) => setNewVideoName(e.target.value)}
                  />
                  <Input
                    className="col-span-2"
                    placeholder="URL do vídeo"
                    value={newVideoUrl}
                    onChange={(e) => setNewVideoUrl(e.target.value)}
                  />
                  <Button type="button" variant="outline" onClick={addVideoLink}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {formData.video_links.length > 0 && (
                  <div className="space-y-2">
                    {formData.video_links.map((video, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <Video className="w-4 h-4" />
                        <span className="flex-1 text-sm truncate">{video.name}</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removeVideoLink(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Flashcards Section */}
              <div className="space-y-3">
                <Label>IDs de Baralhos de Flashcards</Label>
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Cole o ID do baralho de flashcards"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.target as HTMLInputElement;
                        const value = input.value.trim();
                        if (value && !formData.flashcard_links.includes(value)) {
                          setFormData(prev => ({
                            ...prev,
                            flashcard_links: [...prev.flashcard_links, value]
                          }));
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={(e) => {
                      const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                      const value = input?.value?.trim();
                      if (value && !formData.flashcard_links.includes(value)) {
                        setFormData(prev => ({
                          ...prev,
                          flashcard_links: [...prev.flashcard_links, value]
                        }));
                        input.value = '';
                      }
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {formData.flashcard_links.length > 0 && (
                  <div className="space-y-2">
                    {formData.flashcard_links.map((id, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <Layers className="w-4 h-4" />
                        <span className="flex-1 text-sm font-mono truncate">{id}</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            flashcard_links: prev.flashcard_links.filter((_, i) => i !== index)
                          }))}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Question Notebooks Section */}
              <div className="space-y-3">
                <Label>Cadernos de Questões</Label>
                <Select 
                  value="" 
                  onValueChange={(v) => {
                    if (!formData.question_notebook_ids.includes(v)) {
                      setFormData(prev => ({
                        ...prev,
                        question_notebook_ids: [...prev.question_notebook_ids, v]
                      }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Adicionar caderno de questões" />
                  </SelectTrigger>
                  <SelectContent>
                    {notebooks
                      .filter(n => !formData.question_notebook_ids.includes(n.id))
                      .map((n) => (
                        <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {formData.question_notebook_ids.length > 0 && (
                  <div className="space-y-2">
                    {formData.question_notebook_ids.map((id) => (
                      <div key={id} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <HelpCircle className="w-4 h-4" />
                        <span className="flex-1 text-sm">{getNotebookName(id)}</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            question_notebook_ids: prev.question_notebook_ids.filter(nid => nid !== id)
                          }))}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">Meta ativa</Label>
              </div>

              <Button onClick={handleSubmit} className="w-full">
                {editingGoal ? 'Salvar Alterações' : 'Criar Meta'}
              </Button>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
