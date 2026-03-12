import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCardAccess } from "@/hooks/useCardAccess";

interface RequireCardAccessProps {
  /** card_id que deve estar desbloqueado para o usuário acessar a rota */
  cardId: string;
  children: ReactNode;
}

/**
 * Guard de rota baseado em card de produto.
 *
 * Uso no App.tsx:
 *   <Route
 *     path="/banco-questoes"
 *     element={
 *       <RequireCardAccess cardId="banco-questoes">
 *         <BancoQuestoes />
 *       </RequireCardAccess>
 *     }
 *   />
 *
 * Comportamento:
 * - Usuário não autenticado → redireciona para /auth
 * - Carregando permissões → spinner
 * - Card bloqueado → redireciona para / (Gateway) com ?blocked=1
 * - Card desbloqueado → renderiza children normalmente
 */
export function RequireCardAccess({ cardId, children }: RequireCardAccessProps) {
  const { user, loading: authLoading } = useAuth();
  const { isCardUnlocked, isLoading: accessLoading } = useCardAccess(user?.id);

  // Aguarda autenticação resolver
  if (authLoading) {
    return <LoadingScreen />;
  }

  // Usuário não autenticado
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Aguarda permissões carregarem
  if (accessLoading) {
    return <LoadingScreen />;
  }

  // Verifica acesso ao card
  if (!isCardUnlocked(cardId)) {
    return <Navigate to={`/?blocked=${cardId}`} replace />;
  }

  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
