import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  RefreshCw, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Filter,
  TrendingUp,
  Users
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuthErrorLog {
  id: string;
  email: string | null;
  error_code: string | null;
  error_message: string;
  error_type: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  resolved_at: string | null;
  admin_notes: string | null;
}

interface ErrorStats {
  total: number;
  last24h: number;
  last7d: number;
  byType: Record<string, number>;
  topEmails: { email: string; count: number }[];
}

export default function AdminAuthErrorLogs() {
  const [logs, setLogs] = useState<AuthErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuthErrorLog | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [stats, setStats] = useState<ErrorStats | null>(null);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("auth_error_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs((data as AuthErrorLog[]) || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast.error("Erro ao carregar logs de erro");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const now = new Date();
      const last24h = subDays(now, 1);
      const last7d = subDays(now, 7);

      // Total count
      const { count: total } = await supabase
        .from("auth_error_logs")
        .select("*", { count: "exact", head: true });

      // Last 24h count
      const { count: count24h } = await supabase
        .from("auth_error_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", last24h.toISOString());

      // Last 7 days count
      const { count: count7d } = await supabase
        .from("auth_error_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", last7d.toISOString());

      // Get all logs for aggregation
      const { data: allLogs } = await supabase
        .from("auth_error_logs")
        .select("error_type, email")
        .gte("created_at", last7d.toISOString());

      // Aggregate by type
      const byType: Record<string, number> = {};
      const emailCounts: Record<string, number> = {};
      
      (allLogs || []).forEach((log: { error_type: string; email: string | null }) => {
        byType[log.error_type] = (byType[log.error_type] || 0) + 1;
        if (log.email) {
          emailCounts[log.email] = (emailCounts[log.email] || 0) + 1;
        }
      });

      // Top emails with most errors
      const topEmails = Object.entries(emailCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([email, count]) => ({ email, count }));

      setStats({
        total: total || 0,
        last24h: count24h || 0,
        last7d: count7d || 0,
        byType,
        topEmails,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleResolve = async (log: AuthErrorLog) => {
    try {
      const { error } = await supabase
        .from("auth_error_logs")
        .update({
          resolved_at: new Date().toISOString(),
          admin_notes: adminNotes || null,
        })
        .eq("id", log.id);

      if (error) throw error;

      toast.success("Erro marcado como resolvido");
      setSelectedLog(null);
      setAdminNotes("");
      fetchLogs();
      fetchStats();
    } catch (error) {
      console.error("Error resolving log:", error);
      toast.error("Erro ao atualizar log");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este log?")) return;

    try {
      const { error } = await supabase
        .from("auth_error_logs")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Log excluído");
      fetchLogs();
      fetchStats();
    } catch (error) {
      console.error("Error deleting log:", error);
      toast.error("Erro ao excluir log");
    }
  };

  const getErrorTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      refresh_token: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      login_failed: "bg-red-500/20 text-red-400 border-red-500/30",
      signup_failed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      session_error: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      unknown: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    };

    return (
      <Badge variant="outline" className={colors[type] || colors.unknown}>
        {type}
      </Badge>
    );
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchTerm ||
      log.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.error_message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.error_code?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === "all" || log.error_type === filterType;

    return matchesSearch && matchesType;
  });

  const errorTypes = [...new Set(logs.map((l) => l.error_type))];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Total de Erros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Últimas 24h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">
              {stats?.last24h || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Últimos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {stats?.last7d || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuários Afetados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.topEmails.length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Emails with Errors */}
      {stats?.topEmails && stats.topEmails.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Emails com Mais Erros (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.topEmails.map((item) => (
                <Badge
                  key={item.email}
                  variant="outline"
                  className="bg-red-500/10 text-red-400 border-red-500/30"
                >
                  {item.email} ({item.count})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Types Distribution */}
      {stats?.byType && Object.keys(stats.byType).length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Distribuição por Tipo (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byType).map(([type, count]) => (
                <div key={type} className="flex items-center gap-2">
                  {getErrorTypeBadge(type)}
                  <span className="text-sm text-muted-foreground">
                    {count} erros
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por email, mensagem ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-background border border-input rounded-md px-3 py-2 text-sm"
          >
            <option value="all">Todos os tipos</option>
            {errorTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <Button onClick={fetchLogs} variant="outline" size="icon">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Logs Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  Nenhum log de erro encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {log.email || "-"}
                  </TableCell>
                  <TableCell>{getErrorTypeBadge(log.error_type)}</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">
                    {log.error_code || "-"}
                  </TableCell>
                  <TableCell className="text-sm max-w-xs truncate">
                    {log.error_message}
                  </TableCell>
                  <TableCell>
                    {log.resolved_at ? (
                      <Badge
                        variant="outline"
                        className="bg-green-500/20 text-green-400 border-green-500/30"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Resolvido
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        Pendente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedLog(log);
                          setAdminNotes(log.admin_notes || "");
                        }}
                      >
                        Detalhes
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(log.id)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Erro de Autenticação</DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-mono">{selectedLog.email || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data/Hora</Label>
                  <p>
                    {format(
                      new Date(selectedLog.created_at),
                      "dd/MM/yyyy HH:mm:ss",
                      { locale: ptBR }
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tipo</Label>
                  <div className="mt-1">
                    {getErrorTypeBadge(selectedLog.error_type)}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Código</Label>
                  <p className="font-mono">
                    {selectedLog.error_code || "-"}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Mensagem de Erro</Label>
                <p className="mt-1 p-2 bg-muted rounded text-sm font-mono break-all">
                  {selectedLog.error_message}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">User Agent</Label>
                  <p className="text-sm break-all">
                    {selectedLog.user_agent || "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">IP</Label>
                  <p className="font-mono">{selectedLog.ip_address || "-"}</p>
                </div>
              </div>

              {selectedLog.resolved_at && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-sm text-green-400">
                    Resolvido em:{" "}
                    {format(
                      new Date(selectedLog.resolved_at),
                      "dd/MM/yyyy HH:mm",
                      { locale: ptBR }
                    )}
                  </p>
                </div>
              )}

              <div>
                <Label>Notas do Admin</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Adicione notas sobre este erro..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedLog(null)}
                >
                  Fechar
                </Button>
                {!selectedLog.resolved_at && (
                  <Button
                    onClick={() => handleResolve(selectedLog)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marcar como Resolvido
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}