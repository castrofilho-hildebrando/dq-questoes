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
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BookOpen, FileText, HelpCircle, AlertTriangle, School } from 'lucide-react';

interface SourceDiscipline {
  id: string;
  name: string;
  topic_count: number;
  question_count: number;
}

interface SchoolInfo {
  id: string;
  name: string;
}

interface AddSourceDisciplinesToEditalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editalId: string;
  editalName: string;
  onSuccess: () => void;
}

export function AddSourceDisciplinesToEditalDialog({
  open,
  onOpenChange,
  editalId,
  editalName,
  onSuccess,
}: AddSourceDisciplinesToEditalDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disciplines, setDisciplines] = useState<SourceDiscipline[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [schools, setSchools] = useState<SchoolInfo[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    if (open && editalId) {
      fetchData();
    }
  }, [open, editalId]);

  const fetchData = async () => {
    setLoading(true);
    setSelectedIds(new Set());
    setProgress(null);

    try {
      // Fetch schools for this edital
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('schools')
        .select('id, name')
        .eq('edital_id', editalId)
        .eq('is_active', true)
        .order('name');

      if (schoolsError) throw schoolsError;
      setSchools(schoolsData || []);

      if (!schoolsData || schoolsData.length === 0) {
        setDisciplines([]);
        setLoading(false);
        return;
      }

      // Use the first school to get available source disciplines
      // (they should be the same for all schools in the edital)
      const { data, error } = await supabase.rpc('get_available_source_disciplines_for_school', {
        p_school_id: schoolsData[0].id,
      });

      if (error) throw error;
      setDisciplines((data as SourceDiscipline[]) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Erro ao carregar dados',
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
    if (selectedIds.size === 0 || schools.length === 0) return;

    setSaving(true);
    setProgress({ current: 0, total: schools.length });

    let totalAdded = 0;
    let totalCronogramas = 0;
    let errors = 0;

    try {
      const disciplineIds = Array.from(selectedIds);

      for (let i = 0; i < schools.length; i++) {
        const school = schools[i];
        setProgress({ current: i + 1, total: schools.length });

        try {
          const { data, error } = await supabase.rpc('add_source_disciplines_to_school', {
            p_school_id: school.id,
            p_discipline_ids: disciplineIds,
          });

          if (error) {
            console.error(`Error adding to school ${school.name}:`, error);
            errors++;
            continue;
          }

          const result = data as {
            success: boolean;
            added: number;
            skipped: number;
            cronogramas_marked: number;
          };

          if (result.success) {
            totalAdded += result.added;
            totalCronogramas += result.cronogramas_marked;
          }
        } catch (err) {
          console.error(`Error adding to school ${school.name}:`, err);
          errors++;
        }
      }

      const message = errors > 0
        ? `${totalAdded} disciplina(s) adicionada(s) em ${schools.length - errors} escola(s). ${errors} erro(s). ${totalCronogramas} cronograma(s) marcado(s) para recálculo.`
        : `${totalAdded} disciplina(s) adicionada(s) em ${schools.length} escola(s). ${totalCronogramas} cronograma(s) marcado(s) para recálculo.`;

      toast({
        title: errors > 0 ? 'Concluído com erros' : 'Disciplinas adicionadas!',
        description: message,
        variant: errors > 0 ? 'destructive' : 'default',
      });

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error in bulk add:', error);
      toast({
        title: 'Erro ao adicionar disciplinas',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Adicionar Disciplinas-Fonte a Todas as Escolas
          </DialogTitle>
          <DialogDescription>
            Adicione disciplinas-fonte a <strong>todas as {schools.length} escola(s)</strong> do edital <strong>"{editalName}"</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Warning */}
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-700 dark:text-amber-300">
              <strong>Importante:</strong> As disciplinas serão adicionadas a cada escola do edital.
              Disciplinas já existentes em uma escola serão ignoradas automaticamente.
              Configure metas e revisões manualmente após adicionar.
            </div>
          </div>
        </div>

        {/* Schools info */}
        {schools.length > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <School className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{schools.length} escola(s) serão afetadas:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {schools.slice(0, 5).map((s) => (
                <Badge key={s.id} variant="outline" className="text-xs">
                  {s.name}
                </Badge>
              ))}
              {schools.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{schools.length - 5} mais
                </Badge>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : schools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <School className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Nenhuma escola ativa vinculada a este edital.
            </p>
          </div>
        ) : disciplines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <HelpCircle className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Todas as disciplinas-fonte já estão vinculadas às escolas deste edital.
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
            <ScrollArea className="h-[250px] pr-4">
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

        {/* Progress bar */}
        {progress && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                Processando escola {progress.current} de {progress.total}...
              </span>
            </div>
            <Progress value={(progress.current / progress.total) * 100} className="h-2" />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleAdd}
            disabled={saving || selectedIds.size === 0 || loading || schools.length === 0}
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Adicionar em {schools.length} escola(s) {selectedIds.size > 0 && `(${selectedIds.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
