import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, Check, ChevronRight, ChevronDown, FolderPlus, Trash2, Edit2, ArrowRight, ArrowLeft, Wand2, Settings2, Brain, Info, Plus, MoveHorizontal, X, Save, AlertTriangle, Merge, GripVertical, MapPin, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Available AI models
const AVAILABLE_MODELS = [
  { id: 'google/gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite (econômico)' },
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash (rápido)' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (balanceado)' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro (preciso)' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini (balanceado)' },
  { id: 'openai/gpt-5', name: 'GPT-5 (premium)' },
];

interface AIConfigData {
  id: string;
  config_type: string;
  model: string;
  system_prompt: string;
  description: string | null;
}

interface School {
  id: string;
  name: string;
  is_default: boolean;
  edital_id: string | null;
}

interface Edital {
  id: string;
  name: string;
}

interface Discipline {
  id: string;
  name: string;
}

interface Topic {
  id: string;
  name: string;
  discipline_id: string;
  discipline_name: string;
  question_count: number;
}

interface VerticalizedTopic {
  name: string;
  original_text?: string;
  suggestion_reason?: string;
  order_index?: number;
  isEditing?: boolean;
}

interface ClusterSuggestion {
  cluster_name: string;
  bank_topic_ids: string[];
  edital_items: string[];
  confidence: number;
  reasoning: string;
  total_questoes?: number;
}

interface ConfirmedCluster {
  cluster_name: string;
  bank_topic_ids: string[];
  edital_items: string[];
  edital_item_orders: number[]; // Track order_index for each edital item
  confidence: number;
  reasoning: string;
  total_questoes: number;
}

interface UncoveredCluster {
  cluster_name: string;
  edital_items: string[];
  edital_item_orders: number[];
  reasoning: string;
  suggested_disciplines?: string[];
}

type Step = 'input' | 'verticalize' | 'review' | 'complete';
type ViewMode = 'new' | 'manage';

interface ExistingEditalTopic {
  id: string;
  school_id: string | null;
  school_name: string;
  edital_id: string | null;
  edital_name: string;
  edital_topic_name: string;
  study_topic_id: string | null;
  study_topic_name: string | null;
  discipline_id: string | null;
  discipline_name: string | null;
  question_count: number;
  created_at: string;
}

interface ExistingCluster {
  study_topic_id: string;
  study_topic_name: string;
  discipline_id: string;
  discipline_name: string;
  school_id: string | null;
  school_name: string;
  edital_id: string | null;
  edital_name: string;
  question_count: number;
  edital_items: string[];
  is_uncovered: boolean; // Has ⚠️ prefix
  created_at: string;
  isCreatedViaMapping?: boolean; // Discipline was created via cluster mapping
}

export function AdminEditalMapping() {
  const { toast } = useToast();
  const [editals, setEditals] = useState<Edital[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [bankTopics, setBankTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('new');
  
  // Manage mode state
  const [existingTopics, setExistingTopics] = useState<ExistingEditalTopic[]>([]);
  const [existingClusters, setExistingClusters] = useState<ExistingCluster[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [filterSchoolId, setFilterSchoolId] = useState<string>('all');
  const [filterDisciplineId, setFilterDisciplineId] = useState<string>('all');
  const [filterEmptyOnly, setFilterEmptyOnly] = useState(false);
  const [clusterSearchText, setClusterSearchText] = useState<string>('');
  const [editingExistingTopic, setEditingExistingTopic] = useState<ExistingEditalTopic | null>(null);
  const [mappingExistingTopic, setMappingExistingTopic] = useState<ExistingEditalTopic | null>(null);
  const [mappingExistingCluster, setMappingExistingCluster] = useState<ExistingCluster | null>(null);
  const [existingMappingDisciplines, setExistingMappingDisciplines] = useState<string[]>([]);
  const [existingMappingTopics, setExistingMappingTopics] = useState<Topic[]>([]);
  const [processingExistingMapping, setProcessingExistingMapping] = useState(false);
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  
  // Form state
  const [selectedEditalId, setSelectedEditalId] = useState<string>('');
  const [newDisciplineName, setNewDisciplineName] = useState('');
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [editalText, setEditalText] = useState('');
  
  // Verticalization state
  const [verticalizedTopics, setVerticalizedTopics] = useState<VerticalizedTopic[]>([]);
  const [verticalizationSummary, setVerticalizationSummary] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  
  // Cluster-based mapping state
  const [confirmedClusters, setConfirmedClusters] = useState<ConfirmedCluster[]>([]);
  const [uncoveredClusters, setUncoveredClusters] = useState<UncoveredCluster[]>([]);
  const [uncoveredTopics, setUncoveredTopics] = useState<string[]>([]);
  const [clusterSummary, setClusterSummary] = useState('');
  const [step, setStep] = useState<Step>('input');
  
  // Uncovered cluster mapping state
  const [mappingUncoveredCluster, setMappingUncoveredCluster] = useState<number | null>(null);
  const [uncoveredClusterDisciplines, setUncoveredClusterDisciplines] = useState<string[]>([]);
  const [uncoveredClusterTopics, setUncoveredClusterTopics] = useState<Topic[]>([]);
  const [processingUncovered, setProcessingUncovered] = useState(false);
  
  // AI Config state - editable from DB
  const [showAIConfig, setShowAIConfig] = useState(false);
  const [aiConfigs, setAiConfigs] = useState<AIConfigData[]>([]);
  const [editingConfig, setEditingConfig] = useState<AIConfigData | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Move/merge state
  const [selectedItemForMove, setSelectedItemForMove] = useState<{ item: string; fromClusterIdx: number } | null>(null);
  const [selectedUncoveredItem, setSelectedUncoveredItem] = useState<string | null>(null);
  const [selectedClustersForMerge, setSelectedClustersForMerge] = useState<number[]>([]);
  const [mergeMode, setMergeMode] = useState(false);

  // Drag state
  const [draggedItem, setDraggedItem] = useState<{ item: string; fromClusterIdx: number; fromUncovered: boolean } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch editals including is_default field
      const { data: editalsData } = await supabase
        .from('editals')
        .select('id, name, is_default')
        .eq('is_active', true)
        .order('name');
      
      setEditals(editalsData || []);

      // Fetch schools with edital_id
      const { data: schoolsData } = await supabase
        .from('schools')
        .select('id, name, is_default, edital_id')
        .eq('is_active', true)
        .order('name');

      setSchools(schoolsData || []);

      // Load only disciplines from Pré-Edital (is_default edital) for mapping
      // These are the source disciplines imported via .zip
      const preEdital = (editalsData || []).find((e: any) => e.is_default === true);
      
      if (preEdital) {
        // Fetch disciplines linked to the pre-edital via edital_disciplines
        const { data: preEditalDisciplines } = await supabase
          .from('edital_disciplines')
          .select('discipline_id, study_disciplines(id, name)')
          .eq('edital_id', preEdital.id)
          .eq('is_active', true);
        
        const disciplinesFromPreEdital = (preEditalDisciplines || [])
          .map((ed: any) => ed.study_disciplines)
          .filter((d: any) => d && d.id && d.name)
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        
        setDisciplines(disciplinesFromPreEdital);
      } else {
        // Fallback: load all if no pre-edital found
        const { data: allDisciplines } = await supabase
          .from('study_disciplines')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        
        setDisciplines((allDisciplines || []).filter((d: any) => d && d.id && d.name));
      }

      // Fetch AI configs from database
      const { data: configsData, error: configError } = await supabase
        .from('ai_config')
        .select('*');

      if (!configError && configsData) {
        setAiConfigs(configsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load topics when disciplines change - WITH QUESTION COUNTS using DB function
  useEffect(() => {
    const loadTopics = async () => {
      if (selectedDisciplines.length === 0) {
        setBankTopics([]);
        return;
      }

      // First, get topics
      const { data: topicsData } = await supabase
        .from('study_topics')
        .select('id, name, study_discipline_id, display_order, study_disciplines(name)')
        .in('study_discipline_id', selectedDisciplines)
        .eq('is_active', true)
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('name');

      if (!topicsData || topicsData.length === 0) {
        setBankTopics([]);
        return;
      }

      // Get topic IDs for counting
      const topicIds = topicsData.map((t: any) => t.id);

      // Use the database function to get accurate question counts
      // This function counts from: questions.study_topic_id + question_topics + admin_notebook_questions
      const { data: countData, error: countError } = await supabase.rpc(
        'get_topic_question_counts',
        { topic_ids: topicIds }
      );

      if (countError) {
        console.error('Error fetching topic question counts:', countError);
      }

      // Build count map from RPC result
      const countMap = new Map<string, number>();
      if (countData) {
        countData.forEach((row: { topic_id: string; question_count: number }) => {
          countMap.set(row.topic_id, row.question_count || 0);
        });
      }

      // Log for debugging
      const totalQuestions = Array.from(countMap.values()).reduce((sum, count) => sum + count, 0);
      console.log(`[AdminEditalMapping] Loaded ${topicsData.length} topics with ${totalQuestions} total questions from selected disciplines`);

      setBankTopics(topicsData.map((t: any) => ({
        id: t.id,
        name: t.name,
        discipline_id: t.study_discipline_id,
        discipline_name: t.study_disciplines?.name || '',
        question_count: countMap.get(t.id) || 0
      })));
    };

    loadTopics();
  }, [selectedDisciplines]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setEditalText(text);
    };
    reader.readAsText(file);
  };

  // Get AI config by type
  const getAIConfig = (type: 'verticalization' | 'mapping'): AIConfigData | undefined => {
    return aiConfigs.find(c => c.id === type);
  };

  // Save AI config to database
  const saveAIConfig = async (config: AIConfigData) => {
    setSavingConfig(true);
    try {
      const { error } = await supabase
        .from('ai_config')
        .update({
          model: config.model,
          system_prompt: config.system_prompt,
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id);

      if (error) throw error;

      setAiConfigs(prev => prev.map(c => c.id === config.id ? config : c));
      setEditingConfig(null);
      toast({ title: 'Configuração de IA salva com sucesso!' });
    } catch (error) {
      console.error('Error saving AI config:', error);
      toast({ title: 'Erro ao salvar configuração', variant: 'destructive' });
    } finally {
      setSavingConfig(false);
    }
  };

  // Step 1: Verticalize topics with AI
  const verticalizeTopics = async () => {
    if (!newDisciplineName.trim()) {
      toast({ title: 'Informe o nome da nova disciplina (caderno)', variant: 'destructive' });
      return;
    }
    if (!editalText.trim()) {
      toast({ title: 'Informe os tópicos do edital', variant: 'destructive' });
      return;
    }

    setProcessing(true);

    try {
      const config = getAIConfig('verticalization');
      const { data, error } = await supabase.functions.invoke('verticalize-edital-topics', {
        body: {
          editalText,
          disciplineName: newDisciplineName,
          model: config?.model,
          systemPrompt: config?.system_prompt
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setVerticalizedTopics(data.topics || []);
      setVerticalizationSummary(data.summary || '');
      setStep('verticalize');

      toast({ title: `${data.topics?.length || 0} tópicos verticalizados pela IA` });
    } catch (error) {
      console.error('Error verticalizing topics:', error);
      toast({ 
        title: 'Erro ao verticalizar tópicos', 
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive' 
      });
    } finally {
      setProcessing(false);
    }
  };

  // Remove a verticalized topic
  const removeTopic = (index: number) => {
    setVerticalizedTopics(prev => prev.filter((_, i) => i !== index));
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditingValue(verticalizedTopics[index].name);
  };

  const saveEditing = () => {
    if (editingIndex === null) return;
    
    setVerticalizedTopics(prev => prev.map((topic, i) => 
      i === editingIndex ? { ...topic, name: editingValue } : topic
    ));
    setEditingIndex(null);
    setEditingValue('');
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  const addNewTopic = () => {
    setVerticalizedTopics(prev => [...prev, { name: 'Novo tópico', isEditing: true }]);
    setEditingIndex(verticalizedTopics.length);
    setEditingValue('Novo tópico');
  };

  // Step 2: Process mapping with confirmed topics
  const processMapping = async () => {
    if (!selectedEditalId) {
      toast({ title: 'Selecione o edital de destino', variant: 'destructive' });
      return;
    }
    if (selectedDisciplines.length === 0) {
      toast({ title: 'Selecione pelo menos uma disciplina fonte', variant: 'destructive' });
      return;
    }
    if (verticalizedTopics.length === 0) {
      toast({ title: 'Nenhum tópico para mapear', variant: 'destructive' });
      return;
    }

    setProcessing(true);

    try {
      const editalTopics = verticalizedTopics.map(t => t.name);
      const config = getAIConfig('mapping');

      // Build payload with question counts
      const mappingPayload = bankTopics.map(t => ({
        id: t.id,
        name: t.name,
        discipline_name: t.discipline_name,
        question_count: t.question_count
      }));

      // AUDIT LOG: Detailed payload statistics for debugging
      const questionCounts = mappingPayload.map(t => t.question_count || 0);
      const topicsTotal = mappingPayload.length;
      const questionsTotal = questionCounts.reduce((sum, c) => sum + c, 0);
      const minQuestionCount = Math.min(...questionCounts);
      const maxQuestionCount = Math.max(...questionCounts);
      const sortedByCount = [...mappingPayload].sort((a, b) => (b.question_count || 0) - (a.question_count || 0));
      const top10Sample = sortedByCount.slice(0, 10).map(t => ({ name: t.name, question_count: t.question_count }));

      console.log('=== AI MAPPING PAYLOAD AUDIT ===');
      console.log(`topics_total: ${topicsTotal}`);
      console.log(`questions_total: ${questionsTotal}`);
      console.log(`min_question_count: ${minQuestionCount}`);
      console.log(`max_question_count: ${maxQuestionCount}`);
      console.log('Top 10 topics by question count:', JSON.stringify(top10Sample, null, 2));
      console.log('Selected discipline IDs:', JSON.stringify(selectedDisciplines));
      console.log('=== END AUDIT ===');

      const { data, error } = await supabase.functions.invoke('map-edital-topics', {
        body: {
          editalTopics,
          bankTopics: mappingPayload,
          model: config?.model,
          systemPrompt: config?.system_prompt
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      const clusters = data.clusters || [];
      const uncoveredClustersList = data.uncovered_clusters || [];
      const summary = data.summary || '';

      // Build a map from edital item name to its original order_index
      const orderMap = new Map<string, number>();
      verticalizedTopics.forEach((t, idx) => {
        orderMap.set(t.name, t.order_index ?? idx);
      });

      setConfirmedClusters(clusters.map((c: any) => ({
        cluster_name: c.cluster_name,
        bank_topic_ids: Array.isArray(c.bank_topic_ids) ? c.bank_topic_ids : (c.bank_topic_id ? [c.bank_topic_id] : []),
        edital_items: [...c.edital_items],
        edital_item_orders: c.edital_items.map((item: string) => orderMap.get(item) ?? 0),
        confidence: c.confidence,
        reasoning: c.reasoning,
        total_questoes: c.total_questoes ?? 0
      })));
      
      setUncoveredClusters(uncoveredClustersList.map((c: UncoveredCluster) => ({
        cluster_name: c.cluster_name,
        edital_items: [...c.edital_items],
        edital_item_orders: c.edital_items.map(item => orderMap.get(item) ?? 0),
        reasoning: c.reasoning,
        suggested_disciplines: c.suggested_disciplines || []
      })));
      
      setUncoveredTopics([]);
      setClusterSummary(summary);
      setStep('review');

      const totalUncoveredItems = uncoveredClustersList.reduce((acc: number, c: UncoveredCluster) => acc + c.edital_items.length, 0);
      toast({ 
        title: `${clusters.length} clusters cobertos + ${uncoveredClustersList.length} clusters não cobertos`, 
        description: summary 
      });
    } catch (error) {
      console.error('Error processing mapping:', error);
      toast({ 
        title: 'Erro ao processar mapeamento', 
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive' 
      });
    } finally {
      setProcessing(false);
    }
  };

  // Cluster manipulation functions
  const moveEditalItemToCluster = (editalItem: string, fromClusterIdx: number, toClusterIdx: number) => {
    setConfirmedClusters(prev => {
      const updated = [...prev];
      updated[fromClusterIdx] = {
        ...updated[fromClusterIdx],
        edital_items: updated[fromClusterIdx].edital_items.filter(item => item !== editalItem)
      };
      if (toClusterIdx >= 0 && toClusterIdx < updated.length) {
        updated[toClusterIdx] = {
          ...updated[toClusterIdx],
          edital_items: [...updated[toClusterIdx].edital_items, editalItem]
        };
      }
      return updated;
    });
  };

  const removeEditalItemFromCluster = (editalItem: string, clusterIdx: number) => {
    setConfirmedClusters(prev => {
      const updated = [...prev];
      updated[clusterIdx] = {
        ...updated[clusterIdx],
        edital_items: updated[clusterIdx].edital_items.filter(item => item !== editalItem)
      };
      return updated;
    });
    setUncoveredTopics(prev => [...prev, editalItem]);
  };

  const addUncoveredToCluster = (editalItem: string, clusterIdx: number) => {
    setUncoveredTopics(prev => prev.filter(item => item !== editalItem));
    setConfirmedClusters(prev => {
      const updated = [...prev];
      updated[clusterIdx] = {
        ...updated[clusterIdx],
        edital_items: [...updated[clusterIdx].edital_items, editalItem]
      };
      return updated;
    });
  };

  const createNewCluster = () => {
    const newCluster: ConfirmedCluster = {
      cluster_name: 'Novo Cluster',
      bank_topic_ids: [],
      edital_items: [],
      edital_item_orders: [],
      confidence: 0,
      reasoning: 'Cluster criado manualmente pelo administrador',
      total_questoes: 0
    };
    setConfirmedClusters(prev => [...prev, newCluster]);
  };

  const updateClusterName = (clusterIdx: number, newName: string) => {
    setConfirmedClusters(prev => {
      const updated = [...prev];
      updated[clusterIdx] = { ...updated[clusterIdx], cluster_name: newName };
      return updated;
    });
  };

  const addBankTopicToCluster = (clusterIdx: number, topicId: string) => {
    // Check if this topic is already used in another cluster
    const existingClusterIdx = confirmedClusters.findIndex(
      (c, idx) => idx !== clusterIdx && c.bank_topic_ids.includes(topicId)
    );
    if (existingClusterIdx >= 0) {
      toast({
        title: 'Caderno já vinculado',
        description: `Este caderno já está no cluster "${confirmedClusters[existingClusterIdx].cluster_name}". Remova-o de lá antes de adicionar aqui.`,
        variant: 'destructive'
      });
      return;
    }

    const topic = bankTopics.find(t => t.id === topicId);
    setConfirmedClusters(prev => {
      const updated = [...prev];
      const cluster = updated[clusterIdx];
      if (cluster.bank_topic_ids.includes(topicId)) return prev; // already added
      const newIds = [...cluster.bank_topic_ids, topicId];
      const newTotal = newIds.reduce((sum, id) => {
        const t = bankTopics.find(bt => bt.id === id);
        return sum + (t?.question_count || 0);
      }, 0);
      updated[clusterIdx] = {
        ...cluster,
        bank_topic_ids: newIds,
        total_questoes: newTotal,
        // If it's the first topic added, also set the cluster name
        cluster_name: cluster.bank_topic_ids.length === 0 && topic ? topic.name : cluster.cluster_name
      };
      return updated;
    });
  };

  const removeBankTopicFromCluster = (clusterIdx: number, topicId: string) => {
    setConfirmedClusters(prev => {
      const updated = [...prev];
      const cluster = updated[clusterIdx];
      const newIds = cluster.bank_topic_ids.filter(id => id !== topicId);
      const newTotal = newIds.reduce((sum, id) => {
        const t = bankTopics.find(bt => bt.id === id);
        return sum + (t?.question_count || 0);
      }, 0);
      updated[clusterIdx] = {
        ...cluster,
        bank_topic_ids: newIds,
        total_questoes: newTotal
      };
      return updated;
    });
  };

  const deleteCluster = (clusterIdx: number) => {
    const cluster = confirmedClusters[clusterIdx];
    setUncoveredTopics(prev => [...prev, ...cluster.edital_items]);
    setConfirmedClusters(prev => prev.filter((_, idx) => idx !== clusterIdx));
    setSelectedClustersForMerge(prev => prev.filter(idx => idx !== clusterIdx).map(idx => idx > clusterIdx ? idx - 1 : idx));
  };

  // Merge selected clusters
  const mergeClusters = () => {
    if (selectedClustersForMerge.length < 2) {
      toast({ title: 'Selecione pelo menos 2 clusters para mesclar', variant: 'destructive' });
      return;
    }

    const sortedIndices = [...selectedClustersForMerge].sort((a, b) => a - b);
    const primaryIdx = sortedIndices[0];
    const primaryCluster = confirmedClusters[primaryIdx];
    
    // Collect all items and their orders from selected clusters
    const allItems = sortedIndices.flatMap(idx => confirmedClusters[idx].edital_items);
    const allOrders = sortedIndices.flatMap(idx => confirmedClusters[idx].edital_item_orders);
    const uniqueItems = [...new Set(allItems)];
    const uniqueOrders = uniqueItems.map(item => {
      const idx = allItems.indexOf(item);
      return allOrders[idx] ?? 0;
    });

    // Merge bank_topic_ids from all selected clusters (deduplicated)
    const allBankTopicIds = new Set<string>();
    sortedIndices.forEach(idx => confirmedClusters[idx].bank_topic_ids.forEach(id => allBankTopicIds.add(id)));
    const mergedBankTopicIds = Array.from(allBankTopicIds).filter(Boolean);
    const mergedTotal = mergedBankTopicIds.reduce((sum, id) => {
      const t = bankTopics.find(bt => bt.id === id);
      return sum + (t?.question_count || 0);
    }, 0);

    // Create merged cluster
    const mergedCluster: ConfirmedCluster = {
      cluster_name: primaryCluster.cluster_name,
      bank_topic_ids: mergedBankTopicIds,
      edital_items: uniqueItems,
      edital_item_orders: uniqueOrders,
      confidence: primaryCluster.confidence,
      reasoning: `Cluster mesclado manualmente. Original: ${primaryCluster.reasoning}`,
      total_questoes: mergedTotal
    };

    // Remove selected clusters and add merged one
    setConfirmedClusters(prev => {
      const remaining = prev.filter((_, idx) => !selectedClustersForMerge.includes(idx));
      return [mergedCluster, ...remaining];
    });

    setSelectedClustersForMerge([]);
    setMergeMode(false);
    toast({ title: `${selectedClustersForMerge.length} clusters mesclados em 1` });
  };

  const toggleClusterForMerge = (idx: number) => {
    setSelectedClustersForMerge(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, item: string, fromClusterIdx: number, fromUncovered: boolean = false) => {
    setDraggedItem({ item, fromClusterIdx, fromUncovered });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnCluster = (e: React.DragEvent, toClusterIdx: number) => {
    e.preventDefault();
    if (!draggedItem) return;

    if (draggedItem.fromUncovered) {
      addUncoveredToCluster(draggedItem.item, toClusterIdx);
    } else if (draggedItem.fromClusterIdx !== toClusterIdx) {
      moveEditalItemToCluster(draggedItem.item, draggedItem.fromClusterIdx, toClusterIdx);
    }
    setDraggedItem(null);
  };

  const handleDropOnUncovered = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.fromUncovered) return;
    
    removeEditalItemFromCluster(draggedItem.item, draggedItem.fromClusterIdx);
    setDraggedItem(null);
  };

  // Get clusters without bank topic
  const clustersWithoutBankTopic = confirmedClusters.filter(c => c.bank_topic_ids.length === 0 && c.edital_items.length > 0);

  const saveMappings = async () => {
    // Validation warning
    if (clustersWithoutBankTopic.length > 0) {
      const proceed = window.confirm(
        `⚠️ ATENÇÃO: ${clustersWithoutBankTopic.length} cluster(s) não têm tópico do banco vinculado e serão salvos SEM QUESTÕES:\n\n${clustersWithoutBankTopic.map(c => `• ${c.cluster_name}`).join('\n')}\n\nDeseja continuar mesmo assim?`
      );
      if (!proceed) return;
    }

    setSaving(true);

    try {
      // Get the edital info for naming
      const edital = editals.find(e => e.id === selectedEditalId);
      
      // Create folder for the discipline (without school - will be linked later when creating schools)
      const { data: newFolder, error: folderError } = await supabase
        .from('admin_notebook_folders')
        .insert({
          name: newDisciplineName,
          school_id: null, // No school yet - will be assigned when schools are created
          is_active: true
        })
        .select()
        .single();

      if (folderError) throw folderError;

      // Create the discipline linked to the folder
      // IMPORTANT: Derived disciplines do NOT copy source_notebook_folder_id
      // They use source_discipline_id to reference the source discipline
      
      // Determine source_discipline_id from selected disciplines
      // Use the first selected source discipline as the primary link
      const sourceDisciplineId = selectedDisciplines.length > 0 ? selectedDisciplines[0] : null;
      
      // Fetch area_id from source discipline to inherit
      let inheritedAreaId: string | null = null;
      if (sourceDisciplineId) {
        const { data: sourceDiscipline } = await supabase
          .from('study_disciplines')
          .select('area_id')
          .eq('id', sourceDisciplineId)
          .single();
        inheritedAreaId = sourceDiscipline?.area_id || null;
      }
      
      const { data: newDiscipline, error: discError } = await supabase
        .from('study_disciplines')
        .insert({
          name: newDisciplineName,
          is_active: true,
          is_auto_generated: true,
          is_source: false, // Derived discipline, NOT a source
          generation_type: 'edital_mapping',
          source_discipline_id: sourceDisciplineId, // Link to first selected source discipline
          area_id: inheritedAreaId, // Inherit area_id from source discipline
        })
        .select()
        .single();

      if (discError) throw discError;

      // Link discipline to edital (NOT to a school - schools are created later)
      await supabase.from('edital_disciplines').insert({
        edital_id: selectedEditalId,
        discipline_id: newDiscipline.id,
        is_active: true,
        is_mandatory: true
      });

      // Create one notebook per cluster - preserving order from verticalized edital
      // IMPORTANT FIX: Only create notebook if we have questions to copy, otherwise use source_notebook_id
      let totalQuestionsCopied = 0;
      let clustersCreated = 0;
      
      for (let clusterIndex = 0; clusterIndex < confirmedClusters.length; clusterIndex++) {
        const cluster = confirmedClusters[clusterIndex];
        if (cluster.edital_items.length === 0) continue;

        const notebookDescription = `Cobre: ${cluster.edital_items.join('; ')}`;
        
        // Use the minimum order_index from edital items to preserve edital sequence
        // Guard against undefined edital_item_orders
        const itemOrders = cluster.edital_item_orders || [];
        const minOrderIndex = itemOrders.length > 0 
          ? Math.min(...itemOrders) 
          : clusterIndex;
        
        // Fetch source_notebook_ids from ALL bank topics in this cluster
        const allSourceNotebookIds: string[] = [];
        let primarySourceTopicId: string | null = null;
        let maxQuestionCount = -1;

        for (const bankTopicId of cluster.bank_topic_ids) {
          const { data: bankTopicData } = await supabase
            .from('study_topics')
            .select('id, source_notebook_id')
            .eq('id', bankTopicId)
            .single();
          if (bankTopicData?.source_notebook_id) {
            allSourceNotebookIds.push(bankTopicData.source_notebook_id);
          }
          // Determine primary source_topic_id (the one with most questions)
          const topicInfo = bankTopics.find((t: any) => t.id === bankTopicId);
          const qCount = topicInfo?.question_count || 0;
          if (qCount > maxQuestionCount) {
            maxQuestionCount = qCount;
            primarySourceTopicId = bankTopicId;
          }
        }

        const primarySourceNotebookId = allSourceNotebookIds.length > 0 ? allSourceNotebookIds[0] : null;

        // CRITICAL FIX: Don't create empty notebooks - only create if we'll copy questions later
        let newNotebookId: string | null = null;

        // Derived topics: source_topic_id = primary (most questions), source_notebook_id = primary notebook
        const { data: newStudyTopic, error: newTopicError } = await supabase
          .from('study_topics')
          .insert({
            name: cluster.cluster_name,
            description: notebookDescription.substring(0, 500),
            study_discipline_id: newDiscipline.id,
            is_active: true,
            is_source: false,
            generation_type: 'edital_mapping',
            source_topic_id: primarySourceTopicId, // Primary representative
            source_notebook_id: primarySourceNotebookId, // Primary notebook for inheritance
            display_order: minOrderIndex
          })
          .select()
          .single();

        if (newTopicError) {
          console.error('Error creating study topic:', newTopicError);
          continue;
        }

        // UPSERT topic_goal with ALL source notebooks (prevents duplicates via unique index)
        if (allSourceNotebookIds.length > 0 && newStudyTopic) {
          // Check if goal already exists for this topic+type (defensive, index enforces uniqueness)
          const { data: existingGoal } = await supabase
            .from('topic_goals')
            .select('id')
            .eq('topic_id', newStudyTopic.id)
            .eq('goal_type', 'questions')
            .eq('is_active', true)
            .maybeSingle();

          if (existingGoal) {
            await supabase.from('topic_goals').update({
              name: `Questões - ${cluster.cluster_name}`,
              duration_minutes: 60,
              question_notebook_ids: allSourceNotebookIds,
              updated_at: new Date().toISOString()
            }).eq('id', existingGoal.id);
          } else {
            await supabase.from('topic_goals').insert({
              topic_id: newStudyTopic.id,
              name: `Questões - ${cluster.cluster_name}`,
              goal_type: 'questions',
              duration_minutes: 60,
              question_notebook_ids: allSourceNotebookIds,
              is_active: true
            });
          }
        }

        clustersCreated++;

        // Insert edital topic mappings
        const safeItemOrders = cluster.edital_item_orders || [];
        for (let itemIdx = 0; itemIdx < cluster.edital_items.length; itemIdx++) {
          const editalItem = cluster.edital_items[itemIdx];
          const itemOrder = safeItemOrders[itemIdx] ?? itemIdx;
          
          const { data: editalTopic, error: topicError } = await supabase
            .from('edital_topic_mappings')
            .insert({
              edital_id: selectedEditalId,
              edital_topic_name: editalItem,
              display_order: itemOrder
            })
            .select()
            .single();

          if (topicError) continue;

          // Insert N:N mappings for ALL bank_topic_ids
          for (const bankTopicId of cluster.bank_topic_ids) {
            await supabase.from('edital_topic_bank_mappings').insert({
              edital_topic_id: editalTopic.id,
              study_topic_id: bankTopicId,
              is_ai_suggested: true,
              is_confirmed: true,
              confidence_score: cluster.confidence
            });
          }
        }

        // Copy questions from bank topic (only if bank_topic_id exists)
        // IMPORTANT: Some bank topics store questions ONLY via their notebook (admin_notebook_questions),
        // not via questions.study_topic_id nor question_topics. So we must include notebook-based links too.
        if (cluster.bank_topic_ids.length > 0 && newStudyTopic) {
          const questionIds = new Set<string>();

          for (const bankTopicId of cluster.bank_topic_ids) {
            // 1) Direct questions by topic field
            const { data: questionsFromTopics } = await supabase
              .from('questions')
              .select('id')
              .eq('study_topic_id', bankTopicId)
              .eq('is_active', true);
            questionsFromTopics?.forEach((q: any) => questionIds.add(q.id));

            // 2) Questions from N:N table (question_topics)
            {
              const PAGE_SIZE = 1000;
              let offset = 0;
              while (true) {
                const { data: qtData, error: qtError } = await supabase
                  .from('question_topics')
                  .select('question_id, questions!inner(is_active)')
                  .eq('study_topic_id', bankTopicId)
                  .eq('questions.is_active', true)
                  .range(offset, offset + PAGE_SIZE - 1);

                if (qtError || !qtData || qtData.length === 0) break;
                qtData.forEach((row: any) => questionIds.add(row.question_id));
                if (qtData.length < PAGE_SIZE) break;
                offset += PAGE_SIZE;
              }
            }

            // 3) Questions from the bank topic notebook (admin_notebook_questions)
            const { data: bankTopic } = await supabase
              .from('study_topics')
              .select('source_notebook_id')
              .eq('id', bankTopicId)
              .maybeSingle();

          if (bankTopic?.source_notebook_id) {
            const PAGE_SIZE = 1000;
            let offset = 0;
            while (true) {
              // Join with questions to filter only active ones
              const { data: nbData, error: nbError } = await supabase
                .from('admin_notebook_questions')
                .select('question_id, questions!inner(is_active)')
                .eq('notebook_id', bankTopic.source_notebook_id)
                .eq('questions.is_active', true)
                .range(offset, offset + PAGE_SIZE - 1);

              if (nbError || !nbData || nbData.length === 0) break;
              nbData.forEach((row: any) => questionIds.add(row.question_id));
              if (nbData.length < PAGE_SIZE) break;
              offset += PAGE_SIZE;
            }
          }
          } // end for bankTopicId

          if (questionIds.size > 0) {
            // CRITICAL FIX: Only create notebook NOW that we know there are questions to copy
            // This prevents "ghost notebooks" (empty notebooks that break cronograma generation)
            const { data: newNotebook, error: notebookError } = await supabase
              .from('admin_question_notebooks')
              .insert({
                name: cluster.cluster_name,
                description: notebookDescription.substring(0, 500),
                folder_id: newFolder.id,
                is_active: true,
                question_count: questionIds.size // Set count immediately
              })
              .select()
              .single();

            if (notebookError) {
              console.error('Error creating notebook:', notebookError);
            } else {
              newNotebookId = newNotebook.id;
              
              // 1. Insert into admin_notebook_questions (for admin caderno view)
              const notebookQuestions = Array.from(questionIds).map((qId, index) => ({
                notebook_id: newNotebook.id,
                question_id: qId,
                display_order: index
              }));

              const { error: insertQuestionsError } = await supabase
                .from('admin_notebook_questions')
                .insert(notebookQuestions);

              if (!insertQuestionsError) {
                totalQuestionsCopied += questionIds.size;
              }
            }

            // 2. Insert into question_topics (link questions to new study topic)
            const questionTopicsEntries = Array.from(questionIds).map(qId => ({
              question_id: qId,
              study_topic_id: newStudyTopic.id
            }));

            // Insert in batches
            for (let i = 0; i < questionTopicsEntries.length; i += 100) {
              const batch = questionTopicsEntries.slice(i, i + 100);
              const { error: qtError } = await supabase
                .from('question_topics')
                .insert(batch);
              if (qtError) console.error('Error inserting question_topics:', qtError);
            }

            // 3. Insert into question_disciplines (link questions to new discipline)
            // Use UPSERT to avoid duplicate key errors when questions appear in multiple clusters
            const questionDisciplinesEntries = Array.from(questionIds).map(qId => ({
              question_id: qId,
              study_discipline_id: newDiscipline.id
            }));

            // Insert in batches with onConflict to ignore duplicates
            for (let i = 0; i < questionDisciplinesEntries.length; i += 100) {
              const batch = questionDisciplinesEntries.slice(i, i + 100);
              const { error: qdError } = await supabase
                .from('question_disciplines')
                .upsert(batch, { onConflict: 'question_id,study_discipline_id', ignoreDuplicates: true });
              if (qdError) console.error('Error inserting question_disciplines:', qdError);
            }
          }
        }

        clustersCreated++;
      }

      // Create notebooks for uncovered clusters (clusters identified by AI without bank topics)
      // Start display_order after the confirmed clusters to maintain order
      let uncoveredClustersCreated = 0;
      const uncoveredStartIndex = confirmedClusters.length;
      
      for (let uncoveredIndex = 0; uncoveredIndex < uncoveredClusters.length; uncoveredIndex++) {
        const cluster = uncoveredClusters[uncoveredIndex];
        if (cluster.edital_items.length === 0) continue;

        const notebookDescription = `[Sem questões] ${cluster.reasoning || ''}\nTópicos: ${cluster.edital_items.join('; ')}`.substring(0, 500);
        const { data: newNotebook, error: notebookError } = await supabase
          .from('admin_question_notebooks')
          .insert({
            name: `⚠️ ${cluster.cluster_name}`,
            description: notebookDescription,
            folder_id: newFolder.id,
            is_active: true,
            question_count: 0
          })
          .select()
          .single();

        if (notebookError) {
          console.error('Error creating uncovered notebook:', notebookError);
          continue;
        }

        // Use the minimum order_index from edital items to preserve edital sequence
        // Guard against undefined edital_item_orders
        const itemOrdersUncovered = cluster.edital_item_orders || [];
        const minOrderIndex = itemOrdersUncovered.length > 0 
          ? Math.min(...itemOrdersUncovered) 
          : uncoveredStartIndex + uncoveredIndex;
        
        const { data: newStudyTopic, error: topicError } = await supabase
          .from('study_topics')
          .insert({
            name: `⚠️ ${cluster.cluster_name}`,
            description: notebookDescription,
            study_discipline_id: newDiscipline.id,
            is_active: true,
            is_source: false,
            generation_type: 'manual', // Uncovered clusters are manually created
            source_notebook_id: newNotebook?.id,
            display_order: minOrderIndex
          })
          .select()
          .single();

        if (topicError) {
          console.error('Error creating uncovered study topic:', topicError);
          continue;
        }

        // Create topic_goal for questions (even if empty, allows future population)
        if (newNotebook && newStudyTopic) {
          await supabase.from('topic_goals').insert({
            topic_id: newStudyTopic.id,
            name: `⚠️ ${cluster.cluster_name} - Questões`,
            goal_type: 'questions',
            duration_minutes: 60,
            question_notebook_ids: [newNotebook.id],
            is_active: true
          });
        }

        uncoveredClustersCreated++;

        // Insert edital topic mappings AND bank mappings (linking to the uncovered study topic)
        // Use the order from edital_item_orders to preserve original edital sequence
        for (let itemIdx = 0; itemIdx < cluster.edital_items.length; itemIdx++) {
          const editalItem = cluster.edital_items[itemIdx];
          const itemOrder = cluster.edital_item_orders[itemIdx] ?? itemIdx;
          
          const { data: editalMapping, error: emError } = await supabase
            .from('edital_topic_mappings')
            .insert({
              edital_id: selectedEditalId,
              edital_topic_name: editalItem,
              display_order: itemOrder
            })
            .select()
            .single();

          if (!emError && editalMapping && newStudyTopic) {
            // Create the bank mapping to link edital topic to the uncovered study topic
            await supabase.from('edital_topic_bank_mappings').insert({
              edital_topic_id: editalMapping.id,
              study_topic_id: newStudyTopic.id,
              is_ai_suggested: true,
              is_confirmed: true,
              confidence_score: 0 // 0 indicates no questions
            });
          }
        }
      }

      // Create notebook for legacy uncovered topics (individual items)
      if (uncoveredTopics.length > 0) {
        const { data: uncoveredNotebook } = await supabase
          .from('admin_question_notebooks')
          .insert({
            name: '⚠️ Tópicos Avulsos Não Cobertos',
            description: uncoveredTopics.join('; ').substring(0, 500),
            folder_id: newFolder.id,
            is_active: true,
            question_count: 0
          })
          .select()
          .single();

        if (uncoveredNotebook) {
          await supabase.from('study_topics').insert({
            name: '⚠️ Tópicos Avulsos Não Cobertos',
            description: uncoveredTopics.join('; ').substring(0, 500),
            study_discipline_id: newDiscipline.id,
            is_active: true,
            source_notebook_id: uncoveredNotebook.id
          });

          for (const item of uncoveredTopics) {
            await supabase.from('edital_topic_mappings').insert({
              edital_id: selectedEditalId,
              edital_topic_name: item
            });
          }
        }
      }

      const editalName = editals.find(e => e.id === selectedEditalId)?.name || '';
      const totalEditalItems = confirmedClusters.reduce((acc, c) => acc + c.edital_items.length, 0) + 
                               uncoveredClusters.reduce((acc, c) => acc + c.edital_items.length, 0) + 
                               uncoveredTopics.length;
      const totalClusters = clustersCreated + uncoveredClustersCreated;
      
      const uncoveredInfo = uncoveredClustersCreated > 0 ? ` + ${uncoveredClustersCreated} sem questões (editáveis depois)` : '';
      toast({ 
        title: `Mapeamentos salvos com sucesso!`, 
        description: `${totalEditalItems} tópicos do edital → ${totalClusters} cadernos (${totalQuestionsCopied} questões${uncoveredInfo}) em "${editalName}".`
      });
      setStep('complete');
    } catch (error) {
      console.error('Error saving mappings:', error);
      toast({ title: 'Erro ao salvar mapeamentos', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedEditalId('');
    setNewDisciplineName('');
    setSelectedDisciplines([]);
    setEditalText('');
    setVerticalizedTopics([]);
    setVerticalizationSummary('');
    setConfirmedClusters([]);
    setUncoveredClusters([]);
    setUncoveredTopics([]);
    setClusterSummary('');
    setStep('input');
    setSelectedClustersForMerge([]);
    setMergeMode(false);
    setMappingUncoveredCluster(null);
    setUncoveredClusterDisciplines([]);
    setUncoveredClusterTopics([]);
  };

  // Load topics for mapping uncovered clusters
  const loadTopicsForUncoveredMapping = async (disciplineIds: string[]) => {
    if (disciplineIds.length === 0) {
      setUncoveredClusterTopics([]);
      return;
    }

    const { data } = await supabase
      .from('study_topics')
      .select('id, name, study_discipline_id, display_order, study_disciplines(name)')
      .in('study_discipline_id', disciplineIds)
      .eq('is_active', true)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('name');

    if (data) {
      setUncoveredClusterTopics(data.map((t: any) => ({
        id: t.id,
        name: t.name,
        discipline_id: t.study_discipline_id,
        discipline_name: t.study_disciplines?.name || '',
        question_count: 0 // Not needed for uncovered cluster mapping UI
      })));
    }
  };

  // Map an uncovered cluster to existing bank topics using AI
  const mapUncoveredCluster = async (clusterIdx: number) => {
    if (uncoveredClusterDisciplines.length === 0) {
      toast({ title: 'Selecione pelo menos uma disciplina para buscar tópicos', variant: 'destructive' });
      return;
    }
    
    if (uncoveredClusterTopics.length === 0) {
      toast({ title: 'Nenhum tópico disponível nas disciplinas selecionadas', variant: 'destructive' });
      return;
    }

    setProcessingUncovered(true);

    try {
      const cluster = uncoveredClusters[clusterIdx];
      const config = getAIConfig('mapping');

      const { data, error } = await supabase.functions.invoke('map-edital-topics', {
        body: {
          editalTopics: cluster.edital_items,
          bankTopics: uncoveredClusterTopics.map(t => ({
            id: t.id,
            name: t.name,
            discipline_name: t.discipline_name
          })),
          model: config?.model,
          systemPrompt: config?.system_prompt
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const newClusters = data.clusters || [];
      const remainingUncovered = data.uncovered_clusters || [];

      // Add new mapped clusters to confirmed clusters
      const mappedClusters: ConfirmedCluster[] = newClusters.map((c: any) => ({
        cluster_name: c.cluster_name,
        bank_topic_ids: Array.isArray(c.bank_topic_ids) ? c.bank_topic_ids : (c.bank_topic_id ? [c.bank_topic_id] : []),
        edital_items: [...c.edital_items],
        edital_item_orders: c.edital_items.map((_: any, i: number) => i),
        confidence: c.confidence,
        reasoning: c.reasoning,
        total_questoes: c.total_questoes ?? 0
      }));

      setConfirmedClusters(prev => [...prev, ...mappedClusters]);

      // Remove the mapped cluster and add any remaining uncovered ones
      setUncoveredClusters(prev => {
        const updated = prev.filter((_, idx) => idx !== clusterIdx);
        remainingUncovered.forEach((c: UncoveredCluster) => {
          updated.push({
            cluster_name: c.cluster_name,
            edital_items: [...c.edital_items],
            edital_item_orders: c.edital_items.map((_, i) => i),
            reasoning: c.reasoning,
            suggested_disciplines: c.suggested_disciplines || []
          });
        });
        return updated;
      });

      setMappingUncoveredCluster(null);
      setUncoveredClusterDisciplines([]);
      setUncoveredClusterTopics([]);

      toast({ 
        title: `${mappedClusters.length} novo(s) cluster(s) mapeado(s)!`,
        description: `Tópicos do cluster "${cluster.cluster_name}" foram mapeados.`
      });
    } catch (error) {
      console.error('Error mapping uncovered cluster:', error);
      toast({ 
        title: 'Erro ao mapear cluster', 
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive' 
      });
    } finally {
      setProcessingUncovered(false);
    }
  };

  // Convert uncovered cluster to confirmed cluster (manual)
  const convertUncoveredToConfirmed = (clusterIdx: number) => {
    const cluster = uncoveredClusters[clusterIdx];
    const newConfirmedCluster: ConfirmedCluster = {
      cluster_name: cluster.cluster_name,
      bank_topic_ids: [],
      edital_items: [...cluster.edital_items],
      edital_item_orders: cluster.edital_items.map((_, i) => i),
      confidence: 0,
      reasoning: `Cluster convertido manualmente. Original: ${cluster.reasoning}`,
      total_questoes: 0
    };
    
    setConfirmedClusters(prev => [...prev, newConfirmedCluster]);
    setUncoveredClusters(prev => prev.filter((_, idx) => idx !== clusterIdx));
    
    toast({ title: `Cluster "${cluster.cluster_name}" movido para clusters cobertos` });
  };

  // Delete uncovered cluster
  const deleteUncoveredCluster = (clusterIdx: number) => {
    const cluster = uncoveredClusters[clusterIdx];
    setUncoveredTopics(prev => [...prev, ...cluster.edital_items]);
    setUncoveredClusters(prev => prev.filter((_, idx) => idx !== clusterIdx));
  };

  // Load existing edital topics for manage mode - grouped by clusters
  const loadExistingTopics = async () => {
    setLoadingExisting(true);
    try {
      // Get all edital topic mappings with their study topic info (including edital_id)
      const { data: mappings, error } = await supabase
        .from('edital_topic_mappings')
        .select(`
          id,
          school_id,
          edital_id,
          edital_topic_name,
          created_at,
          schools(name),
          editals(name),
          edital_topic_bank_mappings(
            study_topic_id,
            study_topics(
              id,
              name,
              study_discipline_id,
              study_disciplines(name, source_notebook_folder_id)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch admin_notebook_folders to identify which disciplines were created via mapping
      // Disciplines created via mapping have source_notebook_folder_id pointing to folders with school_id = NULL
      const { data: foldersData } = await supabase
        .from('admin_notebook_folders')
        .select('id, school_id');
      
      const folderSchoolMap: Record<string, string | null> = {};
      (foldersData || []).forEach((f: { id: string; school_id: string | null }) => {
        folderSchoolMap[f.id] = f.school_id;
      });

      // Get question counts for each study topic
      const studyTopicIds = (mappings || [])
        .flatMap((m: any) => m.edital_topic_bank_mappings || [])
        .map((b: any) => b.study_topic_id)
        .filter((id: string | null): id is string => id !== null);

      const uniqueTopicIds = [...new Set(studyTopicIds)];
      
      let questionCounts: Record<string, number> = {};
      if (uniqueTopicIds.length > 0) {
        const { data: countData } = await supabase.rpc('get_topic_question_counts', {
          topic_ids: uniqueTopicIds
        });
        if (countData) {
          countData.forEach((c: any) => {
            questionCounts[c.topic_id] = c.question_count;
          });
        }
      }

      // Format individual topics - support both school_id and edital_id
      const formattedTopics: (ExistingEditalTopic & { isCreatedViaMapping?: boolean })[] = (mappings || []).map((m: any) => {
        const bankMapping = m.edital_topic_bank_mappings?.[0];
        const studyTopic = bankMapping?.study_topics;
        const discipline = studyTopic?.study_disciplines;
        
        // Determine display name: prefer edital name, fallback to school name
        const displayName = m.editals?.name || m.schools?.name || 'Edital desconhecido';
        
        // Check if this discipline was created via mapping (folder has no school)
        const folderSchoolId = discipline?.source_notebook_folder_id 
          ? folderSchoolMap[discipline.source_notebook_folder_id] 
          : undefined;
        const isCreatedViaMapping = discipline?.source_notebook_folder_id && folderSchoolId === null;
        
        return {
          id: m.id,
          school_id: m.school_id,
          school_name: m.schools?.name || '',
          edital_id: m.edital_id,
          edital_name: m.editals?.name || displayName,
          edital_topic_name: m.edital_topic_name,
          study_topic_id: studyTopic?.id || null,
          study_topic_name: studyTopic?.name || null,
          discipline_id: studyTopic?.study_discipline_id || null,
          discipline_name: discipline?.name || null,
          question_count: studyTopic?.id ? (questionCounts[studyTopic.id] || 0) : 0,
          created_at: m.created_at,
          isCreatedViaMapping,
        };
      });

      setExistingTopics(formattedTopics);

      // Group by study_topic_id to create clusters
      const clusterMap = new Map<string, ExistingCluster>();
      
      for (const topic of formattedTopics) {
        if (!topic.study_topic_id) continue; // Skip topics without bank mapping
        
        const existingCluster = clusterMap.get(topic.study_topic_id);
        if (existingCluster) {
          existingCluster.edital_items.push(topic.edital_topic_name);
        } else {
          clusterMap.set(topic.study_topic_id, {
            study_topic_id: topic.study_topic_id,
            study_topic_name: topic.study_topic_name || '',
            discipline_id: topic.discipline_id || '',
            discipline_name: topic.discipline_name || '',
            school_id: topic.school_id,
            school_name: topic.school_name,
            edital_id: topic.edital_id,
            edital_name: topic.edital_name,
            question_count: topic.question_count,
            edital_items: [topic.edital_topic_name],
            is_uncovered: (topic.study_topic_name || '').startsWith('⚠️'),
            created_at: topic.created_at,
            isCreatedViaMapping: topic.isCreatedViaMapping,
          });
        }
      }

      const clusters = Array.from(clusterMap.values()).sort((a, b) => {
        // Sort by is_uncovered first (uncovered first), then by question_count
        if (a.is_uncovered !== b.is_uncovered) return a.is_uncovered ? -1 : 1;
        return a.question_count - b.question_count;
      });

      setExistingClusters(clusters);
    } catch (error) {
      console.error('Error loading existing topics:', error);
      toast({ title: 'Erro ao carregar tópicos existentes', variant: 'destructive' });
    } finally {
      setLoadingExisting(false);
    }
  };

  // Load topics for existing topic mapping
  const loadTopicsForExistingMapping = async (disciplineIds: string[]) => {
    if (disciplineIds.length === 0) {
      setExistingMappingTopics([]);
      return;
    }

    const { data } = await supabase
      .from('study_topics')
      .select('id, name, study_discipline_id, display_order, study_disciplines(name)')
      .in('study_discipline_id', disciplineIds)
      .eq('is_active', true)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('name');

    if (data) {
      setExistingMappingTopics(data.map((t: any) => ({
        id: t.id,
        name: t.name,
        discipline_id: t.study_discipline_id,
        discipline_name: t.study_disciplines?.name || '',
        question_count: 0 // Not needed for existing mapping UI
      })));
    }
  };

  // Map existing edital topic to bank topic
  const mapExistingTopicToBank = async (editalTopic: ExistingEditalTopic, bankTopicId: string) => {
    setProcessingExistingMapping(true);
    try {
      // Remove old mapping if exists
      await supabase
        .from('edital_topic_bank_mappings')
        .delete()
        .eq('edital_topic_id', editalTopic.id);

      // Create new mapping
      const { error } = await supabase
        .from('edital_topic_bank_mappings')
        .insert({
          edital_topic_id: editalTopic.id,
          study_topic_id: bankTopicId,
          is_confirmed: true,
          is_ai_suggested: false,
          confidence_score: 1.0
        });

      if (error) throw error;

      toast({ title: 'Mapeamento salvo!', description: `"${editalTopic.edital_topic_name}" foi vinculado ao tópico do banco.` });
      
      setMappingExistingTopic(null);
      setExistingMappingDisciplines([]);
      setExistingMappingTopics([]);
      
      // Reload topics to reflect changes
      await loadExistingTopics();
    } catch (error) {
      console.error('Error mapping topic:', error);
      toast({ title: 'Erro ao mapear tópico', variant: 'destructive' });
    } finally {
      setProcessingExistingMapping(false);
    }
  };

  // Remap existing cluster using AI to find the best matching bank topic
  // This will also copy questions and link them properly to the school's discipline/topics
  const remapExistingClusterWithAI = async () => {
    if (!mappingExistingCluster) return;
    
    if (existingMappingDisciplines.length === 0) {
      toast({ title: 'Selecione pelo menos uma disciplina para buscar tópicos', variant: 'destructive' });
      return;
    }
    
    if (existingMappingTopics.length === 0) {
      toast({ title: 'Nenhum tópico disponível nas disciplinas selecionadas', variant: 'destructive' });
      return;
    }

    setProcessingExistingMapping(true);

    try {
      // Find all edital_topic_mappings for this cluster
      const editalTopicsInCluster = existingTopics.filter(
        t => t.study_topic_id === mappingExistingCluster.study_topic_id
      );

      const config = getAIConfig('mapping');

      // Call AI to find the best mapping
      const { data, error } = await supabase.functions.invoke('map-edital-topics', {
        body: {
          editalTopics: mappingExistingCluster.edital_items,
          bankTopics: existingMappingTopics.map(t => ({
            id: t.id,
            name: t.name,
            discipline_name: t.discipline_name
          })),
          model: config?.model,
          systemPrompt: config?.system_prompt
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const mappedClusters = data.clusters || [];
      
      if (mappedClusters.length === 0) {
        toast({ 
          title: 'Nenhum mapeamento encontrado', 
          description: 'A IA não encontrou correspondência entre os itens do edital e os tópicos das disciplinas selecionadas.',
          variant: 'destructive' 
        });
        return;
      }

      // Get the study_topic info for this cluster (to find the notebook and discipline)
      const { data: clusterStudyTopic } = await supabase
        .from('study_topics')
        .select('id, name, study_discipline_id, source_notebook_id')
        .eq('id', mappingExistingCluster.study_topic_id)
        .single();

      if (!clusterStudyTopic) {
        throw new Error('Tópico do cluster não encontrado');
      }

      // For each mapped cluster from AI, update the mappings AND copy questions
      let updatedCount = 0;
      let totalQuestionsCopied = 0;
      
      for (const aiCluster of mappedClusters) {
        const newBankTopicId = Array.isArray(aiCluster.bank_topic_ids) ? aiCluster.bank_topic_ids[0] : (aiCluster as any).bank_topic_id;
        
        // Find which edital topics match this cluster's items
        for (const editalItem of aiCluster.edital_items) {
          const editalTopic = editalTopicsInCluster.find(t => t.edital_topic_name === editalItem);
          if (!editalTopic) continue;
          
          // Remove old mapping
          await supabase
            .from('edital_topic_bank_mappings')
            .delete()
            .eq('edital_topic_id', editalTopic.id);

          // Create new mapping to the AI-suggested bank topic
          await supabase
            .from('edital_topic_bank_mappings')
            .insert({
              edital_topic_id: editalTopic.id,
              study_topic_id: newBankTopicId,
              is_confirmed: false,
              is_ai_suggested: true,
              confidence_score: aiCluster.confidence
            });
          
          updatedCount++;
        }

        // Copy questions from the bank topic to the cluster's study topic and notebook
        // 1. Get questions from the bank topic
        const { data: questionsFromTopics } = await supabase
          .from('questions')
          .select('id')
          .eq('study_topic_id', newBankTopicId)
          .eq('is_active', true);

        const { data: questionsFromJunction } = await supabase
          .from('question_topics')
          .select('question_id')
          .eq('study_topic_id', newBankTopicId);

        const questionIds = new Set<string>();
        questionsFromTopics?.forEach(q => questionIds.add(q.id));
        questionsFromJunction?.forEach(q => questionIds.add(q.question_id));

        if (questionIds.size > 0) {
          // 2. Link questions to the cluster's study topic via question_topics
          const questionTopicsEntries = Array.from(questionIds).map(qId => ({
            question_id: qId,
            study_topic_id: clusterStudyTopic.id
          }));

          // Check for existing entries to avoid duplicates
          const { data: existingQT } = await supabase
            .from('question_topics')
            .select('question_id')
            .eq('study_topic_id', clusterStudyTopic.id)
            .in('question_id', Array.from(questionIds));

          const existingQTSet = new Set((existingQT || []).map(q => q.question_id));
          const newQTEntries = questionTopicsEntries.filter(e => !existingQTSet.has(e.question_id));

          // Insert in batches
          for (let i = 0; i < newQTEntries.length; i += 100) {
            const batch = newQTEntries.slice(i, i + 100);
            await supabase.from('question_topics').insert(batch);
          }

          // 3. Link questions to the cluster's discipline via question_disciplines
          const questionDisciplinesEntries = Array.from(questionIds).map(qId => ({
            question_id: qId,
            study_discipline_id: clusterStudyTopic.study_discipline_id
          }));

          // Check for existing entries to avoid duplicates
          const { data: existingQD } = await supabase
            .from('question_disciplines')
            .select('question_id')
            .eq('study_discipline_id', clusterStudyTopic.study_discipline_id)
            .in('question_id', Array.from(questionIds));

          const existingQDSet = new Set((existingQD || []).map(q => q.question_id));
          const newQDEntries = questionDisciplinesEntries.filter(e => !existingQDSet.has(e.question_id));

          // Insert in batches
          for (let i = 0; i < newQDEntries.length; i += 100) {
            const batch = newQDEntries.slice(i, i + 100);
            await supabase.from('question_disciplines').insert(batch);
          }

          // 4. If the cluster has a source notebook, add questions to it
          if (clusterStudyTopic.source_notebook_id) {
            // Check existing notebook questions
            const { data: existingNQ } = await supabase
              .from('admin_notebook_questions')
              .select('question_id')
              .eq('notebook_id', clusterStudyTopic.source_notebook_id)
              .in('question_id', Array.from(questionIds));

            const existingNQSet = new Set((existingNQ || []).map(q => q.question_id));
            const newNQEntries = Array.from(questionIds)
              .filter(qId => !existingNQSet.has(qId))
              .map((qId, index) => ({
                notebook_id: clusterStudyTopic.source_notebook_id!,
                question_id: qId,
                display_order: index
              }));

            if (newNQEntries.length > 0) {
              await supabase.from('admin_notebook_questions').insert(newNQEntries);

              // Update notebook question count
              const { data: countData } = await supabase
                .from('admin_notebook_questions')
                .select('id', { count: 'exact' })
                .eq('notebook_id', clusterStudyTopic.source_notebook_id);

              await supabase
                .from('admin_question_notebooks')
                .update({ question_count: countData?.length || 0 })
                .eq('id', clusterStudyTopic.source_notebook_id);
            }
          }

          totalQuestionsCopied += questionIds.size;
        }
      }

      // Update the study topic name to remove the ⚠️ prefix if it had one
      if (mappingExistingCluster.is_uncovered && clusterStudyTopic.name.startsWith('⚠️')) {
        const newName = clusterStudyTopic.name.replace(/^⚠️\s*/, '');
        await supabase
          .from('study_topics')
          .update({ name: newName })
          .eq('id', clusterStudyTopic.id);

        // Also update the notebook name if it exists
        if (clusterStudyTopic.source_notebook_id) {
          await supabase
            .from('admin_question_notebooks')
            .update({ name: newName })
            .eq('id', clusterStudyTopic.source_notebook_id);
        }
      }

      // Handle any uncovered items - keep them in the original cluster (no change)
      const uncoveredFromAI = data.uncovered_clusters || [];
      const uncoveredItemsCount = uncoveredFromAI.reduce((acc: number, c: any) => acc + (c.edital_items?.length || 0), 0);

      let description = '';
      if (totalQuestionsCopied > 0) {
        description = `${updatedCount} itens remapeados. ${totalQuestionsCopied} questões vinculadas ao tópico e disciplina.`;
      } else {
        description = `${updatedCount} itens do edital foram remapeados.`;
      }
      
      if (uncoveredItemsCount > 0) {
        description += ` ${uncoveredItemsCount} itens não encontraram correspondência.`;
      }

      toast({ 
        title: 'Cluster remapeado com sucesso!', 
        description
      });
      
      setMappingExistingCluster(null);
      setExistingMappingDisciplines([]);
      setExistingMappingTopics([]);
      
      // Reload to reflect changes
      await loadExistingTopics();
    } catch (error) {
      console.error('Error remapping cluster with AI:', error);
      toast({ 
        title: 'Erro ao remapear cluster', 
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive' 
      });
    } finally {
      setProcessingExistingMapping(false);
    }
  };

  // Filter existing clusters - support both school_id (legacy) and edital_id (new)
  const filteredExistingClusters = existingClusters.filter(c => {
    // Filter by school/edital
    if (filterSchoolId !== 'all') {
      // Check both school_id and edital_id
      const matchesSchool = c.school_id === filterSchoolId;
      const matchesEdital = c.edital_id === filterSchoolId;
      if (!matchesSchool && !matchesEdital) return false;
    }
    // Handle discipline filter - 'uncovered' means clusters without questions (⚠️ prefix)
    if (filterDisciplineId === 'uncovered' && !c.is_uncovered) return false;
    if (filterDisciplineId !== 'all' && filterDisciplineId !== 'uncovered' && c.discipline_id !== filterDisciplineId) return false;
    if (filterEmptyOnly && c.question_count > 0) return false;
    // Text search filter
    if (clusterSearchText.trim()) {
      const searchLower = clusterSearchText.toLowerCase().trim();
      const nameMatches = c.study_topic_name.toLowerCase().includes(searchLower);
      const disciplineMatches = c.discipline_name?.toLowerCase().includes(searchLower);
      const editalItemMatches = c.edital_items.some(item => item.toLowerCase().includes(searchLower));
      const editalNameMatches = c.edital_name?.toLowerCase().includes(searchLower);
      if (!nameMatches && !disciplineMatches && !editalItemMatches && !editalNameMatches) return false;
    }
    return true;
  });

  // Count uncovered clusters (with ⚠️ prefix)
  const uncoveredClusterCount = existingClusters.filter(c => c.is_uncovered).length;

  // Get unique editals/schools from existing clusters (combine edital_id and school_id)
  const editalsMap = new Map<string, { id: string; name: string }>();
  existingClusters.forEach(c => {
    // Prefer edital_id, fallback to school_id
    const id = c.edital_id || c.school_id || '';
    const name = c.edital_name || c.school_name || 'Desconhecido';
    if (id && !editalsMap.has(id)) {
      editalsMap.set(id, { id, name });
    }
  });
  const uniqueEditalsInExisting = Array.from(editalsMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  // Get unique disciplines from existing clusters (based on the selected edital filter).
  // CRITICAL FIX: When filtering by a specific edital (e.g., "IF Sudeste de MG"),
  // we must show ONLY disciplines that were CREATED for that edital via mapping,
  // NOT the source pré-edital disciplines that the clusters reference via bank_topic_id.
  // 
  // The key distinction is:
  // - isCreatedViaMapping === true: discipline was created during mapping (new discipline for the edital)
  // - isCreatedViaMapping === false/undefined: discipline is from pré-edital (source discipline)
  //
  // When viewing a specific edital, we should ONLY show the mapped disciplines (isCreatedViaMapping === true)
  
  const clustersForDisciplineOptions = existingClusters.filter((c) => {
    if (filterSchoolId === 'all') return true;
    // Match by edital_id (primary) OR school_id (legacy fallback)
    return c.edital_id === filterSchoolId || c.school_id === filterSchoolId;
  });

  // Check if the selected filter is the pre-edital (check if it's a default edital)
  const isFilteringPreEdital = filterSchoolId !== 'all' && editals.some(e => e.id === filterSchoolId && (e as any).is_default === true);

  const disciplineCandidates = clustersForDisciplineOptions
    .filter((c) => c.discipline_id && c.discipline_name)
    // CRITICAL: When filtering by a post-edital, only show disciplines created via mapping
    // When filtering by pre-edital or "all", show all disciplines
    .filter((c) => {
      if (filterSchoolId === 'all' || isFilteringPreEdital) return true;
      // For post-editals, only include disciplines that were created via mapping
      return c.isCreatedViaMapping === true;
    })
    .map((c) => ({
      id: c.discipline_id as string,
      name: c.discipline_name as string,
      isCreatedViaMapping: c.isCreatedViaMapping === true,
    }));

  const disciplineNameCounts = disciplineCandidates.reduce<Record<string, number>>((acc, d) => {
    acc[d.name] = (acc[d.name] || 0) + 1;
    return acc;
  }, {});

  const uniqueDisciplinesInExisting = [...new Map(
    disciplineCandidates.map((d) => [
      d.id,
      {
        id: d.id,
        name:
          disciplineNameCounts[d.name] > 1
            ? `${d.name} ${d.isCreatedViaMapping ? '(mapeada)' : '(pré-edital)'}`
            : d.name,
      },
    ])
  ).values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View mode toggle */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant={viewMode === 'new' ? 'default' : 'outline'}
          onClick={() => setViewMode('new')}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Mapeamento
        </Button>
        <Button
          variant={viewMode === 'manage' ? 'default' : 'outline'}
          onClick={() => {
            setViewMode('manage');
            // Always refresh when entering manage mode to show latest mappings
            loadExistingTopics();
          }}
          className="gap-2"
        >
          <Edit2 className="w-4 h-4" />
          Gerenciar Existentes
        </Button>
      </div>

      {/* MANAGE MODE */}
      {viewMode === 'manage' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Gerenciar Mapeamentos de Edital
            </CardTitle>
            <CardDescription>
              Visualize e edite tópicos do edital já mapeados. Tópicos sem questões podem ser vinculados a novas disciplinas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1 flex-1 min-w-[200px] max-w-[400px]">
                <Label className="text-xs">Buscar por nome</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cluster, disciplina ou item do edital..."
                    value={clusterSearchText}
                    onChange={(e) => setClusterSearchText(e.target.value)}
                    className="pl-9"
                  />
                  {clusterSearchText && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setClusterSearchText('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Edital</Label>
                <Select 
                  value={filterSchoolId} 
                  onValueChange={(value) => {
                    setFilterSchoolId(value);
                    // Reset discipline filter when edital changes
                    setFilterDisciplineId('all');
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Todos os editais" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[350px]">
                    <SelectItem value="all">Todos os editais</SelectItem>
                    {uniqueEditalsInExisting.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Disciplina</Label>
                <Select value={filterDisciplineId} onValueChange={setFilterDisciplineId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Todas as disciplinas" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[350px]">
                    <SelectItem value="all">Todas as disciplinas</SelectItem>
                    {uncoveredClusterCount > 0 && (
                      <SelectItem value="uncovered" className="text-orange-600">
                        ⚠️ Apenas não cobertos ({uncoveredClusterCount})
                      </SelectItem>
                    )}
                    {uniqueDisciplinesInExisting.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="filter-empty"
                  checked={filterEmptyOnly}
                  onCheckedChange={(checked) => setFilterEmptyOnly(checked as boolean)}
                />
                <label htmlFor="filter-empty" className="text-sm cursor-pointer whitespace-nowrap">
                  Sem questões
                </label>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadExistingTopics}
                disabled={loadingExisting}
              >
                {loadingExisting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            {/* Stats */}
            <div className="flex gap-2">
              <Badge variant="outline">
                {filteredExistingClusters.length} cluster(s) encontrado(s)
              </Badge>
              <Badge variant="destructive">
                {filteredExistingClusters.filter(c => c.question_count === 0).length} sem questões
              </Badge>
            </div>

            {/* Clusters list */}
            {loadingExisting ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : filteredExistingClusters.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {existingClusters.length === 0 
                  ? 'Nenhum mapeamento encontrado. Crie um novo mapeamento primeiro.' 
                  : 'Nenhum cluster encontrado com os filtros aplicados.'}
              </div>
            ) : (
              <ScrollArea className="h-[500px] border rounded-lg p-4">
                <div className="space-y-3">
                  {filteredExistingClusters.map((cluster) => (
                    <div
                      key={cluster.study_topic_id}
                      className={`border rounded-lg ${
                        cluster.is_uncovered || cluster.question_count === 0 
                          ? 'border-orange-400/50 bg-orange-50/50 dark:bg-orange-950/20' 
                          : 'border-border'
                      }`}
                    >
                      {/* Cluster header */}
                      <div 
                        className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedClusterId(
                          expandedClusterId === cluster.study_topic_id ? null : cluster.study_topic_id
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <ChevronRight 
                              className={`w-4 h-4 transition-transform ${
                                expandedClusterId === cluster.study_topic_id ? 'rotate-90' : ''
                              }`} 
                            />
                            <span className="font-medium" title={cluster.study_topic_name}>
                              {cluster.study_topic_name.replace('⚠️ ', '')}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {cluster.edital_items.length} item(ns) do edital
                            </Badge>
                            {cluster.question_count === 0 && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Sem questões
                              </Badge>
                            )}
                            {cluster.question_count > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {cluster.question_count} questão(ões)
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2 ml-6">
                            <span>{cluster.edital_name || cluster.school_name}</span>
                            <span>•</span>
                            <span className="text-primary">{cluster.discipline_name}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {cluster.is_uncovered && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMappingExistingCluster(cluster);
                                    setExistingMappingDisciplines([]);
                                    setExistingMappingTopics([]);
                                  }}
                                >
                                  <Search className="w-4 h-4 mr-1" />
                                  Remapear Cluster
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Vincular este cluster a um tópico do banco com questões</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                      
                      {/* Expanded items */}
                      {expandedClusterId === cluster.study_topic_id && (
                        <div className="px-3 pb-3 border-t">
                          <div className="text-xs font-medium text-muted-foreground mt-2 mb-1">
                            Itens do edital neste cluster:
                          </div>
                          <div className="space-y-1">
                            {cluster.edital_items.map((item, idx) => (
                              <div key={idx} className="text-sm pl-6 py-1 border-l-2 border-muted">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* NEW MAPPING MODE */}
      {viewMode === 'new' && (
        <>
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 text-sm">
            <Badge variant={step === 'input' ? 'default' : 'outline'}>1. Entrada</Badge>
            <ChevronRight className="w-4 h-4" />
            <Badge variant={step === 'verticalize' ? 'default' : 'outline'}>2. Verticalizar</Badge>
            <ChevronRight className="w-4 h-4" />
            <Badge variant={step === 'review' ? 'default' : 'outline'}>3. Mapear</Badge>
            <ChevronRight className="w-4 h-4" />
            <Badge variant={step === 'complete' ? 'default' : 'outline'}>4. Concluído</Badge>
          </div>

      {/* Step 1: Input */}
      {step === 'input' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Mapeamento de Edital com IA
            </CardTitle>
            <CardDescription>
              Cole os tópicos do edital. A IA irá verticalizar e organizar os tópicos antes de mapear para o banco de questões.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Edital Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4" />
                Edital de Destino
              </Label>
              <Select value={selectedEditalId} onValueChange={setSelectedEditalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um edital" />
                </SelectTrigger>
                <SelectContent>
                  {editals.map(edital => (
                    <SelectItem key={edital.id} value={edital.id}>
                      {edital.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nome da Nova Disciplina (Caderno de Questões)</Label>
              <Input
                value={newDisciplineName}
                onChange={(e) => setNewDisciplineName(e.target.value)}
                placeholder="Ex: Legislação Educacional"
              />
              <p className="text-xs text-muted-foreground">
                Este será o novo caderno criado, contendo os tópicos do edital como subtópicos
              </p>
            </div>

            <div className="space-y-2">
              <Label>Disciplinas Fonte (do banco atual)</Label>
              <div className="flex flex-col gap-2 p-4 border rounded-lg max-h-60 overflow-y-auto">
                {[...disciplines].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(d => (
                  <div key={d.id} className="flex items-center gap-2">
                    <Checkbox
                      id={d.id}
                      checked={selectedDisciplines.includes(d.id)}
                      onCheckedChange={(checked) => {
                        setSelectedDisciplines(prev => 
                          checked 
                            ? [...prev, d.id]
                            : prev.filter(id => id !== d.id)
                        );
                      }}
                    />
                    <label htmlFor={d.id} className="text-sm cursor-pointer">
                      {d.name}
                    </label>
                  </div>
                ))}
              </div>
              {selectedDisciplines.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {bankTopics.length} tópicos disponíveis para mapeamento
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tópicos do Edital</Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className="flex-1"
                />
              </div>
              <Textarea
                value={editalText}
                onChange={(e) => setEditalText(e.target.value)}
                placeholder="Cole os tópicos do edital aqui (um por linha) ou faça upload de um arquivo .txt"
                rows={10}
              />
              {editalText && (
                <p className="text-xs text-muted-foreground">
                  {editalText.split('\n').filter(l => l.trim()).length} linhas identificadas
                </p>
              )}
            </div>

            {/* AI Configuration Section - Editable */}
            <Collapsible open={showAIConfig} onOpenChange={setShowAIConfig}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto border rounded-lg">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Settings2 className="w-4 h-4" />
                    Configurações de IA (Editável)
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showAIConfig ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-6">
                {/* Verticalization Config */}
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-primary" />
                      <Label className="font-semibold">Etapa 1: Verticalização</Label>
                    </div>
                    {editingConfig?.id === 'verticalization' ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingConfig(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                        <Button size="sm" onClick={() => saveAIConfig(editingConfig)} disabled={savingConfig}>
                          {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setEditingConfig(getAIConfig('verticalization') || null)}>
                        <Edit2 className="w-4 h-4 mr-1" /> Editar
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Modelo de IA</Label>
                    <Select 
                      value={editingConfig?.id === 'verticalization' ? editingConfig.model : (getAIConfig('verticalization')?.model || 'google/gemini-3-flash-preview')}
                      onValueChange={(value) => {
                        if (editingConfig?.id === 'verticalization') {
                          setEditingConfig({ ...editingConfig, model: value });
                        }
                      }}
                      disabled={editingConfig?.id !== 'verticalization'}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_MODELS.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Prompt do Sistema</Label>
                    <Textarea 
                      value={editingConfig?.id === 'verticalization' ? editingConfig.system_prompt : (getAIConfig('verticalization')?.system_prompt || '')}
                      onChange={(e) => {
                        if (editingConfig?.id === 'verticalization') {
                          setEditingConfig({ ...editingConfig, system_prompt: e.target.value });
                        }
                      }}
                      readOnly={editingConfig?.id !== 'verticalization'}
                      className="text-xs bg-background h-40 font-mono"
                    />
                  </div>
                </div>

                {/* Mapping Config */}
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-primary" />
                      <Label className="font-semibold">Etapa 2: Mapeamento</Label>
                    </div>
                    {editingConfig?.id === 'mapping' ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingConfig(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                        <Button size="sm" onClick={() => saveAIConfig(editingConfig)} disabled={savingConfig}>
                          {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setEditingConfig(getAIConfig('mapping') || null)}>
                        <Edit2 className="w-4 h-4 mr-1" /> Editar
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Modelo de IA</Label>
                    <Select 
                      value={editingConfig?.id === 'mapping' ? editingConfig.model : (getAIConfig('mapping')?.model || 'google/gemini-3-flash-preview')}
                      onValueChange={(value) => {
                        if (editingConfig?.id === 'mapping') {
                          setEditingConfig({ ...editingConfig, model: value });
                        }
                      }}
                      disabled={editingConfig?.id !== 'mapping'}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_MODELS.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Prompt do Sistema</Label>
                    <Textarea 
                      value={editingConfig?.id === 'mapping' ? editingConfig.system_prompt : (getAIConfig('mapping')?.system_prompt || '')}
                      onChange={(e) => {
                        if (editingConfig?.id === 'mapping') {
                          setEditingConfig({ ...editingConfig, system_prompt: e.target.value });
                        }
                      }}
                      readOnly={editingConfig?.id !== 'mapping'}
                      className="text-xs bg-background h-40 font-mono"
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  💡 Clique em "Editar" para modificar prompts e modelos. Alterações são salvas no banco de dados.
                </p>
              </CollapsibleContent>
            </Collapsible>

            <Button 
              onClick={verticalizeTopics} 
              disabled={processing}
              className="w-full"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verticalizando com IA...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Verticalizar Tópicos com IA
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Verticalize Preview */}
      {step === 'verticalize' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5" />
              Prévia dos Tópicos Verticalizados
            </CardTitle>
            <CardDescription>
              {verticalizationSummary || 'Revise, edite ou exclua os tópicos antes de prosseguir com o mapeamento.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <Badge variant="outline">{verticalizedTopics.length} tópicos</Badge>
              <Button variant="outline" size="sm" onClick={addNewTopic}>
                + Adicionar tópico
              </Button>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {verticalizedTopics.map((topic, index) => (
                  <div 
                    key={index} 
                    className="flex items-center gap-2 p-3 border rounded-lg hover:bg-muted/50 group"
                  >
                    {editingIndex === index ? (
                      <>
                        <Input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditing();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                        />
                        <Button size="sm" variant="ghost" onClick={saveEditing}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEditing}>
                          ✕
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{topic.name}</p>
                          {topic.suggestion_reason && (
                            <p className="text-xs text-muted-foreground">{topic.suggestion_reason}</p>
                          )}
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => startEditing(index)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                          onClick={() => removeTopic(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('input')} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button 
                onClick={processMapping} 
                disabled={processing || verticalizedTopics.length === 0}
                className="flex-1"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Mapeando...
                  </>
                ) : (
                  <>
                    Mapear Tópicos
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review Clusters */}
      {step === 'review' && (
        <TooltipProvider>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Revisar Agrupamentos (Clusters)
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p>Arraste itens entre clusters ou clique para selecionar e mover. Use o modo "Mesclar" para combinar clusters.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>
                {clusterSummary || 'Arraste os itens entre clusters ou use os botões para reorganizar.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Warnings */}
              {clustersWithoutBankTopic.length > 0 && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {clustersWithoutBankTopic.length} cluster(s) sem tópico do banco vinculado — serão salvos SEM QUESTÕES!
                  </AlertDescription>
                </Alert>
              )}

              <div className="mb-4 flex gap-2 flex-wrap items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">{confirmedClusters.length} clusters cobertos</Badge>
                  <Badge variant="outline">{confirmedClusters.reduce((acc, c) => acc + c.edital_items.length, 0)} tópicos mapeados</Badge>
                  {uncoveredClusters.length > 0 && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                      {uncoveredClusters.length} cluster(s) não coberto(s)
                    </Badge>
                  )}
                  {uncoveredTopics.length > 0 && (
                    <Badge variant="destructive">{uncoveredTopics.length} avulso(s)</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {mergeMode ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => { setMergeMode(false); setSelectedClustersForMerge([]); }}>
                        <X className="w-4 h-4 mr-1" />
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={mergeClusters} disabled={selectedClustersForMerge.length < 2}>
                        <Merge className="w-4 h-4 mr-1" />
                        Mesclar ({selectedClustersForMerge.length})
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setMergeMode(true)}>
                        <Merge className="w-4 h-4 mr-1" />
                        Mesclar Clusters
                      </Button>
                      <Button variant="outline" size="sm" onClick={createNewCluster}>
                        <Plus className="w-4 h-4 mr-1" />
                        Novo Cluster
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {draggedItem && (
                <div className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-lg flex items-center gap-2">
                  <MoveHorizontal className="w-4 h-4 text-primary" />
                  <span className="text-sm flex-1">
                    Arrastando: <strong>"{draggedItem.item}"</strong> — solte em um cluster
                  </span>
                </div>
              )}

              <ScrollArea className="h-[450px] pr-4">
                <div className="space-y-4">
                  {confirmedClusters.map((cluster, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 border rounded-lg space-y-3 transition-colors ${
                        mergeMode 
                          ? selectedClustersForMerge.includes(idx) 
                            ? 'bg-primary/10 border-primary' 
                            : 'hover:bg-muted/50 cursor-pointer'
                          : 'bg-muted/30'
                      } ${cluster.bank_topic_ids.length === 0 && cluster.edital_items.length > 0 ? 'border-orange-400' : ''}`}
                      onClick={() => mergeMode && toggleClusterForMerge(idx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnCluster(e, idx)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            {mergeMode && (
                              <Checkbox 
                                checked={selectedClustersForMerge.includes(idx)}
                                onCheckedChange={() => toggleClusterForMerge(idx)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                            <Input
                              value={cluster.cluster_name}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateClusterName(idx, e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="font-semibold text-primary h-8 border-dashed"
                              placeholder="Nome do cluster"
                            />
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <Button variant="ghost" size="sm" className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <Brain className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              </HoverCardTrigger>
                              <HoverCardContent side="top" className="w-80">
                                <div className="space-y-2">
                                  <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <Brain className="w-4 h-4" />
                                    Reasoning da IA
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {cluster.reasoning || 'Nenhuma explicação disponível.'}
                                  </p>
                                  <div className="pt-2 border-t">
                                    <p className="text-xs text-muted-foreground">
                                      Confiança: {Math.round(cluster.confidence * 100)}%
                                    </p>
                                  </div>
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          </div>
                          
                          <div onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {cluster.bank_topic_ids.map(topicId => {
                                const t = bankTopics.find(bt => bt.id === topicId);
                                return (
                                  <Badge key={topicId} variant="secondary" className="text-xs flex items-center gap-1">
                                    {t ? `${t.discipline_name}: ${t.name}` : topicId.substring(0, 8)}
                                    <button onClick={(e) => { e.stopPropagation(); removeBankTopicFromCluster(idx, topicId); }}>
                                      <X className="w-3 h-3" />
                                    </button>
                                  </Badge>
                                );
                              })}
                            </div>
                            <Select
                              value=""
                              onValueChange={(value) => addBankTopicToCluster(idx, value)}
                            >
                              <SelectTrigger className={`h-8 text-xs ${cluster.bank_topic_ids.length === 0 ? 'border-orange-400 text-orange-600' : ''}`}>
                                <SelectValue placeholder={cluster.bank_topic_ids.length === 0 ? '⚠️ Vincular caderno do banco...' : '+ Adicionar caderno...'} />
                              </SelectTrigger>
                              <SelectContent>
                                {bankTopics
                                  .filter(t => !cluster.bank_topic_ids.includes(t.id))
                                  .map(t => (
                                    <SelectItem key={t.id} value={t.id} className="text-xs">
                                      {t.discipline_name}: {t.name} ({t.question_count}q)
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            {cluster.total_questoes > 0 && (
                              <span className="text-xs text-muted-foreground">{cluster.total_questoes} questões no total</span>
                            )}
                          </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Badge variant={cluster.confidence >= 0.7 ? 'default' : 'secondary'}>
                            {Math.round(cluster.confidence * 100)}%
                          </Badge>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteCluster(idx);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir cluster (itens vão para "não cobertos")</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                        {cluster.edital_items.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">Arraste itens para este cluster</p>
                        )}
                        {cluster.edital_items.map((item, itemIdx) => (
                          <Badge 
                            key={itemIdx} 
                            variant="outline"
                            className="text-xs cursor-grab active:cursor-grabbing hover:bg-primary/10 flex items-center gap-1"
                            draggable
                            onDragStart={(e) => handleDragStart(e, item, idx, false)}
                          >
                            <GripVertical className="w-3 h-3 text-muted-foreground" />
                            {item}
                            <button 
                              className="ml-1 hover:text-destructive"
                              onClick={() => removeEditalItemFromCluster(item, idx)}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Uncovered Clusters Section */}
                  {uncoveredClusters.length > 0 && (
                    <div className="space-y-4 mt-6">
                      <div className="flex items-center gap-2 py-2 border-t pt-4">
                        <Badge variant="destructive" className="text-sm">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {uncoveredClusters.length} Cluster(s) Não Coberto(s)
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({uncoveredClusters.reduce((acc, c) => acc + c.edital_items.length, 0)} tópicos)
                        </span>
                      </div>

                      {uncoveredClusters.map((cluster, idx) => (
                        <div 
                          key={`uncovered-${idx}`} 
                          className="p-4 border border-orange-400/50 rounded-lg space-y-3 bg-orange-50/50 dark:bg-orange-950/20"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-orange-600 dark:text-orange-400">
                                  {cluster.cluster_name}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {cluster.edital_items.length} itens
                                </Badge>
                                <HoverCard>
                                  <HoverCardTrigger asChild>
                                    <Button variant="ghost" size="sm" className="shrink-0">
                                      <Brain className="w-4 h-4 text-muted-foreground" />
                                    </Button>
                                  </HoverCardTrigger>
                                  <HoverCardContent side="top" className="w-80">
                                    <div className="space-y-2">
                                      <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <Brain className="w-4 h-4" />
                                        Por que foram agrupados
                                      </h4>
                                      <p className="text-sm text-muted-foreground">
                                        {cluster.reasoning || 'Nenhuma explicação disponível.'}
                                      </p>
                                      {cluster.suggested_disciplines && cluster.suggested_disciplines.length > 0 && (
                                        <div className="pt-2 border-t">
                                          <p className="text-xs font-medium mb-1">Disciplinas sugeridas:</p>
                                          <div className="flex flex-wrap gap-1">
                                            {cluster.suggested_disciplines.map((d, i) => (
                                              <Badge key={i} variant="secondary" className="text-xs">{d}</Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </HoverCardContent>
                                </HoverCard>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-primary"
                                    onClick={() => {
                                      setMappingUncoveredCluster(idx);
                                      setUncoveredClusterDisciplines([]);
                                      setUncoveredClusterTopics([]);
                                    }}
                                  >
                                    <Search className="w-4 h-4 mr-1" />
                                    Mapear
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Abrir mapeamento específico para este cluster</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => convertUncoveredToConfirmed(idx)}
                                  >
                                    <MapPin className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Mover para clusters cobertos (sem questões)</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => deleteUncoveredCluster(idx)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Excluir cluster (itens vão para lista avulsa)</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-1">
                            {cluster.edital_items.map((item, itemIdx) => (
                              <Badge 
                                key={itemIdx} 
                                variant="outline"
                                className="text-xs bg-orange-100/50 dark:bg-orange-900/30 border-orange-300"
                              >
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Legacy uncovered topics (if any remain) */}
                  {uncoveredTopics.length > 0 && (
                    <div 
                      className="p-4 border border-destructive/30 rounded-lg space-y-3 bg-destructive/5 mt-4"
                      onDragOver={handleDragOver}
                      onDrop={handleDropOnUncovered}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-destructive">Tópicos Avulsos Não Cobertos</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Arraste itens para um cluster ou crie um novo cluster para eles
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {uncoveredTopics.map((item, itemIdx) => (
                          <Badge 
                            key={itemIdx} 
                            variant="destructive"
                            className="text-xs cursor-grab active:cursor-grabbing flex items-center gap-1"
                            draggable
                            onDragStart={(e) => handleDragStart(e, item, -1, true)}
                          >
                            <GripVertical className="w-3 h-3" />
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setStep('verticalize')}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
                <Button 
                  onClick={saveMappings} 
                  disabled={saving || confirmedClusters.every(c => c.edital_items.length === 0)}
                  className="flex-1"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Confirmar e Salvar ({confirmedClusters.filter(c => c.edital_items.length > 0).length} cadernos)
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TooltipProvider>
      )}

      {/* Step 4: Complete */}
      {step === 'complete' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              Mapeamento Concluído!
            </CardTitle>
            <CardDescription>
              Os tópicos do edital foram mapeados e salvos com sucesso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={resetForm} className="w-full">
              Criar Novo Mapeamento
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialog for mapping uncovered clusters */}
      <Dialog 
        open={mappingUncoveredCluster !== null} 
        onOpenChange={(open) => {
          if (!open) {
            setMappingUncoveredCluster(null);
            setUncoveredClusterDisciplines([]);
            setUncoveredClusterTopics([]);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Mapear Cluster Não Coberto
            </DialogTitle>
            <DialogDescription>
              Selecione as disciplinas de onde buscar tópicos para mapear este cluster.
            </DialogDescription>
          </DialogHeader>

          {mappingUncoveredCluster !== null && uncoveredClusters[mappingUncoveredCluster] && (
            <div className="space-y-6">
              {/* Cluster info */}
              <div className="p-4 border rounded-lg bg-orange-50/50 dark:bg-orange-950/20">
                <h4 className="font-semibold text-orange-600 dark:text-orange-400 mb-2">
                  {uncoveredClusters[mappingUncoveredCluster].cluster_name}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {uncoveredClusters[mappingUncoveredCluster].edital_items.map((item, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
                {uncoveredClusters[mappingUncoveredCluster].suggested_disciplines && 
                 uncoveredClusters[mappingUncoveredCluster].suggested_disciplines!.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Sugestões da IA:</p>
                    <p className="text-sm italic">
                      {uncoveredClusters[mappingUncoveredCluster].suggested_disciplines!.join(', ')}
                    </p>
                  </div>
                )}
              </div>

              {/* Discipline selection */}
              <div className="space-y-2">
                <Label>Selecione as disciplinas fonte:</Label>
                <div className="flex flex-col gap-2 p-4 border rounded-lg max-h-48 overflow-y-auto">
                  {[...disciplines].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(d => (
                    <div key={d.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`uncovered-${d.id}`}
                        checked={uncoveredClusterDisciplines.includes(d.id)}
                        onCheckedChange={(checked) => {
                          const newDisciplines = checked 
                            ? [...uncoveredClusterDisciplines, d.id]
                            : uncoveredClusterDisciplines.filter(id => id !== d.id);
                          setUncoveredClusterDisciplines(newDisciplines);
                          loadTopicsForUncoveredMapping(newDisciplines);
                        }}
                      />
                      <label htmlFor={`uncovered-${d.id}`} className="text-sm cursor-pointer">
                        {d.name}
                      </label>
                    </div>
                  ))}
                </div>
                {uncoveredClusterDisciplines.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {uncoveredClusterTopics.length} tópicos disponíveis para mapeamento
                  </p>
                )}
              </div>

              {/* Preview of available topics */}
              {uncoveredClusterTopics.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tópicos disponíveis (preview):</Label>
                  <div className="flex flex-wrap gap-1 p-3 border rounded-lg bg-muted/30 max-h-32 overflow-y-auto">
                    {uncoveredClusterTopics.slice(0, 20).map(t => (
                      <Badge key={t.id} variant="secondary" className="text-xs">
                        {t.name}
                      </Badge>
                    ))}
                    {uncoveredClusterTopics.length > 20 && (
                      <Badge variant="outline" className="text-xs">
                        +{uncoveredClusterTopics.length - 20} mais...
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setMappingUncoveredCluster(null);
                    setUncoveredClusterDisciplines([]);
                    setUncoveredClusterTopics([]);
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={() => mapUncoveredCluster(mappingUncoveredCluster)}
                  disabled={processingUncovered || uncoveredClusterDisciplines.length === 0 || uncoveredClusterTopics.length === 0}
                  className="flex-1"
                >
                  {processingUncovered ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Mapeando...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Mapear com IA
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog for mapping existing topic */}
      <Dialog open={mappingExistingTopic !== null} onOpenChange={(open) => {
        if (!open) {
          setMappingExistingTopic(null);
          setExistingMappingDisciplines([]);
          setExistingMappingTopics([]);
        }
      }}>
        <DialogContent className="max-w-2xl">
          {mappingExistingTopic && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Mapear Tópico do Edital
                </DialogTitle>
                <DialogDescription>
                  Vincule "{mappingExistingTopic.edital_topic_name}" a um tópico do banco de questões
                </DialogDescription>
              </DialogHeader>

              {/* Current info */}
              <Alert>
                <AlertDescription>
                  <strong>Edital:</strong> {mappingExistingTopic.school_name}<br />
                  <strong>Tópico:</strong> {mappingExistingTopic.edital_topic_name}<br />
                  {mappingExistingTopic.study_topic_name && (
                    <>
                      <strong>Vínculo atual:</strong> {mappingExistingTopic.discipline_name}: {mappingExistingTopic.study_topic_name} ({mappingExistingTopic.question_count} questões)
                    </>
                  )}
                </AlertDescription>
              </Alert>

              {/* Select disciplines */}
              <div className="space-y-2">
                <Label>Selecione disciplinas para buscar tópicos:</Label>
                <div className="flex flex-col gap-2 p-3 border rounded-lg max-h-40 overflow-y-auto">
                  {[...disciplines].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(d => (
                    <div key={d.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`existing-${d.id}`}
                        checked={existingMappingDisciplines.includes(d.id)}
                        onCheckedChange={(checked) => {
                          const newDisciplines = checked 
                            ? [...existingMappingDisciplines, d.id]
                            : existingMappingDisciplines.filter(id => id !== d.id);
                          setExistingMappingDisciplines(newDisciplines);
                          loadTopicsForExistingMapping(newDisciplines);
                        }}
                      />
                      <label htmlFor={`existing-${d.id}`} className="text-sm cursor-pointer">
                        {d.name}
                      </label>
                    </div>
                  ))}
                </div>
                {existingMappingDisciplines.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {existingMappingTopics.length} tópicos disponíveis
                  </p>
                )}
              </div>

              {/* Select topic to map */}
              {existingMappingTopics.length > 0 && (
                <div className="space-y-2">
                  <Label>Selecione o tópico do banco:</Label>
                  <ScrollArea className="h-[200px] border rounded-lg p-2">
                    <div className="space-y-1">
                      {existingMappingTopics.map(t => (
                        <Button
                          key={t.id}
                          variant="ghost"
                          className="w-full justify-start text-left h-auto py-2"
                          onClick={() => mapExistingTopicToBank(mappingExistingTopic, t.id)}
                          disabled={processingExistingMapping}
                        >
                          <div>
                            <span className="font-medium">{t.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">({t.discipline_name})</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Close button */}
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setMappingExistingTopic(null);
                    setExistingMappingDisciplines([]);
                    setExistingMappingTopics([]);
                  }}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
        </>
      )}

      {/* Dialog for remapping existing cluster with AI - MOVED OUTSIDE viewMode check */}
      <Dialog open={!!mappingExistingCluster} onOpenChange={(open) => {
        if (!open) {
          setMappingExistingCluster(null);
          setExistingMappingDisciplines([]);
          setExistingMappingTopics([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {mappingExistingCluster && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5" />
                  Remapear Cluster com IA
                </DialogTitle>
                <DialogDescription>
                  Selecione as disciplinas de onde a IA buscará tópicos para mapear este cluster.
                </DialogDescription>
              </DialogHeader>

              {/* Cluster info */}
              <div className="p-4 border rounded-lg bg-orange-50/50 dark:bg-orange-950/20">
                <h4 className="font-semibold text-orange-600 dark:text-orange-400 mb-2">
                  {mappingExistingCluster.study_topic_name}
                </h4>
                <div className="text-sm text-muted-foreground space-y-1 mb-3">
                  <p><strong>Edital:</strong> {mappingExistingCluster.school_name}</p>
                  <p><strong>Questões atuais:</strong> {mappingExistingCluster.question_count}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {mappingExistingCluster.edital_items.map((item, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Discipline selection */}
              <div className="space-y-2">
                <Label>Selecione as disciplinas fonte:</Label>
                <div className="flex flex-col gap-2 p-4 border rounded-lg max-h-48 overflow-y-auto">
                  {[...disciplines].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(d => (
                    <div key={d.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`remap-cluster-${d.id}`}
                        checked={existingMappingDisciplines.includes(d.id)}
                        onCheckedChange={(checked) => {
                          const newDisciplines = checked 
                            ? [...existingMappingDisciplines, d.id]
                            : existingMappingDisciplines.filter(id => id !== d.id);
                          setExistingMappingDisciplines(newDisciplines);
                          loadTopicsForExistingMapping(newDisciplines);
                        }}
                      />
                      <label htmlFor={`remap-cluster-${d.id}`} className="text-sm cursor-pointer">{d.name}</label>
                    </div>
                  ))}
                </div>
                {existingMappingDisciplines.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {existingMappingTopics.length} tópicos disponíveis para mapeamento
                  </p>
                )}
              </div>

              {/* Preview of available topics */}
              {existingMappingTopics.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tópicos disponíveis (preview):</Label>
                  <div className="flex flex-wrap gap-1 p-3 border rounded-lg bg-muted/30 max-h-32 overflow-y-auto">
                    {existingMappingTopics.slice(0, 20).map(t => (
                      <Badge key={t.id} variant="secondary" className="text-xs">
                        {t.name}
                      </Badge>
                    ))}
                    {existingMappingTopics.length > 20 && (
                      <Badge variant="outline" className="text-xs">
                        +{existingMappingTopics.length - 20} mais...
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setMappingExistingCluster(null);
                    setExistingMappingDisciplines([]);
                    setExistingMappingTopics([]);
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={remapExistingClusterWithAI}
                  disabled={processingExistingMapping || existingMappingDisciplines.length === 0 || existingMappingTopics.length === 0}
                  className="flex-1"
                >
                  {processingExistingMapping ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Remapeando...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Remapear com IA
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}