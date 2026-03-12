import { useNavigate, useSearchParams } from "react-router-dom";
import { useCallback } from "react";

const FROM_MAP: Record<string, string> = {
  gateway: "/",
  "codigo-if": "/codigo-if",
  "conselho-if": "/conselho-if",
  "dossie-if": "/dossie-if",
};

/**
 * Hook that determines the correct "back" destination based on where the user came from.
 * Supports: `?from=gateway` → `/`, `?from=codigo-if` → `/codigo-if`.
 * Otherwise, navigates to `/dossie-if` (study dashboard).
 *
 * Also exposes `fromSuffix` so child navigations can propagate the origin:
 *   navigate(`/some-page${fromSuffix}`)
 */
export function useBackNavigation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const from = searchParams.get("from");
  const backPath = (from && FROM_MAP[from]) || "/dossie-if";
  const fromSuffix = from ? `?from=${from}` : "";

  const goBack = useCallback(() => {
    navigate(backPath);
  }, [navigate, backPath]);

  return { goBack, backPath, fromSuffix };
}
