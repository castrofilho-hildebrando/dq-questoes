import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Merge, Eye, Loader2, RefreshCw, AlertTriangle, CheckCircle2, History } from "lucide-react";
import { useSanitizedHTML } from "@/hooks/useSanitizedHTML";

interface DuplicateGroup {
  duplicate_hash: string;
  question_count: number;
  question_ids: string[];
}

interface QuestionDetail {
  id: string;
  code: string;
  question: string;
  answer: string;
  created_at: string;
  study_discipline_id: string | null;
  study_topic_id: string | null;
  discipline_name?: string;
  topic_name?: string;
}

interface MergeHistoryItem {
  id: string;
  kept_question_id: string;
  removed_question_ids: string[];
  merged_at: string;
  questions_count: number;
  kept_question_code?: string;
}

export function AdminDuplicates() {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [groupQuestions, setGroupQuestions] = useState<QuestionDetail[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [merging, setMerging] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionDetail | null>(null);

  const [mergingAll, setMergingAll] = useState(false);
  const [mergeProgress, setMergeProgress] = useState({ current: 0, total: 0 });

  // Merge history state
  const [mergeHistory, setMergeHistory] = useState<MergeHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState("duplicates");

  const fetchMergeHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('question_merge_history')
        .select('*')
        .order('merged_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get question codes for kept questions
      if (data && data.length > 0) {
        const keptIds = data.map(h => h.kept_question_id);
        const { data: questions } = await supabase
          .from('questions')
          .select('id, code')
          .in('id', keptIds);

        const questionsMap = new Map((questions || []).map(q => [q.id, q.code]));
        
        setMergeHistory(data.map(h => ({
          ...h,
          kept_question_code: questionsMap.get(h.kept_question_id) || 'N/A'
        })));
      } else {
        setMergeHistory([]);
      }
    } catch (error: any) {
      console.error('Error fetching merge history:', error);
      toast.error("Erro ao carregar histórico: " + error.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchMergeHistory();
    }
  }, [activeTab]);

  const scanForDuplicates = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.rpc('scan_all_duplicates');
      
      if (error) throw error;
      
      setDuplicateGroups(data || []);
      
      if (data && data.length > 0) {
        toast.success(`Encontrados ${data.length} grupos de questões duplicadas`);
      } else {
        toast.info("Nenhuma questão duplicada encontrada");
      }
    } catch (error: any) {
      console.error('Error scanning duplicates:', error);
      toast.error("Erro ao escanear duplicatas: " + error.message);
    } finally {
      setScanning(false);
    }
  };

  const mergeAllDuplicates = async () => {
    setMergingAll(true);
    let totalMerged = 0;
    let totalGroups = 0;
    let hasMore = true;
    let batchCount = 0;
    
    try {
      // Get total count first
      const { data: totalCount } = await supabase.rpc('count_duplicate_groups');
      const initialTotal = totalCount || duplicateGroups.length;
      setMergeProgress({ current: 0, total: initialTotal });
      
      // Process in batches until no more duplicates
      while (hasMore && batchCount < 100) { // Safety limit of 100 batches (10000 groups max)
        batchCount++;
        const { data, error } = await supabase.rpc('merge_all_duplicates');
        
        if (error) throw error;
        
        const result = data as { success: boolean; groups_merged: number; questions_merged: number; has_more: boolean };
        
        if (result.groups_merged === 0) break;
        
        totalMerged += result.questions_merged;
        totalGroups += result.groups_merged;
        hasMore = result.has_more;
        
        setMergeProgress({ current: totalGroups, total: initialTotal });
        
        // Show progress toast every 10 batches
        if (batchCount % 10 === 0) {
          toast.info(`Progresso: ${totalGroups}/${initialTotal} grupos mesclados...`);
        }
      }
      
      if (totalGroups > 0) {
        toast.success(`Mesclados ${totalGroups} grupos com ${totalMerged} questões duplicadas!`);
        setDuplicateGroups([]);
      } else {
        toast.info("Nenhuma duplicata para mesclar");
      }
    } catch (error: any) {
      console.error('Error merging all duplicates:', error);
      toast.error("Erro ao mesclar duplicatas: " + error.message);
    } finally {
      setMergingAll(false);
      setMergeProgress({ current: 0, total: 0 });
    }
  };

  const loadGroupQuestions = async (group: DuplicateGroup) => {
    setSelectedGroup(group);
    setLoadingQuestions(true);
    
    try {
      const { data: questions, error } = await supabase
        .from('questions')
        .select(`
          id,
          code,
          question,
          answer,
          created_at,
          study_discipline_id,
          study_topic_id,
          study_disciplines:study_discipline_id(name),
          study_topics:study_topic_id(name)
        `)
        .in('id', group.question_ids)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const formattedQuestions = (questions || []).map((q: any) => ({
        id: q.id,
        code: q.code,
        question: q.question,
        answer: q.answer,
        created_at: q.created_at,
        study_discipline_id: q.study_discipline_id,
        study_topic_id: q.study_topic_id,
        discipline_name: q.study_disciplines?.name,
        topic_name: q.study_topics?.name,
      }));
      
      setGroupQuestions(formattedQuestions);
    } catch (error: any) {
      console.error('Error loading questions:', error);
      toast.error("Erro ao carregar questões: " + error.message);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const mergeQuestions = async () => {
    if (!selectedGroup || groupQuestions.length < 2) return;
    
    setMerging(true);
    try {
      // Keep the newest (first in array, sorted by created_at DESC)
      const keepQuestion = groupQuestions[0];
      const removeQuestionIds = groupQuestions.slice(1).map(q => q.id);
      
      const { data, error } = await supabase.rpc('merge_duplicate_questions', {
        keep_question_id: keepQuestion.id,
        remove_question_ids: removeQuestionIds
      });
      
      if (error) throw error;
      
      toast.success(`Questões mescladas com sucesso! Mantida: ${keepQuestion.code}`);
      
      // Remove the merged group from the list
      setDuplicateGroups(prev => prev.filter(g => g.duplicate_hash !== selectedGroup.duplicate_hash));
      setSelectedGroup(null);
      setGroupQuestions([]);
    } catch (error: any) {
      console.error('Error merging questions:', error);
      toast.error("Erro ao mesclar questões: " + error.message);
    } finally {
      setMerging(false);
    }
  };

  const totalDuplicates = duplicateGroups.reduce((acc, g) => acc + g.question_count - 1, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Detecção de Questões Duplicadas
            </CardTitle>
            <CardDescription>
              Identifique e mescle questões duplicadas mantendo a mais recente e transferindo os vínculos
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="duplicates" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Duplicatas
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico de Mesclagem
            </TabsTrigger>
          </TabsList>

          <TabsContent value="duplicates">
            <div className="flex gap-2 mb-4">
              <Button onClick={scanForDuplicates} disabled={scanning || mergingAll}>
                {scanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Escaneando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Escanear Duplicatas
                  </>
                )}
              </Button>
              {duplicateGroups.length > 0 && (
                <Button 
                  onClick={mergeAllDuplicates} 
                  disabled={mergingAll || scanning}
                  variant="default"
                >
                  {mergingAll ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Mesclando... {mergeProgress.current > 0 ? `(${mergeProgress.current}/${mergeProgress.total})` : ''}
                    </>
                  ) : (
                    <>
                      <Merge className="mr-2 h-4 w-4" />
                      Mesclar Todas ({totalDuplicates})
                    </>
                  )}
                </Button>
              )}
            </div>

            {duplicateGroups.length > 0 && (
              <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">
                    Encontrados {duplicateGroups.length} grupos com {totalDuplicates} questões duplicadas
                  </span>
                </div>
              </div>
            )}

            {duplicateGroups.length === 0 && !scanning && (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>Clique em "Escanear Duplicatas" para verificar questões repetidas</p>
              </div>
            )}

            {duplicateGroups.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Qtd. Questões</TableHead>
                    <TableHead>Primeiros 100 caracteres</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duplicateGroups.map((group, index) => (
                    <TableRow key={group.duplicate_hash}>
                      <TableCell>
                        <Badge variant="outline">Grupo {index + 1}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">{group.question_count} duplicatas</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md truncate" title={group.duplicate_hash}>
                        {group.duplicate_hash.length > 60 ? group.duplicate_hash.substring(0, 60) + '...' : group.duplicate_hash}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadGroupQuestions(group)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="history">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">
                Últimas 100 mesclagens realizadas
              </p>
              <Button variant="outline" size="sm" onClick={fetchMergeHistory} disabled={loadingHistory}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            {loadingHistory ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : mergeHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum histórico de mesclagem encontrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Questão Mantida</TableHead>
                    <TableHead>Questões Removidas</TableHead>
                    <TableHead>Total Mescladas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mergeHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm">
                        {new Date(item.merged_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {item.kept_question_code}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {item.removed_question_ids.length} questão(ões)
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.questions_count}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialog for viewing and merging duplicates */}
        <Dialog open={!!selectedGroup} onOpenChange={(open) => !open && setSelectedGroup(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Questões Duplicadas</DialogTitle>
              <DialogDescription>
                A questão mais recente (primeira da lista) será mantida. As demais serão desativadas e seus vínculos transferidos.
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[60vh]">
              {loadingQuestions ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {groupQuestions.map((question, index) => (
                    <QuestionPreviewCard 
                      key={question.id} 
                      question={question} 
                      isKeep={index === 0}
                      onPreview={() => setPreviewQuestion(question)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedGroup(null)}>
                Cancelar
              </Button>
              <Button 
                onClick={mergeQuestions} 
                disabled={merging || groupQuestions.length < 2}
                className="bg-primary"
              >
                {merging ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mesclando...
                  </>
                ) : (
                  <>
                    <Merge className="mr-2 h-4 w-4" />
                    Mesclar Questões
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Full question preview dialog */}
        <Dialog open={!!previewQuestion} onOpenChange={(open) => !open && setPreviewQuestion(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Visualização da Questão</DialogTitle>
            </DialogHeader>
            {previewQuestion && (
              <ScrollArea className="max-h-[70vh]">
                <QuestionFullPreview question={previewQuestion} />
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function QuestionPreviewCard({ 
  question, 
  isKeep, 
  onPreview 
}: { 
  question: QuestionDetail; 
  isKeep: boolean;
  onPreview: () => void;
}) {
  const sanitizedQuestion = useSanitizedHTML(question.question.substring(0, 200) + '...');
  
  return (
    <div className={`p-4 rounded-lg border ${isKeep ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-destructive/50 bg-destructive/5'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={isKeep ? "default" : "destructive"}>
              {isKeep ? "MANTER" : "REMOVER"}
            </Badge>
            <span className="font-mono text-sm">{question.code}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(question.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
          
          <div 
            className="text-sm text-muted-foreground line-clamp-2"
            dangerouslySetInnerHTML={{ __html: sanitizedQuestion }}
          />
          
          <div className="flex gap-2 mt-2">
            {question.discipline_name && (
              <Badge variant="outline" className="text-xs">
                {question.discipline_name}
              </Badge>
            )}
            {question.topic_name && (
              <Badge variant="secondary" className="text-xs">
                {question.topic_name}
              </Badge>
            )}
          </div>
        </div>
        
        <Button variant="ghost" size="sm" onClick={onPreview}>
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function QuestionFullPreview({ question }: { question: QuestionDetail }) {
  const sanitizedQuestion = useSanitizedHTML(question.question);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="font-mono font-bold">{question.code}</span>
        <span className="text-sm text-muted-foreground">
          Criada em: {new Date(question.created_at).toLocaleString('pt-BR')}
        </span>
      </div>
      
      <div className="flex gap-2">
        {question.discipline_name && (
          <Badge variant="outline">{question.discipline_name}</Badge>
        )}
        {question.topic_name && (
          <Badge variant="secondary">{question.topic_name}</Badge>
        )}
      </div>
      
      <div 
        className="prose dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: sanitizedQuestion }}
      />
      
      <div className="mt-4 p-3 bg-muted rounded-lg">
        <span className="font-medium">Resposta correta: </span>
        <Badge variant="default">{question.answer}</Badge>
      </div>
    </div>
  );
}
