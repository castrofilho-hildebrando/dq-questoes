import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Save, Users, ExternalLink, Search } from 'lucide-react';

interface ConselhoStudent {
  user_id: string;
  email: string;
  full_name: string | null;
  group_name: string;
  group_link: string;
  group_id: string | null; // null if no record yet
}

export function AdminConselhoGrupos() {
  const [students, setStudents] = useState<ConselhoStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  const fetchStudents = async () => {
    setLoading(true);

    // 1. Get all users with access to conselho-if card
    const { data: accessData, error: accessError } = await supabase
      .from('gateway_card_user_access')
      .select('user_id')
      .eq('card_id', 'conselho-if')
      .eq('has_access', true);

    if (accessError) {
      toast.error('Erro ao carregar alunos do Conselho');
      setLoading(false);
      return;
    }

    const userIds = (accessData || []).map(a => a.user_id);
    if (userIds.length === 0) {
      setStudents([]);
      setLoading(false);
      return;
    }

    // 2. Get profiles for these users
    const { data: profiles, error: profilesError } = await (supabase
      .from('profiles') as any)
      .select('user_id, email, full_name')
      .in('user_id', userIds);

    if (profilesError) {
      toast.error('Erro ao carregar perfis');
      setLoading(false);
      return;
    }

    // 3. Get existing group records
    const { data: groups, error: groupsError } = await (supabase
      .from('conselho_student_groups') as any)
      .select('*')
      .in('user_id', userIds);

    if (groupsError) {
      toast.error('Erro ao carregar grupos');
      setLoading(false);
      return;
    }

    const groupMap = new Map<string, any>();
    (groups || []).forEach((g: any) => groupMap.set(g.user_id, g));

    const merged: ConselhoStudent[] = (profiles || []).map((p: any) => {
      const group = groupMap.get(p.user_id);
      return {
        user_id: p.user_id,
        email: p.email,
        full_name: p.full_name,
        group_name: group?.group_name || '',
        group_link: group?.group_link || '',
        group_id: group?.id || null,
      };
    });

    // Sort by name
    merged.sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email));
    setStudents(merged);
    setLoading(false);
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const updateField = (userId: string, field: 'group_name' | 'group_link', value: string) => {
    setStudents(prev =>
      prev.map(s => s.user_id === userId ? { ...s, [field]: value } : s)
    );
  };

  const handleSave = async (student: ConselhoStudent) => {
    setSaving(prev => ({ ...prev, [student.user_id]: true }));

    const payload = {
      user_id: student.user_id,
      group_name: student.group_name.trim(),
      group_link: student.group_link.trim(),
      updated_at: new Date().toISOString(),
    };

    let error;
    if (student.group_id) {
      ({ error } = await (supabase
        .from('conselho_student_groups') as any)
        .update(payload)
        .eq('id', student.group_id));
    } else {
      ({ error } = await (supabase
        .from('conselho_student_groups') as any)
        .insert(payload));
    }

    if (error) {
      toast.error(`Erro ao salvar grupo de ${student.full_name || student.email}`);
      console.error(error);
    } else {
      toast.success('Grupo salvo');
      // Refresh to get the new id if it was an insert
      fetchStudents();
    }

    setSaving(prev => ({ ...prev, [student.user_id]: false }));
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Configure o link do grupo individual para cada aluno do Conselho IF ({students.length} alunos).
        </p>
        <div className="relative w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar aluno..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {students.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum aluno com acesso ao Conselho IF</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Nome do Grupo</TableHead>
              <TableHead>Link do Grupo</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.user_id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{s.full_name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    value={s.group_name}
                    onChange={(e) => updateField(s.user_id, 'group_name', e.target.value)}
                    placeholder="Ex: Grupo João Silva"
                    className="h-8 text-sm"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Input
                      value={s.group_link}
                      onChange={(e) => updateField(s.user_id, 'group_link', e.target.value)}
                      placeholder="https://..."
                      className="h-8 text-sm"
                    />
                    {s.group_link && (
                      <a href={s.group_link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSave(s)}
                    disabled={saving[s.user_id]}
                  >
                    {saving[s.user_id] ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
