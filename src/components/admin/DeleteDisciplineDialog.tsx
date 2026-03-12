import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, AlertTriangle, School, BookOpen, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DeleteDisciplineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'school' | 'edital';
  disciplineId: string;
  disciplineName: string;
  schoolId?: string;
  schoolName?: string;
  editalId?: string;
  editalName?: string;
  affectedSchoolsCount?: number;
  onSuccess: () => void;
}

export function DeleteDisciplineDialog({
  open,
  onOpenChange,
  mode,
  disciplineId,
  disciplineName,
  schoolId,
  schoolName,
  editalId,
  editalName,
  affectedSchoolsCount = 0,
  onSuccess
}: DeleteDisciplineDialogProps) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  
  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (mode === 'school' && schoolId) {
        const { data, error } = await supabase.rpc('delete_discipline_from_school', {
          p_discipline_id: disciplineId,
          p_school_id: schoolId
        });
        
        if (error) throw error;
        
        const result = data as { success: boolean; error?: string; deleted_tasks?: number; affected_cronogramas?: number } | null;
        
        if (!result?.success) {
          throw new Error(result?.error || 'Erro desconhecido');
        }
        
        toast({
          title: 'Disciplina removida!',
          description: `${result.deleted_tasks || 0} tarefas removidas. ${result.affected_cronogramas || 0} cronogramas marcados para atualização.`
        });
      } else if (mode === 'edital' && editalId) {
        const { data, error } = await supabase.rpc('delete_discipline_from_edital', {
          p_discipline_id: disciplineId,
          p_edital_id: editalId
        });
        
        if (error) throw error;
        
        const result = data as { 
          success: boolean; 
          error?: string; 
          affected_schools?: number; 
          total_deleted_tasks?: number; 
          total_affected_cronogramas?: number 
        } | null;
        
        if (!result?.success) {
          throw new Error(result?.error || 'Erro desconhecido');
        }
        
        toast({
          title: 'Disciplina removida do edital!',
          description: `Removida de ${result.affected_schools || 0} escolas. ${result.total_deleted_tasks || 0} tarefas excluídas. ${result.total_affected_cronogramas || 0} cronogramas afetados.`
        });
      }
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deleting discipline:', error);
      toast({ 
        title: 'Erro ao excluir disciplina', 
        description: error.message || 'Tente novamente',
        variant: 'destructive' 
      });
    } finally {
      setDeleting(false);
    }
  };
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Excluir Disciplina
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              Você está prestes a remover a disciplina <strong className="text-foreground">{disciplineName}</strong>
              {mode === 'school' && schoolName && (
                <> da escola <strong className="text-foreground">{schoolName}</strong></>
              )}
              {mode === 'edital' && editalName && (
                <> de todas as escolas do edital <strong className="text-foreground">{editalName}</strong></>
              )}
              .
            </p>
            
            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20 space-y-3">
              <div className="flex items-center gap-2 text-destructive font-medium">
                <Trash2 className="w-4 h-4" />
                Esta ação irá:
              </div>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Desativar o vínculo da disciplina com a escola
                </li>
                <li className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Excluir todas as tarefas pendentes desta disciplina nos cronogramas
                </li>
                <li className="flex items-center gap-2">
                  <School className="w-4 h-4" />
                  Marcar cronogramas afetados para recálculo
                </li>
              </ul>
              
              {mode === 'edital' && affectedSchoolsCount > 0 && (
                <div className="pt-2 border-t border-destructive/20">
                  <Badge variant="destructive">
                    {affectedSchoolsCount} escolas serão afetadas
                  </Badge>
                </div>
              )}
            </div>
            
            <p className="text-sm text-amber-600 dark:text-amber-400">
              ⚠️ Tarefas já concluídas serão preservadas, mas não contarão mais para estatísticas desta disciplina.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete} 
            disabled={deleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir Disciplina
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
