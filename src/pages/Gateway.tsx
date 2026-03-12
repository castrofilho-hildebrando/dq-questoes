import { Navigate, useNavigate } from "react-router-dom";
import GatewayBanner from "@/components/gateway/GatewayBanner";
import GatewaySectionRow from "@/components/gateway/GatewaySectionRow";
import GatewayUserMenu from "@/components/gateway/GatewayUserMenu";
import { gatewaySections, gatewayTexture, gatewayTextureOpacity } from "@/data/gatewayAssets";
import { useAppearanceConfig } from "@/hooks/useAppearanceConfig";
import { useCardAccess } from "@/hooks/useCardAccess";
import { useAuth } from "@/hooks/useAuth";
import { useUserProducts } from "@/hooks/useUserProducts";
import { getGatewayVisibleCards } from "@/lib/gatewayVisibility";
import { reorderGatewaySections } from "@/lib/gatewayOrdering";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

const Gateway = () => {
  const { get, getImage } = useAppearanceConfig();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { isCardUnlocked, isLoading: loadingAccess } = useCardAccess(user?.id);
  const { data: userProducts = [], isLoading: loadingProducts } = useUserProducts(user?.email ?? undefined);
  const navigate = useNavigate();

  const title = get("text_gateway_title", "Ecossistema Dissecando Questões (DQ)");
  const subtitle = get("text_gateway_subtitle", "Você Professor do IF em 2026!");
  const textureUrl = getImage("gateway_texture") || gatewayTexture;

  // Collect all card IDs from gateway sections
  const allCardIds = useMemo(
    () => gatewaySections.flatMap((s) => s.areas.filter((a) => !a.hidden).map((a) => a.id)),
    []
  );

  // Determine visibility based on user's products
  const visibleCardIds = useMemo(() => {
    if (isAdmin) return allCardIds; // Admins see everything
    if (loadingProducts || userProducts.length === 0) return allCardIds; // fallback while loading
    return getGatewayVisibleCards(userProducts, allCardIds);
  }, [userProducts, loadingProducts, allCardIds, isAdmin]);

  // Build dynamic sections with visibility filter + lock status + product-based ordering
  const dynamicSections = useMemo(() => {
    const visibleSet = visibleCardIds ? new Set(visibleCardIds) : new Set<string>();

    const filtered = gatewaySections
      .map((section) => ({
        ...section,
        areas: section.areas
          .filter((area) => !area.hidden && visibleSet.has(area.id))
          .map((area) => {
            const cardKey = area.id.replace(/-/g, "_");
            return {
              ...area,
              name: get(`text_card_${cardKey}_name`, area.name),
              description: get(`text_card_${cardKey}_desc`, area.description),
              locked: area.forceLocked ? true : area.comingSoon ? false : !isCardUnlocked(area.id),
            };
          }),
      }))
      .filter((section) => section.areas.length > 0);

    return reorderGatewaySections(filtered, userProducts, isAdmin);
  }, [get, isCardUnlocked, loadingAccess, visibleCardIds, userProducts, isAdmin]);

  // Redirect unauthenticated users to login
  if (!authLoading && !user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect Conselho IF-only users directly to their dashboard
  if (!authLoading && user && !loadingProducts && visibleCardIds === null && !isAdmin) {
    return <Navigate to="/conselho-if" replace />;
  }

  return (
    <div className="min-h-screen relative">
      {/* Background texture layer */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{ backgroundColor: 'hsl(var(--background))' }}
      />
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `url(${textureUrl})`,
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
            radial-gradient(ellipse at 90% 95%, hsl(var(--accent) / 0.12) 0%, transparent 45%),
            radial-gradient(ellipse at 50% 50%, hsl(var(--muted) / 0.15) 0%, transparent 70%)
          `,
        }}
      />

      {/* Banner */}
      <div className="relative z-10">
        <GatewayBanner />

        {/* Title box below banner */}
        <div className="w-full py-6 relative overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
              {title}
            </h1>
            <p className="text-2xl md:text-3xl font-semibold mt-1" style={{ color: '#7dd3fc', textShadow: '0 2px 10px rgba(125,211,252,0.4), 0 1px 4px rgba(0,0,0,0.5)' }}>
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* User Menu - floating top right */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-md hover:bg-background"
            onClick={() => navigate("/admin")}
            title="Painel Admin"
          >
            <Shield className="h-5 w-5 text-foreground" />
          </Button>
        )}
        <GatewayUserMenu />
      </div>

      {/* Banner de manutenção programada */}
      <div className="max-w-4xl mx-auto px-6 pt-8 relative z-10">
        <div className="w-full rounded-2xl border-8 border-[#FAFA33] bg-[#373737] px-6 py-5 sm:px-8 sm:py-6 text-center text-white shadow-xl">
          <p className="text-base sm:text-lg font-semibold leading-relaxed tracking-wide">
            ⚠️ O Dissecando Questões entrará em manutenção programada hoje, às 22 h, e retornará amanhã, às 04 h da manhã. Essa parada servirá para proporcionar a vocês, nossos queridos alunos, uma melhor experiência em nosso site.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        {dynamicSections.map((section, i) => (
          <GatewaySectionRow
            key={section.id}
            section={section}
            sectionIndex={i}
            cardAspectRatio={section.id === "preparacoes-dq" ? "9/16" : "4/5"}
            textRatio={section.id === "preparacoes-dq" ? 25 : 35}
            isLoading={loadingAccess}
          />
        ))}
      </main>
    </div>
  );
};

export default Gateway;
