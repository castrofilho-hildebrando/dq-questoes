import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Play, 
  Square, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  ArrowUp,
  ArrowDown,
  ListOrdered,
  Search,
  Download,
  Save,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

interface Area {
  id: string;
  name: string;
}

interface QueueItem {
  areaId: string;
  areaName: string;
  order: number;
}

interface LogEntry {
  timestamp: Date;
  type: "info" | "success" | "error" | "warning";
  message: string;
  area?: string;
}

interface QueueResult {
  areaName: string;
  searchTerm: string;
  provasFound: number;
  provasSaved: number;
  error?: string;
}

export function AdminProvasQueue() {
  const queryClient = useQueryClient();
  
  // Queue state
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<QueueResult[]>([]);
  
  // Cancel flag
  const cancelRef = useRef(false);
  
  // Fetch areas
  const { data: areas } = useQuery({
    queryKey: ["areas-for-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("areas")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as Area[];
    },
  });

  // Add log entry
  const addLog = useCallback((type: LogEntry["type"], message: string, area?: string) => {
    setLogs(prev => [...prev, { timestamp: new Date(), type, message, area }]);
  }, []);

  // Toggle area in queue
  const toggleAreaInQueue = (area: Area) => {
    setQueue(prev => {
      const existing = prev.find(q => q.areaId === area.id);
      if (existing) {
        // Remove from queue
        return prev.filter(q => q.areaId !== area.id).map((q, i) => ({ ...q, order: i + 1 }));
      } else {
        // Add to queue
        return [...prev, { areaId: area.id, areaName: area.name, order: prev.length + 1 }];
      }
    });
  };

  // Move area up in queue
  const moveUp = (index: number) => {
    if (index === 0) return;
    setQueue(prev => {
      const newQueue = [...prev];
      [newQueue[index - 1], newQueue[index]] = [newQueue[index], newQueue[index - 1]];
      return newQueue.map((q, i) => ({ ...q, order: i + 1 }));
    });
  };

  // Move area down in queue
  const moveDown = (index: number) => {
    if (index === queue.length - 1) return;
    setQueue(prev => {
      const newQueue = [...prev];
      [newQueue[index], newQueue[index + 1]] = [newQueue[index + 1], newQueue[index]];
      return newQueue.map((q, i) => ({ ...q, order: i + 1 }));
    });
  };

  // Clear queue
  const clearQueue = () => {
    setQueue([]);
    setLogs([]);
    setResults([]);
  };

  // Cancel processing
  const cancelProcessing = () => {
    cancelRef.current = true;
    addLog("warning", "Cancelando processamento...");
  };

  // Search provas for a term
  const searchProvas = async (searchTerm: string): Promise<any[]> => {
    const { data, error } = await supabase.functions.invoke("scrape-provas", {
      body: { searchTerm },
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error);

    return data.data || [];
  };

  // Load PDF links for a prova
  const loadPdfLinks = async (url: string): Promise<{ titulo: string; url: string }[]> => {
    const { data, error } = await supabase.functions.invoke("scrape-prova-details", {
      body: { url },
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error);

    return data.data || [];
  };

  // Save provas to database
  const saveProvas = async (provas: any[]): Promise<{ saved: number; groups: number }> => {
    const { data, error } = await supabase.functions.invoke("save-provas", {
      body: { provas },
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error);

    return { saved: data.saved, groups: data.groups };
  };

  // Process a single area with a search term
  const processSearchTerm = async (
    areaId: string, 
    areaName: string, 
    searchTerm: string
  ): Promise<QueueResult> => {
    const result: QueueResult = {
      areaName,
      searchTerm,
      provasFound: 0,
      provasSaved: 0,
    };

    try {
      // Step 1: Search
      addLog("info", `Pesquisando: "${searchTerm}"`, areaName);
      setCurrentStep(`Pesquisando: "${searchTerm}"`);
      
      const provas = await searchProvas(searchTerm);
      result.provasFound = provas.length;
      
      if (provas.length === 0) {
        addLog("warning", `Nenhuma prova encontrada para "${searchTerm}"`, areaName);
        return result;
      }
      
      addLog("success", `${provas.length} provas encontradas`, areaName);

      // Step 2: Load PDF links for each prova
      const provasToSave: any[] = [];
      
      for (let i = 0; i < provas.length; i++) {
        if (cancelRef.current) throw new Error("Cancelado pelo usuário");
        
        const prova = provas[i];
        setCurrentStep(`Carregando PDFs: ${i + 1}/${provas.length}`);
        addLog("info", `Carregando PDFs: ${prova.titulo.substring(0, 40)}...`, areaName);
        
        try {
          const pdfLinks = await loadPdfLinks(prova.url);
          
          if (pdfLinks.length > 0) {
            pdfLinks.forEach(pdf => {
              provasToSave.push({
                nome_prova: `${prova.titulo} - ${pdf.titulo}`,
                ano: prova.ano,
                banca: prova.instituicao,
                orgao: prova.orgao,
                url_pdf: pdf.url,
                url_origem: prova.url,
                area_id: areaId,
              });
            });
          }
        } catch (err) {
          // Continue with next prova if one fails
          addLog("warning", `Falha ao carregar PDFs: ${prova.titulo.substring(0, 30)}...`, areaName);
        }
      }

      if (provasToSave.length === 0) {
        addLog("warning", `Nenhum PDF encontrado para salvar`, areaName);
        return result;
      }

      // Step 3: Save
      setCurrentStep(`Salvando ${provasToSave.length} provas...`);
      addLog("info", `Salvando ${provasToSave.length} provas...`, areaName);
      
      const saveResult = await saveProvas(provasToSave);
      result.provasSaved = saveResult.saved;
      
      addLog("success", `${saveResult.saved} provas salvas em ${saveResult.groups} grupos`, areaName);

    } catch (err) {
      result.error = err instanceof Error ? err.message : "Erro desconhecido";
      addLog("error", result.error, areaName);
    }

    return result;
  };

  // Process the entire queue
  const processQueue = async () => {
    if (queue.length === 0) {
      toast.error("Selecione pelo menos uma área");
      return;
    }

    setIsProcessing(true);
    cancelRef.current = false;
    setLogs([]);
    setResults([]);
    setCurrentIndex(0);

    addLog("info", `Iniciando processamento de ${queue.length} áreas`);

    const allResults: QueueResult[] = [];

    for (let i = 0; i < queue.length; i++) {
      if (cancelRef.current) {
        addLog("warning", "Processamento cancelado pelo usuário");
        break;
      }

      const item = queue[i];
      setCurrentIndex(i);
      addLog("info", `\n=== Processando área ${i + 1}/${queue.length}: ${item.areaName} ===`);

      // Search term 1: "Professor EBTT {Area}"
      const searchTerm1 = `Professor EBTT ${item.areaName}`;
      const result1 = await processSearchTerm(item.areaId, item.areaName, searchTerm1);
      allResults.push(result1);

      if (cancelRef.current) break;

      // Small delay between searches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Search term 2: "Professor IF {Area}"
      const searchTerm2 = `Professor IF ${item.areaName}`;
      const result2 = await processSearchTerm(item.areaId, item.areaName, searchTerm2);
      allResults.push(result2);

      setResults([...allResults]);
    }

    // Summary
    const totalSaved = allResults.reduce((sum, r) => sum + r.provasSaved, 0);
    const totalFound = allResults.reduce((sum, r) => sum + r.provasFound, 0);
    const errors = allResults.filter(r => r.error).length;

    addLog("info", `\n=== RESUMO FINAL ===`);
    addLog("success", `Total encontradas: ${totalFound} | Total salvas: ${totalSaved}`);
    if (errors > 0) {
      addLog("warning", `${errors} buscas com erro`);
    }

    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: ["saved-provas-if"] });
    
    if (cancelRef.current) {
      toast.warning("Processamento cancelado");
    } else {
      toast.success(`Fila concluída! ${totalSaved} provas salvas`);
    }
  };

  // Calculate progress
  const progress = queue.length > 0 
    ? ((currentIndex + 1) / queue.length) * 100 
    : 0;

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />;
      case "error": return <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />;
      case "warning": return <AlertCircle className="w-3 h-3 text-yellow-500 flex-shrink-0" />;
      default: return <div className="w-3 h-3 rounded-full bg-muted-foreground/30 flex-shrink-0" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Queue Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="w-5 h-5" />
            Fila de Download Automático
          </CardTitle>
          <CardDescription>
            Selecione as áreas na ordem desejada. Para cada área, o sistema buscará automaticamente 
            "Professor EBTT [Área]" e "Professor IF [Área]", salvando os resultados diretamente no banco.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={processQueue} 
              disabled={isProcessing || queue.length === 0}
              className="gap-2"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isProcessing ? "Processando..." : "Iniciar Fila"}
            </Button>
            
            {isProcessing && (
              <Button variant="destructive" onClick={cancelProcessing} className="gap-2">
                <Square className="w-4 h-4" />
                Cancelar
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={clearQueue} 
              disabled={isProcessing}
              className="gap-2"
            >
              Limpar Fila
            </Button>
          </div>

          {/* Progress bar (when processing) */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{currentStep}</span>
                <span className="font-medium">{currentIndex + 1} / {queue.length} áreas</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Areas grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {areas?.map(area => {
              const queueItem = queue.find(q => q.areaId === area.id);
              const isSelected = !!queueItem;
              const queueIndex = queueItem ? queue.indexOf(queueItem) : -1;
              
              return (
                <div 
                  key={area.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${isSelected 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-muted-foreground/50"
                    }
                    ${isProcessing ? "opacity-60 cursor-not-allowed" : ""}
                  `}
                  onClick={() => !isProcessing && toggleAreaInQueue(area)}
                >
                  <Checkbox 
                    checked={isSelected} 
                    disabled={isProcessing}
                    className="pointer-events-none"
                  />
                  
                  {isSelected && (
                    <Badge variant="default" className="w-6 h-6 p-0 flex items-center justify-center">
                      {queueItem.order}
                    </Badge>
                  )}
                  
                  <span className={`text-sm flex-1 ${isSelected ? "font-medium" : ""}`}>
                    {area.name}
                  </span>
                  
                  {isSelected && !isProcessing && (
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); moveUp(queueIndex); }}
                        disabled={queueIndex === 0}
                      >
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); moveDown(queueIndex); }}
                        disabled={queueIndex === queue.length - 1}
                      >
                        <ArrowDown className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected queue summary */}
          {queue.length > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <ListOrdered className="w-4 h-4" />
                <span className="font-medium">Ordem da fila:</span>
                <span className="text-muted-foreground">
                  {queue.map(q => q.areaName).join(" → ")}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {queue.length} áreas × 2 buscas = {queue.length * 2} buscas no total
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Log */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="w-4 h-4" />
              Log de Processamento
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[300px] w-full rounded-md border p-4">
              <div className="space-y-1 font-mono text-xs">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {getLogIcon(log.type)}
                    <span className="text-muted-foreground">
                      [{log.timestamp.toLocaleTimeString()}]
                    </span>
                    {log.area && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {log.area}
                      </Badge>
                    )}
                    <span className={
                      log.type === "error" ? "text-red-500" :
                      log.type === "success" ? "text-green-500" :
                      log.type === "warning" ? "text-yellow-500" :
                      ""
                    }>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Results Summary */}
      {results.length > 0 && !isProcessing && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Resumo dos Resultados
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {results.map((result, i) => (
                <div 
                  key={i}
                  className={`
                    p-3 rounded-lg border text-sm
                    ${result.error ? "border-red-200 bg-red-50 dark:bg-red-950/20" : "border-green-200 bg-green-50 dark:bg-green-950/20"}
                  `}
                >
                  <div className="font-medium truncate">{result.searchTerm}</div>
                  <div className="text-muted-foreground text-xs mt-1">
                    {result.error ? (
                      <span className="text-red-500">{result.error}</span>
                    ) : (
                      <>
                        <Search className="w-3 h-3 inline mr-1" />
                        {result.provasFound} encontradas
                        <span className="mx-2">•</span>
                        <Save className="w-3 h-3 inline mr-1" />
                        {result.provasSaved} salvas
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
