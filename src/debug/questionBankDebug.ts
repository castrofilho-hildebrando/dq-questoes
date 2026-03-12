import type { Filters } from "@/hooks/useQuestions";

export function getAsPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function summarizeFilters(filters: Filters | null | undefined): string {
  if (!filters) return "filters=null";
  
  const parts = [
    filters.keyword ? `kw="${filters.keyword.slice(0, 40)}"` : "kw=∅",
    `st=${filters.status ?? "?"}`,
    `b=${filters.bancas?.length ?? 0}`,
    `o=${filters.orgaos?.length ?? 0}`,
    `p=${filters.provas?.length ?? 0}`,
    `d=${filters.disciplines?.length ?? 0}`,
    `t=${filters.topics?.length ?? 0}`,
    `y=${filters.years?.length ?? 0}`,
    `qt=${filters.questionTypes?.length ?? 0}`,
  ];
  return parts.join(" ");
}

export function serializeFilters(filters: Filters | null | undefined): string {
  if (!filters) return "null";
  
  // Mantém ordem estável para diff (evita depender de stringify da lib)
  return JSON.stringify({
    keyword: filters.keyword ?? "",
    status: filters.status ?? "all",
    bancas: [...(filters.bancas ?? [])].sort(),
    orgaos: [...(filters.orgaos ?? [])].sort(),
    provas: [...(filters.provas ?? [])].sort(),
    disciplines: [...(filters.disciplines ?? [])].sort(),
    topics: [...(filters.topics ?? [])].sort(),
    years: [...(filters.years ?? [])].sort(),
    questionTypes: [...(filters.questionTypes ?? [])].sort(),
  });
}

export function isDefaultFilters(filters: Filters | null | undefined): boolean {
  if (!filters) return true;
  
  return (
    !filters.keyword &&
    (filters.status ?? "all") === "all" &&
    (filters.bancas?.length ?? 0) === 0 &&
    (filters.orgaos?.length ?? 0) === 0 &&
    (filters.provas?.length ?? 0) === 0 &&
    (filters.disciplines?.length ?? 0) === 0 &&
    (filters.topics?.length ?? 0) === 0 &&
    (filters.years?.length ?? 0) === 0 &&
    (filters.questionTypes?.length ?? 0) === 0
  );
}
