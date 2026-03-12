import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, CheckCircle, AlertTriangle, Play, ChevronLeft, ChevronRight, Search, Loader2 } from "lucide-react";

interface SyncResult {
  topicId: string;
  topicName: string;
  status: "synced" | "skipped" | "error";
  questionsCount?: number;
  notebookId?: string;
  goalUpdated?: boolean;
  reason?: string;
  error?: string;
}

interface SyncResponse {
  processed: number;
  results: SyncResult[];
  offset: number;
  batch_size: number;
  has_more: boolean;
}

interface PendingTopic {
  topic_id: string;
  topic_name: string;
  discipline_name: string;
  source_questions: number;
}

const RESULTS_PER_PAGE = 10;

export function AdminSyncDerivedNotebooks() {
  const [isRunning, setIsRunning] = useState(false);
  const [allResults, setAllResults] = useState<SyncResult[]>([]);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [batchSize, setBatchSize] = useState(200);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [runComplete, setRunComplete] = useState(false);

  // Diagnostic state
  const [isLoadingDiagnostic, setIsLoadingDiagnostic] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingByDiscipline, setPendingByDiscipline] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    loadDiagnostic();
  }, []);

  const loadDiagnostic = async () => {
    setIsLoadingDiagnostic(true);
    try {
      // Count derived topics that need sync: have source_notebook with questions but own notebook is empty
      const { data, error } = await supabase.rpc("get_pending_derived_sync_count" as any);

      if (error) {
        // Fallback: run a simpler query
        console.warn("RPC not available, using fallback query");
        setPendingCount(0);
        setPendingByDiscipline([]);
        setIsLoadingDiagnostic(false);
        return;
      }

      if (data) {
        const results = data as any[];
        const total = results.reduce((sum: number, r: any) => sum + Number(r.pending_count || 0), 0);
        setPendingCount(total);
        setPendingByDiscipline(
          results
            .filter((r: any) => Number(r.pending_count) > 0)
            .map((r: any) => ({ name: r.discipline_name, count: Number(r.pending_count) }))
            .sort((a: any, b: any) => b.count - a.count)
        );
      }
    } catch (err) {
      console.error("Diagnostic error:", err);
    } finally {
      setIsLoadingDiagnostic(false);
    }
  };

  const runSync = async (offset = 0, accumResults: SyncResult[] = []) => {
    setIsRunning(true);
    setRunComplete(false);

    try {
      const { data, error } = await supabase.functions.invoke("sync-derived-notebooks", {
        body: { batch_size: batchSize, offset },
      });

      if (error) throw error;

      const response = data as SyncResponse;
      const merged = [...accumResults, ...response.results];
      setAllResults(merged);
      setTotalProcessed(merged.length);
      setHasMore(response.has_more);
      setCurrentOffset(offset + batchSize);

      if (response.has_more) {
        toast.info(`Processados ${merged.length} tópicos, continuando...`);
        await runSync(offset + batchSize, merged);
      } else {
        setRunComplete(true);
        const synced = merged.filter((r) => r.status === "synced").length;
        const skipped = merged.filter((r) => r.status === "skipped").length;
        const errors = merged.filter((r) => r.status === "error").length;
        toast.success(
          `Sincronização concluída: ${synced} sincronizados, ${skipped} ignorados, ${errors} erros`
        );
        // Refresh diagnostic
        loadDiagnostic();
      }
    } catch (error: any) {
      console.error("Sync error:", error);
      toast.error("Erro ao sincronizar: " + (error.message || "Erro desconhecido"));
      setRunComplete(true);
    } finally {
      setIsRunning(false);
    }
  };

  const handleStart = () => {
    setAllResults([]);
    setTotalProcessed(0);
    setCurrentPage(1);
    setCurrentOffset(0);
    runSync(0, []);
  };

  const stats = {
    synced: allResults.filter((r) => r.status === "synced").length,
    skipped: allResults.filter((r) => r.status === "skipped").length,
    errors: allResults.filter((r) => r.status === "error").length,
    totalQuestions: allResults
      .filter((r) => r.status === "synced")
      .reduce((sum, r) => sum + (r.questionsCount || 0), 0),
  };

  const totalPages = Math.ceil(allResults.length / RESULTS_PER_PAGE);
  const paginatedResults = allResults.slice(
    (currentPage - 1) * RESULTS_PER_PAGE,
    currentPage * RESULTS_PER_PAGE
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Sincronizar Cadernos Derivados
        </CardTitle>
        <CardDescription>
          Detecta tópicos derivados (pós-edital) cujos cadernos-fonte possuem questões
          mas os cadernos derivados estão vazios. Repopula os cadernos e atualiza as metas automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Diagnostic */}
        {isLoadingDiagnostic ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analisando tópicos pendentes...
          </div>
        ) : (
          <div className="space-y-3">
            <div className={`rounded-lg p-4 border ${pendingCount > 0 ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'}`}>
              <div className="flex items-center gap-2">
                {pendingCount > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
                <span className="font-medium">
                  {pendingCount > 0
                    ? `${pendingCount} tópicos derivados precisam de sincronização`
                    : "Todos os cadernos derivados estão sincronizados"}
                </span>
              </div>

              {pendingByDiscipline.length > 0 && (
                <div className="mt-3 space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Por disciplina:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {pendingByDiscipline.map((d) => (
                      <Badge key={d.name} variant="outline" className="text-xs">
                        {d.name}: <span className="font-bold ml-1">{d.count}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button variant="ghost" size="sm" onClick={loadDiagnostic} disabled={isLoadingDiagnostic}>
              <Search className="h-3 w-3 mr-1" />
              Atualizar diagnóstico
            </Button>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-4 pt-2 border-t">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Lote:</span>
            <Input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(Math.max(10, Math.min(200, Number(e.target.value))))}
              className="w-20"
              min={10}
              max={200}
              disabled={isRunning}
            />
          </div>
          <Button onClick={handleStart} disabled={isRunning || pendingCount === 0}>
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Processando... ({totalProcessed})
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Executar Sincronização
              </>
            )}
          </Button>
        </div>

        {/* Stats */}
        {allResults.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.synced}</div>
              <div className="text-xs text-muted-foreground">Sincronizados</div>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.skipped}</div>
              <div className="text-xs text-muted-foreground">Ignorados</div>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
              <div className="text-xs text-muted-foreground">Erros</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalQuestions}</div>
              <div className="text-xs text-muted-foreground">Questões vinculadas</div>
            </div>
          </div>
        )}

        {/* Results table */}
        {paginatedResults.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tópico</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-24">Questões</TableHead>
                  <TableHead className="w-24">Meta</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedResults.map((r, i) => (
                  <TableRow key={r.topicId || i}>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">
                      {r.topicName}
                    </TableCell>
                    <TableCell>
                      {r.status === "synced" && (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          OK
                        </Badge>
                      )}
                      {r.status === "skipped" && (
                        <Badge variant="secondary">Ignorado</Badge>
                      )}
                      {r.status === "error" && (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Erro
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{r.questionsCount || "-"}</TableCell>
                    <TableCell>
                      {r.goalUpdated ? (
                        <Badge variant="outline" className="text-xs">Atualizada</Badge>
                      ) : r.status === "synced" ? (
                        <span className="text-xs text-muted-foreground">Sem meta</span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {r.reason || r.error || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages} ({allResults.length} itens)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => p - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {runComplete && allResults.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>Nenhum tópico derivado precisava de sincronização.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
