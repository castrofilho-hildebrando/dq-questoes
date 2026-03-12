import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAppearanceConfig } from "@/hooks/useAppearanceConfig";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Lock, User, ArrowLeft, Loader2, CheckCircle, Gift, FileText } from "lucide-react";
import { gatewayTexture, gatewayTextureOpacity } from "@/data/gatewayAssets";
import loginBanner from "@/assets/gateway/login-banner.jpg";
import logoDq from "@/assets/gateway/logo-dq.png";

type AuthStep = "email" | "register" | "login" | "forgot-password";

// Helper to log auth errors
const logAuthError = async (
  errorMessage: string,
  errorCode?: string,
  errorType?: string,
  email?: string
) => {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    await fetch(`${supabaseUrl}/functions/v1/log-auth-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        error_code: errorCode,
        error_message: errorMessage,
        error_type: errorType || 'unknown',
      }),
    });
  } catch (e) {
    // Silently fail
  }
};

export default function Auth() {
  const navigate = useNavigate();
  const { get } = useAppearanceConfig();
  const [step, setStep] = useState<AuthStep>("email");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  

  const formatCpf = (value: string): string => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const isValidCpf = (cpfVal: string): boolean => {
    const digits = cpfVal.replace(/\D/g, "");
    if (digits.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(digits)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
    let check = 11 - (sum % 11);
    if (check >= 10) check = 0;
    if (parseInt(digits[9]) !== check) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
    check = 11 - (sum % 11);
    if (check >= 10) check = 0;
    if (parseInt(digits[10]) !== check) return false;
    return true;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkEmailAuthorization = async () => {
    if (!email) {
      toast.error("Por favor, insira seu email");
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.toLowerCase().trim();

      // Use edge function to check authorization (secure - doesn't expose email list)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-email-authorization`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail })
        }
      );

      const result = await response.json();

      if (!result.authorized) {
        toast.error("Email não autorizado. Entre em contato com o administrador.");
        return;
      }

      if (result.exists) {
        // User exists, go to login
        setStep("login");
      } else {
        // New user, go to registration
        setStep("register");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao verificar email");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name) {
      toast.error("Por favor, insira seu nome");
      return;
    }

    if (!isValidCpf(cpf)) {
      toast.error("CPF inválido. Verifique e tente novamente.");
      return;
    }

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
      const { error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: name,
            cpf: formatCpf(cpf),
          },
        },
      });

      if (error) {
        // Log the error
        logAuthError(error.message, (error as any).code, 'signup_failed', email);
        
        if (error.message.includes("already registered")) {
          toast.error("Este email já está cadastrado. Faça login.");
          setStep("login");
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("Conta criada com sucesso!");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      toast.error("Por favor, insira sua senha");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        // Log the error
        logAuthError(error.message, (error as any).code, 'login_failed', email);
        
        if (error.message.includes("Email not confirmed") || error.message.includes("email_not_confirmed")) {
          toast.error("Seu email ainda não foi confirmado. Entre em contato com o suporte para ativação.", { duration: 8000 });
        } else if (error.message.includes("Invalid login")) {
          toast.error("Email ou senha incorretos");
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("Login realizado com sucesso!");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep("email");
    setPassword("");
    setConfirmPassword("");
    setName("");
    setCpf("");
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Por favor, insira seu email primeiro");
      setStep("email");
      return;
    }

    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao enviar email');
      }

      toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
      setStep("email");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao enviar email de recuperação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative">
      {/* Full-page texture background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{ backgroundColor: 'hsl(var(--background))' }}
      />
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `url(${gatewayTexture})`,
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
            radial-gradient(ellipse at 90% 95%, hsl(var(--accent) / 0.12) 0%, transparent 45%)
          `,
        }}
      />

      {/* Left Panel - Branding with banner */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden z-10">
        {/* Banner image as background */}
        <img
          src={loginBanner}
          alt="DQ Banner"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: 'center 30%' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/30" />
        
        <div className="relative z-10 flex flex-col justify-between items-center w-full h-full pt-0 pb-8 px-12">
          {/* Top - Logo */}
          <img src={logoDq} alt="DQ Logo" className="w-[300px] h-[300px] object-contain -mt-4" />

          {/* Bottom group - Title, grid, CTA */}
          <div className="flex flex-col items-center gap-4 -mt-8">
            <h1 className="text-4xl font-bold text-center mb-2 text-white" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
              {get("text_login_title", "Dissecando Questões")}
            </h1>
            <p className="text-lg text-center text-white/80 max-w-md" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
              {get("text_login_description", "A plataforma completa para sua aprovação nos Institutos Federais. Método exclusivo que acelera seu aprendizado.")}
            </p>

            <div className="grid grid-cols-4 gap-3 max-w-2xl">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 text-center flex flex-col items-center justify-center min-h-[72px]">
                <div className="text-2xl font-bold text-white">30K+</div>
                <div className="text-xs text-white/70">Questões Dissecadas</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 text-center flex flex-col items-center justify-center min-h-[72px]">
                <div className="text-2xl font-bold text-white">1000+</div>
                <div className="text-xs text-white/70">Alunos Impactados</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 text-center flex flex-col items-center justify-center min-h-[72px]">
                <div className="text-base font-bold text-white leading-tight">Cronograma Tático</div>
                <div className="text-xs text-white/70">Todas as Áreas</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 text-center flex flex-col items-center justify-center min-h-[72px]">
                <div className="text-lg font-bold text-white leading-tight">Materiais</div>
                <div className="text-xs text-white/70">Enxutos</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 text-center flex flex-col items-center justify-center min-h-[72px]">
                <div className="text-lg font-bold text-white leading-tight">Revisões</div>
                <div className="text-xs text-white/70">Espaçadas</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 text-center flex flex-col items-center justify-center min-h-[72px]">
                <div className="text-base font-bold text-white leading-tight">Dissertativas</div>
                <div className="text-xs text-white/70">Inéditas c/ Correção</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 text-center flex flex-col items-center justify-center min-h-[72px]">
                <div className="text-lg font-bold text-white leading-tight">Preparação</div>
                <div className="text-xs text-white/70">Didática</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 text-center flex flex-col items-center justify-center min-h-[72px]">
                <div className="text-lg font-bold text-white leading-tight">Robô Tutor</div>
                <div className="text-xs text-white/70">Dissecador</div>
              </div>
            </div>
            <p className="text-2xl font-semibold mt-4" style={{ color: '#7dd3fc', textShadow: '0 2px 10px rgba(125,211,252,0.4), 0 1px 4px rgba(0,0,0,0.5)' }}>
              {get("text_login_cta", "Você Professor do IF em 2026!")}
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-md bg-card/80 backdrop-blur-sm rounded-2xl p-8 border border-border shadow-lg">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-xl bg-card border border-border flex items-center justify-center">
              <img src={logoDq} alt="DQ Logo" className="w-10 h-10 object-contain" />
            </div>
            <span className="text-2xl font-bold text-foreground">Dissecando Questões</span>
          </div>

          {/* Email Step */}
          {step === "email" && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="font-heading text-2xl font-bold text-foreground">Bem-vindo!</h2>
                <p className="text-muted-foreground mt-2">
                  Insira seu email para continuar
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      onKeyDown={(e) => e.key === "Enter" && checkEmailAuthorization()}
                    />
                  </div>
                </div>

                <Button
                  onClick={checkEmailAuthorization}
                  className="w-full"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Continuar"
                  )}
                </Button>
              </div>

            </div>
          )}

          {/* Register Step */}
          {step === "register" && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={handleBack}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h2 className="font-heading text-2xl font-bold text-foreground">Criar conta</h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    Email autorizado: {email}
                  </p>
                </div>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Seu nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="cpf"
                      type="text"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => setCpf(formatCpf(e.target.value))}
                      className="pl-10"
                      maxLength={14}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
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
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
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
                    "Criar conta"
                  )}
                </Button>
              </form>
            </div>
          )}

          {/* Login Step */}
          {step === "login" && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={handleBack}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h2 className="font-heading text-2xl font-bold text-foreground">Entrar</h2>
                  <p className="text-sm text-muted-foreground">{email}</p>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="loginPassword">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="loginPassword"
                      type="password"
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Entrar"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => setStep("forgot-password")}
                  className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Esqueceu sua senha?
                </button>
              </form>
            </div>
          )}

          {/* Forgot Password Step */}
          {step === "forgot-password" && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setStep("login")}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h2 className="font-heading text-2xl font-bold text-foreground">Recuperar senha</h2>
                  <p className="text-sm text-muted-foreground">{email}</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Enviaremos um link para o email <strong>{email}</strong> com instruções para redefinir sua senha.
                </p>

                <Button
                  onClick={handleForgotPassword}
                  className="w-full"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Enviar email de recuperação"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => setStep("login")}
                  className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Voltar ao login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
