import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, FolderPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Notebook {
  id: string;
  name: string;
  question_count: number;
}

interface AddToNotebookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionId: string | null;
}

export function AddToNotebookDialog({ 
  open, 
  onOpenChange, 
  questionId 
}: AddToNotebookDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');

  const { data: notebooks = [], isLoading } = useQuery({
    queryKey: ["user-notebooks-dialog", user?.id],
    queryFn: async (): Promise<Notebook[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("study_notebooks")
        .select(`
          id,
          name,
          notebook_questions(count)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching notebooks:", error);
        return [];
      }

      return (data || []).map((nb: any) => ({
        id: nb.id,
        name: nb.name,
        question_count: nb.notebook_questions?.[0]?.count || 0,
      }));
    },
    enabled: !!user?.id && open,
  });

  const createNotebookMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!user?.id) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("study_notebooks")
        .insert({
          user_id: user.id,
          name,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notebooks-dialog"] });
      queryClient.invalidateQueries({ queryKey: ["user-notebooks"] });
    },
  });

  const addQuestionMutation = useMutation({
    mutationFn: async ({ notebookId, questionId }: { notebookId: string; questionId: string }) => {
      // Check if question is already in notebook
      const { data: existing } = await supabase
        .from("notebook_questions")
        .select("id")
        .eq("notebook_id", notebookId)
        .eq("question_id", questionId)
        .maybeSingle();

      if (existing) {
        throw new Error("Questão já está neste caderno");
      }

      const { error } = await supabase
        .from("notebook_questions")
        .insert({
          notebook_id: notebookId,
          question_id: questionId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notebooks-dialog"] });
      queryClient.invalidateQueries({ queryKey: ["user-notebooks"] });
      toast.success("Questão adicionada ao caderno!");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao adicionar questão");
    },
  });

  useEffect(() => {
    if (!open) {
      setShowNewForm(false);
      setNewName('');
    }
  }, [open]);

  const handleSelectNotebook = async (notebookId: string) => {
    if (!questionId) return;
    addQuestionMutation.mutate({ notebookId, questionId });
  };

  const handleCreateNotebook = async () => {
    if (!newName.trim() || !questionId) return;

    try {
      const notebook = await createNotebookMutation.mutateAsync(newName.trim());
      if (notebook) {
        await addQuestionMutation.mutateAsync({ notebookId: notebook.id, questionId });
      }
    } catch (error) {
      toast.error("Erro ao criar caderno");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar ao Caderno</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : showNewForm ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notebook-name">Nome do Caderno</Label>
              <Input
                id="notebook-name"
                placeholder="Ex: Direito Constitucional"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateNotebook()}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowNewForm(false)}
              >
                Voltar
              </Button>
              <Button 
                onClick={handleCreateNotebook}
                disabled={!newName.trim() || createNotebookMutation.isPending || addQuestionMutation.isPending}
              >
                {(createNotebookMutation.isPending || addQuestionMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                Criar e Adicionar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {notebooks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Você ainda não tem cadernos. Crie um para começar!
                  </p>
                ) : (
                  notebooks.map((notebook) => (
                    <Button
                      key={notebook.id}
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => handleSelectNotebook(notebook.id)}
                      disabled={addQuestionMutation.isPending}
                    >
                      <FolderPlus className="h-4 w-4" />
                      <span className="flex-1 text-left">{notebook.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {notebook.question_count} questões
                      </span>
                    </Button>
                  ))
                )}
              </div>
            </ScrollArea>
            <Button 
              variant="secondary" 
              className="w-full gap-2"
              onClick={() => setShowNewForm(true)}
            >
              <Plus className="h-4 w-4" />
              Criar Novo Caderno
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
