import { ArrowRight } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

/**
 * Compact "Tutoriais – Comece por aqui" action card.
 * Rendered at the top of every product entry page.
 * Navigates to /tutoriais?product=<slug> preserving the `?from=` context.
 *
 * @param productSlug – explicit product slug to filter tutorials for this page.
 *   If omitted, tries to infer from the `?from=` search param.
 */
export function TutorialActionCard({ productSlug }: { productSlug?: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from");

  // Build target URL
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (productSlug) params.set("product", productSlug);
  const qs = params.toString();

  return (
    <div className="flex justify-center mb-6">
      <button
        onClick={() => navigate(`/tutoriais${qs ? `?${qs}` : ""}`)}
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
    </div>
  );
}
