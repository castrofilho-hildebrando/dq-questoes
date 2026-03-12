import { motion } from "framer-motion";
import GatewayCourseCard from "./GatewayCourseCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Section } from "@/data/gatewayAssets";

interface GatewaySectionRowProps {
  section: Section;
  sectionIndex: number;
  cardAspectRatio?: string;
  textRatio?: number;
  isLoading?: boolean;
}

const GatewaySectionRow = ({ section, sectionIndex, cardAspectRatio, textRatio, isLoading }: GatewaySectionRowProps) => {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: sectionIndex * 0.15 }}
      className="mb-10"
    >
      <h2 className="text-xl md:text-2xl font-bold mb-5 px-1 text-foreground">
        {section.title}
      </h2>
      <div className="flex gap-4 overflow-x-auto pt-4 pb-4 gateway-scrollbar-hide">
        {isLoading
          ? section.areas.map((area) => (
              <Skeleton
                key={area.id}
                className="flex-shrink-0 w-[220px] md:w-[260px] rounded-lg"
                style={{ aspectRatio: cardAspectRatio || "4/5" }}
              />
            ))
          : section.areas.map((area, i) => (
              <GatewayCourseCard key={area.id} area={area} index={i} aspectRatio={cardAspectRatio} textRatio={textRatio} />
            ))
        }
      </div>
    </motion.section>
  );
};

export default GatewaySectionRow;
