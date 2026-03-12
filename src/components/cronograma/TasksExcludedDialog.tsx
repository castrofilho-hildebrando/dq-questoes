import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Calendar, CheckCircle } from "lucide-react";

interface TasksExcludedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasksCreated: number;
  tasksExcluded: number;
  minutesExcluded: number;
  onContinue: () => void;
  onAdjustSettings?: () => void;
}

export function TasksExcludedDialog({
  open,
  onOpenChange,
  tasksCreated,
  tasksExcluded,
  minutesExcluded,
  onContinue,
  onAdjustSettings,
}: TasksExcludedDialogProps) {
  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins}min`;
  };

  const handleContinue = () => {
    onOpenChange(false);
    onContinue();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5" />
            Cronograma Apertado!
          </DialogTitle>
          <DialogDescription className="text-left pt-2">
            Nem todas as tarefas couberam no período definido.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Success info */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-700 dark:text-green-300">
                {tasksCreated} tarefas criadas
              </p>
              <p className="text-sm text-green-600/80 dark:text-green-400/80">
                Essas tarefas foram agendadas dentro do período.
              </p>
            </div>
          </div>

          {/* Warning info */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-medium text-amber-700 dark:text-amber-300">
                {tasksExcluded} tarefas ficaram de fora
              </p>
              <p className="text-sm text-amber-600/90 dark:text-amber-400/90">
                <strong>{formatHours(minutesExcluded)}</strong> de estudo não foram incluídas por exceder a data final.
              </p>
            </div>
          </div>

          {/* Suggestions */}
          <div className="text-sm text-muted-foreground space-y-2 pt-2 border-t">
            <p className="font-medium">Para incluir todas as tarefas:</p>
            <ul className="space-y-1 ml-4 list-disc">
              <li>Aumente as horas de estudo por dia</li>
              <li>Estenda a data final do cronograma</li>
              <li>Adicione mais dias de estudo na semana</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              onOpenChange(false);
              onAdjustSettings?.();
            }}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Ajustar Configurações
          </Button>
          <Button onClick={handleContinue}>
            Continuar assim
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
