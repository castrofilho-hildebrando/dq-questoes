import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, FileQuestion, BookOpen } from "lucide-react";
import { QuestionCard } from "@/components/questions/QuestionCard";
import { QuestionPagination } from "@/components/questions/QuestionPagination";
import { AddToNotebookDialog } from "@/components/questions/AddToNotebookDialog";
import { CreateNoteDialog } from "@/components/questions/CreateNoteDialog";
import { Question } from "@/hooks/useQuestions";
import { toast } from "sonner";
interface NotebookInfo {
  id: string;
  name: string;
  description: string | null;
  question_count: number;
}

const QUESTIONS_PER_PAGE = 20;

export default function CadernoQuestoes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  const fromCronograma = searchParams.get("fromCronograma") === "true";
  
  // targetUserId: when admin views student's cronograma, use student's ID for queries
  const targetUserId = searchParams.get("targetUserId");
  
  const notebookIds =
    searchParams
      .get("notebookIds")
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) || [];

  const handleBack = () => {
    if (fromCronograma) {
      window.close();
    } else {
      navigate(-1);
    }
  };

  const [notebooks, setNotebooks] = useState<NotebookInfo[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allQuestionIds, setAllQuestionIds] = useState<string[]>([]);
  
  // V8 FIX: Persist answerMap for global filtering (question_id → is_correct)
  const [answerMap, setAnswerMap] = useState<Map<string, boolean>>(new Map());
  
  const [globalStats, setGlobalStats] = useState<{
    total: number;
    resolved: number;
    correct: number;
    incorrect: number;
  }>({ total: 0, resolved: 0, correct: 0, incorrect: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filter status state
  const [statusFilter, setStatusFilter] = useState<'all' | 'resolved' | 'unresolved' | 'correct' | 'incorrect'>('all');
  
  // Dialog state for notebooks and notes
  const [notebookDialogOpen, setNotebookDialogOpen] = useState(false);
  const [questionToAdd, setQuestionToAdd] = useState<string | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [questionForNote, setQuestionForNote] = useState<Question | null>(null);
  // Track if initial load is done
  const initialLoadDone = useRef(false);
  const notebookIdsKey = notebookIds.join(",");
  
  // V8 FIX: Derive filtered IDs from allQuestionIds + answerMap based on statusFilter
  const getFilteredIds = useCallback(() => {
    switch (statusFilter) {
      case 'resolved':
        return allQuestionIds.filter(id => answerMap.has(id));
      case 'unresolved':
        return allQuestionIds.filter(id => !answerMap.has(id));
      case 'correct':
        return allQuestionIds.filter(id => answerMap.get(id) === true);
      case 'incorrect':
        return allQuestionIds.filter(id => answerMap.get(id) === false);
      default:
        return allQuestionIds;
    }
  }, [allQuestionIds, answerMap, statusFilter]);
  
  // V8 FIX: filteredQuestionIds is the base for pagination
  const filteredQuestionIds = getFilteredIds();
  const totalCount = filteredQuestionIds.length;
  const totalPages = Math.ceil(totalCount / QUESTIONS_PER_PAGE);

  // Initial load: fetch notebooks and all question IDs (only once)
  useEffect(() => {
    if (notebookIds.length > 0 && user && !initialLoadDone.current) {
      initialLoadDone.current = true;
      loadNotebooksAndAllQuestionIds();
    } else if (!authLoading && user && notebookIds.length === 0) {
      setIsLoading(false);
    }
  }, [notebookIdsKey, user, authLoading]);

  // V9 FIX: Load paginated questions based on FILTERED IDs, but do NOT depend
  // on filteredQuestionIds.length — that changes when answerMap updates after
  // submitting an answer, which would cause questions to disappear before the
  // student can see the result/comment. Instead, depend on allQuestionIds.length
  // (stable after initial load) + statusFilter + currentPage (user-driven changes).
  useEffect(() => {
    const ids = getFilteredIds();
    if (ids.length > 0 && user) {
      loadPaginatedQuestions(ids);
    } else if (allQuestionIds.length > 0 && ids.length === 0) {
      // Filter resulted in empty set - clear questions
      setQuestions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter, allQuestionIds.length, user?.id]);
  
  // V8 FIX: Reset page to 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  const loadNotebooksAndAllQuestionIds = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      console.log('[CadernoQuestoes] Loading notebooks:', notebookIds);
      
      // Try admin notebooks first - explicitly filter by is_active
      let { data: notebookData, error: notebookError } = await supabase
        .from("admin_question_notebooks")
        .select("id, name, description, is_active")
        .in("id", notebookIds)
        .eq("is_active", true);

      console.log('[CadernoQuestoes] Admin notebooks query result:', {
        found: notebookData?.length || 0,
        requested: notebookIds.length,
        error: notebookError?.message || null,
        notebooks: notebookData?.map(n => ({ id: n.id, name: n.name }))
      });

      // If no admin notebooks found, try user notebooks
      if (!notebookData || notebookData.length === 0) {
        console.log('[CadernoQuestoes] No admin notebooks found, trying user notebooks...');
        
        const { data: userNotebookData, error: userNotebookError } = await supabase
          .from("study_notebooks")
          .select("id, name, description")
          .in("id", notebookIds)
          .eq("user_id", user.id);

        console.log('[CadernoQuestoes] User notebooks query result:', {
          found: userNotebookData?.length || 0,
          error: userNotebookError?.message || null
        });

        if (userNotebookError) throw userNotebookError;
        
        if (userNotebookData && userNotebookData.length > 0) {
          // Get question IDs from user notebooks - INNER JOIN with questions to filter only active
          const { data: notebookQuestions, error: notebookQuestionsError } =
            await supabase
              .from("notebook_questions")
              .select("notebook_id, question_id, questions!inner(is_active)")
              .in("notebook_id", notebookIds)
              .eq("questions.is_active", true)
              .order("display_order", { ascending: true });

          if (notebookQuestionsError) throw notebookQuestionsError;

          // Recalculate question_count based on ACTIVE questions only
          const counts = new Map<string, number>();
          for (const row of (notebookQuestions || []) as any[]) {
            counts.set(row.notebook_id, (counts.get(row.notebook_id) || 0) + 1);
          }
          
          const notebooksWithCount = userNotebookData.map(nb => ({
            ...nb,
            question_count: counts.get(nb.id) || 0
          }));
          setNotebooks(notebooksWithCount);

          if (!notebookQuestions || notebookQuestions.length === 0) {
            console.log('[CadernoQuestoes] No questions found in user notebooks');
            setQuestions([]);
            setAllQuestionIds([]);
            setAnswerMap(new Map());
            setIsLoading(false);
            return;
          }

          const rawIds = (notebookQuestions as any[]).map((nq) => nq.question_id);
          const questionIds = [...new Set(rawIds)];
          console.log('[CadernoQuestoes] Found', questionIds.length, 'unique questions in user notebooks (raw:', rawIds.length, ')');
          setAllQuestionIds(questionIds);
          await fetchGlobalStats(questionIds);
          // V8 FIX: Don't call loadPaginatedQuestions here, useEffect will handle it
          return;
        } else {
          // Neither admin nor user notebooks found - show helpful error
          console.error('[CadernoQuestoes] CRITICAL: No notebooks found for IDs:', notebookIds);
          toast.error("Caderno não encontrado. Os cadernos podem ter sido desativados ou removidos.");
          setNotebooks([]);
          setQuestions([]);
          setAllQuestionIds([]);
          setAnswerMap(new Map());
          setIsLoading(false);
          return;
        }
      }

      if (notebookError) throw notebookError;

      if (notebookData && notebookData.length > 0) {
        // Get question IDs from admin notebooks - INNER JOIN with questions to filter only active
        const { data: notebookQuestions, error: notebookQuestionsError } =
          await supabase
            .from("admin_notebook_questions")
            .select("notebook_id, question_id, questions!inner(is_active)")
            .in("notebook_id", notebookIds)
            .eq("questions.is_active", true)
            .is("deleted_at", null)
            .order("display_order", { ascending: true });

        console.log('[CadernoQuestoes] Admin notebook questions query result:', {
          found: notebookQuestions?.length || 0,
          error: notebookQuestionsError?.message || null
        });

        if (notebookQuestionsError) throw notebookQuestionsError;

        // Recalculate question_count based on ACTIVE questions only
        const counts = new Map<string, number>();
        for (const row of (notebookQuestions || []) as any[]) {
          counts.set(row.notebook_id, (counts.get(row.notebook_id) || 0) + 1);
        }
        
        const notebooksWithCount = notebookData.map(nb => ({
          ...nb,
          question_count: counts.get(nb.id) || 0
        }));
        setNotebooks(notebooksWithCount);

        if (!notebookQuestions || notebookQuestions.length === 0) {
          console.warn('[CadernoQuestoes] Notebooks exist but have no active questions');
          toast.error("Este caderno não possui questões ativas no momento.");
          setQuestions([]);
          setAllQuestionIds([]);
          setAnswerMap(new Map());
          setIsLoading(false);
          return;
        }

        const rawIds = (notebookQuestions as any[]).map((nq) => nq.question_id);
        // CRITICAL: deduplicate question IDs - goals with multiple notebook_ids
        // (e.g. "Código de Ética" or "Categorias de Análise da Geografia")
        // can reference the same questions in different notebooks, causing inflated
        // totals and broken filters/pagination.
        const questionIds = [...new Set(rawIds)];
        console.log('[CadernoQuestoes] Found', questionIds.length, 'unique questions in admin notebooks (raw:', rawIds.length, ')');
        setAllQuestionIds(questionIds);
        await fetchGlobalStats(questionIds);
        // V8 FIX: Don't call loadPaginatedQuestions here, useEffect will handle it
      } else {
        console.log('[CadernoQuestoes] No notebooks data to process');
        setNotebooks([]);
        setQuestions([]);
        setAllQuestionIds([]);
        setAnswerMap(new Map());
      }
    } catch (error) {
      console.error("[CadernoQuestoes] Error loading notebook questions:", error);
      toast.error("Erro ao carregar questões do caderno. Por favor, tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadPaginatedQuestions = async (questionIds: string[]) => {
    if (!user || questionIds.length === 0) return;

    // Paginate
    const startIndex = (currentPage - 1) * QUESTIONS_PER_PAGE;
    const endIndex = startIndex + QUESTIONS_PER_PAGE;
    const paginatedIds = questionIds.slice(startIndex, endIndex);

    const { data: questionsData, error: questionsError } = await supabase
      .from("questions_for_students")
      .select(
        `
        id, code, question, associated_text, images, option_a, option_b, option_c, option_d, option_e,
        question_type, difficulty, keys, related_contents, year,
        banca_id, orgao_id, prova_id, study_discipline_id, study_topic_id,
        position_id, is_active, created_at, updated_at,
        bancas(name),
        orgaos(name),
        provas(name),
        study_disciplines(name),
        study_topics(name)
      `
      )
      .in("id", paginatedIds);

    if (questionsError) throw questionsError;

    // Fetch N:N disciplines and topics
    const [disciplinesRes, topicsRes] = await Promise.all([
      supabase
        .from('question_disciplines')
        .select('question_id, study_disciplines(id, name)')
        .in('question_id', paginatedIds),
      supabase
        .from('question_topics')
        .select('question_id, study_topics(id, name)')
        .in('question_id', paginatedIds)
    ]);

    const questionDisciplines = (disciplinesRes.data || []) as any[];
    const questionTopics = (topicsRes.data || []) as any[];

    // Get user answers - use targetUserId when admin views student's cronograma
    // CRITICAL: order by answered_at DESC to ensure we get the MOST RECENT answer for each question
    const effectiveUserId = targetUserId || user.id;
    const { data: answersData } = await supabase
      .from("user_answers")
      .select("question_id, is_correct, answered_at")
      .eq("user_id", effectiveUserId)
      .in("question_id", paginatedIds)
      .order("answered_at", { ascending: false });
    
    // Build a map with only the LATEST answer per question_id
    // Since we ordered by answered_at DESC, the first occurrence is the most recent
    const latestAnswerByQuestion = new Map<string, boolean>();
    for (const answer of (answersData || [])) {
      if (!latestAnswerByQuestion.has(answer.question_id)) {
        latestAnswerByQuestion.set(answer.question_id, answer.is_correct);
      }
    }
    
    console.log('[CadernoQuestoes] Paginated answers:', answersData?.length, 'raw,', latestAnswerByQuestion.size, 'unique questions');

    // Maintain order from notebook and map to Question type
    const orderedQuestions: Question[] = paginatedIds
      .map(id => questionsData?.find(q => q.id === id))
      .filter(Boolean)
      .map(q => {
        // Use the latest answer from the map
        const isAnswered = latestAnswerByQuestion.has(q!.id);
        const isCorrect = latestAnswerByQuestion.get(q!.id);
        
        // Get all disciplines for this question from N:N table
        const allDisciplines = questionDisciplines
          .filter(qd => qd.question_id === q!.id && qd.study_disciplines)
          .map(qd => qd.study_disciplines);
        
        // Get all topics for this question from N:N table
        const allTopics = questionTopics
          .filter(qt => qt.question_id === q!.id && qt.study_topics)
          .map(qt => qt.study_topics);
        
        return {
          ...q!,
          banca_name: (q as any).bancas?.name,
          orgao_name: (q as any).orgaos?.name,
          prova_name: (q as any).provas?.name,
          discipline_name: (q as any).study_disciplines?.name,
          topic_name: (q as any).study_topics?.name,
          all_disciplines: allDisciplines.length > 0 ? allDisciplines : ((q as any).study_disciplines ? [{ id: q!.study_discipline_id, name: (q as any).study_disciplines.name }] : []),
          all_topics: allTopics.length > 0 ? allTopics : ((q as any).study_topics ? [{ id: q!.study_topic_id, name: (q as any).study_topics.name }] : []),
          user_answered: isAnswered,
          user_is_correct: isCorrect,
        } as Question;
      });

    setQuestions(orderedQuestions);
  };

  const fetchGlobalStats = async (questionIds: string[]) => {
    if (!user || questionIds.length === 0) {
      setGlobalStats({ total: questionIds.length, resolved: 0, correct: 0, incorrect: 0 });
      return;
    }
    
    try {
      // Use targetUserId when admin views student's cronograma
      const effectiveUserId = targetUserId || user.id;
      console.log('[CadernoQuestoes] Fetching stats for', questionIds.length, 'questions, userId:', effectiveUserId, '(targetUserId:', targetUserId, ')');
      
      // For large question sets, we need to batch the query to avoid hitting limits
      // Supabase has a default limit of 1000 rows, and IN clause can be problematic with many IDs
      // CRITICAL: order by answered_at DESC to ensure we get the MOST RECENT answer for each question
      const BATCH_SIZE = 500;
      const allAnswers: { question_id: string; is_correct: boolean; answered_at: string }[] = [];
      
      for (let i = 0; i < questionIds.length; i += BATCH_SIZE) {
        const batchIds = questionIds.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase
          .from("user_answers")
          .select("question_id, is_correct, answered_at")
          .eq("user_id", effectiveUserId)
          .in("question_id", batchIds)
          .order("answered_at", { ascending: false })
          .limit(5000);
        
        if (error) {
          console.error('[CadernoQuestoes] Error fetching batch:', error);
          throw error;
        }
        
        if (data) {
          allAnswers.push(...data);
        }
      }
      
      console.log('[CadernoQuestoes] Found', allAnswers.length, 'raw answers');
      
      // Sort ALL answers by answered_at DESC to ensure global ordering across batches
      allAnswers.sort((a, b) => new Date(b.answered_at).getTime() - new Date(a.answered_at).getTime());
      
      // Build map with only the LATEST answer per question_id
      // Since we sorted by answered_at DESC, the first occurrence is the most recent
      const answeredMap = new Map<string, boolean>();
      for (const answer of allAnswers) {
        if (!answeredMap.has(answer.question_id)) {
          answeredMap.set(answer.question_id, answer.is_correct);
        }
      }
      
      const resolved = answeredMap.size;
      const correct = Array.from(answeredMap.values()).filter(isCorrect => isCorrect).length;
      
      console.log('[CadernoQuestoes] Stats (using latest answers):', { 
        total: questionIds.length, 
        resolved, 
        correct, 
        incorrect: resolved - correct,
        rawAnswers: allAnswers.length,
        uniqueQuestions: answeredMap.size 
      });
      
      // V8 FIX: Persist answerMap in state for global filtering
      setAnswerMap(answeredMap);
      
      setGlobalStats({
        total: questionIds.length,
        resolved,
        correct,
        incorrect: resolved - correct,
      });
    } catch (error) {
      console.error("Error fetching global stats:", error);
      setAnswerMap(new Map());
      setGlobalStats({ total: questionIds.length, resolved: 0, correct: 0, incorrect: 0 });
    }
  };

  const handleSubmitAnswer = async (questionId: string, selectedAnswer: string) => {
    if (!user) {
      toast.error("Faça login para responder questões");
      return null;
    }

    try {
      const { data: checkResult, error: checkError } = await supabase
        .rpc('check_answer', {
          question_id: questionId,
          user_answer: selectedAnswer
        });

      if (checkError) throw checkError;

      const result = checkResult as { is_correct: boolean; correct_answer: string; prof_comment: string | null; error?: string };
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Insert user answer
      await supabase.from('user_answers').insert({
        user_id: user.id,
        question_id: questionId,
        selected_answer: selectedAnswer,
        is_correct: result.is_correct,
      });

      // V8 FIX: Update answerMap and globalStats immediately after answer
      setAnswerMap(prev => {
        const newMap = new Map(prev);
        newMap.set(questionId, result.is_correct);
        return newMap;
      });

      // V10 FIX: Update questions array so the "Resolvida Certa/Errada" badge appears immediately
      setQuestions(prev => prev.map(q =>
        q.id === questionId
          ? { ...q, user_answered: true, user_is_correct: result.is_correct }
          : q
      ));
      
      // V8 FIX: Recalculate globalStats from updated answerMap
      setGlobalStats(prev => {
        const wasAnswered = answerMap.has(questionId);
        const wasCorrect = answerMap.get(questionId);
        
        let newResolved = prev.resolved;
        let newCorrect = prev.correct;
        
        if (!wasAnswered) {
          // First time answering this question
          newResolved = prev.resolved + 1;
          if (result.is_correct) {
            newCorrect = prev.correct + 1;
          }
        } else {
          // Re-answering - update correct count if changed
          if (wasCorrect && !result.is_correct) {
            newCorrect = prev.correct - 1;
          } else if (!wasCorrect && result.is_correct) {
            newCorrect = prev.correct + 1;
          }
        }
        
        return {
          ...prev,
          resolved: newResolved,
          correct: newCorrect,
          incorrect: newResolved - newCorrect,
        };
      });

      return {
        isCorrect: result.is_correct,
        correctAnswer: result.correct_answer,
        profComment: result.prof_comment || ""
      };
    } catch (error) {
      console.error("Error submitting answer:", error);
      toast.error("Erro ao salvar resposta");
      return null;
    }
  };

  // V8 FIX: REMOVED the useEffect that filtered paginated questions
  // Now filtering is done at the ID level via getFilteredIds() before pagination
  
  const handleAddToNotebook = (questionId: string) => {
    setQuestionToAdd(questionId);
    setNotebookDialogOpen(true);
  };

  const handleCreateNote = (question: Question) => {
    setQuestionForNote(question);
    setNoteDialogOpen(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="font-heading text-xl font-bold">Caderno de Questões</h1>
                  <p className="text-sm text-muted-foreground">Resolver questões do caderno</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Notebook Info */}
          {notebooks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {notebooks.map(nb => (
                <Badge key={nb.id} variant="secondary" className="text-sm py-1 px-3">
                  <FileQuestion className="h-3 w-3 mr-1" />
                  {nb.name} ({nb.question_count} questões)
                </Badge>
              ))}
            </div>
          )}

          {/* Question count */}
          <p className="text-muted-foreground">
            {totalCount > 0 
              ? `${totalCount.toLocaleString()} questões neste caderno`
              : 'Nenhuma questão encontrada'
            }
          </p>

          {/* Status Filters */}
          {totalCount > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                Todas ({globalStats.total})
              </Button>
              <Button
                variant={statusFilter === 'resolved' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('resolved')}
              >
                Resolvidas ({globalStats.resolved})
              </Button>
              <Button
                variant={statusFilter === 'unresolved' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('unresolved')}
              >
                Não resolvidas ({globalStats.total - globalStats.resolved})
              </Button>
              <Button
                variant={statusFilter === 'correct' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('correct')}
              >
                Acertei ({globalStats.correct})
              </Button>
              <Button
                variant={statusFilter === 'incorrect' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('incorrect')}
              >
                Errei ({globalStats.incorrect})
              </Button>
            </div>
          )}

          {/* Questions List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Carregando questões...</p>
            </div>
          ) : notebookIds.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                <FileQuestion className="h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">Nenhum caderno especificado</p>
                <p className="text-muted-foreground text-center max-w-md">
                  Acesse um caderno pela página de Meus Cadernos para visualizar as questões.
                </p>
                <Button onClick={() => navigate("/cadernos")}>
                  Ir para Meus Cadernos
                </Button>
              </CardContent>
            </Card>
          ) : questions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                <FileQuestion className="h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">
                  {filteredQuestionIds.length === 0 && statusFilter !== 'all'
                    ? 'Nenhuma questão com esse filtro' 
                    : 'Nenhuma questão encontrada'
                  }
                </p>
                <p className="text-muted-foreground text-center max-w-md">
                  {filteredQuestionIds.length === 0 && statusFilter !== 'all'
                    ? 'Tente alterar o filtro de status acima.'
                    : 'Este caderno ainda não possui questões vinculadas.'
                  }
                </p>
                {statusFilter !== 'all' && (
                  <Button variant="outline" onClick={() => setStatusFilter('all')}>
                    Ver todas as questões
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {questions.map((question, index) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  index={((currentPage - 1) * QUESTIONS_PER_PAGE) + index}
                  onSubmitAnswer={handleSubmitAnswer}
                  onAddToNotebook={handleAddToNotebook}
                  onCreateNote={handleCreateNote}
                />
              ))}
            </div>
          )}

          {/* Pagination - V8 FIX: uses filteredQuestionIds.length as totalCount */}
          {!isLoading && questions.length > 0 && totalPages > 1 && (
            <QuestionPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      </main>

      {/* Add to Notebook Dialog */}
      <AddToNotebookDialog
        open={notebookDialogOpen}
        onOpenChange={setNotebookDialogOpen}
        questionId={questionToAdd}
      />

      {/* Create Note Dialog */}
      <CreateNoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        question={questionForNote}
      />
    </div>
  );
}
