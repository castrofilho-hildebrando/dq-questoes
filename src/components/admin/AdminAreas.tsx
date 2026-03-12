import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Map as MapIcon, RefreshCw, Info, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Area {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

interface PreEditalDiscipline {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}


export function AdminAreas() {
  const { toast } = useToast();
  const [areas, setAreas] = useState<Area[]>([]);
  const [preEditalDisciplines, setPreEditalDisciplines] = useState<PreEditalDiscipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchPreEditalDisciplines = async (): Promise<PreEditalDiscipline[]> => {
    try {
      const { data: preEdital, error: preEditalError } = await supabase
        .from('editals')
        .select('id')
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

      if (preEditalError || !preEdital) {
        console.log('No pre-edital found');
        return [];
      }

      const { data: editalDisciplines, error: edError } = await supabase
        .from('edital_disciplines')
        .select(`
          discipline_id,
          display_order,
          study_disciplines!inner (
            id,
            name,
            display_order,
            is_active
          )
        `)
        .eq('edital_id', preEdital.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (edError) {
        console.error('Error fetching edital disciplines:', edError);
        return [];
      }

      const disciplines: PreEditalDiscipline[] = (editalDisciplines || []).map((ed: any) => ({
        id: ed.study_disciplines.id,
        name: ed.study_disciplines.name,
        display_order: ed.display_order ?? ed.study_disciplines.display_order ?? 0,
        is_active: ed.study_disciplines.is_active ?? true
      }));

      setPreEditalDisciplines(disciplines);
      return disciplines;
    } catch (error) {
      console.error('Error fetching pre-edital disciplines:', error);
      return [];
    }
  };

  const fetchAreas = async (): Promise<Area[]> => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('name');

      if (error) throw error;
      setAreas(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching areas:', error);
      toast({
        title: 'Erro ao carregar áreas',
        variant: 'destructive'
      });
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

  const syncAreasWithPreEdital = async () => {
    setSyncing(true);
    
    try {
      const disciplines = await fetchPreEditalDisciplines();
      
      if (disciplines.length === 0) {
        toast({
          title: 'Nenhuma disciplina encontrada',
          description: 'Verifique se o pré-edital está configurado corretamente.',
          variant: 'destructive'
        });
        setSyncing(false);
        return;
      }

      const { data: currentAreas } = await supabase
        .from('areas')
        .select('*');

      const areasArray = currentAreas || [];
      const existingAreasMap: Record<string, (typeof areasArray)[0]> = {};
      areasArray.forEach(a => {
        existingAreasMap[a.name.toLowerCase().trim()] = a;
      });

      let created = 0;
      let updated = 0;

      for (const discipline of disciplines) {
        const key = discipline.name.toLowerCase().trim();
        const existingArea = existingAreasMap[key];
        
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
              description: 'Área criada automaticamente a partir da disciplina do pré-edital',
              display_order: discipline.display_order,
              is_active: discipline.is_active
            });
          created++;
        }
      }

      const disciplineNamesSet = new Set(disciplines.map(d => d.name.toLowerCase().trim()));
      const orphanAreas = areasArray.filter(a => !disciplineNamesSet.has(a.name.toLowerCase().trim()));
      
      for (const orphan of orphanAreas) {
        await supabase
          .from('areas')
          .delete()
          .eq('id', orphan.id);
      }

      const messages: string[] = [];
      if (created > 0) messages.push(`${created} área(s) criada(s)`);
      if (updated > 0) messages.push(`${updated} área(s) atualizada(s)`);
      if (orphanAreas.length > 0) messages.push(`${orphanAreas.length} área(s) removida(s)`);

      toast({
        title: 'Sincronização concluída!',
        description: messages.length > 0 ? messages.join(', ') : 'Áreas já estavam sincronizadas'
      });

      await fetchAll();
    } catch (error) {
      console.error('Error syncing areas:', error);
      toast({
        title: 'Erro ao sincronizar áreas',
        variant: 'destructive'
      });
    } finally {
      setSyncing(false);
    }
  };


  const fetchAll = async () => {
    setLoading(true);
    const [areasData, disciplinesData] = await Promise.all([
      fetchAreas(),
      fetchPreEditalDisciplines()
    ]);
    checkForChanges(areasData, disciplinesData);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const toggleAreaActive = async (area: Area) => {
    try {
      const { error } = await supabase
        .from('areas')
        .update({ is_active: !area.is_active })
        .eq('id', area.id);

      if (error) throw error;
      
      toast({ title: area.is_active ? 'Área desativada' : 'Área ativada' });
      fetchAreas();
    } catch (error) {
      console.error('Error toggling area:', error);
      toast({ title: 'Erro ao atualizar área', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapIcon className="w-5 h-5" />
              Áreas de Estudo
            </CardTitle>
            <CardDescription>
              Áreas são criadas automaticamente a partir das disciplinas do pré-edital
            </CardDescription>
          </div>
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
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            As áreas são derivadas automaticamente das disciplinas vinculadas ao <strong>pré-edital</strong>. 
            Ao adicionar ou remover disciplinas do pré-edital, clique em "Sincronizar" para atualizar as áreas.
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

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Disciplina Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ordem</TableHead>
              <TableHead className="text-right">Ativo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {areas.map((area) => {
              const matchingDiscipline = preEditalDisciplines.find(
                d => d.name.toLowerCase().trim() === area.name.toLowerCase().trim()
              );
              
              return (
                <TableRow key={area.id}>
                  <TableCell className="font-medium">{area.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {matchingDiscipline ? (
                      <Badge variant="outline" className="text-xs">
                        {matchingDiscipline.name}
                      </Badge>
                    ) : (
                      <span className="text-yellow-600 text-xs">Sem disciplina</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={area.is_active ? 'default' : 'secondary'}>
                      {area.is_active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell>{area.display_order}</TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={area.is_active}
                      onCheckedChange={() => toggleAreaActive(area)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {areas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhuma área cadastrada. Clique em "Sincronizar" para criar áreas automaticamente.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {preEditalDisciplines.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              Disciplinas no pré-edital: <strong>{preEditalDisciplines.length}</strong>
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
      </CardContent>
    </Card>
  );
}
