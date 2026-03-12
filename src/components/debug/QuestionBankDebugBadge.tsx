import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Copy, Terminal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type DebugLogEntry = {
  timestamp: number;
  event: string;
  payload?: unknown;
};

type Props = {
  enabled: boolean;
  route: string;
  filtersSummary: string;
  page: number;
  lastChangeAt: number | null;
  resetCount: number;
  logs: DebugLogEntry[];
};

export function QuestionBankDebugBadge({
  enabled,
  route,
  filtersSummary,
  page,
  lastChangeAt,
  resetCount,
  logs,
}: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const ts = lastChangeAt
    ? new Date(lastChangeAt).toLocaleString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  const handleCopyLogs = useCallback(() => {
    const text = logs
      .map((l) => {
        const time = new Date(l.timestamp).toISOString();
        return `[${time}] ${l.event}: ${JSON.stringify(l.payload, null, 2)}`;
      })
      .join("\n\n");

    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Logs copiados!", description: `${logs.length} entradas` });
    });
  }, [logs, toast]);

  if (!enabled) return null;

  return (
    <div className="mt-3 w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge variant="secondary">DEBUG</Badge>
        <span>
          <span className="font-medium text-foreground">rota:</span> {route}
        </span>
        <span>
          <span className="font-medium text-foreground">página:</span> {page}
        </span>
        <span>
          <span className="font-medium text-foreground">última mudança:</span> {ts}
        </span>
        <span>
          <span className="font-medium text-foreground">resetCount:</span> {resetCount}
        </span>
        <span className="truncate">
          <span className="font-medium text-foreground">filtros:</span> {filtersSummary}
        </span>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto h-6 gap-1 text-xs">
              <Terminal className="h-3 w-3" />
              Console ({logs.length})
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Debug Logs
                <Button variant="ghost" size="sm" className="ml-auto gap-1" onClick={handleCopyLogs}>
                  <Copy className="h-3 w-3" />
                  Copiar todos
                </Button>
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[60vh] rounded border bg-muted/30 p-3">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum log ainda.</p>
              ) : (
                <div className="space-y-3 font-mono text-xs">
                  {logs.map((entry, i) => {
                    const d = new Date(entry.timestamp);
                    const time = `${d.toLocaleTimeString("pt-BR")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
                    const isReset = entry.event.includes("RESET");
                    return (
                      <div
                        key={i}
                        className={`rounded border p-2 ${isReset ? "border-destructive bg-destructive/10" : "border-border"}`}
                      >
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>{time}</span>
                          <Badge variant={isReset ? "destructive" : "secondary"} className="text-[10px]">
                            {entry.event}
                          </Badge>
                        </div>
                        {entry.payload && (
                          <pre className="mt-1 whitespace-pre-wrap break-all text-foreground">
                            {JSON.stringify(entry.payload, null, 2)}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
