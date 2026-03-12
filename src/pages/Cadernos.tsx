import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, BookOpen, Plus, ArrowLeft, Play, Trash2, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Notebook {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  question_count: number;
}

export default function Cadernos() {
  const navigate = useNavigate();
  const { goBack } = useBackNavigation();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState("");
  const [newNotebookDescription, setNewNotebookDescription] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  const { data: notebooks, isLoading } = useQuery({
    queryKey: ["user-notebooks", user?.id],
    queryFn: async (): Promise<Notebook[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("study_notebooks")
        .select(`
          id,
          name,
          description,
          created_at,
          notebook_questions(count)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching notebooks:", error);
        throw error;
      }

      return (data || []).map((nb: any) => ({
        id: nb.id,
        name: nb.name,
        description: nb.description,
        created_at: nb.created_at,
        question_count: nb.notebook_questions?.[0]?.count || 0,
      }));
    },
    enabled: !!user?.id,
  });

  const createNotebookMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      if (!user?.id) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("study_notebooks")
        .insert({
          user_id: user.id,
          name,
          description: description || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notebooks"] });
      setIsCreateDialogOpen(false);
      setNewNotebookName("");
      setNewNotebookDescription("");
      toast.success("Caderno criado com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating notebook:", error);
      toast.error("Erro ao criar caderno");
    },
  });

  const deleteNotebookMutation = useMutation({
    mutationFn: async (notebookId: string) => {
      const { error } = await supabase
        .from("study_notebooks")
        .delete()
        .eq("id", notebookId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notebooks"] });
      toast.success("Caderno excluído com sucesso!");
    },
    onError: (error) => {
      console.error("Error deleting notebook:", error);
      toast.error("Erro ao excluir caderno");
    },
  });

  const handleCreateNotebook = () => {
    if (!newNotebookName.trim()) {
      toast.error("Digite um nome para o caderno");
      return;
    }
    createNotebookMutation.mutate({ name: newNotebookName, description: newNotebookDescription });
  };

  const handleOpenNotebook = (notebookId: string) => {
    navigate(`/caderno-questoes?notebookIds=${notebookId}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={goBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="font-heading text-xl font-bold">Meus Cadernos</h1>
                  <p className="text-sm text-muted-foreground">Organize suas questões em cadernos personalizados</p>
                </div>
              </div>
            </div>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Caderno
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Caderno</DialogTitle>
                  <DialogDescription>
                    Crie um caderno para organizar suas questões de estudo.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Caderno</Label>
                    <Input
                      id="name"
                      placeholder="Ex: Questões de Constitucional"
                      value={newNotebookName}
                      onChange={(e) => setNewNotebookName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição (opcional)</Label>
                    <Input
                      id="description"
                      placeholder="Ex: Questões para revisar antes da prova"
                      value={newNotebookDescription}
                      onChange={(e) => setNewNotebookDescription(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateNotebook} disabled={createNotebookMutation.isPending}>
                    {createNotebookMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Criar Caderno
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : notebooks && notebooks.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {notebooks.map((notebook) => (
              <Card key={notebook.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center">
                        <FolderOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{notebook.name}</CardTitle>
                        <CardDescription>
                          {notebook.question_count} questão{notebook.question_count !== 1 ? "ões" : ""}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  {notebook.description && (
                    <p className="text-sm text-muted-foreground mt-2">{notebook.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Button 
                      className="flex-1" 
                      onClick={() => handleOpenNotebook(notebook.id)}
                      disabled={notebook.question_count === 0}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Estudar
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (confirm("Tem certeza que deseja excluir este caderno?")) {
                          deleteNotebookMutation.mutate(notebook.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">Nenhum caderno criado</p>
            <p className="text-muted-foreground text-center max-w-md">
              Crie cadernos para organizar suas questões favoritas e revisar quando quiser.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Caderno
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
