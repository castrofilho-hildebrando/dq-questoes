import ConselhoThemeWrapper from "@/components/ConselhoThemeWrapper";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Lock, ArrowLeft, Shield } from "lucide-react";
import { useQuestionsRpc, USE_RPC_SEARCH_FLAG } from "@/hooks/useQuestionsRpc";
import type { Question } from "@/hooks/useQuestions";
import { QuestionCard } from "@/components/questions/QuestionCard";
import { QuestionFilters } from "@/components/questions/QuestionFilters";
import { QuestionPagination } from "@/components/questions/QuestionPagination";
import { AddToNotebookDialog } from "@/components/questions/AddToNotebookDialog";
import { CreateNoteDialog } from "@/components/questions/CreateNoteDialog";
import { SchoolSelector } from "@/components/questions/SchoolSelector";
import { QuestionListSkeleton } from "@/components/questions/QuestionSkeleton";
import { QuestionBankDebugBadge } from "@/components/debug/QuestionBankDebugBadge";
import { TutorialActionCard } from "@/components/TutorialActionCard";
import {
  getAsPath,
  isDefaultFilters,
  serializeFilters,
  summarizeFilters,
} from "@/debug/questionBankDebug";
import { useQuestionBankDebugInstrumentation } from "@/hooks/debug/useQuestionBankDebugInstrumentation";

export default function BancoQuestoes() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, isAdmin } = useAuth();
  

  const debugEnabled = false; // Debug badge desabilitado
  const { log: debugLog, logsRef: debugLogsRef } = useQuestionBankDebugInstrumentation({
    enabled: debugEnabled,
    scope: "BancoQuestoes",
    userEmail: user?.email ?? null,
  });

  const [debugLastChangeAt, setDebugLastChangeAt] = useState<number | null>(null);
  const [debugResetCount, setDebugResetCount] = useState(0);
  const prevSnapshotRef = useRef<{
    filtersSig: string;
    page: number;
    selectedSchoolId: string | null;
    selectedEditalId: string | null;
    isDefault: boolean;
  } | null>(null);

  // Get search parameter from URL
  const urlSearch = searchParams.get('search') || '';
  const returnTo = searchParams.get('returnTo');
  
  // Detectar parâmetros de URL do cronograma
  const urlSchoolId = searchParams.get('schoolId');
  const urlEditalId = searchParams.get('editalId');
  const urlTopicId = searchParams.get('topicId');
  const urlDisciplineId = searchParams.get('disciplineId');
  const hasUrlParams = !!(urlSchoolId || urlEditalId || urlTopicId || urlDisciplineId);
  
  const { goBack } = useBackNavigation();
  const handleBack = () => {
    if (returnTo) {
      navigate(returnTo);
    } else {
      goBack();
    }
  };

  // School/Edital selection state
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [selectedEditalId, setSelectedEditalId] = useState<string | null>(null);
  const [isPreEdital, setIsPreEdital] = useState<boolean>(true);

  // Dialog state - MUST be before any conditional returns to comply with React hooks rules
  const [notebookDialogOpen, setNotebookDialogOpen] = useState(false);
  const [questionToAdd, setQuestionToAdd] = useState<string | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [questionForNote, setQuestionForNote] = useState<Question | null>(null);


  const routeLabel = useMemo(() => `${location.pathname}${location.search}`, [location.pathname, location.search]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  // Enable questions when either school or edital is selected
  const hasSelection = !!selectedSchoolId || !!selectedEditalId;

  const {
    questions,
    isLoading,
    currentPage,
    totalPages,
    totalCount,
    pendingFilters,
    hasPendingChanges,
    globalStats,
    bancas,
    orgaos,
    provas,
    disciplines,
    topics,
    years,
    loadQuestions,
    submitAnswer,
    clearFilters,
    updateFilter,
    toggleArrayFilter,
    applyFilters,
    setSchoolId,
    setEditalId,
    hydrateState,
    perfTracker,
    setLoadTrigger,
  } = useQuestionsRpc(urlSearch, { enabled: hasSelection, debugLog: debugEnabled ? debugLog : undefined, perfEnabled: debugEnabled });

  // Track render timing for perf metrics
  const prevIsLoadingRef = useRef(isLoading);
  useEffect(() => {
    if (prevIsLoadingRef.current && !isLoading && questions.length > 0) {
      // Loading just finished - mark render
      perfTracker.markRenderStart();
      requestAnimationFrame(() => {
        perfTracker.markRenderEnd();
        perfTracker.finalize();
      });
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading, questions.length, perfTracker]);

  const filtersSummary = useMemo(() => summarizeFilters(pendingFilters), [pendingFilters]);
  const filtersSig = useMemo(() => serializeFilters(pendingFilters), [pendingFilters]);

  const markDebugChange = useCallback(
    (reason: string, extra?: unknown) => {
      if (!debugEnabled) return;
      const ts = Date.now();
      setDebugLastChangeAt(ts);
      debugLog("CHANGE", { reason, ts, extra });
    },
    [debugEnabled, debugLog]
  );

  // Debug: mount/unmount
  useEffect(() => {
    debugLog("MOUNT", {
      route: routeLabel,
      href: window.location.href,
      asPath: getAsPath(),
    });
    return () => {
      debugLog("UNMOUNT", {
        route: routeLabel,
        href: window.location.href,
        asPath: getAsPath(),
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debug: route/querystring changes
  useEffect(() => {
    debugLog("ROUTE_OR_QUERY_CHANGE", {
      route: routeLabel,
      href: window.location.href,
      asPath: getAsPath(),
    });
    markDebugChange("route/query");
  }, [routeLabel, debugLog, markDebugChange]);

  // Inicialização via parâmetros de URL (links do cronograma)
  const urlInitDone = useRef(false);
  useEffect(() => {
    if (authLoading || !user || urlInitDone.current) return;
    if (!hasUrlParams) return;
    
    urlInitDone.current = true;
    
    const isPre = !urlSchoolId;
    
    // Set local selection state
    if (urlSchoolId) {
      setSelectedSchoolId(urlSchoolId);
      setIsPreEdital(false);
    }
    if (urlEditalId) {
      setSelectedEditalId(urlEditalId);
      setIsPreEdital(isPre);
    }
    
    // Hidratar o hook com os parâmetros de URL
    hydrateState({
      schoolId: urlSchoolId || null,
      editalId: urlEditalId || null,
      isPreEdital: isPre,
      filters: {
        disciplines: urlDisciplineId ? [urlDisciplineId] : [],
        topics: urlTopicId ? [urlTopicId] : [],
      },
    });
  }, [authLoading, user, hasUrlParams, urlSchoolId, urlEditalId, urlTopicId, urlDisciplineId, hydrateState]);


  // Debug: selection changes
  useEffect(() => {
    debugLog("SELECTION_CHANGE", {
      selectedSchoolId,
      selectedEditalId,
      isPreEdital,
    });
    markDebugChange("selection");
  }, [selectedSchoolId, selectedEditalId, isPreEdital, debugLog, markDebugChange]);

  // Debug: filters + pagination changes
  useEffect(() => {
    debugLog("FILTERS_CHANGE", {
      summary: filtersSummary,
      sig: filtersSig,
    });
    markDebugChange("filters", { summary: filtersSummary });
  }, [filtersSig, filtersSummary, debugLog, markDebugChange]);

  useEffect(() => {
    debugLog("PAGINATION_CHANGE", { currentPage, totalPages, totalCount });
    markDebugChange("pagination", { currentPage, totalPages });
  }, [currentPage, totalPages, totalCount, debugLog, markDebugChange]);

  // Debug: heurística de reset (sem ação explícita do usuário)
  useEffect(() => {
    if (!debugEnabled) return;

    const next = {
      filtersSig,
      page: currentPage,
      selectedSchoolId,
      selectedEditalId,
      isDefault: isDefaultFilters(pendingFilters),
    };

    const prev = prevSnapshotRef.current;
    if (prev) {
      const filtersWentToDefault = !prev.isDefault && next.isDefault;
      const pageWentToOneWithoutFilterChange = prev.page !== 1 && next.page === 1 && prev.filtersSig === next.filtersSig;
      const selectionCleared = (!!prev.selectedSchoolId || !!prev.selectedEditalId) && !next.selectedSchoolId && !next.selectedEditalId;

      if (filtersWentToDefault || pageWentToOneWithoutFilterChange || selectionCleared) {
        setDebugResetCount((c) => c + 1);
        debugLog("RESET_DETECTED", {
          reason: {
            filtersWentToDefault,
            pageWentToOneWithoutFilterChange,
            selectionCleared,
          },
          href: window.location.href,
          asPath: getAsPath(),
          prev,
          next,
        });
        markDebugChange("reset_detected");
      }
    }

    prevSnapshotRef.current = next;
  }, [debugEnabled, pendingFilters, filtersSig, currentPage, selectedSchoolId, selectedEditalId, debugLog, markDebugChange]);

  // Handler for school/edital selection - directly updates hook filters
  const handleSchoolSelect = useCallback((schoolId: string | null, isPre: boolean, editalId?: string | null) => {
    setSelectedSchoolId(schoolId);
    setSelectedEditalId(editalId || null);
    setIsPreEdital(isPre);
    // Directly update hook filters to avoid stale closures
    if (setSchoolId) setSchoolId(schoolId, isPre);
    if (setEditalId) setEditalId(editalId || null);
  }, [setSchoolId, setEditalId]);

  const handleAddToNotebook = (questionId: string) => {
    setQuestionToAdd(questionId);
    setNotebookDialogOpen(true);
  };

  const handleCreateNote = (question: Question) => {
    setQuestionForNote(question);
    setNoteDialogOpen(true);
  };

  const handleSubmitAnswer = async (questionId: string, answer: string) => {
    debugLog("ANSWER_SUBMIT", { questionId, answer });
    const result = await submitAnswer(questionId, answer);
    return result;
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
    <ConselhoThemeWrapper>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Search className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="font-heading text-xl font-bold">Banco de Questões</h1>
                  <p className="text-sm text-muted-foreground">Pratique com questões comentadas</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button variant="outline" onClick={() => navigate("/admin")}>
                  <Shield className="w-4 h-4 mr-2" />
                  Admin
                </Button>
              )}
            </div>
          </div>

          <QuestionBankDebugBadge
            enabled={debugEnabled}
            route={routeLabel}
            filtersSummary={filtersSummary}
            page={currentPage}
            lastChangeAt={debugLastChangeAt}
            resetCount={debugResetCount}
            logs={debugLogsRef.current}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-6">
          <TutorialActionCard productSlug="banco_de_questoes" />
          {/* School Selector */}
          <SchoolSelector 
            onSelect={handleSchoolSelect} 
            selectedSchoolId={selectedSchoolId}
            selectedEditalId={selectedEditalId}
          />

          {hasSelection ? (
            <>
              {/* Question count */}
              {isLoading ? (
                <p className="text-muted-foreground">Carregando questões...</p>
              ) : (
                <p className="text-muted-foreground">
                  {totalCount > 0
                    ? `${totalCount.toLocaleString()} questões encontradas`
                    : "Nenhuma questão encontrada"}
                </p>
              )}

              {/* Filters */}
              <QuestionFilters
                filters={pendingFilters}
                bancas={bancas}
                orgaos={orgaos}
                provas={provas}
                disciplines={disciplines}
                topics={topics}
                years={years}
                onFilterChange={updateFilter}
                onToggleArrayFilter={toggleArrayFilter}
                onClearFilters={clearFilters}
                onApplyFilters={applyFilters}
                hasPendingChanges={hasPendingChanges}
                stats={globalStats}
                debugEnabled={debugEnabled}
                debugLog={debugLog}
              />

              {/* Questions List */}
              {isLoading ? (
                <QuestionListSkeleton count={5} />
              ) : questions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Lock className="h-12 w-12 text-muted-foreground" />
                  <p className="text-lg font-medium">Nenhuma questão encontrada</p>
                  <p className="text-muted-foreground text-center max-w-md">
                    Tente ajustar os filtros ou limpe todos para ver mais questões.
                  </p>
                  <Button variant="outline" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {questions.map((question, index) => (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      index={((currentPage - 1) * 10) + index}
                      onSubmitAnswer={handleSubmitAnswer}
                      onAddToNotebook={handleAddToNotebook}
                      onCreateNote={handleCreateNote}
                      filterDisciplineId={pendingFilters.disciplines.length === 1 ? pendingFilters.disciplines[0] : null}
                      filterTopicId={pendingFilters.topics.length === 1 ? pendingFilters.topics[0] : null}
                    />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {!isLoading && questions.length > 0 && (
                <QuestionPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  onPageChange={loadQuestions}
                />
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-16">
              <p className="text-muted-foreground">Selecione uma categoria acima para carregar as questões.</p>
            </div>
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
    </ConselhoThemeWrapper>
  );
}
