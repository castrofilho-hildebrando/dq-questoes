import { Lock, BookOpen, Code, Crown, Map, Search, Bot, RotateCcw, FileText, PenTool, GraduationCap, Users, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import type { CourseArea } from "@/data/gatewayAssets";
import { gatewayCards } from "@/data/gatewayAssets";

const cardIcons: Record<string, React.ElementType> = {
  "dossie-if": BookOpen,
  "codigo-if": Code,
  "conselho-if": Crown,
  "mapa-questoes": Map,
  "banco-questoes": Search,
  "robo-tutor": Bot,
  "revisao-tatica": RotateCcw,
  "materiais-dissecados": FileText,
  "dissecando-dissertativa": PenTool,
  "dissecando-didatica": GraduationCap,
  "comunidades-dissecadores": Users,
};

interface GatewayCourseCardProps {
  area: CourseArea;
  index: number;
  aspectRatio?: string;
  textRatio?: number;
}

const GatewayCourseCard = ({ area, index, aspectRatio = "4/5", textRatio = 35 }: GatewayCourseCardProps) => {
  const navigate = useNavigate();
  const bgImage = gatewayCards[area.id];
  const IconComponent = cardIcons[area.id] || BookOpen;

  const isBlocked = area.locked || area.comingSoon;

  const handleClick = () => {
    if (!isBlocked && area.link) {
      navigate(`${area.link}?from=gateway`);
    }
  };

  return (
    <div style={{ perspective: 900 }}>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.92, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
        whileHover={!isBlocked ? { rotateY: 15 } : undefined}
        transition={{
          duration: 0.6,
          delay: index * 0.12,
          ease: [0.25, 0.46, 0.45, 0.94],
          rotateY: { type: "spring", stiffness: 200, damping: 18 },
        }}
        onClick={handleClick}
        style={{
          aspectRatio,
          transformStyle: "preserve-3d",
        }}
        className={`
          relative flex-shrink-0 w-[220px] md:w-[260px] rounded-lg border-2 border-border
          transition-[border-color,box-shadow] duration-300 group flex flex-col overflow-hidden
          ${isBlocked 
            ? "gateway-card-locked cursor-not-allowed" 
            : "cursor-pointer hover:border-primary hover:shadow-[0_0_30px_-4px_hsl(var(--ring)/0.4)]"
          }
        `}
      >
        {/* Image area */}
        <div className="relative overflow-hidden" style={{ flex: 100 - textRatio }}>
          {bgImage ? (
            <img
              src={bgImage}
              alt={area.name}
              className="absolute inset-0 w-full h-full object-cover"
              style={area.id === "conselho-if" ? { transform: "scale(1.25)" } : undefined}
            />
          ) : (
            <div className="absolute inset-0 bg-secondary/50" />
          )}

          {!isBlocked && (
            <div className="absolute inset-0 z-[5] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          )}
        </div>

        {/* Text area */}
        <div className="relative bg-[#1a1a2e] px-4 py-3 flex flex-col justify-center [--primary:198_93%_59%]" style={{ flex: textRatio }}>
          <div className="flex items-center gap-2 mb-1">
            <IconComponent className="w-5 h-5 text-primary flex-shrink-0" />
            <h3 className="font-bold text-white text-sm md:text-base leading-tight">
              {area.name}
            </h3>
          </div>
          <p className="text-white/70 text-xs leading-relaxed line-clamp-2">
            {area.description}
          </p>
        </div>

        {/* Coming soon overlay */}
        {area.comingSoon && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="bg-background/85 backdrop-blur-sm rounded-full px-4 py-2 border border-primary/40 flex items-center gap-2 shadow-lg">
              <Clock className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold text-primary">Em Breve</span>
            </div>
          </div>
        )}

        {/* Lock overlay */}
        {area.locked && !area.comingSoon && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="bg-background/80 backdrop-blur-sm rounded-full p-3 border border-border">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default GatewayCourseCard;
