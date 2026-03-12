/**
 * Hook para validar equivalência entre o fluxo antigo e o novo (RPC)
 * 
 * Compara os IDs e ordenação das questões retornadas por ambos os métodos
 * e loga divergências como SEARCH_MISMATCH
 */

import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Filters } from '@/hooks/useQuestions';

interface ValidationResult {
  matches: boolean;
  legacyIds: string[];
  rpcIds: string[];
  missingInRpc: string[];
  missingInLegacy: string[];
  orderMismatch: boolean;
}

interface ValidationLog {
  timestamp: number;
  filters: Partial<Filters>;
  page: number;
  result: ValidationResult;
}

const VALIDATION_ENABLED = false; // Toggle para ativar validação A/B

export function useSearchEquivalenceValidator(options?: { 
  debugLog?: (event: string, payload?: unknown) => void;
  enabled?: boolean;
}) {
  const debugLog = options?.debugLog;
  const enabled = (options?.enabled ?? true) && VALIDATION_ENABLED;
  
  const validationLogsRef = useRef<ValidationLog[]>([]);
  const validationCountRef = useRef(0);
  
  const MAX_VALIDATIONS = 20; // Limitar validações para não sobrecarregar
  
  const validateEquivalence = useCallback(async (
    filters: Filters,
    page: number,
    rpcQuestionIds: string[]
  ): Promise<ValidationResult | null> => {
    if (!enabled) return null;
    if (validationCountRef.current >= MAX_VALIDATIONS) return null;
    
    validationCountRef.current++;
    
    try {
      // Chamar a RPC antiga para comparação (simplificado)
      // Na prática, isso chamaria o método legado
      const { data, error } = await supabase.rpc('search_questions', {
        p_filters: {
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
        },
        p_page: page,
        p_page_size: 10,
      });
      
      if (error) {
        console.error('Validation query error:', error);
        return null;
      }
      
      const result = data as any;
      const legacyIds = (result?.questions || []).map((q: any) => q.id);
      
      // Comparar IDs
      const legacySet = new Set(legacyIds);
      const rpcSet = new Set(rpcQuestionIds);
      
      const missingInRpc = legacyIds.filter((id: string) => !rpcSet.has(id));
      const missingInLegacy = rpcQuestionIds.filter(id => !legacySet.has(id));
      
      // Verificar ordem
      const orderMismatch = JSON.stringify(legacyIds) !== JSON.stringify(rpcQuestionIds);
      
      const validationResult: ValidationResult = {
        matches: missingInRpc.length === 0 && missingInLegacy.length === 0 && !orderMismatch,
        legacyIds,
        rpcIds: rpcQuestionIds,
        missingInRpc,
        missingInLegacy,
        orderMismatch,
      };
      
      // Log divergências
      if (!validationResult.matches) {
        console.warn('SEARCH_MISMATCH', {
          filters: {
            schoolId: filters.schoolId,
            editalId: filters.editalId,
            disciplines: filters.disciplines,
            topics: filters.topics,
          },
          page,
          missingInRpc,
          missingInLegacy,
          orderMismatch,
        });
        
        debugLog?.('SEARCH_MISMATCH', {
          filters,
          page,
          result: validationResult,
        });
      } else {
        debugLog?.('SEARCH_MATCH', { page, count: rpcQuestionIds.length });
      }
      
      // Armazenar log
      validationLogsRef.current.push({
        timestamp: Date.now(),
        filters: {
          schoolId: filters.schoolId,
          editalId: filters.editalId,
          disciplines: filters.disciplines,
          topics: filters.topics,
        },
        page,
        result: validationResult,
      });
      
      return validationResult;
    } catch (error) {
      console.error('Validation error:', error);
      return null;
    }
  }, [enabled, debugLog]);
  
  const getValidationSummary = useCallback(() => {
    const logs = validationLogsRef.current;
    const total = logs.length;
    const matches = logs.filter(l => l.result.matches).length;
    const mismatches = logs.filter(l => !l.result.matches);
    
    return {
      total,
      matches,
      mismatches: total - matches,
      mismatchDetails: mismatches,
      successRate: total > 0 ? ((matches / total) * 100).toFixed(1) + '%' : 'N/A',
    };
  }, []);
  
  const resetValidation = useCallback(() => {
    validationLogsRef.current = [];
    validationCountRef.current = 0;
  }, []);
  
  return {
    validateEquivalence,
    getValidationSummary,
    resetValidation,
    validationEnabled: enabled,
    validationLogs: validationLogsRef.current,
  };
}

export { VALIDATION_ENABLED };
