/**
 * Performance instrumentation for Question Bank
 * Tracks end-to-end metrics for each load operation
 */

export type LoadTrigger = 'initial' | 'apply' | 'pagination' | 'clear' | 'change_selection';

export interface PerfSegments {
  buildQueryMs: number;
  dbRequestMs: number;
  jsonParseMs: number;
  stateUpdateMs: number;
  renderMs: number;
}

export interface PerfMetrics {
  requestId: string;
  trigger: LoadTrigger;
  queryKey: string;
  filtersSnapshot: Record<string, unknown>;
  selectionSnapshot: { schoolId: string | null; editalId: string | null; isPreEdital: boolean };
  page: number;
  segments: PerfSegments;
  payloadBytes: number;
  questionsReturned: number;
  requestCount: number;
  totalMs: number;
  bottleneck: { segment: keyof PerfSegments; ms: number };
  timestamp: number;
}

// In-flight performance context
export interface PerfContext {
  requestId: string;
  trigger: LoadTrigger;
  page: number;
  filtersSnapshot: Record<string, unknown>;
  selectionSnapshot: { schoolId: string | null; editalId: string | null; isPreEdital: boolean };
  queryKey: string;
  startTime: number;
  requestCount: number;
  marks: {
    buildQueryStart?: number;
    buildQueryEnd?: number;
    dbRequestStart?: number;
    dbRequestEnd?: number;
    jsonParseStart?: number;
    jsonParseEnd?: number;
    stateUpdateStart?: number;
    stateUpdateEnd?: number;
    renderStart?: number;
    renderEnd?: number;
  };
  payloadBytes: number;
  questionsReturned: number;
}

export interface PerfTrackerReturn {
  enabled: boolean;
  startLoad: (params: {
    requestId: string;
    trigger: LoadTrigger;
    page: number;
    filters: Record<string, unknown>;
    selection: { schoolId: string | null; editalId: string | null; isPreEdital: boolean };
    queryKey: string;
  }) => void;
  markBuildQueryStart: () => void;
  markBuildQueryEnd: () => void;
  markDbRequestStart: () => void;
  markDbRequestEnd: (payloadBytes?: number) => void;
  markJsonParseStart: () => void;
  markJsonParseEnd: () => void;
  markStateUpdateStart: () => void;
  markStateUpdateEnd: (questionsReturned?: number) => void;
  markRenderStart: () => void;
  markRenderEnd: () => void;
  incrementRequestCount: () => void;
  finalize: () => PerfMetrics | null;
  getMetricsHistory: () => PerfMetrics[];
}

const PERF_HISTORY_MAX = 50;

// Singleton for metrics history
const metricsHistory: PerfMetrics[] = [];

let currentContext: PerfContext | null = null;

function now(): number {
  return performance.now();
}

function calcSegment(start?: number, end?: number): number {
  if (start === undefined || end === undefined) return 0;
  return Math.round((end - start) * 100) / 100;
}

function estimatePayloadSize(data: unknown): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return 0;
  }
}

export function createPerfTracker(enabled: boolean): PerfTrackerReturn {
  if (!enabled) {
    // Return no-op tracker
    return {
      enabled: false,
      startLoad: () => {},
      markBuildQueryStart: () => {},
      markBuildQueryEnd: () => {},
      markDbRequestStart: () => {},
      markDbRequestEnd: () => {},
      markJsonParseStart: () => {},
      markJsonParseEnd: () => {},
      markStateUpdateStart: () => {},
      markStateUpdateEnd: () => {},
      markRenderStart: () => {},
      markRenderEnd: () => {},
      incrementRequestCount: () => {},
      finalize: () => null,
      getMetricsHistory: () => [],
    };
  }

  return {
    enabled: true,

    startLoad({ requestId, trigger, page, filters, selection, queryKey }) {
      currentContext = {
        requestId,
        trigger,
        page,
        filtersSnapshot: { ...filters },
        selectionSnapshot: { ...selection },
        queryKey,
        startTime: now(),
        requestCount: 0,
        marks: {},
        payloadBytes: 0,
        questionsReturned: 0,
      };

      console.log(`[PERF_START] requestId=${requestId}`, {
        trigger,
        page,
        filters: currentContext.filtersSnapshot,
        selection: currentContext.selectionSnapshot,
        queryKey,
      });
    },

    markBuildQueryStart() {
      if (currentContext) {
        currentContext.marks.buildQueryStart = now();
      }
    },

    markBuildQueryEnd() {
      if (currentContext) {
        currentContext.marks.buildQueryEnd = now();
      }
    },

    markDbRequestStart() {
      if (currentContext) {
        currentContext.marks.dbRequestStart = now();
        currentContext.requestCount++;
      }
    },

    markDbRequestEnd(payloadBytes?: number) {
      if (currentContext) {
        currentContext.marks.dbRequestEnd = now();
        if (payloadBytes !== undefined) {
          currentContext.payloadBytes += payloadBytes;
        }
      }
    },

    markJsonParseStart() {
      if (currentContext) {
        currentContext.marks.jsonParseStart = now();
      }
    },

    markJsonParseEnd() {
      if (currentContext) {
        currentContext.marks.jsonParseEnd = now();
      }
    },

    markStateUpdateStart() {
      if (currentContext) {
        currentContext.marks.stateUpdateStart = now();
      }
    },

    markStateUpdateEnd(questionsReturned?: number) {
      if (currentContext) {
        currentContext.marks.stateUpdateEnd = now();
        if (questionsReturned !== undefined) {
          currentContext.questionsReturned = questionsReturned;
        }
      }
    },

    markRenderStart() {
      if (currentContext) {
        currentContext.marks.renderStart = now();
        performance.mark(`qb-render-start-${currentContext.requestId}`);
      }
    },

    markRenderEnd() {
      if (currentContext) {
        currentContext.marks.renderEnd = now();
        const markName = `qb-render-start-${currentContext.requestId}`;
        const measureName = `qb-render-${currentContext.requestId}`;
        try {
          performance.mark(`qb-render-end-${currentContext.requestId}`);
          performance.measure(measureName, markName, `qb-render-end-${currentContext.requestId}`);
          const entries = performance.getEntriesByName(measureName);
          if (entries.length > 0) {
            currentContext.marks.renderEnd = currentContext.marks.renderStart! + entries[0].duration;
          }
          // Cleanup marks
          performance.clearMarks(markName);
          performance.clearMarks(`qb-render-end-${currentContext.requestId}`);
          performance.clearMeasures(measureName);
        } catch {
          // Fallback to simple timing
        }
      }
    },

    incrementRequestCount() {
      if (currentContext) {
        currentContext.requestCount++;
      }
    },

    finalize(): PerfMetrics | null {
      if (!currentContext) return null;

      const ctx = currentContext;
      const endTime = now();
      const totalMs = Math.round((endTime - ctx.startTime) * 100) / 100;

      const segments: PerfSegments = {
        buildQueryMs: calcSegment(ctx.marks.buildQueryStart, ctx.marks.buildQueryEnd),
        dbRequestMs: calcSegment(ctx.marks.dbRequestStart, ctx.marks.dbRequestEnd),
        jsonParseMs: calcSegment(ctx.marks.jsonParseStart, ctx.marks.jsonParseEnd),
        stateUpdateMs: calcSegment(ctx.marks.stateUpdateStart, ctx.marks.stateUpdateEnd),
        renderMs: calcSegment(ctx.marks.renderStart, ctx.marks.renderEnd),
      };

      // Find bottleneck
      const segmentEntries = Object.entries(segments) as [keyof PerfSegments, number][];
      const [bottleneckSegment, bottleneckMs] = segmentEntries.reduce(
        (max, [seg, ms]) => (ms > max[1] ? [seg, ms] : max),
        ['buildQueryMs' as keyof PerfSegments, 0]
      );

      const metrics: PerfMetrics = {
        requestId: ctx.requestId,
        trigger: ctx.trigger,
        queryKey: ctx.queryKey,
        filtersSnapshot: ctx.filtersSnapshot,
        selectionSnapshot: ctx.selectionSnapshot,
        page: ctx.page,
        segments,
        payloadBytes: ctx.payloadBytes,
        questionsReturned: ctx.questionsReturned,
        requestCount: ctx.requestCount,
        totalMs,
        bottleneck: { segment: bottleneckSegment, ms: bottleneckMs },
        timestamp: Date.now(),
      };

      // Log complete metrics
      console.log(`[PERF_COMPLETE] requestId=${ctx.requestId}`, {
        trigger: metrics.trigger,
        page: metrics.page,
        totalMs: metrics.totalMs,
        segments: metrics.segments,
        payloadBytes: metrics.payloadBytes,
        questionsReturned: metrics.questionsReturned,
        requestCount: metrics.requestCount,
      });

      // Log bottleneck if significant (>100ms)
      if (bottleneckMs > 100) {
        console.warn(`[PERF_BOTTLENECK] requestId=${ctx.requestId}`, {
          segment: bottleneckSegment,
          ms: bottleneckMs,
          percentOfTotal: Math.round((bottleneckMs / totalMs) * 100),
        });
      }

      // Store in history
      metricsHistory.push(metrics);
      if (metricsHistory.length > PERF_HISTORY_MAX) {
        metricsHistory.shift();
      }

      currentContext = null;
      return metrics;
    },

    getMetricsHistory(): PerfMetrics[] {
      return [...metricsHistory];
    },
  };
}

// Utility to estimate payload size from response
export function estimateResponseSize(data: unknown): number {
  return estimatePayloadSize(data);
}

// Export current context for external access (e.g., from component for render timing)
export function getPerfContext(): PerfContext | null {
  return currentContext;
}
