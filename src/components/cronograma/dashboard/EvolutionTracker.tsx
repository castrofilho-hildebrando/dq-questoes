import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronRight, 
  ArrowLeft, 
  TrendingUp, 
  Target, 
  FileQuestion,
  School,
  BookOpen,
  Layers,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEvolutionTracker, MetricType, FilterLevel, EvolutionItem } from "@/hooks/useEvolutionTracker";
import { cn } from "@/lib/utils";

interface EvolutionTrackerProps {
  cronogramaId?: string;
}

export function EvolutionTracker({ cronogramaId }: EvolutionTrackerProps) {
  const [metricType, setMetricType] = useState<MetricType>("goals");
  const {
    items,
    loading,
    currentLevel,
    schoolName,
    disciplineName,
    drillDown,
    goBack,
    goToLevel,
  } = useEvolutionTracker(cronogramaId);

  const getLevelIcon = (level: FilterLevel) => {
    switch (level) {
      case "school": return School;
      case "discipline": return BookOpen;
      case "topic": return Layers;
    }
  };

  const getLevelLabel = (level: FilterLevel) => {
    switch (level) {
      case "school": return "Escola";
      case "discipline": return "Disciplinas";
      case "topic": return "Tópicos";
    }
  };

  const getBreadcrumbs = () => {
    const crumbs: { level: FilterLevel; label: string }[] = [
      { level: "school", label: "Escola" }
    ];
    
    if (currentLevel === "discipline" || currentLevel === "topic") {
      crumbs.push({ level: "discipline", label: disciplineName || "Disciplinas" });
    }
    
    if (currentLevel === "topic") {
      crumbs.push({ level: "topic", label: "Tópicos" });
    }
    
    return crumbs;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return "bg-green-500";
    if (percentage >= 50) return "bg-yellow-500";
    if (percentage >= 25) return "bg-orange-500";
    return "bg-red-500";
  };

  const renderItem = (item: EvolutionItem, index: number) => {
    const value = metricType === "goals" ? item.goalsProgress : item.accuracyRate;
    const primaryStat = metricType === "goals" 
      ? `${item.completedGoals}/${item.totalGoals} metas`
      : `${item.correctQuestions}/${item.totalQuestions} questões`;

    return (
      <motion.div
        key={item.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.2, delay: index * 0.05 }}
        className={cn(
          "group p-4 rounded-lg border border-border/50 bg-card hover:bg-accent/50 transition-all",
          item.hasChildren && "cursor-pointer"
        )}
        onClick={() => item.hasChildren && drillDown(item)}
      >
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium truncate">{item.name}</h4>
              {item.hasChildren && (
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                {metricType === "goals" ? (
                  <Target className="w-3.5 h-3.5" />
                ) : (
                  <FileQuestion className="w-3.5 h-3.5" />
                )}
                {primaryStat}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className={cn(
                "text-lg font-bold",
                value >= 70 ? "text-green-600 dark:text-green-400" :
                value >= 40 ? "text-yellow-600 dark:text-yellow-400" :
                "text-red-600 dark:text-red-400"
              )}>
                {value}%
              </span>
            </div>
            <div className="w-20">
              <Progress 
                value={value} 
                className={cn("h-2", getProgressColor(value))}
              />
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.3 }}
    >
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Acompanhe sua Evolução
            </CardTitle>
            <Tabs value={metricType} onValueChange={(v) => setMetricType(v as MetricType)}>
              <TabsList className="h-8">
                <TabsTrigger value="goals" className="text-xs px-3 h-7">
                  <Target className="w-3.5 h-3.5 mr-1" />
                  Metas
                </TabsTrigger>
                <TabsTrigger value="questions" className="text-xs px-3 h-7">
                  <FileQuestion className="w-3.5 h-3.5 mr-1" />
                  Questões
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 mt-3 text-sm">
            {currentLevel !== "school" && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2"
                onClick={goBack}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            {getBreadcrumbs().map((crumb, index, arr) => {
              const Icon = getLevelIcon(crumb.level);
              const isLast = index === arr.length - 1;
              const isClickable = !isLast && crumb.level !== currentLevel;
              
              return (
                <div key={crumb.level} className="flex items-center gap-1">
                  <Badge 
                    variant={isLast ? "default" : "secondary"}
                    className={cn(
                      "gap-1 font-normal",
                      isClickable && "cursor-pointer hover:bg-secondary/80"
                    )}
                    onClick={() => isClickable && goToLevel(crumb.level)}
                  >
                    <Icon className="w-3 h-3" />
                    {crumb.label}
                  </Badge>
                  {!isLast && (
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum dado disponível para este nível.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {items.map((item, index) => renderItem(item, index))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
