import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Loader2, 
  RefreshCw, 
  Search, 
  Gift, 
  Clock, 
  CheckCircle, 
  XCircle,
  Copy,
  Trash2,
  Mail
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TrialRegistration {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  converted_to_user: boolean;
  notes: string | null;
}

export function AdminTrials() {
  const [trials, setTrials] = useState<TrialRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const fetchTrials = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trial_registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrials(data || []);
    } catch (error) {
      console.error('Error fetching trials:', error);
      toast.error('Erro ao carregar registros de trial');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrials();
  }, []);

  const toggleTrialStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('trial_registrations')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      
      toast.success(currentStatus ? 'Trial desativado' : 'Trial reativado');
      fetchTrials();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const deleteTrial = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;

    try {
      const { error } = await supabase
        .from('trial_registrations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Registro excluído');
      fetchTrials();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao excluir registro');
    }
  };

  const copyTrialLink = () => {
    const link = `${window.location.origin}/trial`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const testExpirationEmail = async () => {
    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-trial-expiration-email');
      
      if (error) throw error;
      
      if (data?.emailsSent > 0) {
        toast.success(`${data.emailsSent} email(s) enviado(s) com sucesso!`);
      } else {
        toast.info('Nenhum trial expirando em 48h para enviar email');
      }
      console.log('Email test result:', data);
    } catch (error) {
      console.error('Error sending test email:', error);
      toast.error('Erro ao enviar email de teste');
    } finally {
      setSendingEmail(false);
    }
  };

  const filteredTrials = trials.filter(trial =>
    trial.name.toLowerCase().includes(search.toLowerCase()) ||
    trial.email.toLowerCase().includes(search.toLowerCase()) ||
    trial.phone.includes(search)
  );

  const activeTrials = trials.filter(t => t.is_active && !isPast(new Date(t.expires_at))).length;
  const expiredTrials = trials.filter(t => isPast(new Date(t.expires_at))).length;

  const getTrialStatus = (trial: TrialRegistration) => {
    if (!trial.is_active) {
      return { label: 'Desativado', variant: 'secondary' as const };
    }
    if (isPast(new Date(trial.expires_at))) {
      return { label: 'Expirado', variant: 'destructive' as const };
    }
    return { label: 'Ativo', variant: 'default' as const };
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Registros</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Gift className="w-6 h-6 text-primary" />
              {trials.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Trials Ativos</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-500" />
              {activeTrials}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Trials Expirados</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Clock className="w-6 h-6 text-orange-500" />
              {expiredTrials}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-primary" />
                Acesso Gratuito 7 Dias
              </CardTitle>
              <CardDescription>
                Gerencie os registros de período de teste
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={testExpirationEmail}
                disabled={sendingEmail}
              >
                {sendingEmail ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Testar Email
              </Button>
              <Button variant="outline" size="sm" onClick={copyTrialLink}>
                <Copy className="w-4 h-4 mr-2" />
                Copiar Link
              </Button>
              <Button variant="outline" size="sm" onClick={fetchTrials}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredTrials.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? 'Nenhum registro encontrado' : 'Nenhum registro de trial ainda'}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead>Expira em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrials.map((trial) => {
                    const status = getTrialStatus(trial);
                    return (
                      <TableRow key={trial.id}>
                        <TableCell className="font-medium">{trial.name}</TableCell>
                        <TableCell>{trial.email}</TableCell>
                        <TableCell>{trial.phone}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(trial.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {isPast(new Date(trial.expires_at)) ? (
                            <span className="text-destructive">Expirado</span>
                          ) : (
                            formatDistanceToNow(new Date(trial.expires_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleTrialStatus(trial.id, trial.is_active)}
                              title={trial.is_active ? 'Desativar' : 'Reativar'}
                            >
                              {trial.is_active ? (
                                <XCircle className="w-4 h-4 text-destructive" />
                              ) : (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteTrial(trial.id)}
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}