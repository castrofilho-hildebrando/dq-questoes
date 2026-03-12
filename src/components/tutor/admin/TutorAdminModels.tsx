import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Cpu, DollarSign, Sparkles, RotateCcw } from 'lucide-react';

export interface AIModel {
  id: string;
  name: string;
  price?: string;
  isActive: boolean;
}

const DEFAULT_MODELS: AIModel[] = [
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', price: 'Rápido', isActive: true },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', price: 'Econômico', isActive: true },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', price: 'Premium', isActive: true },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', price: 'Balanceado', isActive: true },
  { id: 'openai/gpt-5', name: 'GPT-5', price: 'Premium', isActive: false },
  { id: 'gpt-4o', name: 'GPT-4o (Legacy)', price: '$2.50/$10.00', isActive: true },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Legacy)', price: '$0.15/$0.60', isActive: true },
  { id: 'gpt-5-nano', name: 'GPT-5 Nano', price: '$0.05/$0.4', isActive: true },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', price: '$0.8/$0.4', isActive: true },
];

const LOCAL_STORAGE_KEY = 'tutor-available-models';

// Export function to get models from anywhere
export function getAvailableModels(): AIModel[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((m: AIModel) => m.isActive);
      }
    }
  } catch (e) {
    console.error('Error loading models:', e);
  }
  return DEFAULT_MODELS.filter(m => m.isActive);
}

// Export all models (active and inactive)
export function getAllModels(): AIModel[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading models:', e);
  }
  return DEFAULT_MODELS;
}

export function TutorAdminModels() {
  const [models, setModels] = useState<AIModel[]>(DEFAULT_MODELS);
  const [newModel, setNewModel] = useState({ id: '', name: '', price: '' });
  const [hasChanges, setHasChanges] = useState(false);

  // Load saved models on mount
  useEffect(() => {
    const savedModels = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedModels) {
      try {
        const parsed = JSON.parse(savedModels);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setModels(parsed);
        }
      } catch (e) {
        console.error('Error parsing saved models:', e);
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(models));
    setHasChanges(false);
    toast.success('Modelos salvos com sucesso!');
  };

  const handleReset = () => {
    if (confirm('Restaurar modelos padrão? Isso apagará suas customizações.')) {
      setModels(DEFAULT_MODELS);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_MODELS));
      setHasChanges(false);
      toast.success('Modelos restaurados para o padrão!');
    }
  };

  const handleAddModel = () => {
    if (!newModel.id.trim() || !newModel.name.trim()) {
      toast.error('ID e Nome são obrigatórios');
      return;
    }

    if (models.some(m => m.id === newModel.id)) {
      toast.error('Já existe um modelo com este ID');
      return;
    }

    setModels(prev => [...prev, { ...newModel, isActive: true }]);
    setNewModel({ id: '', name: '', price: '' });
    setHasChanges(true);
  };

  const handleRemoveModel = (id: string) => {
    if (confirm('Remover este modelo?')) {
      setModels(prev => prev.filter(m => m.id !== id));
      setHasChanges(true);
    }
  };

  const handleToggleActive = (id: string) => {
    setModels(prev => prev.map(m => 
      m.id === id ? { ...m, isActive: !m.isActive } : m
    ));
    setHasChanges(true);
  };

  const handleUpdateModel = (id: string, field: keyof AIModel, value: string) => {
    setModels(prev => prev.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    ));
    setHasChanges(true);
  };

  const activeCount = models.filter(m => m.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Cpu className="w-6 h-6 text-primary" />
            Modelos de IA ({activeCount} ativos)
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie os modelos de IA disponíveis para os robôs tutores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Restaurar Padrão
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
            <Save className="w-4 h-4 mr-2" />
            Salvar Modelos
          </Button>
        </div>
      </div>

      {/* Add New Model */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Adicionar Novo Modelo
          </CardTitle>
          <CardDescription>
            Adicione novos modelos de IA para disponibilizar nos robôs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>ID do Modelo *</Label>
              <Input
                value={newModel.id}
                onChange={(e) => setNewModel(prev => ({ ...prev, id: e.target.value }))}
                placeholder="google/gemini-2.5-flash"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome de Exibição *</Label>
              <Input
                value={newModel.name}
                onChange={(e) => setNewModel(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Gemini 2.5 Flash"
              />
            </div>
            <div className="space-y-2">
              <Label>Preço/Descrição</Label>
              <Input
                value={newModel.price}
                onChange={(e) => setNewModel(prev => ({ ...prev, price: e.target.value }))}
                placeholder="$0.15/$0.60"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddModel} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Models List */}
      <Card>
        <CardHeader>
          <CardTitle>Modelos Configurados</CardTitle>
          <CardDescription>
            Ative ou desative modelos. Modelos inativos não aparecerão nas opções dos robôs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {models.map((model) => (
              <div
                key={model.id}
                className={`flex items-center gap-4 p-4 rounded-lg border ${
                  model.isActive ? 'bg-card border-border' : 'bg-muted/50 border-muted'
                }`}
              >
                <Switch
                  checked={model.isActive}
                  onCheckedChange={() => handleToggleActive(model.id)}
                />
                
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">ID</Label>
                    <Input
                      value={model.id}
                      onChange={(e) => handleUpdateModel(model.id, 'id', e.target.value)}
                      className="h-8 text-sm font-mono"
                      disabled
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nome</Label>
                    <Input
                      value={model.name}
                      onChange={(e) => handleUpdateModel(model.id, 'name', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Preço</Label>
                    <Input
                      value={model.price || ''}
                      onChange={(e) => handleUpdateModel(model.id, 'price', e.target.value)}
                      className="h-8 text-sm"
                      placeholder="Ex: $0.15/$0.60"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {model.isActive && (
                    <Badge variant="default" className="bg-green-600">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Ativo
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveModel(model.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <DollarSign className="w-5 h-5 text-blue-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-600 dark:text-blue-400">Sobre os Modelos</p>
              <p className="text-muted-foreground mt-1">
                Os modelos com prefixo <code className="bg-muted px-1 rounded">google/</code> ou <code className="bg-muted px-1 rounded">openai/</code> 
                {' '}utilizam o Lovable AI Gateway e não requerem API key adicional. 
                Modelos legados (gpt-4o, gpt-4o-mini, etc.) usam a API OpenAI diretamente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
