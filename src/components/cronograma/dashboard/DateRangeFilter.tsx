import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { format, subDays, subMonths, subYears, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface DateRangeFilterProps {
  dateRange: { from: Date | undefined; to: Date | undefined };
  onDateRangeChange: (range: { from: Date | undefined; to: Date | undefined }) => void;
}

type PresetKey = "7d" | "30d" | "6m" | "1y" | "all";

const presets: { key: PresetKey; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "6m", label: "6 meses" },
  { key: "1y", label: "1 ano" },
  { key: "all", label: "Todo" },
];

function getPresetRange(key: PresetKey): { from: Date | undefined; to: Date | undefined } {
  const today = startOfDay(new Date());
  switch (key) {
    case "7d": return { from: subDays(today, 7), to: today };
    case "30d": return { from: subDays(today, 30), to: today };
    case "6m": return { from: subMonths(today, 6), to: today };
    case "1y": return { from: subYears(today, 1), to: today };
    case "all": return { from: undefined, to: undefined };
  }
}

function detectActivePreset(range: { from: Date | undefined; to: Date | undefined }): PresetKey | null {
  if (!range.from && !range.to) return "all";
  if (!range.from || !range.to) return null;
  const today = startOfDay(new Date());
  const toDay = startOfDay(range.to);
  if (toDay.getTime() !== today.getTime()) return null;
  const diffMs = today.getTime() - startOfDay(range.from).getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 7) return "7d";
  if (diffDays === 30) return "30d";
  // Approximate 6 months / 1 year
  if (diffDays >= 180 && diffDays <= 184) return "6m";
  if (diffDays >= 365 && diffDays <= 366) return "1y";
  return null;
}

export function DateRangeFilter({ dateRange, onDateRangeChange }: DateRangeFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const activePreset = detectActivePreset(dateRange);
  const hasCustomFilter = (dateRange.from || dateRange.to) && activePreset === null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Preset buttons */}
      {presets.map((preset) => (
        <Button
          key={preset.key}
          variant={activePreset === preset.key ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => onDateRangeChange(getPresetRange(preset.key))}
        >
          {preset.label}
        </Button>
      ))}

      {/* Custom calendar */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={hasCustomFilter ? "default" : "outline"}
            size="sm"
            className="gap-1.5 h-8 text-xs"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            {hasCustomFilter && dateRange.from && dateRange.to
              ? `${format(dateRange.from, "dd/MM", { locale: ptBR })} — ${format(dateRange.to, "dd/MM", { locale: ptBR })}`
              : "Personalizado"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined}
            onSelect={(range) => {
              onDateRangeChange({ from: range?.from, to: range?.to });
              if (range?.from && range?.to) setCalendarOpen(false);
            }}
            locale={ptBR}
            numberOfMonths={2}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      {/* Clear custom filter */}
      {hasCustomFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDateRangeChange({ from: undefined, to: undefined })}
          className="gap-1 text-muted-foreground h-8 text-xs"
        >
          <X className="w-3 h-3" />
          Limpar
        </Button>
      )}
    </div>
  );
}
