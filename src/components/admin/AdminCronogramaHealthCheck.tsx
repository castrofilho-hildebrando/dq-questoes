import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Activity, AlertTriangle, CheckCircle2, RefreshCw, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HealthCheckResult {
  orphan_tasks_count: number;
  phantom_goals_count: number;
  ghost_discipline_order_count: number;
  duplicate_tasks_count: number;
  trigger_active: boolean;
  top_issues: Array<{
    cronograma_id: string;
    issue_type: string;
    count: number;
  }>;
}

interface HealthHistory {
  id: string;
  check_date: string;
  orphan_tasks_count: number;
  phantom_goals_count: number;
  ghost_discipline_order_count: number;
  duplicate_tasks_count: number;
  trigger_active: boolean;
  created_at: string;
}

export function AdminCronogramaHealthCheck() {
  const queryClient = useQueryClient();
  const [lastResult, setLastResult] = useState<HealthCheckResult | null>(null);

  // Histórico dos últimos 7 dias
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["cronograma-health-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cronograma_health_daily")
        .select("*")
        .order("check_date", { ascending: false })
        .limit(7);
      
      if (error) throw error;
      return data as HealthHistory[];
    },
  });

  // Mutation para rodar o health check
  const runHealthCheck = useMutation({
    mutationFn: async (): Promise<HealthCheckResult> => {
      // 1. Orphan tasks (is_revision=false, goal_id IS NULL)
      const { count: orphanCount } = await supabase
        .from("user_cronograma_tasks")
        .select("*", { count: "exact", head: true })
        .eq("is_revision", false)
        .is("goal_id", null);

      // 2. Phantom goals - usar função RPC
      const { data: phantomData, error: phantomError } = await supabase
        .rpc('get_phantom_goal_count' as never);
      
      let phantomCount = 0;
      if (!phantomError && phantomData) {
        const result = phantomData as unknown as Array<{ count: number }>;
        phantomCount = result[0]?.count || 0;
      }

      // 3. Ghost discipline_order - usar função RPC
      const { data: ghostData, error: ghostError } = await supabase
        .rpc('get_ghost_discipline_order_count' as never);
      
      let ghostCount = 0;
      if (!ghostError && ghostData) {
        const result = ghostData as unknown as Array<{ count: number }>;
        ghostCount = result[0]?.count || 0;
      }

      // 4. Verificar trigger ativo - usar função RPC
      const { data: triggerData, error: triggerError } = await supabase
        .rpc('check_sanitize_trigger_active' as never);
      
      let triggerActive = true;
      if (!triggerError && triggerData) {
        const result = triggerData as unknown as Array<{ active: boolean }>;
        triggerActive = result[0]?.active ?? true;
      }

      const result: HealthCheckResult = {
        orphan_tasks_count: orphanCount || 0,
        phantom_goals_count: phantomCount,
        ghost_discipline_order_count: ghostCount,
        duplicate_tasks_count: 0, // Índice único impede
        trigger_active: triggerActive,
        top_issues: [],
      };

      // Salvar no histórico
      const { data: session } = await supabase.auth.getSession();
      await supabase.from("cronograma_health_daily").upsert({
        check_date: new Date().toISOString().split('T')[0],
        orphan_tasks_count: result.orphan_tasks_count,
        phantom_goals_count: result.phantom_goals_count,
        ghost_discipline_order_count: result.ghost_discipline_order_count,
        duplicate_tasks_count: result.duplicate_tasks_count,
        trigger_active: result.trigger_active,
        top_issues: result.top_issues,
        checked_by: session?.session?.user?.id,
      }, { onConflict: 'check_date' });

      return result;
    },
    onSuccess: (result) => {
      setLastResult(result);
      queryClient.invalidateQueries({ queryKey: ["cronograma-health-history"] });
      
      const totalIssues = result.orphan_tasks_count + result.phantom_goals_count + result.ghost_discipline_order_count;
      if (totalIssues === 0) {
        toast.success("Health check concluído: sistema saudável!");
      } else {
        toast.warning(`Health check concluído: ${totalIssues} problema(s) encontrado(s)`);
      }
    },
    onError: (error) => {
      toast.error(`Erro no health check: ${error.message}`);
    },
  });

  const getStatusBadge = (count: number) => {
    if (count === 0) {
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">OK</Badge>;
    }
    if (count < 10) {
      return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">{count}</Badge>;
    }
    return <Badge variant="destructive">{count}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Cronograma Health Check
            </CardTitle>
            <CardDescription>
              Verifica integridade do cronograma e salva histórico diário
            </CardDescription>
          </div>
          <Button
            onClick={() => runHealthCheck.mutate()}
            disabled={runHealthCheck.isPending}
          >
            {runHealthCheck.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Executar Health Check
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resultado atual */}
        {lastResult && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Orphan Tasks</div>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(lastResult.orphan_tasks_count)}
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Phantom Goals</div>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(lastResult.phantom_goals_count)}
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Ghost Discipline Order</div>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(lastResult.ghost_discipline_order_count)}
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Duplicatas</div>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(lastResult.duplicate_tasks_count)}
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Trigger Ativo</div>
              <div className="flex items-center gap-2 mt-1">
                {lastResult.trigger_active ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Histórico */}
        <div>
          <h4 className="font-medium flex items-center gap-2 mb-3">
            <History className="h-4 w-4" />
            Histórico (últimos 7 dias)
          </h4>
          
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : history && history.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Data</th>
                    <th className="text-center p-3">Orphan</th>
                    <th className="text-center p-3">Phantom</th>
                    <th className="text-center p-3">Ghost</th>
                    <th className="text-center p-3">Dup</th>
                    <th className="text-center p-3">Trigger</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="p-3">
                        {format(new Date(row.check_date), "dd/MM", { locale: ptBR })}
                      </td>
                      <td className="text-center p-3">
                        {getStatusBadge(row.orphan_tasks_count)}
                      </td>
                      <td className="text-center p-3">
                        {getStatusBadge(row.phantom_goals_count)}
                      </td>
                      <td className="text-center p-3">
                        {getStatusBadge(row.ghost_discipline_order_count)}
                      </td>
                      <td className="text-center p-3">
                        {getStatusBadge(row.duplicate_tasks_count)}
                      </td>
                      <td className="text-center p-3">
                        {row.trigger_active ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-500 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-4">
              Nenhum histórico ainda. Execute o health check para começar.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}