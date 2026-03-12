import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  colorClass?: "cyan" | "purple" | "green" | "warning";
  onClick?: () => void;
  delay?: number;
}

const colorStyles = {
  cyan: {
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    glow: "hover:shadow-[0_0_20px_hsl(185_100%_50%/0.2)]",
  },
  purple: {
    iconBg: "bg-accent/10",
    iconColor: "text-accent",
    glow: "hover:shadow-[0_0_20px_hsl(270_60%_60%/0.2)]",
  },
  green: {
    iconBg: "bg-success/10",
    iconColor: "text-success",
    glow: "hover:shadow-[0_0_20px_hsl(160_60%_45%/0.2)]",
  },
  warning: {
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
    glow: "hover:shadow-[0_0_20px_hsl(38_92%_50%/0.2)]",
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  colorClass = "cyan",
  onClick,
  delay = 0,
}: StatCardProps) {
  const colors = colorStyles[colorClass];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card
        className={cn(
          "p-5 border-border/50 transition-all duration-300",
          "hover:border-primary/30",
          colors.glow,
          onClick && "cursor-pointer hover:scale-[1.02]"
        )}
        onClick={onClick}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend !== undefined && (
              <div className="flex items-center gap-1 mt-1">
                <span
                  className={cn(
                    "text-xs font-medium",
                    trend > 0 && "text-success",
                    trend < 0 && "text-destructive",
                    trend === 0 && "text-muted-foreground"
                  )}
                >
                  {trend > 0 ? "+" : ""}
                  {trend}%
                </span>
                {trendLabel && (
                  <span className="text-xs text-muted-foreground">
                    {trendLabel}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className={cn("p-3 rounded-xl", colors.iconBg)}>
            <Icon className={cn("w-5 h-5", colors.iconColor)} />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
