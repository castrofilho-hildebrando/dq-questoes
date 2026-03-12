import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Plus, Trash2, FileText, Upload, ChevronDown, ChevronRight } from 'lucide-react';

interface Report {
  id: string;
  user_id: string;
  title: string;
  week_start: string;
  week_end: string;
  pdf_url: string;
  created_at: string;
}

interface StudentWithReports {
  user_id: string;
  email: string;
  full_name: string | null;
  reports: Report[];
}

export function AdminConselhoRelatorios() {
  const [students, setStudents] = useState<StudentWithReports[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadUserId, setUploadUserId] = useState('');
  const [uploadUserName, setUploadUserName] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadWeekStart, setUploadWeekStart] = useState('');
  const [uploadWeekEnd, setUploadWeekEnd] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAll = async () => {
    setLoading(true);

    const { data: accessData } = await supabase
      .from('gateway_card_user_access')
      .select('user_id')
      .eq('card_id', 'conselho-if')
      .eq('has_access', true);

    const userIds = (accessData || []).map(a => a.user_id);
    if (userIds.length === 0) { setStudents([]); setLoading(false); return; }

    const { data: profiles } = await (supabase.from('profiles') as any)
      .select('user_id, email, full_name')
      .in('user_id', userIds);

    const { data: reports } = await (supabase.from('conselho_weekly_reports') as any)
      .select('*')
      .in('user_id', userIds)
      .order('week_start', { ascending: false });

    const reportMap = new Map<string, Report[]>();
    (reports || []).forEach((r: Report) => {
      if (!reportMap.has(r.user_id)) reportMap.set(r.user_id, []);
      reportMap.get(r.user_id)!.push(r);
    });

    const merged: StudentWithReports[] = (profiles || []).map((p: any) => ({
      user_id: p.user_id,
      email: p.email,
      full_name: p.full_name,
      reports: reportMap.get(p.user_id) || [],
    }));

    merged.sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email));
    setStudents(merged);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openUpload = (userId: string, name: string) => {
    setUploadUserId(userId);
    setUploadUserName(name);
    setUploadTitle('');
    setUploadFile(null);

    // Default to current week (Sunday to Saturday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - dayOfWeek);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);

    setUploadWeekStart(sunday.toISOString().slice(0, 10));
    setUploadWeekEnd(saturday.toISOString().slice(0, 10));
    setUploadOpen(true);
  };

  const handleUpload = async () => {
    if (!uploadFile) { toast.error('Selecione um arquivo PDF'); return; }
    if (!uploadWeekStart || !uploadWeekEnd) { toast.error('Defina o período da semana'); return; }

    setUploading(true);

    // Sanitize filename
    const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${uploadUserId}/${uploadWeekStart}_${safeName}`;

    const { error: storageError } = await supabase.storage
      .from('conselho-reports')
      .upload(path, uploadFile, { upsert: true });

    if (storageError) {
      toast.error('Erro ao fazer upload do arquivo');
      console.error(storageError);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('conselho-reports')
      .getPublicUrl(path);

    const title = uploadTitle.trim() || `Relatório ${uploadWeekStart} a ${uploadWeekEnd}`;

    const { error: dbError } = await (supabase.from('conselho_weekly_reports') as any)
      .insert({
        user_id: uploadUserId,
        title,
        week_start: uploadWeekStart,
        week_end: uploadWeekEnd,
        pdf_url: urlData.publicUrl,
      });

    if (dbError) {
      toast.error('Erro ao salvar relatório');
      console.error(dbError);
    } else {
      toast.success('Relatório enviado com sucesso');
      setUploadOpen(false);
      fetchAll();
    }
    setUploading(false);
  };

  const handleDelete = async (report: Report) => {
    if (!confirm('Excluir este relatório?')) return;

    await (supabase.from('conselho_weekly_reports') as any)
      .delete()
      .eq('id', report.id);

    toast.success('Relatório excluído');
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Envie relatórios semanais em PDF para cada aluno ({students.length} alunos).
        </p>
        <div className="relative w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar aluno..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {students.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum aluno com acesso ao Conselho IF</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead className="w-32">Relatórios</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const isExpanded = expandedUser === s.user_id;
                return (
                  <>
                    <TableRow key={s.user_id} className="cursor-pointer" onClick={() => setExpandedUser(isExpanded ? null : s.user_id)}>
                      <TableCell>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{s.full_name || '—'}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{s.reports.length} relatório(s)</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); openUpload(s.user_id, s.full_name || s.email); }}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Novo
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && s.reports.length > 0 && s.reports.map(r => (
                      <TableRow key={r.id} className="bg-muted/30">
                        <TableCell></TableCell>
                        <TableCell colSpan={2}>
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{r.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(r.week_start).toLocaleDateString('pt-BR')} — {new Date(r.week_end).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <a href={r.pdf_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" title="Ver PDF">
                                <FileText className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(r)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {isExpanded && s.reports.length === 0 && (
                      <TableRow key={`${s.user_id}-empty`} className="bg-muted/30">
                        <TableCell></TableCell>
                        <TableCell colSpan={3}>
                          <p className="text-xs text-muted-foreground italic">Nenhum relatório enviado</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Relatório — {uploadUserName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título (opcional)</Label>
              <Input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Ex: Relatório Semana 12"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início da semana</Label>
                <Input type="date" value={uploadWeekStart} onChange={(e) => setUploadWeekStart(e.target.value)} />
              </div>
              <div>
                <Label>Fim da semana</Label>
                <Input type="date" value={uploadWeekEnd} onChange={(e) => setUploadWeekEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Arquivo PDF *</Label>
              <div
                onClick={() => fileRef.current?.click()}
                className="mt-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium">{uploadFile.name}</span>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar o PDF</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button>
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enviar Relatório
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
