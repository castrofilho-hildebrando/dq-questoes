import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CacheEntry {
  ids: string[];
  timestamp: number;
}

type CacheKey = `edital:${string}` | `discipline:${string}` | `topic:${string}`;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Hook for caching question IDs by edital/discipline/topic.
 * Uses unified logic (N:N + direct + notebooks) to fetch all question IDs.
 */
export function useQuestionIdsCache() {
  const cacheRef = useRef<Map<CacheKey, CacheEntry>>(new Map());
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Helper to fetch all IDs without limit (paginating if needed)
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
        data.forEach((row) => allIds.push(row.question_id));
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
        data.forEach((row) => allIds.push(row.question_id));
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else { hasMore = false; }
    }
    return allIds;
  };

  // Fetch notebook questions ONE notebook at a time to avoid 400 error from long URL
  const fetchNotebookQuestionIds = async (notebookIds: string[]): Promise<string[]> => {
    const allIds: string[] = [];
    const batchSize = 1000;
    
    // Process each notebook individually to avoid URL length issues
    for (const notebookId of notebookIds) {
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('admin_notebook_questions')
          .select('question_id')
          .eq('notebook_id', notebookId) // Single ID, not .in()
          .range(offset, offset + batchSize - 1);
        
        if (error) { 
          console.error('Error fetching admin_notebook_questions for notebook:', notebookId, error); 
          break; 
        }
        if (data && data.length > 0) {
          data.forEach((row) => allIds.push(row.question_id));
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else { 
          hasMore = false; 
        }
      }
    }
    return allIds;
  };

  // Fetch questions by topic using unified logic (N:N + direct + notebooks)
  const fetchQuestionIdsByTopic = async (topicId: string): Promise<string[]> => {
    const idsSet = new Set<string>();

    // 1. From question_topics (N:N)
    const topicLinks = await fetchQuestionTopicIds([topicId]);
    topicLinks.forEach(id => idsSet.add(id));

    // 2. Direct from questions.study_topic_id
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('questions')
        .select('id')
        .eq('study_topic_id', topicId)
        .eq('is_active', true)
        .range(offset, offset + 999);
      
      if (error) break;
      if (data && data.length > 0) {
        data.forEach(q => idsSet.add(q.id));
        offset += 1000;
        hasMore = data.length === 1000;
      } else { hasMore = false; }
    }

    // 3. From admin_notebook_questions via source_notebook_id
    const { data: topicData } = await supabase
      .from('study_topics')
      .select('source_notebook_id')
      .eq('id', topicId)
      .single();
    
    if (topicData?.source_notebook_id) {
      const notebookQuestions = await fetchNotebookQuestionIds([topicData.source_notebook_id]);
      notebookQuestions.forEach(id => idsSet.add(id));
    }

    return Array.from(idsSet);
  };

  // Fetch questions by discipline using unified logic
  const fetchQuestionIdsByDiscipline = async (disciplineId: string): Promise<string[]> => {
    const idsSet = new Set<string>();

    // 1. From question_disciplines (N:N)
    const discLinks = await fetchQuestionDisciplineIds([disciplineId]);
    discLinks.forEach(id => idsSet.add(id));

    // 2. Direct from questions.study_discipline_id
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('questions')
        .select('id')
        .eq('study_discipline_id', disciplineId)
        .eq('is_active', true)
        .range(offset, offset + 999);
      
      if (error) break;
      if (data && data.length > 0) {
        data.forEach(q => idsSet.add(q.id));
        offset += 1000;
        hasMore = data.length === 1000;
      } else { hasMore = false; }
    }

    // 3. Get topics for this discipline and their notebooks
    const { data: topics } = await supabase
      .from('study_topics')
      .select('id, source_notebook_id')
      .eq('study_discipline_id', disciplineId)
      .eq('is_active', true);
    
    if (topics && topics.length > 0) {
      // Get IDs from topic N:N
      const topicIds = topics.map(t => t.id);
      const topicQuestions = await fetchQuestionTopicIds(topicIds);
      topicQuestions.forEach(id => idsSet.add(id));

      // Get IDs from notebooks
      const notebookIds = topics
        .filter(t => t.source_notebook_id)
        .map(t => t.source_notebook_id!);
      
      if (notebookIds.length > 0) {
        const notebookQuestions = await fetchNotebookQuestionIds(notebookIds);
        notebookQuestions.forEach(id => idsSet.add(id));
      }
    }

    // 4. Also check source_notebook_folder for discipline level notebooks
    const { data: disciplineData } = await supabase
      .from('study_disciplines')
      .select('source_notebook_folder_id')
      .eq('id', disciplineId)
      .single();
    
    if (disciplineData?.source_notebook_folder_id) {
      const { data: folderNotebooks } = await supabase
        .from('admin_question_notebooks')
        .select('id')
        .eq('folder_id', disciplineData.source_notebook_folder_id);
      
      if (folderNotebooks && folderNotebooks.length > 0) {
        const nbIds = folderNotebooks.map(n => n.id);
        const folderQuestions = await fetchNotebookQuestionIds(nbIds);
        folderQuestions.forEach(id => idsSet.add(id));
      }
    }

    return Array.from(idsSet);
  };

  // Fetch questions by edital - aggregates all disciplines via edital_disciplines
  const fetchQuestionIdsByEdital = async (editalId: string): Promise<string[]> => {
    // Get all disciplines linked to this edital via edital_disciplines
    const { data: editalDisciplines } = await supabase
      .from('edital_disciplines')
      .select('discipline_id')
      .eq('edital_id', editalId)
      .eq('is_active', true);
    
    if (!editalDisciplines || editalDisciplines.length === 0) {
      return [];
    }

    const idsSet = new Set<string>();
    const disciplineIds = editalDisciplines.map(ed => ed.discipline_id);

    // 1. From question_disciplines (N:N)
    const discLinks = await fetchQuestionDisciplineIds(disciplineIds);
    discLinks.forEach(id => idsSet.add(id));

    // 2. Direct from questions.study_discipline_id
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('questions')
        .select('id')
        .in('study_discipline_id', disciplineIds)
        .eq('is_active', true)
        .range(offset, offset + 999);
      
      if (error) break;
      if (data && data.length > 0) {
        data.forEach(q => idsSet.add(q.id));
        offset += 1000;
        hasMore = data.length === 1000;
      } else { hasMore = false; }
    }

    // 3. Get all topics for these disciplines
    const { data: topics } = await supabase
      .from('study_topics')
      .select('id, source_notebook_id')
      .in('study_discipline_id', disciplineIds)
      .eq('is_active', true);
    
    if (topics && topics.length > 0) {
      // Get IDs from topic N:N
      const topicIds = topics.map(t => t.id);
      
      // Batch fetch topic questions
      const topicQuestions = await fetchQuestionTopicIds(topicIds);
      topicQuestions.forEach(id => idsSet.add(id));

      // Get IDs from direct topic
      offset = 0;
      hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('questions')
          .select('id')
          .in('study_topic_id', topicIds)
          .eq('is_active', true)
          .range(offset, offset + 999);
        
        if (error) break;
        if (data && data.length > 0) {
          data.forEach(q => idsSet.add(q.id));
          offset += 1000;
          hasMore = data.length === 1000;
        } else { hasMore = false; }
      }

      // Get IDs from notebooks
      const notebookIds = topics
        .filter(t => t.source_notebook_id)
        .map(t => t.source_notebook_id!);
      
      if (notebookIds.length > 0) {
        const notebookQuestions = await fetchNotebookQuestionIds(notebookIds);
        notebookQuestions.forEach(id => idsSet.add(id));
      }
    }

    return Array.from(idsSet);
  };

  // Get cached IDs or fetch and cache
  const getQuestionIds = useCallback(async (
    type: 'edital' | 'discipline' | 'topic',
    id: string,
    forceRefresh = false
  ): Promise<string[]> => {
    const cacheKey: CacheKey = `${type}:${id}`;
    
    // Check cache
    const cached = cacheRef.current.get(cacheKey);
    if (cached && !forceRefresh && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.ids;
    }

    // Set loading state
    setLoading(prev => ({ ...prev, [cacheKey]: true }));

    try {
      let ids: string[];
      
      switch (type) {
        case 'edital':
          ids = await fetchQuestionIdsByEdital(id);
          break;
        case 'discipline':
          ids = await fetchQuestionIdsByDiscipline(id);
          break;
        case 'topic':
          ids = await fetchQuestionIdsByTopic(id);
          break;
      }

      // Store in cache
      cacheRef.current.set(cacheKey, { ids, timestamp: Date.now() });
      
      // Update counts
      setCounts(prev => ({ ...prev, [cacheKey]: ids.length }));
      
      return ids;
    } finally {
      setLoading(prev => ({ ...prev, [cacheKey]: false }));
    }
  }, []);

  // Get count from cache (returns undefined if not cached)
  const getCount = useCallback((type: 'edital' | 'discipline' | 'topic', id: string): number | undefined => {
    const cacheKey: CacheKey = `${type}:${id}`;
    return counts[cacheKey];
  }, [counts]);

  // Check if loading
  const isLoading = useCallback((type: 'edital' | 'discipline' | 'topic', id: string): boolean => {
    const cacheKey: CacheKey = `${type}:${id}`;
    return loading[cacheKey] || false;
  }, [loading]);

  // Prefetch counts for multiple editais
  const prefetchEditalCounts = useCallback(async (editalIds: string[]) => {
    const promises = editalIds.map(id => getQuestionIds('edital', id));
    await Promise.all(promises);
  }, [getQuestionIds]);

  // Invalidate cache entry
  const invalidate = useCallback((type?: 'edital' | 'discipline' | 'topic', id?: string) => {
    if (type && id) {
      const cacheKey: CacheKey = `${type}:${id}`;
      cacheRef.current.delete(cacheKey);
      setCounts(prev => {
        const next = { ...prev };
        delete next[cacheKey];
        return next;
      });
    } else {
      cacheRef.current.clear();
      setCounts({});
    }
  }, []);

  // Listen for realtime changes and invalidate cache
  // DEBOUNCED to prevent cascading invalidations during bulk operations
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    const handleRealtimeChange = () => {
      // Clear any pending invalidation
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // Debounce: wait 2 seconds before invalidating to batch multiple changes
      debounceTimerRef.current = setTimeout(() => {
        console.log('[useQuestionIdsCache] Debounced invalidation triggered by realtime change');
        invalidate();
      }, 2000);
    };

    const channel = supabase
      .channel('question-ids-cache')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'question_disciplines' },
        handleRealtimeChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'question_topics' },
        handleRealtimeChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_notebook_questions' },
        handleRealtimeChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'school_disciplines' },
        handleRealtimeChange
      )
      .subscribe();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [invalidate]);

  return {
    getQuestionIds,
    getCount,
    isLoading,
    prefetchEditalCounts,
    invalidate,
    counts,
  };
}

// Singleton instance for cross-component sharing
let sharedCacheInstance: ReturnType<typeof useQuestionIdsCache> | null = null;

export function getSharedQuestionIdsCache() {
  return sharedCacheInstance;
}

export function setSharedQuestionIdsCache(instance: ReturnType<typeof useQuestionIdsCache>) {
  sharedCacheInstance = instance;
}
