import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCronogramaTaskGenerator } from "@/hooks/useCronogramaTaskGenerator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Play, Loader2, Plus, Filter, FilterX, School } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface CronogramaRecord {
  id: string;
  user_id: string;
  school_id: string;
  start_date: string;
  end_date: string | null;
  available_days: string[];
  hours_per_day: number;
  hours_per_weekday: Record<string, number> | null;
  selected_disciplines: string[];
  discipline_order: string[] | null;
  selected_topics: Record<string, string[]> | null;
  topic_order: Record<string, string[]> | null;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface RecalculateResult {
  cronogramaId: string;
  userName: string;
  success: boolean;
  tasksCreated: number;
  error?: string;
}

export function AdminBatchRecalculate() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RecalculateResult[]>([]);
  const [currentCronograma, setCurrentCronograma] = useState<string | null>(null);
  const [mode, setMode] = useState<"full" | "incremental">("incremental");
  const [filterNeedsRecalc, setFilterNeedsRecalc] = useState(true);
  const [selectedEditalId, setSelectedEditalId] = useState<string>("__all__");
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("__all__");
  
  const { recalculateTasks, recalculateTasksIncremental } = useCronogramaTaskGenerator();
  const queryClient = useQueryClient();

  // Fetch editals for filter
  const { data: editals } = useQuery({
    queryKey: ["admin-editals-for-recalc"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("editals")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch schools for filter
  const { data: schools } = useQuery({
    queryKey: ["admin-schools-for-recalc"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, edital_id, editals:edital_id(name)")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Schools filtered by selected edital
  const filteredSchools = useMemo(() => {
    if (!schools) return [];
    if (selectedEditalId === "__all__") return schools;
    return schools.filter(s => s.edital_id === selectedEditalId);
  }, [schools, selectedEditalId]);

  // Fetch all active cronogramas
  const { data: allCronogramas, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ["admin-all-cronogramas", filterNeedsRecalc],
    queryFn: async (): Promise<CronogramaRecord[]> => {
      let query = supabase
        .from("user_cronogramas")
        .select(`
          id,
          user_id,
          school_id,
          start_date,
          end_date,
          available_days,
          hours_per_day,
          hours_per_weekday,
          selected_disciplines,
          discipline_order,
          selected_topics,
          topic_order,
          needs_recalc
        `)
        .eq("is_active", true);
      
      if (filterNeedsRecalc) {
        query = query.eq("needs_recalc", true);
      }
      
      const { data: cronogramasData, error: cronogramasError } = await query
        .order("created_at", { ascending: false });

      if (cronogramasError) throw cronogramasError;
      if (!cronogramasData || cronogramasData.length === 0) return [];

      const userIds = [...new Set(cronogramasData.map(c => c.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);

      const profilesMap = new Map<string, { full_name: string | null; email: string }>();
      profilesData?.forEach(p => {
        profilesMap.set(p.user_id, { full_name: p.full_name, email: p.email });
      });

      return cronogramasData.map(c => ({
        ...c,
        profiles: profilesMap.get(c.user_id) || undefined,
      })) as CronogramaRecord[];
    },
  });

  // Apply edital + school filter client-side
  const cronogramas = useMemo(() => {
    if (!allCronogramas) return [];
    let filtered = allCronogramas;
    
    // Filter by edital (need school->edital mapping)
    if (selectedEditalId !== "__all__") {
      const schoolIdsInEdital = new Set(
        (schools || []).filter(s => s.edital_id === selectedEditalId).map(s => s.id)
      );
      filtered = filtered.filter(c => schoolIdsInEdital.has(c.school_id));
    }
    
    // Filter by school
    if (selectedSchoolId !== "__all__") {
      filtered = filtered.filter(c => c.school_id === selectedSchoolId);
    }
    
    return filtered;
  }, [allCronogramas, selectedEditalId, selectedSchoolId, schools]);

  const handleBatchRecalculate = async () => {
    if (!cronogramas || cronogramas.length === 0) {
      toast.error("Nenhum cronograma encontrado");
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setResults([]);

    const newResults: RecalculateResult[] = [];
    const recalculateFn = mode === "incremental" ? recalculateTasksIncremental : recalculateTasks;
    
    for (let i = 0; i < cronogramas.length; i++) {
      const cronograma = cronogramas[i];
      const userName = cronograma.profiles?.full_name || cronograma.profiles?.email || "Desconhecido";
      
      setCurrentCronograma(userName);
      
      try {
        const result = await recalculateFn({
          id: cronograma.id,
          user_id: cronograma.user_id,
          school_id: cronograma.school_id,
          start_date: cronograma.start_date,
          end_date: cronograma.end_date || undefined,
          selected_disciplines: cronograma.selected_disciplines || [],
          discipline_order: cronograma.discipline_order || cronograma.selected_disciplines || [],
          topic_order: (cronograma.topic_order || {}) as Record<string, string[]>,
          available_days: cronograma.available_days || ['seg', 'ter', 'qua', 'qui', 'sex'],
          hours_per_day: cronograma.hours_per_day || 2,
          hours_per_weekday: cronograma.hours_per_weekday || undefined,
          selected_topics: cronograma.selected_topics || undefined,
        });

        // Se o recálculo foi bem-sucedido, limpar a flag needs_recalc
        // (se essa etapa falhar, o cronograma continuará aparecendo como pendente)
        let clearFlagError: string | undefined;
        if (result.success) {
          const { error: clearError } = await supabase
            .from("user_cronogramas")
            .update({
              needs_recalc: false,
              recalc_reason: null,
              recalc_pending_since: null,
            })
            .eq("id", cronograma.id);

          if (clearError) {
            clearFlagError = clearError.message;
          }
        }

        newResults.push({
          cronogramaId: cronograma.id,
          userName,
          success: result.success && !clearFlagError,
          tasksCreated: result.tasksCreated,
          error: clearFlagError ? `Falha ao limpar needs_recalc: ${clearFlagError}` : result.error,
        });
      } catch (err: any) {
        newResults.push({
          cronogramaId: cronograma.id,
          userName,
          success: false,
          tasksCreated: 0,
          error: err?.message || "Erro desconhecido",
        });
      }

      setResults([...newResults]);
      setProgress(Math.round(((i + 1) / cronogramas.length) * 100));
      
      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunning(false);
    setCurrentCronograma(null);
    
    const successCount = newResults.filter(r => r.success).length;
    const failCount = newResults.filter(r => !r.success).length;
    const totalTasksCreated = newResults.reduce((sum, r) => sum + r.tasksCreated, 0);
    
    if (failCount === 0) {
      toast.success(`${successCount} cronogramas processados! ${totalTasksCreated} tarefas ${mode === "incremental" ? "adicionadas" : "geradas"}`);
    } else {
      toast.warning(`${successCount} cronogramas processados, ${failCount} com erros`);
    }
    
    // Invalidate/refetch: garantir que a lista da própria sub-aba atualize imediatamente
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["admin-all-cronogramas", filterNeedsRecalc],
        exact: true,
        refetchType: "active",
      }),
      queryClient.invalidateQueries({
        queryKey: ["admin-all-cronogramas"],
        exact: false,
        refetchType: "active",
      }),
      queryClient.invalidateQueries({ queryKey: ["admin-cronograma-tasks"], exact: false, refetchType: "active" }),
      queryClient.invalidateQueries({ queryKey: ["admin-cronograma-month-tasks"], exact: false, refetchType: "active" }),
    ]);

    await refetch();
  };

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const totalTasks = results.reduce((sum, r) => sum + r.tasksCreated, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Recalcular Cronogramas em Lote
        </CardTitle>
        <CardDescription>
          Recalcula cronogramas ativos preservando tarefas já concluídas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Selection */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as "full" | "incremental")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="incremental" className="gap-2">
              <Plus className="h-4 w-4" />
              Incremental
            </TabsTrigger>
            <TabsTrigger value="full" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Completo
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="incremental" className="mt-4">
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md text-sm">
              <p className="font-medium text-green-700 dark:text-green-400">Modo Incremental (Recomendado)</p>
              <p className="text-muted-foreground mt-1">
                Adiciona apenas as tarefas faltantes (questões corrigidas) sem deletar ou mover tarefas existentes.
                Preserva todas as datas agendadas do aluno.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="full" className="mt-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">Modo Completo</p>
              <p className="text-muted-foreground mt-1">
                Recalcula todo o cronograma do zero. Preserva tarefas concluídas, mas pode alterar datas de tarefas pendentes.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Filter Toggle */}
        <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
          <div className="flex items-center gap-2">
            {filterNeedsRecalc ? (
              <Filter className="h-4 w-4 text-primary" />
            ) : (
              <FilterX className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <Label htmlFor="filter-needs-recalc" className="text-sm font-medium">
                Apenas cronogramas com recálculo pendente
              </Label>
              <p className="text-xs text-muted-foreground">
                {filterNeedsRecalc 
                  ? "Apenas cronogramas marcados com 'needs_recalc = true'" 
                  : "Todos os cronogramas ativos serão processados"}
              </p>
            </div>
          </div>
          <Switch
            id="filter-needs-recalc"
            checked={filterNeedsRecalc}
            onCheckedChange={setFilterNeedsRecalc}
            disabled={isRunning}
          />
        </div>

        {/* Edital & School Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 border rounded-md bg-muted/30">
            <Label className="text-sm font-medium">Filtrar por Edital</Label>
            <Select 
              value={selectedEditalId} 
              onValueChange={(v) => { setSelectedEditalId(v); setSelectedSchoolId("__all__"); }} 
              disabled={isRunning}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Todos os editais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os editais</SelectItem>
                {editals?.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 border rounded-md bg-muted/30">
            <Label className="text-sm font-medium">Filtrar por Escola</Label>
            <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId} disabled={isRunning}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Todas as escolas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">
                  {selectedEditalId !== "__all__" ? "Todas do edital" : "Todas as escolas"}
                </SelectItem>
                {filteredSchools.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {isLoading ? (
            <span>Carregando cronogramas...</span>
          ) : (
            <span>
              <strong>{cronogramas?.length || 0}</strong> cronogramas 
              {filterNeedsRecalc ? " pendentes de recálculo" : " ativos"}
              {(selectedEditalId !== "__all__" || selectedSchoolId !== "__all__") && " (filtrado)"}
              {" "}encontrados
              {allCronogramas && (selectedEditalId !== "__all__" || selectedSchoolId !== "__all__") && (
                <span className="text-xs"> (de {allCronogramas.length} total)</span>
              )}
            </span>
          )}
        </div>

        {/* Action Button */}
        <Button 
          onClick={handleBatchRecalculate} 
          disabled={isRunning || isLoading || !cronogramas?.length}
          className="w-full"
          variant={mode === "incremental" ? "default" : "outline"}
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando... {progress}%
            </>
          ) : (
            <>
              {mode === "incremental" ? <Plus className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              {mode === "incremental" ? "Executar Recálculo Incremental" : "Recalcular Todos os Cronogramas"}
            </>
          )}
        </Button>

        {/* Progress */}
        {isRunning && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              Processando: <strong>{currentCronograma}</strong>
            </p>
          </div>
        )}

        {/* Results Summary */}
        {results.length > 0 && (
          <div className="flex items-center gap-4 pt-2">
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              {successCount} sucesso
            </Badge>
            {failCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                {failCount} erros
              </Badge>
            )}
            <Badge variant="secondary" className="gap-1">
              {totalTasks} tarefas {mode === "incremental" ? "adicionadas" : "geradas"}
            </Badge>
          </div>
        )}

        {/* Results List */}
        {results.length > 0 && (
          <ScrollArea className="h-64 border rounded-md">
            <div className="p-4 space-y-2">
              {results.map((result, idx) => (
                <div 
                  key={result.cronogramaId}
                  className={`flex items-center justify-between p-2 rounded-md text-sm ${
                    result.success ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-medium">{result.userName}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {result.success ? (
                      <span>{result.tasksCreated} tarefas</span>
                    ) : (
                      <span className="text-red-500 text-xs">{result.error}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Warning */}
        <div className="flex items-start gap-2 p-3 bg-muted/50 border rounded-md text-sm">
          <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-muted-foreground">
              O processo pode demorar alguns minutos dependendo da quantidade de cronogramas.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
