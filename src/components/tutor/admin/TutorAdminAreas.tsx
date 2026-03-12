import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Layers, Search, RefreshCw, Loader2, Info, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Area {
  id: string;
  name: string;
  description: string | null;
  display_order: number | null;
  is_active: boolean | null;
}

interface PreEditalDiscipline {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

export function TutorAdminAreas() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [preEditalDisciplines, setPreEditalDisciplines] = useState<PreEditalDiscipline[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch areas
  const { data: areas = [], isLoading, refetch } = useQuery({
    queryKey: ['tutor-admin-areas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Area[];
    },
  });

  // Busca disciplinas-fonte (aquelas com area_id preenchido = criadas via ZIP)
  const fetchSourceDisciplines = async (): Promise<PreEditalDiscipline[]> => {
    try {
      // Disciplinas-fonte são aquelas que têm area_id (criadas via upload ZIP)
      const { data: sourceDisciplines, error } = await supabase
        .from('study_disciplines')
        .select('id, name, display_order, is_active, area_id')
        .not('area_id', 'is', null)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching source disciplines:', error);
        return [];
      }

      const disciplines: PreEditalDiscipline[] = (sourceDisciplines || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        display_order: d.display_order ?? 0,
        is_active: d.is_active ?? true
      }));

      setPreEditalDisciplines(disciplines);
      return disciplines;
    } catch (error) {
      console.error('Error fetching source disciplines:', error);
      return [];
    }
  };

  const checkForChanges = (currentAreas: Area[], disciplines: PreEditalDiscipline[]) => {
    const areaNames = new Set(currentAreas.map(a => a.name.toLowerCase().trim()));
    const missingDisciplines = disciplines.filter(d => !areaNames.has(d.name.toLowerCase().trim()));
    
    const disciplineNames = new Set(disciplines.map(d => d.name.toLowerCase().trim()));
    const orphanAreas = currentAreas.filter(a => !disciplineNames.has(a.name.toLowerCase().trim()));
    
    setHasChanges(missingDisciplines.length > 0 || orphanAreas.length > 0);
  };

  useEffect(() => {
    fetchSourceDisciplines().then(disciplines => {
      checkForChanges(areas, disciplines);
    });
  }, [areas]);

  const syncAreasWithPreEdital = async () => {
    setSyncing(true);
    
    try {
      const disciplines = await fetchSourceDisciplines();
      
      if (disciplines.length === 0) {
        toast.error('Nenhuma disciplina-fonte encontrada (disciplinas com area_id)');
        setSyncing(false);
        return;
      }

      // Get current areas
      const { data: currentAreas } = await supabase
        .from('areas')
        .select('*');

      const existingAreasMap = new Map((currentAreas || []).map(a => [a.name.toLowerCase().trim(), a]));

      // Sync areas with disciplines
      let created = 0;
      let updated = 0;

      for (const discipline of disciplines) {
        const existingArea = existingAreasMap.get(discipline.name.toLowerCase().trim());
        
        if (existingArea) {
          if (existingArea.display_order !== discipline.display_order) {
            await supabase
              .from('areas')
              .update({ 
                display_order: discipline.display_order,
                is_active: discipline.is_active
              })
              .eq('id', existingArea.id);
            updated++;
          }
        } else {
          await supabase
            .from('areas')
            .insert({
              name: discipline.name,
              description: `Área criada automaticamente a partir da disciplina do pré-edital`,
              display_order: discipline.display_order,
              is_active: discipline.is_active
            });
          created++;
        }
      }

      // NÃO remover áreas órfãs - apenas criar/atualizar
      // Áreas podem existir mesmo sem disciplina vinculada diretamente

      const messages: string[] = [];
      if (created > 0) messages.push(`${created} criada(s)`);
      if (updated > 0) messages.push(`${updated} atualizada(s)`);

      toast.success(messages.length > 0 ? `Sincronização: ${messages.join(', ')}` : 'Áreas já sincronizadas');
      
      queryClient.invalidateQueries({ queryKey: ['tutor-admin-areas'] });
      setHasChanges(false);
    } catch (error) {
      console.error('Error syncing areas:', error);
      toast.error('Erro ao sincronizar áreas');
    } finally {
      setSyncing(false);
    }
  };

  const toggleAreaActive = async (area: Area) => {
    try {
      const { error } = await supabase
        .from('areas')
        .update({ is_active: !area.is_active })
        .eq('id', area.id);

      if (error) throw error;
      
      toast.success(area.is_active ? 'Área desativada' : 'Área ativada');
      refetch();
    } catch (error) {
      console.error('Error toggling area:', error);
      toast.error('Erro ao atualizar área');
    }
  };

  const filteredAreas = areas.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary">Áreas ({areas.length})</h2>
        <Button 
          onClick={syncAreasWithPreEdital}
          disabled={syncing}
          variant={hasChanges ? "default" : "outline"}
        >
          {syncing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Sincronizar com Pré-Edital
        </Button>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          As áreas são derivadas automaticamente das <strong>disciplinas-fonte</strong> (criadas via upload ZIP). 
          A sincronização cria áreas faltantes, mas não remove áreas existentes.
        </AlertDescription>
      </Alert>

      {hasChanges && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Existem diferenças entre as áreas e as disciplinas do pré-edital. Clique em "Sincronizar" para atualizar.
          </AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar áreas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Areas List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filteredAreas.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {areas.length === 0 
            ? 'Nenhuma área cadastrada. Clique em "Sincronizar" para criar áreas automaticamente.'
            : 'Nenhuma área encontrada'
          }
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAreas.map((area) => {
            const matchingDiscipline = preEditalDisciplines.find(
              d => d.name.toLowerCase().trim() === area.name.toLowerCase().trim()
            );
            
            return (
              <div
                key={area.id}
                className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-5 h-5 text-purple-400" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-semibold flex items-center gap-2">
                    {area.name}
                    {!matchingDiscipline && (
                      <Badge variant="outline" className="text-yellow-600 text-xs">
                        Sem disciplina
                      </Badge>
                    )}
                  </div>
                  {area.description && (
                    <div className="text-sm text-muted-foreground truncate">{area.description}</div>
                  )}
                </div>

                <Badge variant={area.is_active ? 'default' : 'secondary'}>
                  {area.is_active ? 'Ativa' : 'Inativa'}
                </Badge>
                
                <Switch
                  checked={area.is_active ?? true}
                  onCheckedChange={() => toggleAreaActive(area)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Source disciplines info */}
      {preEditalDisciplines.length > 0 && (
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-2">
            Disciplinas-fonte (com area_id): <strong>{preEditalDisciplines.length}</strong>
          </p>
          <div className="flex flex-wrap gap-1">
            {preEditalDisciplines.map(d => (
              <Badge key={d.id} variant="secondary" className="text-xs">
                {d.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
