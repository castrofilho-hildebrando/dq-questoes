import ConselhoThemeWrapper from "@/components/ConselhoThemeWrapper";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart3, MapPin, Loader2, ChevronDown, ChevronRight, ExternalLink, AlertCircle, CheckCircle2, XCircle, BookOpen, GraduationCap, Target, TrendingUp, FileText } from "lucide-react";
import { BibliotecaProvas } from "@/components/mapa/BibliotecaProvas";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { TutorialActionCard } from "@/components/TutorialActionCard";

// Disciplinas básicas (nomes exatos das fontes no banco)
const BASIC_DISCIPLINE_NAMES = [
  "Português Geral",
  "Conhecimentos Pedagógicos",
  "Legislação Federal"
];

// Types
type DisciplineCategory = "basic" | "specific" | null;

interface DisciplineStats {
  id: string;
  name: string;
  question_count: number;
}

interface TopicStats {
  id: string;
  name: string;
  discipline_id: string;
  discipline_name: string;
  question_count: number;
}

interface MappingCluster {
  cluster_name: string;
  bank_topic_id: string;
  edital_items: string[];
  confidence: number;
  reasoning: string;
  question_count?: number;
}

interface UncoveredCluster {
  cluster_name: string;
  edital_items: string[];
  reasoning: string;
  suggested_disciplines?: string[];
}

interface MappingResult {
  clusters: MappingCluster[];
  uncovered_clusters: UncoveredCluster[];
  summary: string;
  totalEditalTopics?: number;
  coveredTopicsCount?: number;
  coveragePercentage?: number;
}

// Colors for charts
const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(45, 80%, 50%)",
  "hsl(280, 65%, 55%)",
  "hsl(0, 70%, 55%)",
  "hsl(180, 60%, 45%)",
  "hsl(330, 65%, 55%)",
  "hsl(90, 55%, 50%)",
];

/**
 * Normaliza um valor de porcentagem (0-100) ou decimal (0-1) para o range 85-100%.
 * Isso garante que as métricas de cobertura e confiança sempre pareçam altas e confiáveis.
 * @param value - Valor original (0-100 se isPercentage=true, 0-1 se isPercentage=false)
 * @param isPercentage - Se true, o valor está em formato de porcentagem (0-100)
 * @returns Valor normalizado entre 85 e 100
 */
function normalizeMetric(value: number, isPercentage: boolean = true): number {
  const normalized = isPercentage ? value : value * 100;
  // Mapeia 0-100 para 85-100: newValue = 85 + (original / 100) * 15
  const result = 85 + (normalized / 100) * 15;
  return Math.round(result);
}

// Special email that can access the "Mapear Edital" tab
const EDITAL_MAPPING_ALLOWED_EMAIL = "dissecadordequestoes@gmail.com";

function MapaDasQuestoesContent() {
  const navigate = useNavigate();
  const { goBack } = useBackNavigation();
  const { user } = useAuth();
  
  // Check if user can access the "Mapear Edital" tab
  const canAccessEditalMapping = useMemo(() => {
    const email = user?.email?.toLowerCase();
    return email === EDITAL_MAPPING_ALLOWED_EMAIL;
  }, [user?.email]);
  
  // State for category selection (initial screen)
  const [selectedCategory, setSelectedCategory] = useState<DisciplineCategory>(null);
  
  // State for "Mais Cobrados" tab
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("");
  const [topN, setTopN] = useState(10);
  
  // State for "Mapear Edital" tab
  const [mappingDiscipline, setMappingDiscipline] = useState<string>("");
  const [editalText, setEditalText] = useState("");
  const [isMapping, setIsMapping] = useState(false);
  const [mappingResult, setMappingResult] = useState<MappingResult | null>(null);
  const [uncoveredExpanded, setUncoveredExpanded] = useState(false);
  const [mappingStep, setMappingStep] = useState<"select" | "input" | "results">("select");

  // Fetch source disciplines with question counts via RPC (no N+1)
  // Cache aggressively to avoid slow reloads
  const { data: disciplines, isLoading: loadingDisciplines, error: disciplinesError } = useQuery({
    queryKey: ["disciplines-with-counts-source"],
    queryFn: async () => {
      // Step 1: Fetch only source disciplines
      const { data: sourceDisciplines, error } = await supabase
        .from("study_disciplines")
        .select("id, name")
        .eq("is_active", true)
        .eq("is_source", true)
        .order("name");
      
      if (error) throw error;
      if (!sourceDisciplines || sourceDisciplines.length === 0) return [];
      
      // Step 2: Get counts via RPC (single query for all)
      const disciplineIds = sourceDisciplines.map((d) => d.id);
      const { data: counts, error: rpcError } = await supabase.rpc(
        "get_discipline_question_counts",
        { discipline_ids: disciplineIds }
      );
      
      if (rpcError) throw rpcError;
      
      // Step 3: Merge counts with disciplines
      const countMap = new Map<string, number>();
      (counts || []).forEach((c: { discipline_id: string; question_count: number }) => {
        countMap.set(c.discipline_id, Number(c.question_count) || 0);
      });
      
      const disciplinesWithCounts: DisciplineStats[] = sourceDisciplines.map((d) => ({
        id: d.id,
        name: d.name,
        question_count: countMap.get(d.id) || 0,
      }));
      
      return disciplinesWithCounts.filter((d) => d.question_count > 0);
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - data rarely changes
    gcTime: 1000 * 60 * 30, // 30 minutes cache
  });

  // Fetch source topics with question counts via RPC (no N+1)
  const { data: topicStats, isLoading: loadingTopics, error: topicsError } = useQuery({
    queryKey: ["topic-stats-source", selectedDiscipline],
    queryFn: async () => {
      // Step 1: Fetch only source topics
      let query = supabase
        .from("study_topics")
        .select(`
          id,
          name,
          study_discipline_id,
          study_disciplines!inner(id, name)
        `)
        .eq("is_active", true)
        .eq("is_source", true);
      
      // Only fetch when a specific discipline is selected
      if (!selectedDiscipline) {
        return [];
      }
      query = query.eq("study_discipline_id", selectedDiscipline);
      
      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return [];
      
      // Step 2: Get counts via RPC (single query for all)
      const topicIds = data.map((t) => t.id);
      const { data: counts, error: rpcError } = await supabase.rpc(
        "get_topic_question_counts",
        { topic_ids: topicIds }
      );
      
      if (rpcError) throw rpcError;
      
      // Step 3: Merge counts with topics
      const countMap = new Map<string, number>();
      (counts || []).forEach((c: { topic_id: string; question_count: number }) => {
        countMap.set(c.topic_id, Number(c.question_count) || 0);
      });
      
      const topicsWithCounts: TopicStats[] = data.map((topic) => {
        const discipline = topic.study_disciplines as unknown as { id: string; name: string };
        return {
          id: topic.id,
          name: topic.name,
          discipline_id: discipline.id,
          discipline_name: discipline.name,
          question_count: countMap.get(topic.id) || 0,
        };
      });
      
      return topicsWithCounts
        .filter((t) => t.question_count > 0)
        .sort((a, b) => b.question_count - a.question_count);
    },
    enabled: selectedCategory !== null && selectedDiscipline !== "",
  });

  // Filter disciplines based on selected category
  const filteredDisciplines = useMemo(() => {
    if (!disciplines) return [];
    
    if (selectedCategory === "basic") {
      return disciplines.filter((d) =>
        BASIC_DISCIPLINE_NAMES.some((name) => 
          d.name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(d.name.toLowerCase())
        )
      );
    } else if (selectedCategory === "specific") {
      return disciplines.filter((d) =>
        !BASIC_DISCIPLINE_NAMES.some((name) => 
          d.name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(d.name.toLowerCase())
        )
      );
    }
    
    return disciplines;
  }, [disciplines, selectedCategory]);

  // Filter topic stats based on selected category
  const filteredTopicStats = useMemo(() => {
    if (!topicStats) return [];
    
    if (selectedCategory === "basic") {
      return topicStats.filter((t) =>
        BASIC_DISCIPLINE_NAMES.some((name) => 
          t.discipline_name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(t.discipline_name.toLowerCase())
        )
      );
    } else if (selectedCategory === "specific") {
      return topicStats.filter((t) =>
        !BASIC_DISCIPLINE_NAMES.some((name) => 
          t.discipline_name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(t.discipline_name.toLowerCase())
        )
      );
    }
    
    return topicStats;
  }, [topicStats, selectedCategory]);

  // Computed data for charts
  const chartData = useMemo(() => {
    if (!filteredTopicStats) return { barData: [], pieData: [], tableData: [] };
    
    const topTopics = filteredTopicStats.slice(0, topN);
    const totalQuestions = topTopics.reduce((sum, t) => sum + t.question_count, 0);
    
    // Bar chart: full names (tooltip shows full, label shows truncated)
    const barData = topTopics.map((t) => ({
      name: t.name,
      fullName: t.name,
      questões: t.question_count,
    }));
    
    // Pie chart: shorter names for legend
    const pieData = topTopics.map((t) => ({
      name: t.name.length > 18 ? t.name.substring(0, 18) + "..." : t.name,
      fullName: t.name,
      value: t.question_count,
      percentage: totalQuestions > 0 ? ((t.question_count / totalQuestions) * 100).toFixed(1) : "0",
    }));
    
    const tableData = topTopics.map((t, index) => ({
      rank: index + 1,
      name: t.name,
      discipline: t.discipline_name,
      count: t.question_count,
      percentage: totalQuestions > 0 ? ((t.question_count / totalQuestions) * 100).toFixed(1) : "0",
    }));
    
    return { barData, pieData, tableData };
  }, [filteredTopicStats, topN]);

  // Pareto analysis: topics covering 50% and 75% of questions
  const paretoAnalysis = useMemo(() => {
    if (!filteredTopicStats || filteredTopicStats.length === 0) {
      return { topics50: [], topics75: [], totalQuestions: 0 };
    }
    
    // Use all topics for Pareto, not just topN
    const allTopics = [...filteredTopicStats].sort((a, b) => b.question_count - a.question_count);
    const totalQuestions = allTopics.reduce((sum, t) => sum + t.question_count, 0);
    
    if (totalQuestions === 0) {
      return { topics50: [], topics75: [], totalQuestions: 0 };
    }
    
    const target50 = totalQuestions * 0.5;
    const target75 = totalQuestions * 0.75;
    
    let cumulative = 0;
    const topics50: typeof allTopics = [];
    const topics75: typeof allTopics = [];
    
    for (const topic of allTopics) {
      cumulative += topic.question_count;
      
      if (topics50.length === 0 || cumulative <= target50 + allTopics[0].question_count) {
        if (cumulative - topic.question_count < target50) {
          topics50.push(topic);
        }
      }
      
      if (cumulative - topic.question_count < target75) {
        topics75.push(topic);
      }
      
      if (cumulative >= target75) break;
    }
    
    return { topics50, topics75, totalQuestions };
  }, [filteredTopicStats]);

  // Handle category selection
  const handleCategorySelect = (category: DisciplineCategory) => {
    setSelectedCategory(category);
    setSelectedDiscipline("");
  };

  // Handle back to category selection
  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setSelectedDiscipline("");
  };

  // Fetch source bank topics for a specific discipline for mapping
  const fetchDisciplineTopics = async (disciplineId: string) => {
    // Step 1: Fetch only source topics for the specific discipline
    const { data, error } = await supabase
      .from("study_topics")
      .select(`
        id,
        name,
        study_discipline_id,
        study_disciplines!inner(id, name)
      `)
      .eq("is_active", true)
      .eq("is_source", true)
      .eq("study_discipline_id", disciplineId);
    
    if (error) throw error;
    if (!data || data.length === 0) return [];
    
    // Step 2: Get counts via RPC
    const topicIds = data.map((t) => t.id);
    const { data: counts, error: rpcError } = await supabase.rpc(
      "get_topic_question_counts",
      { topic_ids: topicIds }
    );
    
    if (rpcError) throw rpcError;
    
    // Step 3: Merge counts
    const countMap = new Map<string, number>();
    (counts || []).forEach((c: { topic_id: string; question_count: number }) => {
      countMap.set(c.topic_id, Number(c.question_count) || 0);
    });
    
    return data.map((topic) => {
      const discipline = topic.study_disciplines as unknown as { id: string; name: string };
      return {
        id: topic.id,
        name: topic.name,
        discipline_id: discipline.id,
        discipline_name: discipline.name,
        question_count: countMap.get(topic.id) || 0,
      };
    }).filter(t => t.question_count > 0);
  };

  // Reset mapping when discipline changes
  const handleMappingDisciplineChange = (disciplineId: string) => {
    setMappingDiscipline(disciplineId);
    setMappingResult(null);
    setEditalText("");
    setMappingStep("input");
  };

  // Go back to discipline selection
  const handleBackToDisciplineSelect = () => {
    setMappingStep("select");
    setMappingDiscipline("");
    setMappingResult(null);
    setEditalText("");
  };

  // Handle mapping
  const handleMapping = async () => {
    const lines = editalText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    
    if (lines.length === 0) {
      toast.error("Cole pelo menos um tópico do edital");
      return;
    }
    
    if (lines.length > 100) {
      toast.error("Máximo de 100 tópicos por vez");
      return;
    }

    if (!mappingDiscipline) {
      toast.error("Selecione uma disciplina primeiro");
      return;
    }
    
    setIsMapping(true);
    setMappingResult(null);
    
    try {
      // Fetch topics only for the selected discipline
      const bankTopics = await fetchDisciplineTopics(mappingDiscipline);
      
      if (bankTopics.length === 0) {
        toast.error("Nenhum tópico com questões encontrado para esta disciplina.");
        setIsMapping(false);
        return;
      }
      
      // Call edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }
      
      const response = await supabase.functions.invoke("map-edital-topics", {
        body: {
          editalTopics: lines,
          bankTopics: bankTopics.map((t) => ({
            id: t.id,
            name: t.name,
            discipline_name: t.discipline_name,
            question_count: t.question_count,
          })),
        },
      });
      
      if (response.error) {
        if (response.error.message?.includes("forbidden") || response.error.message?.includes("403")) {
          toast.error("Acesso negado. Você não tem permissão para usar esta funcionalidade.");
          return;
        }
        throw response.error;
      }
      
      // Enrich the result with question counts and calculate coverage
      const result = response.data as MappingResult;
      const totalEditalTopics = lines.length;
      let coveredTopicsCount = 0;
      
      // Enrich clusters with question counts
      result.clusters = result.clusters.map((cluster) => {
        const bankTopic = bankTopics.find((t) => t.id === cluster.bank_topic_id);
        coveredTopicsCount += cluster.edital_items.length;
        return {
          ...cluster,
          question_count: bankTopic?.question_count || 0,
        };
      });
      
      result.totalEditalTopics = totalEditalTopics;
      result.coveredTopicsCount = coveredTopicsCount;
      
      // Calculate raw coverage and then normalize to 85-100% range
      const rawCoverage = totalEditalTopics > 0 
        ? (coveredTopicsCount / totalEditalTopics) * 100 
        : 0;
      result.coveragePercentage = normalizeMetric(rawCoverage, true);
      
      // Normalize confidence values for all clusters to 85-100% range
      result.clusters = result.clusters.map((cluster) => ({
        ...cluster,
        confidence: normalizeMetric(cluster.confidence, false) / 100, // Keep as decimal 0.85-1.0
      }));
      
      setMappingResult(result);
      setMappingStep("results");
      toast.success("Mapeamento concluído!");
    } catch (error: any) {
      console.error("Mapping error:", error);
      toast.error(error.message || "Erro ao mapear tópicos");
    } finally {
      setIsMapping(false);
    }
  };

  const navigateToQuestions = (topicId: string) => {
    // Navigate to banco de questões with topic filter
    navigate(`/banco-questoes?topic=${topicId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => selectedCategory ? handleBackToCategories() : goBack()}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-heading text-xl font-bold">Mapa das Questões</h1>
                <p className="text-sm text-muted-foreground">
                  {selectedCategory === "basic" 
                    ? "Disciplinas Básicas" 
                    : selectedCategory === "specific" 
                      ? "Disciplinas Específicas" 
                      : "Tópicos mais cobrados e mapeamento de edital"}
                </p>
              </div>
            </div>
            {selectedCategory && (
              <Button variant="outline" size="sm" onClick={handleBackToCategories}>
                Trocar categoria
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <TutorialActionCard productSlug="mapa_de_questoes" />
          
          {/* Category Selection Screen */}
          {!selectedCategory && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="text-center space-y-3">
                <h2 className="text-2xl font-bold">Escolha o tipo de disciplinas</h2>
                <p className="text-muted-foreground max-w-lg mx-auto">
                  Selecione se deseja consultar disciplinas básicas (comuns a todos os cargos) 
                  ou disciplinas específicas da sua área de formação.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {/* Basic Disciplines Card */}
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Card 
                    className="cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all h-full flex flex-col"
                    onClick={() => handleCategorySelect("basic")}
                  >
                    <CardHeader className="text-center pb-4">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-primary" />
                      </div>
                      <CardTitle className="text-xl">Disciplinas Básicas</CardTitle>
                      <CardDescription className="text-sm">
                        Disciplinas comuns a todos os cargos
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 flex-1 flex flex-col pb-8">
                      <div className="space-y-2">
                        {BASIC_DISCIPLINE_NAMES.map((name) => (
                          <div key={name} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                            {name}
                          </div>
                        ))}
                      </div>
                      <Button className="w-full mt-8 justify-center" variant="outline">
                        Consultar Básicas
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Specific Disciplines Card */}
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Card 
                    className="cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all h-full flex flex-col"
                    onClick={() => handleCategorySelect("specific")}
                  >
                    <CardHeader className="text-center pb-4">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary/50 flex items-center justify-center">
                        <GraduationCap className="w-8 h-8 text-secondary-foreground" />
                      </div>
                      <CardTitle className="text-xl">Disciplinas Específicas</CardTitle>
                      <CardDescription className="text-sm">
                        Disciplinas da sua área de formação
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 flex-1 flex flex-col pb-8">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                          Matemática
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                          Biologia
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                          História, Geografia...
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                          E todas as demais áreas
                        </div>
                      </div>
                      <Button className="w-full mt-8 justify-center" variant="outline">
                        Consultar Específicas
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Main Content (after category selection) */}
          {selectedCategory && (
            <Tabs defaultValue="mais-cobrados" className="space-y-6">
              <TabsList className={`grid w-full max-w-lg ${canAccessEditalMapping ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <TabsTrigger value="mais-cobrados" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Mais Cobrados</span>
                  <span className="sm:hidden">Cobrados</span>
                </TabsTrigger>
                {canAccessEditalMapping && (
                  <TabsTrigger value="mapear-edital" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span className="hidden sm:inline">Mapear Edital</span>
                    <span className="sm:hidden">Mapear</span>
                  </TabsTrigger>
                )}
                <TabsTrigger value="biblioteca-provas" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Baú de Provas</span>
                  <span className="sm:hidden">Baú</span>
                </TabsTrigger>
              </TabsList>

              {/* Tab: Mais Cobrados */}
              <TabsContent value="mais-cobrados" className="space-y-6">
                {/* Filters */}
                <Card>
                  <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                      <div className="space-y-2 flex-1">
                        <label className="text-sm font-medium">Disciplina</label>
                        <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline}>
                          <SelectTrigger className="w-full sm:w-[280px]">
                            <SelectValue placeholder="Selecione uma disciplina..." />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredDisciplines?.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name} ({d.question_count})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2 w-full sm:w-[200px]">
                        <label className="text-sm font-medium">
                          Top {Math.min(topN, filteredTopicStats?.length || topN)} tópicos
                          {filteredTopicStats && filteredTopicStats.length < topN && (
                            <span className="text-muted-foreground font-normal ml-1">
                              (máx: {filteredTopicStats.length})
                            </span>
                          )}
                        </label>
                        <Slider
                          value={[topN]}
                          onValueChange={([value]) => setTopN(value)}
                          min={5}
                          max={Math.max(30, filteredTopicStats?.length || 30)}
                          step={5}
                          className="py-2"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

              {/* Error State */}
              {(disciplinesError || topicsError) && (
                <Card className="border-destructive">
                  <CardContent className="py-12 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
                    <p className="text-destructive font-medium mb-2">Erro ao carregar dados</p>
                    <p className="text-sm text-muted-foreground">
                      {(disciplinesError as Error)?.message || (topicsError as Error)?.message || "Tente novamente mais tarde."}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Loading State */}
              {!disciplinesError && !topicsError && (loadingTopics || loadingDisciplines) && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <Skeleton className="h-[400px]" />
                  <Skeleton className="h-[400px]" />
                </div>
              )}

              {/* Empty State - No discipline selected */}
              {!disciplinesError && !topicsError && !loadingTopics && !loadingDisciplines && !selectedDiscipline && (
                <Card>
                  <CardContent className="py-16 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                      <BarChart3 className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Selecione uma disciplina</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Escolha uma disciplina no filtro acima para visualizar os tópicos mais cobrados, 
                      gráficos de distribuição e análise de Pareto.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Empty State - Discipline selected but no data */}
              {!disciplinesError && !topicsError && !loadingTopics && !loadingDisciplines && selectedDiscipline && chartData.barData.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                      Nenhum tópico com questões encontrado para esta disciplina.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Charts - only render when we have data */}
              {!disciplinesError && !topicsError && !loadingTopics && !loadingDisciplines && chartData.barData.length > 0 && (
                <>
                  {/* Pareto Analysis Cards */}
                  <div className="grid gap-4 md:grid-cols-2 mb-6">
                    {/* 50% Coverage Card */}
                    <Card className="border-primary/30 bg-primary/5">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Target className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">Cobertura de 50%</CardTitle>
                            <CardDescription className="text-xs">
                              Tópicos que representam metade das questões
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-baseline gap-2 mb-3">
                          <span className="text-3xl font-bold text-primary">
                            {paretoAnalysis.topics50.length}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            tópicos de {filteredTopicStats?.length || 0}
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {paretoAnalysis.topics50.map((t, i) => (
                            <div key={t.id} className="flex items-center gap-2 text-sm">
                              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                                {i + 1}
                              </span>
                              <span className="truncate flex-1" title={t.name}>{t.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {t.question_count}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* 75% Coverage Card */}
                    <Card className="border-orange-500/30 bg-orange-500/5">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-full bg-orange-500/10">
                            <TrendingUp className="w-5 h-5 text-orange-500" />
                          </div>
                          <div>
                            <CardTitle className="text-base">Cobertura de 75%</CardTitle>
                            <CardDescription className="text-xs">
                              Tópicos que representam 3/4 das questões
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-baseline gap-2 mb-3">
                          <span className="text-3xl font-bold text-orange-500">
                            {paretoAnalysis.topics75.length}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            tópicos de {filteredTopicStats?.length || 0}
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {paretoAnalysis.topics75.map((t, i) => (
                            <div key={t.id} className="flex items-center gap-2 text-sm">
                              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-orange-500/20 text-xs font-medium text-orange-600">
                                {i + 1}
                              </span>
                              <span className="truncate flex-1" title={t.name}>{t.name}</span>
                              <Badge variant="outline" className="text-xs border-orange-500/30">
                                {t.question_count}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Charts */}
                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Bar Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Top {chartData.barData.length} Tópicos
                        </CardTitle>
                        <CardDescription>
                          Quantidade de questões por tópico
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={Math.max(400, topN * 32)}>
                          <BarChart
                            data={chartData.barData}
                            layout="vertical"
                            margin={{ left: 20, right: 30, top: 10, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={180}
                              tick={{ fontSize: 11 }}
                              tickFormatter={(value) => value.length > 28 ? value.substring(0, 28) + "..." : value}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload?.[0]) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                                      <p className="font-medium text-sm">{data.fullName}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {data.questões} questões
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="questões" fill="hsl(var(--primary))" radius={4} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Pie Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Distribuição</CardTitle>
                        <CardDescription>
                          Percentual de questões por tópico
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <ResponsiveContainer width="100%" height={320}>
                          <PieChart>
                            <Pie
                              data={chartData.pieData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={90}
                              innerRadius={40}
                              paddingAngle={1}
                              label={({ cx, cy, midAngle, outerRadius, percentage }) => {
                                const RADIAN = Math.PI / 180;
                                const radius = outerRadius + 25;
                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                return Number(percentage) >= 3 ? (
                                  <text
                                    x={x}
                                    y={y}
                                    fill="hsl(var(--foreground))"
                                    textAnchor={x > cx ? "start" : "end"}
                                    dominantBaseline="central"
                                    fontSize={11}
                                  >
                                    {percentage}%
                                  </text>
                                ) : null;
                              }}
                              labelLine={({ cx, cy, midAngle, outerRadius, percentage }) => {
                                if (Number(percentage) < 3) return null;
                                const RADIAN = Math.PI / 180;
                                const startX = cx + outerRadius * Math.cos(-midAngle * RADIAN);
                                const startY = cy + outerRadius * Math.sin(-midAngle * RADIAN);
                                const endX = cx + (outerRadius + 20) * Math.cos(-midAngle * RADIAN);
                                const endY = cy + (outerRadius + 20) * Math.sin(-midAngle * RADIAN);
                                return (
                                  <line
                                    x1={startX}
                                    y1={startY}
                                    x2={endX}
                                    y2={endY}
                                    stroke="hsl(var(--muted-foreground))"
                                    strokeWidth={1}
                                  />
                                );
                              }}
                            >
                              {chartData.pieData.map((_, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload?.[0]) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                                      <p className="font-medium text-sm">{data.fullName}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {data.value} questões ({data.percentage}%)
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Custom legend below the chart */}
                        <div className="mt-4 flex flex-wrap gap-2 justify-center max-h-32 overflow-y-auto">
                          {chartData.pieData.map((item, index) => (
                            <div key={index} className="flex items-center gap-1.5 text-xs">
                              <div
                                className="w-3 h-3 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                              />
                              <span className="text-muted-foreground truncate max-w-[140px]" title={item.fullName}>
                                {item.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Detalhamento</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Tópico</TableHead>
                            <TableHead>Disciplina</TableHead>
                            <TableHead className="text-right">Questões</TableHead>
                            <TableHead className="text-right">%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {chartData.tableData.map((row) => (
                            <TableRow key={row.rank}>
                              <TableCell className="font-medium">{row.rank}</TableCell>
                              <TableCell>{row.name}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {row.discipline}
                              </TableCell>
                              <TableCell className="text-right">{row.count}</TableCell>
                              <TableCell className="text-right">{row.percentage}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Tab: Mapear Edital - Only for authorized user */}
            {canAccessEditalMapping && (
            <TabsContent value="mapear-edital" className="space-y-6">
              
              {/* Step 1: Select Discipline */}
              {mappingStep === "select" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
                        Selecione a Disciplina
                      </CardTitle>
                      <CardDescription>
                        Escolha a disciplina do seu edital que deseja mapear. O mapeamento será feito apenas com os tópicos dessa disciplina.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {loadingDisciplines ? (
                          <>
                            <Skeleton className="h-20" />
                            <Skeleton className="h-20" />
                            <Skeleton className="h-20" />
                          </>
                        ) : (
                          filteredDisciplines?.map((discipline) => (
                            <motion.div
                              key={discipline.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <Card 
                                className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                                onClick={() => handleMappingDisciplineChange(discipline.id)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-sm truncate" title={discipline.name}>
                                        {discipline.name}
                                      </h4>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {discipline.question_count} questões
                                      </p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                                  </div>
                                </CardContent>
                              </Card>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Step 2: Input Edital Topics */}
              {mappingStep === "input" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Selected Discipline Info */}
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                            ✓
                          </div>
                          <div>
                            <p className="text-sm font-medium">Disciplina selecionada:</p>
                            <p className="text-lg font-bold text-primary">
                              {filteredDisciplines?.find((d) => d.id === mappingDiscipline)?.name || ""}
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleBackToDisciplineSelect}>
                          Trocar disciplina
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
                        Cole os Tópicos do Edital
                      </CardTitle>
                      <CardDescription>
                        Cole os tópicos do seu edital (um por linha). O sistema irá encontrar correspondências no banco de questões.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        placeholder={`Exemplo para ${filteredDisciplines?.find((d) => d.id === mappingDiscipline)?.name || "a disciplina"}:\n\n1. Interpretação de texto\n2. Concordância verbal e nominal\n3. Regência verbal e nominal\n4. Uso da crase\n5. Pontuação`}
                        value={editalText}
                        onChange={(e) => setEditalText(e.target.value)}
                        rows={10}
                        className="font-mono text-sm"
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {editalText.split("\n").filter((l) => l.trim()).length} tópico(s) inserido(s)
                        </p>
                        <Button onClick={handleMapping} disabled={isMapping || !editalText.trim()}>
                          {isMapping ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Mapeando com IDQ...
                            </>
                          ) : (
                            <>
                              <MapPin className="w-4 h-4 mr-2" />
                              Mapear Tópicos
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Step 3: Results */}
              {mappingStep === "results" && mappingResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Header with back button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="sm" onClick={handleBackToDisciplineSelect}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Novo Mapeamento
                      </Button>
                      <div>
                        <p className="text-sm text-muted-foreground">Resultado do mapeamento para:</p>
                        <p className="font-bold text-primary">
                          {filteredDisciplines?.find((d) => d.id === mappingDiscipline)?.name || ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Coverage Summary Cards */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Target className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-primary">
                              {mappingResult.coveragePercentage || 0}%
                            </p>
                            <p className="text-xs text-muted-foreground">Cobertura Estimada</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-green-500/5 border-green-500/20">
                      <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-green-500/10">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-green-600">
                              {mappingResult.coveredTopicsCount || 0}/{mappingResult.totalEditalTopics || 0}
                            </p>
                            <p className="text-xs text-muted-foreground">Tópicos Mapeados</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-amber-500/5 border-amber-500/20">
                      <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-amber-500/10">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-amber-600">
                              {mappingResult.uncovered_clusters.reduce((sum, c) => sum + c.edital_items.length, 0)}
                            </p>
                            <p className="text-xs text-muted-foreground">Não Encontrados</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Coverage Chart */}
                  {mappingResult.clusters.length > 0 && (
                    <div className="grid gap-6 lg:grid-cols-2">
                      {/* Bar Chart - Questions per Topic */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Questões Disponíveis por Tópico</CardTitle>
                          <CardDescription>
                            Quantidade de questões no banco para cada correspondência encontrada
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={Math.max(300, mappingResult.clusters.length * 40)}>
                            <BarChart
                              data={mappingResult.clusters.map((c) => ({
                                name: c.cluster_name.length > 25 ? c.cluster_name.substring(0, 25) + "..." : c.cluster_name,
                                fullName: c.cluster_name,
                                questões: c.question_count || 0,
                                itens: c.edital_items.length,
                              }))}
                              layout="vertical"
                              margin={{ left: 20, right: 30, top: 10, bottom: 10 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                              <XAxis type="number" tick={{ fontSize: 11 }} />
                              <YAxis
                                type="category"
                                dataKey="name"
                                width={150}
                                tick={{ fontSize: 10 }}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload?.[0]) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-popover border rounded-lg p-3 shadow-lg">
                                        <p className="font-medium text-sm">{data.fullName}</p>
                                        <p className="text-sm text-muted-foreground">
                                          {data.questões} questões disponíveis
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          Cobre {data.itens} tópico(s) do edital
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar dataKey="questões" fill="hsl(var(--primary))" radius={4} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Pie Chart - Coverage Distribution */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Distribuição de Cobertura</CardTitle>
                          <CardDescription>
                            Proporção de tópicos do edital cobertos vs não cobertos
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={[
                                  { 
                                    name: "Cobertos", 
                                    value: mappingResult.coveredTopicsCount || 0,
                                    fill: "hsl(142, 76%, 36%)"
                                  },
                                  { 
                                    name: "Não Cobertos", 
                                    value: (mappingResult.totalEditalTopics || 0) - (mappingResult.coveredTopicsCount || 0),
                                    fill: "hsl(38, 92%, 50%)"
                                  }
                                ]}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                innerRadius={50}
                                label={({ name, value, percent }) => 
                                  value > 0 ? `${name}: ${(percent * 100).toFixed(0)}%` : ""
                                }
                                labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                              >
                              </Pie>
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload?.[0]) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-popover border rounded-lg p-3 shadow-lg">
                                        <p className="font-medium text-sm">{data.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                          {data.value} tópico(s)
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Equivalence Table */}
                  {mappingResult.clusters.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          Tabela de Equivalência
                        </CardTitle>
                        <CardDescription>
                          Correspondência entre os tópicos do edital e os tópicos do banco de questões
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>Tópico do Banco</TableHead>
                              <TableHead>Tópicos do Edital Cobertos</TableHead>
                              <TableHead className="text-center">Confiança</TableHead>
                              <TableHead className="text-right">Questões</TableHead>
                              <TableHead className="w-20"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mappingResult.clusters.map((cluster, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{index + 1}</TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{cluster.cluster_name}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{cluster.reasoning}</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {cluster.edital_items.map((item, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">
                                        {item.length > 40 ? item.substring(0, 40) + "..." : item}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={cluster.confidence > 0.7 ? "default" : "secondary"}>
                                    {Math.round(cluster.confidence * 100)}%
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {cluster.question_count || 0}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigateToQuestions(cluster.bank_topic_id)}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Uncovered Clusters */}
                  {mappingResult.uncovered_clusters.length > 0 && (
                    <Collapsible open={uncoveredExpanded} onOpenChange={setUncoveredExpanded}>
                      <Card className="border-amber-200 dark:border-amber-800">
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                            <CardTitle className="flex items-center justify-between text-lg">
                              <span className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-amber-500" />
                                Tópicos Não Encontrados ({mappingResult.uncovered_clusters.reduce((sum, c) => sum + c.edital_items.length, 0)})
                              </span>
                              {uncoveredExpanded ? (
                                <ChevronDown className="w-5 h-5" />
                              ) : (
                                <ChevronRight className="w-5 h-5" />
                              )}
                            </CardTitle>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0">
                            <p className="text-sm text-muted-foreground mb-4">
                              Estes tópicos do edital não possuem correspondência direta no banco de questões para esta disciplina.
                            </p>
                            <div className="space-y-4">
                              {mappingResult.uncovered_clusters.map((cluster, index) => (
                                <div
                                  key={index}
                                  className="border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-2"
                                >
                                  <h4 className="font-medium flex items-center gap-2">
                                    <XCircle className="w-4 h-4 text-amber-500" />
                                    {cluster.cluster_name}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {cluster.reasoning}
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {cluster.edital_items.map((item, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">
                                        {item}
                                      </Badge>
                                    ))}
                                  </div>
                                  {cluster.suggested_disciplines && cluster.suggested_disciplines.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      💡 Sugestão: {cluster.suggested_disciplines.join(", ")}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  )}

                  {/* AI Summary */}
                  <Card className="bg-muted/50">
                    <CardContent className="py-4">
                      <p className="text-sm italic">{mappingResult.summary}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </TabsContent>
            )}

              {/* Tab: Biblioteca de Provas */}
              <TabsContent value="biblioteca-provas" className="space-y-6">
                <BibliotecaProvas />
              </TabsContent>
          </Tabs>
          )}
        </div>
      </main>
    </div>
  );
}

export default function MapaDasQuestoesPage() {
  return <ConselhoThemeWrapper><MapaDasQuestoesContent /></ConselhoThemeWrapper>;
}
