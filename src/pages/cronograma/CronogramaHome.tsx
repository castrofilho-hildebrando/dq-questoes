import ConselhoThemeWrapper from "@/components/ConselhoThemeWrapper";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, Calendar, Plus, ArrowLeft, Clock, Target, CheckCircle2, 
  PlayCircle, Settings, Trash2, MoreVertical, BookOpen, Lock, RotateCcw
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";

interface UserCronograma {
  id: string;
  name: string;
  school_id: string;
  start_date: string;
  end_date: string | null;
  hours_per_day: number | null;
  is_active: boolean;
  created_at: string;
  is_frozen?: boolean;
  cronograma_type?: string;
  schools?: {
    name: string;
    areas?: {
      name: string;
    } | null;
  };
}

export default function CronogramaHome() {
  const navigate = useNavigate();
  const { goBack, fromSuffix } = useBackNavigation();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cronogramaToDelete, setCronogramaToDelete] = useState<string | null>(null);

  // Fetch user's cronogramas
  const { data: cronogramas, isLoading } = useQuery({
    queryKey: ["user-cronogramas", user?.id],
    queryFn: async (): Promise<UserCronograma[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_cronogramas")
        .select(`
          *,
          schools (
            name,
            areas (name)
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch today's tasks for each cronograma
  const { data: todayTasks } = useQuery({
    queryKey: ["today-tasks", user?.id],
    queryFn: async () => {
      if (!user?.id) return {};
      const today = format(new Date(), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("user_cronograma_tasks")
        .select("cronograma_id, is_completed")
        .eq("user_id", user.id)
        .eq("scheduled_date", today);
      
      if (error) throw error;
      
      // Group by cronograma
      const grouped: Record<string, { total: number; completed: number }> = {};
      data?.forEach(task => {
        if (!grouped[task.cronograma_id]) {
          grouped[task.cronograma_id] = { total: 0, completed: 0 };
        }
        grouped[task.cronograma_id].total++;
        if (task.is_completed) {
          grouped[task.cronograma_id].completed++;
        }
      });
      
      return grouped;
    },
    enabled: !!user?.id,
    refetchInterval: 5 * 60 * 1000,
  });

  // Delete cronograma mutation
  const deleteMutation = useMutation({
    mutationFn: async (cronogramaId: string) => {
      // First delete all tasks
      await supabase
        .from("user_cronograma_tasks")
        .delete()
        .eq("cronograma_id", cronogramaId);
      
      // Then delete the cronograma
      const { error } = await supabase
        .from("user_cronogramas")
        .delete()
        .eq("id", cronogramaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-cronogramas"] });
      toast.success("Cronograma excluído com sucesso!");
      setDeleteDialogOpen(false);
      setCronogramaToDelete(null);
    },
    onError: (error) => {
      toast.error("Erro ao excluir cronograma");
      console.error(error);
    },
  });

  const handleDelete = (id: string) => {
    setCronogramaToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (cronogramaToDelete) {
      deleteMutation.mutate(cronogramaToDelete);
    }
  };

  const activeCronogramas = cronogramas?.filter(c => c.is_active) || [];
  // Cronogramas de revisão não contam no limite de 2
  const normalActiveCronogramas = activeCronogramas.filter(c => (c as any).cronograma_type !== 'revision_only');
  const canCreateMore = normalActiveCronogramas.length < 2;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <ConselhoThemeWrapper>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={goBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-bold">Cronograma Inteligente</h1>
                <p className="text-sm text-muted-foreground">Gerencie seus estudos</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {canCreateMore && (
                <Button onClick={() => navigate(`/cronograma/criar${fromSuffix}`)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Cronograma
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : cronogramas && cronogramas.length > 0 ? (
          <div className="space-y-6">
            {/* Active Limit Info */}
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">
                {normalActiveCronogramas.length}/2 cronogramas ativos
                {activeCronogramas.length > normalActiveCronogramas.length && (
                  <span className="ml-1 text-xs">
                    + {activeCronogramas.length - normalActiveCronogramas.length} de revisão
                  </span>
                )}
              </p>
            </div>

            {/* Cronograma Cards */}
            <div className="grid gap-6 md:grid-cols-2">
              {cronogramas.map((cronograma, index) => {
                const tasks = todayTasks?.[cronograma.id];
                const progress = tasks ? Math.round((tasks.completed / tasks.total) * 100) : 0;
                
                return (
                  <motion.div
                    key={cronograma.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className={`h-full ${!cronograma.is_active || (cronograma as any).is_frozen ? 'opacity-60' : ''}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CardTitle>{cronograma.name}</CardTitle>
                              {(cronograma as any).is_frozen ? (
                                <Badge variant="secondary" className="gap-1">
                                  <Lock className="w-3 h-3" />
                                  Concluído
                                </Badge>
                              ) : (cronograma as any).cronograma_type === 'revision_only' ? (
                                <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                                  <RotateCcw className="w-3 h-3" />
                                  Revisão
                                </Badge>
                              ) : cronograma.is_active ? (
                                <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Inativo</Badge>
                              )}
                            </div>
                            <CardDescription>
                              {cronograma.schools?.name}
                              {cronograma.schools?.areas && (
                                <span className="text-xs ml-1">
                                  ({cronograma.schools.areas.name})
                                </span>
                              )}
                            </CardDescription>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!(cronograma as any).is_frozen && (
                                <DropdownMenuItem onClick={() => navigate(`/cronograma/${cronograma.id}/configurar${fromSuffix}`)}>
                                  <Settings className="w-4 h-4 mr-2" />
                                  Configurar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => handleDelete(cronograma.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Date Range */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>
                            Início: {format(new Date(cronograma.start_date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        {cronograma.end_date && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Target className="w-4 h-4" />
                            <span>
                              Término previsto: {format(new Date(cronograma.end_date), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                        )}

                        {/* Today's Progress */}
                        {tasks && tasks.total > 0 ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                Tarefas de hoje
                              </span>
                              <span className="font-medium">
                                {tasks.completed}/{tasks.total} concluídas
                              </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Nenhuma tarefa para hoje</span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                          <Button 
                            className="w-full"
                            onClick={() => navigate(`/cronograma/${cronograma.id}${fromSuffix}`)}
                          >
                            <PlayCircle className="w-4 h-4 mr-2" />
                            {(cronograma as any).is_frozen ? "Ver Histórico" : "Estudar"}
                          </Button>
                          <Button 
                            variant="outline"
                            className="w-full"
                            onClick={() => navigate(`/cronograma/${cronograma.id}/visao-geral${fromSuffix}`)}
                          >
                            <BookOpen className="w-4 h-4 mr-2" />
                            Acompanhe seu Progresso
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Calendar className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Nenhum cronograma criado</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Crie seu primeiro cronograma de estudos para organizar sua preparação de forma inteligente.
            </p>
            <Button size="lg" onClick={() => navigate(`/cronograma/criar${fromSuffix}`)}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Cronograma
            </Button>
          </motion.div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cronograma?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as tarefas associadas a este cronograma também serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </ConselhoThemeWrapper>
  );
}
