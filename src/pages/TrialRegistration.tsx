import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Scissors, Mail, User, Phone, Loader2, CheckCircle, Gift, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TrialRegistration() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const formatPhone = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');
    
    // Formata como (XX) XXXXX-XXXX
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Por favor, insira seu nome completo");
      return;
    }

    if (!email.trim()) {
      toast.error("Por favor, insira seu email");
      return;
    }

    const phoneNumbers = phone.replace(/\D/g, '');
    if (phoneNumbers.length < 10) {
      toast.error("Por favor, insira um telefone válido com DDD");
      return;
    }

    setLoading(true);
    try {
      // Calculate expiration date (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data, error } = await supabase
        .from('trial_registrations')
        .insert({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim()
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error("Este email já possui um período de teste registrado");
        } else {
          console.error('Error:', error);
          toast.error("Erro ao registrar. Tente novamente.");
        }
        return;
      }

      // Send welcome email
      try {
        await supabase.functions.invoke('send-trial-welcome-email', {
          body: {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            expires_at: data.expires_at
          }
        });
        console.log('Welcome email sent successfully');
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
        // Don't fail the registration if email fails
      }

      setSuccess(true);
      toast.success("Acesso liberado com sucesso!");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao processar registro");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-background">
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at bottom right, hsl(280, 50%, 12%) 0%, transparent 50%), radial-gradient(ellipse at top left, hsl(185, 80%, 10%) 0%, transparent 40%)'
        }} />
        
        <Card className="w-full max-w-md relative z-10 border-green-500/50 bg-card/95 backdrop-blur">
          <CardHeader className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Acesso Liberado!</CardTitle>
            <CardDescription className="text-base">
              Seu período de teste de 7 dias foi ativado com sucesso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-primary" />
                <span>Válido por 7 dias</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-primary" />
                <span>{email}</span>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground text-center">
              Agora você pode acessar a plataforma usando o email cadastrado.
            </p>

            <Button 
              onClick={() => navigate('/auth')} 
              className="w-full" 
              size="lg"
            >
              Acessar Plataforma
            </Button>
          </CardContent>
        </Card>
      </div>
    );
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
          <p className="text-lg text-center text-muted-foreground max-w-md mb-8">
            Experimente gratuitamente por 7 dias e descubra o método que está aprovando milhares de alunos.
          </p>
          
          <div className="bg-card/50 backdrop-blur border border-border rounded-2xl p-6 max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Gift className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Teste Grátis</h3>
                <p className="text-sm text-muted-foreground">7 dias de acesso completo</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Acesso ao banco de questões
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Questões comentadas
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Estatísticas de desempenho
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Sem compromisso
              </li>
            </ul>
          </div>
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
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
                <Gift className="w-4 h-4" />
                7 Dias Grátis
              </div>
              <h2 className="font-heading text-2xl font-bold text-foreground">Cadastre-se para testar</h2>
              <p className="text-muted-foreground mt-2">
                Preencha os dados abaixo para liberar seu acesso
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

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
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={handlePhoneChange}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Gift className="w-5 h-5 mr-2" />
                    Liberar Acesso Grátis
                  </>
                )}
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground">
              Ao se cadastrar, você concorda com nossos termos de uso e política de privacidade.
            </p>

            <div className="text-center">
              <Button 
                variant="link" 
                onClick={() => navigate('/auth')}
                className="text-muted-foreground"
              >
                Já tem uma conta? Faça login
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}