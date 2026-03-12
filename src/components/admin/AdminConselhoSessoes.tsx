import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Loader2, PlayCircle, FileText, GripVertical } from 'lucide-react';

interface ConselhoSession {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  pdf_url: string | null;
  thumbnail_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

interface FormData {
  title: string;
  description: string;
  video_url: string;
  pdf_url: string;
  thumbnail_url: string;
  display_order: number;
  is_active: boolean;
}

const emptyForm: FormData = {
  title: '',
  description: '',
  video_url: '',
  pdf_url: '',
  thumbnail_url: '',
  display_order: 0,
  is_active: true,
};

export function AdminConselhoSessoes() {
  const [sessions, setSessions] = useState<ConselhoSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from('conselho_sessions') as any)
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar sessões');
      console.error(error);
    } else {
      setSessions(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, display_order: sessions.length });
    setDialogOpen(true);
  };

  const openEdit = (session: ConselhoSession) => {
    setEditingId(session.id);
    setForm({
      title: session.title,
      description: session.description || '',
      video_url: session.video_url || '',
      pdf_url: session.pdf_url || '',
      thumbnail_url: session.thumbnail_url || '',
      display_order: session.display_order,
      is_active: session.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Título é obrigatório');
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      video_url: form.video_url.trim() || null,
      pdf_url: form.pdf_url.trim() || null,
      thumbnail_url: form.thumbnail_url.trim() || null,
      display_order: form.display_order,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingId) {
      ({ error } = await (supabase
        .from('conselho_sessions') as any)
        .update(payload)
        .eq('id', editingId));
    } else {
      ({ error } = await (supabase
        .from('conselho_sessions') as any)
        .insert(payload));
    }

    if (error) {
      toast.error('Erro ao salvar sessão');
      console.error(error);
    } else {
      toast.success(editingId ? 'Sessão atualizada' : 'Sessão criada');
      setDialogOpen(false);
      fetchSessions();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta sessão?')) return;

    const { error } = await (supabase
      .from('conselho_sessions') as any)
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir');
      console.error(error);
    } else {
      toast.success('Sessão excluída');
      fetchSessions();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Vídeos e PDFs gerais disponíveis para todos os alunos do Conselho IF.
        </p>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Sessão
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <PlayCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nenhuma sessão cadastrada</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="w-20">Vídeo</TableHead>
              <TableHead className="w-20">PDF</TableHead>
              <TableHead className="w-20">Ativo</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="text-muted-foreground">{s.display_order}</TableCell>
                <TableCell className="font-medium">{s.title}</TableCell>
                <TableCell>
                  {s.video_url ? (
                    <PlayCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {s.pdf_url ? (
                    <FileText className="w-4 h-4 text-blue-500" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={`text-xs font-medium ${s.is_active ? 'text-green-500' : 'text-red-400'}`}>
                    {s.is_active ? 'Sim' : 'Não'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Sessão' : 'Nova Sessão'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Sessão de Mentoria #1"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição opcional"
                rows={2}
              />
            </div>
            <div>
              <Label>URL do Vídeo</Label>
              <Input
                value={form.video_url}
                onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>URL do PDF</Label>
              <Input
                value={form.pdf_url}
                onChange={(e) => setForm({ ...form, pdf_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>URL da Thumbnail</Label>
              <Input
                value={form.thumbnail_url}
                onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ordem de exibição</Label>
                <Input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
                <Label>Ativo</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingId ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
