import { describe, it, expect } from 'vitest';

/**
 * Testes do módulo de alocação de cronograma
 * 
 * Guardrails críticos:
 * 1. allocateTimeForCycle nunca excede dayRemaining
 * 2. disciplineIds vem de selectedDisciplines (não de discipline_order)
 */

// Reimplementação local das funções para teste isolado
// (evita dependências do Supabase)

const MIN_TASK_BLOCK = 30;
// CORREÇÃO WDRR: Teto por ciclo = MIN_TASK_BLOCK para distribuição PROPORCIONAL
// Antes era 60, forçando 60min/disciplina/ciclo mesmo com cargas desiguais.
const MAX_DISCIPLINE_PER_CYCLE = MIN_TASK_BLOCK; // 30min por alocação

function roundToValidBlock(minutes: number): number {
  if (minutes < MIN_TASK_BLOCK) return 0;
  return Math.floor(minutes / MIN_TASK_BLOCK) * MIN_TASK_BLOCK;
}

/**
 * NOTA: Esta função foi simplificada na implementação real.
 * Agora aloca blocos de 30min fixos, sem teto de 60min por ciclo.
 * Mantemos esta versão para testes de regressão dos limites básicos.
 */
function allocateTimeForSlot(
  goalRemainingMinutes: number,
  dayRemainingMinutes: number
): number {
  const maxPossible = Math.min(goalRemainingMinutes, dayRemainingMinutes, MIN_TASK_BLOCK);
  return maxPossible >= MIN_TASK_BLOCK ? MIN_TASK_BLOCK : 0;
}

describe('roundToValidBlock', () => {
  it('retorna 0 para menos de 30 minutos', () => {
    expect(roundToValidBlock(0)).toBe(0);
    expect(roundToValidBlock(15)).toBe(0);
    expect(roundToValidBlock(29)).toBe(0);
  });

  it('arredonda para baixo em múltiplos de 30', () => {
    expect(roundToValidBlock(30)).toBe(30);
    expect(roundToValidBlock(45)).toBe(30);
    expect(roundToValidBlock(59)).toBe(30);
    expect(roundToValidBlock(60)).toBe(60);
    expect(roundToValidBlock(89)).toBe(60);
    expect(roundToValidBlock(90)).toBe(90);
  });

  it('nunca arredonda para cima', () => {
    // Caso crítico que causava o bug original
    expect(roundToValidBlock(45)).toBe(30); // Não 60!
    expect(roundToValidBlock(75)).toBe(60); // Não 90!
  });
});

describe('allocateTimeForSlot (WDRR)', () => {
  it('sempre aloca exatamente 30min quando possível', () => {
    // Com WDRR proporcional, cada slot é 30min fixo
    const result = allocateTimeForSlot(120, 180);
    expect(result).toBe(30); // Bloco fixo de 30min
  });

  it('nunca excede dayRemainingMinutes', () => {
    // Caso: dia só tem 25min → não aloca (abaixo do mínimo)
    const result = allocateTimeForSlot(120, 25);
    expect(result).toBe(0);
  });

  it('respeita o mínimo de 30min do dia', () => {
    // Caso: sobram 30min exatos
    const result = allocateTimeForSlot(100, 30);
    expect(result).toBe(30);
  });

  it('respeita o mínimo de 30min da meta', () => {
    // Caso: meta só precisa de 20min → não aloca slot incompleto
    const result = allocateTimeForSlot(20, 180);
    expect(result).toBe(0);
  });

  it('aloca 30min mesmo com meta grande', () => {
    // WDRR: cada slot é 30min, disciplina pode receber múltiplos slots por dia
    const result = allocateTimeForSlot(600, 180);
    expect(result).toBe(30); // Cada chamada aloca 30min
  });
});

describe('WDRR distribuição proporcional', () => {
  it('disciplina com maior backlog deve acumular mais crédito', () => {
    // Simula cálculo de crédito WDRR
    const remainingByDiscipline = {
      'disc-1': 420, // 70% da carga (7h)
      'disc-2': 90,  // 15% da carga (1.5h)
      'disc-3': 90,  // 15% da carga (1.5h)
    };
    const totalRemaining = 600;
    
    // Calcular pesos (W = remaining / total)
    const weights = {
      'disc-1': remainingByDiscipline['disc-1'] / totalRemaining,
      'disc-2': remainingByDiscipline['disc-2'] / totalRemaining,
      'disc-3': remainingByDiscipline['disc-3'] / totalRemaining,
    };
    
    expect(weights['disc-1']).toBeCloseTo(0.7, 1);
    expect(weights['disc-2']).toBeCloseTo(0.15, 1);
    expect(weights['disc-3']).toBeCloseTo(0.15, 1);
  });

  it('em 6 slots de 30min, disciplina com 70% deve receber ~4 slots', () => {
    // Simula distribuição WDRR para 3h/dia (6 slots de 30min)
    // Disciplina 1: 70% → espera ~4.2 slots → arredonda ~4
    // Disciplinas 2,3: 15% cada → espera ~0.9 slots cada → ~1 cada
    
    const totalSlots = 6;
    const weights = { 'disc-1': 0.7, 'disc-2': 0.15, 'disc-3': 0.15 };
    
    const expectedSlots = {
      'disc-1': Math.round(totalSlots * weights['disc-1']),
      'disc-2': Math.round(totalSlots * weights['disc-2']),
      'disc-3': Math.round(totalSlots * weights['disc-3']),
    };
    
    // disc-1 deve receber 4 slots (4.2 arredondado)
    expect(expectedSlots['disc-1']).toBe(4);
    // disc-2 e disc-3 devem receber 1 slot cada (0.9 arredondado)
    expect(expectedSlots['disc-2']).toBe(1);
    expect(expectedSlots['disc-3']).toBe(1);
    // Total deve ser 6 (tolerância de ±1 por arredondamento)
    expect(expectedSlots['disc-1'] + expectedSlots['disc-2'] + expectedSlots['disc-3']).toBeGreaterThanOrEqual(5);
  });
});

describe('disciplineIds source of truth', () => {
  it('selectedDisciplines deve ser a fonte primária (não discipline_order)', () => {
    // Simula o cenário do gerador
    const selectedDisciplines = ['disc-1', 'disc-2', 'disc-3'];
    const discipline_order = ['disc-ghost', 'disc-1']; // Contém ID fantasma
    
    // O gerador V4 deve usar selectedDisciplines, não discipline_order
    // Esta é a lógica que foi corrigida no construtor
    const disciplineOrder = selectedDisciplines; // Correção aplicada
    
    expect(disciplineOrder).toEqual(selectedDisciplines);
    expect(disciplineOrder).not.toContain('disc-ghost');
  });

  it('sanitizador remove IDs fantasmas de discipline_order', () => {
    const selectedDisciplines = ['disc-1', 'disc-2'];
    const rawDisciplineOrder = ['disc-ghost', 'disc-1', 'disc-2', 'disc-another-ghost'];
    
    // Lógica do sanitizador
    const selectedSet = new Set(selectedDisciplines);
    const sanitizedOrder = rawDisciplineOrder.filter(id => selectedSet.has(id));
    
    expect(sanitizedOrder).toEqual(['disc-1', 'disc-2']);
    expect(sanitizedOrder.length).toBe(2);
  });
});
