import { useState, useMemo } from "react";
import logoDqIcon from "@/assets/logo-dq-icon.png";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useInternalAccess } from "@/components/auth/RequireInternalAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Search, Shield, LogOut, ArrowRight, ArrowLeft, Clock, Target, BookOpen, TrendingUp, Flame, CheckCircle2, Timer, Bot, Sparkles, Settings2, MessageSquarePlus, FileText, MapPin, BarChart3, FolderOpen, ExternalLink, PlayCircle, ChevronDown, ChevronRight, Video, PenLine, RotateCcw } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useStudentCronogramaStats } from "@/hooks/useStudentCronogramaStats";
import { Progress } from "@/components/ui/progress";
import { EditUserAreasDialog } from "@/components/EditUserAreasDialog";
import { gatewayTexture, gatewayTextureOpacity, gatewayCards } from "@/data/gatewayAssets";
import { useCardAccess } from "@/hooks/useCardAccess";
import cronogramaCardImg from "@/assets/gateway/classic-card-cronograma.jpg";


export default function StudentWelcome() {
  const [editAreasOpen, setEditAreasOpen] = useState(false);
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { hasInternalAccess } = useInternalAccess();
  const { isCardUnlocked } = useCardAccess(user?.id);



  // Fetch cronograma stats
  const { data: cronogramaStats } = useStudentCronogramaStats(user?.id);

  // Fetch user's active cronogramas count
  const { data: cronogramasCount } = useQuery({
    queryKey: ["user-cronogramas-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from("user_cronogramas")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true);
      return count || 0;
    },
    enabled: !!user?.id,
  });

  // Fetch user's profile to get full_name
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Get the user's first name for greeting
  const userName = useMemo(() => {
    const fullName = userProfile?.full_name || user?.user_metadata?.full_name;
    if (!fullName) return null;
    const firstName = fullName.trim().split(" ")[0];
    return firstName;
  }, [userProfile?.full_name, user?.user_metadata?.full_name]);

  // Fetch user's questions answered today
  const { data: todayStats } = useQuery({
    queryKey: ["today-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return { total: 0, correct: 0 };
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data } = await supabase
        .from("user_answers")
        .select("is_correct")
        .eq("user_id", user.id)
        .gte("answered_at", today.toISOString());
      
      const total = data?.length || 0;
      const correct = data?.filter(a => a.is_correct).length || 0;
      return { total, correct };
    },
    enabled: !!user?.id,
  });

  // Fetch suggestions link from platform config
  const { data: suggestionsLink } = useQuery({
    queryKey: ["platform-config-suggestions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_config")
        .select("value")
        .eq("id", "suggestions_link")
        .maybeSingle();
      return data?.value || null;
    },
  });

  // Fetch tutorial videos
  const { data: tutorialFolders = [] } = useQuery({
    queryKey: ["tutorial-folders-home", "dossie-if"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tutorial_video_folders")
        .select("*")
        .eq("is_active", true)
        .eq("module", "dossie-if")
        .order("display_order");
      return data || [];
    },
  });

  const { data: tutorialVideos = [] } = useQuery({
    queryKey: ["tutorial-videos-home", "dossie-if"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tutorial_videos")
        .select("*")
        .eq("is_active", true)
        .eq("module", "dossie-if")
        .order("display_order");
      return data || [];
    },
  });

  const [expandedTutorialFolders, setExpandedTutorialFolders] = useState<Set<string>>(new Set());
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  const toggleTutorialFolder = (id: string) => {
    setExpandedTutorialFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
    return match?.[1] || null;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (authLoading) {
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

  /** Map of cardId → Gateway image */
  const cardImages: Record<string, string> = {
    "cronograma": cronogramaCardImg,
    "banco-questoes": gatewayCards["banco-questoes"],
    "robo-tutor": gatewayCards["robo-tutor"],
    "materiais-dissecados": gatewayCards["materiais-dissecados"],
    "dissecando-dissertativa": gatewayCards["dissecando-dissertativa"],
    "mapa-questoes": gatewayCards["mapa-questoes"],
    "dissecando-didatica": gatewayCards["dissecando-didatica"],
    "comunidades-dissecadores": gatewayCards["comunidades-dissecadores"],
    "revisao-tatica": gatewayCards["revisao-tatica"],
  };

  const mainModules = [
    {
      id: "cronograma",
      cardId: "cronograma",
      title: "Cronograma Inteligente",
      description: "Planeje seus estudos com cronogramas personalizados e revisões espaçadas",
      icon: Calendar,
      features: [
        { icon: Target, label: "Metas por tópico" },
        { icon: Clock, label: "Revisões automáticas" },
        { icon: TrendingUp, label: "Acompanhe seu progresso" },
      ],
      stats: cronogramasCount && cronogramasCount > 0 
        ? `${cronogramasCount} cronograma${cronogramasCount > 1 ? "s" : ""} ativo${cronogramasCount > 1 ? "s" : ""}`
        : "Nenhum cronograma criado",
      path: "/cronograma",
      cta: cronogramasCount && cronogramasCount > 0 ? "Continuar estudando" : "Criar cronograma",
    },
    {
      id: "banco-questoes",
      cardId: "banco-questoes",
      title: "Banco de Questões",
      description: "Pratique com milhares de questões organizadas por disciplina, banca e ano",
      icon: Search,
      features: [
        { icon: BookOpen, label: "Questões comentadas" },
        { icon: Target, label: "Filtros avançados" },
        { icon: TrendingUp, label: "Estatísticas detalhadas" },
      ],
      stats: todayStats && todayStats.total > 0 
        ? `${todayStats.total} questões hoje (${todayStats.correct} acertos)`
        : "Comece a praticar agora",
      path: "/banco-questoes/dashboard",
      cta: "Resolver questões",
    },
    {
      id: "robo-tutor",
      cardId: "robo-tutor",
      title: "Robô Tutor",
      description: "Tutores de IA especializados que explicam questões no formato dissecador",
      icon: Bot,
      features: [
        { icon: Sparkles, label: "IA especializada" },
        { icon: BookOpen, label: "Explicações detalhadas" },
        { icon: Target, label: "Por área de conhecimento" },
      ],
      stats: "Tutores prontos para ajudar",
      path: "/tutor",
      cta: "Acessar tutores",
    },
    {
      id: "materiais-dissecados",
      cardId: "materiais-dissecados",
      title: "Materiais Dissecados",
      description: "Acesso direto aos materiais organizados por disciplina e módulos",
      icon: FileText,
      features: [
        { icon: FolderOpen, label: "Por disciplina" },
        { icon: BookOpen, label: "PDFs organizados" },
        { icon: Target, label: "Busca rápida" },
      ],
      stats: "Materiais de estudo",
      path: "/materiais-dissecados",
      cta: "Acessar materiais",
    },
    {
      id: "dissertativa",
      cardId: "dissecando-dissertativa",
      title: "Dissecando a Dissertativa",
      description: "Pratique questões dissertativas inéditas com correção por inteligência artificial",
      icon: PenLine,
      features: [
        { icon: Sparkles, label: "Correção por IA" },
        { icon: Target, label: "Questões inéditas" },
        { icon: BookOpen, label: "Feedback detalhado" },
      ],
      stats: "Módulo exclusivo",
      path: "/dissertativa",
      cta: "Acessar módulo",
    },
    {
      id: "dissecando-didatica",
      cardId: "dissecando-didatica",
      title: "Dissecando a Didática",
      description: "Videoaulas e materiais exclusivos para dominar a didática no formato IF",
      icon: PlayCircle,
      features: [
        { icon: Video, label: "Videoaulas" },
        { icon: BookOpen, label: "Material exclusivo" },
        { icon: Target, label: "Formato IF" },
      ],
      stats: "Aprenda com especialistas",
      path: "/didatica?from=dossie-if",
      cta: "Acessar didática",
    },
    {
      id: "mapa-das-questoes",
      cardId: "mapa-questoes",
      title: "Mapa das Questões e Provas",
      description: "Veja os tópicos mais cobrados nas provas e consulte o baú de provas",
      icon: MapPin,
      features: [
        { icon: BarChart3, label: "Gráficos de cobertura" },
        { icon: Target, label: "Análise de tópicos" },
        { icon: FileText, label: "Baú de Provas" },
      ],
      stats: "Análise inteligente",
      path: "/mapa-das-questoes",
      cta: "Explorar mapa",
    },
    {
      id: "comunidades",
      cardId: "comunidades-dissecadores",
      title: "Comunidades Dissecadores",
      description: "Conecte-se com outros concurseiros em grupos organizados por área",
      icon: MessageSquarePlus,
      features: [
        { icon: Target, label: "Por área" },
        { icon: BookOpen, label: "Grupos ativos" },
        { icon: TrendingUp, label: "Networking" },
      ],
      stats: "Faça parte da comunidade",
      path: "/comunidades?from=dossie-if",
      cta: "Acessar comunidades",
    },
    {
      id: "revisao-tatica",
      cardId: "revisao-tatica",
      title: "Revisão Tática",
      description: "Flashcards inteligentes para revisão estratégica de tópicos críticos.",
      icon: RotateCcw,
      features: [
        { icon: Target, label: "Revisão dirigida" },
        { icon: Clock, label: "Ciclos inteligentes" },
        { icon: TrendingUp, label: "Retenção acelerada" },
      ],
      stats: "Disponível em breve",
      path: "/revisao-tatica",
      cta: "Em breve",
      comingSoon: true,
    },
  ];

  const hasCronogramaData = cronogramaStats && (
    cronogramaStats.totalStudyHours > 0 || 
    cronogramaStats.todayTasksTotal > 0 || 
    cronogramaStats.currentStreak > 0
  );

  return (
    <div className="min-h-screen relative">
      {/* Paper texture background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{ backgroundColor: 'hsl(var(--background))' }}
      />
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `url(${gatewayTexture})`,
          backgroundSize: '500px 500px',
          backgroundRepeat: 'repeat',
          opacity: gatewayTextureOpacity,
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 10% 0%, hsl(var(--primary) / 0.10) 0%, transparent 45%),
            radial-gradient(ellipse at 90% 95%, hsl(var(--accent) / 0.12) 0%, transparent 45%)
          `,
        }}
      />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border relative">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logoDqIcon} alt="Dissecando Questões" className="w-10 h-10 rounded-lg object-contain" />
              <div>
                <h1 className="font-heading text-xl font-bold">Sistema Dissecando Questões</h1>
                <p className="text-sm text-muted-foreground">Você já é professor, agora vai ser do IF</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Área de Membros
              </Button>
              <ThemeToggle />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setEditAreasOpen(true)}
                title="Editar áreas"
              >
                <Settings2 className="w-4 h-4 mr-2" />
                Áreas
              </Button>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                  <Shield className="w-4 h-4 mr-2" />
                  Admin
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12 relative z-10">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Welcome Message */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-2"
          >
            <h2 className="font-heading text-3xl md:text-4xl font-bold">
              Olá{userName ? `, ${userName}` : ""}! 👋
            </h2>
            <p className="text-lg text-muted-foreground">
              O que você gostaria de fazer hoje?
            </p>
          </motion.div>

          {/* Cronograma Stats Section */}
          {hasCronogramaData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">Seu Cronograma</CardTitle>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => navigate("/cronograma/dashboard?from=dossie-if")}
                    >
                      Ver detalhes
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Today's Progress */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Hoje</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold">
                            {cronogramaStats.todayTasksCompleted}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            /{cronogramaStats.todayTasksTotal} tarefas
                          </span>
                        </div>
                        <Progress 
                          value={cronogramaStats.todayProgressPercent} 
                          className="h-2"
                        />
                      </div>
                    </div>

                    {/* Study Hours */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Timer className="w-4 h-4" />
                        <span>Horas esta semana</span>
                      </div>
                      <p className="text-2xl font-bold">
                        {cronogramaStats.studyHoursThisWeek}
                        <span className="text-sm font-normal text-muted-foreground ml-1">h</span>
                      </p>
                    </div>

                    {/* Streak */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span>Sequência</span>
                      </div>
                      <p className="text-2xl font-bold">
                        {cronogramaStats.currentStreak}
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                          {cronogramaStats.currentStreak === 1 ? "dia" : "dias"}
                        </span>
                      </p>
                    </div>

                    {/* Total Hours */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <TrendingUp className="w-4 h-4" />
                        <span>Total estudado</span>
                      </div>
                      <p className="text-2xl font-bold">
                        {cronogramaStats.totalStudyHours}
                        <span className="text-sm font-normal text-muted-foreground ml-1">h</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Action Cards - Tutoriais & Encontros ao Vivo */}
          <motion.div
            className="grid grid-cols-2 gap-4 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: hasCronogramaData ? 0.15 : 0.05 }}
          >
            {/* Tutoriais Card */}
            <button
              onClick={() => navigate("/tutoriais?from=dossie-if&product=dossie_if")}
              className="group relative overflow-hidden rounded-2xl bg-[hsl(210,30%,25%)] text-white aspect-[4/2] flex flex-col justify-end p-5 text-left hover:shadow-xl transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="relative z-10">
                <h3 className="text-xl font-bold leading-tight">Tutoriais</h3>
                <p className="text-sm text-white/80 font-medium">Comece por aqui</p>
                <div className="flex items-center gap-2 mt-2 text-sm font-semibold text-[hsl(198,93%,59%)]">
                  <span>Acessar</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>

            {/* Encontros ao Vivo Card */}
            <button
              onClick={() => navigate("/encontros-ao-vivo?from=dossie-if")}
              className="group relative overflow-hidden rounded-2xl bg-[hsl(210,30%,25%)] text-white aspect-[4/2] flex flex-col justify-end p-5 text-left hover:shadow-xl transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="relative z-10">
                <h3 className="text-xl font-bold leading-tight">Encontros ao vivo</h3>
                <p className="text-sm text-white/80 font-medium">(Gravações)</p>
                <div className="flex items-center gap-2 mt-2 text-sm font-semibold text-[hsl(198,93%,59%)]">
                  <span>Acessar</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>
          </motion.div>

          {/* Main Module Cards - Image-based grid */}
          <div className="grid gap-6 grid-cols-2 md:grid-cols-3">
            {mainModules.map((module, index) => {
              const hasAccess = isAdmin || isCardUnlocked(module.cardId);
              const isComingSoon = 'comingSoon' in module && module.comingSoon;
              const isClickable = hasAccess && !isComingSoon;
              const bgImage = cardImages[module.cardId];
              const Icon = module.icon;

              return (
                <motion.div
                  key={module.id}
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: (hasCronogramaData ? 0.2 : 0.1) + index * 0.07 }}
                >
                  <div
                    style={{ aspectRatio: "4/5" }}
                    className={`
                      relative rounded-lg border-2 border-border overflow-hidden flex flex-col
                      transition-all duration-300 group
                      ${isClickable
                        ? "cursor-pointer hover:border-primary hover:shadow-[0_0_30px_-4px_hsl(var(--ring)/0.4)]"
                        : "cursor-not-allowed"
                      }
                      ${!hasAccess && !isComingSoon ? "opacity-50" : ""}
                    `}
                    onClick={() => isClickable && navigate(module.path)}
                  >
                    {/* Image area - 65% */}
                    <div className="relative overflow-hidden" style={{ flex: 65 }}>
                      {bgImage ? (
                        <img
                          src={bgImage}
                          alt={module.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/30 flex items-center justify-center">
                          <Icon className="w-16 h-16 text-primary/30" />
                        </div>
                      )}
                      {isClickable && (
                        <div className="absolute inset-0 z-[5] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                      )}
                    </div>

                    {/* Text area - 35% */}
                    <div className="relative bg-[#1a1a2e] px-4 py-3 flex flex-col justify-between [--primary:198_93%_59%]" style={{ flex: 35 }}>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="w-5 h-5 text-primary flex-shrink-0" />
                          <h3 className="font-bold text-white text-base md:text-lg leading-tight line-clamp-1">
                            {module.title}
                          </h3>
                        </div>
                        <p className="text-white/70 text-sm leading-relaxed line-clamp-2 mb-2">
                          {module.description}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {module.features.map((feat, fi) => {
                            const FeatIcon = feat.icon;
                            return (
                              <span key={fi} className="inline-flex items-center gap-1 text-xs text-white/60 bg-white/10 rounded-full px-2 py-0.5">
                                <FeatIcon className="w-3 h-3" />
                                {feat.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 bg-white/[0.07] rounded-lg px-3 py-2 border border-white/[0.08]">
                        <span className="text-sm font-medium text-primary/90 line-clamp-1">{module.stats}</span>
                        <ArrowRight className="w-5 h-5 text-primary flex-shrink-0 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* Coming soon overlay */}
                    {isComingSoon && (
                      <div className="absolute inset-0 z-10 bg-background/70 backdrop-blur-[1px] flex items-center justify-center">
                        <div className="bg-background/90 backdrop-blur-sm rounded-full px-4 py-2 border border-primary/40 flex items-center gap-2 shadow-lg">
                          <Clock className="w-5 h-5 text-primary" />
                          <span className="text-sm font-semibold text-primary">Em Breve</span>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Quick Stats */}
          {todayStats && todayStats.total > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="bg-muted/50">
                <CardContent className="py-4">
                  <div className="flex items-center justify-center gap-8 text-sm">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{todayStats.total}</p>
                      <p className="text-muted-foreground">Questões hoje</p>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{todayStats.correct}</p>
                      <p className="text-muted-foreground">Acertos</p>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {todayStats.total > 0 ? Math.round((todayStats.correct / todayStats.total) * 100) : 0}%
                      </p>
                      <p className="text-muted-foreground">Taxa de acerto</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </main>
      {/* Edit Areas Dialog */}
      <EditUserAreasDialog open={editAreasOpen} onOpenChange={setEditAreasOpen} />
    </div>
  );
}
