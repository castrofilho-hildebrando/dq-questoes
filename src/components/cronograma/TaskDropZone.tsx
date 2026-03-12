import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Droppable, 
  Draggable,
  DroppableProvided,
  DraggableProvided 
} from "@hello-pangea/dnd";
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Circle,
  GripVertical 
} from "lucide-react";
import { format, isToday, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CronogramaTask {
  id: string;
  scheduled_date: string;
  duration_minutes: number;
  is_completed: boolean;
  topic_goals?: {
    name: string;
  } | null;
  study_topics?: {
    name: string;
  } | null;
}

interface TaskDropZoneProps {
  date: Date;
  tasks: CronogramaTask[];
  droppableId: string;
  isCurrentDay?: boolean;
}

export function TaskDropZone({
  date,
  tasks,
  droppableId,
  isCurrentDay = false,
}: TaskDropZoneProps) {
  const completedTasks = tasks.filter(t => t.is_completed).length;
  const totalMinutes = tasks.reduce((sum, t) => sum + t.duration_minutes, 0);
  const isDayToday = isToday(date);
  const isPast = isBefore(date, new Date()) && !isDayToday;
  const isFuture = isAfter(date, new Date()) && !isDayToday;

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
  };

  return (
    <Card className={cn(
      "h-full min-h-[300px] transition-all",
      isCurrentDay && "ring-2 ring-primary",
      isDayToday && "bg-primary/5"
    )}>
      <CardHeader className="py-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm">
              {format(date, "EEE, dd/MM", { locale: ptBR })}
            </CardTitle>
            {isDayToday && (
              <Badge variant="secondary" className="text-xs">Hoje</Badge>
            )}
            {isPast && (
              <Badge variant="outline" className="text-xs text-muted-foreground">Passado</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{completedTasks}/{tasks.length}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(totalMinutes)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Droppable droppableId={droppableId}>
          {(provided: DroppableProvided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "min-h-[200px] rounded-lg border-2 border-dashed transition-colors p-2 space-y-2",
                snapshot.isDraggingOver 
                  ? "border-primary bg-primary/10" 
                  : "border-muted-foreground/20"
              )}
            >
              {tasks.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Arraste tarefas para cá
                </div>
              ) : (
                tasks.map((task, index) => (
                  <Draggable 
                    key={task.id} 
                    draggableId={task.id} 
                    index={index}
                    isDragDisabled={task.is_completed}
                  >
                    {(provided: DraggableProvided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "p-2 bg-background rounded-md border shadow-sm",
                          "transition-all",
                          snapshot.isDragging && "shadow-lg ring-2 ring-primary",
                          task.is_completed && "opacity-60"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {!task.is_completed && (
                            <div 
                              {...provided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing text-muted-foreground"
                            >
                              <GripVertical className="w-3 h-3" />
                            </div>
                          )}
                          {task.is_completed ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-xs font-medium truncate",
                              task.is_completed && "line-through text-muted-foreground"
                            )}>
                              {task.topic_goals?.name || task.study_topics?.name || "Tarefa"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatDuration(task.duration_minutes)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </CardContent>
    </Card>
  );
}
