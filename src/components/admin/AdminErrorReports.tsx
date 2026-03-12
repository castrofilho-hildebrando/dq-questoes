import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle, CheckCircle, XCircle, Clock, Eye, Trash2, RefreshCw, ExternalLink, Pencil, CheckCheck, FileText, MessageSquare, Scale, Wand2, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AdminEnunciadoAnalysis } from "./AdminEnunciadoAnalysis";

interface ErrorReport {
  id: string;
  question_id: string;
  user_id: string;
  error_type: string;
  details: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  question?: {
    code: string;
    question: string;
    answer: string;
    option_a: string | null;
    option_b: string | null;
    option_c: string | null;
    option_d: string | null;
    option_e: string | null;
    associated_text: string | null;
  };
  profile?: {
    email: string;
    full_name: string | null;
  };
}

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-yellow-500', icon: Clock },
  reviewed: { label: 'Em Análise', color: 'bg-blue-500', icon: Eye },
  resolved: { label: 'Resolvido', color: 'bg-green-500', icon: CheckCircle },
  dismissed: { label: 'Descartado', color: 'bg-gray-500', icon: XCircle },
};

const errorTypeConfig = {
  enunciado: { label: 'Enunciado', icon: FileText, color: 'text-blue-600' },
  comentario: { label: 'Comentário', icon: MessageSquare, color: 'text-purple-600' },
  gabarito: { label: 'Gabarito', icon: Scale, color: 'text-orange-600' },
};

export function AdminErrorReports() {
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ErrorReport | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [bulkResolving, setBulkResolving] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [searchCode, setSearchCode] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('question_error_reports')
        .select(`
          *,
          question:questions(code, question, answer, option_a, option_b, option_c, option_d, option_e, associated_text)
        `)
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data: reportsData, error } = await query;
      
      if (error) throw error;
      
      const userIds = [...new Set((reportsData || []).map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', userIds);
      
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      
      const data = (reportsData || []).map(report => ({
        ...report,
        profile: profileMap.get(report.user_id) || null
      }));
      setReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error("Erro ao carregar relatórios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filterStatus]);

  // Filter reports by type
  const filteredReports = useMemo(() => {
    let result = reports;
    if (activeTab !== 'all') {
      result = result.filter(r => r.error_type === activeTab);
    }
    if (searchCode.trim()) {
      const term = searchCode.trim().toLowerCase();
      result = result.filter(r => r.question?.code?.toLowerCase().includes(term));
    }
    return result;
  }, [reports, activeTab, searchCode]);

  // Stats
  const stats = useMemo(() => ({
    total: reports.length,
    pending: reports.filter(r => r.status === 'pending').length,
    enunciado: reports.filter(r => r.error_type === 'enunciado' && r.status === 'pending').length,
    gabarito: reports.filter(r => r.error_type === 'gabarito' && r.status === 'pending').length,
    comentario: reports.filter(r => r.error_type === 'comentario' && r.status === 'pending').length,
  }), [reports]);

  const handleOpenReport = (report: ErrorReport) => {
    setSelectedReport(report);
    setAdminNotes(report.admin_notes || '');
    setNewStatus(report.status);
  };

  const handleUpdateReport = async () => {
    if (!selectedReport) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('question_error_reports')
        .update({
          status: newStatus,
          admin_notes: adminNotes.trim() || null,
        })
        .eq('id', selectedReport.id);

      if (error) throw error;

      toast.success("Relatório atualizado!");
      setSelectedReport(null);
      fetchReports();
    } catch (error) {
      console.error('Error updating report:', error);
      toast.error("Erro ao atualizar relatório");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este relatório?")) return;

    try {
      const { error } = await supabase
        .from('question_error_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Relatório excluído!");
      fetchReports();
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error("Erro ao excluir relatório");
    }
  };

  // P3: Bulk resolve reports of type "enunciado" that were fixed
  const handleBulkResolveEnunciado = async () => {
    setBulkResolving(true);
    try {
      // Get all pending enunciado reports
      const pendingEnunciado = reports.filter(
        r => r.error_type === 'enunciado' && r.status === 'pending'
      );

      // Check which questions now have associated_text properly set
      const questionIds = pendingEnunciado.map(r => r.question_id);
      
      const { data: questions } = await supabase
        .from('questions')
        .select('id, associated_text')
        .in('id', questionIds);

      // Find reports where question now has associated_text
      const resolvedReportIds = pendingEnunciado
        .filter(report => {
          const q = questions?.find(q => q.id === report.question_id);
          return q?.associated_text && q.associated_text.trim().length > 0;
        })
        .map(r => r.id);

      if (resolvedReportIds.length === 0) {
        toast.info("Nenhum relatório de enunciado pode ser resolvido automaticamente");
        return;
      }

      // Update all these reports to resolved
      const { error } = await supabase
        .from('question_error_reports')
        .update({
          status: 'resolved',
          admin_notes: 'Resolvido automaticamente - associated_text agora está sendo renderizado corretamente.',
        })
        .in('id', resolvedReportIds);

      if (error) throw error;

      toast.success(`${resolvedReportIds.length} relatórios marcados como resolvidos!`);
      setShowBulkDialog(false);
      fetchReports();
    } catch (error) {
      console.error('Error bulk resolving:', error);
      toast.error("Erro ao resolver relatórios em massa");
    } finally {
      setBulkResolving(false);
    }
  };

  const renderQuestionPreview = (report: ErrorReport) => {
    if (!report.question) return null;

    const q = report.question;
    
    return (
      <div className="space-y-3 bg-slate-50 p-4 rounded-lg border text-sm max-h-[300px] overflow-y-auto">
        {/* Associated Text Preview */}
        {q.associated_text && (
          <div>
            <span className="text-xs font-medium text-slate-500">Texto Associado:</span>
            <p className="text-xs text-slate-600 line-clamp-3">{q.associated_text.slice(0, 200)}...</p>
          </div>
        )}
        
        {/* Question Preview */}
        <div>
          <span className="text-xs font-medium text-slate-500">Enunciado:</span>
          <p className="text-sm" dangerouslySetInnerHTML={{ __html: q.question?.slice(0, 300) + '...' }} />
        </div>

        {/* Options for Gabarito reports */}
        {report.error_type === 'gabarito' && (
          <div className="space-y-1 border-t pt-2">
            <span className="text-xs font-medium text-slate-500">Alternativas:</span>
            <div className="grid gap-1">
              {['A', 'B', 'C', 'D', 'E'].map((letter) => {
                const optionKey = `option_${letter.toLowerCase()}` as keyof typeof q;
                const optionValue = q[optionKey];
                const isCorrect = q.answer?.toUpperCase() === letter;
                
                if (!optionValue) return null;
                
                return (
                  <div 
                    key={letter} 
                    className={`flex gap-2 text-xs p-1 rounded ${isCorrect ? 'bg-green-100 border border-green-300' : ''}`}
                  >
                    <span className={`font-bold ${isCorrect ? 'text-green-700' : 'text-slate-500'}`}>
                      {letter})
                    </span>
                    <span className={isCorrect ? 'text-green-700' : 'text-slate-600'}>
                      {String(optionValue).slice(0, 100)}{String(optionValue).length > 100 ? '...' : ''}
                    </span>
                    {isCorrect && <Badge variant="outline" className="text-xs h-4 bg-green-500 text-white">Gabarito</Badge>}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
              <span className="text-xs font-medium text-yellow-700">
                Gabarito atual: {q.answer}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Notificações de Erros
            {stats.pending > 0 && (
              <Badge variant="destructive" className="ml-2">
                {stats.pending} pendente{stats.pending > 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowBulkDialog(true)}
              className="gap-1"
            >
              <Wand2 className="h-4 w-4" />
              Auto-resolver
            </Button>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="reviewed">Em Análise</SelectItem>
                <SelectItem value="resolved">Resolvidos</SelectItem>
                <SelectItem value="dismissed">Descartados</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchReports} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-slate-100 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-slate-700">{stats.total}</div>
            <div className="text-xs text-slate-500">Total</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.enunciado}</div>
            <div className="text-xs text-blue-500">Enunciado</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.gabarito}</div>
            <div className="text-xs text-orange-500">Gabarito</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.comentario}</div>
            <div className="text-xs text-purple-500">Comentário</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Tabs by error type */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="enunciado" className="gap-1">
              <FileText className="h-3 w-3" />
              Enunciado
            </TabsTrigger>
            <TabsTrigger value="gabarito" className="gap-1">
              <Scale className="h-3 w-3" />
              Gabarito
            </TabsTrigger>
            <TabsTrigger value="comentario" className="gap-1">
              <MessageSquare className="h-3 w-3" />
              Comentário
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search by question code */}
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código da questão..."
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchCode.trim() ? `Nenhum relatório encontrado para "${searchCode}"` : 'Nenhum relatório de erro encontrado'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Questão</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Detalhes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReports.map((report) => {
                const StatusIcon = statusConfig[report.status as keyof typeof statusConfig]?.icon || Clock;
                const TypeConfig = errorTypeConfig[report.error_type as keyof typeof errorTypeConfig];
                const TypeIcon = TypeConfig?.icon || FileText;
                
                return (
                  <TableRow key={report.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(report.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{report.question?.code || 'N/A'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1 ${TypeConfig?.color}`}>
                        <TypeIcon className="h-3 w-3" />
                        {TypeConfig?.label || report.error_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {report.details.slice(0, 60)}{report.details.length > 60 ? '...' : ''}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig[report.status as keyof typeof statusConfig]?.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig[report.status as keyof typeof statusConfig]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenReport(report)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteReport(report.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Report Detail Dialog - Enhanced for Gabarito */}
        <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Detalhes do Relatório
                {selectedReport && (
                  <Badge variant="outline" className={errorTypeConfig[selectedReport.error_type as keyof typeof errorTypeConfig]?.color}>
                    {errorTypeConfig[selectedReport.error_type as keyof typeof errorTypeConfig]?.label}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>

            {selectedReport && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Questão:</span>
                    <p className="font-mono font-medium">{selectedReport.question?.code}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Usuário:</span>
                    <p className="font-medium">
                      {selectedReport.profile?.full_name || selectedReport.profile?.email}
                    </p>
                  </div>
                </div>

                {/* Question Preview */}
                {renderQuestionPreview(selectedReport)}

                <div>
                  <span className="text-sm text-muted-foreground">Detalhes do Erro:</span>
                  <p className="mt-1 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                    {selectedReport.details}
                  </p>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/banco-questoes?search=${selectedReport.question?.code}`, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Ver no Banco
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const searchParams = new URLSearchParams();
                      searchParams.set('tab', 'questoes');
                      searchParams.set('search', selectedReport.question?.code || selectedReport.question_id);
                      window.open(`/admin?${searchParams.toString()}`, '_blank');
                    }}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Editar Questão
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="reviewed">Em Análise</SelectItem>
                        <SelectItem value="resolved">Resolvido</SelectItem>
                        <SelectItem value="dismissed">Descartado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Notas do Admin:</span>
                  <Textarea
                    placeholder="Adicione notas sobre a resolução..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedReport(null)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateReport} disabled={isUpdating}>
                {isUpdating ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Resolve Dialog */}
        <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Auto-resolver Relatórios
              </DialogTitle>
              <DialogDescription>
                Esta ação irá marcar como "Resolvido" todos os relatórios de enunciado
                cujas questões agora possuem texto associado configurado corretamente.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  <strong>{stats.enunciado}</strong> relatórios de enunciado pendentes serão verificados.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                O sistema verificará se cada questão agora possui o campo <code>associated_text</code> preenchido
                e marcará os relatórios correspondentes como resolvidos automaticamente.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleBulkResolveEnunciado} disabled={bulkResolving}>
                {bulkResolving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Executar Auto-resolução
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>

      {/* Enunciado Analysis Section */}
      <AdminEnunciadoAnalysis />
    </Card>
  );
}
