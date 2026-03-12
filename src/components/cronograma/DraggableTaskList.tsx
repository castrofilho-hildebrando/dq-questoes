import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  DragDropContext, 
  Droppable, 
  Draggable, 
  DropResult,
  DraggableProvided,
  DroppableProvided
} from "@hello-pangea/dnd";
import { 
  GripVertical, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Video, 
  FileText, 
  Lightbulb, 
  Target, 
  BookOpen 
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CronogramaTask {
  id: string;
  cronograma_id: string;
  goal_id: string | null;
  scheduled_date: string;
  start_time: string | null;
  duration_minutes: number;
  is_completed: boolean;
  completed_at: string | null;
  notes: string | null;
  is_revision: boolean;
  revision_number: number | null;
  source_topic_id: string | null;
  part_number: number | null;
  total_parts: number | null;
  topic_goals?: {
    id: string;
    name: string;
    description: string | null;
    goal_type: string | null;
    duration_minutes: number | null;
    video_links: any;
    pdf_links: any;
    flashcard_links: string[] | null;
    study_topics?: {
      id: string;
      name: string;
      study_disciplines?: {
        id: string;
        name: string;
      };
    };
  } | null;
  study_topics?: {
    id: string;
    name: string;
    study_disciplines?: {
      id: string;
      name: string;
    };
  } | null;
}

interface DraggableTaskListProps {
  tasks: CronogramaTask[];
  onTaskToggle: (taskId: string, currentStatus: boolean) => void;
  onTaskClick?: (task: CronogramaTask) => void;
  onReorder: (result: DropResult) => void;
  isDragDisabled?: boolean;
}

export function DraggableTaskList({
  tasks,
  onTaskToggle,
  onTaskClick,
  onReorder,
  isDragDisabled = false,
}: DraggableTaskListProps) {
  const getGoalTypeIcon = (goalType: string | null) => {
    switch (goalType) {
      case 'video': return <Video className="w-4 h-4" />;
      case 'pdf': return <FileText className="w-4 h-4" />;
      case 'flashcard': return <Lightbulb className="w-4 h-4" />;
      case 'questions': return <Target className="w-4 h-4" />;
      default: return <BookOpen className="w-4 h-4" />;
    }
  };

  const getGoalTypeLabel = (goalType: string | null) => {
    switch (goalType) {
      case 'video': return 'Vídeo';
      case 'pdf': return 'PDF';
      case 'flashcard': return 'Flashcard';
      case 'questions': return 'Questões';
      default: return 'Estudo';
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  return (
    <DragDropContext onDragEnd={onReorder}>
      <Droppable droppableId="tasks-list">
        {(provided: DroppableProvided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="space-y-3"
          >
            {tasks.map((task, index) => {
              const topic = task.topic_goals?.study_topics || task.study_topics;
              const discipline = topic?.study_disciplines;
              const goalType = task.topic_goals?.goal_type;
              
              return (
                <Draggable 
                  key={task.id} 
                  draggableId={task.id} 
                  index={index}
                  isDragDisabled={isDragDisabled || task.is_completed}
                >
                  {(provided: DraggableProvided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={cn(
                        "transition-shadow",
                        snapshot.isDragging && "shadow-lg"
                      )}
                    >
                      <Card 
                        className={cn(
                          "transition-all duration-200",
                          task.is_completed && "bg-muted/50 border-muted",
                          snapshot.isDragging && "ring-2 ring-primary"
                        )}
                      >
                        <CardContent className="py-4">
                          <div className="flex items-start gap-3">
                            {/* Drag handle */}
                            {!task.is_completed && !isDragDisabled && (
                              <div
                                {...provided.dragHandleProps}
                                className="pt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                              >
                                <GripVertical className="w-4 h-4" />
                              </div>
                            )}
                            {(task.is_completed || isDragDisabled) && (
                              <div className="w-4" /> 
                            )}

                            {/* Checkbox */}
                            <div className="pt-0.5">
                              <Checkbox
                                checked={task.is_completed}
                                onCheckedChange={() => onTaskToggle(task.id, task.is_completed)}
                                className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                              />
                            </div>

                            {/* Content */}
                            <div 
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => onTaskClick ? onTaskClick(task) : onTaskToggle(task.id, task.is_completed)}
                            >
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {task.is_revision === true && (
                                  <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                                    Revisão {task.revision_number}
                                  </Badge>
                                )}
                                {goalType && (
                                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                    {getGoalTypeIcon(goalType)}
                                    {getGoalTypeLabel(goalType)}
                                  </Badge>
                                )}
                                {task.total_parts && task.total_parts > 1 && (
                                  <Badge variant="outline" className="text-xs">
                                    Parte {task.part_number}/{task.total_parts}
                                  </Badge>
                                )}
                              </div>
                              
                              <h3 className={cn(
                                "font-medium mb-1 transition-all",
                                task.is_completed && "line-through text-muted-foreground"
                              )}>
                                {task.topic_goals?.name || topic?.name || "Tarefa de estudo"}
                              </h3>
                              
                              {discipline && (
                                <p className="text-sm text-muted-foreground mb-2">
                                  {discipline.name}
                                  {topic && topic.name !== task.topic_goals?.name && (
                                    <>
                                      <span className="mx-1">•</span>
                                      {topic.name}
                                    </>
                                  )}
                                </p>
                              )}

                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDuration(task.duration_minutes)}
                                </span>
                                {task.start_time && (
                                  <span>às {task.start_time.slice(0, 5)}</span>
                                )}
                                {task.is_completed && task.completed_at && (
                                  <span className="text-green-600 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Concluído às {format(new Date(task.completed_at), "HH:mm")}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Status indicator */}
                            <div className="flex-shrink-0">
                              {task.is_completed ? (
                                <CheckCircle2 className="w-6 h-6 text-green-500" />
                              ) : (
                                <Circle className="w-6 h-6 text-muted-foreground/30" />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
