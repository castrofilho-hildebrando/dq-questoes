import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  Search,
  Loader2,
  RefreshCw,
  UserCheck,
  UserX,
  Shield,
  ShieldOff,
  Pencil,
  Trash2,
  Calendar,
  BarChart3,
  Eye,
  FileQuestion,
  ArrowUpDown,
  GraduationCap,
  Download,
  Lock,
} from 'lucide-react';
import { UserWithRoles, AppRole } from '@/types/admin';
import { toast } from 'sonner';
import { format, subDays, formatDistanceToNow, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StudentPerformanceDashboard } from './StudentPerformanceDashboard';
import { UserAssessoriaTab } from './UserAssessoriaTab';

interface AdminUsersManagementProps {
  users: UserWithRoles[];
  onToggleActive: (userId: string, isActive: boolean) => Promise<boolean>;
  onUpdateRole: (userId: string, role: AppRole, add: boolean) => Promise<boolean>;
  onRefresh: () => Promise<void>;
}

interface StudyDiscipline {
  id: string;
  name: string;
}

interface StudyTopic {
  id: string;
  name: string;
  study_discipline_id: string;
}

interface UserQuestionCount {
  user_id: string;
  count: number;
}

// Assessoria view state
interface AssessoriaUser {
  userId: string;
  userName: string | null;
  userEmail: string;
  lastAccessAt: string | null;
}

export function AdminUsersManagement({
  users,
  onToggleActive,
  onUpdateRole,
  onRefresh,
}: AdminUsersManagementProps) {
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [questionsFilter, setQuestionsFilter] = useState('all'); // 'all', '0', '1-10', '11-50', '51-100', '100+'
  const [sortByQuestions, setSortByQuestions] = useState<'asc' | 'desc' | null>(null);
  
  // User question counts
  const [userQuestionCounts, setUserQuestionCounts] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(false);
  
  // Edit user dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  
  // Delete user dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserWithRoles | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Report dialog
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportUser, setReportUser] = useState<UserWithRoles | null>(null);
  const [reportPeriod, setReportPeriod] = useState('30');
  const [reportDiscipline, setReportDiscipline] = useState('all');
  const [reportTopic, setReportTopic] = useState('all');
  const [reportIncludeNotebooks, setReportIncludeNotebooks] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  
  // Dashboard state
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardData, setDashboardData] = useState<{
    studentName: string;
    studentEmail: string;
    periodLabel: string;
    totalQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    accuracyRate: number;
    disciplineStats: Record<string, { name: string; total: number; correct: number }>;
    topicStats: Record<string, { name: string; discipline: string; total: number; correct: number }>;
    notebooksData: any[];
    dailyProgress: { date: string; total: number; correct: number }[];
  } | null>(null);

  // Assessoria view state
  const [assessoriaUser, setAssessoriaUser] = useState<AssessoriaUser | null>(null);

  // Fetch disciplines
  const { data: disciplines } = useQuery({
    queryKey: ['study-disciplines-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_disciplines')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as StudyDiscipline[];
    },
  });

  // Fetch topics based on discipline
  const { data: topics } = useQuery({
    queryKey: ['study-topics-admin', reportDiscipline],
    queryFn: async () => {
      let query = supabase
        .from('study_topics')
        .select('id, name, study_discipline_id')
        .eq('is_active', true);
      
      if (reportDiscipline !== 'all') {
        query = query.eq('study_discipline_id', reportDiscipline);
      }
      
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data as StudyTopic[];
    },
    enabled: reportDialogOpen,
  });

  // Load user question counts using RPC for accurate counting
  useEffect(() => {
    const loadQuestionCounts = async () => {
      if (users.length === 0) return;
      
      setLoadingCounts(true);
      try {
        // Use a more efficient query that counts per user
        const userIds = users.map(u => u.user_id);
        const counts: Record<string, number> = {};
        
        // Batch fetch counts for each user
        await Promise.all(
          userIds.map(async (userId) => {
            const { count, error } = await supabase
              .from('user_answers')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId);
            
            if (!error && count !== null) {
              counts[userId] = count;
            }
          })
        );
        
        setUserQuestionCounts(counts);
      } catch (error) {
        console.error('Error loading question counts:', error);
      } finally {
        setLoadingCounts(false);
      }
    };
    
    loadQuestionCounts();
  }, [users]);

  // Realtime subscription for last_access_at updates
  const [liveLastAccess, setLiveLastAccess] = useState<Record<string, string | null>>({});
  
  useEffect(() => {
    // Initialize with current values
    const initial: Record<string, string | null> = {};
    users.forEach(u => {
      initial[u.user_id] = u.last_access_at;
    });
    setLiveLastAccess(initial);

    // Subscribe to realtime updates on profiles table
    const channel = supabase
      .channel('profiles-last-access')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=in.(${users.map(u => u.user_id).join(',')})`,
        },
        (payload) => {
          const updated = payload.new as { user_id: string; last_access_at: string | null };
          if (updated.user_id && updated.last_access_at) {
            setLiveLastAccess(prev => ({
              ...prev,
              [updated.user_id]: updated.last_access_at,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [users]);

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    let result = users.filter(user => {
      // Hide deleted users
      if (user.full_name?.startsWith('[EXCLUÍDO]')) return false;
      
      // Apply search filter
      const matchesSearch = user.email.toLowerCase().includes(search.toLowerCase()) ||
        (user.full_name && user.full_name.toLowerCase().includes(search.toLowerCase()));
      
      if (!matchesSearch) return false;
      
      // Apply questions filter
      const count = userQuestionCounts[user.user_id] || 0;
      switch (questionsFilter) {
        case '0':
          return count === 0;
        case '1-10':
          return count >= 1 && count <= 10;
        case '11-50':
          return count >= 11 && count <= 50;
        case '51-100':
          return count >= 51 && count <= 100;
        case '100+':
          return count > 100;
        default:
          return true;
      }
    });
    
    // Apply sort
    if (sortByQuestions) {
      result = [...result].sort((a, b) => {
        const countA = userQuestionCounts[a.user_id] || 0;
        const countB = userQuestionCounts[b.user_id] || 0;
        return sortByQuestions === 'asc' ? countA - countB : countB - countA;
      });
    }
    
    return result;
  }, [users, search, questionsFilter, sortByQuestions, userQuestionCounts]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    await onToggleActive(userId, !currentActive);
  };

  const handleToggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    await onUpdateRole(userId, 'admin', !isCurrentlyAdmin);
  };

  const openEditDialog = (user: UserWithRoles) => {
    setEditingUser(user);
    setEditName(user.full_name || '');
    setEditEmail(user.email || '');
    setEditCpf(user.cpf || '');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editName, email: editEmail })
        .eq('user_id', editingUser.user_id);
      
      if (error) throw error;
      
      toast.success('Usuário atualizado com sucesso');
      setEditDialogOpen(false);
      await onRefresh();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Erro ao atualizar usuário');
    } finally {
      setEditSaving(false);
    }
  };

  const openDeleteDialog = (user: UserWithRoles) => {
    setDeletingUser(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    
    setDeleteLoading(true);
    try {
      // Deactivate user and mark as deleted
      const { error } = await supabase
        .from('profiles')
        .update({ 
          is_active: false,
          full_name: `[EXCLUÍDO] ${deletingUser.full_name || ''}`
        })
        .eq('user_id', deletingUser.user_id);
      
      if (error) throw error;
      
      // Remove all roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', deletingUser.user_id);
      
      // Deactivate from authorized emails if exists
      await supabase
        .from('authorized_emails')
        .update({ is_active: false })
        .eq('email', deletingUser.email);
      
      toast.success('Usuário excluído com sucesso');
      setDeleteDialogOpen(false);
      await onRefresh();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Erro ao excluir usuário');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openReportDialog = (user: UserWithRoles) => {
    setReportUser(user);
    setReportPeriod('30');
    setReportDiscipline('all');
    setReportTopic('all');
    setReportIncludeNotebooks(false);
    setShowDashboard(false);
    setDashboardData(null);
    setReportDialogOpen(true);
  };

  const handleGenerateReport = async () => {
    if (!reportUser) return;
    
    setReportLoading(true);
    try {
      const days = parseInt(reportPeriod);
      const startDate = days > 0 ? subDays(new Date(), days).toISOString() : null;
      
      // Build query for user answers
      let answersQuery = supabase
        .from('user_answers')
        .select(`
          id,
          is_correct,
          selected_answer,
          answered_at,
          questions!inner(
            id,
            code,
            question,
            answer,
            difficulty,
            study_discipline_id,
            study_topic_id,
            study_disciplines(name),
            study_topics(name)
          )
        `)
        .eq('user_id', reportUser.user_id);
      
      if (startDate) {
        answersQuery = answersQuery.gte('answered_at', startDate);
      }
      
      if (reportDiscipline !== 'all') {
        answersQuery = answersQuery.eq('questions.study_discipline_id', reportDiscipline);
      }
      
      if (reportTopic !== 'all') {
        answersQuery = answersQuery.eq('questions.study_topic_id', reportTopic);
      }
      
      const { data: answers, error: answersError } = await answersQuery.order('answered_at', { ascending: false });
      
      if (answersError) throw answersError;

      // Fetch notebooks if requested
      let notebooksData: any[] = [];
      if (reportIncludeNotebooks) {
        const { data: notebooks } = await supabase
          .from('study_notebooks')
          .select('id, name, created_at, notebook_questions(count)')
          .eq('user_id', reportUser.user_id);
        notebooksData = notebooks || [];
      }

      // Calculate statistics
      const totalQuestions = answers?.length || 0;
      const correctAnswers = answers?.filter((a: any) => a.is_correct).length || 0;
      const wrongAnswers = totalQuestions - correctAnswers;
      const accuracyRate = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

      // Group by discipline
      const disciplineStats: Record<string, { name: string; total: number; correct: number }> = {};
      answers?.forEach((answer: any) => {
        const discName = answer.questions?.study_disciplines?.name || 'Sem disciplina';
        if (!disciplineStats[discName]) {
          disciplineStats[discName] = { name: discName, total: 0, correct: 0 };
        }
        disciplineStats[discName].total++;
        if (answer.is_correct) disciplineStats[discName].correct++;
      });

      // Group by topic
      const topicStats: Record<string, { name: string; discipline: string; total: number; correct: number }> = {};
      answers?.forEach((answer: any) => {
        const topicName = answer.questions?.study_topics?.name || 'Sem tópico';
        const discName = answer.questions?.study_disciplines?.name || 'Sem disciplina';
        const key = `${discName}-${topicName}`;
        if (!topicStats[key]) {
          topicStats[key] = { name: topicName, discipline: discName, total: 0, correct: 0 };
        }
        topicStats[key].total++;
        if (answer.is_correct) topicStats[key].correct++;
      });

      // Group by date for daily progress
      const dailyProgressMap: Record<string, { date: string; total: number; correct: number }> = {};
      answers?.forEach((answer: any) => {
        const dateKey = format(startOfDay(parseISO(answer.answered_at)), 'yyyy-MM-dd');
        if (!dailyProgressMap[dateKey]) {
          dailyProgressMap[dateKey] = { date: dateKey, total: 0, correct: 0 };
        }
        dailyProgressMap[dateKey].total++;
        if (answer.is_correct) dailyProgressMap[dateKey].correct++;
      });
      
      const dailyProgress = Object.values(dailyProgressMap)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30); // Last 30 days

      const periodLabel = days > 0 ? `Últimos ${days} dias` : 'Todo o período';

      // Set dashboard data and show dashboard
      setDashboardData({
        studentName: reportUser.full_name || 'Aluno',
        studentEmail: reportUser.email,
        periodLabel,
        totalQuestions,
        correctAnswers,
        wrongAnswers,
        accuracyRate,
        disciplineStats,
        topicStats,
        notebooksData,
        dailyProgress,
      });
      setShowDashboard(true);
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Erro ao gerar relatório');
    } finally {
      setReportLoading(false);
    }
  };

  const formatLastAccess = (lastAccess: string | null) => {
    if (!lastAccess) return 'Nunca acessou';
    return formatDistanceToNow(new Date(lastAccess), { addSuffix: true, locale: ptBR });
  };

  // Show Assessoria view if a user is selected
  if (assessoriaUser) {
    return (
      <UserAssessoriaTab
        userId={assessoriaUser.userId}
        userName={assessoriaUser.userName}
        userEmail={assessoriaUser.userEmail}
        lastAccessAt={assessoriaUser.lastAccessAt}
        onBack={() => setAssessoriaUser(null)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Gestão de Usuários
            </CardTitle>
            <CardDescription>
              Gerencie, edite e exporte dados dos usuários da plataforma
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email ou nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={questionsFilter} onValueChange={setQuestionsFilter}>
              <SelectTrigger className="w-[180px]">
                <FileQuestion className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Qtd. Questões" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as quantidades</SelectItem>
                <SelectItem value="0">Nenhuma questão</SelectItem>
                <SelectItem value="1-10">1 a 10 questões</SelectItem>
                <SelectItem value="11-50">11 a 50 questões</SelectItem>
                <SelectItem value="51-100">51 a 100 questões</SelectItem>
                <SelectItem value="100+">Mais de 100 questões</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Info note */}
        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
          <p>
            <strong>Nota:</strong> Novos usuários são criados automaticamente quando verificam seu email e criam sua senha.
            Os emails devem estar autorizados previamente na aba "Emails".
          </p>
        </div>

        {/* Users Table */}
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Funções</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    onClick={() => {
                      if (sortByQuestions === null) setSortByQuestions('desc');
                      else if (sortByQuestions === 'desc') setSortByQuestions('asc');
                      else setSortByQuestions(null);
                    }}
                  >
                    Questões Resolvidas
                    <ArrowUpDown className={`ml-1 h-4 w-4 ${sortByQuestions ? 'text-primary' : 'text-muted-foreground'}`} />
                  </Button>
                </TableHead>
                <TableHead>Último Acesso</TableHead>
                <TableHead className="w-[200px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {search || questionsFilter !== 'all' ? 'Nenhum usuário encontrado com os filtros aplicados' : 'Nenhum usuário cadastrado'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => {
                  const isAdmin = user.roles?.includes('admin');
                  const questionCount = userQuestionCounts[user.user_id] || 0;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.full_name || 'Sem nome'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {user.roles?.map((role) => (
                            <Badge key={role} variant={role === 'admin' ? 'default' : 'secondary'}>
                              {role}
                            </Badge>
                          ))}
                          {(!user.roles || user.roles.length === 0) && (
                            <Badge variant="outline">user</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'default' : 'destructive'}>
                          {user.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <FileQuestion className="w-4 h-4 text-muted-foreground" />
                          <span className={questionCount > 0 ? 'font-medium' : 'text-muted-foreground'}>
                            {loadingCounts ? '...' : questionCount}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {formatLastAccess(liveLastAccess[user.user_id] ?? user.last_access_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setAssessoriaUser({
                              userId: user.user_id,
                              userName: user.full_name,
                              userEmail: user.email,
                              lastAccessAt: user.last_access_at,
                            })}
                            title="Assessoria"
                          >
                            <GraduationCap className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(user)}
                            title="Editar usuário"
                          >
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openReportDialog(user)}
                            title="Gerar relatório"
                          >
                            <BarChart3 className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(user.user_id, user.is_active)}
                            title={user.is_active ? 'Desativar usuário' : 'Ativar usuário'}
                          >
                            {user.is_active ? (
                              <UserX className="w-4 h-4 text-destructive" />
                            ) : (
                              <UserCheck className="w-4 h-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleAdmin(user.user_id, isAdmin)}
                            title={isAdmin ? 'Remover admin' : 'Tornar admin'}
                          >
                            {isAdmin ? (
                              <ShieldOff className="w-4 h-4 text-orange-600" />
                            ) : (
                              <Shield className="w-4 h-4 text-blue-600" />
                            )}
                          </Button>
                          {(() => {
                            const daysSinceCreation = Math.floor(
                              (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
                            );
                            const alreadyEligible = daysSinceCreation >= 7;
                            const canDownload = alreadyEligible || user.download_unlocked;

                            if (alreadyEligible) {
                              // Already past 7 days — show green download, no action needed
                              return (
                                <Button variant="ghost" size="icon" disabled title="Download já liberado (7+ dias)">
                                  <Download className="w-4 h-4 text-green-600" />
                                </Button>
                              );
                            }

                            // Under 7 days — show toggle
                            return (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  const newValue = !user.download_unlocked;
                                  const { error } = await supabase
                                    .from('profiles')
                                    .update({ download_unlocked: newValue } as any)
                                    .eq('user_id', user.user_id);
                                  if (error) {
                                    toast.error('Erro ao alterar liberação de download');
                                  } else {
                                    toast.success(newValue ? 'Download liberado!' : 'Liberação de download removida');
                                    await onRefresh();
                                  }
                                }}
                                title={user.download_unlocked
                                  ? `Revogar liberação (conta com ${daysSinceCreation} dia(s))`
                                  : `Liberar download antecipado (conta com ${daysSinceCreation} dia(s))`}
                              >
                                {user.download_unlocked ? (
                                  <Download className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Lock className="w-4 h-4 text-amber-500" />
                                )}
                              </Button>
                            );
                          })()}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(user)}
                            title="Excluir usuário"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Total: {filteredUsers.length} usuário{filteredUsers.length !== 1 ? 's' : ''}
            {questionsFilter !== 'all' && (
              <span className="ml-2 text-primary">
                (filtro: {questionsFilter === '0' ? 'sem questões' : questionsFilter === '100+' ? '+100 questões' : `${questionsFilter} questões`})
              </span>
            )}
          </p>
          {(questionsFilter !== 'all' || sortByQuestions) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuestionsFilter('all');
                setSortByQuestions(null);
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </CardContent>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Visualize e edite as informações do usuário
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Email do usuário"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome Completo</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome do usuário"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cpf">CPF</Label>
              <Input
                id="edit-cpf"
                value={editCpf}
                disabled
                className="bg-muted"
                placeholder="000.000.000-00"
              />
            </div>
            <div className="space-y-2">
              <Label>Último Acesso</Label>
              <Input
                value={editingUser?.last_access_at 
                  ? format(parseISO(editingUser.last_access_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                  : 'Nunca acessou'}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{deletingUser?.full_name || deletingUser?.email}</strong>?
              <br /><br />
              Esta ação irá:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Desativar a conta do usuário</li>
                <li>Remover todas as permissões</li>
                <li>Desautorizar o email</li>
              </ul>
              <br />
              Os dados de respostas e histórico serão mantidos para fins de relatório.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Generation Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={(open) => {
        setReportDialogOpen(open);
        if (!open) {
          setShowDashboard(false);
          setDashboardData(null);
        }
      }}>
        <DialogContent className={showDashboard ? "max-w-5xl max-h-[90vh]" : "max-w-lg"}>
          {!showDashboard ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Gerar Relatório de Desempenho
                </DialogTitle>
                <DialogDescription>
                  {reportUser?.full_name || reportUser?.email}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Period */}
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Select value={reportPeriod} onValueChange={setReportPeriod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Últimos 7 dias</SelectItem>
                      <SelectItem value="30">Últimos 30 dias</SelectItem>
                      <SelectItem value="90">Últimos 90 dias</SelectItem>
                      <SelectItem value="365">Último ano</SelectItem>
                      <SelectItem value="0">Todo o período</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Discipline filter */}
                <div className="space-y-2">
                  <Label>Disciplina</Label>
                  <Select value={reportDiscipline} onValueChange={(v) => { setReportDiscipline(v); setReportTopic('all'); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as disciplinas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as disciplinas</SelectItem>
                      {disciplines?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Topic filter */}
                <div className="space-y-2">
                  <Label>Tópico</Label>
                  <Select value={reportTopic} onValueChange={setReportTopic}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os tópicos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tópicos</SelectItem>
                      {topics?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Additional options */}
                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-sm text-muted-foreground">Opções adicionais</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="include-notebooks" 
                      checked={reportIncludeNotebooks}
                      onCheckedChange={(checked) => setReportIncludeNotebooks(!!checked)}
                    />
                    <label htmlFor="include-notebooks" className="text-sm">
                      Incluir cadernos de questões
                    </label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleGenerateReport} disabled={reportLoading}>
                  {reportLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4 mr-2" />
                  )}
                  Ver Dashboard
                </Button>
              </DialogFooter>
            </>
          ) : dashboardData ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Dashboard de Desempenho
                </DialogTitle>
              </DialogHeader>
              <StudentPerformanceDashboard
                studentName={dashboardData.studentName}
                studentEmail={dashboardData.studentEmail}
                periodLabel={dashboardData.periodLabel}
                totalQuestions={dashboardData.totalQuestions}
                correctAnswers={dashboardData.correctAnswers}
                wrongAnswers={dashboardData.wrongAnswers}
                accuracyRate={dashboardData.accuracyRate}
                disciplineStats={dashboardData.disciplineStats}
                topicStats={dashboardData.topicStats}
                notebooksData={dashboardData.notebooksData}
                dailyProgress={dashboardData.dailyProgress}
                includeNotebooks={reportIncludeNotebooks}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDashboard(false)}>
                  Voltar aos Filtros
                </Button>
                <Button onClick={() => setReportDialogOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
