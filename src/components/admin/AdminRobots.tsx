import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Bot, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  Search,
  Upload,
  Star,
  Wand2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getAvailableModels, type AIModel } from '@/components/tutor/admin/TutorAdminModels';

interface Robot {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  assistant_id: string | null;
  prompt: string | null;
  command_prompt: string | null;
  model: string | null;
  is_mandatory: boolean | null;
  is_active: boolean | null;
  icon: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Area {
  id: string;
  name: string;
}

interface RobotArea {
  id: string;
  robot_id: string;
  area_id: string;
  areas?: { name: string } | null;
}

export function AdminRobots() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAutoCreateDialogOpen, setIsAutoCreateDialogOpen] = useState(false);
  const [editingRobot, setEditingRobot] = useState<Robot | null>(null);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [autoCreateSelectedAreas, setAutoCreateSelectedAreas] = useState<string[]>([]);
  const [autoCreatePromptTemplate, setAutoCreatePromptTemplate] = useState(
    'Você é um tutor especializado em {área}. Ajude o aluno a entender os conceitos e responda suas dúvidas de forma clara e didática.'
  );
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  
  // Get available models from centralized config
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [autoCreateModel, setAutoCreateModel] = useState('google/gemini-3-flash-preview');
  
  useEffect(() => {
    const models = getAvailableModels();
    setAvailableModels(models);
    if (models.length > 0 && !models.some(m => m.id === autoCreateModel)) {
      setAutoCreateModel(models[0].id);
    }
  }, []);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    url: '',
    prompt: '',
    command_prompt: '',
    model: '',
    is_mandatory: false,
    is_active: true,
  });

  // Fetch robots
  const { data: robots = [], isLoading: loadingRobots, refetch: refetchRobots } = useQuery({
    queryKey: ['admin-robots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('robots')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as Robot[];
    },
  });

  // Fetch areas
  const { data: areas = [] } = useQuery({
    queryKey: ['admin-areas-for-robots'],
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

  // Fetch robot_areas
  const { data: robotAreas = [] } = useQuery({
    queryKey: ['admin-robot-areas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('robot_areas')
        .select('id, robot_id, area_id, areas(name)');
      if (error) throw error;
      return data as RobotArea[];
    },
  });

  // Create robot mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData & { areas: string[] }) => {
      const { areas: areaIds, ...robotData } = data;
      
      const { data: robot, error } = await supabase
        .from('robots')
        .insert([{
          name: robotData.name,
          description: robotData.description || null,
          url: robotData.url || null,
          prompt: robotData.prompt || null,
          command_prompt: robotData.command_prompt || null,
          model: robotData.model || null,
          is_mandatory: robotData.is_mandatory,
          is_active: robotData.is_active,
        }])
        .select()
        .single();
      
      if (error) throw error;

      if (areaIds.length > 0) {
        const robotAreasData = areaIds.map(areaId => ({
          robot_id: robot.id,
          area_id: areaId,
        }));
        
        const { error: areasError } = await supabase
          .from('robot_areas')
          .insert(robotAreasData);
        
        if (areasError) throw areasError;
      }

      return robot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-robots'] });
      queryClient.invalidateQueries({ queryKey: ['admin-robot-areas'] });
      toast.success('Robô criado com sucesso!');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar robô: ' + error.message);
    },
  });

  // Update robot mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data, areas: areaIds }: { id: string; data: typeof formData; areas: string[] }) => {
      const { error } = await supabase
        .from('robots')
        .update({
          name: data.name,
          description: data.description || null,
          url: data.url || null,
          prompt: data.prompt || null,
          command_prompt: data.command_prompt || null,
          model: data.model || null,
          is_mandatory: data.is_mandatory,
          is_active: data.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      
      if (error) throw error;

      const { error: deleteError } = await supabase
        .from('robot_areas')
        .delete()
        .eq('robot_id', id);
      
      if (deleteError) throw deleteError;

      if (areaIds.length > 0) {
        const robotAreasData = areaIds.map(areaId => ({
          robot_id: id,
          area_id: areaId,
        }));
        
        const { error: areasError } = await supabase
          .from('robot_areas')
          .insert(robotAreasData);
        
        if (areasError) throw areasError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-robots'] });
      queryClient.invalidateQueries({ queryKey: ['admin-robot-areas'] });
      toast.success('Robô atualizado com sucesso!');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar robô: ' + error.message);
    },
  });

  // Delete robot mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('robots')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-robots'] });
      queryClient.invalidateQueries({ queryKey: ['admin-robot-areas'] });
      toast.success('Robô excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir robô: ' + error.message);
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('robots')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-robots'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  // Bulk import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<{ Nome: string; URL?: string; Descrição?: string; Áreas?: string }>(sheet);

      if (rows.length === 0) {
        toast.error('Arquivo vazio');
        return;
      }

      let imported = 0;
      for (const row of rows) {
        if (!row.Nome) continue;

        const { data: robot, error } = await supabase
          .from('robots')
          .insert([{
            name: row.Nome,
            url: row.URL || null,
            description: row['Descrição'] || null,
            is_active: true,
          }])
          .select()
          .single();

        if (error) {
          console.error('Erro ao importar robô:', error);
          continue;
        }

        // Handle areas if specified
        if (row['Áreas'] && robot) {
          const areaNames = row['Áreas'].split(',').map(a => a.trim());
          for (const areaName of areaNames) {
            const area = areas.find(a => a.name.toLowerCase() === areaName.toLowerCase());
            if (area) {
              await supabase.from('robot_areas').insert([{ robot_id: robot.id, area_id: area.id }]);
            }
          }
        }

        imported++;
      }

      queryClient.invalidateQueries({ queryKey: ['admin-robots'] });
      queryClient.invalidateQueries({ queryKey: ['admin-robot-areas'] });
      toast.success(`${imported} robôs importados!`);
    } catch (error: any) {
      toast.error('Erro na importação: ' + error.message);
    }
    e.target.value = '';
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      url: '',
      prompt: '',
      command_prompt: '',
      model: '',
      is_mandatory: false,
      is_active: true,
    });
    setSelectedAreas([]);
    setEditingRobot(null);
  };

  const handleEdit = (robot: Robot) => {
    setEditingRobot(robot);
    setFormData({
      name: robot.name,
      description: robot.description || '',
      url: robot.url || '',
      prompt: robot.prompt || '',
      command_prompt: robot.command_prompt || '',
      model: robot.model || '',
      is_mandatory: robot.is_mandatory || false,
      is_active: robot.is_active !== false,
    });
    
    const robotAreaIds = robotAreas
      .filter(ra => ra.robot_id === robot.id)
      .map(ra => ra.area_id);
    setSelectedAreas(robotAreaIds);
    
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (editingRobot) {
      updateMutation.mutate({ id: editingRobot.id, data: formData, areas: selectedAreas });
    } else {
      createMutation.mutate({ ...formData, areas: selectedAreas });
    }
  };

  const handleDelete = (robot: Robot) => {
    if (confirm(`Tem certeza que deseja excluir o robô "${robot.name}"?`)) {
      deleteMutation.mutate(robot.id);
    }
  };

  const toggleArea = (areaId: string) => {
    setSelectedAreas(prev => 
      prev.includes(areaId) 
        ? prev.filter(id => id !== areaId)
        : [...prev, areaId]
    );
  };

  const getRobotAreas = (robotId: string) => {
    return robotAreas
      .filter(ra => ra.robot_id === robotId)
      .map(ra => ra.areas?.name || '')
      .filter(Boolean);
  };

  // Get areas that don't have robots yet
  const areasWithoutRobots = areas.filter(area => {
    // Check if any robot is associated with this area
    const hasRobot = robotAreas.some(ra => ra.area_id === area.id);
    return !hasRobot;
  });

  // Auto-create robots from areas
  const handleAutoCreateRobots = async () => {
    if (autoCreateSelectedAreas.length === 0) {
      toast.error('Selecione pelo menos uma área');
      return;
    }

    setIsAutoCreating(true);
    try {
      let created = 0;
      for (const areaId of autoCreateSelectedAreas) {
        const area = areas.find(a => a.id === areaId);
        if (!area) continue;

        // Create robot with area name
        const robotName = `Tutor de ${area.name}`;
        const robotPrompt = autoCreatePromptTemplate.replace(/{área}/gi, area.name);

        const { data: robot, error } = await supabase
          .from('robots')
          .insert([{
            name: robotName,
            description: `Robô tutor especializado em ${area.name}`,
            prompt: robotPrompt,
            model: autoCreateModel,
            is_active: true,
            is_mandatory: false,
          }])
          .select()
          .single();

        if (error) {
          console.error('Erro ao criar robô:', error);
          continue;
        }

        // Associate robot with area
        await supabase.from('robot_areas').insert([{
          robot_id: robot.id,
          area_id: areaId,
        }]);

        created++;
      }

      queryClient.invalidateQueries({ queryKey: ['admin-robots'] });
      queryClient.invalidateQueries({ queryKey: ['admin-robot-areas'] });
      toast.success(`${created} robôs criados automaticamente!`);
      setAutoCreateSelectedAreas([]);
      setIsAutoCreateDialogOpen(false);
    } catch (error: any) {
      toast.error('Erro ao criar robôs: ' + error.message);
    } finally {
      setIsAutoCreating(false);
    }
  };

  const toggleAutoCreateArea = (areaId: string) => {
    setAutoCreateSelectedAreas(prev =>
      prev.includes(areaId)
        ? prev.filter(id => id !== areaId)
        : [...prev, areaId]
    );
  };

  const selectAllAreasWithoutRobots = () => {
    setAutoCreateSelectedAreas(areasWithoutRobots.map(a => a.id));
  };

  const filteredRobots = robots.filter(robot =>
    robot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (robot.description && robot.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary">Robôs ({robots.length})</h2>
        <div className="flex items-center gap-2">
          {/* Auto-create from Areas Button */}
          <Dialog open={isAutoCreateDialogOpen} onOpenChange={setIsAutoCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Wand2 className="w-4 h-4 mr-2" />
                Criar a partir de Áreas
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Robôs Automaticamente</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Selecione as áreas para criar robôs automaticamente. Cada robô será configurado com um prompt padrão baseado na área.
                </p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Áreas disponíveis</Label>
                    {areasWithoutRobots.length > 0 && (
                      <Button variant="link" size="sm" onClick={selectAllAreasWithoutRobots}>
                        Selecionar todas sem robô ({areasWithoutRobots.length})
                      </Button>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-2">
                    {areas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma área cadastrada</p>
                    ) : (
                      areas.map(area => {
                        const hasRobot = !areasWithoutRobots.some(a => a.id === area.id);
                        return (
                          <div key={area.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`auto-area-${area.id}`}
                              checked={autoCreateSelectedAreas.includes(area.id)}
                              onCheckedChange={() => toggleAutoCreateArea(area.id)}
                              disabled={hasRobot}
                            />
                            <label
                              htmlFor={`auto-area-${area.id}`}
                              className={`text-sm cursor-pointer flex-1 ${hasRobot ? 'text-muted-foreground line-through' : ''}`}
                            >
                              {area.name}
                              {hasRobot && <span className="text-xs ml-2">(já possui robô)</span>}
                            </label>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Modelo de IA</Label>
                  <Select value={autoCreateModel} onValueChange={setAutoCreateModel}>
                    <SelectTrigger>
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
                </div>

                <div className="space-y-2">
                  <Label>Template do Prompt</Label>
                  <Textarea
                    value={autoCreatePromptTemplate}
                    onChange={(e) => setAutoCreatePromptTemplate(e.target.value)}
                    rows={4}
                    placeholder="Use {área} para inserir o nome da área"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use <code className="bg-muted px-1 rounded">{'{área}'}</code> para inserir o nome da área automaticamente.
                  </p>
                </div>

                {autoCreateSelectedAreas.length > 0 && (
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm font-medium">
                      {autoCreateSelectedAreas.length} robô(s) será(ão) criado(s):
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {autoCreateSelectedAreas.map(areaId => {
                        const area = areas.find(a => a.id === areaId);
                        return area ? (
                          <Badge key={areaId} variant="secondary" className="text-xs">
                            Tutor de {area.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAutoCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAutoCreateRobots} disabled={isAutoCreating || autoCreateSelectedAreas.length === 0}>
                  {isAutoCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Criar {autoCreateSelectedAreas.length} Robô(s)
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <label className="cursor-pointer">
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} className="hidden" />
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                Importar CSV/XLSX
              </span>
            </Button>
          </label>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Robô
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingRobot ? 'Editar Robô' : 'Novo Robô'}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome do robô"
                  />
                </div>

                <div className="p-3 bg-muted/50 rounded-lg space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Preencha URL para link externo, Prompt para chat interno com IA, ou ambos para dar opções ao usuário:
                  </p>
                  
                  <div className="space-y-2">
                    <Label htmlFor="url">URL (link externo)</Label>
                    <Input
                      id="url"
                      value={formData.url}
                      onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="text-center text-xs text-muted-foreground">e/ou</div>

                  <div className="space-y-2">
                    <Label htmlFor="command_prompt">
                      Prompt de Comando
                      <span className="text-xs text-muted-foreground ml-2">Instruções prioritárias no início do system prompt</span>
                    </Label>
                    <Textarea
                      id="command_prompt"
                      value={formData.command_prompt}
                      onChange={(e) => setFormData(prev => ({ ...prev, command_prompt: e.target.value }))}
                      placeholder="Instruções de alto nível que vão no cabeçalho do prompt. Ex: REGRAS GERAIS: Nunca mencione..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prompt">Prompt do Sistema (Instruções para IA)</Label>
                    <Textarea
                      id="prompt"
                      value={formData.prompt}
                      onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                      placeholder="Digite as instruções do sistema para a IA. Ex: Você é um tutor especializado em..."
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Modelo OpenAI <span className="text-primary">(preencha o Prompt)</span>
                    </Label>
                    <Select
                      value={formData.model}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, model: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map(model => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name} {model.price && `(${model.price})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Gerencie modelos na aba "Modelos IA".
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição opcional"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="is_mandatory"
                    checked={formData.is_mandatory}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_mandatory: checked }))}
                  />
                  <Label htmlFor="is_mandatory" className="flex items-center gap-1">
                    <Star className="w-4 h-4" />
                    Obrigatório para todos
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label>Áreas associadas</Label>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
                    {areas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma área cadastrada</p>
                    ) : (
                      areas.map(area => (
                        <Badge
                          key={area.id}
                          variant={selectedAreas.includes(area.id) ? "default" : "outline"}
                          className="cursor-pointer hover:bg-primary/20"
                          onClick={() => toggleArea(area.id)}
                        >
                          {area.name}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingRobot ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar robôs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Robot List */}
      {loadingRobots ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filteredRobots.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm ? 'Nenhum robô encontrado' : 'Nenhum robô cadastrado'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRobots.map((robot) => {
            const robotAreasList = getRobotAreas(robot.id);
            return (
              <div
                key={robot.id}
                className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{robot.name}</div>
                  <div className="text-sm text-primary flex items-center gap-1">
                    <Bot className="w-3 h-3" />
                    Chat IA: {robot.model || 'Não configurado'}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {robot.is_mandatory ? (
                      <Badge variant="secondary" className="text-xs">Todos</Badge>
                    ) : robotAreasList.length > 0 ? (
                      robotAreasList.slice(0, 2).map((area, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{area}</Badge>
                      ))
                    ) : null}
                    {robotAreasList.length > 2 && (
                      <Badge variant="secondary" className="text-xs">+{robotAreasList.length - 2}</Badge>
                    )}
                  </div>
                </div>

                <Switch
                  checked={robot.is_active !== false}
                  onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: robot.id, is_active: checked })}
                />
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(robot)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(robot)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
