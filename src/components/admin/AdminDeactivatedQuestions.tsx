import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, Eye, CheckCircle, XCircle, Search, FileQuestion, AlertCircle, Ban, ExternalLink, Info } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DeactivatedQuestion {
  id: string;
  code: string;
  question: string;
  answer: string;
  question_type: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
  associated_text: string | null;
  updated_at: string;
  created_at: string;
  discipline_id?: string;
  discipline_name?: string;
}

interface MissingOptionsQuestion {
  id: string;
  code: string;
  question: string;
  answer: string;
  question_type: string;
  missing_count: number;
}

interface Discipline {
  id: string;
  name: string;
}

export function AdminDeactivatedQuestions() {
  const navigate = useNavigate();
  const [deactivatedQuestions, setDeactivatedQuestions] = useState<DeactivatedQuestion[]>([]);
  const [missingOptionsQuestions, setMissingOptionsQuestions] = useState<MissingOptionsQuestion[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMissing, setLoadingMissing] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState<DeactivatedQuestion | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [stats, setStats] = useState({ 
    totalDeactivated: 0, 
    totalMissingAll: 0, 
    totalMissingSome: 0 
  });

  const handleViewInQuestionBank = (code: string) => {
    navigate(`/admin?tab=questoes&search=${encodeURIComponent(code)}`);
  };

  const fetchDisciplines = async () => {
    const { data } = await supabase
      .from('study_disciplines')
      .select('id, name')
      .eq('is_active', true)
      .eq('is_source', true)
      .order('name');
    setDisciplines(data || []);
  };

  const fetchDeactivatedQuestions = async (disciplineFilter?: string) => {
    setLoading(true);
    try {
      // First get question IDs filtered by discipline if needed
      let questionIds: string[] | null = null;
      
      if (disciplineFilter && disciplineFilter !== 'all') {
        const { data: disciplineQuestions } = await supabase
          .from('question_disciplines')
          .select('question_id')
          .eq('study_discipline_id', disciplineFilter)
          .is('deleted_at', null);
        
        questionIds = disciplineQuestions?.map(d => d.question_id) || [];
      }

      let query = supabase
        .from('questions')
        .select('id, code, question, answer, question_type, option_a, option_b, option_c, option_d, option_e, associated_text, updated_at, created_at', { count: 'exact' })
        .eq('is_active', false)
        .order('updated_at', { ascending: false });

      if (questionIds !== null) {
        if (questionIds.length === 0) {
          setDeactivatedQuestions([]);
          setStats(prev => ({ ...prev, totalDeactivated: 0 }));
          setLoading(false);
          return;
        }
        query = query.in('id', questionIds.slice(0, 100));
      }

      const { data, error, count } = await query.limit(100);

      if (error) throw error;
      setDeactivatedQuestions(data || []);
      setStats(prev => ({ ...prev, totalDeactivated: count || 0 }));
    } catch (error) {
      console.error('Error fetching deactivated questions:', error);
      toast.error("Erro ao carregar questões desativadas");
    } finally {
      setLoading(false);
    }
  };

  const fetchMissingOptionsStats = async () => {
    setLoadingMissing(true);
    try {
      // Get count of questions missing ALL 5 options
      const { count: missingAll } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('question_type', 'mult')
        .is('option_a', null)
        .is('option_b', null)
        .is('option_c', null)
        .is('option_d', null)
        .is('option_e', null);

      // Get sample of questions missing ALL options
      const { data: missingData } = await supabase
        .from('questions')
        .select('id, code, question, answer, question_type')
        .eq('is_active', true)
        .eq('question_type', 'mult')
        .is('option_a', null)
        .is('option_b', null)
        .is('option_c', null)
        .is('option_d', null)
        .is('option_e', null)
        .order('code')
        .limit(50);

      setMissingOptionsQuestions((missingData || []).map(q => ({
        ...q,
        missing_count: 5
      })));
      
      // Note: 5516 questões faltam apenas a alternativa E - são questões de 4 opções (A-D), não é erro
      setStats(prev => ({ 
        ...prev, 
        totalMissingAll: missingAll || 0,
        totalMissingSome: 0 // Removido - questões de 4 opções são válidas
      }));
    } catch (error) {
      console.error('Error fetching missing options stats:', error);
    } finally {
      setLoadingMissing(false);
    }
  };

  useEffect(() => {
    fetchDisciplines();
    fetchDeactivatedQuestions(selectedDiscipline);
    fetchMissingOptionsStats();
  }, []);

  useEffect(() => {
    fetchDeactivatedQuestions(selectedDiscipline);
  }, [selectedDiscipline]);

  const filteredDeactivated = useMemo(() => {
    if (!searchTerm) return deactivatedQuestions;
    const term = searchTerm.toLowerCase();
    return deactivatedQuestions.filter(q => 
      q.code.toLowerCase().includes(term) || 
      q.question?.toLowerCase().includes(term)
    );
  }, [deactivatedQuestions, searchTerm]);

  const handleReactivate = async (id: string, code: string) => {
    setActivatingId(id);
    try {
      const { error } = await supabase
        .from('questions')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Questão ${code} reativada!`);
      fetchDeactivatedQuestions(selectedDiscipline);
    } catch (error) {
      console.error('Error reactivating question:', error);
      toast.error("Erro ao reativar questão");
    } finally {
      setActivatingId(null);
    }
  };

  const handleDeactivateMissing = async (id: string, code: string) => {
    setDeactivatingId(id);
    try {
      const { error } = await supabase
        .from('questions')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Questão ${code} desativada!`);
      fetchMissingOptionsStats();
      fetchDeactivatedQuestions();
    } catch (error) {
      console.error('Error deactivating question:', error);
      toast.error("Erro ao desativar questão");
    } finally {
      setDeactivatingId(null);
    }
  };

  const handleBulkDeactivateMissing = async () => {
    if (!confirm(`Tem certeza que deseja desativar todas as ${stats.totalMissingAll} questões sem alternativas?`)) return;

    try {
      // Get all questions missing all 5 options
      const { data: ids } = await supabase
        .from('questions')
        .select('id')
        .eq('is_active', true)
        .eq('question_type', 'mult')
        .is('option_a', null)
        .is('option_b', null)
        .is('option_c', null)
        .is('option_d', null)
        .is('option_e', null);

      if (ids && ids.length > 0) {
        // Update in batches of 50
        for (let i = 0; i < ids.length; i += 50) {
          const batch = ids.slice(i, i + 50).map(q => q.id);
          await supabase
            .from('questions')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .in('id', batch);
        }
        
        toast.success(`${ids.length} questões desativadas!`);
      } else {
        toast.info("Nenhuma questão encontrada para desativar");
      }

      fetchMissingOptionsStats();
      fetchDeactivatedQuestions();
    } catch (error) {
      console.error('Error bulk deactivating:', error);
      toast.error("Erro ao desativar questões em massa");
    }
  };

  const getIssueType = (q: DeactivatedQuestion) => {
    const missingOptions = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter(o => !o).length;
    if (missingOptions === 5) return { label: 'Sem alternativas', color: 'bg-red-500' };
    if (missingOptions > 0) return { label: `Faltam ${missingOptions} alt.`, color: 'bg-orange-500' };
    if (!q.question || q.question.length < 10) return { label: 'Enunciado vazio', color: 'bg-yellow-500' };
    return { label: 'Desativada', color: 'bg-gray-500' };
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Questões Desativadas</p>
                <p className="text-3xl font-bold text-red-700">{stats.totalDeactivated}</p>
              </div>
              <Ban className="h-10 w-10 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600">Sem TODAS alternativas</p>
                <p className="text-3xl font-bold text-orange-700">{stats.totalMissingAll}</p>
              </div>
              <AlertCircle className="h-10 w-10 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Questions Missing All Options */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Questões Ativas Sem Alternativas
              {stats.totalMissingAll > 0 && (
                <Badge variant="destructive">{stats.totalMissingAll}</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {stats.totalMissingAll > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleBulkDeactivateMissing}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Desativar Todas
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={fetchMissingOptionsStats} disabled={loadingMissing}>
                <RefreshCw className={`h-4 w-4 ${loadingMissing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Estas questões estão ativas mas não possuem nenhuma alternativa. Isso causa problemas de renderização.
          </p>
        </CardHeader>
        <CardContent>
          {loadingMissing ? (
            <div className="text-center py-4 text-muted-foreground">Carregando...</div>
          ) : missingOptionsQuestions.length === 0 ? (
            <div className="text-center py-4 text-green-600 flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Todas as questões ativas possuem alternativas!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Gabarito</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missingOptionsQuestions.slice(0, 20).map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-sm">{q.code}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{q.answer}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                      {q.question?.replace(/<[^>]*>/g, '').slice(0, 80)}...
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewInQuestionBank(q.code)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver no Banco de Questões</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeactivateMissing(q.id, q.code)}
                          disabled={deactivatingId === q.id}
                          className="text-destructive hover:text-destructive"
                        >
                          {deactivatingId === q.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Desativar
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {missingOptionsQuestions.length > 20 && (
            <p className="text-center text-sm text-muted-foreground mt-2">
              Mostrando 20 de {stats.totalMissingAll} questões
            </p>
          )}
        </CardContent>
      </Card>

      {/* Deactivated Questions List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-gray-500" />
              Questões Desativadas
              <Badge variant="secondary">{stats.totalDeactivated}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por disciplina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as disciplinas</SelectItem>
                  {disciplines.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-[200px]"
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => fetchDeactivatedQuestions(selectedDiscipline)} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredDeactivated.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
              <FileQuestion className="h-10 w-10 text-muted-foreground/50" />
              {searchTerm ? 'Nenhuma questão encontrada' : 'Nenhuma questão desativada'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Problema</TableHead>
                  <TableHead>Gabarito</TableHead>
                  <TableHead>Desativada em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeactivated.map((q) => {
                  const issue = getIssueType(q);
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono text-sm">{q.code}</TableCell>
                      <TableCell>
                        <Badge className={issue.color}>{issue.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{q.answer}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(q.updated_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewInQuestionBank(q.code)}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver no Banco de Questões</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedQuestion(q)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReactivate(q.id, q.code)}
                            disabled={activatingId === q.id}
                            className="text-green-600 hover:text-green-700"
                          >
                            {activatingId === q.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Reativar
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {stats.totalDeactivated > 100 && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              Mostrando as 100 mais recentes de {stats.totalDeactivated} questões desativadas
            </p>
          )}
        </CardContent>
      </Card>

      {/* Question Detail Dialog */}
      <Dialog open={!!selectedQuestion} onOpenChange={() => setSelectedQuestion(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileQuestion className="h-5 w-5" />
              Detalhes da Questão
              {selectedQuestion && (
                <Badge variant="outline" className="font-mono">{selectedQuestion.code}</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Questão desativada temporariamente por problemas de dados
            </DialogDescription>
          </DialogHeader>

          {selectedQuestion && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Gabarito:</span>
                  <p className="font-bold text-lg">{selectedQuestion.answer}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <p className="font-medium">{selectedQuestion.question_type}</p>
                </div>
              </div>

              {selectedQuestion.associated_text && (
                <div>
                  <span className="text-sm text-muted-foreground">Texto Associado:</span>
                  <div className="mt-1 p-3 bg-slate-50 border rounded-lg text-sm max-h-[150px] overflow-y-auto">
                    {selectedQuestion.associated_text.slice(0, 500)}
                    {selectedQuestion.associated_text.length > 500 && '...'}
                  </div>
                </div>
              )}

              <div>
                <span className="text-sm text-muted-foreground">Enunciado:</span>
                <div 
                  className="mt-1 p-3 bg-slate-50 border rounded-lg text-sm max-h-[200px] overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: selectedQuestion.question?.slice(0, 1000) || '' }}
                />
              </div>

              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Alternativas:</span>
                <div className="grid gap-2">
                  {['A', 'B', 'C', 'D', 'E'].map((letter) => {
                    const optionKey = `option_${letter.toLowerCase()}` as keyof typeof selectedQuestion;
                    const optionValue = selectedQuestion[optionKey];
                    const isCorrect = selectedQuestion.answer?.toUpperCase() === letter;
                    
                    return (
                      <div 
                        key={letter} 
                        className={`flex gap-2 text-sm p-2 rounded border ${
                          optionValue 
                            ? isCorrect 
                              ? 'bg-green-50 border-green-300' 
                              : 'bg-white border-gray-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <span className={`font-bold ${isCorrect ? 'text-green-700' : 'text-slate-500'}`}>
                          {letter})
                        </span>
                        <span className={optionValue ? (isCorrect ? 'text-green-700' : 'text-slate-600') : 'text-red-500 italic'}>
                          {optionValue ? String(optionValue) : 'VAZIO - Alternativa não cadastrada'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedQuestion(null)}>
              Fechar
            </Button>
            {selectedQuestion && (
              <Button 
                onClick={() => {
                  handleReactivate(selectedQuestion.id, selectedQuestion.code);
                  setSelectedQuestion(null);
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Reativar Questão
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
