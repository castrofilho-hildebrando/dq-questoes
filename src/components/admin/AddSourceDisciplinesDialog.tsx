import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BookOpen, FileText, HelpCircle, AlertTriangle } from 'lucide-react';

interface SourceDiscipline {
  id: string;
  name: string;
  topic_count: number;
  question_count: number;
}

interface AddSourceDisciplinesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  schoolName: string;
  onSuccess: () => void;
}

export function AddSourceDisciplinesDialog({
  open,
  onOpenChange,
  schoolId,
  schoolName,
  onSuccess,
}: AddSourceDisciplinesDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disciplines, setDisciplines] = useState<SourceDiscipline[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && schoolId) {
      fetchAvailableDisciplines();
    }
  }, [open, schoolId]);

  const fetchAvailableDisciplines = async () => {
    setLoading(true);
    setSelectedIds(new Set());
    
    try {
      const { data, error } = await supabase.rpc('get_available_source_disciplines_for_school', {
        p_school_id: schoolId,
      });

      if (error) throw error;
      
      setDisciplines((data as SourceDiscipline[]) || []);
    } catch (error) {
      console.error('Error fetching available disciplines:', error);
      toast({
        title: 'Erro ao carregar disciplinas',
        description: 'Não foi possível carregar as disciplinas disponíveis.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleDiscipline = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === disciplines.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(disciplines.map((d) => d.id)));
    }
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('add_source_disciplines_to_school', {
        p_school_id: schoolId,
        p_discipline_ids: Array.from(selectedIds),
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        added: number;
        skipped: number;
        cronogramas_marked: number;
        added_disciplines: string[];
        error?: string;
      };

      if (!result.success) {
        throw new Error(result.error || 'Erro ao adicionar disciplinas');
      }

      toast({
        title: 'Disciplinas adicionadas!',
        description: `${result.added} disciplina(s) adicionada(s). ${result.cronogramas_marked} cronograma(s) marcado(s) para recálculo.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error adding disciplines:', error);
      toast({
        title: 'Erro ao adicionar disciplinas',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Adicionar Disciplinas da Fonte (Pré-Edital)
          </DialogTitle>
          <DialogDescription>
            Selecione disciplinas-fonte para adicionar à escola <strong>"{schoolName}"</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Warning */}
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-700 dark:text-amber-300">
              <strong>Importante:</strong> As disciplinas adicionadas aparecerão nas abas Metas e Revisões 
              <strong> sem configurações</strong>. Configure manualmente metas e revisões para cada tópico 
              antes de recalcular os cronogramas dos alunos.
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : disciplines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <HelpCircle className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Todas as disciplinas-fonte já estão vinculadas a esta escola.
            </p>
          </div>
        ) : (
          <>
            {/* Select All */}
            <div className="flex items-center justify-between pb-2 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                className="text-sm"
              >
                {selectedIds.size === disciplines.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
              </Button>
              <Badge variant="secondary">
                {selectedIds.size} de {disciplines.length} selecionada(s)
              </Badge>
            </div>

            {/* Discipline List */}
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {disciplines.map((discipline) => (
                  <div
                    key={discipline.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      selectedIds.has(discipline.id)
                        ? 'bg-primary/10 border-primary/50'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleDiscipline(discipline.id)}
                  >
                    <Checkbox
                      checked={selectedIds.has(discipline.id)}
                      onCheckedChange={() => toggleDiscipline(discipline.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{discipline.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {discipline.topic_count} tópico(s)
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" />
                          {discipline.question_count} questão(ões)
                        </span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      ZIP
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleAdd}
            disabled={saving || selectedIds.size === 0 || loading}
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Adicionar {selectedIds.size > 0 && `(${selectedIds.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
