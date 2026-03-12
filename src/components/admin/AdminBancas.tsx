import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  RefreshCw, 
  Scale,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Trash,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Banca {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export function AdminBancas() {
  const [bancas, setBancas] = useState<Banca[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBanca, setEditingBanca] = useState<Banca | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchBancas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bancas')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching bancas:', error);
      toast.error('Erro ao carregar bancas');
    } else {
      setBancas(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBancas();
  }, []);

  const handleOpenCreate = () => {
    setEditingBanca(null);
    setName('');
    setDialogOpen(true);
  };

  const handleOpenEdit = (banca: Banca) => {
    setEditingBanca(banca);
    setName(banca.name);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSaving(true);

    if (editingBanca) {
      const { error } = await supabase
        .from('bancas')
        .update({ name: name.trim() })
        .eq('id', editingBanca.id);

      if (error) {
        console.error('Error updating banca:', error);
        toast.error('Erro ao atualizar banca');
      } else {
        toast.success('Banca atualizada');
        setDialogOpen(false);
        fetchBancas();
      }
    } else {
      const { error } = await supabase
        .from('bancas')
        .insert({ name: name.trim() });

      if (error) {
        console.error('Error creating banca:', error);
        if (error.code === '23505') {
          toast.error('Já existe uma banca com este nome');
        } else {
          toast.error('Erro ao criar banca');
        }
      } else {
        toast.success('Banca criada');
        setDialogOpen(false);
        fetchBancas();
      }
    }

    setSaving(false);
  };

  const handleToggleActive = async (banca: Banca) => {
    const { error } = await supabase
      .from('bancas')
      .update({ is_active: !banca.is_active })
      .eq('id', banca.id);

    if (error) {
      console.error('Error toggling banca:', error);
      toast.error('Erro ao atualizar status');
    } else {
      fetchBancas();
    }
  };

  const handleDelete = async (banca: Banca) => {
    if (!confirm(`Deseja excluir a banca "${banca.name}"? As questões e provas vinculadas terão a banca removida.`)) return;

    // First, unlink questions and provas from this banca
    await Promise.all([
      supabase.from('questions').update({ banca_id: null }).eq('banca_id', banca.id),
      supabase.from('provas').update({ banca_id: null }).eq('banca_id', banca.id),
    ]);

    const { error } = await supabase
      .from('bancas')
      .delete()
      .eq('id', banca.id);

    if (error) {
      console.error('Error deleting banca:', error);
      toast.error('Erro ao excluir banca');
    } else {
      toast.success('Banca excluída');
      fetchBancas();
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const idsArray = Array.from(selectedIds);
      
      // First, unlink questions and provas from these bancas
      await Promise.all([
        supabase.from('questions').update({ banca_id: null }).in('banca_id', idsArray),
        supabase.from('provas').update({ banca_id: null }).in('banca_id', idsArray),
      ]);

      const { error } = await supabase
        .from('bancas')
        .delete()
        .in('id', idsArray);

      if (error) throw error;

      toast.success(`${selectedIds.size} bancas excluídas`);
      setBatchDeleteDialogOpen(false);
      setSelectedIds(new Set());
      fetchBancas();
    } catch (error) {
      console.error('Error batch deleting:', error);
      toast.error('Erro ao excluir bancas');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === bancas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bancas.map(b => b.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5" />
              Bancas
            </CardTitle>
            <CardDescription>
              Gerencie as bancas examinadoras
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchBancas}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Banca
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Batch Actions */}
        <div className="flex items-center gap-4 py-2 px-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={selectedIds.size === bancas.length && bancas.length > 0} 
              onCheckedChange={() => toggleSelectAll()}
              id="select-all-bancas"
            />
            <Label htmlFor="select-all-bancas" className="text-sm font-medium cursor-pointer">
              Selecionar tudo
            </Label>
          </div>
          
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selecionada(s)
              </span>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setBatchDeleteDialogOpen(true)}
                className="gap-1"
              >
                <Trash className="h-4 w-4" />
                Excluir Selecionadas
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedIds(new Set())}
              >
                Desmarcar Tudo
              </Button>
            </>
          )}
        </div>

        {bancas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Scale className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma banca cadastrada</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={selectedIds.size === bancas.length && bancas.length > 0} 
                    onCheckedChange={() => toggleSelectAll()}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-24 text-center">Status</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bancas.map((banca) => (
                <TableRow key={banca.id} className={selectedIds.has(banca.id) ? 'bg-muted/50' : ''}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedIds.has(banca.id)} 
                      onCheckedChange={() => toggleSelect(banca.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{banca.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={banca.is_active ? 'default' : 'secondary'}>
                      {banca.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Switch
                        checked={banca.is_active}
                        onCheckedChange={() => handleToggleActive(banca)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(banca)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleDelete(banca)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBanca ? 'Editar Banca' : 'Nova Banca'}
            </DialogTitle>
            <DialogDescription>
              {editingBanca ? 'Atualize as informações da banca' : 'Preencha as informações da nova banca'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: CEBRASPE, FGV, FCC, etc."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingBanca ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Delete Dialog */}
      <AlertDialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} bancas?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selectedIds.size}</strong> bancas selecionadas? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBatchDelete} 
              className="bg-destructive text-destructive-foreground"
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir {selectedIds.size} bancas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}