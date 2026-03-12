import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FolderPlus, AlertTriangle, BookOpen, HelpCircle } from 'lucide-react';

interface SourceTopic {
  topic_id: string;
  topic_name: string;
  source_notebook_id: string | null;
  question_count: number;
}

interface AddSourceTopicsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disciplineId: string;
  disciplineName: string;
  onSuccess?: () => void;
}

export function AddSourceTopicsDialog({
  open,
  onOpenChange,
  disciplineId,
  disciplineName,
  onSuccess
}: AddSourceTopicsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableTopics, setAvailableTopics] = useState<SourceTopic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());

  const fetchAvailableTopics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_available_source_topics', {
        p_derived_discipline_id: disciplineId
      });

      if (error) throw error;
      
      setAvailableTopics((data as SourceTopic[]) || []);
      setSelectedTopics(new Set());
    } catch (error) {
      console.error('Error fetching available topics:', error);
      toast({
        title: 'Erro ao carregar tópicos',
        description: String(error),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && disciplineId) {
      fetchAvailableTopics();
    }
  }, [open, disciplineId]);

  const toggleTopic = (topicId: string) => {
    setSelectedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedTopics.size === availableTopics.length) {
      setSelectedTopics(new Set());
    } else {
      setSelectedTopics(new Set(availableTopics.map(t => t.topic_id)));
    }
  };

  const handleSubmit = async () => {
    if (selectedTopics.size === 0) {
      toast({ title: 'Selecione ao menos um tópico', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('add_derived_topics_from_source', {
        p_derived_discipline_id: disciplineId,
        p_source_topic_ids: Array.from(selectedTopics)
      });

      if (error) throw error;

      const result = data as { success: boolean; topics_created: number; message: string };

      toast({
        title: 'Tópicos adicionados!',
        description: result.message
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error adding topics:', error);
      toast({
        title: 'Erro ao adicionar tópicos',
        description: String(error),
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5" />
            Adicionar Tópicos da Fonte
          </DialogTitle>
          <DialogDescription>
            Selecione os tópicos da disciplina-fonte para adicionar em: <strong>{disciplineName}</strong>
          </DialogDescription>
        </DialogHeader>

        <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700 dark:text-amber-400">Ação manual requerida</AlertTitle>
          <AlertDescription className="text-amber-600 dark:text-amber-300">
            Após adicionar os tópicos, você precisará configurar manualmente as <strong>Metas</strong> e <strong>Revisões</strong> para cada um.
            Os tópicos aparecerão como pendentes nas respectivas abas.
          </AlertDescription>
        </Alert>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : availableTopics.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Todos os tópicos da fonte já foram adicionados a esta disciplina.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between py-2">
              <Label className="text-sm text-muted-foreground">
                {availableTopics.length} tópico(s) disponível(is)
              </Label>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {selectedTopics.size === availableTopics.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </Button>
            </div>

            <ScrollArea className="h-[300px] border rounded-md p-4">
              <div className="space-y-3">
                {availableTopics.map((topic) => (
                  <div
                    key={topic.topic_id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer
                      ${selectedTopics.has(topic.topic_id) 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:bg-muted/50'
                      }`}
                    onClick={() => toggleTopic(topic.topic_id)}
                  >
                    <Checkbox
                      checked={selectedTopics.has(topic.topic_id)}
                      onCheckedChange={() => toggleTopic(topic.topic_id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{topic.topic_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {topic.source_notebook_id && (
                          <Badge variant="outline" className="text-xs">
                            <BookOpen className="w-3 h-3 mr-1" />
                            Caderno vinculado
                          </Badge>
                        )}
                        {topic.question_count > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <HelpCircle className="w-3 h-3 mr-1" />
                            {topic.question_count} questões
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || selectedTopics.size === 0}
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Adicionar {selectedTopics.size > 0 ? `(${selectedTopics.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
