import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, School, FileText, BookOpen } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Edital {
  id: string;
  name: string;
}

interface SchoolWithEdital {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  edital_id: string | null;
  editals?: { id: string; name: string } | null;
  discipline_count?: number;
}

export function AdminSchools() {
  const { toast } = useToast();
  const [schools, setSchools] = useState<SchoolWithEdital[]>([]);
  const [editals, setEditals] = useState<Edital[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEditalId, setFilterEditalId] = useState<string>('');

  const fetchEditals = async () => {
    try {
      const { data, error } = await supabase
        .from('editals')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setEditals(data || []);
    } catch (error) {
      console.error('Error fetching editals:', error);
    }
  };

  const fetchSchools = async () => {
    try {
      let query = supabase
        .from('schools')
        .select(`
          id,
          name,
          description,
          is_active,
          display_order,
          edital_id,
          editals(id, name)
        `)
        .not('edital_id', 'is', null) // Only show schools that belong to an edital
        .order('display_order', { ascending: true });

      if (filterEditalId) {
        query = query.eq('edital_id', filterEditalId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch discipline counts for each school
      const schoolsWithCounts = await Promise.all((data || []).map(async (school) => {
        const { count } = await supabase
          .from('school_disciplines')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id);
        
        return {
          ...school,
          editals: school.editals as { id: string; name: string } | null,
          discipline_count: count || 0
        };
      }));
      
      setSchools(schoolsWithCounts);
    } catch (error) {
      console.error('Error fetching schools:', error);
      toast({
        title: 'Erro ao carregar escolas',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEditals();
  }, []);

  useEffect(() => {
    fetchSchools();
  }, [filterEditalId]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir a escola "${name}"?\n\nIsso também excluirá:\n- Todas as disciplinas vinculadas\n- Todos os tópicos\n- Todas as metas\n- Cronogramas de usuários`)) return;

    try {
      const { data, error } = await supabase
        .rpc('delete_school_cascade', { p_school_id: id });

      if (error) throw error;
      
      const result = data as { success: boolean; deleted: { goals: number; topics: number; disciplines: number } };
      toast({ 
        title: 'Escola excluída com sucesso!',
        description: `Removidos: ${result.deleted.disciplines} disciplinas, ${result.deleted.topics} tópicos, ${result.deleted.goals} metas`
      });
      fetchSchools();
    } catch (error) {
      console.error('Error deleting school:', error);
      toast({ title: 'Erro ao excluir escola', variant: 'destructive' });
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
              <School className="w-5 h-5" />
              Escolas
            </CardTitle>
            <CardDescription>
              Visualize as escolas criadas a partir dos editais. Para criar novas escolas, vá em "Editais" e use o botão "Criar Escola".
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter by Edital */}
        <div className="max-w-xs">
          <Label className="text-sm text-muted-foreground mb-2 block">Filtrar por Edital</Label>
          <Select value={filterEditalId || "all"} onValueChange={(v) => setFilterEditalId(v === "all" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os editais" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os editais</SelectItem>
              {editals.map((edital) => (
                <SelectItem key={edital.id} value={edital.id}>
                  {edital.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome da Escola</TableHead>
              <TableHead>Edital Pai</TableHead>
              <TableHead>Disciplinas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schools.map((school) => (
              <TableRow key={school.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <School className="w-4 h-4 text-muted-foreground" />
                    {school.name}
                  </div>
                </TableCell>
                <TableCell>
                  {school.editals ? (
                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                      <FileText className="w-3 h-3" />
                      {school.editals.name}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                    <BookOpen className="w-3 h-3" />
                    {school.discipline_count} disciplinas
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={school.is_active ? 'default' : 'secondary'}>
                    {school.is_active ? 'Ativa' : 'Inativa'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDelete(school.id, school.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {schools.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {filterEditalId 
                    ? 'Nenhuma escola encontrada para este edital' 
                    : 'Nenhuma escola cadastrada. Crie escolas através do menu "Editais".'
                  }
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}