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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  RefreshCw, 
  FileText,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Trash,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Prova {
  id: string;
  name: string;
  year: number | null;
  banca_id: string | null;
  orgao_id: string | null;
  is_active: boolean;
  created_at: string;
  bancas?: { name: string } | null;
  orgaos?: { name: string } | null;
}

interface Banca {
  id: string;
  name: string;
}

interface Orgao {
  id: string;
  name: string;
}

export function AdminProvas() {
  const [provas, setProvas] = useState<Prova[]>([]);
  const [bancas, setBancas] = useState<Banca[]>([]);
  const [orgaos, setOrgaos] = useState<Orgao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProva, setEditingProva] = useState<Prova | null>(null);
  const [name, setName] = useState('');
  const [year, setYear] = useState<string>('');
  const [bancaId, setBancaId] = useState<string>('');
  const [orgaoId, setOrgaoId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    
    const [provasRes, bancasRes, orgaosRes] = await Promise.all([
      supabase
        .from('provas')
        .select('*, bancas(name), orgaos(name)')
        .order('year', { ascending: false })
        .order('name'),
      supabase.from('bancas').select('id, name').eq('is_active', true).order('name'),
      supabase.from('orgaos').select('id, name').eq('is_active', true).order('name'),
    ]);

    if (provasRes.error) console.error('Error fetching provas:', provasRes.error);
    if (bancasRes.error) console.error('Error fetching bancas:', bancasRes.error);
    if (orgaosRes.error) console.error('Error fetching orgaos:', orgaosRes.error);

    setProvas(provasRes.data || []);
    setBancas(bancasRes.data || []);
    setOrgaos(orgaosRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreate = () => {
    setEditingProva(null);
    setName('');
    setYear('');
    setBancaId('');
    setOrgaoId('');
    setDialogOpen(true);
  };

  const handleOpenEdit = (prova: Prova) => {
    setEditingProva(prova);
    setName(prova.name);
    setYear(prova.year?.toString() || '');
    setBancaId(prova.banca_id || '');
    setOrgaoId(prova.orgao_id || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSaving(true);

    const provaData = {
      name: name.trim(),
      year: year ? parseInt(year) : null,
      banca_id: bancaId || null,
      orgao_id: orgaoId || null,
    };

    if (editingProva) {
      const { error } = await supabase
        .from('provas')
        .update(provaData)
        .eq('id', editingProva.id);

      if (error) {
        console.error('Error updating prova:', error);
        toast.error('Erro ao atualizar prova');
      } else {
        toast.success('Prova atualizada');
        setDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from('provas')
        .insert(provaData);

      if (error) {
        console.error('Error creating prova:', error);
        toast.error('Erro ao criar prova');
      } else {
        toast.success('Prova criada');
        setDialogOpen(false);
        fetchData();
      }
    }

    setSaving(false);
  };

  const handleToggleActive = async (prova: Prova) => {
    const { error } = await supabase
      .from('provas')
      .update({ is_active: !prova.is_active })
      .eq('id', prova.id);

    if (error) {
      console.error('Error toggling prova:', error);
      toast.error('Erro ao atualizar status');
    } else {
      fetchData();
    }
  };

  const handleDelete = async (prova: Prova) => {
    if (!confirm(`Deseja excluir a prova "${prova.name}"? As questões vinculadas terão a prova removida.`)) return;

    // First, unlink questions from this prova
    await supabase
      .from('questions')
      .update({ prova_id: null })
      .eq('prova_id', prova.id);

    const { error } = await supabase
      .from('provas')
      .delete()
      .eq('id', prova.id);

    if (error) {
      console.error('Error deleting prova:', error);
      toast.error('Erro ao excluir prova');
    } else {
      toast.success('Prova excluída');
      fetchData();
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const idsArray = Array.from(selectedIds);
      
      // First, unlink questions from these provas
      await supabase
        .from('questions')
        .update({ prova_id: null })
        .in('prova_id', idsArray);

      const { error } = await supabase
        .from('provas')
        .delete()
        .in('id', idsArray);

      if (error) throw error;

      toast.success(`${selectedIds.size} provas excluídas`);
      setBatchDeleteDialogOpen(false);
      setSelectedIds(new Set());
      fetchData();
    } catch (error) {
      console.error('Error batch deleting:', error);
      toast.error('Erro ao excluir provas');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === provas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(provas.map(p => p.id)));
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
              <FileText className="w-5 h-5" />
              Provas
            </CardTitle>
            <CardDescription>
              Gerencie as provas de concursos
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Prova
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Batch Actions */}
        <div className="flex items-center gap-4 py-2 px-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={selectedIds.size === provas.length && provas.length > 0} 
              onCheckedChange={() => toggleSelectAll()}
              id="select-all-provas"
            />
            <Label htmlFor="select-all-provas" className="text-sm font-medium cursor-pointer">
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

        {provas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma prova cadastrada</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={selectedIds.size === provas.length && provas.length > 0} 
                    onCheckedChange={() => toggleSelectAll()}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-20">Ano</TableHead>
                <TableHead>Banca</TableHead>
                <TableHead>Órgão</TableHead>
                <TableHead className="w-24 text-center">Status</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {provas.map((prova) => (
                <TableRow key={prova.id} className={selectedIds.has(prova.id) ? 'bg-muted/50' : ''}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedIds.has(prova.id)} 
                      onCheckedChange={() => toggleSelect(prova.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{prova.name}</TableCell>
                  <TableCell>{prova.year || '-'}</TableCell>
                  <TableCell>{prova.bancas?.name || '-'}</TableCell>
                  <TableCell>{prova.orgaos?.name || '-'}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={prova.is_active ? 'default' : 'secondary'}>
                      {prova.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Switch
                        checked={prova.is_active}
                        onCheckedChange={() => handleToggleActive(prova)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(prova)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleDelete(prova)}
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
              {editingProva ? 'Editar Prova' : 'Nova Prova'}
            </DialogTitle>
            <DialogDescription>
              {editingProva ? 'Atualize as informações da prova' : 'Preencha as informações da nova prova'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: IFPE 2024 - Técnico em Assuntos Educacionais"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Ano</Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="Ex: 2024"
                min="1990"
                max="2100"
              />
            </div>

            <div className="space-y-2">
              <Label>Banca</Label>
              <Select value={bancaId} onValueChange={setBancaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a banca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {bancas.map((banca) => (
                    <SelectItem key={banca.id} value={banca.id}>
                      {banca.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Órgão</Label>
              <Select value={orgaoId} onValueChange={setOrgaoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o órgão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {orgaos.map((orgao) => (
                    <SelectItem key={orgao.id} value={orgao.id}>
                      {orgao.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingProva ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Delete Dialog */}
      <AlertDialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} provas?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selectedIds.size}</strong> provas selecionadas? Esta ação não pode ser desfeita.
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
              Excluir {selectedIds.size} provas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}