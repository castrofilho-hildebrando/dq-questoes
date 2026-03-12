import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  createPerfTracker,
  estimateResponseSize,
  type LoadTrigger,
  type PerfTrackerReturn,
} from "@/hooks/debug/useQuestionBankPerformance";

// Tipo para log de debug de concorrência
type ConcurrencyLogFn = (event: string, payload?: unknown) => void;

// Gera ID único para cada requisição
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isAbortError(error: unknown): boolean {
  const e: any = error;
  if (!e) return false;
  if (e?.name === "AbortError") return true;
  const msg = String(e?.message ?? "").toLowerCase();
  return msg.includes("abort") || msg.includes("aborted") || msg.includes("the user aborted");
}

function withAbortSignal<T>(builder: T, signal: AbortSignal): T {
  try {
    const b: any = builder;
    if (b && typeof b.abortSignal === "function") {
      return b.abortSignal(signal);
    }
  } catch {
    // noop
  }
  return builder;
}

function getCallsiteStack(maxLines = 8): string | null {
  try {
    const stack = new Error().stack;
    if (!stack) return null;
    const lines = stack
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    // Remove the first line ("Error") and this helper frame(s)
    return lines.slice(1, 1 + maxLines).join("\n");
  } catch {
    return null;
  }
}

export interface Question {
  id: string;
  code: string;
  question: string;
  associated_text?: string | null;
  images?: any[] | null;
  answer?: string;
  prof_comment?: string | null;
  related_contents: string | null;
  keys: string | null;
  year: number | null;
  difficulty: string | null;
  question_type: string | null;
  banca_id: string | null;
  orgao_id?: string | null;
  prova_id?: string | null;
  position_id: string | null;
  study_discipline_id: string | null;
  study_topic_id: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  banca_name?: string;
  orgao_name?: string;
  prova_name?: string;
  position_name?: string;
  discipline_name?: string;
  topic_name?: string;
  // N:N relationships - all disciplines and topics
  all_disciplines?: { id: string; name: string }[];
  all_topics?: { id: string; name: string }[];
  // User answer data
  user_answered?: boolean;
  user_is_correct?: boolean;
}

export interface FilterOption {
  id: string;
  name: string;
}

export interface Filters {
  keyword: string;
  questionTypes: string[];
  bancas: string[];
  orgaos: string[];
  provas: string[];
  disciplines: string[];
  topics: string[];
  years: string[];
  status: 'all' | 'answered' | 'not_answered' | 'correct' | 'wrong';
  schoolId: string | null;
  editalId: string | null; // Direct edital access (without school)
  isPreEdital: boolean; // indicates if selected school is pre-edital
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

export function useQuestions(initialKeyword: string = '', options?: { enabled?: boolean; debugLog?: ConcurrencyLogFn; perfEnabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const debugLog = options?.debugLog;
  const perfEnabled = options?.perfEnabled ?? false;
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Performance tracker
  const perfTrackerRef = useRef<PerfTrackerReturn>(createPerfTracker(perfEnabled));
  
  // Update tracker if perfEnabled changes
  useEffect(() => {
    perfTrackerRef.current = createPerfTracker(perfEnabled);
  }, [perfEnabled]);
  
  // Track load trigger for performance logging
  const loadTriggerRef = useRef<LoadTrigger>('initial');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  
  // Rastreamento de concorrência
  const activeRequestIdRef = useRef<string | null>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  
  // "Committed" filters (applied to questions)
  const [filters, setFilters] = useState<Filters>({
    ...initialFilters,
    keyword: initialKeyword
  });
  
  // "Pending" filters (what the user is selecting before clicking "Filtrar")
  const [pendingFilters, setPendingFilters] = useState<Filters>({
    ...initialFilters,
    keyword: initialKeyword
  });
  
  // Track if there are unapplied changes
  const hasPendingChanges = JSON.stringify({
    keyword: pendingFilters.keyword,
    questionTypes: pendingFilters.questionTypes,
    bancas: pendingFilters.bancas,
    orgaos: pendingFilters.orgaos,
    provas: pendingFilters.provas,
    disciplines: pendingFilters.disciplines,
    topics: pendingFilters.topics,
    years: pendingFilters.years,
    status: pendingFilters.status,
  }) !== JSON.stringify({
    keyword: filters.keyword,
    questionTypes: filters.questionTypes,
    bancas: filters.bancas,
    orgaos: filters.orgaos,
    provas: filters.provas,
    disciplines: filters.disciplines,
    topics: filters.topics,
    years: filters.years,
    status: filters.status,
  });
  
  // Filter options - cascading
  const [bancas, setBancas] = useState<FilterOption[]>([]);
  const [orgaos, setOrgaos] = useState<FilterOption[]>([]);
  const [provas, setProvas] = useState<FilterOption[]>([]);
  const [disciplines, setDisciplines] = useState<FilterOption[]>([]);
  const [topics, setTopics] = useState<FilterOption[]>([]);
  
  const userId = user?.id || null;
  
  const PAGE_SIZE = 10;

  // Load base filter options (always available)
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

  // Load disciplines based on school filter OR edital filter - only show disciplines with questions
  const loadDisciplines = useCallback(async () => {
    if (!enabled) {
      setDisciplines([]);
      return;
    }

    try {
      let disciplinesData: FilterOption[] = [];

      if (filters.schoolId) {
        // Load disciplines linked to this school via school_disciplines
        // Filter for active disciplines AND active links
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

          // Get question counts for these disciplines to filter out empty ones
          const disciplineIds = allDisciplines.map((d) => d.id);
          const { data: countsData } = await supabase.rpc('get_discipline_question_counts', {
            discipline_ids: disciplineIds,
          });

          // Create a map of discipline_id -> question_count
          const countsMap = new Map<string, number>();
          (countsData || []).forEach((c: any) => {
            countsMap.set(c.discipline_id, c.question_count);
          });

          // Filter out disciplines with 0 questions
          disciplinesData = allDisciplines
            .filter((d) => (countsMap.get(d.id) || 0) > 0)
            .sort((a, b) => a.name.localeCompare(b.name));
        }
      } else if (filters.editalId) {
        // Load disciplines linked to this edital via edital_disciplines
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

          // Get question counts for these disciplines to filter out empty ones
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
        // Fallback: load all active disciplines
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

  // NOTE: Removed realtime subscription for disciplines to prevent
  // unexpected re-fetches and screen flicker during normal navigation.

  // Load topics based on discipline filter (cascading) – only topics with questions
  // Use pendingFilters.disciplines for cascading options
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
        const PAGE_SIZE = 1000;
        const allTopics: any[] = [];

        for (let from = 0; from < 50000; from += PAGE_SIZE) {
          // @ts-ignore - Supabase type inference too deep
          const { data: page, error } = await supabase
            .from('study_topics')
            .select('id, name, display_order')
            .in('study_discipline_id', pendingFilters.disciplines)
            .or('is_active.is.null,is_active.eq.true')
            .order('display_order', { ascending: true, nullsFirst: false })
            .order('name')
            .range(from, from + PAGE_SIZE - 1);

          if (error) throw error;
          if (!page || page.length === 0) break;
          allTopics.push(...page);
          if (page.length < PAGE_SIZE) break;
        }

        if (allTopics.length === 0) {
          setTopics([]);
          return;
        }

        const topicIds = allTopics.map((t: any) => t.id);

        // Fetch question counts to filter out topics with 0 questions
        const countsMap = new Map<string, number>();

        if (topicIds.length > 0) {
          const BATCH_SIZE = 500;
          for (let i = 0; i < topicIds.length; i += BATCH_SIZE) {
            const batch = topicIds.slice(i, i + BATCH_SIZE);
            const { data: countsData, error: countsError } = await supabase
              .rpc('get_topic_question_counts', { topic_ids: batch });

            if (countsError) throw countsError;
            (countsData || []).forEach((c: any) => {
              countsMap.set(c.topic_id, Number(c.question_count || 0));
            });
          }
        }

        // Keep only topics with at least 1 question
        const filtered = allTopics
          .filter((t: any) => (countsMap.get(t.id) || 0) > 0)
          .map((t: any) => ({ id: t.id, name: t.name }));

        setTopics(filtered as FilterOption[]);
      } catch (error) {
        console.error('Error loading topics:', error);
      }
    };

    loadTopics();
  }, [enabled, pendingFilters.disciplines]);

  // Load provas based on banca and orgao filters (cascading)
  // Use pendingFilters for cascading
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

  // loadQuestions and submitAnswer functions
  const loadQuestions = useCallback(async (page: number, triggerOverride?: LoadTrigger) => {
    const perf = perfTrackerRef.current;
    const trigger = triggerOverride ?? loadTriggerRef.current;
    
    const previousRequestId = activeRequestIdRef.current;
    if (activeAbortControllerRef.current) {
      try {
        activeAbortControllerRef.current.abort();
        debugLog?.("FETCH_ABORTED", {
          abortedRequestId: previousRequestId,
          reason: "new_request_started",
          nextPage: page,
        });
      } catch {
        // noop
      }
    }

    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    // Gerar ID único para esta requisição
    const requestId = generateRequestId();
    activeRequestIdRef.current = requestId;

    const callsite = getCallsiteStack();
    debugLog?.("FETCH_CALLSITE", {
      requestId,
      stack: callsite,
    });

    const isActive = () => activeRequestIdRef.current === requestId;
    const signal = abortController.signal;
    
    // Build query key for logging
    const queryKey = JSON.stringify({
      keyword: filters.keyword,
      status: filters.status,
      bancas: [...(filters.bancas ?? [])].sort(),
      orgaos: [...(filters.orgaos ?? [])].sort(),
      provas: [...(filters.provas ?? [])].sort(),
      disciplines: [...(filters.disciplines ?? [])].sort(),
      topics: [...(filters.topics ?? [])].sort(),
      years: [...(filters.years ?? [])].sort(),
      questionTypes: [...(filters.questionTypes ?? [])].sort(),
      schoolId: filters.schoolId,
      editalId: filters.editalId,
      isPreEdital: filters.isPreEdital,
    });
    
    // PERF: Start tracking
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
      queryKey,
    });
    
    // Log de início da requisição
    debugLog?.("FETCH_START", {
      requestId,
      page,
      queryKey: ["questions", queryKey, page],
      committedFilters: {
        keyword: filters.keyword,
        status: filters.status,
        bancas: filters.bancas?.length ?? 0,
        orgaos: filters.orgaos?.length ?? 0,
        provas: filters.provas?.length ?? 0,
        disciplines: filters.disciplines?.length ?? 0,
        topics: filters.topics?.length ?? 0,
        years: filters.years?.length ?? 0,
        questionTypes: filters.questionTypes?.length ?? 0,
      },
      selection: {
        schoolId: filters.schoolId,
        editalId: filters.editalId,
        isPreEdital: filters.isPreEdital,
      },
    });
    
    // PERF: Mark build query start
    perf.markBuildQueryStart();
    
    if (isActive()) setIsLoading(true);
    try {
      // Pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Check if keyword looks like a question code (DQ-XXXXXXXXXX or Q-XXXXX pattern)
      const isCodeSearch = filters.keyword && /^(DQ-|Q-)\d+/i.test(filters.keyword.trim());
      
      // If searching by code, do a direct search ignoring other filters
      if (isCodeSearch) {
        const searchCode = filters.keyword.trim();
        
        // Search directly by code
        const { data, error, count } = await withAbortSignal(
          supabase
          .from('questions_for_students')
          .select(`
            id, code, question, associated_text, images, option_a, option_b, option_c, option_d, option_e,
            question_type, difficulty, keys, related_contents, year,
            banca_id, orgao_id, prova_id, study_discipline_id, study_topic_id,
            position_id, is_active, created_at, updated_at,
            bancas(name),
            orgaos(name),
            provas(name),
            study_disciplines(name),
            study_topics(name)
          `, { count: 'exact' })
          .ilike('code', `%${searchCode}%`)
          .order('code')
          .range(from, to),
          signal
        );
        
        if (error) throw error;
        
        // Get user answers and N:N data for found questions
        let userAnswers: { question_id: string; is_correct: boolean; selected_answer: string }[] = [];
        let questionDisciplines: { question_id: string; study_disciplines: { id: string; name: string } }[] = [];
        let questionTopics: { question_id: string; study_topics: { id: string; name: string } }[] = [];
        
        if (data && data.length > 0) {
          const questionIds = data.map((q: any) => q.id);
          
          const [disciplinesRes, topicsRes] = await Promise.all([
            withAbortSignal(
              supabase
                .from('question_disciplines')
                .select('question_id, study_disciplines(id, name)')
                .in('question_id', questionIds)
                .is('deleted_at', null),
              signal
            ),
            withAbortSignal(
              supabase
                .from('question_topics')
                .select('question_id, study_topics(id, name)')
                .in('question_id', questionIds)
                .is('deleted_at', null),
              signal
            ),
          ]);
          
          questionDisciplines = (disciplinesRes.data || []) as any;
          questionTopics = (topicsRes.data || []) as any;
          
          if (userId) {
            const { data: answersData } = await withAbortSignal(
              supabase
                .from('user_answers')
                .select('question_id, is_correct, selected_answer')
                .eq('user_id', userId)
                .in('question_id', questionIds),
              signal
            );
            
            userAnswers = answersData || [];
          }
        }
        
        // Map questions
        const mappedQuestions: Question[] = (data || []).map((q: any) => {
          const userAnswer = userAnswers.find(a => a.question_id === q.id);
          const allDisciplines = questionDisciplines
            .filter(qd => qd.question_id === q.id && qd.study_disciplines)
            .map(qd => qd.study_disciplines);
          const allTopics = questionTopics
            .filter(qt => qt.question_id === q.id && qt.study_topics)
            .map(qt => qt.study_topics);
          
          return {
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
            banca_name: q.bancas?.name,
            orgao_name: q.orgaos?.name,
            prova_name: q.provas?.name,
            discipline_name: q.study_disciplines?.name,
            topic_name: q.study_topics?.name,
            all_disciplines: allDisciplines.length > 0 ? allDisciplines : (q.study_disciplines ? [{ id: q.study_discipline_id, name: q.study_disciplines.name }] : []),
            all_topics: allTopics.length > 0 ? allTopics : (q.study_topics ? [{ id: q.study_topic_id, name: q.study_topics.name }] : []),
            user_answered: !!userAnswer,
            user_is_correct: userAnswer?.is_correct
          };
        });
        
        // Guard de concorrência: só aplica se esta é a requisição ativa
        if (!isActive()) {
          debugLog?.("STALE_RESPONSE_IGNORED", {
            requestId,
            activeRequestId: activeRequestIdRef.current,
            reason: "code_search_response",
            questionsCount: mappedQuestions.length,
          });
          return;
        }
        
        debugLog?.("FETCH_COMPLETE", {
          requestId,
          page,
          totalCount: count || 0,
          totalPages: Math.ceil((count || 0) / PAGE_SIZE),
          questionsReturned: mappedQuestions.length,
          isActive: true,
          activeRequestId: activeRequestIdRef.current,
        });
        
        setQuestions(mappedQuestions);
        setTotalCount(count || 0);
        setTotalPages(Math.ceil((count || 0) / PAGE_SIZE));
        setCurrentPage(page);
        return;
      }

      // Helper functions to fetch all IDs without limit (paginating in batches)
      // IMPORTANT: we must batch the IN() lists to avoid "Bad Request" when the URL gets too large.
      const IN_BATCH_SIZE = 200;
      const PAGE_BATCH_SIZE = 1000;

      const fetchAllIdsByInFilter = async (
        table: string,
        selectColumn: string,
        filterColumn: string,
        filterValues: string[],
        extra?: (q: any) => any,
        selectExpression?: string
      ): Promise<string[]> => {
        if (!filterValues || filterValues.length === 0) return [];
        if (signal.aborted) return [];

        const allIds: string[] = [];

        for (let i = 0; i < filterValues.length; i += IN_BATCH_SIZE) {
          const batchValues = filterValues.slice(i, i + IN_BATCH_SIZE);
          let offset = 0;

          while (true) {
            // Use untyped client calls here to avoid TS deep instantiation issues
            // and to allow dynamic table/column names.
            let q = (supabase as any)
              .from(table)
              .select(selectExpression ?? selectColumn)
              .in(filterColumn, batchValues);

            q = withAbortSignal(q, signal);

            if (extra) q = extra(q);

            const { data, error } = await q.range(offset, offset + PAGE_BATCH_SIZE - 1);

            if (error) {
              // Throw so the main loadQuestions catches it and keeps the previous list (avoids flicker)
              throw error;
            }

            const rows = (data || []) as any[];
            if (rows.length === 0) break;

            rows.forEach((row) => {
              const value = row?.[selectColumn];
              if (value) allIds.push(String(value));
            });

            if (rows.length < PAGE_BATCH_SIZE) break;
            offset += PAGE_BATCH_SIZE;
          }
        }

        return allIds;
      };

      // IMPORTANT: When paginating by IDs (N:N filters), we must only include ACTIVE questions,
      // otherwise we can end up slicing 10 IDs but fetching <10 rows from questions_for_students.
      const fetchAllQuestionTopicIds = (topicIds: string[]) =>
        fetchAllIdsByInFilter(
          'question_topics',
          'question_id',
          'study_topic_id',
          topicIds,
          (q) => q.eq('questions.is_active', true),
          'question_id, questions!inner(is_active)'
        );

      const fetchAllQuestionDisciplineIds = (discIds: string[]) =>
        fetchAllIdsByInFilter(
          'question_disciplines',
          'question_id',
          'study_discipline_id',
          discIds,
          (q) => q.eq('questions.is_active', true),
          'question_id, questions!inner(is_active)'
        );

      const fetchAllNotebookQuestionIds = (notebookIds: string[]) =>
        fetchAllIdsByInFilter(
          'admin_notebook_questions',
          'question_id',
          'notebook_id',
          notebookIds,
          (q) => q.eq('questions.is_active', true),
          'question_id, questions!inner(is_active)'
        );

      const fetchDirectQuestionsByTopic = (topicIds: string[]) =>
        fetchAllIdsByInFilter('questions', 'id', 'study_topic_id', topicIds, (q) => q.eq('is_active', true));

      const fetchDirectQuestionsByDiscipline = (discIds: string[]) =>
        fetchAllIdsByInFilter('questions', 'id', 'study_discipline_id', discIds, (q) => q.eq('is_active', true));

      // Get question IDs from N:N tables if discipline/topic filters are applied
      // OR from edital mappings if school is post-edital OR direct edital access
      let questionIdsFromNtoN: string[] | null = null;
      let totalFromNtoN = 0;

      // For POST-EDITAL schools: filter questions via school_disciplines -> study_topics -> questions
      if (filters.schoolId && !filters.isPreEdital) {
        const idsSet = new Set<string>();
        
        // 1. Get discipline IDs linked to this school via school_disciplines
        const { data: schoolDisciplinesData } = await withAbortSignal(
          supabase
            .from('school_disciplines')
            .select('discipline_id')
            .eq('school_id', filters.schoolId)
            .eq('is_active', true),
          signal
        );
        
        const schoolDisciplineIds = (schoolDisciplinesData || []).map((sd) => sd.discipline_id);
        
        if (schoolDisciplineIds.length > 0) {
          // Apply discipline filter if set (intersect)
          let disciplineIdsToQuery = schoolDisciplineIds;
          if (filters.disciplines.length > 0) {
            const selectedSet = new Set(filters.disciplines);
            disciplineIdsToQuery = schoolDisciplineIds.filter((d) => selectedSet.has(d));
          }
          
          if (disciplineIdsToQuery.length > 0) {
            // 2. Get topic IDs for these disciplines
              const { data: topicsData } = await withAbortSignal(
                supabase
                  .from('study_topics')
                  .select('id, source_notebook_id')
                  .in('study_discipline_id', disciplineIdsToQuery)
                  .or('is_active.is.null,is_active.eq.true'),
                signal
              );
            
            let topicIdsToQuery = (topicsData || []).map((t) => t.id);
            
            // Apply topic filter if set (intersect)
            if (filters.topics.length > 0) {
              const selectedSet = new Set(filters.topics);
              topicIdsToQuery = topicIdsToQuery.filter((t) => selectedSet.has(t));
            }
            
            if (topicIdsToQuery.length > 0) {
              // 3. Get questions linked via N:N topic table
              const topicLinks = await fetchAllQuestionTopicIds(topicIdsToQuery);
              topicLinks.forEach((id) => idsSet.add(id));
              
              // Also include questions with direct study_topic_id
              const directTopic = await fetchDirectQuestionsByTopic(topicIdsToQuery);
              directTopic.forEach((id) => idsSet.add(id));
              
              // Also include questions from admin_notebook_questions if topic has source_notebook_id
              const notebookIds = (topicsData || [])
                .filter((t) => t.source_notebook_id && topicIdsToQuery.includes(t.id))
                .map((t) => t.source_notebook_id) as string[];
              
              if (notebookIds.length > 0) {
                const notebookQuestions = await fetchAllNotebookQuestionIds(notebookIds);
                notebookQuestions.forEach((id) => idsSet.add(id));
              }
            }
            
            // Also get questions linked directly to disciplines via N:N and direct field
            if (filters.topics.length === 0) {
              const disciplineLinks = await fetchAllQuestionDisciplineIds(disciplineIdsToQuery);
              disciplineLinks.forEach((id) => idsSet.add(id));
              
              const directDiscipline = await fetchDirectQuestionsByDiscipline(disciplineIdsToQuery);
              directDiscipline.forEach((id) => idsSet.add(id));
            }
          }
        }
        
        questionIdsFromNtoN = Array.from(idsSet);
        
        // If no matching questions found for post-edital, return empty results
        if (questionIdsFromNtoN.length === 0) {
          if (!isActive()) {
            debugLog?.("STALE_RESPONSE_IGNORED", {
              requestId,
              activeRequestId: activeRequestIdRef.current,
              reason: "post_edital_empty_results",
            });
            return;
          }
          setQuestions([]);
          setTotalCount(0);
          setTotalPages(0);
          setCurrentPage(page);
          return;
        }
        
        totalFromNtoN = questionIdsFromNtoN.length;
        questionIdsFromNtoN.sort();
        questionIdsFromNtoN = questionIdsFromNtoN.slice(from, to + 1);
      } else if (filters.editalId && !filters.schoolId) {
        // DIRECT EDITAL ACCESS (no school selected): filter via edital_disciplines
        const idsSet = new Set<string>();
        
        // 1. Get discipline IDs linked to this edital via edital_disciplines
        const { data: editalDisciplinesData } = await withAbortSignal(
          supabase
            .from('edital_disciplines')
            .select('discipline_id')
            .eq('edital_id', filters.editalId)
            .eq('is_active', true),
          signal
        );
        
        const editalDisciplineIds = (editalDisciplinesData || []).map((ed) => ed.discipline_id);
        
        if (editalDisciplineIds.length > 0) {
          // Apply discipline filter if set (intersect)
          let disciplineIdsToQuery = editalDisciplineIds;
          if (filters.disciplines.length > 0) {
            const selectedSet = new Set(filters.disciplines);
            disciplineIdsToQuery = editalDisciplineIds.filter((d) => selectedSet.has(d));
          }
          
          if (disciplineIdsToQuery.length > 0) {
            // 2. Get topic IDs for these disciplines
              const { data: topicsData } = await withAbortSignal(
                supabase
                  .from('study_topics')
                  .select('id, source_notebook_id')
                  .in('study_discipline_id', disciplineIdsToQuery)
                  .or('is_active.is.null,is_active.eq.true'),
                signal
              );
            
            let topicIdsToQuery = (topicsData || []).map((t) => t.id);
            
            // Apply topic filter if set (intersect)
            if (filters.topics.length > 0) {
              const selectedSet = new Set(filters.topics);
              topicIdsToQuery = topicIdsToQuery.filter((t) => selectedSet.has(t));
            }
            
            if (topicIdsToQuery.length > 0) {
              // 3. Get questions linked via N:N topic table
              const topicLinks = await fetchAllQuestionTopicIds(topicIdsToQuery);
              topicLinks.forEach((id) => idsSet.add(id));
              
              // Also include questions with direct study_topic_id
              const directTopic = await fetchDirectQuestionsByTopic(topicIdsToQuery);
              directTopic.forEach((id) => idsSet.add(id));
              
              // Also include questions from admin_notebook_questions if topic has source_notebook_id
              const notebookIds = (topicsData || [])
                .filter((t) => t.source_notebook_id && topicIdsToQuery.includes(t.id))
                .map((t) => t.source_notebook_id) as string[];
              
              if (notebookIds.length > 0) {
                const notebookQuestions = await fetchAllNotebookQuestionIds(notebookIds);
                notebookQuestions.forEach((id) => idsSet.add(id));
              }
            }
            
            // Also get questions linked directly to disciplines via N:N and direct field
            if (filters.topics.length === 0) {
              const disciplineLinks = await fetchAllQuestionDisciplineIds(disciplineIdsToQuery);
              disciplineLinks.forEach((id) => idsSet.add(id));
              
              const directDiscipline = await fetchDirectQuestionsByDiscipline(disciplineIdsToQuery);
              directDiscipline.forEach((id) => idsSet.add(id));
            }
          }
        }
        
        questionIdsFromNtoN = Array.from(idsSet);
        
        // If no matching questions found for direct edital, return empty results
        if (questionIdsFromNtoN.length === 0) {
          if (!isActive()) {
            debugLog?.("STALE_RESPONSE_IGNORED", {
              requestId,
              activeRequestId: activeRequestIdRef.current,
              reason: "direct_edital_empty_results",
            });
            return;
          }
          setQuestions([]);
          setTotalCount(0);
          setTotalPages(0);
          setCurrentPage(page);
          return;
        }
        
        totalFromNtoN = questionIdsFromNtoN.length;
        questionIdsFromNtoN.sort();
        questionIdsFromNtoN = questionIdsFromNtoN.slice(from, to + 1);
      } else if (filters.disciplines.length > 0 || filters.topics.length > 0) {
        // PRE-EDITAL or no school: use existing discipline/topic filter logic
        const idsSet = new Set<string>();
        
        // If topics are selected, prioritize topic filter (topics already belong to disciplines)
        if (filters.topics.length > 0) {
          // Get questions linked via N:N topic table - NO LIMIT
          const topicLinks = await fetchAllQuestionTopicIds(filters.topics);
          topicLinks.forEach(id => idsSet.add(id));
          
          // Also include questions with direct topic_id (legacy) - NO LIMIT
          const directTopic = await fetchDirectQuestionsByTopic(filters.topics);
          directTopic.forEach(id => idsSet.add(id));
          
          // Also include questions from admin_notebook_questions if topic has source_notebook_id
          const { data: topicNotebooks } = await supabase
            .from('study_topics')
            .select('source_notebook_id')
            .in('id', filters.topics)
            .not('source_notebook_id', 'is', null);
          
          if (topicNotebooks && topicNotebooks.length > 0) {
            const notebookIds = topicNotebooks.map(t => t.source_notebook_id).filter(Boolean) as string[];
            if (notebookIds.length > 0) {
              const notebookQuestions = await fetchAllNotebookQuestionIds(notebookIds);
              notebookQuestions.forEach(id => idsSet.add(id));
            }
          }
          
          questionIdsFromNtoN = Array.from(idsSet);
        } else if (filters.disciplines.length > 0) {
          // Only discipline filter (no topic selected)
          // Get questions linked via N:N discipline table - NO LIMIT
          const disciplineLinks = await fetchAllQuestionDisciplineIds(filters.disciplines);
          disciplineLinks.forEach(id => idsSet.add(id));
          
          // Also include questions with direct discipline_id (legacy) - NO LIMIT
          const directDiscipline = await fetchDirectQuestionsByDiscipline(filters.disciplines);
          directDiscipline.forEach(id => idsSet.add(id));
          
          // Also include questions from admin_notebook_questions via folder
          const { data: disciplineFolders } = await supabase
            .from('study_disciplines')
            .select('source_notebook_folder_id')
            .in('id', filters.disciplines)
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
                const notebookQuestions = await fetchAllNotebookQuestionIds(notebookIds);
                notebookQuestions.forEach(id => idsSet.add(id));
              }
            }
          }
          
          questionIdsFromNtoN = Array.from(idsSet);
        }

        // If no matching questions found, return empty results early
        if (questionIdsFromNtoN && questionIdsFromNtoN.length === 0) {
          // Guard de concorrência
          if (!isActive()) {
            debugLog?.("STALE_RESPONSE_IGNORED", {
              requestId,
              activeRequestId: activeRequestIdRef.current,
              reason: "empty_n2n_results",
            });
            return;
          }
          
          debugLog?.("FETCH_COMPLETE", {
            requestId,
            page,
            totalCount: 0,
            reason: "empty_n2n_results",
          });
          
          setQuestions([]);
          setTotalCount(0);
          setTotalPages(0);
          setCurrentPage(page);
          return;
        }
        
        if (questionIdsFromNtoN) {
          // Store total count before slicing for pagination
          totalFromNtoN = questionIdsFromNtoN.length;
          
          // Paginate the IDs array itself to avoid sending huge arrays in .in() queries
          // Sort for consistent pagination
          questionIdsFromNtoN.sort();
          questionIdsFromNtoN = questionIdsFromNtoN.slice(from, to + 1);
        }
      }

      // PERF: Mark build query end
      perf.markBuildQueryEnd();

      // Build base query
      let query = withAbortSignal(
        supabase
        .from('questions_for_students')
        .select(`
          id, code, question, associated_text, images, option_a, option_b, option_c, option_d, option_e,
          question_type, difficulty, keys, related_contents, year,
          banca_id, orgao_id, prova_id, study_discipline_id, study_topic_id,
          position_id, is_active, created_at, updated_at,
          bancas(name),
          orgaos(name),
          provas(name),
          study_disciplines(name),
          study_topics(name)
        `, { count: 'exact' }),
        signal
      );

      // Apply N:N filter by question IDs
      if (questionIdsFromNtoN !== null) {
        query = query.in('id', questionIdsFromNtoN);
      }

      // Apply other filters
      if (filters.keyword) {
        query = query.or(`question.ilike.%${filters.keyword}%,code.ilike.%${filters.keyword}%`);
      }
      if (filters.questionTypes.length > 0) query = query.in('question_type', filters.questionTypes);
      if (filters.bancas.length > 0) query = query.in('banca_id', filters.bancas);
      if (filters.orgaos.length > 0) query = query.in('orgao_id', filters.orgaos);
      if (filters.provas.length > 0) query = query.in('prova_id', filters.provas);
      if (filters.years.length > 0) query = query.in('year', filters.years.map(y => parseInt(y)));

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      let data: any[] | null = null;
      let error: any = null;
      let count: number | null = null;

      // PERF: Mark DB request start
      perf.markDbRequestStart();

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          // When using N:N filtering, we already sliced the IDs for pagination
          // So don't apply .range() again - just order the results
          let finalQuery = query.order('created_at', { ascending: false });
          
          if (questionIdsFromNtoN === null) {
            // Only apply range when NOT using N:N filter (normal pagination)
            finalQuery = finalQuery.range(from, to);
          }
          
          debugLog?.("FETCH_QUERY", {
            requestId,
            page,
            params: {
              from,
              to,
              pageSize: PAGE_SIZE,
              hasN2N: questionIdsFromNtoN !== null,
              n2nIdsCount: Array.isArray(questionIdsFromNtoN) ? questionIdsFromNtoN.length : null,
              orderBy: "created_at desc",
            },
          });

          const res = await withAbortSignal(finalQuery, signal);

          data = res.data as any;
          error = res.error;
          // Use pre-calculated count for N:N, otherwise use query count
          count = totalFromNtoN > 0 ? totalFromNtoN : res.count;
          
          // PERF: Estimate payload size
          const payloadSize = estimateResponseSize(data);
          perf.markDbRequestEnd(payloadSize);
          
          break;
        } catch (e: any) {
          const isNetworkError = e instanceof TypeError && String(e.message || '').toLowerCase().includes('fetch');
          if (!isNetworkError || attempt === 1) throw e;
          await sleep(500 * (attempt + 1));
        }
      }

      if (error) throw error;

      // PERF: Mark JSON parse start (processing response data)
      perf.markJsonParseStart();

      // Get user answers if logged in
      let userAnswers: { question_id: string; is_correct: boolean; selected_answer: string }[] = [];
      let questionDisciplines: { question_id: string; study_disciplines: { id: string; name: string } }[] = [];
      let questionTopics: { question_id: string; study_topics: { id: string; name: string } }[] = [];
      
      if (data && data.length > 0) {
        const questionIds = data.map((q: any) => q.id);
        
        // Fetch N:N disciplines and topics for all questions
        const [disciplinesRes, topicsRes] = await Promise.all([
          withAbortSignal(
            supabase
              .from('question_disciplines')
              .select('question_id, study_disciplines(id, name)')
              .in('question_id', questionIds)
              .is('deleted_at', null),
            signal
          ),
          withAbortSignal(
            supabase
              .from('question_topics')
              .select('question_id, study_topics(id, name)')
              .in('question_id', questionIds)
              .is('deleted_at', null),
            signal
          ),
        ]);
        
        questionDisciplines = (disciplinesRes.data || []) as any;
        questionTopics = (topicsRes.data || []) as any;
        
        if (userId) {
          const { data: answersData } = await withAbortSignal(
            supabase
              .from('user_answers')
              .select('question_id, is_correct, selected_answer')
              .eq('user_id', userId)
              .in('question_id', questionIds),
            signal
          );
          
          userAnswers = answersData || [];
        }
      }

      // Map questions with joined data and user answers
      const mappedQuestions: Question[] = (data || []).map((q: any) => {
        const userAnswer = userAnswers.find(a => a.question_id === q.id);
        
        // Get all disciplines for this question from N:N table
        const allDisciplines = questionDisciplines
          .filter(qd => qd.question_id === q.id && qd.study_disciplines)
          .map(qd => qd.study_disciplines);
        
        // Get all topics for this question from N:N table
        const allTopics = questionTopics
          .filter(qt => qt.question_id === q.id && qt.study_topics)
          .map(qt => qt.study_topics);
        
        return {
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
          banca_name: q.bancas?.name,
          orgao_name: q.orgaos?.name,
          prova_name: q.provas?.name,
          discipline_name: q.study_disciplines?.name,
          topic_name: q.study_topics?.name,
          all_disciplines: allDisciplines.length > 0 ? allDisciplines : (q.study_disciplines ? [{ id: q.study_discipline_id, name: q.study_disciplines.name }] : []),
          all_topics: allTopics.length > 0 ? allTopics : (q.study_topics ? [{ id: q.study_topic_id, name: q.study_topics.name }] : []),
          user_answered: !!userAnswer,
          user_is_correct: userAnswer?.is_correct
        };
      });

      // PERF: Mark JSON parse end
      perf.markJsonParseEnd();

      // Filter by status if needed
      let filteredQuestions = mappedQuestions;
      if (filters.status === 'answered') {
        filteredQuestions = mappedQuestions.filter(q => q.user_answered);
      } else if (filters.status === 'not_answered') {
        filteredQuestions = mappedQuestions.filter(q => !q.user_answered);
      } else if (filters.status === 'correct') {
        filteredQuestions = mappedQuestions.filter(q => q.user_answered && q.user_is_correct);
      } else if (filters.status === 'wrong') {
        filteredQuestions = mappedQuestions.filter(q => q.user_answered && !q.user_is_correct);
      }

      // Guard de concorrência: só aplica se esta é a requisição ativa
      if (!isActive()) {
        debugLog?.("STALE_RESPONSE_IGNORED", {
          requestId,
          activeRequestId: activeRequestIdRef.current,
          reason: "main_query_response",
          questionsCount: filteredQuestions.length,
          totalCount: count,
        });
        return;
      }
      
      debugLog?.("FETCH_COMPLETE", {
        requestId,
        page,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / PAGE_SIZE),
        questionsReturned: filteredQuestions.length,
        isActive: true,
        activeRequestId: activeRequestIdRef.current,
      });

      // PERF: Mark state update start
      perf.markStateUpdateStart();

      setQuestions(filteredQuestions);
      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / PAGE_SIZE));
      setCurrentPage(page);
      
      // PERF: Mark state update end
      perf.markStateUpdateEnd(filteredQuestions.length);
      
    } catch (error) {
      if (isAbortError(error)) {
        debugLog?.("FETCH_ABORTED", {
          requestId,
          activeRequestId: activeRequestIdRef.current,
          reason: "abort_signal",
        });
        return;
      }

      console.error('Error loading questions:', error);
      debugLog?.("FETCH_ERROR", {
        requestId,
        activeRequestId: activeRequestIdRef.current,
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
  };

  // Atualiza filtros PENDENTES (não aplicados até clicar em "Filtrar")
  const updateFilter = (key: keyof Filters, value: string | string[]) => {
    setPendingFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      
      // Clear dependent filters when parent changes
      if (key === 'disciplines') {
        newFilters.topics = [];
      }
      if (key === 'bancas' || key === 'orgaos') {
        newFilters.provas = [];
      }
      
      return newFilters;
    });
  };

  type ArrayFilterKey = 'bancas' | 'orgaos' | 'disciplines' | 'years' | 'questionTypes' | 'provas' | 'topics';

  // Atualiza filtros PENDENTES (não aplicados até clicar em "Filtrar")
  const toggleArrayFilter = (key: ArrayFilterKey, value: string) => {
    setPendingFilters(prev => {
      const currentArray = prev[key];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(v => v !== value)
        : [...currentArray, value];
      
      const newFilters = { ...prev, [key]: newArray };
      
      // Clear dependent filters
      if (key === 'disciplines') {
        newFilters.topics = [];
      }
      if (key === 'bancas' || key === 'orgaos') {
        newFilters.provas = [];
      }
      
      return newFilters;
    });
  };

  // Aplica os filtros pendentes (botão "Filtrar")
  const applyFilters = useCallback(() => {
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

  // Generate years array
  const years = Array.from({ length: 75 }, (_, i) => (new Date().getFullYear() - i).toString());

  // Atualiza apenas schoolId/isPreEdital sem resetar os demais filtros
  const setSchoolId = useCallback((schoolId: string | null, isPreEdital: boolean = true) => {
    const update = (prev: Filters): Filters => {
      const nextSchoolId = schoolId ?? null;

      // Evita loop de re-render: só atualiza se o valor mudou.
      if (prev.schoolId === nextSchoolId && prev.isPreEdital === isPreEdital) return prev;

      return {
        ...prev,
        schoolId: nextSchoolId,
        isPreEdital,
      };
    };

    setFilters(update);
    setPendingFilters(update);
  }, []);

  const setEditalId = useCallback((editalId: string | null) => {
    const update = (prev: Filters): Filters => {
      const nextEditalId = editalId ?? null;

      // Evita loop de re-render: só atualiza se o valor mudou.
      if (prev.editalId === nextEditalId) return prev;

      return {
        ...prev, // Mantém schoolId e isPreEdital existentes
        editalId: nextEditalId,
      };
    };
    setFilters(update);
    setPendingFilters(update);
  }, []);

  // Hidrata o estado completo de uma vez (usado para restauração do localStorage)
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

  // We track a "version" that only bumps when filters really change from user interaction
  // This prevents re-fetching when only loadQuestions callback identity changes
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

    // Se por algum motivo a seleção “sumir”, NÃO recarrega tudo (evita voltar ao conjunto completo)
    const hasScope =
      !!filters.schoolId ||
      !!filters.editalId ||
      filters.disciplines.length > 0 ||
      filters.topics.length > 0;

    if (!hasScope) {
      setIsLoading(false);
      return;
    }

    loadQuestions(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, filtersVersion, userId]);

  return {
    questions,
    isLoading,
    currentPage,
    totalPages,
    totalCount,
    filters,
    pendingFilters,
    hasPendingChanges,
    bancas,
    orgaos,
    provas,
    disciplines,
    topics,
    years,
    loadQuestions,
    submitAnswer,
    clearFilters,
    updateFilter,
    toggleArrayFilter,
    applyFilters,
    setCurrentPage,
    setSchoolId,
    setEditalId,
    hydrateState,
    // Performance tracking
    perfTracker: perfTrackerRef.current,
    setLoadTrigger: (trigger: LoadTrigger) => { loadTriggerRef.current = trigger; },
  };
}
