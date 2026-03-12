import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, Loader2, Bot, Check, Sparkles } from 'lucide-react';
import { getAvailableModels, type AIModel } from './TutorAdminModels';

interface Robot {
  id: string;
  name: string;
  prompt: string | null;
  command_prompt: string | null;
  model: string | null;
}

interface Area {
  id: string;
  name: string;
}

interface RobotArea {
  robot_id: string;
  area_id: string;
  areas: { name: string } | null;
}

const DEFAULT_TEMPLATE = `Sara é uma conceituada professora de {Área} para concursos, com graduação e doutorado em {Área} pela USP (Universidade de São Paulo) e mais de 20 anos de experiência no Ensino de {Área} para concurseiros que já são professores de {Área}. Além disso, Sara tem uma especialização em metodologias de ensino ativas e psicologia da aprendizagem, com mais de 1000 alunos formados por seus excelentes cursos de {Área} para concursos ao longo de sua carreira. Ela usa uma abordagem única de utilizar questões de concurso como forma de aprendizado acelerado da matéria.

Sempre que resolver uma questão, Sara segue um conjunto de regras que dependem do enunciado com a resposta correta para fornecer aos seus alunos a maior compreensão possível sobre o tópico sem precisar se aprofundar ou recorrer a outros materiais:

Primeiro, antes de começar, sempre solicite ao aluno a questão com o gabarito no formato: "Resposta:" e emita um alerta de que você é um modelo de Inteligência Artificial em construção e que sem o gabarito não há garantia de que a questão será explicada de forma correta. Qualquer questão sem o gabarito não deve ser respondida. Não inicie o conjunto de regras abaixo antes de ter o gabarito no formato: "Resposta:". Se o usuário insistir em colocar perguntas sem um gabarito no formato: "Resposta:", insista em não comentar a questão. Se esforce para NEGAR DE FORMA CONTUNDENTE A PROSSEGUIR se não identificar o gabarito no formato: "Resposta:"`;

const LOCAL_STORAGE_KEY = 'tutor-template-config';

export function TutorAdminTemplate() {
  const queryClient = useQueryClient();
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_TEMPLATE);
  const [commandPromptTemplate, setCommandPromptTemplate] = useState('');
  const [selectedModel, setSelectedModel] = useState('google/gemini-3-flash-preview');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);

  // Load models from centralized config
  useEffect(() => {
    const models = getAvailableModels();
    setAvailableModels(models);
  }, []);

  // Load saved config from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        if (config.template) setPromptTemplate(config.template);
        if (config.commandPrompt) setCommandPromptTemplate(config.commandPrompt);
        if (config.model) setSelectedModel(config.model);
      } catch (e) {
        console.error('Error parsing saved config:', e);
      }
    }
  }, []);

  // Fetch areas
  const { data: areas = [], isLoading: loadingAreas } = useQuery({
    queryKey: ['tutor-admin-areas-template'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Area[];
    },
  });

  // Fetch robots
  const { data: robots = [] } = useQuery({
    queryKey: ['tutor-admin-robots-template'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('robots')
        .select('id, name, prompt, command_prompt, model')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Robot[];
    },
  });

  // Fetch robot areas
  const { data: robotAreas = [] } = useQuery({
    queryKey: ['tutor-admin-robot-areas-template'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('robot_areas')
        .select('robot_id, area_id, areas(name)');
      if (error) throw error;
      return data as RobotArea[];
    },
  });

  // Get robots that match selected areas
  const filteredRobots = useMemo(() => {
    if (selectedAreas.length === 0) {
      return robots; // All robots if no area selected
    }
    return robots.filter(robot => {
      const robotAreaIds = robotAreas
        .filter(ra => ra.robot_id === robot.id)
        .map(ra => ra.area_id);
      return robotAreaIds.some(areaId => selectedAreas.includes(areaId));
    });
  }, [robots, robotAreas, selectedAreas]);

  const getRobotAreaName = (robotId: string) => {
    const robotArea = robotAreas.find(ra => ra.robot_id === robotId);
    return robotArea?.areas?.name || 'Geral';
  };

  // Generate preview
  const previewArea = areas[0]?.name || 'Administração';
  const previewPrompt = promptTemplate.replace(/\{Área\}/g, previewArea);

  // Apply template mutation
  const applyMutation = useMutation({
    mutationFn: async () => {
      const robotsToUpdate = filteredRobots;
      if (robotsToUpdate.length === 0) {
        throw new Error('Nenhum robô encontrado para atualizar');
      }

      for (const robot of robotsToUpdate) {
        const robotAreaName = getRobotAreaName(robot.id);
        const finalPrompt = promptTemplate.replace(/\{Área\}/g, robotAreaName);
        const finalCommandPrompt = commandPromptTemplate.replace(/\{Área\}/g, robotAreaName);

        const { error } = await supabase
          .from('robots')
          .update({ 
            prompt: finalPrompt, 
            command_prompt: finalCommandPrompt || null,
            model: selectedModel, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', robot.id);

        if (error) throw error;
      }
      
      return robotsToUpdate.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['tutor-admin-robots-template'] });
      queryClient.invalidateQueries({ queryKey: ['admin-robots'] });
      toast.success(`Template aplicado a ${count} robô(s)!`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Save configuration (just saves to local storage for now)
  const handleSaveConfig = () => {
    localStorage.setItem('tutor-template-config', JSON.stringify({
      template: promptTemplate,
      commandPrompt: commandPromptTemplate,
      model: selectedModel,
    }));
    toast.success('Configurações salvas!');
  };

  const toggleArea = (areaId: string) => {
    setSelectedAreas(prev =>
      prev.includes(areaId)
        ? prev.filter(id => id !== areaId)
        : [...prev, areaId]
    );
  };

  const selectAllAreas = () => {
    setSelectedAreas(areas.map(a => a.id));
  };

  const currentModel = availableModels.find(m => m.id === selectedModel);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Aplicar Prompt nos Robôs</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
          >
            {applyMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Bot className="w-4 h-4 mr-2" />
            )}
            Aplicar Prompt em Todos
          </Button>
          <Button onClick={handleSaveConfig}>
            <Check className="w-4 h-4 mr-2" />
            Salvar Configurações
          </Button>
        </div>
      </div>

      {/* Area Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Selecionar Robôs por Área</CardTitle>
              <CardDescription>
                Selecione as áreas cujos robôs receberão o prompt. Se nenhuma for selecionada, o prompt será aplicado a todos os robôs.
              </CardDescription>
            </div>
            <Button variant="link" onClick={selectAllAreas} className="text-primary">
              Marcar Todos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAreas ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {areas.map(area => (
                <Badge
                  key={area.id}
                  variant={selectedAreas.includes(area.id) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/20 px-3 py-1"
                  onClick={() => toggleArea(area.id)}
                >
                  {area.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Modelo de IA</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[300px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name} {model.price && `(${model.price})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={selectedModel}
              readOnly
              className="w-[200px] bg-muted"
            />
          </div>
        </CardContent>
      </Card>

      {/* Command Prompt Template */}
      <Card>
        <CardHeader>
          <CardTitle>Template do Prompt de Comando</CardTitle>
          <CardDescription>
            Instruções prioritárias que vão no início do system prompt. Use <Badge variant="secondary" className="mx-1">{'{Área}'}</Badge> para substituição automática.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={commandPromptTemplate}
            onChange={(e) => setCommandPromptTemplate(e.target.value)}
            rows={6}
            className="font-mono text-sm"
            placeholder="Ex: REGRAS GERAIS: Nunca mencione que você é uma IA..."
          />
        </CardContent>
      </Card>

      {/* Template */}
      <Card>
        <CardHeader>
          <CardTitle>Template do Prompt Principal</CardTitle>
          <CardDescription>
            Use a variável <Badge variant="secondary" className="mx-1">{'{Área}'}</Badge> para substituição automática pelo nome da área de cada robô.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            rows={12}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="border-primary/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Prévia do prompt (exemplo: {previewArea})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
            {previewPrompt}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
