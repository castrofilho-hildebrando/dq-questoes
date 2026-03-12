import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Clock, BookOpen, HelpCircle, RefreshCw, AlertTriangle, CheckCircle2, BarChart3, ChevronDown, ChevronRight, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { sanitizeNotebookIds } from '@/lib/sanitizeNotebookIds';

// ─── Types ──────────────────────────────────────────────────────────
interface Edital { id: string; name: string; }
interface School { id: string; name: string; edital_id: string | null; }
interface DisciplineInfo {
  id: string;
  name: string;
  questions_per_hour: number | null;
}

interface TopicWorkload {
  topicId: string;
  topicName: string;
  disciplineId: string;
  studyMinutes: number;       // from study/pdf/video goals
  questionsMinutes: number;   // calculated from question count + qph
  questionsMinutesStored: number; // stored in DB (for convergence check)
  revisionMinutes: number;    // revision cycles × 30min
  revisionCycles: number;
  questionCount: number;
  totalMinutes: number;
  convergenceOk: boolean;     // stored vs calculated match
}

interface DisciplineWorkload {
  discipline: DisciplineInfo;
  topics: TopicWorkload[];
  totalStudy: number;
  totalQuestions: number;
  totalRevisions: number;
  totalMinutes: number;
  convergenceIssues: number;
}

// ─── Helpers ────────────────────────────────────────────────────────
function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}min`;
}

// ─── Component ──────────────────────────────────────────────────────
export function AdminWorkloadDashboard() {
  const { toast } = useToast();
  const [editais, setEditais] = useState<Edital[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedEdital, setSelectedEdital] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [loading, setLoading] = useState(false);
  const [workloadData, setWorkloadData] = useState<DisciplineWorkload[]>([]);
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, label: '' });
  // Fetch editais on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('editals')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      setEditais(data || []);
    })();
  }, []);

  // Fetch schools when edital changes
  useEffect(() => {
    if (!selectedEdital) { setSchools([]); return; }
    (async () => {
      const { data } = await supabase
        .from('schools')
        .select('id, name, edital_id')
        .eq('edital_id', selectedEdital)
        .eq('is_active', true)
        .order('name');
      setSchools(data || []);
    })();
  }, [selectedEdital]);

  // Main data loader
  const loadWorkload = async () => {
    if (!selectedSchool && !selectedEdital) return;
    setLoading(true);

    try {
      // 1. Get disciplines
      let disciplines: DisciplineInfo[] = [];
      if (selectedSchool) {
        const { data } = await supabase
          .from('school_disciplines')
          .select('discipline:study_disciplines(id, name, questions_per_hour)')
          .eq('school_id', selectedSchool)
          .eq('is_active', true);
        disciplines = (data || []).map(d => d.discipline as unknown as DisciplineInfo).filter(Boolean);
      } else {
        // Fetch disciplines from ALL schools of this edital (includes cargo-specific ones)
        const schoolIds = schools.map(s => s.id);
        if (schoolIds.length > 0) {
          const { data } = await supabase
            .from('school_disciplines')
            .select('discipline:study_disciplines(id, name, questions_per_hour)')
            .in('school_id', schoolIds)
            .eq('is_active', true);
          const allDiscs = (data || []).map(d => d.discipline as unknown as DisciplineInfo).filter(Boolean);
          // Deduplicate by discipline id
          const seen = new Set<string>();
          for (const d of allDiscs) {
            if (!seen.has(d.id)) {
              seen.add(d.id);
              disciplines.push(d);
            }
          }
        }
        // Fallback: also include edital_disciplines in case some aren't in any school
        const { data: edData } = await supabase
          .from('edital_disciplines')
          .select('discipline:study_disciplines(id, name, questions_per_hour)')
          .eq('edital_id', selectedEdital)
          .eq('is_active', true);
        for (const d of (edData || []).map(d => d.discipline as unknown as DisciplineInfo).filter(Boolean)) {
          if (!disciplines.find(x => x.id === d.id)) {
            disciplines.push(d);
          }
        }
      }

      if (disciplines.length === 0) {
        setWorkloadData([]);
        setLoading(false);
        return;
      }

      const discIds = disciplines.map(d => d.id);

      // 2. Get all active topics for these disciplines
      const { data: allTopics } = await supabase
        .from('study_topics')
        .select('id, name, study_discipline_id')
        .in('study_discipline_id', discIds)
        .eq('is_active', true)
        .order('display_order');

      if (!allTopics || allTopics.length === 0) {
        setWorkloadData([]);
        setLoading(false);
        return;
      }

      const topicIds = allTopics.map(t => t.id);

      // 3. Get all active goals for these topics
      const { data: allGoals } = await supabase
        .from('topic_goals')
        .select('id, topic_id, goal_type, duration_minutes, is_active, name')
        .in('topic_id', topicIds)
        .eq('is_active', true);

      // 4. Get all active revisions for these topics
      const { data: allRevisions } = await supabase
        .from('topic_revisions')
        .select('id, topic_id, revision_1_days, revision_2_days, revision_3_days, revision_4_days, revision_5_days, revision_6_days, is_active')
        .in('topic_id', topicIds)
        .eq('is_active', true);

      // 5. Get question counts per topic via RPC
      const { data: questionCounts } = await supabase
        .rpc('get_topic_question_counts', { topic_ids: topicIds });

      const qCountMap = new Map<string, number>();
      for (const item of questionCounts || []) {
        qCountMap.set(item.topic_id, Number(item.question_count) || 0);
      }

      // 6. Build workload data
      const discMap = new Map<string, DisciplineInfo>();
      for (const d of disciplines) discMap.set(d.id, d);

      const goalsMap = new Map<string, typeof allGoals>();
      for (const g of allGoals || []) {
        const arr = goalsMap.get(g.topic_id) || [];
        arr.push(g);
        goalsMap.set(g.topic_id, arr);
      }

      const revisionsMap = new Map<string, typeof allRevisions>();
      for (const r of allRevisions || []) {
        const arr = revisionsMap.get(r.topic_id) || [];
        arr.push(r);
        revisionsMap.set(r.topic_id, arr);
      }

      // Group topics by discipline
      const topicsByDisc = new Map<string, typeof allTopics>();
      for (const t of allTopics) {
        const arr = topicsByDisc.get(t.study_discipline_id) || [];
        arr.push(t);
        topicsByDisc.set(t.study_discipline_id, arr);
      }

      const result: DisciplineWorkload[] = [];

      for (const disc of disciplines) {
        const discTopics = topicsByDisc.get(disc.id) || [];
        const qph = disc.questions_per_hour || 10;
        let totalStudy = 0, totalQuestions = 0, totalRevisions = 0, convergenceIssues = 0;

        const topicWorkloads: TopicWorkload[] = discTopics.map(topic => {
          const goals = goalsMap.get(topic.id) || [];
          const revisions = revisionsMap.get(topic.id) || [];
          const qCount = qCountMap.get(topic.id) || 0;

          // Study goals (non-questions)
          let studyMin = 0;
          let questionsMinStored = 0;
          for (const g of goals) {
            if (g.goal_type === 'questions') {
              questionsMinStored += g.duration_minutes || 0;
            } else {
              studyMin += g.duration_minutes || 0;
            }
          }

          // Dynamically calculated question duration (matching generator formula)
          let questionsMinCalc = 0;
          if (qCount > 0) {
            questionsMinCalc = Math.ceil((qCount / qph) * 60);
            questionsMinCalc = Math.max(30, Math.ceil(questionsMinCalc / 30) * 30);
          }

          // Revision cycles count
          let revCycles = 0;
          for (const r of revisions) {
            if (r.revision_1_days != null && r.revision_1_days > 0) revCycles++;
            if (r.revision_2_days != null && r.revision_2_days > 0) revCycles++;
            if (r.revision_3_days != null && r.revision_3_days > 0) revCycles++;
            if (r.revision_4_days != null && r.revision_4_days > 0) revCycles++;
            if (r.revision_5_days != null && r.revision_5_days > 0) revCycles++;
            if (r.revision_6_days != null && r.revision_6_days > 0) revCycles++;
          }
          const revMin = revCycles * 30;

          // Convergence: stored vs calculated for question goals
          const convergenceOk = questionsMinStored === questionsMinCalc || qCount === 0;
          if (!convergenceOk) convergenceIssues++;

          const total = studyMin + questionsMinCalc + revMin;
          totalStudy += studyMin;
          totalQuestions += questionsMinCalc;
          totalRevisions += revMin;

          return {
            topicId: topic.id,
            topicName: topic.name,
            disciplineId: disc.id,
            studyMinutes: studyMin,
            questionsMinutes: questionsMinCalc,
            questionsMinutesStored: questionsMinStored,
            revisionMinutes: revMin,
            revisionCycles: revCycles,
            questionCount: qCount,
            totalMinutes: total,
            convergenceOk,
          };
        });

        result.push({
          discipline: disc,
          topics: topicWorkloads,
          totalStudy,
          totalQuestions,
          totalRevisions,
          totalMinutes: totalStudy + totalQuestions + totalRevisions,
          convergenceIssues,
        });
      }

      // Sort by total minutes descending
      result.sort((a, b) => b.totalMinutes - a.totalMinutes);
      setWorkloadData(result);
    } catch (err) {
      console.error('Error loading workload:', err);
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Auto-load when school or edital changes
  useEffect(() => {
    if (selectedSchool || selectedEdital) {
      loadWorkload();
    }
  }, [selectedSchool, selectedEdital]);

  // Summary stats
  const summary = useMemo(() => {
    const totalStudy = workloadData.reduce((s, d) => s + d.totalStudy, 0);
    const totalQuestions = workloadData.reduce((s, d) => s + d.totalQuestions, 0);
    const totalRevisions = workloadData.reduce((s, d) => s + d.totalRevisions, 0);
    const totalMinutes = totalStudy + totalQuestions + totalRevisions;
    const convergenceIssues = workloadData.reduce((s, d) => s + d.convergenceIssues, 0);
    return { totalStudy, totalQuestions, totalRevisions, totalMinutes, convergenceIssues };
  }, [workloadData]);

  const toggleDiscipline = (id: string) => {
    setExpandedDisciplines(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─── Sync divergent goals via backend ───────────────────────────────
  const syncDivergentGoals = async () => {
    if (summary.convergenceIssues === 0) {
      toast({ title: 'Nenhuma divergência encontrada' });
      return;
    }

    if (!confirm(`Isso atualizará ${summary.convergenceIssues} meta(s) de questões via backend. Continuar?`)) return;

    setSyncing(true);
    setSyncProgress({ current: 0, total: summary.convergenceIssues, label: 'Processando no backend...' });

    try {
      const { data, error } = await supabase.functions.invoke('sync-workload-goals', {
        body: {
          editalId: selectedEdital || undefined,
          schoolId: selectedSchool || undefined,
        },
      });

      if (error) throw error;

      const result = data as { updated: number; created: number; errors: number; total: number };

      toast({
        title: 'Sincronização concluída!',
        description: `${result.updated} atualizada(s), ${result.created} criada(s)${result.errors > 0 ? `, ${result.errors} erro(s)` : ''}`,
      });
    } catch (err: any) {
      console.error('Sync error:', err);
      toast({
        title: 'Erro na sincronização',
        description: err.message || 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
      setSyncProgress({ current: 0, total: 0, label: '' });
      loadWorkload();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Dashboard de Carga Horária
          </CardTitle>
          <CardDescription>
            Visão centralizada: Estudo + Questões + Revisões por disciplina/tópico com validação de convergência
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-64">
              <Select value={selectedEdital} onValueChange={v => { setSelectedEdital(v); setSelectedSchool(''); setWorkloadData([]); }}>
                <SelectTrigger><SelectValue placeholder="Selecione um edital" /></SelectTrigger>
                <SelectContent>
                  {editais.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {schools.length > 0 && (
              <div className="w-64">
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma escola" /></SelectTrigger>
                  <SelectContent>
                    {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={loadWorkload} disabled={loading || syncing}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            {summary.convergenceIssues > 0 && (
              <Button size="sm" onClick={syncDivergentGoals} disabled={loading || syncing}>
                <Wand2 className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                Sincronizar {summary.convergenceIssues} divergência(s)
              </Button>
            )}
          </div>

          {/* Sync progress bar */}
          {syncing && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sincronizando: {syncProgress.label} ({syncProgress.current}/{syncProgress.total})</span>
              </div>
              <Progress value={syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0} />
            </div>
          )}
        </CardContent>
      </Card>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && workloadData.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <SummaryCard icon={<BookOpen className="w-4 h-4" />} label="Estudo" value={formatDuration(summary.totalStudy)} />
            <SummaryCard icon={<HelpCircle className="w-4 h-4" />} label="Questões" value={formatDuration(summary.totalQuestions)} />
            <SummaryCard icon={<RefreshCw className="w-4 h-4" />} label="Revisões" value={formatDuration(summary.totalRevisions)} />
            <SummaryCard icon={<Clock className="w-4 h-4" />} label="Total Geral" value={formatDuration(summary.totalMinutes)} highlight />
            <SummaryCard
              icon={summary.convergenceIssues > 0
                ? <AlertTriangle className="w-4 h-4 text-destructive" />
                : <CheckCircle2 className="w-4 h-4 text-green-600" />}
              label="Convergência"
              value={summary.convergenceIssues > 0 ? `${summary.convergenceIssues} divergência(s)` : 'OK'}
              variant={summary.convergenceIssues > 0 ? 'destructive' : 'success'}
            />
          </div>

          {/* Discipline breakdown */}
          <div className="space-y-3">
            {workloadData.map(dw => {
              const isExpanded = expandedDisciplines.has(dw.discipline.id);
              return (
                <Card key={dw.discipline.id}>
                  <Collapsible open={isExpanded} onOpenChange={() => toggleDiscipline(dw.discipline.id)}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <span className="font-medium">{dw.discipline.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {dw.topics.length} tópico{dw.topics.length !== 1 ? 's' : ''}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            ({dw.discipline.questions_per_hour || 10} q/h)
                          </span>
                          {dw.convergenceIssues > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {dw.convergenceIssues} divergência(s)
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            <BookOpen className="w-3 h-3 inline mr-1" />{formatDuration(dw.totalStudy)}
                          </span>
                          <span className="text-muted-foreground">
                            <HelpCircle className="w-3 h-3 inline mr-1" />{formatDuration(dw.totalQuestions)}
                          </span>
                          <span className="text-muted-foreground">
                            <RefreshCw className="w-3 h-3 inline mr-1" />{formatDuration(dw.totalRevisions)}
                          </span>
                          <span className="font-semibold text-primary">{formatDuration(dw.totalMinutes)}</span>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tópico</TableHead>
                              <TableHead className="text-center w-20">Questões</TableHead>
                              <TableHead className="text-center w-28">Estudo</TableHead>
                              <TableHead className="text-center w-28">Questões (calc)</TableHead>
                              <TableHead className="text-center w-28">Revisões</TableHead>
                              <TableHead className="text-center w-24">Total</TableHead>
                              <TableHead className="text-center w-20">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dw.topics.map(tw => (
                              <TableRow key={tw.topicId}>
                                <TableCell className="font-medium text-sm">{tw.topicName}</TableCell>
                                <TableCell className="text-center text-sm">{tw.questionCount}</TableCell>
                                <TableCell className="text-center text-sm">{formatDuration(tw.studyMinutes)}</TableCell>
                                <TableCell className="text-center text-sm">
                                  {formatDuration(tw.questionsMinutes)}
                                  {!tw.convergenceOk && (
                                    <span className="block text-xs text-destructive">
                                      DB: {formatDuration(tw.questionsMinutesStored)}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center text-sm">
                                  {tw.revisionCycles > 0 ? `${tw.revisionCycles}× = ${formatDuration(tw.revisionMinutes)}` : '—'}
                                </TableCell>
                                <TableCell className="text-center text-sm font-semibold">{formatDuration(tw.totalMinutes)}</TableCell>
                                <TableCell className="text-center">
                                  {tw.convergenceOk ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
                                  ) : (
                                    <span title="Divergência entre valor salvo e calculado"><AlertTriangle className="w-4 h-4 text-destructive mx-auto" /></span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {!loading && workloadData.length === 0 && (selectedSchool || selectedEdital) && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma disciplina encontrada para a seleção atual.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Summary Card ───────────────────────────────────────────────────
function SummaryCard({ icon, label, value, highlight, variant }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  variant?: 'destructive' | 'success';
}) {
  return (
    <Card className={highlight ? 'border-primary/50 bg-primary/5' : ''}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          {icon}
          <span>{label}</span>
        </div>
        <p className={`text-lg font-bold ${
          variant === 'destructive' ? 'text-destructive' :
          variant === 'success' ? 'text-green-600' :
          highlight ? 'text-primary' : ''
        }`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
