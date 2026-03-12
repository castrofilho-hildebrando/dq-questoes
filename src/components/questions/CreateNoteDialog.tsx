import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Question } from "@/hooks/useQuestions";

interface CreateNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: Question | null;
}

export function CreateNoteDialog({ open, onOpenChange, question }: CreateNoteDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [noteContent, setNoteContent] = useState("");

  const createNoteMutation = useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      if (!user?.id || !question) throw new Error("Missing data");

      const { data, error } = await supabase
        .from("question_notes")
        .insert({
          user_id: user.id,
          question_id: question.id,
          discipline_id: question.study_discipline_id || null,
          topic_id: question.study_topic_id || null,
          discipline_name: question.discipline_name || null,
          topic_name: question.topic_name || null,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-question-notes"] });
      onOpenChange(false);
      setNoteContent("");
      toast.success("Anotação criada com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating note:", error);
      toast.error("Erro ao criar anotação");
    },
  });

  const handleCreate = () => {
    if (!noteContent.trim()) {
      toast.error("Digite o conteúdo da anotação");
      return;
    }
    createNoteMutation.mutate({ content: noteContent });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar Anotação</DialogTitle>
          <DialogDescription>
            {question && (
              <span className="text-sm">
                Questão: <strong>{question.code}</strong>
                {question.discipline_name && (
                  <span> • {question.discipline_name}</span>
                )}
                {question.topic_name && (
                  <span> • {question.topic_name}</span>
                )}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="note-content">Anotação</Label>
            <Textarea
              id="note-content"
              placeholder="Digite sua anotação sobre esta questão..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={createNoteMutation.isPending}>
            {createNoteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar Anotação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
