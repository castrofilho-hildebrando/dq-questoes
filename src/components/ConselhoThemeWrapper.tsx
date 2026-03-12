import { useSearchParams } from "react-router-dom";
import imgBgTexture from "@/assets/conselho/bg-texture.jpg";

/**
 * Wraps page content with the Conselho IF premium dark theme
 * when ?from=conselho-if is present in the URL.
 * 
 * Overrides CSS variables so all shadcn components automatically
 * inherit the dark graphite + gold aesthetic.
 * 
 * ZERO changes to child components — purely additive.
 */

const CONSELHO_THEME_VARS: Record<string, string> = {
  "--background": "240 6% 10%",
  "--foreground": "40 10% 92%",
  "--card": "240 5% 14%",
  "--card-foreground": "40 10% 90%",
  "--popover": "240 5% 14%",
  "--popover-foreground": "40 10% 92%",
  "--primary": "43 90% 55%",
  "--primary-foreground": "240 6% 10%",
  "--secondary": "240 4% 20%",
  "--secondary-foreground": "40 10% 88%",
  "--muted": "240 4% 18%",
  "--muted-foreground": "40 6% 65%",
  "--accent": "240 4% 18%",
  "--accent-foreground": "40 10% 90%",
  "--destructive": "0 72% 55%",
  "--destructive-foreground": "0 85% 97%",
  "--border": "240 4% 22%",
  "--input": "240 4% 22%",
  "--ring": "43 90% 55%",
  "--chart-1": "43 90% 55%",
  "--chart-2": "150 60% 45%",
  "--chart-3": "0 72% 55%",
  "--chart-4": "200 70% 50%",
  "--chart-5": "280 50% 50%",
  "--sidebar": "240 6% 8%",
  "--sidebar-foreground": "40 10% 92%",
  "--sidebar-primary": "43 90% 55%",
  "--sidebar-primary-foreground": "240 6% 10%",
  "--sidebar-accent": "240 4% 16%",
  "--sidebar-accent-foreground": "40 10% 85%",
  "--sidebar-border": "240 4% 20%",
  "--sidebar-ring": "43 90% 55%",
};

export function useIsConselhoTheme() {
  const [searchParams] = useSearchParams();
  return searchParams.get("from") === "conselho-if";
}

export default function ConselhoThemeWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const isConselho = useIsConselhoTheme();

  if (!isConselho) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative min-h-screen text-[hsl(40,10%,92%)]"
      style={CONSELHO_THEME_VARS as React.CSSProperties}
    >
      {/* Paper texture background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[hsl(240,6%,10%)]" />
        <img
          src={imgBgTexture}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-[hsl(240,6%,10%)]/35" />
      </div>

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
