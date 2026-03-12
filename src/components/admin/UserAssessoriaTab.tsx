import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, 
  Calendar, 
  Target, 
  CheckCircle2, 
  Clock, 
  BookOpen,
  Flame,
  Pin,
  PinOff,
  Trash2,
  Plus,
  FileText,
  Settings,
  Loader2,
  AlertCircle,
  BarChart3,
  Eye,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import { useUserManagement, type UserCronogramaInfo, type MentoringNote, type PerformanceReport } from '@/hooks/useUserManagement';
import { AdminCronogramaViewer } from './AdminCronogramaViewer';
import { AdminCronogramaEditor } from './AdminCronogramaEditor';
import { AdminCreateCronograma } from './AdminCreateCronograma';
import { useCreateRevisionCronograma } from '@/hooks/useCreateRevisionCronograma';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserAssessoriaTabProps {
  userId: string;
  userName: string | null;
  userEmail: string;
  lastAccessAt: string | null;
  onBack: () => void;
}

type ViewMode = 'list' | 'view' | 'edit' | 'create';

export function UserAssessoriaTab({
  userId,
  userName,
  userEmail,
  lastAccessAt,
  onBack,
}: UserAssessoriaTabProps) {
  const {
    cronogramas,
    mentoringNotes,
    performanceReports,
    performanceStats,
    loading,
    refresh,
    addMentoringNote,
    deleteMentoringNote,
    toggleNotePinned,
    generatePerformanceReport,
  } = useUserManagement(userId);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [selectedCronogramaId, setSelectedCronogramaId] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [deletingCronogramaId, setDeletingCronogramaId] = useState<string | null>(null);
  const [isDeletingCronograma, setIsDeletingCronograma] = useState(false);
  const { createRevisionCronograma, isCreating: isCreatingRevision } = useCreateRevisionCronograma();

  const handleGenerateRevision = async (cronogramaId: string) => {
    const result = await createRevisionCronograma(cronogramaId, userId);
    if (result.success) {
      toast.success(`Cronograma de revisão criado com ${result.tasksCreated} tarefas`);
      await refresh();
    } else {
      toast.error(result.error || 'Erro ao gerar revisão');
    }
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    setAddingNote(true);
    const success = await addMentoringNote(noteContent.trim());
    if (success) {
      setNoteContent('');
      setShowAddNote(false);
    }
    setAddingNote(false);
  };

  const handleDeleteNote = async () => {
    if (!deletingNoteId) return;
    await deleteMentoringNote(deletingNoteId);
    setDeletingNoteId(null);
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    await generatePerformanceReport(undefined, 30);
    setGeneratingReport(false);
  };

  const handleDeleteCronograma = async () => {
    if (!deletingCronogramaId) return;
    
    setIsDeletingCronograma(true);
    try {
      const { error } = await supabase.rpc('delete_cronograma_cascade', {
        p_cronograma_id: deletingCronogramaId,
      });

      if (error) throw error;

      toast.success('Cronograma excluído com sucesso');
      await refresh();
    } catch (error) {
      console.error('Error deleting cronograma:', error);
      toast.error('Erro ao excluir cronograma');
    } finally {
      setIsDeletingCronograma(false);
      setDeletingCronogramaId(null);
    }
  };

  const handleViewCronograma = (cronogramaId: string) => {
    setSelectedCronogramaId(cronogramaId);
    setViewMode('view');
  };

  const handleEditCronograma = (cronogramaId: string) => {
    setSelectedCronogramaId(cronogramaId);
    setViewMode('edit');
  };

  const handleCreateCronograma = () => {
    setViewMode('create');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedCronogramaId(null);
    refresh();
  };

  const formatLastAccess = (date: string | null) => {
    if (!date) return 'Nunca acessou';
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  };

  // If creating a new cronograma
  if (viewMode === 'create') {
    return (
      <AdminCreateCronograma
        userId={userId}
        userName={userName}
        onBack={handleBackToList}
        onSuccess={handleBackToList}
      />
    );
  }

  // If viewing a specific cronograma
  if (viewMode === 'view' && selectedCronogramaId) {
    return (
      <AdminCronogramaViewer
        cronogramaId={selectedCronogramaId}
        userId={userId}
        onBack={handleBackToList}
      />
    );
  }

  // If editing a specific cronograma
  if (viewMode === 'edit' && selectedCronogramaId) {
    return (
      <AdminCronogramaEditor
        cronogramaId={selectedCronogramaId}
        userId={userId}
        onBack={handleBackToList}
        onSuccess={handleBackToList}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{userName || 'Aluno'}</h2>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Último acesso: {formatLastAccess(lastAccessAt)}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                    <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {performanceStats?.totalQuestionsAnswered || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Questões</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                    <Target className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {performanceStats?.accuracyPercentage || 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">Acurácia</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                    <Flame className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {performanceStats?.currentStreak || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Dias seguidos</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                    <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {performanceStats?.totalStudyHours || 0}h
                    </p>
                    <p className="text-xs text-muted-foreground">Horas de estudo</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="cronogramas" className="w-full">
            <TabsList>
              <TabsTrigger value="cronogramas" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Cronogramas
              </TabsTrigger>
              <TabsTrigger value="notas" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notas de Mentoria
              </TabsTrigger>
              <TabsTrigger value="relatorios" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Relatórios
              </TabsTrigger>
            </TabsList>

            {/* Cronogramas Tab */}
            <TabsContent value="cronogramas" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Cronogramas do Aluno
                      </CardTitle>
                      <CardDescription>
                        Gerencie os cronogramas de estudo do aluno
                      </CardDescription>
                    </div>
                    <Button onClick={handleCreateCronograma}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Cronograma
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {cronogramas.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum cronograma encontrado</p>
                      <p className="text-sm mt-2">Crie um cronograma para este aluno</p>
                      <Button variant="outline" className="mt-4" onClick={handleCreateCronograma}>
                        <Plus className="h-4 w-4 mr-2" />
                        Criar Cronograma
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cronogramas.map((cron) => (
                        <div
                          key={cron.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium">{cron.name}</h4>
                              {!cron.is_active && (
                                <Badge variant="secondary">Inativo</Badge>
                              )}
                              {(cron as any).is_frozen && (
                                <Badge variant="secondary">🔒 Concluído</Badge>
                              )}
                              {(cron as any).cronograma_type === 'revision_only' && (
                                <Badge variant="outline">🔄 Revisão</Badge>
                              )}
                              {cron.pending_admin_changes && (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  Alterações pendentes
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{cron.school_name}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" />
                                {cron.completed_tasks}/{cron.total_tasks} tarefas
                              </span>
                              <span>
                                Início: {format(new Date(cron.start_date), 'dd/MM/yyyy')}
                              </span>
                              {cron.end_date && (
                                <span>
                                  Término: {format(new Date(cron.end_date), 'dd/MM/yyyy')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {/* Botão Gerar Revisão: só aparece se 100% concluído, não congelado, e não é revisão */}
                            {cron.total_tasks > 0 &&
                              cron.completed_tasks >= cron.total_tasks &&
                              !(cron as any).is_frozen &&
                              (cron as any).cronograma_type !== 'revision_only' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleGenerateRevision(cron.id)}
                                disabled={isCreatingRevision}
                                className="text-primary"
                                title="Gerar cronograma de revisão"
                              >
                                <RefreshCw className={`h-4 w-4 mr-1 ${isCreatingRevision ? 'animate-spin' : ''}`} />
                                Gerar Revisão
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewCronograma(cron.id)}
                              title="Visualizar cronograma"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditCronograma(cron.id)}
                              title="Editar configurações"
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletingCronogramaId(cron.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Excluir cronograma"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notas de Mentoria Tab */}
            <TabsContent value="notas" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Notas de Mentoria
                      </CardTitle>
                      <CardDescription>
                        Adicione observações e anotações sobre o aluno
                      </CardDescription>
                    </div>
                    <Button onClick={() => setShowAddNote(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Nota
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {mentoringNotes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma nota de mentoria</p>
                      <p className="text-sm">Adicione notas para acompanhar o progresso do aluno</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        {mentoringNotes.map((note) => (
                          <div
                            key={note.id}
                            className={`p-4 rounded-lg border ${
                              note.is_pinned ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' : 'bg-card'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{note.mentor_name}</span>
                                  <span>•</span>
                                  <span>
                                    {formatDistanceToNow(new Date(note.created_at), {
                                      addSuffix: true,
                                      locale: ptBR,
                                    })}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleNotePinned(note.id, !note.is_pinned)}
                                  title={note.is_pinned ? 'Desafixar' : 'Fixar'}
                                >
                                  {note.is_pinned ? (
                                    <PinOff className="h-4 w-4 text-yellow-600" />
                                  ) : (
                                    <Pin className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeletingNoteId(note.id)}
                                  title="Excluir nota"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Relatórios Tab */}
            <TabsContent value="relatorios" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Relatórios de Desempenho
                      </CardTitle>
                      <CardDescription>
                        Gere e visualize relatórios de desempenho do aluno
                      </CardDescription>
                    </div>
                    <Button onClick={handleGenerateReport} disabled={generatingReport}>
                      {generatingReport ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Gerar Relatório
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {performanceReports.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum relatório gerado</p>
                      <p className="text-sm">Gere relatórios para acompanhar o progresso</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {performanceReports.map((report) => (
                        <div
                          key={report.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={report.report_type === 'cronograma' ? 'secondary' : 'default'}>
                                {report.report_type === 'cronograma' ? 'Cronograma' : 'Geral'}
                              </Badge>
                              <span className="text-sm font-medium">
                                {format(new Date(report.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {report.period_start && report.period_end && (
                                <span>
                                  Período: {format(new Date(report.period_start), 'dd/MM')} a {format(new Date(report.period_end), 'dd/MM/yyyy')}
                                </span>
                              )}
                              <span>Por: {report.generator_name}</span>
                            </div>
                            {report.report_data?.metrics && (
                              <div className="flex items-center gap-4 text-sm">
                                <span>
                                  <strong>{report.report_data.metrics.questionsAnswered}</strong> questões
                                </span>
                                <span>
                                  <strong>{report.report_data.metrics.accuracy}%</strong> acurácia
                                </span>
                              </div>
                            )}
                          </div>
                          <Button variant="ghost" size="sm">
                            Ver detalhes
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Add Note Dialog */}
      <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Nota de Mentoria</DialogTitle>
            <DialogDescription>
              Adicione uma observação sobre o aluno {userName || userEmail}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Escreva sua nota aqui..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            rows={5}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNote(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddNote} disabled={!noteContent.trim() || addingNote}>
              {addingNote && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Note Confirmation */}
      <AlertDialog open={!!deletingNoteId} onOpenChange={() => setDeletingNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Nota</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta nota de mentoria? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Cronograma Confirmation */}
      <AlertDialog open={!!deletingCronogramaId} onOpenChange={() => setDeletingCronogramaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cronograma</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este cronograma? Todas as tarefas associadas também serão excluídas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCronograma}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCronograma}
              disabled={isDeletingCronograma}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingCronograma && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
