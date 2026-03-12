import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, Search, Pencil, Save, Link2, ExternalLink } from 'lucide-react';

interface MentorSlot {
  id: string;
  user_id: string;
  slot_number: number;
  booking_link: string;
  status: 'disponivel' | 'agendado' | 'realizado';
  scheduled_at: string | null;
  notes: string | null;
}

interface StudentWithSlots {
  user_id: string;
  email: string;
  full_name: string | null;
  slots: MentorSlot[];
}

const statusLabels: Record<string, string> = {
  disponivel: 'Disponível',
  agendado: 'Agendado',
  realizado: 'Realizado',
};

const statusColors: Record<string, string> = {
  disponivel: 'bg-muted text-muted-foreground',
  agendado: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  realizado: 'bg-green-500/10 text-green-600 border-green-500/20',
};

export function AdminConselhoMentor() {
  const [students, setStudents] = useState<StudentWithSlots[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingStudent, setEditingStudent] = useState<StudentWithSlots | null>(null);
  const [editSlots, setEditSlots] = useState<{ slot_number: number; status: string; scheduled_at: string; notes: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Global Calendly link
  const [globalLink, setGlobalLink] = useState('');
  const [globalLinkDirty, setGlobalLinkDirty] = useState(false);
  const [savingLink, setSavingLink] = useState(false);




  const fetchGlobalLink = async () => {
    const { data } = await supabase
      .from('platform_config')
      .select('value')
      .eq('id', 'calendly_conselho_link')
      .single();
    setGlobalLink(data?.value || '');
  };

  const saveGlobalLink = async () => {
    setSavingLink(true);
    const { error } = await supabase
      .from('platform_config')
      .update({ value: globalLink.trim(), updated_at: new Date().toISOString() })
      .eq('id', 'calendly_conselho_link');
    if (error) {
      toast.error('Erro ao salvar link');
    } else {
      toast.success('Link do Calendly salvo');
      setGlobalLinkDirty(false);
    }
    setSavingLink(false);
  };

  const fetchAll = async () => {
    setLoading(true);

    const { data: accessData } = await supabase
      .from('gateway_card_user_access')
      .select('user_id')
      .eq('card_id', 'conselho-if')
      .eq('has_access', true);

    const userIds = (accessData || []).map(a => a.user_id);
    if (userIds.length === 0) {
      setStudents([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await (supabase.from('profiles') as any)
      .select('user_id, email, full_name')
      .in('user_id', userIds);

    const { data: allSlots } = await (supabase.from('conselho_mentor_slots') as any)
      .select('*')
      .in('user_id', userIds)
      .order('slot_number', { ascending: true });

    const slotMap = new Map<string, MentorSlot[]>();
    (allSlots || []).forEach((s: MentorSlot) => {
      if (!slotMap.has(s.user_id)) slotMap.set(s.user_id, []);
      slotMap.get(s.user_id)!.push(s);
    });

    const merged: StudentWithSlots[] = (profiles || []).map((p: any) => ({
      user_id: p.user_id,
      email: p.email,
      full_name: p.full_name,
      slots: slotMap.get(p.user_id) || [],
    }));

    merged.sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email));
    setStudents(merged);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    fetchGlobalLink();
  }, []);

  const openEdit = (student: StudentWithSlots) => {
    setEditingStudent(student);
    const slots = [];
    for (let i = 1; i <= 5; i++) {
      const existing = student.slots.find(s => s.slot_number === i);
      slots.push({
        slot_number: i,
        status: existing?.status || 'disponivel',
        scheduled_at: existing?.scheduled_at ? existing.scheduled_at.slice(0, 16) : '',
        notes: existing?.notes || '',
      });
    }
    setEditSlots(slots);
  };

  const updateSlotField = (idx: number, field: string, value: string) => {
    setEditSlots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleSave = async () => {
    if (!editingStudent) return;
    setSaving(true);

    for (const slot of editSlots) {
      const payload = {
        user_id: editingStudent.user_id,
        slot_number: slot.slot_number,
        booking_link: globalLink.trim(),
        status: slot.status,
        scheduled_at: slot.scheduled_at ? new Date(slot.scheduled_at).toISOString() : null,
        notes: slot.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const existing = editingStudent.slots.find(s => s.slot_number === slot.slot_number);
      if (existing) {
        await (supabase.from('conselho_mentor_slots') as any)
          .update(payload)
          .eq('id', existing.id);
      } else {
        await (supabase.from('conselho_mentor_slots') as any)
          .insert(payload);
      }
    }

    toast.success('Slots salvos com sucesso');
    setEditingStudent(null);
    setSaving(false);
    fetchAll();
  };

  const filtered = search
    ? students.filter(s =>
        (s.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase())
      )
    : students;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Calendly Link */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Link Global do Calendly</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Insira o link do Calendly uma única vez. Ele será usado automaticamente para todos os encontros de todos os alunos.
        </p>
        <div className="flex items-center gap-2">
          <Input
            value={globalLink}
            onChange={(e) => { setGlobalLink(e.target.value); setGlobalLinkDirty(true); }}
            placeholder="https://calendly.com/seu-link"
            className="flex-1"
          />
          <Button
            onClick={saveGlobalLink}
            disabled={!globalLinkDirty || savingLink}
            size="sm"
          >
            {savingLink && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            <Save className="w-4 h-4 mr-1" />
            Salvar
          </Button>
          {globalLink && (
            <Button variant="outline" size="sm" asChild>
              <a href={globalLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          )}
        </div>
        {!globalLink && (
          <p className="text-xs text-destructive">⚠ Nenhum link configurado. Os alunos não verão o botão de agendar.</p>
        )}
      </div>

      {/* Info about embed integration */}
      <div className="rounded-lg border border-dashed bg-muted/30 p-4 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">📅 Integração com Calendly</p>
        <p className="text-xs text-muted-foreground">
          O Calendly está incorporado diretamente na página do aluno. Quando o aluno agenda, o status do slot é atualizado automaticamente.
        </p>
      </div>

      {/* Students table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Gerencie o status dos encontros ({students.length} alunos).
          </p>
          <div className="relative w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar aluno..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {students.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum aluno com acesso ao Conselho IF</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Encontros</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const usados = s.slots.filter(sl => sl.status === 'realizado').length;
                const agendados = s.slots.filter(sl => sl.status === 'agendado').length;
                return (
                  <TableRow key={s.user_id}>
                    <TableCell>
                      <p className="font-medium text-sm">{s.full_name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map(n => {
                          const slot = s.slots.find(sl => sl.slot_number === n);
                          const st = slot?.status || 'disponivel';
                          return (
                            <div
                              key={n}
                              className={`w-7 h-7 rounded-md border text-[10px] font-bold flex items-center justify-center ${statusColors[st]}`}
                              title={`Encontro ${n}: ${statusLabels[st]}`}
                            >
                              {n}
                            </div>
                          );
                        })}
                        <span className="text-xs text-muted-foreground ml-2">
                          {usados}/5 realizados
                          {agendados > 0 && `, ${agendados} agendado(s)`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit Dialog — simplified: no booking_link per slot */}
      <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Encontros — {editingStudent?.full_name || editingStudent?.email}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editSlots.map((slot, idx) => (
              <div key={slot.slot_number} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Encontro {slot.slot_number}</h4>
                  <Select value={slot.status} onValueChange={(v) => updateSlotField(idx, 'status', v)}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disponivel">Disponível</SelectItem>
                      <SelectItem value="agendado">Agendado</SelectItem>
                      <SelectItem value="realizado">Realizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Data/Hora agendada</Label>
                    <Input
                      type="datetime-local"
                      value={slot.scheduled_at}
                      onChange={(e) => updateSlotField(idx, 'scheduled_at', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Observações</Label>
                    <Input
                      value={slot.notes}
                      onChange={(e) => updateSlotField(idx, 'notes', e.target.value)}
                      placeholder="Notas..."
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingStudent(null)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Save className="w-4 h-4 mr-2" />
                Salvar Todos
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
