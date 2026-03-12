import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Save, Loader2, Map, RotateCcw, Sparkles, FileText } from 'lucide-react';

interface AIConfig {
  id: string;
  config_type: string;
  model: string;
  system_prompt: string;
  description: string | null;
  updated_at: string;
}

const AVAILABLE_MODELS = [
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash (Rápido)', price: '$' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', price: '$' },
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro (Avançado)', price: '$$' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', price: '$$' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', price: '$$' },
  { id: 'openai/gpt-5', name: 'GPT-5', price: '$$$' },
];

const DEFAULT_PROMPT = `Você é um especialista em concursos públicos e organização de conteúdo de estudo.

OBJETIVO PRINCIPAL: AGRUPAMENTO INTELIGENTE E ABRANGENTE
Sua tarefa é criar CLUSTERS (agrupamentos) de tópicos do edital que podem ser estudados JUNTOS usando o mesmo tópico do banco de questões.

IMPORTANTE: Cada tópico do banco tem uma contagem de QUESTÕES disponíveis. Priorize tópicos com mais questões para maximizar o conteúdo de estudo.

LÓGICA DO AGRUPAMENTO:
1. Analise TODOS os tópicos do edital e identifique quais deles tratam de assuntos relacionados que podem ser cobertos pelo MESMO tópico do banco
2. Crie GRUPOS onde: um único tópico do banco cobre múltiplos tópicos do edital
3. O nome do grupo será o nome do TÓPICO DO BANCO (não o nome do edital)
4. Os tópicos do edital agrupados serão listados como "edital_items" dentro do grupo
5. PRIORIZE tópicos do banco que tenham MAIS QUESTÕES disponíveis

REGRAS CRÍTICAS PARA CLUSTERS COBERTOS:
1. MAXIMIZE os agrupamentos - quanto menos clusters finais, melhor (desde que faça sentido)
2. Mantenha os nomes EXATOS dos tópicos do edital em "edital_items"
3. O nome do cluster DEVE ser o nome do tópico do banco que será usado
4. Score de confiança: 0.0-1.0 (qual % dos tópicos do edital esse banco cobre)
5. Um tópico do edital só pode aparecer em UM cluster
6. NÃO IGNORE tópicos do banco que tenham muitas questões - eles são valiosos para o estudo

REGRAS PARA TÓPICOS NÃO COBERTOS (MUITO IMPORTANTE):
7. Tópicos do edital SEM correspondência no banco TAMBÉM devem ser agrupados em "uncovered_clusters"
8. Agrupe os tópicos não cobertos usando lógica semântica (assuntos relacionados, mesma área temática)
9. Cada cluster não coberto deve ter um nome descritivo que represente a área temática do agrupamento
10. Inclua reasoning explicando por que esses tópicos foram agrupados juntos
11. Isso permite que o administrador depois mapeie cada cluster não coberto para disciplinas específicas

Responda usando a função create_clusters.`;

export function AdminEditalMappingPrompt() {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('google/gemini-3-flash-preview');
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current config
  const { data: config, isLoading } = useQuery({
    queryKey: ['ai-config-edital-mapping'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_config')
        .select('*')
        .eq('id', 'edital_mapping')
        .maybeSingle();
      
      if (error) throw error;
      return data as AIConfig | null;
    },
  });

  // Initialize form when data loads
  useEffect(() => {
    if (config) {
      setPrompt(config.system_prompt);
      setModel(config.model);
      setHasChanges(false);
    }
  }, [config]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('ai_config')
        .upsert({
          id: 'edital_mapping',
          config_type: 'edital_mapping',
          system_prompt: prompt,
          model: model,
          description: 'Prompt para mapeamento de tópicos do edital com o banco de questões. Usado na funcionalidade Mapa das Questões > Mapear Edital.',
          updated_at: new Date().toISOString(),
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config-edital-mapping'] });
      toast.success('Configuração salva com sucesso!');
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    setHasChanges(true);
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    setHasChanges(true);
  };

  const handleReset = () => {
    setPrompt(DEFAULT_PROMPT);
    setModel('google/gemini-3-flash-preview');
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Map className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Prompt de Mapeamento de Edital</h2>
            <p className="text-sm text-muted-foreground">
              Configure o prompt usado pela IA para mapear tópicos do edital
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saveMutation.isPending}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Restaurar Padrão
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasChanges}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar
            {hasChanges && <Badge variant="secondary" className="ml-2">Alterado</Badge>}
          </Button>
        </div>
      </div>

      {/* Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Modelo de IA
          </CardTitle>
          <CardDescription>
            Escolha o modelo que será usado para processar o mapeamento de editais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={model} onValueChange={handleModelChange}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_MODELS.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  <div className="flex items-center gap-2">
                    <span>{m.name}</span>
                    <Badge variant="outline" className="text-xs">{m.price}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2">
            Modelo atual: <code className="bg-muted px-1 py-0.5 rounded">{model}</code>
          </p>
        </CardContent>
      </Card>

      {/* System Prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            System Prompt
          </CardTitle>
          <CardDescription>
            Instruções detalhadas para a IA realizar o mapeamento de tópicos do edital com o banco de questões.
            A IA receberá esta instrução junto com a lista de tópicos do banco e do edital.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={prompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            rows={20}
            className="font-mono text-sm"
            placeholder="Digite o prompt de sistema..."
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              {prompt.length} caracteres
            </p>
            {config?.updated_at && (
              <p className="text-xs text-muted-foreground">
                Última atualização: {new Date(config.updated_at).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <Map className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Como funciona:</strong> O prompt é enviado à IA junto com duas listas:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Lista de tópicos do banco de questões (com IDs, nomes e contagem de questões)</li>
                <li>Lista de tópicos do edital inseridos pelo aluno</li>
              </ul>
              <p>
                A IA deve agrupar os tópicos do edital em "clusters" que correspondem aos tópicos do banco,
                identificando também os tópicos não cobertos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
