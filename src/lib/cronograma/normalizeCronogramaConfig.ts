/**
 * Sanitizador de configuração de cronograma
 * 
 * Garante consistência dos arrays de disciplinas/tópicos:
 * - discipline_order só contém IDs válidos de selected_disciplines
 * - discipline_order inclui TODAS as selected_disciplines (ordem preferida + append)
 * - selected_topics só contém disciplinas que estão em selected_disciplines
 * - topic_order só contém disciplinas que estão em selected_disciplines
 * 
 * DEVE ser usado em TODAS as telas que salvam cronograma (aluno e admin)
 */

import { cronogramaLogger } from './cronogramaLogger';

export interface CronogramaConfigInput {
  selected_disciplines: string[];
  discipline_order?: string[] | null;
  selected_topics?: Record<string, string[]> | null;
  topic_order?: Record<string, string[]> | null;
}

export interface CronogramaConfigOutput {
  selected_disciplines: string[];
  discipline_order: string[];
  selected_topics: Record<string, string[]>;
  topic_order: Record<string, string[]>;
}

/**
 * Remove duplicados de um array mantendo a ordem
 * @template T - Tipo genérico dos elementos do array
 */
function uniqueArray<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/**
 * Normaliza a configuração de cronograma para garantir consistência
 * 
 * Regras aplicadas:
 * 1. discipline_order = (IDs válidos na ordem preferida) + (IDs faltantes)
 * 2. selected_topics e topic_order filtrados para disciplinas selecionadas
 * 3. Duplicatas removidas
 * 
 * @param config - Configuração bruta do cronograma
 * @returns Configuração sanitizada e consistente
 */
export function normalizeCronogramaConfig(config: CronogramaConfigInput): CronogramaConfigOutput {
  // 1. selected_disciplines: remover duplicatas
  const selectedDisciplines = uniqueArray(config.selected_disciplines || []);
  const selectedSet = new Set(selectedDisciplines);
  
  // 2. discipline_order: filtrar válidos + completar com faltantes
  const rawOrder = config.discipline_order || [];
  
  // Filtrar apenas IDs que existem em selected_disciplines
  const validOrder = rawOrder.filter(id => selectedSet.has(id));
  
  // Detectar e logar IDs fantasmas removidos
  const removedIds = rawOrder.filter(id => !selectedSet.has(id));
  if (removedIds.length > 0) {
    cronogramaLogger.ghostIdsRemoved(removedIds, 'discipline_order');
  }
  
  // Remover duplicatas da ordem válida
  const uniqueValidOrder = uniqueArray(validOrder);
  
  // Encontrar disciplinas selecionadas que não estão na ordem
  const inOrderSet = new Set(uniqueValidOrder);
  const missing = selectedDisciplines.filter(id => !inOrderSet.has(id));
  
  // Ordem final: ordem preferida + disciplinas faltantes
  const discipline_order = [...uniqueValidOrder, ...missing];
  
  // 3. selected_topics: remover disciplinas fora do selected
  const selected_topics: Record<string, string[]> = {};
  const rawSelectedTopics = config.selected_topics || {};
  
  for (const [discId, topics] of Object.entries(rawSelectedTopics)) {
    if (selectedSet.has(discId) && Array.isArray(topics)) {
      // Remover duplicatas dos tópicos também
      selected_topics[discId] = uniqueArray(topics);
    }
  }
  
  // 4. topic_order: remover disciplinas fora do selected
  const topic_order: Record<string, string[]> = {};
  const rawTopicOrder = config.topic_order || {};
  
  for (const [discId, order] of Object.entries(rawTopicOrder)) {
    if (selectedSet.has(discId) && Array.isArray(order)) {
      // Remover duplicatas da ordem
      topic_order[discId] = uniqueArray(order);
    }
  }
  
  return {
    selected_disciplines: selectedDisciplines,
    discipline_order,
    selected_topics,
    topic_order,
  };
}

/**
 * Verifica se a configuração está consistente (para debugging)
 */
export function validateCronogramaConfig(config: CronogramaConfigOutput): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const selectedSet = new Set(config.selected_disciplines);
  
  // Verificar discipline_order
  for (const id of config.discipline_order) {
    if (!selectedSet.has(id)) {
      errors.push(`discipline_order contém ID fantasma: ${id}`);
    }
  }
  
  // Verificar se todas as selected estão na order
  for (const id of config.selected_disciplines) {
    if (!config.discipline_order.includes(id)) {
      errors.push(`selected_discipline ${id} não está em discipline_order`);
    }
  }
  
  // Verificar selected_topics
  for (const discId of Object.keys(config.selected_topics)) {
    if (!selectedSet.has(discId)) {
      errors.push(`selected_topics contém disciplina fantasma: ${discId}`);
    }
  }
  
  // Verificar topic_order
  for (const discId of Object.keys(config.topic_order)) {
    if (!selectedSet.has(discId)) {
      errors.push(`topic_order contém disciplina fantasma: ${discId}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}
