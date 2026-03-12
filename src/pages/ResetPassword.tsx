import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Scissors, Lock, Loader2 } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsValidSession(true);
      } else {
        toast.error("Link de recuperação inválido ou expirado");
        navigate("/auth");
      }
      setCheckingSession(false);
    };

    checkSession();
  }, [navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Senha atualizada com sucesso!");
      navigate("/");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao atualizar senha");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isValidSession) {
    return null;
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background">
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at bottom right, hsl(280, 50%, 12%) 0%, transparent 50%), radial-gradient(ellipse at top left, hsl(185, 80%, 10%) 0%, transparent 40%)'
          }} />
        </div>
        
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(hsl(185, 100%, 50%) 1px, transparent 1px), linear-gradient(90deg, hsl(185, 100%, 50%) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} />
        </div>
        
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12">
          <div className="w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center mb-8 shadow-glow-cyan">
            <Scissors className="w-10 h-10 text-primary" />
          </div>
          <h1 className="font-heading text-4xl font-bold text-center mb-4">
            <span className="gradient-text-cyan">Dissecando Questões</span>
          </h1>
          <p className="text-lg text-center text-muted-foreground max-w-md">
            Redefina sua senha e volte aos estudos!
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-card/50 backdrop-blur-sm">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-xl bg-card border border-border flex items-center justify-center shadow-glow-cyan">
              <Scissors className="w-8 h-8 text-primary" />
            </div>
            <span className="font-heading text-2xl font-bold gradient-text-cyan">Dissecando Questões</span>
          </div>

          <div className="space-y-6">
            <div className="text-center">
              <h2 className="font-heading text-2xl font-bold text-foreground">Redefinir senha</h2>
              <p className="text-muted-foreground mt-2">
                Insira sua nova senha abaixo
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Atualizar senha"
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
