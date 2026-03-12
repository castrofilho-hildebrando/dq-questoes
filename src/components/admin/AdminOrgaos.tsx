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
  Building2,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Trash,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Orgao {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export function AdminOrgaos() {
  const [orgaos, setOrgaos] = useState<Orgao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrgao, setEditingOrgao] = useState<Orgao | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchOrgaos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orgaos')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching orgaos:', error);
      toast.error('Erro ao carregar órgãos');
    } else {
      setOrgaos(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrgaos();
  }, []);

  const handleOpenCreate = () => {
    setEditingOrgao(null);
    setName('');
    setDialogOpen(true);
  };

  const handleOpenEdit = (orgao: Orgao) => {
    setEditingOrgao(orgao);
    setName(orgao.name);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSaving(true);

    if (editingOrgao) {
      const { error } = await supabase
        .from('orgaos')
        .update({ name: name.trim() })
        .eq('id', editingOrgao.id);

      if (error) {
        console.error('Error updating orgao:', error);
        toast.error('Erro ao atualizar órgão');
      } else {
        toast.success('Órgão atualizado');
        setDialogOpen(false);
        fetchOrgaos();
      }
    } else {
      const { error } = await supabase
        .from('orgaos')
        .insert({ name: name.trim() });

      if (error) {
        console.error('Error creating orgao:', error);
        if (error.code === '23505') {
          toast.error('Já existe um órgão com este nome');
        } else {
          toast.error('Erro ao criar órgão');
        }
      } else {
        toast.success('Órgão criado');
        setDialogOpen(false);
        fetchOrgaos();
      }
    }

    setSaving(false);
  };

  const handleToggleActive = async (orgao: Orgao) => {
    const { error } = await supabase
      .from('orgaos')
      .update({ is_active: !orgao.is_active })
      .eq('id', orgao.id);

    if (error) {
      console.error('Error toggling orgao:', error);
      toast.error('Erro ao atualizar status');
    } else {
      fetchOrgaos();
    }
  };

  const handleDelete = async (orgao: Orgao) => {
    if (!confirm(`Deseja excluir o órgão "${orgao.name}"? As questões vinculadas terão o órgão removido.`)) return;

    // First, unlink questions from this orgao
    await supabase
      .from('questions')
      .update({ orgao_id: null })
      .eq('orgao_id', orgao.id);

    const { error } = await supabase
      .from('orgaos')
      .delete()
      .eq('id', orgao.id);

    if (error) {
      console.error('Error deleting orgao:', error);
      toast.error('Erro ao excluir órgão');
    } else {
      toast.success('Órgão excluído');
      fetchOrgaos();
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      // First, unlink questions from these orgaos
      await supabase
        .from('questions')
        .update({ orgao_id: null })
        .in('orgao_id', Array.from(selectedIds));

      const { error } = await supabase
        .from('orgaos')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast.success(`${selectedIds.size} órgãos excluídos`);
      setBatchDeleteDialogOpen(false);
      setSelectedIds(new Set());
      fetchOrgaos();
    } catch (error) {
      console.error('Error batch deleting:', error);
      toast.error('Erro ao excluir órgãos');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orgaos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orgaos.map(o => o.id)));
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
              <Building2 className="w-5 h-5" />
              Órgãos
            </CardTitle>
            <CardDescription>
              Gerencie os órgãos das provas
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchOrgaos}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Órgão
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Batch Actions */}
        <div className="flex items-center gap-4 py-2 px-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={selectedIds.size === orgaos.length && orgaos.length > 0} 
              onCheckedChange={() => toggleSelectAll()}
              id="select-all-orgaos"
            />
            <Label htmlFor="select-all-orgaos" className="text-sm font-medium cursor-pointer">
              Selecionar tudo
            </Label>
          </div>
          
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selecionado(s)
              </span>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setBatchDeleteDialogOpen(true)}
                className="gap-1"
              >
                <Trash className="h-4 w-4" />
                Excluir Selecionados
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

        {orgaos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum órgão cadastrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={selectedIds.size === orgaos.length && orgaos.length > 0} 
                    onCheckedChange={() => toggleSelectAll()}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-24 text-center">Status</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgaos.map((orgao) => (
                <TableRow key={orgao.id} className={selectedIds.has(orgao.id) ? 'bg-muted/50' : ''}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedIds.has(orgao.id)} 
                      onCheckedChange={() => toggleSelect(orgao.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{orgao.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={orgao.is_active ? 'default' : 'secondary'}>
                      {orgao.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Switch
                        checked={orgao.is_active}
                        onCheckedChange={() => handleToggleActive(orgao)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(orgao)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleDelete(orgao)}
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
              {editingOrgao ? 'Editar Órgão' : 'Novo Órgão'}
            </DialogTitle>
            <DialogDescription>
              {editingOrgao ? 'Atualize as informações do órgão' : 'Preencha as informações do novo órgão'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: IF-PE, TRF-5, etc."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingOrgao ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Delete Dialog */}
      <AlertDialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} órgãos?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selectedIds.size}</strong> órgãos selecionados? Esta ação não pode ser desfeita.
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
              Excluir {selectedIds.size} órgãos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}