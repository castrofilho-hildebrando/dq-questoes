import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  AlertCircle, CheckCircle, XCircle, Clock, Eye, Trash2, RefreshCw, 
  ExternalLink, Search, Ban, FileQuestion, Undo2, ShieldX, FileText,
  Scale, MessageSquare, ChevronLeft, ChevronRight, CheckSquare, Filter
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AdminEnunciadoAnalysis } from "./AdminEnunciadoAnalysis";
import { AdminSyncDerivedNotebooks } from "./AdminSyncDerivedNotebooks";

// Types
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
  resolved_at?: string | null;
  resolved_by?: string | null;
  question?: {
    id: string;
    code: string;
    question: string;
    answer: string;
    option_a: string | null;
    option_b: string | null;
    option_c: string | null;
    option_d: string | null;
    option_e: string | null;
    associated_text: string | null;
    is_active: boolean;
  };
  profile?: {
    email: string;
    full_name: string | null;
  } | null;
}

interface DeactivatedQuestion {
  id: string;
  code: string;
  question: string;
  answer: string;
  deactivated_at?: string | null;
  deactivated_by_report_id?: string | null;
  discipline_name?: string;
  discipline_id?: string;
  error_type?: string;
  report_details?: string;
  has_report: boolean;
}

interface FullQuestion {
  id: string;
  code: string;
  question: string;
  answer: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
  associated_text: string | null;
  prof_comment: string | null;
  is_active: boolean;
}

interface Discipline {
  id: string;
  name: string;
}

// Pagination config
const ITEMS_PER_PAGE = 5;

// Status configs
const statusConfig = {
  open: { label: 'Aberto', color: 'bg-yellow-500', icon: Clock },
  pending: { label: 'Pendente', color: 'bg-yellow-500', icon: Clock },
  resolved: { label: 'Resolvido', color: 'bg-green-500', icon: CheckCircle },
  invalid: { label: 'Inválido', color: 'bg-gray-500', icon: XCircle },
};

const errorTypeConfig = {
  enunciado: { label: 'Enunciado', icon: FileText, color: 'text-blue-600' },
  comentario: { label: 'Comentário', icon: MessageSquare, color: 'text-purple-600' },
  gabarito: { label: 'Gabarito', icon: Scale, color: 'text-orange-600' },
};

// Pagination Component
function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange,
  totalItems 
}: { 
  currentPage: number; 
  totalPages: number; 
  onPageChange: (page: number) => void;
  totalItems: number;
}) {
  if (totalPages <= 1) return null;
  
  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t">
      <span className="text-sm text-muted-foreground">
        Página {currentPage} de {totalPages} ({totalItems} itens)
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function AdminQuestionManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<string>('reports');
  
  // === REPORTS STATE ===
  const [allReportsCache, setAllReportsCache] = useState<ErrorReport[]>([]); // Full data cache
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [loadingReports, setLoadingReports] = useState(true);
  const [reportsPage, setReportsPage] = useState(1);
  const [selectedReport, setSelectedReport] = useState<ErrorReport | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorTypeFilter, setErrorTypeFilter] = useState<string>('all');
  const [deactivationStatusFilter, setDeactivationStatusFilter] = useState<string>('all');
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set());
  
  // === DEACTIVATED STATE ===
  const [allDeactivatedCache, setAllDeactivatedCache] = useState<DeactivatedQuestion[]>([]); // Full data cache
  const [deactivatedLoaded, setDeactivatedLoaded] = useState(false);
  const [loadingDeactivated, setLoadingDeactivated] = useState(true);
  const [deactivatedPage, setDeactivatedPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  
  // Deactivated filters
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [deactivatedDisciplineFilter, setDeactivatedDisciplineFilter] = useState<string>('all');
  const [deactivatedErrorTypeFilter, setDeactivatedErrorTypeFilter] = useState<string>('all');
  const [deactivatedReportStatusFilter, setDeactivatedReportStatusFilter] = useState<string>('all');

  // Question view/edit dialog state
  const [viewingQuestion, setViewingQuestion] = useState<FullQuestion | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<FullQuestion | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    openReports: 0,
    deactivatedByError: 0
  });

  // Helper function to batch array into chunks
  const batchArray = <T,>(arr: T[], batchSize: number): T[][] => {
    const batches: T[][] = [];
    for (let i = 0; i < arr.length; i += batchSize) {
      batches.push(arr.slice(i, i + batchSize));
    }
    return batches;
  };

  // === FILTERED DATA (computed from cache) ===
  const filteredReports = useMemo(() => {
    let results = [...allReportsCache];
    
    // Apply error type filter
    if (errorTypeFilter !== 'all') {
      results = results.filter(r => r.error_type === errorTypeFilter);
    }
    
    // Apply deactivation status filter
    if (deactivationStatusFilter === 'deactivated') {
      results = results.filter(r => r.question?.is_active === false);
    } else if (deactivationStatusFilter === 'active') {
      results = results.filter(r => r.question?.is_active === true);
    }
    
    return results;
  }, [allReportsCache, errorTypeFilter, deactivationStatusFilter]);

  const allFilteredReportIds = useMemo(() => filteredReports.map(r => r.id), [filteredReports]);

  const paginatedReports = useMemo(() => {
    const from = (reportsPage - 1) * ITEMS_PER_PAGE;
    return filteredReports.slice(from, from + ITEMS_PER_PAGE);
  }, [filteredReports, reportsPage]);

  const totalReports = filteredReports.length;

  const filteredDeactivated = useMemo(() => {
    let results = [...allDeactivatedCache];
    
    // Apply report status filter
    if (deactivatedReportStatusFilter === 'with_report') {
      results = results.filter(q => q.has_report);
    } else if (deactivatedReportStatusFilter === 'without_report') {
      results = results.filter(q => !q.has_report);
    }

    // Apply discipline filter
    if (deactivatedDisciplineFilter !== 'all') {
      results = results.filter(q => q.discipline_id === deactivatedDisciplineFilter);
    }

    // Apply error type filter
    if (deactivatedErrorTypeFilter !== 'all') {
      results = results.filter(q => q.error_type === deactivatedErrorTypeFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      results = results.filter(q => q.code.toLowerCase().includes(term));
    }

    return results;
  }, [allDeactivatedCache, deactivatedReportStatusFilter, deactivatedDisciplineFilter, deactivatedErrorTypeFilter, searchTerm]);

  const paginatedDeactivated = useMemo(() => {
    const from = (deactivatedPage - 1) * ITEMS_PER_PAGE;
    return filteredDeactivated.slice(from, from + ITEMS_PER_PAGE);
  }, [filteredDeactivated, deactivatedPage]);

  const totalDeactivated = filteredDeactivated.length;

  // === DATA FETCHING (one-time load) ===
  
  // Load ALL open reports once
  const loadReportsData = async () => {
    if (reportsLoaded) return; // Already loaded
    setLoadingReports(true);
    
    try {
      const { data: allData, error } = await supabase
        .from('question_error_reports')
        .select(`
          id, question_id, user_id, error_type, details, status, admin_notes, created_at, updated_at,
          question:questions!question_error_reports_question_id_fkey(id, code, question, answer, option_a, option_b, option_c, option_d, option_e, associated_text, is_active)
        `)
        .in('status', ['open', 'pending'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      let reports = (allData || []) as unknown as ErrorReport[];
      
      // Fetch profiles for all users in parallel
      const userIds = [...new Set(reports.map(r => r.user_id))];
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, email, full_name')
          .in('user_id', userIds);
        
        const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
        reports = reports.map(report => ({
          ...report,
          profile: profileMap.get(report.user_id) || null
        }));
      }
      
      setAllReportsCache(reports);
      setReportsLoaded(true);
      setStats(prev => ({ ...prev, openReports: reports.length }));
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error("Erro ao carregar relatórios");
    } finally {
      setLoadingReports(false);
    }
  };

  // Load ALL deactivated questions once with parallel batch fetching
  const loadDeactivatedData = async () => {
    if (deactivatedLoaded) return; // Already loaded
    setLoadingDeactivated(true);
    
    try {
      // Step 1: Get ALL deactivated questions (paginated due to 1000 row limit)
      const PAGE_SIZE = 1000;
      const allDeactivated: {
        id: string;
        code: string;
        question: string;
        answer: string;
        updated_at: string | null;
      }[] = [];

      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('questions')
          .select('id, code, question, answer, updated_at')
          .eq('is_active', false)
          .order('updated_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        allDeactivated.push(...data);
        if (data.length < PAGE_SIZE) break;
      }

      const allQuestionIds = allDeactivated.map(q => q.id);
      
      // Step 2: Fetch reports and disciplines in PARALLEL batches
      const BATCH_SIZE = 100; // Increased batch size for fewer requests
      const batches = batchArray(allQuestionIds, BATCH_SIZE);
      
      // Create all promises for parallel execution
      const reportPromises = batches.map(batch => 
        supabase
          .from('question_error_reports')
          .select('question_id, error_type, details')
          .in('question_id', batch)
      );
      
      const disciplinePromises = batches.map(batch =>
        supabase
          .from('question_disciplines')
          .select('question_id, study_discipline_id, study_discipline:study_disciplines!inner(id, name, is_source)')
          .in('question_id', batch)
          .is('deleted_at', null)
      );
      
      // Execute all in parallel
      const [reportResults, disciplineResults] = await Promise.all([
        Promise.all(reportPromises),
        Promise.all(disciplinePromises)
      ]);
      
      // Process reports - now includes details
      const reportMap = new Map<string, { error_type: string; details: string }>();
      reportResults.forEach(result => {
        if (result.data) {
          result.data.forEach(r => {
            if (!reportMap.has(r.question_id)) {
              reportMap.set(r.question_id, { error_type: r.error_type, details: r.details });
            }
          });
        }
      });

      // Process disciplines
      const disciplineMap = new Map<string, { id: string; name: string }>();
      disciplineResults.forEach(result => {
        if (result.data) {
          result.data.forEach((d: any) => {
            const disc = d.study_discipline;
            if (disc?.is_source && !disciplineMap.has(d.question_id)) {
              disciplineMap.set(d.question_id, { id: disc.id, name: disc.name });
            }
          });
        }
      });

      // Step 3: Build final results
      const results: DeactivatedQuestion[] = allDeactivated.map(q => {
        const disc = disciplineMap.get(q.id);
        const reportInfo = reportMap.get(q.id);
        return {
          id: q.id,
          code: q.code,
          question: q.question,
          answer: q.answer,
          deactivated_at: q.updated_at,
          discipline_name: disc?.name,
          discipline_id: disc?.id,
          error_type: reportInfo?.error_type,
          report_details: reportInfo?.details,
          has_report: !!reportInfo
        };
      });

      // Sort by deactivated_at
      results.sort((a, b) => {
        if (!a.deactivated_at || !b.deactivated_at) return 0;
        return new Date(b.deactivated_at).getTime() - new Date(a.deactivated_at).getTime();
      });

      setAllDeactivatedCache(results);
      setDeactivatedLoaded(true);
      setStats(prev => ({ ...prev, deactivatedByError: results.length }));
    } catch (error) {
      console.error('Error fetching deactivated questions:', error);
      toast.error("Erro ao carregar questões desativadas");
    } finally {
      setLoadingDeactivated(false);
    }
  };

  // Fetch disciplines for filter
  const fetchDisciplines = async () => {
    const { data } = await supabase
      .from('study_disciplines')
      .select('id, name')
      .eq('is_active', true)
      .eq('is_source', true)
      .order('name');
    setDisciplines(data || []);
  };

  // Force refresh functions
  const refreshReports = () => {
    setReportsLoaded(false);
    setAllReportsCache([]);
  };

  const refreshDeactivated = () => {
    setDeactivatedLoaded(false);
    setAllDeactivatedCache([]);
  };

  useEffect(() => {
    fetchDisciplines();
  }, []);

  // Load data when switching tabs or when cache is invalidated
  useEffect(() => {
    if (activeSubTab === 'reports' && !reportsLoaded) {
      loadReportsData();
    } else if (activeSubTab === 'deactivated' && !deactivatedLoaded) {
      loadDeactivatedData();
    }
  }, [activeSubTab, reportsLoaded, deactivatedLoaded]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setReportsPage(1);
  }, [errorTypeFilter, deactivationStatusFilter]);

  useEffect(() => {
    setDeactivatedPage(1);
  }, [deactivatedDisciplineFilter, deactivatedErrorTypeFilter, deactivatedReportStatusFilter, searchTerm]);

  // Handle report actions
  const handleResolveReport = async (reportId: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('question_error_reports')
        .update({
          status: 'resolved',
          admin_notes: adminNotes.trim() || 'Resolvido pelo admin',
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (error) throw error;
      toast.success("Report marcado como resolvido!");
      setSelectedReport(null);
      refreshReports();
    } catch (error) {
      console.error('Error resolving report:', error);
      toast.error("Erro ao resolver report");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleInvalidateReport = async (reportId: string, questionId: string) => {
    setIsUpdating(true);
    try {
      // Mark report as invalid
      const { error: reportError } = await supabase
        .from('question_error_reports')
        .update({
          status: 'invalid',
          admin_notes: adminNotes.trim() || 'Marcado como inválido pelo admin',
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (reportError) throw reportError;

      // Reactivate the question - using 'as any' until types regenerate
      const { error: questionError } = await supabase
        .from('questions')
        .update({
          is_active: true,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', questionId);

      if (questionError) throw questionError;

      toast.success("Report invalidado e questão reativada!");
      setSelectedReport(null);
      refreshReports();
      refreshDeactivated();
    } catch (error) {
      console.error('Error invalidating report:', error);
      toast.error("Erro ao invalidar report");
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle reactivation
  const handleReactivateQuestion = async (questionId: string, code: string) => {
    setReactivatingId(questionId);
    try {
      // Reactivate question - using 'as any' until types regenerate
      const { error: questionError } = await supabase
        .from('questions')
        .update({
          is_active: true,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', questionId);

      if (questionError) throw questionError;

      // Mark all open reports for this question as resolved - using 'as any'
      const { error: reportsError } = await supabase
        .from('question_error_reports')
        .update({
          status: 'resolved',
          admin_notes: 'Resolvido - questão reativada manualmente'
        } as any)
        .eq('question_id', questionId)
        .eq('status', 'open');

      if (reportsError) console.error('Error resolving reports:', reportsError);

      toast.success(`Questão ${code} reativada!`);
      refreshDeactivated();
      refreshReports();
    } catch (error) {
      console.error('Error reactivating question:', error);
      toast.error("Erro ao reativar questão");
    } finally {
      setReactivatingId(null);
    }
  };

  const handleViewInQuestionBank = (code: string) => {
    navigate(`/admin?tab=questoes&search=${encodeURIComponent(code)}`);
  };

  // Load full question for viewing/editing
  const handleViewQuestion = async (questionId: string) => {
    setLoadingQuestion(true);
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('id, code, question, answer, option_a, option_b, option_c, option_d, option_e, associated_text, prof_comment, is_active')
        .eq('id', questionId)
        .single();

      if (error) throw error;
      setViewingQuestion(data as FullQuestion);
      setEditingQuestion(null);
    } catch (error) {
      console.error('Error loading question:', error);
      toast.error("Erro ao carregar questão");
    } finally {
      setLoadingQuestion(false);
    }
  };

  const handleStartEditing = () => {
    if (viewingQuestion) {
      setEditingQuestion({ ...viewingQuestion });
    }
  };

  const handleSaveQuestion = async () => {
    if (!editingQuestion) return;
    setSavingQuestion(true);
    try {
      const { error } = await supabase
        .from('questions')
        .update({
          question: editingQuestion.question,
          answer: editingQuestion.answer,
          option_a: editingQuestion.option_a,
          option_b: editingQuestion.option_b,
          option_c: editingQuestion.option_c,
          option_d: editingQuestion.option_d,
          option_e: editingQuestion.option_e,
          associated_text: editingQuestion.associated_text,
          prof_comment: editingQuestion.prof_comment,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', editingQuestion.id);

      if (error) throw error;
      toast.success("Questão atualizada com sucesso!");
      setViewingQuestion(editingQuestion);
      setEditingQuestion(null);
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error("Erro ao salvar questão");
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleCloseQuestionDialog = () => {
    setViewingQuestion(null);
    setEditingQuestion(null);
  };

  // Selection handlers
  const handleToggleReportSelection = (reportId: string) => {
    setSelectedReportIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reportId)) {
        newSet.delete(reportId);
      } else {
        newSet.add(reportId);
      }
      return newSet;
    });
  };

  const handleSelectAllReports = (selectAll: boolean) => {
    if (selectAll) {
      // Select ALL filtered IDs, not just current page
      setSelectedReportIds(new Set(allFilteredReportIds));
    } else {
      setSelectedReportIds(new Set());
    }
  };

  const isAllSelected = allFilteredReportIds.length > 0 && selectedReportIds.size === allFilteredReportIds.length;
  const isPartiallySelected = selectedReportIds.size > 0 && selectedReportIds.size < allFilteredReportIds.length;

  // Bulk actions
  const handleBulkResolve = async () => {
    if (selectedReportIds.size === 0) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('question_error_reports')
        .update({
          status: 'resolved',
          admin_notes: 'Resolvido em massa pelo admin',
          updated_at: new Date().toISOString()
        })
        .in('id', Array.from(selectedReportIds));

      if (error) throw error;
      toast.success(`${selectedReportIds.size} reports resolvidos!`);
      setSelectedReportIds(new Set());
      refreshReports();
    } catch (error) {
      console.error('Error bulk resolving:', error);
      toast.error("Erro ao resolver reports em massa");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkInvalidate = async () => {
    if (selectedReportIds.size === 0) return;
    setIsUpdating(true);
    try {
      const selectedIdsArray = Array.from(selectedReportIds);
      
      // Fetch question IDs for all selected reports (not just current page)
      const { data: selectedReportsData, error: fetchError } = await supabase
        .from('question_error_reports')
        .select('id, question_id')
        .in('id', selectedIdsArray);
      
      if (fetchError) throw fetchError;
      
      const questionIds = [...new Set((selectedReportsData || []).map(r => r.question_id))];

      // Mark reports as invalid
      const { error: reportError } = await supabase
        .from('question_error_reports')
        .update({
          status: 'invalid',
          admin_notes: 'Invalidado em massa pelo admin',
          updated_at: new Date().toISOString()
        })
        .in('id', selectedIdsArray);

      if (reportError) throw reportError;

      // Reactivate all affected questions
      const { error: questionError } = await supabase
        .from('questions')
        .update({
          is_active: true,
          updated_at: new Date().toISOString()
        } as any)
        .in('id', questionIds);

      if (questionError) throw questionError;

      toast.success(`${selectedReportIds.size} reports invalidados e ${questionIds.length} questões reativadas!`);
      setSelectedReportIds(new Set());
      refreshReports();
      refreshDeactivated();
    } catch (error) {
      console.error('Error bulk invalidating:', error);
      toast.error("Erro ao invalidar reports em massa");
    } finally {
      setIsUpdating(false);
    }
  };

  // Manual deactivation - single
  const handleManualDeactivate = async (reportId: string, questionId: string, questionCode: string) => {
    setIsUpdating(true);
    try {
      // Deactivate the question
      const { error: questionError } = await supabase
        .from('questions')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', questionId);

      if (questionError) throw questionError;

      toast.success(`Questão ${questionCode} desativada manualmente!`);
      refreshReports();
      refreshDeactivated();
    } catch (error) {
      console.error('Error deactivating question:', error);
      toast.error("Erro ao desativar questão");
    } finally {
      setIsUpdating(false);
    }
  };

  // Manual deactivation - bulk
  const handleBulkDeactivate = async () => {
    if (selectedReportIds.size === 0) return;
    setIsUpdating(true);
    try {
      const selectedIdsArray = Array.from(selectedReportIds);
      
      // Fetch question IDs for all selected reports (not just current page)
      const { data: selectedReportsData, error: fetchError } = await supabase
        .from('question_error_reports')
        .select('id, question_id')
        .in('id', selectedIdsArray);
      
      if (fetchError) throw fetchError;
      
      const questionIds = [...new Set((selectedReportsData || []).map(r => r.question_id))];

      // Deactivate all selected questions
      const { error: questionError } = await supabase
        .from('questions')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        } as any)
        .in('id', questionIds);

      if (questionError) throw questionError;

      toast.success(`${questionIds.length} questões desativadas manualmente!`);
      setSelectedReportIds(new Set());
      refreshReports();
      refreshDeactivated();
    } catch (error) {
      console.error('Error bulk deactivating:', error);
      toast.error("Erro ao desativar questões em massa");
    } finally {
      setIsUpdating(false);
    }
  };

  // Calculate pagination
  const totalReportsPages = Math.ceil(totalReports / ITEMS_PER_PAGE);
  const totalDeactivatedPages = Math.ceil(totalDeactivated / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600">Reports Abertos</p>
                <p className="text-3xl font-bold text-yellow-700">{stats.openReports}</p>
              </div>
              <AlertCircle className="h-10 w-10 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Desativadas (Total)</p>
                <p className="text-3xl font-bold text-red-700">{stats.deactivatedByError}</p>
              </div>
              <ShieldX className="h-10 w-10 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="reports" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            Erros Reportados
            {stats.openReports > 0 && (
              <Badge variant="destructive" className="ml-1">{stats.openReports}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="deactivated" className="gap-2">
            <ShieldX className="h-4 w-4" />
            Desativadas
            {stats.deactivatedByError > 0 && (
              <Badge variant="secondary" className="ml-1">{stats.deactivatedByError}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-2">
            <FileText className="h-4 w-4" />
            Análise
          </TabsTrigger>
          <TabsTrigger value="sync-derived" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Sync Derivados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  Erros Reportados (Abertos)
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Error Type Filter */}
                  <Select value={errorTypeFilter} onValueChange={(val) => { setErrorTypeFilter(val); setReportsPage(1); }}>
                    <SelectTrigger className="w-[160px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Tipo de erro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="enunciado">Enunciado</SelectItem>
                      <SelectItem value="gabarito">Gabarito</SelectItem>
                      <SelectItem value="comentario">Comentário</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Deactivation Status Filter */}
                  <Select value={deactivationStatusFilter} onValueChange={(val) => { setDeactivationStatusFilter(val); setReportsPage(1); }}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Status questão" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="deactivated">Desativadas</SelectItem>
                      <SelectItem value="active">Ativas</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button variant="outline" size="icon" onClick={refreshReports} disabled={loadingReports}>
                    <RefreshCw className={`h-4 w-4 ${loadingReports ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              <CardDescription>
                Questões reportadas com erro são automaticamente desativadas. Revise e resolva ou invalide.
              </CardDescription>
              
              {/* Bulk Actions */}
              {selectedReportIds.size > 0 && (
                <div className="flex items-center gap-2 mt-3 p-3 bg-muted rounded-lg flex-wrap">
                  <CheckSquare className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {selectedReportIds.size} de {allFilteredReportIds.length} selecionado(s)
                  </span>
                  <div className="flex-1" />
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleBulkDeactivate}
                    disabled={isUpdating}
                    className="gap-1"
                  >
                    <Ban className="h-4 w-4" />
                    Desativar
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleBulkResolve}
                    disabled={isUpdating}
                    className="gap-1"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Resolver
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleBulkInvalidate}
                    disabled={isUpdating}
                    className="gap-1"
                  >
                    <XCircle className="h-4 w-4" />
                    Invalidar e Reativar
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => setSelectedReportIds(new Set())}
                  >
                    Limpar
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {loadingReports ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : paginatedReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                  <p>Nenhum report aberto{errorTypeFilter !== 'all' ? ` do tipo "${errorTypeConfig[errorTypeFilter as keyof typeof errorTypeConfig]?.label}"` : ''}!</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox 
                            checked={isAllSelected}
                            ref={(el) => {
                              if (el) {
                                // Set indeterminate state for partial selection
                                (el as unknown as HTMLInputElement).indeterminate = isPartiallySelected;
                              }
                            }}
                            onCheckedChange={(checked) => handleSelectAllReports(!!checked)}
                          />
                        </TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Questão</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Comentário do Aluno</TableHead>
                        <TableHead>Reportado por</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedReports.map((report) => {
                        const TypeConfig = errorTypeConfig[report.error_type as keyof typeof errorTypeConfig];
                        const TypeIcon = TypeConfig?.icon || FileText;
                        
                        return (
                          <TableRow key={report.id} className={selectedReportIds.has(report.id) ? 'bg-muted/50' : ''}>
                            <TableCell>
                              <Checkbox 
                                checked={selectedReportIds.has(report.id)}
                                onCheckedChange={() => handleToggleReportSelection(report.id)}
                              />
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {format(new Date(report.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">{report.question?.code || 'N/A'}</span>
                                {!report.question?.is_active && (
                                  <Badge variant="destructive" className="text-xs">Desativada</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`gap-1 ${TypeConfig?.color}`}>
                                <TypeIcon className="h-3 w-3" />
                                {TypeConfig?.label || report.error_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              <div 
                                className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                                title={report.details}
                              >
                                <div className="flex items-start gap-1">
                                  <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground/60" />
                                  <span className="line-clamp-2">{report.details}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {report.profile?.full_name || report.profile?.email || 'Anônimo'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {report.question?.is_active && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleManualDeactivate(report.id, report.question_id, report.question?.code || '')}
                                    disabled={isUpdating}
                                    title="Desativar questão"
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewQuestion(report.question_id)}
                                  title="Ver/Editar questão"
                                  disabled={loadingQuestion}
                                >
                                  <FileQuestion className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedReport(report);
                                    setAdminNotes(report.admin_notes || '');
                                  }}
                                  title="Ver detalhes do report"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <Pagination
                    currentPage={reportsPage}
                    totalPages={totalReportsPages}
                    onPageChange={setReportsPage}
                    totalItems={totalReports}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Deactivated by Error */}
        <TabsContent value="deactivated" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="flex items-center gap-2">
                  <ShieldX className="h-5 w-5 text-red-500" />
                  Questões Desativadas
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Report Status Filter */}
                  <Select 
                    value={deactivatedReportStatusFilter} 
                    onValueChange={(val) => { setDeactivatedReportStatusFilter(val); setDeactivatedPage(1); }}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Status Report" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas ({totalDeactivated})</SelectItem>
                      <SelectItem value="with_report">Com report</SelectItem>
                      <SelectItem value="without_report">Sem report</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Discipline Filter */}
                  <Select 
                    value={deactivatedDisciplineFilter} 
                    onValueChange={(val) => { setDeactivatedDisciplineFilter(val); setDeactivatedPage(1); }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas disciplinas</SelectItem>
                      {disciplines.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Error Type Filter - only show when filtering 'with_report' */}
                  {deactivatedReportStatusFilter !== 'without_report' && (
                    <Select 
                      value={deactivatedErrorTypeFilter} 
                      onValueChange={(val) => { setDeactivatedErrorTypeFilter(val); setDeactivatedPage(1); }}
                    >
                      <SelectTrigger className="w-[160px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Tipo de erro" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os tipos</SelectItem>
                        <SelectItem value="enunciado">Enunciado</SelectItem>
                        <SelectItem value="gabarito">Gabarito</SelectItem>
                        <SelectItem value="comentario">Comentário</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar código..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setDeactivatedPage(1);
                      }}
                      className="pl-8 w-[160px]"
                    />
                  </div>
                  <Button variant="outline" size="icon" onClick={refreshDeactivated} disabled={loadingDeactivated}>
                    <RefreshCw className={`h-4 w-4 ${loadingDeactivated ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              <CardDescription>
                Todas as questões desativadas. Filtre por "Com report" para ver apenas as reportadas por erro.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDeactivated ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : paginatedDeactivated.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                  <p>Nenhuma questão desativada{deactivatedDisciplineFilter !== 'all' || deactivatedErrorTypeFilter !== 'all' || deactivatedReportStatusFilter !== 'all' ? ' com os filtros selecionados' : ''}!</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Disciplina</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tipo Erro</TableHead>
                        <TableHead>Comentário do Aluno</TableHead>
                        <TableHead>Desativada em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedDeactivated.map((q) => {
                        const TypeConfig = q.error_type ? errorTypeConfig[q.error_type as keyof typeof errorTypeConfig] : null;
                        const TypeIcon = TypeConfig?.icon || FileText;
                        
                        return (
                          <TableRow key={q.id}>
                            <TableCell className="font-mono text-sm font-medium">
                              {q.code}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {q.discipline_name || '-'}
                            </TableCell>
                            <TableCell>
                              {q.has_report ? (
                                <Badge variant="destructive" className="text-xs">Com report</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Manual</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {TypeConfig ? (
                                <Badge variant="outline" className={`gap-1 ${TypeConfig.color}`}>
                                  <TypeIcon className="h-3 w-3" />
                                  {TypeConfig.label}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[250px]">
                              {q.report_details ? (
                                <div 
                                  className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                                  title={q.report_details}
                                >
                                  <div className="flex items-start gap-1">
                                    <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground/60" />
                                    <span className="line-clamp-2">{q.report_details}</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {q.deactivated_at 
                                ? format(new Date(q.deactivated_at), "dd/MM/yy HH:mm", { locale: ptBR })
                                : '-'
                              }
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewQuestion(q.id)}
                                  title="Ver/Editar questão"
                                  disabled={loadingQuestion}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewInQuestionBank(q.code)}
                                  title="Abrir no Banco de Questões"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleReactivateQuestion(q.id, q.code)}
                                  disabled={reactivatingId === q.id}
                                  className="gap-1"
                                >
                                  {reactivatingId === q.id ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Undo2 className="h-3 w-3" />
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
                  <Pagination
                    currentPage={deactivatedPage}
                    totalPages={totalDeactivatedPages}
                    onPageChange={setDeactivatedPage}
                    totalItems={totalDeactivated}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Analysis */}
        <TabsContent value="analysis" className="mt-4">
          <AdminEnunciadoAnalysis />
        </TabsContent>

        {/* Tab 4: Sync Derived Notebooks */}
        <TabsContent value="sync-derived" className="mt-4">
          <AdminSyncDerivedNotebooks />
        </TabsContent>
      </Tabs>

      {/* Report Detail Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Detalhes do Report - {selectedReport?.question?.code}
            </DialogTitle>
            <DialogDescription>
              Revise o report e escolha uma ação: resolver (questão fica desativada) ou invalidar (reativa a questão).
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              {/* Report Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <Badge variant="outline" className="ml-2">
                    {errorTypeConfig[selectedReport.error_type as keyof typeof errorTypeConfig]?.label || selectedReport.error_type}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Reportado por:</span>
                  <span className="ml-2">{selectedReport.profile?.email || 'Anônimo'}</span>
                </div>
              </div>

              {/* Details */}
              <div>
                <span className="text-sm font-medium">Descrição do erro:</span>
                <p className="mt-1 p-3 bg-muted rounded-md text-sm">{selectedReport.details}</p>
              </div>

              {/* Question Preview */}
              {selectedReport.question && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">Preview da questão:</span>
                  <div className="p-3 bg-muted rounded-md text-sm space-y-2">
                    {selectedReport.question.associated_text && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Texto associado:</span>
                        <p className="text-xs line-clamp-2">{selectedReport.question.associated_text.slice(0, 150)}...</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Enunciado:</span>
                      <p dangerouslySetInnerHTML={{ __html: selectedReport.question.question?.slice(0, 200) + '...' }} />
                    </div>
                    <div className="pt-2 border-t">
                      <span className="text-xs font-medium text-muted-foreground">Gabarito: </span>
                      <Badge variant="outline">{selectedReport.question.answer}</Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              <div>
                <span className="text-sm font-medium">Notas do Admin:</span>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Adicione notas sobre a resolução..."
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSelectedReport(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedReport && handleInvalidateReport(selectedReport.id, selectedReport.question_id)}
              disabled={isUpdating}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Invalidar Report (Reativar Questão)
            </Button>
            <Button
              onClick={() => selectedReport && handleResolveReport(selectedReport.id)}
              disabled={isUpdating}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Resolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question View/Edit Dialog */}
      <Dialog open={!!viewingQuestion} onOpenChange={handleCloseQuestionDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileQuestion className="h-5 w-5 text-primary" />
              {editingQuestion ? 'Editar Questão' : 'Visualizar Questão'} - {viewingQuestion?.code}
            </DialogTitle>
            <DialogDescription>
              {viewingQuestion?.is_active 
                ? 'Questão ativa'
                : 'Questão desativada'
              }
            </DialogDescription>
          </DialogHeader>

          {loadingQuestion ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : viewingQuestion && (
            <div className="space-y-4">
              {/* Texto Associado */}
              {(editingQuestion || viewingQuestion.associated_text) && (
                <div>
                  <span className="text-sm font-medium">Texto Associado:</span>
                  {editingQuestion ? (
                    <Textarea
                      value={editingQuestion.associated_text || ''}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, associated_text: e.target.value })}
                      className="mt-1 min-h-[100px]"
                    />
                  ) : (
                    <div className="mt-1 p-3 bg-muted rounded-md text-sm max-h-[150px] overflow-y-auto">
                      {viewingQuestion.associated_text || 'Sem texto associado'}
                    </div>
                  )}
                </div>
              )}

              {/* Enunciado */}
              <div>
                <span className="text-sm font-medium">Enunciado:</span>
                {editingQuestion ? (
                  <Textarea
                    value={editingQuestion.question || ''}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                    className="mt-1 min-h-[120px]"
                  />
                ) : (
                  <div 
                    className="mt-1 p-3 bg-muted rounded-md text-sm"
                    dangerouslySetInnerHTML={{ __html: viewingQuestion.question }}
                  />
                )}
              </div>

              {/* Opções */}
              <div className="grid grid-cols-1 gap-2">
                <span className="text-sm font-medium">Opções:</span>
                {['a', 'b', 'c', 'd', 'e'].map((opt) => {
                  const optKey = `option_${opt}` as keyof FullQuestion;
                  const value = editingQuestion 
                    ? editingQuestion[optKey] as string | null
                    : viewingQuestion[optKey] as string | null;
                  
                  if (!editingQuestion && !value) return null;
                  
                  const isCorrect = viewingQuestion.answer?.toLowerCase() === opt;
                  
                  return (
                    <div key={opt} className={`flex items-start gap-2 p-2 rounded ${isCorrect ? 'bg-green-100 border border-green-300' : 'bg-muted'}`}>
                      <Badge variant={isCorrect ? 'default' : 'outline'} className="mt-0.5">
                        {opt.toUpperCase()}
                      </Badge>
                      {editingQuestion ? (
                        <Input
                          value={value || ''}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, [optKey]: e.target.value })}
                          className="flex-1"
                        />
                      ) : (
                        <span 
                          className="flex-1 text-sm"
                          dangerouslySetInnerHTML={{ __html: value || '-' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Gabarito */}
              <div>
                <span className="text-sm font-medium">Gabarito:</span>
                {editingQuestion ? (
                  <Select 
                    value={editingQuestion.answer?.toUpperCase() || ''} 
                    onValueChange={(val) => setEditingQuestion({ ...editingQuestion, answer: val })}
                  >
                    <SelectTrigger className="w-[100px] mt-1">
                      <SelectValue placeholder="Gabarito" />
                    </SelectTrigger>
                    <SelectContent>
                      {['A', 'B', 'C', 'D', 'E'].map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="default" className="ml-2">{viewingQuestion.answer}</Badge>
                )}
              </div>

              {/* Comentário do Professor */}
              <div>
                <span className="text-sm font-medium">Comentário do Professor:</span>
                {editingQuestion ? (
                  <Textarea
                    value={editingQuestion.prof_comment || ''}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, prof_comment: e.target.value })}
                    className="mt-1 min-h-[100px]"
                    placeholder="Adicione um comentário explicativo..."
                  />
                ) : (
                  <div className="mt-1 p-3 bg-muted rounded-md text-sm max-h-[150px] overflow-y-auto">
                    {viewingQuestion.prof_comment ? (
                      <span dangerouslySetInnerHTML={{ __html: viewingQuestion.prof_comment }} />
                    ) : (
                      <span className="text-muted-foreground italic">Sem comentário</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {editingQuestion ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setEditingQuestion(null)}
                >
                  Cancelar Edição
                </Button>
                <Button
                  onClick={handleSaveQuestion}
                  disabled={savingQuestion}
                >
                  {savingQuestion ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  )}
                  Salvar
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleCloseQuestionDialog}
                >
                  Fechar
                </Button>
                <Button
                  onClick={handleStartEditing}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Editar Questão
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
