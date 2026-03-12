import ConselhoThemeWrapper from "@/components/ConselhoThemeWrapper";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { useUserProducts } from "@/hooks/useUserProducts";
import { ArrowLeft, Play, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  title: string;
  description: string | null;
  display_order: number;
  product_id: string | null;
}

interface Module {
  id: string;
  section_id: string;
  title: string;
  module_type: string;
  thumbnail_url: string | null;
  video_url: string | null;
  pdf_url: string | null;
  duration_minutes: number | null;
  display_order: number;
}

export default function TutoriaisHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { goBack, fromSuffix } = useBackNavigation();
  const { data: userProducts = [] } = useUserProducts(user?.email ?? undefined);
  const [searchParams] = useSearchParams();
  const productSlugFilter = searchParams.get("product");

  // Get product IDs from authorized_email_products directly
  const { data: userProductIds = [] } = useQuery({
    queryKey: ["user-product-ids", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const { data, error } = await supabase
        .from("authorized_email_products")
        .select("product_id")
        .eq("email", user.email);
      if (error) throw error;
      return (data || []).map(d => d.product_id);
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
  });

  // Resolve product slug filter to product_id
  const { data: filterProductId } = useQuery({
    queryKey: ["product-by-slug", productSlugFilter],
    queryFn: async () => {
      if (!productSlugFilter) return null;
      const { data } = await supabase
        .from("product_definitions")
        .select("id")
        .eq("slug", productSlugFilter)
        .maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!productSlugFilter,
    staleTime: Infinity,
  });

  const { data: sections = [], isLoading: loadingSections } = useQuery({
    queryKey: ["tutorial-sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutorial_sections")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as Section[];
    },
  });

  const { data: modules = [], isLoading: loadingModules } = useQuery({
    queryKey: ["tutorial-modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutorial_modules")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as Module[];
    },
  });

  const { data: progress = [] } = useQuery({
    queryKey: ["tutorial-progress", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("tutorial_progress")
        .select("module_id, completed_at")
        .eq("user_id", user.id);
      if (error) throw error;
      return data as { module_id: string; completed_at: string | null }[];
    },
    enabled: !!user?.id,
  });

  const completedSet = new Set(
    progress.filter((p) => p.completed_at).map((p) => p.module_id)
  );

  // When a product filter is active, show only that product's sections.
  // Otherwise, show all sections the user has access to.
  const visibleSections = productSlugFilter && filterProductId
    ? sections.filter(s => s.product_id === filterProductId)
    : sections.filter(s => !s.product_id || userProductIds.includes(s.product_id));

  const isLoading = loadingSections || loadingModules;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ConselhoThemeWrapper>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={goBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold text-foreground">Tutoriais</h1>
          </div>
        </header>

        <div className="relative py-10 px-6 overflow-hidden">
          <div className="absolute inset-0 opacity-30" style={{ background: "var(--gradient-primary)" }} />
          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Tutoriais</h2>
            <p className="text-muted-foreground text-base md:text-lg">
              Comece por aqui. Aprenda a utilizar cada recurso da plataforma com nossos vídeos e materiais.
            </p>
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-4 py-6 space-y-10">
          {visibleSections.length === 0 && (
            <p className="text-center text-muted-foreground py-20">
              Nenhum conteúdo disponível ainda. Volte em breve!
            </p>
          )}

          {visibleSections.map((section) => {
            const sectionModules = modules.filter((m) => m.section_id === section.id);
            if (sectionModules.length === 0) return null;

            return (
              <div key={section.id}>
                <div className="mb-3 px-1">
                  <h3 className="text-xl font-semibold text-foreground">{section.title}</h3>
                  {section.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>
                  )}
                </div>
                <ScrollArea className="w-full">
                  <div className="flex gap-4 pb-4">
                    {sectionModules.map((mod) => (
                      <ModuleCard
                        key={mod.id}
                        module={mod}
                        completed={completedSet.has(mod.id)}
                        onClick={() => navigate(`/tutoriais/${mod.id}${fromSuffix}`)}
                      />
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            );
          })}
        </main>
      </div>
    </ConselhoThemeWrapper>
  );
}

function ModuleCard({ module, completed, onClick }: { module: Module; completed: boolean; onClick: () => void }) {
  const typeLabel = module.module_type === "pdf" ? "PDF" : module.module_type === "video_pdf" ? "Vídeo + PDF" : "Vídeo";

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex-shrink-0 w-52 rounded-lg overflow-hidden border border-border/60 bg-card transition-all hover:border-primary/50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/40",
        completed && "ring-1 ring-primary/30"
      )}
    >
      <div className="relative aspect-video bg-muted">
        {module.thumbnail_url ? (
          <img src={module.thumbnail_url} alt={module.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="h-4 w-4" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
          <Play className="h-8 w-8 text-white fill-white" />
        </div>
        {completed && (
          <div className="absolute top-2 right-2">
            <CheckCircle2 className="h-5 w-5 text-primary drop-shadow" />
          </div>
        )}
      </div>
      <div className="p-3 text-left">
        <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">{module.title}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{typeLabel}</Badge>
          {module.duration_minutes && (
            <span className="text-[11px] text-muted-foreground">{module.duration_minutes} min</span>
          )}
        </div>
      </div>
    </button>
  );
}
