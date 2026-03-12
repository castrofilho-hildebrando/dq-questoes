import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Trash2, FileText, Star, Map } from 'lucide-react';

interface Area {
  id: string;
  name: string;
}

interface Edital {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  area_id: string | null;
  created_at: string;
}

export function AdminEditaisSimples() {
  const { toast } = useToast();
  const [editais, setEditais] = useState<Edital[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEdital, setEditingEdital] = useState<Edital | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_default: false,
    is_active: true,
    display_order: 0,
    area_id: '' as string | null
  });

  const fetchEditais = async () => {
    try {
      const { data, error } = await supabase
        .from('editals')
        .select('*')
        .order('name');

      if (error) throw error;
      setEditais(data || []);
    } catch (error) {
      console.error('Error fetching editais:', error);
      toast({
        title: 'Erro ao carregar editais',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .select('id, name')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setAreas(data || []);
    } catch (error) {
      console.error('Error fetching areas:', error);
    }
  };

  useEffect(() => {
    Promise.all([fetchEditais(), fetchAreas()]);
  }, []);

  const handleSubmit = async () => {
    try {
      if (!formData.name.trim()) {
        toast({ title: 'Nome é obrigatório', variant: 'destructive' });
        return;
      }

      const payload = {
        name: formData.name,
        description: formData.description || null,
        is_default: formData.is_default,
        is_active: formData.is_active,
        display_order: formData.display_order,
        area_id: formData.area_id || null
      };

      if (editingEdital) {
        const { error } = await supabase
          .from('editals')
          .update(payload)
          .eq('id', editingEdital.id);

        if (error) throw error;
        toast({ title: 'Edital atualizado com sucesso!' });
      } else {
        const { error } = await supabase
          .from('editals')
          .insert(payload);

        if (error) throw error;
        toast({ title: 'Edital criado com sucesso!' });
      }

      setEditDialogOpen(false);
      setEditingEdital(null);
      setFormData({ name: '', description: '', is_default: false, is_active: true, display_order: 0, area_id: '' });
      fetchEditais();
    } catch (error) {
      console.error('Error saving edital:', error);
      toast({ title: 'Erro ao salvar edital', variant: 'destructive' });
    }
  };

  const handleEdit = (edital: Edital) => {
    setEditingEdital(edital);
    setFormData({
      name: edital.name,
      description: edital.description || '',
      is_default: edital.is_default,
      is_active: edital.is_active,
      display_order: edital.display_order,
      area_id: edital.area_id || ''
    });
    setEditDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este edital?')) return;

    try {
      const { error } = await supabase
        .from('editals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Edital excluído com sucesso!' });
      fetchEditais();
    } catch (error) {
      console.error('Error deleting edital:', error);
      toast({ title: 'Erro ao excluir edital', variant: 'destructive' });
    }
  };

  const openNewDialog = () => {
    setEditingEdital(null);
    setFormData({ name: '', description: '', is_default: false, is_active: true, display_order: editais.length, area_id: '' });
    setEditDialogOpen(true);
  };

  const getAreaName = (areaId: string | null) => {
    if (!areaId) return null;
    return areas.find(a => a.id === areaId)?.name;
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
              <FileText className="w-5 h-5" />
              Editais
            </CardTitle>
            <CardDescription>
              Gerencie os editais gerados por mapeamento. Estes editais são usados no cronograma.
            </CardDescription>
          </div>
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Edital
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingEdital ? 'Editar Edital' : 'Novo Edital'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: IF Sudeste de MG"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição opcional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order">Ordem de exibição</Label>
                  <Input
                    id="order"
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                    />
                    <Label htmlFor="is_active">Ativo</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_default"
                      checked={formData.is_default}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_default: checked }))}
                    />
                    <Label htmlFor="is_default">Padrão</Label>
                  </div>
                </div>
                <Button onClick={handleSubmit} className="w-full">
                  {editingEdital ? 'Salvar Alterações' : 'Criar Edital'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {editais.map((edital) => (
              <TableRow key={edital.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {edital.name}
                    {edital.is_default && (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {edital.area_id ? (
                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                      <Map className="w-3 h-3" />
                      {getAreaName(edital.area_id)}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-xs truncate">
                  {edital.description || '-'}
                </TableCell>
                <TableCell>
                  <Badge variant={edital.is_active ? 'default' : 'secondary'}>
                    {edital.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(edital)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(edital.id)}
                      disabled={edital.is_default}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {editais.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum edital cadastrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
