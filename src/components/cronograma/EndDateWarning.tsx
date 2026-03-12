import { AlertTriangle, CalendarCheck, Clock, Info } from "lucide-react";
import { useMemo } from "react";
import { parseISO, differenceInDays, isAfter, addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EndDateWarningProps {
  startDate: string;
  endDate: string;
  availableDays: string[];
  hoursPerDay: number;
  hoursPerWeekday: Record<string, number>;
  useCustomHoursPerDay: boolean;
  estimatedTotalMinutes: number;
}

// Map weekday name to day index (0 = Sunday, 1 = Monday, etc.)
const DAY_CODE_TO_INDEX: Record<string, number> = {
  dom: 0,
  seg: 1,
  ter: 2,
  qua: 3,
  qui: 4,
  sex: 5,
  sab: 6,
};

export function EndDateWarning({
  startDate,
  endDate,
  availableDays,
  hoursPerDay,
  hoursPerWeekday,
  useCustomHoursPerDay,
  estimatedTotalMinutes,
}: EndDateWarningProps) {
  const analysis = useMemo(() => {
    if (!startDate || estimatedTotalMinutes <= 0 || availableDays.length === 0) {
      return null;
    }

    const start = parseISO(startDate);
    
    // Calculate average minutes per available day
    let totalHoursPerWeek = 0;
    for (const dayCode of availableDays) {
      const hoursForDay = useCustomHoursPerDay 
        ? (hoursPerWeekday[dayCode] ?? hoursPerDay)
        : hoursPerDay;
      totalHoursPerWeek += hoursForDay;
    }
    const avgMinutesPerStudyDay = (totalHoursPerWeek / availableDays.length) * 60;
    
    // Estimate how many study days needed
    const estimatedStudyDaysNeeded = Math.ceil(estimatedTotalMinutes / avgMinutesPerStudyDay);
    
    // Calculate the estimated end date by walking through calendar
    let studyDaysCount = 0;
    let currentDate = new Date(start);
    let estimatedEndDate = currentDate;
    
    while (studyDaysCount < estimatedStudyDaysNeeded) {
      const dayIndex = currentDate.getDay();
      const dayCode = Object.entries(DAY_CODE_TO_INDEX).find(([, idx]) => idx === dayIndex)?.[0];
      
      if (dayCode && availableDays.includes(dayCode)) {
        studyDaysCount++;
        estimatedEndDate = new Date(currentDate);
      }
      
      currentDate = addDays(currentDate, 1);
      
      // Safety limit (2 years)
      if (differenceInDays(currentDate, start) > 730) break;
    }
    
    // If no end date specified, just show the estimated completion date
    if (!endDate) {
      return {
        hasEndDate: false,
        estimatedEndDate,
        estimatedStudyDays: estimatedStudyDaysNeeded,
        totalAvailableMinutes: 0,
        estimatedTotalMinutes,
        willFit: true,
        requiredHoursPerDay: 0,
        daysMissing: 0,
        remainingMinutes: 0,
        availableStudyDays: estimatedStudyDaysNeeded,
      };
    }

    // If end date is specified, check if it fits
    const end = parseISO(endDate);
    
    if (!isAfter(end, start)) {
      return null;
    }

    const totalDays = differenceInDays(end, start) + 1;
    
    // Count available study days and total available minutes within the specified period
    let availableStudyDays = 0;
    let totalAvailableMinutes = 0;
    currentDate = new Date(start);
    
    for (let i = 0; i < totalDays; i++) {
      const dayIndex = currentDate.getDay();
      const dayCode = Object.entries(DAY_CODE_TO_INDEX).find(([, idx]) => idx === dayIndex)?.[0];
      
      if (dayCode && availableDays.includes(dayCode)) {
        availableStudyDays++;
        const hoursForDay = useCustomHoursPerDay 
          ? (hoursPerWeekday[dayCode] ?? hoursPerDay)
          : hoursPerDay;
        totalAvailableMinutes += hoursForDay * 60;
      }
      
      currentDate = addDays(currentDate, 1);
    }

    const remainingMinutes = totalAvailableMinutes - estimatedTotalMinutes;
    const willFit = estimatedTotalMinutes <= totalAvailableMinutes;

    // Calculate required hours per day if it doesn't fit
    let requiredHoursPerDay = 0;
    if (!willFit && availableStudyDays > 0) {
      requiredHoursPerDay = Math.ceil((estimatedTotalMinutes / availableStudyDays) / 60 * 10) / 10;
    }

    // Calculate how many extra days are needed
    const daysMissing = !willFit 
      ? Math.ceil((estimatedTotalMinutes - totalAvailableMinutes) / avgMinutesPerStudyDay)
      : 0;

    return {
      hasEndDate: true,
      estimatedEndDate,
      estimatedStudyDays: estimatedStudyDaysNeeded,
      totalDays,
      availableStudyDays,
      totalAvailableMinutes,
      estimatedTotalMinutes,
      remainingMinutes,
      willFit,
      requiredHoursPerDay,
      daysMissing,
    };
  }, [startDate, endDate, availableDays, hoursPerDay, hoursPerWeekday, useCustomHoursPerDay, estimatedTotalMinutes]);

  if (!analysis) {
    return null;
  }

  const formatHours = (minutes: number) => {
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.abs(minutes) % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins}min`;
  };

  // Case 1: No end date specified - show estimated completion date
  if (!analysis.hasEndDate) {
    return (
      <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <div className="flex items-start gap-3">
          <CalendarCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-blue-700 dark:text-blue-300">
              Previsão de Conclusão
            </p>
            <p className="text-sm text-blue-600/80 dark:text-blue-400/80">
              Com base nas suas configurações, o cronograma será concluído em aproximadamente{" "}
              <strong>{format(analysis.estimatedEndDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</strong>.
            </p>
            <p className="text-sm text-blue-600/70 dark:text-blue-400/70">
              Total: {formatHours(analysis.estimatedTotalMinutes)} de estudo em ~{analysis.estimatedStudyDays} dias de estudo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: End date specified and it fits
  if (analysis.willFit) {
    const utilizationPercent = analysis.totalAvailableMinutes > 0 
      ? Math.round((analysis.estimatedTotalMinutes / analysis.totalAvailableMinutes) * 100)
      : 0;
    
    return (
      <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-green-700 dark:text-green-300">
              Cronograma viável!
            </p>
            <p className="text-sm text-green-600/80 dark:text-green-400/80">
              Tempo disponível: <strong>{formatHours(analysis.totalAvailableMinutes)}</strong> em {analysis.availableStudyDays} dias de estudo.
              {analysis.remainingMinutes > 0 && (
                <> Sobram <strong>{formatHours(analysis.remainingMinutes)}</strong> de folga.</>
              )}
            </p>
            <p className="text-xs text-green-600/70 dark:text-green-400/70">
              Utilização: {utilizationPercent}% do tempo disponível
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Case 3: End date specified but it doesn't fit - show warning
  return (
    <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p className="font-medium text-amber-700 dark:text-amber-300">
            Atenção: Cronograma não cabe no período!
          </p>
          <div className="text-sm text-amber-600/90 dark:text-amber-400/90 space-y-1">
            <p>
              Tempo necessário: <strong>{formatHours(analysis.estimatedTotalMinutes)}</strong>
            </p>
            <p>
              Tempo disponível: <strong>{formatHours(analysis.totalAvailableMinutes)}</strong> 
              {" "}({analysis.availableStudyDays} dias de estudo)
            </p>
            <p>
              <strong className="text-amber-700 dark:text-amber-300">
                Faltam {formatHours(Math.abs(analysis.remainingMinutes))}
              </strong> para completar todas as tarefas.
            </p>
          </div>
          
          <div className="pt-2 border-t border-amber-500/20 space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4" />
              <span>
                <strong>Opção 1:</strong> Aumentar para <strong>{analysis.requiredHoursPerDay}h/dia</strong> de estudo
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4" />
              <span>
                <strong>Opção 2:</strong> Estender mais <strong>{analysis.daysMissing} dias</strong> o prazo
              </span>
            </div>
          </div>
          
          <p className="text-xs text-amber-600/70 dark:text-amber-400/70 pt-1">
            ⚠️ As tarefas que não couberem no período NÃO serão geradas.
          </p>
        </div>
      </div>
    </div>
  );
}