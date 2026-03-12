import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  MessageSquare, 
  Loader2, 
  Search,
  Eye,
  Trash2,
  Flag,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  XCircle,
  AlertTriangle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comment {
  id: string;
  question_id: string;
  user_id: string;
  content: string;
  upvotes: number;
  downvotes: number;
  is_active: boolean;
  created_at: string;
  user_name?: string;
  user_email?: string;
  question_code?: string;
}

interface Report {
  id: string;
  comment_id: string;
  user_id: string;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reporter_name?: string;
  reporter_email?: string;
  comment_content?: string;
  comment_user_name?: string;
}

export function AdminComments() {
  const [activeTab, setActiveTab] = useState("comments");
  const [comments, setComments] = useState<Comment[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Dialog states
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  useEffect(() => {
    if (activeTab === "comments") {
      loadComments();
    } else {
      loadReports();
    }
  }, [activeTab, statusFilter]);

  const loadComments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('question_comments')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter === "active") {
        query = query.eq('is_active', true);
      } else if (statusFilter === "inactive") {
        query = query.eq('is_active', false);
      }

      const { data: commentsData, error } = await query;
      if (error) throw error;

      // Get user profiles
      const userIds = [...new Set(commentsData?.map(c => c.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      // Get question codes
      const questionIds = [...new Set(commentsData?.map(c => c.question_id) || [])];
      const { data: questions } = await supabase
        .from('questions')
        .select('id, code')
        .in('id', questionIds);

      const enrichedComments = commentsData?.map(comment => ({
        ...comment,
        user_name: profiles?.find(p => p.user_id === comment.user_id)?.full_name || 'N/A',
        user_email: profiles?.find(p => p.user_id === comment.user_id)?.email || 'N/A',
        question_code: questions?.find(q => q.id === comment.question_id)?.code || 'N/A'
      })) || [];

      setComments(enrichedComments);
    } catch (error) {
      console.error('Error loading comments:', error);
      toast.error('Erro ao carregar comentários');
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('question_comment_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq('status', statusFilter);
      }

      const { data: reportsData, error } = await query;
      if (error) throw error;

      // Get reporter profiles
      const userIds = [...new Set(reportsData?.map(r => r.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      // Get comments
      const commentIds = [...new Set(reportsData?.map(r => r.comment_id) || [])];
      const { data: commentsData } = await supabase
        .from('question_comments')
        .select('id, content, user_id')
        .in('id', commentIds);

      // Get comment authors
      const commentUserIds = [...new Set(commentsData?.map(c => c.user_id) || [])];
      const { data: commentProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', commentUserIds);

      const enrichedReports = reportsData?.map(report => {
        const comment = commentsData?.find(c => c.id === report.comment_id);
        return {
          ...report,
          reporter_name: profiles?.find(p => p.user_id === report.user_id)?.full_name || 'N/A',
          reporter_email: profiles?.find(p => p.user_id === report.user_id)?.email || 'N/A',
          comment_content: comment?.content || 'Comentário removido',
          comment_user_name: commentProfiles?.find(p => p.user_id === comment?.user_id)?.full_name || 'N/A'
        };
      }) || [];

      setReports(enrichedReports);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('Erro ao carregar denúncias');
    } finally {
      setLoading(false);
    }
  };

  const toggleCommentActive = async (comment: Comment) => {
    try {
      const { error } = await supabase
        .from('question_comments')
        .update({ is_active: !comment.is_active })
        .eq('id', comment.id);

      if (error) throw error;

      toast.success(comment.is_active ? 'Comentário desativado' : 'Comentário reativado');
      loadComments();
    } catch (error) {
      console.error('Error toggling comment:', error);
      toast.error('Erro ao atualizar comentário');
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!confirm('Tem certeza que deseja excluir permanentemente este comentário?')) return;

    try {
      const { error } = await supabase
        .from('question_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      toast.success('Comentário excluído permanentemente');
      loadComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Erro ao excluir comentário');
    }
  };

  const updateReportStatus = async (reportId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('question_comment_reports')
        .update({ 
          status: newStatus,
          admin_notes: adminNotes || null
        })
        .eq('id', reportId);

      if (error) throw error;

      toast.success('Status da denúncia atualizado');
      setReportDialogOpen(false);
      setSelectedReport(null);
      setAdminNotes("");
      loadReports();
    } catch (error) {
      console.error('Error updating report:', error);
      toast.error('Erro ao atualizar denúncia');
    }
  };

  const filteredComments = comments.filter(comment =>
    comment.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    comment.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    comment.question_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredReports = reports.filter(report =>
    report.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.reporter_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.comment_content?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pendente</Badge>;
      case 'reviewed':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Analisado</Badge>;
      case 'dismissed':
        return <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">Descartado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Gerenciar Comentários
        </CardTitle>
        <CardDescription>
          Modere comentários e denúncias dos usuários
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="comments" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comentários
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <Flag className="h-4 w-4" />
              Denúncias
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {activeTab === "comments" ? (
                  <>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="inactive">Inativos</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="reviewed">Analisado</SelectItem>
                    <SelectItem value="dismissed">Descartado</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="comments">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Questão</TableHead>
                    <TableHead>Comentário</TableHead>
                    <TableHead>Votos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhum comentário encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredComments.map((comment) => (
                      <TableRow key={comment.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{comment.user_name}</p>
                            <p className="text-xs text-muted-foreground">{comment.user_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{comment.question_code}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="text-sm truncate">{comment.content}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="flex items-center gap-1 text-green-600">
                              <ThumbsUp className="h-3 w-3" />
                              {comment.upvotes}
                            </span>
                            <span className="flex items-center gap-1 text-red-600">
                              <ThumbsDown className="h-3 w-3" />
                              {comment.downvotes}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={comment.is_active ? "default" : "secondary"}>
                            {comment.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(comment.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedComment(comment);
                                setViewDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleCommentActive(comment)}
                            >
                              {comment.is_active ? (
                                <XCircle className="h-4 w-4 text-orange-500" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteComment(comment.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="reports">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Denunciante</TableHead>
                    <TableHead>Autor do Comentário</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhuma denúncia encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{report.reporter_name}</p>
                            <p className="text-xs text-muted-foreground">{report.reporter_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {report.comment_user_name}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="text-sm truncate">{report.reason}</p>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(report.status)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(report.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedReport(report);
                              setAdminNotes(report.admin_notes || "");
                              setReportDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>

        {/* View Comment Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes do Comentário</DialogTitle>
            </DialogHeader>
            {selectedComment && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Usuário</p>
                  <p>{selectedComment.user_name} ({selectedComment.user_email})</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Questão</p>
                  <p>{selectedComment.question_code}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Conteúdo</p>
                  <p className="whitespace-pre-wrap bg-slate-50 p-3 rounded">{selectedComment.content}</p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Votos Positivos</p>
                    <p className="text-green-600 font-medium">{selectedComment.upvotes}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Votos Negativos</p>
                    <p className="text-red-600 font-medium">{selectedComment.downvotes}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Data</p>
                  <p>{format(new Date(selectedComment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Report Details Dialog */}
        <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Detalhes da Denúncia
              </DialogTitle>
            </DialogHeader>
            {selectedReport && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Denunciante</p>
                  <p>{selectedReport.reporter_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Comentário Denunciado</p>
                  <p className="whitespace-pre-wrap bg-slate-50 p-3 rounded text-sm">{selectedReport.comment_content}</p>
                  <p className="text-xs text-muted-foreground mt-1">Por: {selectedReport.comment_user_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Motivo</p>
                  <p className="whitespace-pre-wrap">{selectedReport.reason}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Notas do Admin</p>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Adicione notas sobre esta denúncia..."
                  />
                </div>
              </div>
            )}
            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => updateReportStatus(selectedReport!.id, 'dismissed')}
              >
                Descartar
              </Button>
              <Button
                onClick={() => updateReportStatus(selectedReport!.id, 'reviewed')}
              >
                Marcar como Analisado
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
