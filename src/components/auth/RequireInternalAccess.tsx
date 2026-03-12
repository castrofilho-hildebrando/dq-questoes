import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldX, ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Email whitelist for internal access (besides admins)
const INTERNAL_ACCESS_EMAILS = [
  "dissecadordequestoes@gmail.com",
];

interface RequireInternalAccessProps {
  children: ReactNode;
}

/**
 * Hook to check if current user has internal access (admin or whitelisted email)
 */
export function useInternalAccess() {
  const { user, isAdmin, loading } = useAuth();
  
  const hasInternalAccess = isAdmin || 
    (user?.email && INTERNAL_ACCESS_EMAILS.includes(user.email.toLowerCase()));
  
  return {
    hasInternalAccess,
    loading,
    user,
    isAdmin,
  };
}

/**
 * Guard component that only renders children if user has internal access
 * Shows AccessDenied component otherwise
 */
export function RequireInternalAccess({ children }: RequireInternalAccessProps) {
  const navigate = useNavigate();
  const { hasInternalAccess, loading } = useInternalAccess();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasInternalAccess) {
    return <AccessDenied onBack={() => navigate("/")} />;
  }

  return <>{children}</>;
}

interface AccessDeniedProps {
  onBack: () => void;
}

function AccessDenied({ onBack }: AccessDeniedProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldX className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">Acesso Restrito</CardTitle>
          <CardDescription>
            Esta área é reservada para usuários autorizados. Se você acredita que deveria ter acesso, entre em contato com o administrador.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
