import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCardAccess } from "@/hooks/useCardAccess";
import { useUserProducts } from "@/hooks/useUserProducts";
import { useRef, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { 
  Calendar, Search, Bot, FileText, MapPin, PenLine, 
  PlayCircle, MessageSquarePlus, RotateCcw, ArrowLeft, 
  Crown, Lock, ChevronRight, ChevronLeft, Sparkles
} from "lucide-react";
import logoDqIcon from "@/assets/logo-dq-icon.png";

// Premium card images for Conselho IF
import imgRecursosExclusivos from "@/assets/conselho/card-recursos-exclusivos.jpg";
import imgBgTexture from "@/assets/conselho/bg-texture.jpg";
import imgCronograma from "@/assets/conselho/card-cronograma.jpg";
import imgBancoQuestoes from "@/assets/conselho/card-banco-questoes.jpg";
import imgRoboTutor from "@/assets/conselho/card-robo-tutor.jpg";
import imgRevisao from "@/assets/conselho/card-revisao-tatica.jpg";
import imgMapa from "@/assets/conselho/card-mapa-questoes.jpg";
import imgMateriais from "@/assets/conselho/card-materiais.jpg";
import imgDissertativa from "@/assets/conselho/card-dissertativa.jpg";
import imgDidatica from "@/assets/conselho/card-didatica.jpg";
import imgComunidades from "@/assets/conselho/card-comunidades.jpg";

interface ConselhoModule {
  id: string;
  cardId: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  image: string;
  path: string;
  comingSoon?: boolean;
}

interface ConselhoSection {
  id: string;
  title: string;
  modules: ConselhoModule[];
}

const sections: ConselhoSection[] = [
  {
    id: "ferramentas",
    title: "Ferramentas de Alta Performance",
    modules: [
      {
        id: "cronograma",
        cardId: "cronograma",
        title: "Cronograma Inteligente",
        subtitle: "Plano de estudos com revisões espaçadas",
        icon: Calendar,
        image: imgCronograma,
        path: "/cronograma?from=conselho-if",
      },
      {
        id: "banco-questoes",
        cardId: "banco-questoes",
        title: "Questões Ultraselecionadas",
        subtitle: "Banco curado de alto rendimento",
        icon: Search,
        image: imgBancoQuestoes,
        path: "/banco-questoes/dashboard?from=conselho-if",
      },
      {
        id: "robo-tutor",
        cardId: "robo-tutor",
        title: "Robô Tutor",
        subtitle: "IA especializada em explicações",
        icon: Bot,
        image: imgRoboTutor,
        path: "/tutor?from=conselho-if",
      },
      {
        id: "revisao-tatica",
        cardId: "revisao-tatica",
        title: "Revisão Tática",
        subtitle: "Flashcards estratégicos",
        icon: RotateCcw,
        image: imgRevisao,
        path: "/revisao-tatica",
        comingSoon: true,
      },
    ],
  },
  {
    id: "cursos",
    title: "Cursos & Comunidade",
    modules: [
      {
        id: "mapa-questoes",
        cardId: "mapa-questoes",
        title: "Mapa das Questões",
        subtitle: "Análise de tópicos mais cobrados",
        icon: MapPin,
        image: imgMapa,
        path: "/mapa-das-questoes?from=conselho-if",
      },
      {
        id: "materiais-dissecados",
        cardId: "materiais-dissecados",
        title: "Materiais Dissecados",
        subtitle: "PDFs e materiais organizados",
        icon: FileText,
        image: imgMateriais,
        path: "/materiais-dissecados?from=conselho-if",
      },
      {
        id: "dissertativa",
        cardId: "dissecando-dissertativa",
        title: "Dissecando a Dissertativa",
        subtitle: "Correção por IA e questões inéditas",
        icon: PenLine,
        image: imgDissertativa,
        path: "/dissertativa?from=conselho-if",
      },
      {
        id: "didatica",
        cardId: "dissecando-didatica",
        title: "Dissecando a Didática",
        subtitle: "Videoaulas e materiais exclusivos",
        icon: PlayCircle,
        image: imgDidatica,
        path: "/didatica?from=conselho-if",
      },
      {
        id: "comunidades",
        cardId: "comunidades-dissecadores",
        title: "Comunidades Dissecadores",
        subtitle: "Ande com quem quer o mesmo que você",
        icon: MessageSquarePlus,
        image: imgComunidades,
        path: "/comunidades?from=conselho-if",
      },
    ],
  },
];

function ModuleCard({ 
  mod, 
  isUnlocked, 
  index, 
  onClick 
}: { 
  mod: ConselhoModule; 
  isUnlocked: boolean; 
  index: number;
  onClick: () => void;
}) {
  const Icon = mod.icon;
  const locked = !isUnlocked || mod.comingSoon;

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      onClick={locked ? undefined : onClick}
      disabled={locked}
      className="group relative flex-shrink-0 w-[200px] sm:w-[220px] md:w-[240px] focus:outline-none"
    >
      {/* 9:16 aspect ratio card */}
      <div className="relative aspect-[9/16] rounded-xl overflow-hidden border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300 group-hover:scale-[1.04] group-hover:shadow-[0_12px_48px_rgba(212,175,55,0.15)] group-hover:border-amber-500/30">
        {/* Background image */}
        <img 
          src={mod.image} 
          alt={mod.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />
        
        {/* Top icon badge */}
        <div className="absolute top-3 left-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/20 backdrop-blur-md border border-amber-500/30 flex items-center justify-center">
            <Icon className="w-4 h-4 text-amber-400" />
          </div>
        </div>

        {/* Coming soon / locked overlay */}
        {locked && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-10">
            {mod.comingSoon ? (
              <span className="text-xs font-semibold tracking-widest uppercase text-amber-400/90 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
                Em Breve
              </span>
            ) : (
              <Lock className="w-6 h-6 text-white/40" />
            )}
          </div>
        )}

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
          <h3 className="text-sm font-bold text-white leading-tight mb-1 drop-shadow-lg">
            {mod.title}
          </h3>
          <p className="text-[11px] text-white/60 leading-snug line-clamp-2">
            {mod.subtitle}
          </p>
          
          {/* Hover arrow indicator */}
          {!locked && (
            <div className="mt-2 flex items-center gap-1 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Acessar</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}
function SectionRow({ section, sIdx, isCardUnlocked, navigate }: { 
  section: ConselhoSection; 
  sIdx: number; 
  isCardUnlocked: (cardId: string) => boolean;
  navigate: (path: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  const scroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === "left" ? -220 : 220;
    el.scrollBy({ left: amount, behavior: "smooth" });
    setTimeout(updateScrollState, 350);
  }, [updateScrollState]);

  return (
    <section className="px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Section title */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: sIdx * 0.15, duration: 0.4 }}
          className="mb-5 sm:mb-6"
        >
          <h3 className="text-lg sm:text-xl font-bold text-white/90 tracking-tight">
            {section.title}
          </h3>
          <div className="mt-1.5 w-12 h-0.5 bg-gradient-to-r from-amber-500 to-transparent rounded-full" />
        </motion.div>

        {/* Scroll container with arrows */}
        <div className="relative group/scroll">
          {/* Left arrow — outside the cards */}
          {canScrollLeft && (
            <button
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 hidden sm:flex opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-200"
            >
              <div className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors shadow-lg">
                <ChevronLeft className="w-4 h-4 text-white" />
              </div>
            </button>
          )}

          {/* Right arrow — outside the cards */}
          {canScrollRight && (
            <button
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 hidden sm:flex opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-200"
            >
              <div className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors shadow-lg">
                <ChevronRight className="w-4 h-4 text-white" />
              </div>
            </button>
          )}

          {/* Scrollable row */}
          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className="flex flex-nowrap gap-4 sm:gap-5 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
          >
            {section.modules.map((mod, mIdx) => (
              <div key={mod.id} className="snap-start">
                <ModuleCard
                  mod={mod}
                  isUnlocked={isCardUnlocked(mod.cardId)}
                  index={sIdx * 3 + mIdx}
                  onClick={() => navigate(mod.path)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ConselhoIF() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isCardUnlocked } = useCardAccess(user?.id);
  const { data: userProducts = [] } = useUserProducts(user?.email ?? undefined);

  const isConselhoOnly = useMemo(() => {
    if (userProducts.length === 0) return false;
    return userProducts.length === 1 && userProducts[0].slug === "conselho-if";
  }, [userProducts]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#141418] flex items-center justify-center">
      <div className="w-8 h-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
    </div>
  );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#1a1a20] text-white overflow-x-hidden relative">
      {/* Paper texture background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img src={imgBgTexture} alt="" className="w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-[#1a1a20]/35" />
      </div>

      {/* Header */}
      <header className="relative z-20 border-b border-white/[0.06] bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isConselhoOnly && (
              <button
                onClick={() => navigate("/")}
                className="w-9 h-9 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/[0.08] flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-white/70" />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <img src={logoDqIcon} alt="DQ" className="w-8 h-8 rounded-lg" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-white">
                    O Conselho IF
                  </h1>
                  <Crown className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-[11px] text-white/40 font-medium tracking-wide uppercase">
                  Mentoria de Aceleração
                </p>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 bg-amber-500/[0.08] border border-amber-500/20 rounded-full px-4 py-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-amber-300/90 tracking-wide">
              ACESSO EXCLUSIVO
            </span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-medium text-amber-300/80 tracking-wider uppercase">
                Vagas Limitadas
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-[1.1] mb-4">
              <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                Mentoria de Aceleração
              </span>
              <br />
              <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                Individual para Professores
              </span>
            </h2>
            <p className="text-base sm:text-lg text-white/50 leading-relaxed max-w-lg">
              Acesso completo a todas as ferramentas, cursos e materiais da plataforma 
              com acompanhamento individual personalizado de alto nível para se tornar Professor do IF em tempo recorde.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Recursos Exclusivos Banner */}
      <section className="relative z-10 px-4 sm:px-6 -mt-2 mb-10 sm:mb-14">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
          >
            <div className="relative">
              <img
                src={imgRecursosExclusivos}
                alt="Recursos Exclusivos do Conselho"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
              <div className="relative flex flex-col justify-between p-6 sm:p-8 md:p-10 min-h-[260px] sm:min-h-[220px]">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-5 h-5 text-amber-400" />
                    <span className="text-[11px] font-semibold text-amber-400/80 tracking-widest uppercase">
                      Conselho IF
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white leading-tight">
                    Recursos Exclusivos do Conselho
                  </h2>
                  <p className="mt-2 text-sm text-white/50 max-w-md hidden sm:block">
                    Ferramentas, cursos e materiais desenvolvidos para acelerar sua aprovação.
                  </p>
                </div>
                {/* Action cards inside banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-6">
                  {[
                    { label: "Grupo Individual", icon: Crown, path: "/conselho-if/grupo" },
                    { label: "Sessões Gravadas", icon: PlayCircle, path: "/conselho-if/sessoes" },
                    { label: "Relatórios Semanais", icon: FileText, path: "/conselho-if/relatorios" },
                    { label: "Marque com o Mentor", icon: MessageSquarePlus, path: "/conselho-if/mentor" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => navigate(item.path)}
                      className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-black/40 backdrop-blur-sm border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all text-left group"
                    >
                      <item.icon className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-xs sm:text-sm font-semibold text-white/80 group-hover:text-white transition-colors truncate">
                        {item.label}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-amber-400/60 ml-auto shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Sections */}
      <div className="relative z-10 pb-20 space-y-12 sm:space-y-16">
        {sections.map((section, sIdx) => {
          return <SectionRow key={section.id} section={section} sIdx={sIdx} isCardUnlocked={isCardUnlocked} navigate={navigate} />;
        })}
      </div>

      {/* Footer accent */}
      <div className="relative z-10 border-t border-white/[0.04] py-8 text-center">
        <p className="text-xs text-white/20 font-medium tracking-wider uppercase">
          Conselho IF · Dissecando Questões
        </p>
      </div>
    </div>
  );
}
