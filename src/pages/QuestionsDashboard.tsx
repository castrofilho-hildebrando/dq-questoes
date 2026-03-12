import ConselhoThemeWrapper from "@/components/ConselhoThemeWrapper";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, CheckCircle, XCircle, TrendingUp, BookOpen, ArrowRight, Shield, LogOut, Calendar, Filter, FileText, GraduationCap, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface QuestionStats {
  totalAnswered: number;
  correctAnswers: number;
  wrongAnswers: number;
  accuracyRate: number;
  notebooksCount: number;
}

interface DisciplineStats {
  name: string;
  total: number;
  correct: number;
  wrong: number;
  rate: number;
}

interface TopicStats {
  name: string;
  disciplineName: string;
  total: number;
  correct: number;
  rate: number;
}

interface DailyStats {
  date: string;
  total: number;
  correct: number;
  wrong: number;
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

interface School {
  id: string;
  name: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(142, 71%, 45%)', 'hsl(217, 91%, 60%)', 'hsl(47, 100%, 50%)'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { goBack, fromSuffix } = useBackNavigation();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [periodFilter, setPeriodFilter] = useState<string>("30");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [disciplineFilter, setDisciplineFilter] = useState<string>("all");
  const [topicFilter, setTopicFilter] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  // Fetch schools for filter
  const { data: schools } = useQuery({
    queryKey: ["schools-filter"],
    queryFn: async (): Promise<School[]> => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch disciplines for filter (filtered by school)
  const { data: disciplines } = useQuery({
    queryKey: ["disciplines-filter", schoolFilter],
    queryFn: async (): Promise<StudyDiscipline[]> => {
      if (schoolFilter === "all") {
        const { data, error } = await supabase
          .from("study_disciplines")
          .select("id, name")
          .eq("is_active", true)
          .order("name");
        if (error) throw error;
        return data || [];
      } else {
        // Get disciplines linked to this school
        const { data, error } = await supabase
          .from("school_disciplines")
          .select("study_disciplines!inner(id, name)")
          .eq("school_id", schoolFilter)
          .eq("is_active", true);
        if (error) throw error;
        const disciplines = (data || [])
          .filter((sd: any) => sd.study_disciplines)
          .map((sd: any) => ({ id: sd.study_disciplines.id, name: sd.study_disciplines.name }));
        return disciplines.sort((a, b) => a.name.localeCompare(b.name));
      }
    },
  });

  // Fetch topics for filter
  const { data: topics } = useQuery({
    queryKey: ["topics-filter", disciplineFilter],
    queryFn: async (): Promise<StudyTopic[]> => {
      let query = supabase
        .from("study_topics")
        .select("id, name, study_discipline_id")
        .eq("is_active", true)
        .order("name");
      
      if (disciplineFilter !== "all") {
        query = query.eq("study_discipline_id", disciplineFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as StudyTopic[];
    },
    enabled: disciplineFilter !== "all",
  });

  // Calculate date range based on period filter
  const getDateRange = () => {
    const days = parseInt(periodFilter);
    const endDate = endOfDay(new Date());
    const startDate = startOfDay(subDays(new Date(), days));
    return { startDate, endDate };
  };

  // Fetch main stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats", user?.id, periodFilter, schoolFilter, disciplineFilter, topicFilter],
    queryFn: async (): Promise<QuestionStats> => {
      if (!user?.id) {
        return { totalAnswered: 0, correctAnswers: 0, wrongAnswers: 0, accuracyRate: 0, notebooksCount: 0 };
      }

      const { startDate, endDate } = getDateRange();

      let query = supabase
        .from("user_answers")
        .select(`
          is_correct,
          question_id,
          answered_at,
          questions!inner(study_discipline_id, study_topic_id)
        `)
        .eq("user_id", user.id)
        .gte("answered_at", startDate.toISOString())
        .lte("answered_at", endDate.toISOString());

      if (disciplineFilter !== "all") {
        query = query.eq("questions.study_discipline_id", disciplineFilter);
      }

      if (topicFilter !== "all") {
        query = query.eq("questions.study_topic_id", topicFilter);
      }

      const { data: answers, error } = await query;

      if (error) {
        console.error("Error fetching answers:", error);
        return { totalAnswered: 0, correctAnswers: 0, wrongAnswers: 0, accuracyRate: 0, notebooksCount: 0 };
      }

      const totalAnswered = answers?.length || 0;
      const correctAnswers = answers?.filter((a) => a.is_correct).length || 0;
      const wrongAnswers = totalAnswered - correctAnswers;
      const accuracyRate = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;

      const { count: notebooksCount } = await supabase
        .from("study_notebooks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      return {
        totalAnswered,
        correctAnswers,
        wrongAnswers,
        accuracyRate,
        notebooksCount: notebooksCount || 0,
      };
    },
    enabled: !!user?.id,
  });

  // Fetch daily stats for chart
  const { data: dailyStats } = useQuery({
    queryKey: ["daily-stats", user?.id, periodFilter, schoolFilter, disciplineFilter, topicFilter],
    queryFn: async (): Promise<DailyStats[]> => {
      if (!user?.id) return [];

      const { startDate, endDate } = getDateRange();

      let query = supabase
        .from("user_answers")
        .select(`
          is_correct,
          answered_at,
          questions!inner(study_discipline_id, study_topic_id)
        `)
        .eq("user_id", user.id)
        .gte("answered_at", startDate.toISOString())
        .lte("answered_at", endDate.toISOString())
        .order("answered_at", { ascending: true });

      if (disciplineFilter !== "all") {
        query = query.eq("questions.study_discipline_id", disciplineFilter);
      }

      if (topicFilter !== "all") {
        query = query.eq("questions.study_topic_id", topicFilter);
      }

      const { data, error } = await query;
      if (error) return [];

      // Group by date
      const groupedByDate: Record<string, { total: number; correct: number; wrong: number }> = {};
      
      data?.forEach((answer) => {
        const date = format(parseISO(answer.answered_at), "dd/MM", { locale: ptBR });
        if (!groupedByDate[date]) {
          groupedByDate[date] = { total: 0, correct: 0, wrong: 0 };
        }
        groupedByDate[date].total++;
        if (answer.is_correct) {
          groupedByDate[date].correct++;
        } else {
          groupedByDate[date].wrong++;
        }
      });

      return Object.entries(groupedByDate).map(([date, stats]) => ({
        date,
        ...stats,
      }));
    },
    enabled: !!user?.id,
  });

  // Fetch discipline stats for chart
  const { data: disciplineStats } = useQuery({
    queryKey: ["discipline-stats", user?.id, periodFilter, schoolFilter],
    queryFn: async (): Promise<DisciplineStats[]> => {
      if (!user?.id) return [];

      const { startDate, endDate } = getDateRange();

      const { data, error } = await supabase
        .from("user_answers")
        .select(`
          is_correct,
          answered_at,
          questions!inner(
            study_discipline_id,
            study_disciplines!inner(name)
          )
        `)
        .eq("user_id", user.id)
        .gte("answered_at", startDate.toISOString())
        .lte("answered_at", endDate.toISOString());

      if (error) return [];

      // Group by discipline
      const grouped: Record<string, { name: string; total: number; correct: number; wrong: number }> = {};
      
      data?.forEach((answer: any) => {
        const disciplineName = answer.questions?.study_disciplines?.name || "Sem disciplina";
        if (!grouped[disciplineName]) {
          grouped[disciplineName] = { name: disciplineName, total: 0, correct: 0, wrong: 0 };
        }
        grouped[disciplineName].total++;
        if (answer.is_correct) {
          grouped[disciplineName].correct++;
        } else {
          grouped[disciplineName].wrong++;
        }
      });

      return Object.values(grouped)
        .map((d) => ({
          ...d,
          rate: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    },
    enabled: !!user?.id,
  });

  // Fetch topic stats
  const { data: topicStats } = useQuery({
    queryKey: ["topic-stats", user?.id, periodFilter, schoolFilter, disciplineFilter],
    queryFn: async (): Promise<TopicStats[]> => {
      if (!user?.id) return [];

      const { startDate, endDate } = getDateRange();

      let query = supabase
        .from("user_answers")
        .select(`
          is_correct,
          answered_at,
          questions!inner(
            study_topic_id,
            study_discipline_id,
            study_topics!inner(name),
            study_disciplines!inner(name)
          )
        `)
        .eq("user_id", user.id)
        .gte("answered_at", startDate.toISOString())
        .lte("answered_at", endDate.toISOString());

      if (disciplineFilter !== "all") {
        query = query.eq("questions.study_discipline_id", disciplineFilter);
      }

      const { data, error } = await query;

      if (error) return [];

      // Group by topic
      const grouped: Record<string, { name: string; disciplineName: string; total: number; correct: number }> = {};
      
      data?.forEach((answer: any) => {
        const topicName = answer.questions?.study_topics?.name || "Sem tópico";
        const disciplineName = answer.questions?.study_disciplines?.name || "Sem disciplina";
        const key = `${disciplineName}-${topicName}`;
        if (!grouped[key]) {
          grouped[key] = { name: topicName, disciplineName, total: 0, correct: 0 };
        }
        grouped[key].total++;
        if (answer.is_correct) {
          grouped[key].correct++;
        }
      });

      return Object.values(grouped)
        .map((t) => ({
          ...t,
          rate: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    },
    enabled: !!user?.id,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const pieData = stats ? [
    { name: "Acertos", value: stats.correctAnswers },
    { name: "Erros", value: stats.wrongAnswers },
  ] : [];

  if (authLoading) {
    return (
      <ConselhoThemeWrapper>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </ConselhoThemeWrapper>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Search className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-bold">Banco de Questões</h1>
                <p className="text-sm text-muted-foreground">Seu painel de estudos</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goBack}>
                <Home className="w-4 h-4 mr-2" />
                Início
              </Button>
              <ThemeToggle />
              {isAdmin && (
                <Button variant="outline" onClick={() => navigate("/admin")}>
                  <Shield className="w-4 h-4 mr-2" />
                  Admin
                </Button>
              )}
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-bold">
                Olá! 👋
              </h2>
              <p className="text-muted-foreground">
                Continue praticando para alcançar seus objetivos.
              </p>
            </div>
            <Button size="lg" onClick={() => navigate(`/banco-questoes${fromSuffix}`)}>
              <Search className="w-5 h-5 mr-2" />
              Resolver Questões
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[150px]">
                  <label className="text-sm text-muted-foreground mb-1 block">Período</label>
                  <Select value={periodFilter} onValueChange={setPeriodFilter}>
                    <SelectTrigger>
                      <Calendar className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Últimos 7 dias</SelectItem>
                      <SelectItem value="30">Últimos 30 dias</SelectItem>
                      <SelectItem value="90">Últimos 90 dias</SelectItem>
                      <SelectItem value="365">Último ano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-sm text-muted-foreground mb-1 block">Edital</label>
                  <Select value={schoolFilter} onValueChange={(v) => { setSchoolFilter(v); setDisciplineFilter("all"); setTopicFilter("all"); }}>
                    <SelectTrigger>
                      <GraduationCap className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os editais</SelectItem>
                      {schools?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-sm text-muted-foreground mb-1 block">Disciplina</label>
                  <Select value={disciplineFilter} onValueChange={(v) => { setDisciplineFilter(v); setTopicFilter("all"); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as disciplinas</SelectItem>
                      {disciplines?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {disciplineFilter !== "all" && (
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-sm text-muted-foreground mb-1 block">Tópico</label>
                    <Select value={topicFilter} onValueChange={setTopicFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os tópicos</SelectItem>
                        {topics?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          {statsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Questões Respondidas</CardTitle>
                    <Search className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalAnswered || 0}</div>
                    <p className="text-xs text-muted-foreground">No período selecionado</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Acertos</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{stats?.correctAnswers || 0}</div>
                    <p className="text-xs text-muted-foreground">Respostas corretas</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Erros</CardTitle>
                    <XCircle className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{stats?.wrongAnswers || 0}</div>
                    <p className="text-xs text-muted-foreground">Respostas incorretas</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Taxa de Acerto</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.accuracyRate || 0}%</div>
                    <p className="text-xs text-muted-foreground">Desempenho geral</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <Tabs defaultValue="evolucao" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="evolucao">Evolução</TabsTrigger>
                  <TabsTrigger value="disciplinas">Por Disciplina</TabsTrigger>
                  <TabsTrigger value="topicos">Por Tópico</TabsTrigger>
                </TabsList>

                <TabsContent value="evolucao" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="md:col-span-2">
                      <CardHeader>
                        <CardTitle>Questões por Dia</CardTitle>
                        <CardDescription>Sua evolução ao longo do tempo</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {dailyStats && dailyStats.length > 0 ? (
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={dailyStats}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="date" className="text-xs" />
                              <YAxis className="text-xs" />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'hsl(var(--card))', 
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px'
                                }} 
                              />
                              <Legend />
                              <Line type="monotone" dataKey="correct" name="Acertos" stroke="hsl(142, 71%, 45%)" strokeWidth={2} />
                              <Line type="monotone" dataKey="wrong" name="Erros" stroke="hsl(var(--destructive))" strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                            Nenhum dado no período selecionado
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Distribuição</CardTitle>
                        <CardDescription>Acertos vs Erros</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {stats && stats.totalAnswered > 0 ? (
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                label={({ name, value }) => `${name}: ${value}`}
                              >
                                <Cell fill="hsl(142, 71%, 45%)" />
                                <Cell fill="hsl(var(--destructive))" />
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                            Sem dados
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="disciplinas" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Desempenho por Disciplina</CardTitle>
                      <CardDescription>Top 10 disciplinas mais praticadas</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {disciplineStats && disciplineStats.length > 0 ? (
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={disciplineStats} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={150} className="text-xs" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))', 
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                              formatter={(value: number, name: string) => [value, name === 'correct' ? 'Acertos' : 'Erros']}
                            />
                            <Legend formatter={(value) => value === 'correct' ? 'Acertos' : 'Erros'} />
                            <Bar dataKey="correct" stackId="a" fill="hsl(142, 71%, 45%)" name="correct" />
                            <Bar dataKey="wrong" stackId="a" fill="hsl(var(--destructive))" name="wrong" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                          Nenhum dado no período selecionado
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="topicos" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Desempenho por Tópico</CardTitle>
                      <CardDescription>Top 10 tópicos mais praticados</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {topicStats && topicStats.length > 0 ? (
                        <div className="space-y-4">
                          {topicStats.map((topic, index) => (
                            <div key={index} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm">{topic.name}</p>
                                  <p className="text-xs text-muted-foreground">{topic.disciplineName}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold">{topic.rate}%</p>
                                  <p className="text-xs text-muted-foreground">{topic.correct}/{topic.total} acertos</p>
                                </div>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${topic.rate}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                          Nenhum dado no período selecionado
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/banco-questoes${fromSuffix}`)}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Search className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Banco de Questões</CardTitle>
                    <CardDescription>Pratique com questões filtradas por disciplina, banca e ano</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/cadernos${fromSuffix}`)}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-foreground" />
                  </div>
                  <div>
                    <CardTitle>Meus Cadernos</CardTitle>
                    <CardDescription>
                      {stats?.notebooksCount || 0} caderno{stats?.notebooksCount !== 1 ? "s" : ""} criado{stats?.notebooksCount !== 1 ? "s" : ""}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/anotacoes${fromSuffix}`)}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle>Minhas Anotações</CardTitle>
                    <CardDescription>Anotações organizadas por disciplina e tópico</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>
      </main>
    </div>
    </ConselhoThemeWrapper>
  );
}
