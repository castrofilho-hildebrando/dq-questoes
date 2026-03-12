/**
 * Logger centralizado para o módulo de cronograma
 * 
 * Uso: monitorar sanitização, alocação de tempo, e detectar anomalias.
 * Em produção, salva contadores agregados no Supabase (telemetria).
 */

import { supabase } from "@/integrations/supabase/client";

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type TelemetryEventType = 
  | 'ghost_ids_removed'
  | 'time_block_skipped'
  | 'incremental_recalc';

interface LogEntry {
  level: LogLevel;
  module: string;
  event: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

// Buffer de logs recentes para debugging
const LOG_BUFFER_SIZE = 100;
const logBuffer: LogEntry[] = [];

// Contadores de telemetria para produção (debounce)
const telemetryCounters: Map<TelemetryEventType, { count: number; context?: string }> = new Map();
let telemetryFlushTimeout: ReturnType<typeof setTimeout> | null = null;
const TELEMETRY_FLUSH_DELAY = 5000; // 5 segundos de debounce

const IS_DEV = import.meta.env.DEV;

function createEntry(level: LogLevel, module: string, event: string, data?: Record<string, unknown>): LogEntry {
  return {
    level,
    module,
    event,
    data,
    timestamp: new Date().toISOString(),
  };
}

function addToBuffer(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
}

function output(entry: LogEntry): void {
  if (!IS_DEV) return; // Silencioso em produção (telemetria via Supabase)
  
  const prefix = `[Cronograma:${entry.module}]`;
  const message = `${prefix} ${entry.event}`;
  
  switch (entry.level) {
    case 'debug':
      console.debug(message, entry.data || '');
      break;
    case 'info':
      console.info(message, entry.data || '');
      break;
    case 'warn':
      console.warn(message, entry.data || '');
      break;
    case 'error':
      console.error(message, entry.data || '');
      break;
  }
}

/**
 * Agenda flush de telemetria para o Supabase (debounced)
 */
function scheduleTelemetryFlush(): void {
  if (IS_DEV) return; // Não persiste em dev
  
  if (telemetryFlushTimeout) {
    clearTimeout(telemetryFlushTimeout);
  }
  
  telemetryFlushTimeout = setTimeout(() => {
    flushTelemetry();
  }, TELEMETRY_FLUSH_DELAY);
}

/**
 * Persiste contadores de telemetria no Supabase
 */
async function flushTelemetry(): Promise<void> {
  if (telemetryCounters.size === 0) return;
  
  const events = Array.from(telemetryCounters.entries()).map(([eventType, data]) => ({
    event_type: eventType,
    event_count: data.count,
    context: data.context || null,
  }));
  
  // Limpa contadores antes do insert (evita duplicação se falhar)
  telemetryCounters.clear();
  
  try {
    const { error } = await supabase
      .from('cronograma_health_events')
      .insert(events);
    
    if (error) {
      console.error('[Cronograma:Telemetry] Failed to flush:', error.message);
    }
  } catch (err) {
    console.error('[Cronograma:Telemetry] Exception:', err);
  }
}

/**
 * Incrementa contador de telemetria
 */
function incrementTelemetry(eventType: TelemetryEventType, count: number = 1, context?: string): void {
  const existing = telemetryCounters.get(eventType);
  if (existing) {
    existing.count += count;
    if (context) existing.context = context; // Último contexto vence
  } else {
    telemetryCounters.set(eventType, { count, context });
  }
  scheduleTelemetryFlush();
}

export const cronogramaLogger = {
  /**
   * Log quando IDs fantasmas são removidos pelo sanitizador
   */
  ghostIdsRemoved: (removedIds: string[], context: string): void => {
    if (removedIds.length === 0) return;
    const entry = createEntry('warn', 'Sanitizer', 'Ghost IDs removed', {
      removedCount: removedIds.length,
      removedIds: removedIds.slice(0, 10), // Limitar para não poluir
      context,
    });
    addToBuffer(entry);
    output(entry);
    
    // Telemetria em produção
    incrementTelemetry('ghost_ids_removed', removedIds.length, context);
  },

  /**
   * Log quando roundToValidBlock retorna 0 por tempo insuficiente
   */
  timeBlockSkipped: (availableMinutes: number, reason: string): void => {
    const entry = createEntry('debug', 'Allocator', 'Time block skipped (< 30min)', {
      availableMinutes,
      reason,
    });
    addToBuffer(entry);
    output(entry);
    
    // Telemetria em produção
    incrementTelemetry('time_block_skipped', 1, reason);
  },

  /**
   * Log quando alocação de tempo é feita
   */
  timeAllocated: (allocated: number, goalId: string, disciplineId: string, date: string): void => {
    const entry = createEntry('debug', 'Allocator', 'Time allocated', {
      allocated,
      goalId,
      disciplineId,
      date,
    });
    addToBuffer(entry);
    // Não output em debug para reduzir ruído
  },

  /**
   * Log quando ciclo completo é executado
   */
  cycleCompleted: (cycleNumber: number, date: string, tasksCreated: number, minutesUsed: number): void => {
    const entry = createEntry('info', 'Generator', 'Cycle completed', {
      cycleNumber,
      date,
      tasksCreated,
      minutesUsed,
    });
    addToBuffer(entry);
    output(entry);
  },

  /**
   * Log quando recálculo incremental é executado
   */
  incrementalRecalc: (cronogramaId: string, startDate: string, source: 'config' | 'lastTask' | 'today'): void => {
    const entry = createEntry('info', 'Generator', 'Incremental recalc started', {
      cronogramaId,
      startDate,
      startDateSource: source,
    });
    addToBuffer(entry);
    output(entry);
    
    // Telemetria em produção
    incrementTelemetry('incremental_recalc', 1, source);
  },

  /**
   * Erro genérico
   */
  error: (module: string, message: string, error?: unknown): void => {
    const entry = createEntry('error', module, message, {
      error: error instanceof Error ? error.message : String(error),
    });
    addToBuffer(entry);
    output(entry);
  },

  /**
   * Retorna buffer de logs recentes (útil para debugging)
   */
  getRecentLogs: (): LogEntry[] => [...logBuffer],

  /**
   * Limpa buffer (útil para testes)
   */
  clearBuffer: (): void => {
    logBuffer.length = 0;
  },
  
  /**
   * Força flush da telemetria (útil para testes ou antes de logout)
   */
  forceFlush: (): Promise<void> => {
    if (telemetryFlushTimeout) {
      clearTimeout(telemetryFlushTimeout);
      telemetryFlushTimeout = null;
    }
    return flushTelemetry();
  },
};
