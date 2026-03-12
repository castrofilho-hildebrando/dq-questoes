import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Coins, 
  Loader2, 
  TrendingUp, 
  DollarSign, 
  MessageCircle,
  RotateCcw,
  Banknote,
  Settings
} from 'lucide-react';
import { getAvailableModels, type AIModel } from './TutorAdminModels';

interface TokenStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalMessages: number;
  byUser: { user_id: string; email: string; name: string; input: number; output: number; count: number }[];
}

export function TutorAdminTokenUsage() {
  const queryClient = useQueryClient();
  const [usdToBrl, setUsdToBrl] = useState(5.50);
  const [models, setModels] = useState<AIModel[]>([]);

  // Load models from centralized config
  useEffect(() => {
    const loadedModels = getAvailableModels();
    setModels(loadedModels);
  }, []);

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['tutor-admin-token-usage'],
    queryFn: async (): Promise<TokenStats> => {
      const { data: usage, error } = await supabase
        .from('token_usage')
        .select('user_id, input_tokens, output_tokens, model');

      if (error) throw error;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email, full_name');

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]));

      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      const byUserMap: Record<string, { input: number; output: number; count: number }> = {};

      usage?.forEach((u) => {
        const input = u.input_tokens || 0;
        const output = u.output_tokens || 0;

        totalInputTokens += input;
        totalOutputTokens += output;

        if (!byUserMap[u.user_id]) {
          byUserMap[u.user_id] = { input: 0, output: 0, count: 0 };
        }
        byUserMap[u.user_id].input += input;
        byUserMap[u.user_id].output += output;
        byUserMap[u.user_id].count++;
      });

      const byUser = Object.entries(byUserMap)
        .map(([user_id, data]) => {
          const profile = profileMap.get(user_id);
          return {
            user_id,
            email: profile?.email || 'Desconhecido',
            name: profile?.full_name || '',
            ...data
          };
        })
        .sort((a, b) => b.count - a.count);

      return {
        totalInputTokens,
        totalOutputTokens,
        totalMessages: usage?.length || 0,
        byUser,
      };
    },
  });

  const calculateUserCost = (inputTokens: number, outputTokens: number) => {
    // Use average pricing - in reality would need to track per-model usage
    // Simplified: assume $0.15 input / $0.60 output per 1M tokens (gpt-4o-mini pricing)
    const inputCost = (inputTokens / 1_000_000) * 0.15;
    const outputCost = (outputTokens / 1_000_000) * 0.60;
    return inputCost + outputCost;
  };

  const totalCostUSD = stats
    ? calculateUserCost(stats.totalInputTokens, stats.totalOutputTokens)
    : 0;

  const handleResetTokens = async () => {
    if (!confirm('Tem certeza que deseja zerar todos os tokens? Esta ação não pode ser desfeita.')) {
      return;
    }

    const { error } = await supabase
      .from('token_usage')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      toast.error('Erro ao zerar tokens: ' + error.message);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['tutor-admin-token-usage'] });
    toast.success('Todos os tokens foram zerados!');
  };

  const handleResetUserTokens = async (userId: string) => {
    const { error } = await supabase
      .from('token_usage')
      .delete()
      .eq('user_id', userId);

    if (error) {
      toast.error('Erro ao zerar tokens: ' + error.message);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['tutor-admin-token-usage'] });
    toast.success('Tokens do usuário zerados!');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-primary">Uso de Tokens (em tempo real)</h2>

      {/* Models Section - Read-only from centralized config */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-primary" />
                Modelos de IA Ativos
              </CardTitle>
              <CardDescription>
                Gerencie os modelos na aba "Modelos IA"
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = '/tutor/admin?tab=models'}
            >
              <Settings className="w-4 h-4 mr-2" />
              Configurar Modelos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {models.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum modelo configurado</p>
            ) : (
              models.map(model => (
                <Badge
                  key={model.id}
                  variant="secondary"
                  className="px-3 py-2 text-sm"
                >
                  <span className="font-medium">{model.name}</span>
                  {model.price && (
                    <span className="text-muted-foreground ml-2">({model.price})</span>
                  )}
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Exchange Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" />
            Cotação do Dólar (USD → BRL)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <span>1 USD =</span>
            <Input
              type="number"
              step="0.01"
              value={usdToBrl}
              onChange={(e) => setUsdToBrl(parseFloat(e.target.value) || 5.50)}
              className="w-24"
            />
            <span>BRL</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tokens de Entrada</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : stats?.totalInputTokens.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tokens de Saída</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : stats?.totalOutputTokens.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Custo Total (USD)</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              ${isLoading ? '...' : totalCostUSD.toFixed(4)}
            </div>
            <p className="text-sm text-muted-foreground">
              R$ {(totalCostUSD * usdToBrl).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mensagens</CardTitle>
            <MessageCircle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : stats?.totalMessages.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reset Button */}
      <Button variant="destructive" size="sm" onClick={handleResetTokens}>
        <RotateCcw className="w-4 h-4 mr-2" />
        Zerar Todos os Tokens
      </Button>

      {/* Usage by User */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead className="text-right">Mensagens</TableHead>
                  <TableHead className="text-right">Input Tokens</TableHead>
                  <TableHead className="text-right">Output Tokens</TableHead>
                  <TableHead className="text-right">Custo (USD)</TableHead>
                  <TableHead className="text-right">Custo (BRL)</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.byUser.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nenhum uso encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  stats?.byUser.slice(0, 50).map((user) => {
                    const costUSD = calculateUserCost(user.input, user.output);
                    const costBRL = costUSD * usdToBrl;
                    return (
                      <TableRow key={user.user_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.name || 'Sem nome'}</p>
                            <p className="text-sm text-primary">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{user.count}</TableCell>
                        <TableCell className="text-right">{user.input.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{user.output.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-500">${costUSD.toFixed(4)}</TableCell>
                        <TableCell className="text-right text-primary">R$ {costBRL.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleResetUserTokens(user.user_id)}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
