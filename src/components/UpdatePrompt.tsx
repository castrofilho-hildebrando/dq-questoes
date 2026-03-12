import { useAppVersion } from '@/hooks/useAppVersion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RefreshCw, Loader2, AlertTriangle } from 'lucide-react';

export function UpdatePrompt() {
  const { needsUpdate, isUpdating, isMandatory, performUpdate, dismissUpdate, currentVersion } = useAppVersion();

  if (!needsUpdate) return null;

  return (
    <AlertDialog open={needsUpdate} onOpenChange={() => !isMandatory && dismissUpdate()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isMandatory ? (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Atualização Obrigatória
              </>
            ) : (
              <>
                <RefreshCw className="h-5 w-5 text-primary" />
                Nova Versão Disponível
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              {isMandatory 
                ? 'Uma atualização crítica está disponível. Por favor, atualize para continuar usando a plataforma.'
                : 'Uma nova versão da plataforma está disponível com melhorias e correções.'}
            </p>
            <p className="text-xs text-muted-foreground">
              Versão: {currentVersion}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {!isMandatory && (
            <AlertDialogCancel disabled={isUpdating}>
              Depois
            </AlertDialogCancel>
          )}
          <AlertDialogAction 
            onClick={performUpdate} 
            disabled={isUpdating}
            className="gap-2"
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Atualizando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Atualizar Agora
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
