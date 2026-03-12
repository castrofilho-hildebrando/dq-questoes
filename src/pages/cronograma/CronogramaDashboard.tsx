import ConselhoThemeWrapper from "@/components/ConselhoThemeWrapper";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangeFilter } from "@/components/cronograma/dashboard/DateRangeFilter";
import {
  Loader2, ArrowLeft, FileQuestion, Target, Clock,
  Flame, TrendingUp, BookOpen, PlayCircle, Globe
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useCronogramaDashboardData } from "@/hooks/useCronogramaDashboardData";
import { StatCard } from "@/components/cronograma/dashboard/StatCard";
import { ProgressCard } from "@/components/cronograma/dashboard/ProgressCard";
import { PerformanceChart } from "@/components/cronograma/dashboard/PerformanceChart";
import { UpcomingSchedule } from "@/components/cronograma/dashboard/UpcomingSchedule";
import { RecentActivity } from "@/components/cronograma/dashboard/RecentActivity";
import { EvolutionTracker } from "@/components/cronograma/dashboard/EvolutionTracker";
import { useGlobalDashboardData } from "@/hooks/useGlobalDashboardData";

interface UserCronograma {
  id: string;
  name: string;
  school_id: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  schools?: { id: string; name: string };
}

function CronogramaTabContent({
  cronograma,
  fromSuffix,
}: {
  cronograma: UserCronograma;
  fromSuffix: string;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const dashboardData = useCronogramaDashboardData(cronograma.id, dateRange.from, dateRange.to);

  if (dashboardData.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Questões Resolvidas"
          value={dashboardData.totalQuestionsResolved}
          subtitle={`${dashboardData.questionsThisWeek} esta semana`}
          icon={FileQuestion}
          colorClass="cyan"
          delay={0}
        />
        <StatCard
          title="Taxa de Acerto"
          value={`${dashboardData.accuracyRate}%`}
          icon={Target}
          colorClass="green"
          delay={0.05}
        />
        <StatCard
          title="Horas de Estudo"
          value={`${dashboardData.totalStudyHours}h`}
          subtitle={`${dashboardData.studyHoursThisMonth}h este mês`}
          icon={Clock}
          colorClass="purple"
          delay={0.1}
        />
        <StatCard
          title="Sequência Atual"
          value={`${dashboardData.currentStreak} dias`}
          icon={Flame}
          colorClass="warning"
          delay={0.15}
        />
      </div>

      {/* Today's Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Progresso de Hoje</h3>
                <p className="text-sm text-muted-foreground">
                  {dashboardData.todayProgress.completed} de {dashboardData.todayProgress.total} tarefas concluídas
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-primary">
                  {dashboardData.todayProgress.percentage}%
                </span>
              </div>
            </div>
            <Progress value={dashboardData.todayProgress.percentage} className="h-3" />
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <PerformanceChart data={dashboardData.weeklyPerformance} />

          {dashboardData.subjectStats.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.25 }}
            >
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Desempenho por Matéria
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dashboardData.subjectStats.map((subject, index) => (
                    <ProgressCard
                      key={subject.disciplineId}
                      subject={subject.subject}
                      percentage={subject.percentage}
                      total={subject.total}
                      correct={subject.correct}
                      colorIndex={index}
                    />
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          <EvolutionTracker cronogramaId={cronograma.id} />
        </div>

        <div className="space-y-6">
          <UpcomingSchedule
            items={dashboardData.todaySchedule}
            onClick={() => navigate(`/cronograma/${cronograma.id}${fromSuffix}`)}
          />
          <RecentActivity items={dashboardData.recentActivity} />
        </div>
      </div>
    </div>
  );
}

function GlobalTabContent() {
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const dashboardData = useGlobalDashboardData(dateRange.from, dateRange.to);

  if (dashboardData.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Questões Resolvidas" value={dashboardData.totalQuestionsResolved} subtitle={`${dashboardData.questionsThisWeek} esta semana`} icon={FileQuestion} colorClass="cyan" delay={0} />
        <StatCard title="Taxa de Acerto" value={`${dashboardData.accuracyRate}%`} icon={Target} colorClass="green" delay={0.05} />
        <StatCard title="Horas de Estudo" value={`${dashboardData.totalStudyHours}h`} subtitle={`${dashboardData.studyHoursThisMonth}h este mês`} icon={Clock} colorClass="purple" delay={0.1} />
        <StatCard title="Sequência Atual" value={`${dashboardData.currentStreak} dias`} icon={Flame} colorClass="warning" delay={0.15} />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Progresso de Hoje</h3>
                <p className="text-sm text-muted-foreground">{dashboardData.todayProgress.completed} de {dashboardData.todayProgress.total} tarefas concluídas</p>
              </div>
              <span className="text-2xl font-bold text-primary">{dashboardData.todayProgress.percentage}%</span>
            </div>
            <Progress value={dashboardData.todayProgress.percentage} className="h-3" />
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <PerformanceChart data={dashboardData.weeklyPerformance} />
          {dashboardData.subjectStats.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.25 }}>
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Desempenho por Matéria
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dashboardData.subjectStats.map((subject, index) => (
                    <ProgressCard key={subject.disciplineId} subject={subject.subject} percentage={subject.percentage} total={subject.total} correct={subject.correct} colorIndex={index} />
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
        <div className="space-y-6">
          <RecentActivity items={dashboardData.recentActivity} />
        </div>
      </div>
    </div>
  );
}

export default function CronogramaDashboard() {
  const navigate = useNavigate();
  const { goBack, fromSuffix } = useBackNavigation();
  const { user, loading: authLoading } = useAuth();

  const { data: cronogramas, isLoading } = useQuery({
    queryKey: ["user-cronogramas-active", user?.id],
    queryFn: async (): Promise<UserCronograma[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_cronogramas")
        .select("*, schools (id, name)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as UserCronograma[];
    },
    enabled: !!user?.id,
  });

  const [activeTab, setActiveTab] = useState<string>("");

  // Set default tab to first cronograma
  const activeCronogramas = cronogramas || [];
  if (activeCronogramas.length > 0 && !activeTab) {
    // Will be set on first render via useEffect-like behavior
  }

  const defaultTab = "global";
  const currentTab = activeTab || defaultTab;

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (activeCronogramas.length === 0) {
    return (
      <ConselhoThemeWrapper>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Nenhum cronograma ativo encontrado</p>
          <Button onClick={goBack}>Voltar</Button>
        </div>
      </ConselhoThemeWrapper>
    );
  }

  const selectedCronograma = activeCronogramas.find(c => c.id === currentTab) || activeCronogramas[0];

  return (
    <ConselhoThemeWrapper>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={goBack}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="font-heading text-xl font-bold">Dashboard do Cronograma</h1>
                  <p className="text-sm text-muted-foreground">Acompanhe seu progresso</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-6 py-6 space-y-6">
          {/* Prominent CTA Button - only show when a specific cronograma is selected */}
          {currentTab !== "global" && selectedCronograma && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Button
                size="lg"
                className="w-full sm:w-auto text-base font-semibold gap-2 h-14 px-8 shadow-lg hover:shadow-xl transition-all"
                onClick={() => navigate(`/cronograma/${selectedCronograma.id}${fromSuffix}`)}
              >
                <PlayCircle className="w-5 h-5" />
                Estudar Agora
              </Button>
            </motion.div>
          )}

          {/* Tabs for each cronograma */}
          <Tabs value={currentTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="global" className="gap-1.5">
                <Globe className="w-4 h-4" />
                Visão Global
              </TabsTrigger>
              {activeCronogramas.map((c) => (
                <TabsTrigger key={c.id} value={c.id} className="min-w-0 truncate max-w-[250px]">
                  {c.schools?.name || c.name}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="global">
              <GlobalTabContent />
            </TabsContent>

            {activeCronogramas.map((c) => (
              <TabsContent key={c.id} value={c.id}>
                <CronogramaTabContent
                  cronograma={c}
                  fromSuffix={fromSuffix}
                />
              </TabsContent>
            ))}
          </Tabs>
        </main>
      </div>
    </ConselhoThemeWrapper>
  );
}
