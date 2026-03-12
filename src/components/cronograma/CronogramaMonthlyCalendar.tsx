import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2, Circle } from "lucide-react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday,
  addMonths,
  subMonths,
  getDay,
  startOfWeek,
  endOfWeek
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface CronogramaTask {
  id: string;
  scheduled_date: string;
  duration_minutes: number;
  is_completed: boolean;
  is_revision: boolean;
  topic_goals?: {
    name: string;
    study_topics?: {
      name: string;
      study_disciplines?: {
        name: string;
      };
    };
  } | null;
  study_topics?: {
    name: string;
    study_disciplines?: {
      name: string;
    };
  } | null;
}

interface CronogramaMonthlyCalendarProps {
  tasks: CronogramaTask[];
  selectedDate: Date;
  currentMonth: Date;
  onMonthChange: (month: Date) => void;
  onDateSelect: (date: Date) => void;
}

export function CronogramaMonthlyCalendar({
  tasks,
  selectedDate,
  currentMonth,
  onMonthChange,
  onDateSelect,
}: CronogramaMonthlyCalendarProps) {

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const grouped: Record<string, CronogramaTask[]> = {};
    tasks.forEach(task => {
      const dateKey = task.scheduled_date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(task);
    });
    return grouped;
  }, [tasks]);

  // Get all days for the calendar grid (including days from prev/next month to fill the grid)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const goToPreviousMonth = () => onMonthChange(subMonths(currentMonth, 1));
  const goToNextMonth = () => onMonthChange(addMonths(currentMonth, 1));
  const goToCurrentMonth = () => onMonthChange(startOfMonth(new Date()));

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const getDayStats = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const dayTasks = tasksByDate[dateKey] || [];
    const total = dayTasks.length;
    const completed = dayTasks.filter(t => t.is_completed).length;
    const totalMinutes = dayTasks.reduce((sum, t) => sum + t.duration_minutes, 0);
    return { total, completed, totalMinutes, tasks: dayTasks };
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Calendário Mensal
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              onClick={goToCurrentMonth}
              className="min-w-[140px]"
            >
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </Button>
            <Button variant="ghost" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div 
              key={day} 
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map(day => {
            const stats = getDayStats(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = isSameDay(day, selectedDate);
            const isDayToday = isToday(day);
            const hasCompletedAll = stats.total > 0 && stats.completed === stats.total;
            const hasPartialProgress = stats.total > 0 && stats.completed > 0 && stats.completed < stats.total;
            
            return (
              <motion.button
                key={day.toISOString()}
                onClick={() => onDateSelect(day)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "relative p-1 min-h-[80px] rounded-lg border transition-all",
                  "flex flex-col items-start justify-start text-left",
                  isCurrentMonth ? "bg-background" : "bg-muted/30",
                  isSelected && "ring-2 ring-primary border-primary",
                  isDayToday && !isSelected && "border-primary/50 bg-primary/5",
                  !isSelected && "hover:border-primary/30 hover:bg-accent/50",
                  hasCompletedAll && "bg-green-500/10 border-green-500/30",
                  hasPartialProgress && "bg-amber-500/5 border-amber-500/20"
                )}
              >
                {/* Day number */}
                <span className={cn(
                  "text-sm font-medium mb-1",
                  !isCurrentMonth && "text-muted-foreground/50",
                  isDayToday && "text-primary font-bold"
                )}>
                  {format(day, "d")}
                  {isDayToday && (
                    <span className="ml-1 text-[10px] text-primary">hoje</span>
                  )}
                </span>

                {/* Task indicators */}
                {stats.total > 0 && (
                  <div className="w-full space-y-1">
                    <div className="flex items-center gap-1 text-[10px]">
                      {hasCompletedAll ? (
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                      ) : hasPartialProgress ? (
                        <Circle className="w-3 h-3 text-amber-500 fill-amber-500/30" />
                      ) : (
                        <Circle className="w-3 h-3 text-muted-foreground/50" />
                      )}
                      <span className={cn(
                        "font-medium",
                        hasCompletedAll && "text-green-600",
                        hasPartialProgress && "text-amber-600",
                        !hasCompletedAll && !hasPartialProgress && "text-muted-foreground"
                      )}>
                        {stats.completed}/{stats.total}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatDuration(stats.totalMinutes)}
                    </div>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/40" />
            <span>Completo</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40" />
            <span>Parcial</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-background border" />
            <span>Pendente</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
