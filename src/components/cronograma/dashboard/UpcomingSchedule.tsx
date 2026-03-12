import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle2, Circle, BookOpen, Video, FileText, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ScheduleItem {
  id: string;
  title: string;
  subject: string;
  time: string;
  duration: string;
  isCompleted: boolean;
  goalType?: string;
}

interface UpcomingScheduleProps {
  items: ScheduleItem[];
  onClick?: () => void;
}

const colorStyles = [
  "border-l-primary bg-primary/5",
  "border-l-success bg-success/5",
  "border-l-warning bg-warning/5",
  "border-l-info bg-info/5",
  "border-l-accent bg-accent/5",
];

const goalTypeIcons: Record<string, typeof BookOpen> = {
  study: BookOpen,
  video: Video,
  pdf: FileText,
  questions: HelpCircle,
};

export function UpcomingSchedule({ items, onClick }: UpcomingScheduleProps) {
  const today = new Date();
  const formattedDate = today.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.3 }}
    >
      <Card
        className={cn(
          "border-border/50 h-full",
          onClick && "cursor-pointer hover:border-primary/30 transition-colors"
        )}
        onClick={onClick}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              Agenda de Hoje
            </CardTitle>
            <span className="text-sm text-secondary-foreground bg-secondary px-2 py-1 rounded-md">
              {formattedDate}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Clock className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Nenhuma tarefa agendada para hoje</p>
            </div>
          ) : (
            items.slice(0, 5).map((item, index) => {
              const GoalIcon = goalTypeIcons[item.goalType || "study"] || BookOpen;
              
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border-l-4",
                    colorStyles[index % colorStyles.length],
                    item.isCompleted && "opacity-60"
                  )}
                >
                  {/* Time and Duration */}
                  <div className="flex flex-col items-center min-w-[50px]">
                    <span className="text-xs font-medium">{item.time || "--:--"}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {item.duration}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-8 bg-border" />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      {item.subject}
                    </p>
                    <p
                      className={cn(
                        "text-sm font-medium truncate",
                        item.isCompleted && "line-through"
                      )}
                    >
                      {item.title}
                    </p>
                  </div>

                  {/* Status Icon */}
                  {item.isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground/50 flex-shrink-0" />
                  )}
                </div>
              );
            })
          )}
          
          {items.length > 5 && (
            <p className="text-xs text-center text-muted-foreground pt-2">
              +{items.length - 5} outras tarefas
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
