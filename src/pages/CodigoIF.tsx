import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Search, FileText, MapPin, BookOpen, Target, TrendingUp, FolderOpen, BarChart3, LogOut, Shield, Code } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { gatewayTexture, gatewayTextureOpacity, gatewayCards } from "@/data/gatewayAssets";
import logoDqIcon from "@/assets/logo-dq-icon.png";

export default function CodigoIF() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  const modules = [
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
      path: "/banco-questoes/dashboard",
      stats: "Comece a praticar agora",
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
      path: "/mapa-das-questoes",
      stats: "Análise inteligente",
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
      path: "/materiais-dissecados",
      stats: "Materiais de estudo",
    },
  ];

  return (
    <div className="min-h-screen relative">
      {/* Paper texture background */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ backgroundColor: 'hsl(var(--background))' }} />
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
                <h1 className="font-heading text-xl font-bold flex items-center gap-2">
                  <Code className="w-5 h-5 text-primary" />
                  Código IF
                </h1>
                <p className="text-sm text-muted-foreground">Desvende os códigos e padrões das avaliações</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Área de Membros
              </Button>
              <ThemeToggle />
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
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-2"
          >
            <h2 className="font-heading text-3xl md:text-4xl font-bold">
              Ferramentas do Código IF
            </h2>
            <p className="text-lg text-muted-foreground">
              Explore os recursos para desvendar os padrões das avaliações
            </p>
          </motion.div>

          {/* Tutorial Action Card */}
          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <button
              onClick={() => navigate("/tutoriais?from=codigo-if&product=codigo_if")}
              className="group relative overflow-hidden rounded-xl bg-[hsl(210,30%,25%)] text-white w-full max-w-[220px] aspect-[4/2] flex flex-col justify-end p-3 text-left hover:shadow-xl transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="relative z-10">
                <h3 className="text-sm font-bold leading-tight">Tutoriais</h3>
                <p className="text-xs text-white/80 font-medium">Comece por aqui</p>
                <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-[hsl(198,93%,59%)]">
                  <span>Acessar</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>
          </motion.div>

          {/* Image-based Card Grid */}
          <div className="grid gap-6 grid-cols-2 md:grid-cols-3">
            {modules.map((mod, i) => {
              const Icon = mod.icon;
              const bgImage = gatewayCards[mod.cardId];
              return (
                <motion.div
                  key={mod.id}
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                >
                  <div
                    style={{ aspectRatio: "4/5" }}
                    className="relative rounded-lg border-2 border-border overflow-hidden flex flex-col transition-all duration-300 group cursor-pointer hover:border-primary hover:shadow-[0_0_30px_-4px_hsl(var(--ring)/0.4)]"
                    onClick={() => navigate(`${mod.path}?from=codigo-if`)}
                  >
                    {/* Image area - 65% */}
                    <div className="relative overflow-hidden" style={{ flex: 65 }}>
                      {bgImage ? (
                        <img
                          src={bgImage}
                          alt={mod.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-secondary/50" />
                      )}
                      <div className="absolute inset-0 z-[5] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </div>

                    {/* Text area - 35% */}
                    <div className="relative bg-[#1a1a2e] px-4 py-3 flex flex-col justify-between [--primary:198_93%_59%]" style={{ flex: 35 }}>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="w-5 h-5 text-primary flex-shrink-0" />
                          <h3 className="font-bold text-white text-base md:text-lg leading-tight line-clamp-1">
                            {mod.title}
                          </h3>
                        </div>
                        <p className="text-white/70 text-sm leading-relaxed line-clamp-2 mb-2">
                          {mod.description}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {mod.features.map((feat, fi) => {
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
                        <span className="text-sm font-medium text-primary/90 line-clamp-1">{mod.stats}</span>
                        <ArrowRight className="w-5 h-5 text-primary flex-shrink-0 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
