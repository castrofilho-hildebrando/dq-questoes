/**
 * useQuestionsRpc - Versão otimizada do useQuestions usando RPC server-side
 * 
 * Esta implementação:
 * 1. Usa a RPC search_questions para busca otimizada
 * 2. Evita N:N queries no front-end
 * 3. Paginação eficiente com LIMIT+1 para has_next
 * 4. Feature flag useRpcSearch para validação A/B
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  createPerfTracker,
  type LoadTrigger,
  type PerfTrackerReturn,
} from "@/hooks/debug/useQuestionBankPerformance";
import type { Question, Filters, FilterOption } from "@/hooks/useQuestions";

// Feature flag - set to true to use RPC, false for legacy
const USE_RPC_SEARCH = true;

// Debug flag for equivalence validation
const VALIDATE_EQUIVALENCE = true;

interface RpcSearchResult {
  questions: Question[];
  has_next: boolean;
  total_count: number | null;
  page: number;
  page_size: number;
  perf: {
    build_ms: number;
    query_ms: number;
  };
}

// Stats for filter counters
export interface QuestionStats {
  total: number;
  resolved: number;
  unresolved: number;
  correct: number;
  incorrect: number;
}

type ConcurrencyLogFn = (event: string, payload?: unknown) => void;

function generateRequestId(): string {
  return `rpc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const initialFilters: Filters = {
  keyword: '',
  questionTypes: [],
  bancas: [],
  orgaos: [],
  provas: [],
  disciplines: [],
  topics: [],
  years: [],
  status: 'all',
  schoolId: null,
  editalId: null,
  isPreEdital: true
};

export function useQuestionsRpc(initialKeyword: string = '', options?: { 
  enabled?: boolean; 
  debugLog?: ConcurrencyLogFn; 
  perfEnabled?: boolean;
}) {
  const enabled = options?.enabled ?? true;
  const debugLog = options?.debugLog;
  const perfEnabled = options?.perfEnabled ?? false;
  const { toast } = useToast();
  const { user } = useAuth();
  
  const perfTrackerRef = useRef<PerfTrackerReturn>(createPerfTracker(perfEnabled));
  
  useEffect(() => {
    perfTrackerRef.current = createPerfTracker(perfEnabled);
  }, [perfEnabled]);
  
  const loadTriggerRef = useRef<LoadTrigger>('initial');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [globalStats, setGlobalStats] = useState<QuestionStats>({
    total: 0,
    resolved: 0,
    unresolved: 0,
    correct: 0,
    incorrect: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  
  const activeRequestIdRef = useRef<string | null>(null);
  const cachedTotalCountRef = useRef<number | null>(null);
  
  const [filters, setFilters] = useState<Filters>({
    ...initialFilters,
    keyword: initialKeyword
  });
  
  const [pendingFilters, setPendingFilters] = useState<Filters>({
    ...initialFilters,
    keyword: initialKeyword
  });
  
  // Status is excluded from pending comparison because it applies immediately
  const hasPendingChanges = JSON.stringify({
    keyword: pendingFilters.keyword,
    questionTypes: pendingFilters.questionTypes,
    bancas: pendingFilters.bancas,
    orgaos: pendingFilters.orgaos,
    provas: pendingFilters.provas,
    disciplines: pendingFilters.disciplines,
    topics: pendingFilters.topics,
    years: pendingFilters.years,
  }) !== JSON.stringify({
    keyword: filters.keyword,
    questionTypes: filters.questionTypes,
    bancas: filters.bancas,
    orgaos: filters.orgaos,
    provas: filters.provas,
    disciplines: filters.disciplines,
    topics: filters.topics,
    years: filters.years,
  });
  
  const [bancas, setBancas] = useState<FilterOption[]>([]);
  const [orgaos, setOrgaos] = useState<FilterOption[]>([]);
  const [provas, setProvas] = useState<FilterOption[]>([]);
  const [disciplines, setDisciplines] = useState<FilterOption[]>([]);
  const [topics, setTopics] = useState<FilterOption[]>([]);
  
  const userId = user?.id || null;
  const PAGE_SIZE = 10;

  // Load base filter options
  const loadBaseFilterOptions = useCallback(async () => {
    if (!enabled) {
      setBancas([]);
      setOrgaos([]);
      setDisciplines([]);
      return;
    }

    try {
      const [bancasRes, orgaosRes] = await Promise.all([
        supabase.from('bancas').select('id, name').eq('is_active', true).order('name'),
        supabase.from('orgaos').select('id, name').eq('is_active', true).order('name'),
      ]);

      if (bancasRes.data) setBancas(bancasRes.data);
      if (orgaosRes.data) setOrgaos(orgaosRes.data);
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  }, [enabled]);

  // Load disciplines based on school/edital
  const loadDisciplines = useCallback(async () => {
    if (!enabled) {
      setDisciplines([]);
      return;
    }

    try {
      let disciplinesData: FilterOption[] = [];

      if (filters.schoolId) {
        const { data } = await supabase
          .from('school_disciplines')
          .select('discipline_id, study_disciplines!inner(id, name, is_active)')
          .eq('school_id', filters.schoolId)
          .eq('is_active', true)
          .eq('study_disciplines.is_active', true);

        if (data && data.length > 0) {
          const allDisciplines = data
            .filter((sd: any) => sd.study_disciplines)
            .map((sd: any) => ({ id: sd.study_disciplines.id, name: sd.study_disciplines.name }));

          const disciplineIds = allDisciplines.map((d) => d.id);
          const { data: countsData } = await supabase.rpc('get_discipline_question_counts', {
            discipline_ids: disciplineIds,
          });

          const countsMap = new Map<string, number>();
          (countsData || []).forEach((c: any) => {
            countsMap.set(c.discipline_id, c.question_count);
          });

          disciplinesData = allDisciplines
            .filter((d) => (countsMap.get(d.id) || 0) > 0)
            .sort((a, b) => a.name.localeCompare(b.name));
        }
      } else if (filters.editalId) {
        const { data } = await supabase
          .from('edital_disciplines')
          .select('discipline_id, study_disciplines!inner(id, name, is_active)')
          .eq('edital_id', filters.editalId)
          .eq('is_active', true)
          .eq('study_disciplines.is_active', true);

        if (data && data.length > 0) {
          const allDisciplines = data
            .filter((ed: any) => ed.study_disciplines)
            .map((ed: any) => ({ id: ed.study_disciplines.id, name: ed.study_disciplines.name }));

          const disciplineIds = allDisciplines.map((d) => d.id);
          const { data: countsData } = await supabase.rpc('get_discipline_question_counts', {
            discipline_ids: disciplineIds,
          });

          const countsMap = new Map<string, number>();
          (countsData || []).forEach((c: any) => {
            countsMap.set(c.discipline_id, c.question_count);
          });

          disciplinesData = allDisciplines
            .filter((d) => (countsMap.get(d.id) || 0) > 0)
            .sort((a, b) => a.name.localeCompare(b.name));
        }
      } else {
        const { data } = await supabase
          .from('study_disciplines')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (data) {
          disciplinesData = data.map((d: any) => ({ id: d.id, name: d.name }));
        }
      }

      setDisciplines(disciplinesData);
    } catch (error) {
      console.error('Error loading disciplines:', error);
    }
  }, [enabled, filters.schoolId, filters.editalId]);

  useEffect(() => {
    loadDisciplines();
  }, [loadDisciplines]);

  // Load topics based on discipline filter
  useEffect(() => {
    const loadTopics = async () => {
      if (!enabled) {
        setTopics([]);
        return;
      }

      if (pendingFilters.disciplines.length === 0) {
        setTopics([]);
        return;
      }

      try {
        const { data: topicsData } = await supabase
          .from('study_topics')
          .select('id, name, display_order')
          .in('study_discipline_id', pendingFilters.disciplines)
          .or('is_active.is.null,is_active.eq.true')
          .order('display_order', { ascending: true, nullsFirst: false })
          .order('name');

        if (!topicsData || topicsData.length === 0) {
          setTopics([]);
          return;
        }

        const topicIds = topicsData.map((t: any) => t.id);
        const { data: countsData } = await supabase.rpc('get_topic_question_counts', { 
          topic_ids: topicIds 
        });

        const countsMap = new Map<string, number>();
        (countsData || []).forEach((c: any) => {
          countsMap.set(c.topic_id, Number(c.question_count || 0));
        });

        const filtered = topicsData
          .filter((t: any) => (countsMap.get(t.id) || 0) > 0)
          .map((t: any) => ({ id: t.id, name: t.name }));

        setTopics(filtered as FilterOption[]);
      } catch (error) {
        console.error('Error loading topics:', error);
      }
    };

    loadTopics();
  }, [enabled, pendingFilters.disciplines]);

  // Load provas based on banca/orgao filters
  useEffect(() => {
    const loadProvas = async () => {
      if (!enabled) {
        setProvas([]);
        return;
      }

      try {
        let query = supabase
          .from('provas')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (pendingFilters.bancas.length === 1) {
          query = query.eq('banca_id', pendingFilters.bancas[0]);
        } else if (pendingFilters.bancas.length > 1) {
          query = query.in('banca_id', pendingFilters.bancas);
        }
        if (pendingFilters.orgaos.length === 1) {
          query = query.eq('orgao_id', pendingFilters.orgaos[0]);
        } else if (pendingFilters.orgaos.length > 1) {
          query = query.in('orgao_id', pendingFilters.orgaos);
        }

        const { data } = await query;
        setProvas(data || []);
      } catch (error) {
        console.error('Error loading provas:', error);
      }
    };

    loadProvas();
  }, [enabled, pendingFilters.bancas, pendingFilters.orgaos]);

  // Main search function using RPC
  const loadQuestionsRpc = useCallback(async (page: number, triggerOverride?: LoadTrigger) => {
    const perf = perfTrackerRef.current;
    const trigger = triggerOverride ?? loadTriggerRef.current;
    const requestId = generateRequestId();
    activeRequestIdRef.current = requestId;
    
    const isActive = () => activeRequestIdRef.current === requestId;
    
    // Build filters for RPC
    const rpcFilters = {
      schoolId: filters.schoolId,
      editalId: filters.editalId,
      isPreEdital: filters.isPreEdital,
      keyword: filters.keyword || null,
      disciplines: filters.disciplines.length > 0 ? filters.disciplines : null,
      topics: filters.topics.length > 0 ? filters.topics : null,
      bancas: filters.bancas.length > 0 ? filters.bancas : null,
      orgaos: filters.orgaos.length > 0 ? filters.orgaos : null,
      provas: filters.provas.length > 0 ? filters.provas : null,
      years: filters.years.length > 0 ? filters.years.map(y => parseInt(y)) : null,
      questionTypes: filters.questionTypes.length > 0 ? filters.questionTypes : null,
      status: filters.status,
      userId: userId,
    };
    
    perf.startLoad({
      requestId,
      trigger,
      page,
      filters: {
        keyword: filters.keyword,
        status: filters.status,
        bancasCount: filters.bancas?.length ?? 0,
        orgaosCount: filters.orgaos?.length ?? 0,
        provasCount: filters.provas?.length ?? 0,
        disciplinesCount: filters.disciplines?.length ?? 0,
        topicsCount: filters.topics?.length ?? 0,
        yearsCount: filters.years?.length ?? 0,
        questionTypesCount: filters.questionTypes?.length ?? 0,
      },
      selection: {
        schoolId: filters.schoolId,
        editalId: filters.editalId,
        isPreEdital: filters.isPreEdital,
      },
      queryKey: 'rpc:search_questions',
    });
    
    debugLog?.("RPC_FETCH_START", {
      requestId,
      page,
      filters: rpcFilters,
    });
    
    if (isActive()) setIsLoading(true);
    
    try {
      perf.markBuildQueryStart();
      perf.markBuildQueryEnd();
      perf.markDbRequestStart();
      
      const startTime = performance.now();
      
      // Call the RPC
      const { data, error } = await supabase.rpc('search_questions', {
        p_filters: rpcFilters,
        p_page: page,
        p_page_size: PAGE_SIZE,
      });
      
      const dbTime = performance.now() - startTime;
      
      if (error) throw error;
      
      const result = data as unknown as RpcSearchResult;
      
      // Estimate payload size
      const payloadSize = JSON.stringify(result).length;
      perf.markDbRequestEnd(payloadSize);
      
      debugLog?.("RPC_FETCH_COMPLETE", {
        requestId,
        page,
        questionsReturned: result.questions?.length ?? 0,
        hasNext: result.has_next,
        totalCount: result.total_count,
        dbTimeMs: dbTime.toFixed(2),
        serverPerf: result.perf,
      });
      
      perf.markJsonParseStart();
      
      // Map questions to expected format
      // RPC returns nested objects (banca, orgao, prova, discipline, topic) with {id, name}
      const mappedQuestions: Question[] = (result.questions || []).map((q: any) => ({
        id: q.id,
        code: q.code,
        question: q.question,
        associated_text: q.associated_text,
        images: q.images,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        option_e: q.option_e,
        question_type: q.question_type,
        difficulty: q.difficulty,
        keys: q.keys,
        related_contents: q.related_contents,
        year: q.year,
        banca_id: q.banca_id,
        orgao_id: q.orgao_id,
        prova_id: q.prova_id,
        study_discipline_id: q.study_discipline_id,
        study_topic_id: q.study_topic_id,
        position_id: q.position_id,
        is_active: q.is_active,
        created_at: q.created_at,
        updated_at: q.updated_at,
        answer: q.answer || null,
        prof_comment: q.prof_comment || null,
        // Extract names from RPC response (returns flat fields, not nested objects)
        banca_name: q.banca_name || q.banca?.name || null,
        orgao_name: q.orgao_name || q.orgao?.name || null,
        prova_name: q.prova_name || q.prova?.name || null,
        discipline_name: q.discipline_name || q.discipline?.name || null,
        topic_name: q.topic_name || q.topic?.name || null,
        // Build all_disciplines/all_topics from RPC flat fields
        all_disciplines: q.all_disciplines || (q.discipline_name && q.study_discipline_id ? [{ id: q.study_discipline_id, name: q.discipline_name }] : []),
        all_topics: q.all_topics || (q.topic_name && q.study_topic_id ? [{ id: q.study_topic_id, name: q.topic_name }] : []),
        // Robust mapping: user_answer can be null, undefined, or an object
        user_answered: q.user_answer !== null && q.user_answer !== undefined && typeof q.user_answer === 'object',
        user_is_correct: q.user_answer?.is_correct === true,
      }));
      
      // Log for debugging if user_answered appears wrong
      if (debugLog && mappedQuestions.length > 0) {
        const sampleQ = result.questions[0] as any;
        debugLog("RPC_MAPPING_SAMPLE", {
          raw_user_answer: sampleQ?.user_answer,
          mapped_user_answered: mappedQuestions[0]?.user_answered,
          mapped_user_is_correct: mappedQuestions[0]?.user_is_correct,
        });
      }
      
      perf.markJsonParseEnd();
      
      if (!isActive()) {
        debugLog?.("RPC_STALE_RESPONSE_IGNORED", { requestId });
        return;
      }
      
      perf.markStateUpdateStart();
      
      // Update state
      setQuestions(mappedQuestions);
      setHasNext(result.has_next);
      
      // Use cached total count for pagination after page 1
      if (page === 1 && result.total_count !== null) {
        cachedTotalCountRef.current = result.total_count;
        setTotalCount(result.total_count);
        setTotalPages(Math.ceil(result.total_count / PAGE_SIZE));
      } else if (cachedTotalCountRef.current !== null) {
        setTotalCount(cachedTotalCountRef.current);
        setTotalPages(Math.ceil(cachedTotalCountRef.current / PAGE_SIZE));
      }
      
      setCurrentPage(page);
      
      perf.markStateUpdateEnd(mappedQuestions.length);
      
    } catch (error) {
      console.error('Error loading questions (RPC):', error);
      debugLog?.("RPC_FETCH_ERROR", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (isActive()) {
        toast({
          title: "Erro ao carregar questões",
          description: "Tente novamente mais tarde",
          variant: "destructive"
        });
      }
    } finally {
      if (isActive()) setIsLoading(false);
    }
  }, [filters, userId, toast, debugLog]);

  // Load global stats for filters (resolved/unresolved/correct/incorrect counts)
  const loadGlobalStats = useCallback(async () => {
    if (!userId) {
      setGlobalStats({ total: 0, resolved: 0, unresolved: 0, correct: 0, incorrect: 0 });
      return;
    }

    const hasScope =
      !!filters.schoolId ||
      !!filters.editalId ||
      filters.disciplines.length > 0 ||
      filters.topics.length > 0;

    if (!hasScope) {
      setGlobalStats({ total: 0, resolved: 0, unresolved: 0, correct: 0, incorrect: 0 });
      return;
    }

    setIsLoadingStats(true);
    
    try {
      // Build filters for RPC - same as main query but without status filter
      const rpcFilters = {
        schoolId: filters.schoolId,
        editalId: filters.editalId,
        isPreEdital: filters.isPreEdital,
        keyword: filters.keyword || null,
        disciplines: filters.disciplines.length > 0 ? filters.disciplines : null,
        topics: filters.topics.length > 0 ? filters.topics : null,
        bancas: filters.bancas.length > 0 ? filters.bancas : null,
        orgaos: filters.orgaos.length > 0 ? filters.orgaos : null,
        provas: filters.provas.length > 0 ? filters.provas : null,
        years: filters.years.length > 0 ? filters.years.map(y => parseInt(y)) : null,
        questionTypes: filters.questionTypes.length > 0 ? filters.questionTypes : null,
        status: 'all', // Always 'all' for stats
        userId: userId,
      };

      // First, get total count with status='all'
      const { data: totalData } = await supabase.rpc('search_questions', {
        p_filters: rpcFilters,
        p_page: 1,
        p_page_size: 1,
      });
      
      const totalResult = totalData as unknown as RpcSearchResult;
      const total = totalResult?.total_count ?? 0;

      // Get answered count
      const { data: answeredData } = await supabase.rpc('search_questions', {
        p_filters: { ...rpcFilters, status: 'answered' },
        p_page: 1,
        p_page_size: 1,
      });
      const answeredResult = answeredData as unknown as RpcSearchResult;
      const resolved = answeredResult?.total_count ?? 0;

      // Get correct count
      const { data: correctData } = await supabase.rpc('search_questions', {
        p_filters: { ...rpcFilters, status: 'correct' },
        p_page: 1,
        p_page_size: 1,
      });
      const correctResult = correctData as unknown as RpcSearchResult;
      const correct = correctResult?.total_count ?? 0;

      // Get wrong count
      const { data: wrongData } = await supabase.rpc('search_questions', {
        p_filters: { ...rpcFilters, status: 'wrong' },
        p_page: 1,
        p_page_size: 1,
      });
      const wrongResult = wrongData as unknown as RpcSearchResult;
      const incorrect = wrongResult?.total_count ?? 0;

      const unresolved = total - resolved;

      setGlobalStats({ total, resolved, unresolved, correct, incorrect });
      
      debugLog?.("GLOBAL_STATS_LOADED", { total, resolved, unresolved, correct, incorrect });
    } catch (error) {
      console.error('Error loading global stats:', error);
      // Don't show toast for stats errors - non-critical
    } finally {
      setIsLoadingStats(false);
    }
  }, [filters, userId, debugLog]);

  const submitAnswer = async (questionId: string, selectedAnswer: string) => {
    if (!userId) {
      toast({
        title: "Faça login",
        description: "Você precisa estar logado para responder questões",
        variant: "destructive"
      });
      return null;
    }

    try {
      const { data: checkResult, error: checkError } = await supabase
        .rpc('check_answer', {
          question_id: questionId,
          user_answer: selectedAnswer
        });

      if (checkError) throw checkError;

      const result = checkResult as { is_correct: boolean; correct_answer: string; prof_comment: string | null; error?: string };
      
      if (result.error) {
        throw new Error(result.error);
      }

      const isCorrect = result.is_correct;

      const { error: insertError } = await supabase.from('user_answers').insert({
        user_id: userId,
        question_id: questionId,
        selected_answer: selectedAnswer,
        is_correct: isCorrect
      });

      if (insertError) throw insertError;

      setQuestions(prev => prev.map(q =>
        q.id === questionId 
          ? { 
              ...q, 
              user_answered: true, 
              user_is_correct: isCorrect,
              answer: result.correct_answer,
              prof_comment: result.prof_comment
            }
          : q
      ));

      // Update global stats in memory immediately
      setGlobalStats(prev => ({
        total: prev.total,
        resolved: prev.resolved + 1,
        unresolved: Math.max(0, prev.unresolved - 1),
        correct: isCorrect ? prev.correct + 1 : prev.correct,
        incorrect: isCorrect ? prev.incorrect : prev.incorrect + 1,
      }));

      return { isCorrect, correctAnswer: result.correct_answer, profComment: result.prof_comment };
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast({
        title: "Erro ao salvar resposta",
        description: "Tente novamente",
        variant: "destructive"
      });
      return null;
    }
  };

  const clearFilters = () => {
    const clearedFilters: Filters = {
      ...initialFilters,
      schoolId: pendingFilters.schoolId,
      editalId: pendingFilters.editalId,
      isPreEdital: pendingFilters.isPreEdital,
    };
    setPendingFilters(clearedFilters);
    setFilters(clearedFilters);
    cachedTotalCountRef.current = null;
  };

  const updateFilter = (key: keyof Filters, value: string | string[]) => {
    setPendingFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      
      if (key === 'disciplines') {
        newFilters.topics = [];
      }
      if (key === 'bancas' || key === 'orgaos') {
        newFilters.provas = [];
      }
      
      return newFilters;
    });

    // Status filter applies immediately (no need to click "Filtrar")
    if (key === 'status') {
      cachedTotalCountRef.current = null;
      setFilters(prev => ({ ...prev, status: value as Filters['status'] }));
    }
  };

  type ArrayFilterKey = 'bancas' | 'orgaos' | 'disciplines' | 'years' | 'questionTypes' | 'provas' | 'topics';

  const toggleArrayFilter = (key: ArrayFilterKey, value: string) => {
    setPendingFilters(prev => {
      const currentArray = prev[key];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(v => v !== value)
        : [...currentArray, value];
      
      const newFilters = { ...prev, [key]: newArray };
      
      if (key === 'disciplines') {
        newFilters.topics = [];
      }
      if (key === 'bancas' || key === 'orgaos') {
        newFilters.provas = [];
      }
      
      return newFilters;
    });
  };

  const applyFilters = useCallback(() => {
    cachedTotalCountRef.current = null;
    setFilters(prev => ({
      ...prev,
      keyword: pendingFilters.keyword,
      questionTypes: pendingFilters.questionTypes,
      bancas: pendingFilters.bancas,
      orgaos: pendingFilters.orgaos,
      provas: pendingFilters.provas,
      disciplines: pendingFilters.disciplines,
      topics: pendingFilters.topics,
      years: pendingFilters.years,
      status: pendingFilters.status,
    }));
  }, [pendingFilters]);

  const years = Array.from({ length: 75 }, (_, i) => (new Date().getFullYear() - i).toString());

  const setSchoolId = useCallback((schoolId: string | null, isPreEdital: boolean = true) => {
    const update = (prev: Filters): Filters => {
      const nextSchoolId = schoolId ?? null;
      if (prev.schoolId === nextSchoolId && prev.isPreEdital === isPreEdital) return prev;
      return { ...prev, schoolId: nextSchoolId, isPreEdital };
    };
    cachedTotalCountRef.current = null;
    setFilters(update);
    setPendingFilters(update);
  }, []);

  const setEditalId = useCallback((editalId: string | null) => {
    const update = (prev: Filters): Filters => {
      const nextEditalId = editalId ?? null;
      if (prev.editalId === nextEditalId) return prev;
      return { ...prev, editalId: nextEditalId };
    };
    cachedTotalCountRef.current = null;
    setFilters(update);
    setPendingFilters(update);
  }, []);

  const hydrateState = useCallback((state: {
    schoolId: string | null;
    editalId: string | null;
    isPreEdital: boolean;
    filters?: Partial<Filters>;
    currentPage?: number;
  }) => {
    const newFilters: Filters = {
      ...initialFilters,
      keyword: state.filters?.keyword || '',
      questionTypes: state.filters?.questionTypes || [],
      bancas: state.filters?.bancas || [],
      orgaos: state.filters?.orgaos || [],
      provas: state.filters?.provas || [],
      disciplines: state.filters?.disciplines || [],
      topics: state.filters?.topics || [],
      years: state.filters?.years || [],
      status: state.filters?.status || 'all',
      schoolId: state.schoolId,
      editalId: state.editalId,
      isPreEdital: state.isPreEdital,
    };
    
    cachedTotalCountRef.current = null;
    setFilters(newFilters);
    setPendingFilters(newFilters);
    
    if (state.currentPage && state.currentPage > 1) {
      setCurrentPage(state.currentPage);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    loadBaseFilterOptions();
  }, [enabled, loadBaseFilterOptions]);

  const filtersVersion = JSON.stringify({
    keyword: filters.keyword,
    questionTypes: filters.questionTypes,
    bancas: filters.bancas,
    orgaos: filters.orgaos,
    provas: filters.provas,
    disciplines: filters.disciplines,
    topics: filters.topics,
    years: filters.years,
    status: filters.status,
    schoolId: filters.schoolId,
    editalId: filters.editalId,
    isPreEdital: filters.isPreEdital,
  });

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setQuestions([]);
      setTotalCount(0);
      setTotalPages(0);
      return;
    }

    const hasScope =
      !!filters.schoolId ||
      !!filters.editalId ||
      filters.disciplines.length > 0 ||
      filters.topics.length > 0;

    if (!hasScope) {
      setIsLoading(false);
      return;
    }

    loadQuestionsRpc(1);
  }, [enabled, filtersVersion, userId]);

  // Load global stats when filters change (excluding status filter)
  const filtersVersionForStats = JSON.stringify({
    keyword: filters.keyword,
    questionTypes: filters.questionTypes,
    bancas: filters.bancas,
    orgaos: filters.orgaos,
    provas: filters.provas,
    disciplines: filters.disciplines,
    topics: filters.topics,
    years: filters.years,
    // Note: status is NOT included here - stats should be independent of status filter
    schoolId: filters.schoolId,
    editalId: filters.editalId,
    isPreEdital: filters.isPreEdital,
  });

  useEffect(() => {
    if (!enabled) {
      setGlobalStats({ total: 0, resolved: 0, unresolved: 0, correct: 0, incorrect: 0 });
      return;
    }

    const hasScope =
      !!filters.schoolId ||
      !!filters.editalId ||
      filters.disciplines.length > 0 ||
      filters.topics.length > 0;

    if (!hasScope) {
      setGlobalStats({ total: 0, resolved: 0, unresolved: 0, correct: 0, incorrect: 0 });
      return;
    }

    loadGlobalStats();
  }, [enabled, filtersVersionForStats, userId, loadGlobalStats]);

  return {
    questions,
    isLoading,
    currentPage,
    totalPages,
    totalCount,
    hasNext,
    globalStats,
    isLoadingStats,
    filters,
    pendingFilters,
    hasPendingChanges,
    bancas,
    orgaos,
    provas,
    disciplines,
    topics,
    years,
    loadQuestions: loadQuestionsRpc,
    submitAnswer,
    clearFilters,
    updateFilter,
    toggleArrayFilter,
    applyFilters,
    setCurrentPage,
    setSchoolId,
    setEditalId,
    hydrateState,
    perfTracker: perfTrackerRef.current,
    setLoadTrigger: (trigger: LoadTrigger) => { loadTriggerRef.current = trigger; },
    // Feature flags
    useRpcSearch: USE_RPC_SEARCH,
  };
}

// Export feature flag for external use
export const USE_RPC_SEARCH_FLAG = USE_RPC_SEARCH;
