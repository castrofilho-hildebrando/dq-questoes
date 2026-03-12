import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays, isSameDay, isToday, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface WeekCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  taskCounts?: Record<string, number>; // { "2024-01-15": 3, ... }
}

export function WeekCalendar({
  selectedDate,
  onSelectDate,
  onPreviousWeek,
  onNextWeek,
  onToday,
  taskCounts = {},
}: WeekCalendarProps) {
  // Calculate the week based on selectedDate (Sunday start)
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [selectedDate]);

  const currentMonth = format(selectedDate, "MMMM yyyy", { locale: ptBR });

  return (
    <div className="space-y-4">
      {/* Month Header with Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onPreviousWeek}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        
        <button
          onClick={onToday}
          className="flex flex-col items-center gap-0.5 hover:text-primary transition-colors"
        >
          <span className="text-lg font-semibold capitalize">
            {currentMonth}
          </span>
          <span className="text-xs text-muted-foreground">
            Clique para ir para hoje
          </span>
        </button>
        
        <Button variant="ghost" size="icon" onClick={onNextWeek}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Week Days Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        <AnimatePresence mode="popLayout">
          {weekDays.map((date) => {
            const dateKey = format(date, "yyyy-MM-dd");
            const isSelected = isSameDay(date, selectedDate);
            const isCurrentDay = isToday(date);
            const taskCount = taskCounts[dateKey] || 0;

            return (
              <motion.button
                key={dateKey}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                onClick={() => onSelectDate(date)}
                className={cn(
                  "flex flex-col items-center p-2 sm:p-3 rounded-xl cursor-pointer transition-all",
                  "hover:bg-secondary/80",
                  isSelected && "bg-primary text-primary-foreground shadow-md",
                  !isSelected && isCurrentDay && "bg-primary/10 text-primary ring-2 ring-primary/30",
                  !isSelected && !isCurrentDay && "hover:bg-secondary"
                )}
              >
                {/* Day of week */}
                <span className={cn(
                  "text-xs uppercase font-medium mb-1",
                  isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                )}>
                  {format(date, "EEE", { locale: ptBR }).slice(0, 3)}
                </span>
                
                {/* Day number */}
                <span className={cn(
                  "text-lg sm:text-xl font-bold mb-1",
                  isSelected ? "text-primary-foreground" : ""
                )}>
                  {format(date, "d")}
                </span>

                {/* Task dots indicator */}
                {taskCount > 0 && (
                  <div className="flex items-center gap-0.5 mt-1">
                    {/* Render up to 3 dots */}
                    {Array.from({ length: Math.min(taskCount, 3) }).map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          isSelected ? "bg-primary-foreground" : "bg-primary"
                        )}
                      />
                    ))}
                    {/* If more than 3, show "+N" */}
                    {taskCount > 3 && (
                      <span className={cn(
                        "text-[10px] font-medium ml-0.5",
                        isSelected ? "text-primary-foreground/80" : "text-primary"
                      )}>
                        +{taskCount - 3}
                      </span>
                    )}
                  </div>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
