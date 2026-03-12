import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileQuestion, Target, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Activity {
  id: string;
  type: "question" | "task";
  title: string;
  description: string;
  time: string;
  status?: "correct" | "incorrect";
}

interface RecentActivityProps {
  items: Activity[];
}

const iconMap = {
  question: FileQuestion,
  task: Target,
};

const iconStyleMap = {
  question: "bg-primary/10 text-primary",
  task: "bg-success/10 text-success",
};

export function RecentActivity({ items }: RecentActivityProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.4 }}
    >
      <Card className="border-border/50 h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">
            Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileQuestion className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Nenhuma atividade recente</p>
            </div>
          ) : (
            items.slice(0, 6).map((activity) => {
              const Icon = iconMap[activity.type];

              return (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "p-2 rounded-lg flex-shrink-0",
                      iconStyleMap[activity.type]
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {activity.title}
                      </p>
                      {activity.status === "correct" && (
                        <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                      )}
                      {activity.status === "incorrect" && (
                        <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.description}
                    </p>
                  </div>

                  {/* Time */}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {activity.time}
                  </span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
