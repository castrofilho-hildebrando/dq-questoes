import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  RefreshCw, 
  HelpCircle, 
  CheckCircle2, 
  Circle, 
  Clock,
  GripVertical
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

interface TaskCardProps {
  task: CronogramaTask;
  onClick: () => void;
  onToggle: () => void;
  showDragHandle?: boolean;
  dragHandleProps?: any;
}

const GOAL_TYPE_CONFIG = {
  study: {
    label: "Estudo",
    icon: BookOpen,
    borderColor: "border-l-blue-500",
    badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  },
  review: {
    label: "Revisão",
    icon: RefreshCw,
    borderColor: "border-l-amber-500",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  },
  questions: {
    label: "Questões",
    icon: HelpCircle,
    borderColor: "border-l-green-500",
    badgeColor: "bg-green-500/10 text-green-600 border-green-500/30",
  },
};

export function TaskCard({
  task,
  onClick,
  onToggle,
  showDragHandle = false,
  dragHandleProps,
}: TaskCardProps) {
  const goal = task.topic_goals;
  const topic = goal?.study_topics || task.study_topics;
  const discipline = topic?.study_disciplines;
  
  // For revisions, always use review config; otherwise use goal type
  // Explicitly check for truthy is_revision to handle null/undefined
  const isRevision = task.is_revision === true;
  const effectiveGoalType = isRevision ? "review" : ((goal?.goal_type || "study") as keyof typeof GOAL_TYPE_CONFIG);
  const typeConfig = GOAL_TYPE_CONFIG[effectiveGoalType] || GOAL_TYPE_CONFIG.study;
  const Icon = typeConfig.icon;
  const borderColor = typeConfig.borderColor;

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "group flex items-start gap-3 p-4 rounded-lg border-l-4 bg-card border border-border",
        "cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30",
        borderColor,
        task.is_completed && "opacity-60 bg-muted/50"
      )}
      onClick={onClick}
    >
      {/* Drag Handle */}
      {showDragHandle && !task.is_completed && (
        <div
          {...dragHandleProps}
          className="pt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}

      {/* Checkbox */}
      <button
        className="pt-1 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {task.is_completed ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : (
          <Circle className="w-5 h-5 text-muted-foreground/50 hover:text-primary transition-colors" />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className={cn(
            "font-medium text-sm sm:text-base",
            task.is_completed && "line-through text-muted-foreground"
          )}>
            {isRevision ? `Revisão ${task.revision_number}` : (goal?.name || topic?.name || "Tarefa de estudo")}
          </h3>
          {/* Part badge */}
          {task.total_parts && task.total_parts > 1 && (
            <Badge variant="outline" className="text-[10px] h-5">
              {task.part_number}/{task.total_parts}
            </Badge>
          )}
        </div>

        {/* Discipline name */}
        {discipline && (
          <p className="text-xs text-muted-foreground mb-2">
            {discipline.name}
          </p>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className={cn("text-[10px] gap-1", typeConfig.badgeColor)}>
            <Icon className="w-3 h-3" />
            {isRevision ? `Revisão ${task.revision_number}` : typeConfig.label}
          </Badge>
          
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {formatDuration(task.duration_minutes)}
          </span>

          {task.is_completed && task.completed_at && (
            <span className="text-[10px] text-green-600">
              Concluída às {format(new Date(task.completed_at), "HH:mm")}
            </span>
          )}
        </div>
      </div>

      {/* Type Icon */}
      <div className={cn(
        "p-2 rounded-lg flex-shrink-0",
        task.is_completed ? "bg-muted" : typeConfig.badgeColor
      )}>
        <Icon className="w-4 h-4" />
      </div>
    </motion.div>
  );
}
