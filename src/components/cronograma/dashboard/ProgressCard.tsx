import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProgressCardProps {
  subject: string;
  percentage: number;
  total: number;
  correct: number;
  colorIndex?: number;
}

const progressColors = [
  "bg-primary",
  "bg-success",
  "bg-warning",
  "bg-info",
  "bg-accent",
  "bg-destructive",
];

export function ProgressCard({
  subject,
  percentage,
  total,
  correct,
  colorIndex = 0,
}: ProgressCardProps) {
  const colorClass = progressColors[colorIndex % progressColors.length];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate max-w-[60%]">
          {subject}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {correct}/{total}
          </span>
          <span className="text-sm font-bold">{percentage}%</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            colorClass
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
