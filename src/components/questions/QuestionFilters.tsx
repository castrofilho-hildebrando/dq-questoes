import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Filter, X, Search, ChevronDown } from "lucide-react";
import { Filters, FilterOption } from "@/hooks/useQuestions";
import { cn } from "@/lib/utils";

type ArrayFilterKey = 'bancas' | 'orgaos' | 'disciplines' | 'years' | 'questionTypes' | 'provas' | 'topics';

interface QuestionFiltersProps {
  filters: Filters;
  bancas: FilterOption[];
  orgaos: FilterOption[];
  provas: FilterOption[];
  disciplines: FilterOption[];
  topics: FilterOption[];
  years: string[];
  onFilterChange: (key: keyof Filters, value: string | string[]) => void;
  onToggleArrayFilter: (key: ArrayFilterKey, value: string) => void;
  onClearFilters: () => void;
  onApplyFilters: () => void;
  hasPendingChanges: boolean;
  // Stats for filter counters (optional)
  stats?: {
    total: number;
    resolved: number;
    unresolved: number;
    correct: number;
    incorrect: number;
  };
  // Debug (opcional)
  debugEnabled?: boolean;
  debugLog?: (event: string, payload?: unknown) => void;
}

// Helper to get status label with optional count
const getStatusLabel = (value: string, baseLabel: string, stats?: QuestionFiltersProps['stats']) => {
  if (!stats) return baseLabel;
  
  switch (value) {
    case 'all':
      return stats.total > 0 ? `${baseLabel} (${stats.total})` : baseLabel;
    case 'answered':
      return stats.resolved > 0 ? `${baseLabel} (${stats.resolved})` : baseLabel;
    case 'not_answered':
      return stats.unresolved > 0 ? `${baseLabel} (${stats.unresolved})` : baseLabel;
    case 'correct':
      return stats.correct > 0 ? `${baseLabel} (${stats.correct})` : baseLabel;
    case 'wrong':
      return stats.incorrect > 0 ? `${baseLabel} (${stats.incorrect})` : baseLabel;
    default:
      return baseLabel;
  }
};

const statusOptions = [
  { value: 'all', label: 'Todas as questões' },
  { value: 'answered', label: 'Questões resolvidas' },
  { value: 'not_answered', label: 'Questões não resolvidas' },
  { value: 'correct', label: 'Questões que acertei' },
  { value: 'wrong', label: 'Questões que errei' },
];

const questionTypeOptions = [
  { id: 'mult', name: 'Múltipla escolha' },
  { id: 'tf', name: 'Certo/Errado' },
];

interface MultiSelectFilterProps {
  label: string;
  options: { id: string; name: string }[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minWidth?: string;
}

function MultiSelectFilter({ label, options, selectedValues, onToggle, placeholder, disabled, minWidth = "min-w-[120px]" }: MultiSelectFilterProps) {
  const [search, setSearch] = useState('');
  
  // Sort options alphabetically and filter by search
  const filteredOptions = [...options]
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .filter(option => option.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("flex-1 justify-between", minWidth)} disabled={disabled}>
          <span className="truncate">
            {selectedValues.length === 0 
              ? placeholder || label 
              : `${selectedValues.length} selecionado(s)`}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
        </div>
        <ScrollArea className="h-[260px]">
          <div className="p-2 space-y-1">
            {filteredOptions.map(option => (
              <div 
                key={option.id}
                className="flex items-start gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                onClick={() => onToggle(option.id)}
              >
                <Checkbox 
                  className="mt-0.5"
                  checked={selectedValues.includes(option.id)}
                  onCheckedChange={() => onToggle(option.id)}
                />
                <span className="text-sm leading-snug whitespace-normal break-words">
                  {option.name}
                </span>
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma opção encontrada
              </p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

interface YearMultiSelectProps {
  years: string[];
  selectedYears: string[];
  onToggle: (year: string) => void;
}

function YearMultiSelect({ years, selectedYears, onToggle }: YearMultiSelectProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="flex-1 min-w-[100px] justify-between">
          <span className="truncate">
            {selectedYears.length === 0 
              ? "Ano" 
              : `${selectedYears.length} ano(s)`}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <ScrollArea className="h-[300px]">
          <div className="p-2 space-y-1">
            {years.slice(0, 30).map(year => (
              <div 
                key={year}
                className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                onClick={() => onToggle(year)}
              >
                <Checkbox 
                  checked={selectedYears.includes(year)}
                  onCheckedChange={() => onToggle(year)}
                />
                <span className="text-sm">{year}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function QuestionFilters({
  filters,
  bancas,
  orgaos,
  provas,
  disciplines,
  topics,
  years,
  onFilterChange,
  onToggleArrayFilter,
  onClearFilters,
  onApplyFilters,
  hasPendingChanges,
  stats,
  debugEnabled,
  debugLog,
}: QuestionFiltersProps) {
  const log = useCallback(
    (event: string, payload?: unknown) => {
      if (!debugEnabled || !debugLog) return;
      debugLog(`QuestionFilters:${event}`, payload);
    },
    [debugEnabled, debugLog]
  );

  const filtersSig = useMemo(
    () =>
      JSON.stringify({
        keyword: filters.keyword ?? "",
        status: filters.status,
        bancas: filters.bancas,
        orgaos: filters.orgaos,
        provas: filters.provas,
        disciplines: filters.disciplines,
        topics: filters.topics,
        years: filters.years,
        questionTypes: filters.questionTypes,
      }),
    [filters]
  );

  const prevSigRef = useRef<string | null>(null);

  useEffect(() => {
    log("MOUNT");
    return () => log("UNMOUNT");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prevSigRef.current && prevSigRef.current !== filtersSig) {
      log("FILTERS_PROP_CHANGE", { prev: prevSigRef.current, next: filtersSig });
    }
    prevSigRef.current = filtersSig;
  }, [filtersSig, log]);

  useEffect(() => {
    log("HAS_PENDING_CHANGES", { hasPendingChanges });
  }, [hasPendingChanges, log]);

  const handleFilterChange = useCallback(
    (key: keyof Filters, value: string | string[]) => {
      log("UI_FILTER_CHANGE", { key, value });
      onFilterChange(key, value);
    },
    [log, onFilterChange]
  );

  const handleToggleArrayFilter = useCallback(
    (key: ArrayFilterKey, value: string) => {
      log("UI_TOGGLE_ARRAY_FILTER", { key, value });
      onToggleArrayFilter(key, value);
    },
    [log, onToggleArrayFilter]
  );

  const handleApplyFilters = useCallback(() => {
    log("USER_ACTION_APPLY_FILTERS", {
      href: window.location.href,
      asPath: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    });
    onApplyFilters();
  }, [log, onApplyFilters]);

  const handleClearFilters = useCallback(() => {
    log("USER_ACTION_CLEAR_FILTERS", {
      href: window.location.href,
      asPath: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    });
    onClearFilters();
  }, [log, onClearFilters]);

  const hasActiveFilters = 
    filters.keyword ||
    filters.bancas.length > 0 ||
    filters.orgaos.length > 0 ||
    filters.disciplines.length > 0 ||
    filters.years.length > 0 ||
    filters.questionTypes.length > 0 ||
    filters.provas.length > 0 ||
    filters.topics.length > 0;

  // Helper to get label for filter badge
  const getFilterLabel = (key: ArrayFilterKey, id: string): string | null => {
    switch (key) {
      case 'bancas':
        return bancas.find(b => b.id === id)?.name || null;
      case 'orgaos':
        return orgaos.find(o => o.id === id)?.name || null;
      case 'disciplines':
        return disciplines.find(s => s.id === id)?.name || null;
      case 'topics':
        return topics.find(t => t.id === id)?.name || null;
      case 'provas':
        return provas.find(p => p.id === id)?.name || null;
      case 'questionTypes':
        return questionTypeOptions.find(qt => qt.id === id)?.name || null;
      case 'years':
        return id;
      default:
        return null;
    }
  };

  return (
    <Card className="border-border/50">
      <CardContent className="pt-6 space-y-4">
        {/* Keyword Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por palavra-chave ou código..."
            value={filters.keyword}
            onChange={(e) => handleFilterChange('keyword', e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          {statusOptions.map(option => (
            <Button
              key={option.value}
              variant={filters.status === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => handleFilterChange('status', option.value)}
              className={cn(
                "text-sm",
                filters.status === option.value && "bg-primary text-primary-foreground"
              )}
            >
              {getStatusLabel(option.value, option.label, stats)}
            </Button>
          ))}
        </div>

        {/* Select Filters - First Row */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">Filtros:</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <MultiSelectFilter
            label="Banca"
            options={bancas}
            selectedValues={filters.bancas}
            onToggle={(v) => handleToggleArrayFilter('bancas', v)}
            placeholder="Banca"
          />

          <MultiSelectFilter
            label="Órgão"
            options={orgaos}
            selectedValues={filters.orgaos}
            onToggle={(v) => handleToggleArrayFilter('orgaos', v)}
            placeholder="Órgão"
          />

          <MultiSelectFilter
            label="Prova"
            options={provas}
            selectedValues={filters.provas}
            onToggle={(v) => handleToggleArrayFilter('provas', v)}
            placeholder="Prova"
          />

          <YearMultiSelect
            years={years}
            selectedYears={filters.years}
            onToggle={(y) => handleToggleArrayFilter('years', y)}
          />

          <MultiSelectFilter
            label="Disciplina"
            options={disciplines}
            selectedValues={filters.disciplines}
            onToggle={(v) => handleToggleArrayFilter('disciplines', v)}
            placeholder="Disciplina"
          />

          <MultiSelectFilter
            label="Tópico"
            options={topics}
            selectedValues={filters.topics}
            onToggle={(v) => handleToggleArrayFilter('topics', v)}
            placeholder="Tópico"
            disabled={filters.disciplines.length === 0}
          />

          <MultiSelectFilter
            label="Tipo"
            options={questionTypeOptions}
            selectedValues={filters.questionTypes}
            onToggle={(v) => handleToggleArrayFilter('questionTypes', v)}
            placeholder="Tipo de Questão"
          />
        </div>

        <div className="flex gap-2">
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleApplyFilters}
            className="gap-1"
            disabled={!hasPendingChanges}
          >
            <Filter className="h-4 w-4" />
            Filtrar
          </Button>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleClearFilters}
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Selected filters badges */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {(['questionTypes', 'bancas', 'orgaos', 'disciplines', 'topics', 'provas', 'years'] as ArrayFilterKey[]).map(key => 
              filters[key].map(id => {
                const label = getFilterLabel(key, id);
                return label ? (
                  <Badge key={`${key}-${id}`} variant="secondary" className="gap-1">
                    {label}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => handleToggleArrayFilter(key, id)}
                    />
                  </Badge>
                ) : null;
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}