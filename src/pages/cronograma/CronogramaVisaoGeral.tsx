import ConselhoThemeWrapper from "@/components/ConselhoThemeWrapper";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, ArrowLeft, FileQuestion, Target, Clock, 
  Flame, TrendingUp, BookOpen 
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useCronogramaDashboardData } from "@/hooks/useCronogramaDashboardData";
import { StatCard } from "@/components/cronograma/dashboard/StatCard";
import { ProgressCard } from "@/components/cronograma/dashboard/ProgressCard";
import { PerformanceChart } from "@/components/cronograma/dashboard/PerformanceChart";
import { UpcomingSchedule } from "@/components/cronograma/dashboard/UpcomingSchedule";
import { RecentActivity } from "@/components/cronograma/dashboard/RecentActivity";
import { EvolutionTracker } from "@/components/cronograma/dashboard/EvolutionTracker";

interface Cronograma {
  id: string;
  name: string;
  school_id: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  schools?: {
    id: string;
    name: string;
  };
}

export default function CronogramaVisaoGeral() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { fromSuffix } = useBackNavigation();
  const { user, loading: authLoading } = useAuth();

  // Fetch cronograma details
  const { data: cronograma, isLoading: loadingCronograma } = useQuery({
    queryKey: ["cronograma", id],
    queryFn: async (): Promise<Cronograma | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("user_cronogramas")
        .select(`*, schools (id, name)`)
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data as Cronograma;
    },
    enabled: !!id,
  });

  // Use the dashboard data hook
  const dashboardData = useCronogramaDashboardData(id);

  if (authLoading || loadingCronograma || dashboardData.loading) {
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

  if (!cronograma) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Cronograma não encontrado</p>
        <Button onClick={() => navigate(`/cronograma${fromSuffix}`)}>Voltar</Button>
      </div>
    );
  }

  return (
    <ConselhoThemeWrapper>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(`/cronograma${fromSuffix}`)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-heading text-xl font-bold">{cronograma.name}</h1>
                <p className="text-sm text-muted-foreground">{cronograma.schools?.name} • Visão Geral</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => navigate(`/cronograma/${id}${fromSuffix}`)}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Estudar
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-6 space-y-6">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold">
              Olá, {user.email?.split("@")[0]}! 👋
            </h2>
            <p className="text-muted-foreground">
              Continue firme nos estudos. Você está no caminho certo!
            </p>
          </div>
        </motion.div>

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

        {/* Today's Progress Card */}
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
              <Progress 
                value={dashboardData.todayProgress.percentage} 
                className="h-3"
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Performance Chart */}
            <PerformanceChart data={dashboardData.weeklyPerformance} />

            {/* Subject Stats */}
            {dashboardData.subjectStats.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.25 }}
              >
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Desempenho por Matéria
                      </CardTitle>
                    </div>
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

            {/* Evolution Tracker */}
            <EvolutionTracker cronogramaId={id} />
          </div>

          {/* Right Column (1/3) */}
          <div className="space-y-6">
            {/* Today's Schedule */}
            <UpcomingSchedule 
              items={dashboardData.todaySchedule}
              onClick={() => navigate(`/cronograma/${id}${fromSuffix}`)}
            />

            {/* Recent Activity */}
            <RecentActivity items={dashboardData.recentActivity} />
          </div>
        </div>
      </main>
    </div>
    </ConselhoThemeWrapper>
  );
}
