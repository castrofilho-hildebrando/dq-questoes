import { useCallback, useEffect, useRef } from "react";
import { getAsPath } from "@/debug/questionBankDebug";
import type { DebugLogEntry } from "@/components/debug/QuestionBankDebugBadge";

export type LogFn = (event: string, payload?: unknown) => void;

type Params = {
  enabled: boolean;
  scope: string;
  userEmail?: string | null;
};

declare global {
  interface Window {
    __qb_debug_original_fetch__?: typeof fetch;
    __qb_debug_fetch_wrapped__?: boolean;
  }
}

function getFetchUrl(input: RequestInfo | URL): string {
  try {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.toString();
    // Request
    return input.url;
  } catch {
    return "<unknown>";
  }
}

export function useQuestionBankDebugInstrumentation({ enabled, scope, userEmail }: Params) {
  const logsRef = useRef<DebugLogEntry[]>([]);

  const log: LogFn = useCallback(
    (event, payload) => {
      if (!enabled) return;

      const entry: DebugLogEntry = {
        timestamp: Date.now(),
        event: `${scope}:${event}`,
        payload: {
          href: window.location.href,
          asPath: getAsPath(),
          userEmail: userEmail ?? undefined,
          ...((payload && typeof payload === "object") ? payload : { value: payload }),
        },
      };

      logsRef.current = [...logsRef.current.slice(-199), entry]; // Keep last 200
      console.log(`[QB Debug:${scope}] ${event}`, entry.payload);
    },
    [enabled, scope, userEmail]
  );

  useEffect(() => {
    if (!enabled) return;

    const onError = (ev: Event) => {
      const e = ev as ErrorEvent;
      log("window.onerror", {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        error: e.error,
      });
    };

    const onUnhandledRejection = (ev: PromiseRejectionEvent) => {
      log("unhandledrejection", {
        reason: ev.reason,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    // Wrap fetch to log caught errors (network/offline/etc.)
    if (!window.__qb_debug_fetch_wrapped__) {
      window.__qb_debug_original_fetch__ = window.fetch.bind(window);
      const original = window.__qb_debug_original_fetch__;

      window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        try {
          return await original(input, init);
        } catch (err) {
          log("fetch.catch", {
            url: getFetchUrl(input),
            method: init?.method ?? (typeof input === "object" && "method" in input ? (input as Request).method : "GET"),
            error: err,
          });
          throw err;
        }
      }) as typeof fetch;

      window.__qb_debug_fetch_wrapped__ = true;
      log("fetch.wrap", { ok: true });
    }

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);

      // Restore fetch (apenas se fomos nós que wrapamos)
      if (window.__qb_debug_fetch_wrapped__ && window.__qb_debug_original_fetch__) {
        window.fetch = window.__qb_debug_original_fetch__;
        window.__qb_debug_original_fetch__ = undefined;
        window.__qb_debug_fetch_wrapped__ = false;
        log("fetch.restore", { ok: true });
      }
    };
  }, [enabled, log]);

  return { log, logsRef };
}
