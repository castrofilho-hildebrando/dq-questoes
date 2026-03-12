import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  FileQuestion,
  Loader2,
  Search,
  Pencil,
  Trash2,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Trash,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeHTML } from '@/hooks/useSanitizedHTML';
import { EditalSchoolFilter } from './EditalFilter';
import { QuestionTableSkeleton } from '@/components/questions/QuestionSkeleton';

interface Question {
  id: string;
  code: string;
  question: string;
  answer: string;
  prof_comment: string | null;
  question_type: string | null;
  year: number | null;
  difficulty: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
  is_active: boolean;
  created_at: string;
  study_discipline_id: string | null;
  study_topic_id: string | null;
  banca_id: string | null;
  orgao_id: string | null;
  prova_id: string | null;
  // Joined data
  discipline_name?: string;
  topic_name?: string;
  banca_name?: string;
  orgao_name?: string;
  prova_name?: string;
}

interface FilterOption {
  id: string;
  name: string;
}

interface AdminQuestoesProps {
  initialSearch?: string;
}

export function AdminQuestoes({ initialSearch = '' }: AdminQuestoesProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [filterEditalId, setFilterEditalId] = useState('');
  const [filterEdital, setFilterEdital] = useState(''); // This is the school ID
  const [editalDisciplineIds, setEditalDisciplineIds] = useState<string[]>([]);
  const [editalLoading, setEditalLoading] = useState(false); // Track if edital disciplines are loading
  const [disciplines, setDisciplines] = useState<FilterOption[]>([]);
  const [topics, setTopics] = useState<FilterOption[]>([]);
  const [bancas, setBancas] = useState<FilterOption[]>([]);
  const [orgaos, setOrgaos] = useState<FilterOption[]>([]);
  const [filterDiscipline, setFilterDiscipline] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [filterBanca, setFilterBanca] = useState('');
  const [filterOrgao, setFilterOrgao] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterType, setFilterType] = useState('');

  // Selection - store all IDs to allow cross-page selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [allFilteredIds, setAllFilteredIds] = useState<string[]>([]);

  // Prevent stale async responses from overwriting the latest filters
  const fetchSeqRef = useRef(0);
  const allIdsSeqRef = useRef(0);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [saving, setSaving] = useState(false);

  // Preview dialog
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);

  // Batch delete dialog
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Auto-search when initialSearch is provided and auto-open edit dialog
  useEffect(() => {
    if (initialSearch) {
      // First fetch the questions
      const fetchAndOpenEdit = async () => {
        setLoading(true);
        try {
          // Search for the specific question by code
          const { data, error } = await supabase
            .from('questions')
            .select(`
              *,
              study_disciplines(name),
              study_topics(name),
              bancas(name),
              orgaos(name),
              provas(name)
            `)
            .or(`code.ilike.%${initialSearch}%`)
            .limit(1);

          if (error) throw error;

          if (data && data.length > 0) {
            const q = data[0];
            const mapped: Question = {
              ...q,
              discipline_name: (q.study_disciplines as any)?.name,
              topic_name: (q.study_topics as any)?.name,
              banca_name: (q.bancas as any)?.name,
              orgao_name: (q.orgaos as any)?.name,
              prova_name: (q.provas as any)?.name,
            };
            // Auto-open the edit dialog
            setEditingQuestion(mapped);
            setEditDialogOpen(true);
          }
        } catch (error) {
          console.error('Error fetching question for edit:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchAndOpenEdit();
      fetchAllFilteredIds();
    }
  }, [initialSearch]);

  // Fetch questions when filters change.
  // NOTE: computing "select all across pages" IDs is expensive, so we only do it on-demand.
  useEffect(() => {
    const hasScopedSelection =
      (filterEditalId && filterEditalId !== 'all') || (filterEdital && filterEdital !== 'all');

    // Skip fetch if edital/escola is selected but discipline IDs haven't loaded yet
    if (hasScopedSelection && editalLoading) return;

    fetchQuestions();

    if (selectAllPages) {
      fetchAllFilteredIds();
    } else {
      // Keep this lightweight; full ID list is only needed for bulk actions.
      setAllFilteredIds([]);
    }
  }, [
    currentPage,
    pageSize,
    editalDisciplineIds,
    filterDiscipline,
    filterTopic,
    filterBanca,
    filterOrgao,
    filterYear,
    filterType,
    searchQuery,
    filterEditalId,
    filterEdital,
    editalLoading,
    selectAllPages,
  ]);

  // Reset everything when edital or escola changes
  useEffect(() => {
    // Invalidate any in-flight requests from previous selections
    fetchSeqRef.current += 1;
    allIdsSeqRef.current += 1;

    // Reset filters and clear data when edital/escola changes
    setFilterDiscipline('');
    setFilterTopic('');
    setTopics([]);
    setQuestions([]);
    setTotalCount(0);
    setSelectedIds(new Set());
    setAllFilteredIds([]);
    setSelectAllPages(false);

    setEditalDisciplineIds([]);

    const hasScopedSelection =
      (filterEditalId && filterEditalId !== 'all') || (filterEdital && filterEdital !== 'all');
    setEditalLoading(hasScopedSelection);

    fetchFilterOptions();
  }, [filterEditalId, filterEdital]);

  useEffect(() => {
    // Fetch topics when discipline changes
    // IMPORTANT: clear topic selection to avoid stale topic filtering from previous discipline
    setFilterTopic('');
    setTopics([]);

    if (filterDiscipline) {
      fetchTopics(filterDiscipline);
    }
  }, [filterDiscipline]);

  const fetchFilterOptions = async () => {
    // If a school is selected, filter disciplines by school_disciplines.
    // If only an edital is selected ("todas as escolas"), filter disciplines by edital_disciplines
    // (plus a compatibility fallback via schools->school_disciplines).
    let disciplinesData: FilterOption[] = [];
    let linkedDisciplineIds: string[] = [];

    const hasSchool = !!(filterEdital && filterEdital !== 'all');
    const hasEdital = !!(filterEditalId && filterEditalId !== 'all');

    try {
      if (hasSchool) {
        const { data: linkedDisciplines, error } = await supabase
          .from('school_disciplines')
          .select('discipline_id')
          .eq('school_id', filterEdital)
          .eq('is_active', true);

        if (error) console.error('Error fetching school disciplines:', error);

        linkedDisciplineIds = (linkedDisciplines || []).map(
          (ld: { discipline_id: string }) => ld.discipline_id
        );
      } else if (hasEdital) {
        const disciplineIdSet = new Set<string>();

        // Preferred: disciplines mapped directly to edital
        const { data: edDisc, error: edDiscError } = await supabase
          .from('edital_disciplines')
          .select('discipline_id')
          .eq('edital_id', filterEditalId)
          .eq('is_active', true);

        if (edDiscError) console.error('Error fetching edital_disciplines:', edDiscError);
        (edDisc || []).forEach((row: { discipline_id: string }) => disciplineIdSet.add(row.discipline_id));

        linkedDisciplineIds = Array.from(disciplineIdSet);
      }

      if (hasSchool || hasEdital) {
        if (linkedDisciplineIds.length > 0) {
          const { data, error } = await supabase
            .from('study_disciplines')
            .select('id, name')
            .eq('is_active', true)
            .in('id', linkedDisciplineIds)
            .order('name');

          if (error) console.error('Error fetching disciplines:', error);
          disciplinesData = data || [];
        } else {
          disciplinesData = [];
        }
      } else {
        // No edital/school filter - get all active disciplines
        const { data, error } = await supabase
          .from('study_disciplines')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (error) console.error('Error fetching disciplines:', error);
        disciplinesData = data || [];
      }

      const [bancasRes, orgaosRes] = await Promise.all([
        supabase.from('bancas').select('id, name').eq('is_active', true).order('name'),
        supabase.from('orgaos').select('id, name').eq('is_active', true).order('name'),
      ]);

      setDisciplines(disciplinesData);
      setBancas(bancasRes.data || []);
      setOrgaos(orgaosRes.data || []);
      setTopics([]);

      setEditalDisciplineIds(linkedDisciplineIds);
    } finally {
      setEditalLoading(false);
    }
  };

  const fetchTopics = async (disciplineId: string) => {
    const { data } = await supabase
      .from('study_topics')
      .select('id, name')
      .eq('study_discipline_id', disciplineId)
      .eq('is_active', true)
      .order('name');
    setTopics(data || []);
  };

  // Helper function to get question IDs from all sources (N:N, direct, notebooks)
  const getQuestionIdsFromDisciplineOrTopic = async (disciplineId?: string, topicId?: string, disciplineIds?: string[]): Promise<string[] | null> => {
    const hasDisciplineFilter = disciplineId || (disciplineIds && disciplineIds.length > 0);
    
    if (!hasDisciplineFilter && !topicId) return null;
    
    const idsSet = new Set<string>();
    
    // Helpers to fetch all IDs without limit (paginating if needed)
    const fetchQuestionTopicIds = async (topicIds: string[]): Promise<string[]> => {
      const allIds: string[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('question_topics')
          .select('question_id')
          .in('study_topic_id', topicIds)
          .range(offset, offset + batchSize - 1);
        
        if (error) { console.error('Error fetching question_topics:', error); break; }
        if (data && data.length > 0) {
          data.forEach(row => allIds.push(row.question_id));
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else { hasMore = false; }
      }
      return allIds;
    };

    const fetchQuestionDisciplineIds = async (discIds: string[]): Promise<string[]> => {
      const allIds: string[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('question_disciplines')
          .select('question_id')
          .in('study_discipline_id', discIds)
          .range(offset, offset + batchSize - 1);
        
        if (error) { console.error('Error fetching question_disciplines:', error); break; }
        if (data && data.length > 0) {
          data.forEach(row => allIds.push(row.question_id));
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else { hasMore = false; }
      }
      return allIds;
    };

    const fetchNotebookQuestionIds = async (notebookIds: string[]): Promise<string[]> => {
      const allIds: string[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('admin_notebook_questions')
          .select('question_id')
          .in('notebook_id', notebookIds)
          .range(offset, offset + batchSize - 1);
        
        if (error) { console.error('Error fetching admin_notebook_questions:', error); break; }
        if (data && data.length > 0) {
          data.forEach(row => allIds.push(row.question_id));
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else { hasMore = false; }
      }
      return allIds;
    };
    
    // Helper to fetch all question IDs from questions table by topic
    const fetchDirectQuestionsByTopic = async (topicIds: string[]): Promise<string[]> => {
      const allIds: string[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('questions')
          .select('id')
          .in('study_topic_id', topicIds)
          .eq('is_active', true)
          .range(offset, offset + batchSize - 1);
        
        if (error) { console.error('Error fetching questions by topic:', error); break; }
        if (data && data.length > 0) {
          data.forEach(q => allIds.push(q.id));
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else { hasMore = false; }
      }
      return allIds;
    };

    // Helper to fetch all question IDs from questions table by discipline
    const fetchDirectQuestionsByDiscipline = async (discIds: string[]): Promise<string[]> => {
      const allIds: string[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('questions')
          .select('id')
          .in('study_discipline_id', discIds)
          .eq('is_active', true)
          .range(offset, offset + batchSize - 1);
        
        if (error) { console.error('Error fetching questions by discipline:', error); break; }
        if (data && data.length > 0) {
          data.forEach(q => allIds.push(q.id));
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else { hasMore = false; }
      }
      return allIds;
    };
    
    if (topicId) {
      // Get questions from N:N table - no limit
      const topicLinks = await fetchQuestionTopicIds([topicId]);
      topicLinks.forEach(id => idsSet.add(id));
      
      // Get questions with direct topic_id - no limit
      const directTopic = await fetchDirectQuestionsByTopic([topicId]);
      directTopic.forEach(id => idsSet.add(id));
      
      // Get questions from admin_notebook_questions via source_notebook_id
      const { data: topicNotebooks } = await supabase
        .from('study_topics')
        .select('source_notebook_id')
        .eq('id', topicId)
        .not('source_notebook_id', 'is', null);
      
      if (topicNotebooks && topicNotebooks.length > 0) {
        const notebookIds = topicNotebooks.map(t => t.source_notebook_id).filter(Boolean) as string[];
        if (notebookIds.length > 0) {
          const notebookQuestions = await fetchNotebookQuestionIds(notebookIds);
          notebookQuestions.forEach(id => idsSet.add(id));
        }
      }
    } else if (hasDisciplineFilter) {
      const discIds = disciplineId ? [disciplineId] : disciplineIds!;
      
      // Get questions from N:N discipline table - no limit
      const disciplineLinks = await fetchQuestionDisciplineIds(discIds);
      disciplineLinks.forEach(id => idsSet.add(id));
      
      // Get questions with direct discipline_id - no limit
      const directDiscipline = await fetchDirectQuestionsByDiscipline(discIds);
      directDiscipline.forEach(id => idsSet.add(id));
      
      // Get questions from admin_notebook_questions via folder
      const { data: disciplineFolders } = await supabase
        .from('study_disciplines')
        .select('source_notebook_folder_id')
        .in('id', discIds)
        .not('source_notebook_folder_id', 'is', null);
      
      if (disciplineFolders && disciplineFolders.length > 0) {
        const folderIds = disciplineFolders.map(d => d.source_notebook_folder_id).filter(Boolean) as string[];
        if (folderIds.length > 0) {
          const { data: folderNotebooks } = await supabase
            .from('admin_question_notebooks')
            .select('id')
            .in('folder_id', folderIds);
          
          if (folderNotebooks && folderNotebooks.length > 0) {
            const notebookIds = folderNotebooks.map(n => n.id);
            const notebookQuestions = await fetchNotebookQuestionIds(notebookIds);
            notebookQuestions.forEach(id => idsSet.add(id));
          }
        }
      }
    }
    
    return Array.from(idsSet);
  };

  // Fetch all IDs matching current filters (for select all across pages)
  // Uses unified logic: N:N tables + direct fields + notebooks
  const fetchAllFilteredIds = async () => {
    const hasScopedSelection =
      (filterEditalId && filterEditalId !== 'all') || (filterEdital && filterEdital !== 'all');

    // Don't fetch if edital/escola is selected but disciplines aren't loaded yet
    if (hasScopedSelection && editalLoading) {
      return;
    }

    const seq = ++allIdsSeqRef.current;

    try {
      let allIds: string[] = [];

      // Use unified logic when discipline/topic/edital filters are active
      if (filterTopic || filterDiscipline || (filterEdital && filterEdital !== 'all' && editalDisciplineIds.length > 0)) {
        let unifiedIds: string[] | null = null;
        
        if (filterTopic) {
          unifiedIds = await getQuestionIdsFromDisciplineOrTopic(undefined, filterTopic);
        } else if (filterDiscipline) {
          unifiedIds = await getQuestionIdsFromDisciplineOrTopic(filterDiscipline);
        } else if (editalDisciplineIds.length > 0) {
          unifiedIds = await getQuestionIdsFromDisciplineOrTopic(undefined, undefined, editalDisciplineIds);
        }
        
        allIds = unifiedIds || [];
      } else {
        // No discipline/topic filter - get all question IDs
        const { data, error } = await supabase.from('questions').select('id');
        if (error) throw error;
        allIds = (data || []).map((q: any) => q.id);
      }

      // Apply additional filters (banca, orgao, year, type, search) by fetching matching IDs
      if (allIds.length > 0 && (filterBanca || filterOrgao || filterYear || filterType || searchQuery.trim())) {
        let query = supabase.from('questions').select('id').in('id', allIds);
        
        if (filterBanca) query = query.eq('banca_id', filterBanca);
        if (filterOrgao) query = query.eq('orgao_id', filterOrgao);
        if (filterYear) query = query.eq('year', parseInt(filterYear));
        if (filterType) query = query.eq('question_type', filterType);
        if (searchQuery.trim()) {
          query = query.or(`question.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%`);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        allIds = (data || []).map((q: any) => q.id);
      }

      if (seq !== allIdsSeqRef.current) return;
      setAllFilteredIds(allIds);
    } catch (error) {
      if (seq !== allIdsSeqRef.current) return;
      console.error('Error fetching all filtered IDs:', error);
    }
  };

  const fetchQuestions = async () => {
    const hasScopedSelection =
      (filterEditalId && filterEditalId !== 'all') || (filterEdital && filterEdital !== 'all');

    // Don't fetch if edital/escola is selected but disciplines aren't loaded yet
    if (hasScopedSelection && editalLoading) {
      return;
    }

    const seq = ++fetchSeqRef.current;
    setLoading(true);

    try {
      // Use unified logic: get question IDs from N:N tables + direct fields + notebooks
      let questionIdsFromUnified: string[] | null = null;

      // Apply unified logic when discipline, topic OR edital/school (via editalDisciplineIds) filters are active
      if (filterTopic || filterDiscipline || editalDisciplineIds.length > 0) {
        if (filterTopic) {
          questionIdsFromUnified = await getQuestionIdsFromDisciplineOrTopic(undefined, filterTopic);
        } else if (filterDiscipline) {
          questionIdsFromUnified = await getQuestionIdsFromDisciplineOrTopic(filterDiscipline);
        } else if (editalDisciplineIds.length > 0) {
          questionIdsFromUnified = await getQuestionIdsFromDisciplineOrTopic(undefined, undefined, editalDisciplineIds);
        }

        // If no questions found from unified search, return empty
        if (questionIdsFromUnified && questionIdsFromUnified.length === 0) {
          if (seq === fetchSeqRef.current) {
            setQuestions([]);
            setTotalCount(0);
            setLoading(false);
          }
          return;
        }
      }

      let query = supabase
        .from('questions')
        .select(
          `
          *,
          study_disciplines(name),
          study_topics(name),
          bancas(name),
          orgaos(name),
          provas(name)
        `,
          { count: 'exact' }
        );

      // Apply unified question IDs filter if we have them
      if (questionIdsFromUnified !== null && questionIdsFromUnified.length > 0) {
        // For large sets, we need to paginate the IDs first
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;
        
        // Store total count before slicing
        const totalFromUnified = questionIdsFromUnified.length;
        
        // Sort for consistent pagination and slice
        questionIdsFromUnified.sort();
        const pageIds = questionIdsFromUnified.slice(from, Math.min(to + 1, questionIdsFromUnified.length));
        
        if (pageIds.length === 0) {
          if (seq === fetchSeqRef.current) {
            setQuestions([]);
            setTotalCount(totalFromUnified);
            setLoading(false);
          }
          return;
        }
        
        query = query.in('id', pageIds);

        // Apply other filters
        if (filterBanca) query = query.eq('banca_id', filterBanca);
        if (filterOrgao) query = query.eq('orgao_id', filterOrgao);
        if (filterYear) query = query.eq('year', parseInt(filterYear));
        if (filterType) query = query.eq('question_type', filterType);
        if (searchQuery.trim()) {
          query = query.or(`question.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%`);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        if (seq !== fetchSeqRef.current) return;

        const mapped = (data || []).map((q: any) => ({
          ...q,
          discipline_name: (q.study_disciplines as any)?.name,
          topic_name: (q.study_topics as any)?.name,
          banca_name: (q.bancas as any)?.name,
          orgao_name: (q.orgaos as any)?.name,
          prova_name: (q.provas as any)?.name,
        }));

        setQuestions(mapped);
        setTotalCount(totalFromUnified);
      } else {
        // No discipline/topic filter - use normal query with pagination
        if (filterBanca) query = query.eq('banca_id', filterBanca);
        if (filterOrgao) query = query.eq('orgao_id', filterOrgao);
        if (filterYear) query = query.eq('year', parseInt(filterYear));
        if (filterType) query = query.eq('question_type', filterType);
        if (searchQuery.trim()) {
          query = query.or(`question.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%`);
        }

        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error, count } = await query
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;
        if (seq !== fetchSeqRef.current) return;

        const mapped = (data || []).map((q: any) => ({
          ...q,
          discipline_name: (q.study_disciplines as any)?.name,
          topic_name: (q.study_topics as any)?.name,
          banca_name: (q.bancas as any)?.name,
          orgao_name: (q.orgaos as any)?.name,
          prova_name: (q.provas as any)?.name,
        }));

        setQuestions(mapped);
        setTotalCount(count || 0);
      }
    } catch (error) {
      if (seq !== fetchSeqRef.current) return;
      console.error('Error fetching questions:', error);
      toast.error('Erro ao carregar questões');
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchQuestions();
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion({ ...question });
    setEditDialogOpen(true);
  };

  const handlePreview = (question: Question) => {
    setPreviewQuestion(question);
    setPreviewOpen(true);
  };

  const handleDeleteClick = (question: Question) => {
    setQuestionToDelete(question);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!questionToDelete) return;
    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionToDelete.id);

      if (error) throw error;

      toast.success('Questão excluída');
      setDeleteDialogOpen(false);
      setQuestionToDelete(null);
      fetchQuestions();
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Erro ao excluir questão');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast.success(`${selectedIds.size} questões excluídas`);
      setBatchDeleteDialogOpen(false);
      setSelectedIds(new Set());
      setSelectAllPages(false);
      fetchQuestions();
      fetchAllFilteredIds();
    } catch (error) {
      console.error('Error batch deleting questions:', error);
      toast.error('Erro ao excluir questões');
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!editingQuestion) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('questions')
        .update({
          question: editingQuestion.question,
          answer: editingQuestion.answer,
          prof_comment: editingQuestion.prof_comment,
          option_a: editingQuestion.option_a,
          option_b: editingQuestion.option_b,
          option_c: editingQuestion.option_c,
          option_d: editingQuestion.option_d,
          option_e: editingQuestion.option_e,
          difficulty: editingQuestion.difficulty,
          is_active: editingQuestion.is_active,
        })
        .eq('id', editingQuestion.id);

      if (error) throw error;

      toast.success('Questão atualizada');
      setEditDialogOpen(false);
      setEditingQuestion(null);
      fetchQuestions();
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error('Erro ao salvar questão');
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setFilterDiscipline('');
    setFilterTopic('');
    setFilterBanca('');
    setFilterOrgao('');
    setFilterYear('');
    setFilterType('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const toggleSelectAllPages = () => {
    if (selectAllPages) {
      setSelectedIds(new Set());
      setSelectAllPages(false);
      return;
    }

    // Turn on "select all pages". IDs are loaded asynchronously (on-demand).
    setSelectedIds(new Set());
    setSelectAllPages(true);
  };

  const toggleSelectPage = () => {
    const pageIds = questions.map(q => q.id);
    const allPageSelected = pageIds.every(id => selectedIds.has(id));
    const newSelected = new Set(selectedIds);
    
    if (allPageSelected) {
      pageIds.forEach(id => newSelected.delete(id));
    } else {
      pageIds.forEach(id => newSelected.add(id));
    }
    setSelectedIds(newSelected);
    setSelectAllPages(newSelected.size === allFilteredIds.length && allFilteredIds.length > 0);
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
    setSelectAllPages(newSelected.size === allFilteredIds.length && allFilteredIds.length > 0);
  };

  const isPageSelected = questions.length > 0 && questions.every(q => selectedIds.has(q.id));

  const totalPages = Math.ceil(totalCount / pageSize);
  const years = Array.from({ length: 30 }, (_, i) => (new Date().getFullYear() - i).toString());

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileQuestion className="w-5 h-5" />
            Gerenciar Questões
          </CardTitle>
          <CardDescription>
            Visualize, edite e exclua questões importadas{filterEdital && filterEdital !== 'all' ? ' deste edital' : ''} ({totalCount.toLocaleString()} questões{filterEdital && filterEdital !== 'all' ? ' vinculadas' : ''})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código ou texto da questão..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch}>Buscar</Button>
            </div>

            {/* Edital + School Filter */}
            <div className="pb-2 border-b mb-2">
              <EditalSchoolFilter 
                editalValue={filterEditalId}
                schoolValue={filterEdital}
                onEditalChange={(v) => { setFilterEditalId(v === 'all' ? '' : v); setCurrentPage(1); }}
                onSchoolChange={(v) => { setFilterEdital(v === 'all' ? '' : v); setCurrentPage(1); }}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Select value={filterDiscipline} onValueChange={(v) => { const next = v === 'all' ? '' : v; setFilterDiscipline(next); setFilterTopic(''); setTopics([]); setCurrentPage(1); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Disciplina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {disciplines.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterTopic} onValueChange={(v) => { setFilterTopic(v === 'all' ? '' : v); setCurrentPage(1); }} disabled={!filterDiscipline}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Tópico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {topics.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterOrgao} onValueChange={(v) => { setFilterOrgao(v === 'all' ? '' : v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Órgão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {orgaos.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterBanca} onValueChange={(v) => { setFilterBanca(v === 'all' ? '' : v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Banca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {bancas.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterYear} onValueChange={(v) => { setFilterYear(v === 'all' ? '' : v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={(v) => { setFilterType(v === 'all' ? '' : v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="mult">Múltipla Escolha</SelectItem>
                  <SelectItem value="tf">Certo/Errado</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={clearFilters} className="gap-1">
                <X className="h-4 w-4" />
                Limpar
              </Button>
            </div>

            {/* Batch Actions */}
            <div className="flex flex-wrap items-center gap-4 py-2 px-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectAllPages} 
                  onCheckedChange={() => toggleSelectAllPages()}
                  id="select-all-pages"
                />
                <Label htmlFor="select-all-pages" className="text-sm font-medium cursor-pointer">
                  Selecionar tudo ({totalCount.toLocaleString()})
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={isPageSelected} 
                  onCheckedChange={() => toggleSelectPage()}
                  id="select-page"
                />
                <Label htmlFor="select-page" className="text-sm font-medium cursor-pointer">
                  Selecionar página
                </Label>
              </div>
              
              {selectedIds.size > 0 && (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size} selecionada(s)
                  </span>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => setBatchDeleteDialogOpen(true)}
                    className="gap-1"
                  >
                    <Trash className="h-4 w-4" />
                    Excluir Selecionadas
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { setSelectedIds(new Set()); setSelectAllPages(false); }}
                  >
                    Desmarcar Tudo
                  </Button>
                </>
              )}
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <Label className="text-sm">Exibir:</Label>
              <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); }}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">por página</span>
            </div>
          </div>

          {/* Questions Table */}
          {loading ? (
            <QuestionTableSkeleton count={pageSize > 20 ? 15 : 10} />
          ) : questions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma questão encontrada
            </div>
          ) : (
            <>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox 
                          checked={isPageSelected} 
                          onCheckedChange={() => toggleSelectPage()}
                        />
                      </TableHead>
                      <TableHead className="w-[120px]">Código</TableHead>
                      <TableHead>Questão</TableHead>
                      <TableHead className="w-[100px]">Disciplina</TableHead>
                      <TableHead className="w-[100px]">Órgão</TableHead>
                      <TableHead className="w-[80px]">Banca</TableHead>
                      <TableHead className="w-[50px]">Ano</TableHead>
                      <TableHead className="w-[60px]">Tipo</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questions.map((q) => (
                      <TableRow key={q.id} className={selectedIds.has(q.id) ? 'bg-muted/50' : ''}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedIds.has(q.id)} 
                            onCheckedChange={() => toggleSelect(q.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{q.code}</TableCell>
                        <TableCell>
                          <div 
                            className="line-clamp-2 text-sm"
                            dangerouslySetInnerHTML={{ 
                              __html: sanitizeHTML(q.question).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) + '...'
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-xs">{q.discipline_name || '-'}</TableCell>
                        <TableCell className="text-xs">{q.orgao_name || '-'}</TableCell>
                        <TableCell className="text-xs">{q.banca_name || '-'}</TableCell>
                        <TableCell className="text-xs">{q.year || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {q.question_type === 'tf' ? 'C/E' : 'Mult'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(q)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(q)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteClick(q)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Mostrando {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} de {totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Questão {previewQuestion?.code}</DialogTitle>
          </DialogHeader>
          {previewQuestion && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {previewQuestion.discipline_name && <Badge>{previewQuestion.discipline_name}</Badge>}
                {previewQuestion.topic_name && <Badge variant="secondary">{previewQuestion.topic_name}</Badge>}
                {previewQuestion.orgao_name && <Badge variant="outline">{previewQuestion.orgao_name}</Badge>}
                {previewQuestion.banca_name && <Badge variant="outline">{previewQuestion.banca_name}</Badge>}
                {previewQuestion.year && <Badge variant="secondary">{previewQuestion.year}</Badge>}
              </div>
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHTML(previewQuestion.question) }}
              />
              {previewQuestion.question_type === 'mult' && (
                <div className="space-y-2 pl-4">
                  {['a', 'b', 'c', 'd', 'e'].map(letter => {
                    const opt = previewQuestion[`option_${letter}` as keyof Question] as string;
                    if (!opt) return null;
                    const isCorrect = previewQuestion.answer?.toUpperCase() === letter.toUpperCase();
                    return (
                      <div key={letter} className={`flex gap-2 ${isCorrect ? 'text-green-600 font-medium' : ''}`}>
                        <span className="font-bold">{letter.toUpperCase()})</span>
                        <span dangerouslySetInnerHTML={{ __html: sanitizeHTML(opt) }} />
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-800">
                  Gabarito: {previewQuestion.answer}
                </p>
              </div>
              {previewQuestion.prof_comment && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-2">Comentário do Professor:</p>
                  <div 
                    className="text-sm text-blue-700 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHTML(previewQuestion.prof_comment) }}
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Editar Questão {editingQuestion?.code}</DialogTitle>
            <DialogDescription>
              Edite os campos abaixo e clique em salvar
            </DialogDescription>
          </DialogHeader>
          {editingQuestion && (
            <div className="space-y-4">
              <div>
                <Label>Enunciado</Label>
                <Textarea
                  value={editingQuestion.question}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                  rows={6}
                />
              </div>
              {editingQuestion.question_type === 'mult' && (
                <>
                  <div className="grid grid-cols-1 gap-3">
                    {['a', 'b', 'c', 'd', 'e'].map(letter => (
                      <div key={letter}>
                        <Label>Opção {letter.toUpperCase()}</Label>
                        <Input
                          value={(editingQuestion[`option_${letter}` as keyof Question] as string) || ''}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, [`option_${letter}`]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Gabarito</Label>
                  <Input
                    value={editingQuestion.answer}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, answer: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Dificuldade</Label>
                  <Select 
                    value={editingQuestion.difficulty || ''} 
                    onValueChange={(v) => setEditingQuestion({ ...editingQuestion, difficulty: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fácil">Fácil</SelectItem>
                      <SelectItem value="Médio">Médio</SelectItem>
                      <SelectItem value="Difícil">Difícil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Comentário do Professor</Label>
                <Textarea
                  value={editingQuestion.prof_comment || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, prof_comment: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editingQuestion.is_active}
                  onCheckedChange={(checked) => setEditingQuestion({ ...editingQuestion, is_active: !!checked })}
                  id="is-active"
                />
                <Label htmlFor="is-active">Questão ativa</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir questão?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a questão <strong>{questionToDelete?.code}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Delete Dialog */}
      <AlertDialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} questões?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selectedIds.size}</strong> questões selecionadas? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBatchDelete} 
              className="bg-destructive text-destructive-foreground"
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir {selectedIds.size} questões
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
