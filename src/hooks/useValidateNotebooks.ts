import { supabase } from "@/integrations/supabase/client";
import { sanitizeNotebookIds, isValidUUID } from "@/lib/sanitizeNotebookIds";

// Re-export for backwards compatibility
export { isValidUUID };

/**
 * Filters an array of notebook IDs to only valid UUIDs
 * Uses the shared sanitizeNotebookIds utility
 */
export function filterValidUUIDs(ids: string[] | null | undefined): string[] {
  return sanitizeNotebookIds(ids);
}

export interface NotebookValidationResult {
  validNotebookIds: string[];
  fallbackNotebookId: string | null;
  hasValidNotebooks: boolean;
  shouldUseBancoQuestoes: boolean;
}

/**
 * Validates notebook IDs against the database (RLS will filter inactive)
 * Returns only IDs that exist AND are active AND have questions (visible via RLS)
 * 
 * CORREÇÃO: Agora também verifica se o caderno tem questões (question_count > 0)
 * para evitar abrir cadernos vazios.
 */
/**
 * Validates notebook IDs against the database (RLS will filter inactive)
 * Returns only IDs that exist AND are active AND have questions (REAL count, not cached)
 * 
 * CORREÇÃO CRÍTICA: Agora conta questões reais em admin_notebook_questions
 * em vez de confiar no question_count que pode estar dessincronizado.
 */
export async function validateNotebookIds(
  notebookIds: string[] | null | undefined,
  sourceNotebookId: string | null | undefined
): Promise<NotebookValidationResult> {
  console.log('[validateNotebookIds] Starting validation:', {
    notebookIds,
    sourceNotebookId,
    notebookIdsCount: notebookIds?.length || 0
  });
  
  // Step 1: Filter to valid UUIDs only
  const validUUIDs = filterValidUUIDs(notebookIds);
  console.log('[validateNotebookIds] Valid UUIDs after filtering:', validUUIDs);
  
  // Step 2: Check which ones actually exist in DB, are active, AND have REAL questions
  let existingNotebookIds: string[] = [];
  
  if (validUUIDs.length > 0) {
    try {
      // Buscar notebooks ativos
      const { data: notebooks, error: nbError } = await supabase
        .from('admin_question_notebooks')
        .select('id, name, is_active')
        .in('id', validUUIDs)
        .eq('is_active', true);
      
      console.log('[validateNotebookIds] Notebooks query result:', {
        requested: validUUIDs,
        found: notebooks?.length || 0,
        error: nbError?.message || null,
        notebooks: notebooks?.map(n => ({ id: n.id, name: n.name }))
      });
      
      if (nbError) {
        console.error('[validateNotebookIds] Error fetching notebooks:', nbError);
      } else if (notebooks && notebooks.length > 0) {
        // Para cada notebook, verificar se tem questões REAIS (não deleted)
        const notebookIdsToCheck = notebooks.map(n => n.id);
        
        // Contar questões reais por notebook (ignorando deleted_at)
        const { data: questionCounts, error: countError } = await supabase
          .from('admin_notebook_questions')
          .select('notebook_id')
          .in('notebook_id', notebookIdsToCheck)
          .is('deleted_at', null);
        
        console.log('[validateNotebookIds] Question counts query result:', {
          notebooksChecked: notebookIdsToCheck.length,
          questionsFound: questionCounts?.length || 0,
          error: countError?.message || null
        });
        
        if (countError) {
          console.error('[validateNotebookIds] Error counting questions:', countError);
          // Fallback: aceitar todos os notebooks ativos encontrados
          existingNotebookIds = notebookIdsToCheck;
        } else if (questionCounts) {
          // Contar quantas questões cada notebook tem
          const countMap = new Map<string, number>();
          for (const q of questionCounts) {
            countMap.set(q.notebook_id, (countMap.get(q.notebook_id) || 0) + 1);
          }
          
          // Log counts per notebook
          console.log('[validateNotebookIds] Question counts per notebook:', 
            Object.fromEntries(countMap)
          );
          
          // Filtrar apenas notebooks com questões reais > 0
          existingNotebookIds = notebookIdsToCheck.filter(id => (countMap.get(id) || 0) > 0);
          
          // Log para debug
          const emptyNotebooks = notebookIdsToCheck.filter(id => (countMap.get(id) || 0) === 0);
          if (emptyNotebooks.length > 0) {
            console.warn(
              `[validateNotebookIds] Filtered out ${emptyNotebooks.length} empty notebooks (real count):`,
              emptyNotebooks
            );
          }
        }
      } else {
        console.warn('[validateNotebookIds] No active notebooks found for IDs:', validUUIDs);
      }
    } catch (err) {
      console.error('[validateNotebookIds] Error checking notebooks:', err);
    }
  } else {
    console.log('[validateNotebookIds] No valid UUIDs to check');
  }
  
  // Step 3: If no valid notebooks with questions, try source_notebook_id fallback
  let fallbackNotebookId: string | null = null;
  
  if (existingNotebookIds.length === 0 && sourceNotebookId && isValidUUID(sourceNotebookId)) {
    try {
      // Verificar se notebook existe e está ativo
      const { data: notebook, error: nbError } = await supabase
        .from('admin_question_notebooks')
        .select('id')
        .eq('id', sourceNotebookId)
        .eq('is_active', true)
        .maybeSingle();
      
      if (nbError) {
        console.error('[validateNotebookIds] Error checking fallback notebook:', nbError);
      } else if (notebook) {
        // Contar questões REAIS do notebook fallback
        const { count, error: countError } = await supabase
          .from('admin_notebook_questions')
          .select('id', { count: 'exact', head: true })
          .eq('notebook_id', sourceNotebookId)
          .is('deleted_at', null);
        
        if (countError) {
          console.error('[validateNotebookIds] Error counting fallback questions:', countError);
          // Em caso de erro, aceitar o notebook (melhor ter chance de funcionar)
          fallbackNotebookId = notebook.id;
        } else if ((count ?? 0) > 0) {
          fallbackNotebookId = notebook.id;
          console.log(`[validateNotebookIds] Using fallback notebook ${sourceNotebookId} with ${count} real questions`);
        } else {
          console.warn(
            `[validateNotebookIds] Source notebook ${sourceNotebookId} exists but has 0 real questions`
          );
        }
      }
    } catch (err) {
      console.error('[validateNotebookIds] Error checking fallback notebook:', err);
    }
  }
  
  const hasValidNotebooks = existingNotebookIds.length > 0 || fallbackNotebookId !== null;
  
  const result = {
    validNotebookIds: existingNotebookIds,
    fallbackNotebookId,
    hasValidNotebooks,
    shouldUseBancoQuestoes: !hasValidNotebooks,
  };
  
  console.log('[validateNotebookIds] Final result:', result);
  
  return result;
}
