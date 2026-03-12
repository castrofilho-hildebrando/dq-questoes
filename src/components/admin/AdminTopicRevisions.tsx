import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Save, ChevronRight, Check, X } from 'lucide-react';

interface Edital {
  id: string;
  name: string;
  is_default: boolean | null;
}

interface School {
  id: string;
  name: string;
  edital_id: string | null;
}

interface Discipline {
  id: string;
  name: string;
}

interface Topic {
  id: string;
  name: string;
  study_discipline_id: string;
}

interface TopicRevision {
  id: string;
  topic_id: string;
  revision_1_days: number | null;
  revision_2_days: number | null;
  revision_3_days: number | null;
  revision_4_days: number | null;
  revision_5_days: number | null;
  revision_6_days: number | null;
  is_active: boolean;
}

export function AdminTopicRevisions() {
  const { toast } = useToast();
  const [editais, setEditais] = useState<Edital[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [revisions, setRevisions] = useState<Map<string, TopicRevision>>(new Map());
  const [topicsWithoutRevisions, setTopicsWithoutRevisions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [propagating, setPropagating] = useState(false);
  
  const [selectedEdital, setSelectedEdital] = useState<string>('');
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('');
  
  // Determine if the selected edital is pré-edital (is_default)
  const selectedEditalObj = editais.find(e => e.id === selectedEdital);
  const isPreEdital = selectedEditalObj?.is_default === true;
  
  // "fonte" mode: only for pré-edital when selectedSchool === '__fonte__'
  const isSourceMode = isPreEdital && selectedSchool === '__fonte__';
  // "todas as escolas" mode: for pós-editais when selectedSchool === '__todas__'
  const isAllSchoolsMode = !isPreEdital && selectedSchool === '__todas__';
  
  // Global revision config
  const [globalConfig, setGlobalConfig] = useState({
    revision_1_days: '1',
    revision_2_days: '7',
    revision_3_days: '21',
    revision_4_days: '30',
    revision_5_days: '60',
    revision_6_days: '90',
  });
  
  // Form state for each topic
  const [formState, setFormState] = useState<Map<string, {
    revision_1_days: string;
    revision_2_days: string;
    revision_3_days: string;
    revision_4_days: string;
    revision_5_days: string;
    revision_6_days: string;
  }>>(new Map());

  const fetchEditais = async () => {
    try {
      const { data, error } = await supabase
        .from('editals')
        .select('id, name, is_default')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setEditais(data || []);
    } catch (error) {
      console.error('Error fetching editais:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchools = async (editalId: string) => {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, edital_id')
        .eq('edital_id', editalId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSchools(data || []);
    } catch (error) {
      console.error('Error fetching schools:', error);
    }
  };

  const fetchDisciplines = async (schoolId: string) => {
    try {
      const { data, error } = await supabase
        .from('school_disciplines')
        .select(`
          discipline_id,
          discipline:study_disciplines(id, name)
        `)
        .eq('school_id', schoolId)
        .eq('is_active', true);

      if (error) throw error;
      
      const formattedDisciplines = (data || [])
        .map(item => item.discipline as unknown as Discipline)
        .filter(Boolean);
      
      setDisciplines(formattedDisciplines);
    } catch (error) {
      console.error('Error fetching disciplines:', error);
    }
  };

  const fetchSourceDisciplines = async (editalId: string) => {
    try {
      const { data, error } = await supabase
        .from('edital_disciplines')
        .select(`
          discipline_id,
          discipline:study_disciplines!inner(id, name, is_source)
        `)
        .eq('edital_id', editalId)
        .eq('is_active', true);

      if (error) throw error;
      
      const sourceDisciplines = (data || [])
        .map(item => item.discipline as unknown as (Discipline & { is_source: boolean }))
        .filter(d => d && d.is_source);
      
      setDisciplines(sourceDisciplines);
    } catch (error) {
      console.error('Error fetching source disciplines:', error);
    }
  };

  // Fetch ALL disciplines from the edital (not just source) - for pós-editais
  const fetchEditalDisciplines = async (editalId: string) => {
    try {
      const { data, error } = await supabase
        .from('edital_disciplines')
        .select(`
          discipline_id,
          discipline:study_disciplines!inner(id, name)
        `)
        .eq('edital_id', editalId)
        .eq('is_active', true);

      if (error) throw error;
      
      const allDisciplines = (data || [])
        .map(item => item.discipline as unknown as Discipline)
        .filter(Boolean);
      
      setDisciplines(allDisciplines);
    } catch (error) {
      console.error('Error fetching edital disciplines:', error);
    }
  };

  const fetchTopics = async (disciplineId: string) => {
    try {
      const { data, error } = await supabase
        .from('study_topics')
        .select('id, name, study_discipline_id')
        .eq('study_discipline_id', disciplineId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setTopics(data || []);
      
      if (data && data.length > 0) {
        const topicIds = data.map(t => t.id);
        await fetchRevisions(topicIds);
      }
    } catch (error) {
      console.error('Error fetching topics:', error);
    }
  };

  const fetchRevisions = async (topicIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('topic_revisions' as any)
        .select('*')
        .in('topic_id', topicIds);

      if (error) throw error;
      
      const revisionsMap = new Map<string, TopicRevision>();
      const formMap = new Map<string, {
        revision_1_days: string;
        revision_2_days: string;
        revision_3_days: string;
        revision_4_days: string;
        revision_5_days: string;
        revision_6_days: string;
      }>();

      ((data || []) as unknown as TopicRevision[]).forEach(rev => {
        revisionsMap.set(rev.topic_id, rev);
        formMap.set(rev.topic_id, {
          revision_1_days: rev.revision_1_days?.toString() || '',
          revision_2_days: rev.revision_2_days?.toString() || '',
          revision_3_days: rev.revision_3_days?.toString() || '',
          revision_4_days: rev.revision_4_days?.toString() || '',
          revision_5_days: rev.revision_5_days?.toString() || '',
          revision_6_days: rev.revision_6_days?.toString() || '',
        });
      });

      topicIds.forEach(id => {
        if (!formMap.has(id)) {
          formMap.set(id, {
            revision_1_days: '',
            revision_2_days: '',
            revision_3_days: '',
            revision_4_days: '',
            revision_5_days: '',
            revision_6_days: '',
          });
        }
      });

      setRevisions(revisionsMap);
      setFormState(formMap);
      
      const pending = topicIds.filter(id => !revisionsMap.has(id));
      setTopicsWithoutRevisions(pending);
    } catch (error) {
      console.error('Error fetching revisions:', error);
    }
  };

  useEffect(() => {
    fetchEditais();
  }, []);

  useEffect(() => {
    if (selectedEdital) {
      fetchSchools(selectedEdital);
      setSelectedSchool('');
      setSelectedDiscipline('');
      setSchools([]);
      setDisciplines([]);
      setTopics([]);
      setRevisions(new Map());
      setFormState(new Map());
    }
  }, [selectedEdital]);

  useEffect(() => {
    if (selectedSchool === '__fonte__' && selectedEdital && isPreEdital) {
      fetchSourceDisciplines(selectedEdital);
      setSelectedDiscipline('');
      setTopics([]);
      setRevisions(new Map());
      setFormState(new Map());
    } else if (selectedSchool === '__todas__' && selectedEdital && !isPreEdital) {
      fetchEditalDisciplines(selectedEdital);
      setSelectedDiscipline('');
      setTopics([]);
      setRevisions(new Map());
      setFormState(new Map());
    } else if (selectedSchool && selectedSchool !== '__fonte__' && selectedSchool !== '__todas__') {
      fetchDisciplines(selectedSchool);
      setSelectedDiscipline('');
      setTopics([]);
      setRevisions(new Map());
      setFormState(new Map());
    }
  }, [selectedSchool]);

  useEffect(() => {
    if (selectedDiscipline) {
      fetchTopics(selectedDiscipline);
    }
  }, [selectedDiscipline]);

  const updateFormValue = (topicId: string, field: string, value: string) => {
    setFormState(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(topicId) || {
        revision_1_days: '',
        revision_2_days: '',
        revision_3_days: '',
        revision_4_days: '',
        revision_5_days: '',
        revision_6_days: '',
      };
      newMap.set(topicId, { ...current, [field]: value });
      return newMap;
    });
  };

  const handleSave = async (topicId: string) => {
    setSaving(topicId);
    try {
      const form = formState.get(topicId);
      if (!form) return;

      const payload = {
        topic_id: topicId,
        revision_1_days: form.revision_1_days ? parseInt(form.revision_1_days) : null,
        revision_2_days: form.revision_2_days ? parseInt(form.revision_2_days) : null,
        revision_3_days: form.revision_3_days ? parseInt(form.revision_3_days) : null,
        revision_4_days: form.revision_4_days ? parseInt(form.revision_4_days) : null,
        revision_5_days: form.revision_5_days ? parseInt(form.revision_5_days) : null,
        revision_6_days: form.revision_6_days ? parseInt(form.revision_6_days) : null,
        is_active: true
      };

      const existing = revisions.get(topicId);
      
      if (existing) {
        const { error } = await supabase
          .from('topic_revisions')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('topic_revisions')
          .insert(payload);
        if (error) throw error;
      }

      toast({ title: 'Configuração salva com sucesso!' });
      
      const topicIds = topics.map(t => t.id);
      await fetchRevisions(topicIds);
    } catch (error) {
      console.error('Error saving revision:', error);
      toast({ title: 'Erro ao salvar configuração', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const applyGlobalToAll = async (onlyMissing: boolean = false) => {
    if (!selectedDiscipline || topics.length === 0) {
      toast({ title: 'Selecione uma disciplina primeiro', variant: 'destructive' });
      return;
    }

    const targetTopics = onlyMissing 
      ? topics.filter(t => !revisions.has(t.id))
      : topics;

    if (targetTopics.length === 0) {
      toast({ title: 'Não há tópicos para aplicar', variant: 'destructive' });
      return;
    }

    const action = onlyMissing ? 'sem configuração' : 'da disciplina';
    if (!confirm(`Aplicar configuração a ${targetTopics.length} tópicos ${action}?`)) return;

    setApplyingAll(true);
    try {
      for (const topic of targetTopics) {
        setFormState(prev => {
          const newMap = new Map(prev);
          newMap.set(topic.id, { ...globalConfig });
          return newMap;
        });

        const payload = {
          topic_id: topic.id,
          revision_1_days: globalConfig.revision_1_days ? parseInt(globalConfig.revision_1_days) : null,
          revision_2_days: globalConfig.revision_2_days ? parseInt(globalConfig.revision_2_days) : null,
          revision_3_days: globalConfig.revision_3_days ? parseInt(globalConfig.revision_3_days) : null,
          revision_4_days: globalConfig.revision_4_days ? parseInt(globalConfig.revision_4_days) : null,
          revision_5_days: globalConfig.revision_5_days ? parseInt(globalConfig.revision_5_days) : null,
          revision_6_days: globalConfig.revision_6_days ? parseInt(globalConfig.revision_6_days) : null,
          is_active: true
        };

        const existing = revisions.get(topic.id);
        
        if (existing) {
          await supabase
            .from('topic_revisions')
            .update(payload)
            .eq('id', existing.id);
        } else {
          await supabase
            .from('topic_revisions')
            .insert(payload);
        }
      }

      toast({ title: `Configuração aplicada a ${targetTopics.length} tópicos!` });
      
      const topicIds = topics.map(t => t.id);
      await fetchRevisions(topicIds);
    } catch (error) {
      console.error('Error applying config:', error);
      toast({ title: 'Erro ao aplicar configuração', variant: 'destructive' });
    } finally {
      setApplyingAll(false);
    }
  };

  const applyGlobalToAllDisciplines = async () => {
    if (!selectedSchool || disciplines.length === 0) {
      toast({ title: 'Selecione uma escola primeiro', variant: 'destructive' });
      return;
    }

    if (!confirm(`Aplicar configuração a TODOS os tópicos de TODAS as ${disciplines.length} disciplinas desta escola?`)) return;

    setApplyingAll(true);
    let totalApplied = 0;

    try {
      for (const discipline of disciplines) {
        const { data: discTopics, error } = await supabase
          .from('study_topics')
          .select('id')
          .eq('study_discipline_id', discipline.id)
          .eq('is_active', true);

        if (error) throw error;

        for (const topic of discTopics || []) {
          const payload = {
            topic_id: topic.id,
            revision_1_days: globalConfig.revision_1_days ? parseInt(globalConfig.revision_1_days) : null,
            revision_2_days: globalConfig.revision_2_days ? parseInt(globalConfig.revision_2_days) : null,
            revision_3_days: globalConfig.revision_3_days ? parseInt(globalConfig.revision_3_days) : null,
            revision_4_days: globalConfig.revision_4_days ? parseInt(globalConfig.revision_4_days) : null,
            revision_5_days: globalConfig.revision_5_days ? parseInt(globalConfig.revision_5_days) : null,
            revision_6_days: globalConfig.revision_6_days ? parseInt(globalConfig.revision_6_days) : null,
            is_active: true
          };

          const { data: existing } = await supabase
            .from('topic_revisions')
            .select('id')
            .eq('topic_id', topic.id)
            .single();

          if (existing) {
            await supabase
              .from('topic_revisions')
              .update(payload)
              .eq('id', existing.id);
          } else {
            await supabase
              .from('topic_revisions')
              .insert(payload);
          }
          totalApplied++;
        }
      }

      toast({ title: `Configuração aplicada a ${totalApplied} tópicos de ${disciplines.length} disciplinas!` });
      
      if (selectedDiscipline && topics.length > 0) {
        const topicIds = topics.map(t => t.id);
        await fetchRevisions(topicIds);
      }
    } catch (error) {
      console.error('Error applying config:', error);
      toast({ title: 'Erro ao aplicar configuração', variant: 'destructive' });
    } finally {
      setApplyingAll(false);
    }
  };

  const applyGlobalToAllSchools = async () => {
    if (!selectedEdital || schools.length === 0) {
      toast({ title: 'Selecione um edital primeiro', variant: 'destructive' });
      return;
    }

    if (!confirm(`Aplicar configuração a TODOS os tópicos de TODAS as ${schools.length} escolas do edital selecionado? Esta ação pode demorar alguns minutos.`)) return;

    setApplyingAll(true);
    let totalApplied = 0;
    let totalSchools = 0;

    try {
      for (const school of schools) {
        const { data: schoolDisciplinesData, error: discError } = await supabase
          .from('school_disciplines')
          .select(`
            discipline_id,
            discipline:study_disciplines(id, name)
          `)
          .eq('school_id', school.id)
          .eq('is_active', true);

        if (discError) throw discError;

        const schoolDisciplines = (schoolDisciplinesData || [])
          .map(item => item.discipline as unknown as Discipline)
          .filter(Boolean);

        for (const discipline of schoolDisciplines) {
          const { data: discTopics, error: topicError } = await supabase
            .from('study_topics')
            .select('id')
            .eq('study_discipline_id', discipline.id)
            .eq('is_active', true);

          if (topicError) throw topicError;

          for (const topic of discTopics || []) {
            const payload = {
              topic_id: topic.id,
              revision_1_days: globalConfig.revision_1_days ? parseInt(globalConfig.revision_1_days) : null,
              revision_2_days: globalConfig.revision_2_days ? parseInt(globalConfig.revision_2_days) : null,
              revision_3_days: globalConfig.revision_3_days ? parseInt(globalConfig.revision_3_days) : null,
              revision_4_days: globalConfig.revision_4_days ? parseInt(globalConfig.revision_4_days) : null,
              revision_5_days: globalConfig.revision_5_days ? parseInt(globalConfig.revision_5_days) : null,
              revision_6_days: globalConfig.revision_6_days ? parseInt(globalConfig.revision_6_days) : null,
              is_active: true
            };

            const { data: existing } = await supabase
              .from('topic_revisions')
              .select('id')
              .eq('topic_id', topic.id)
              .single();

            if (existing) {
              await supabase
                .from('topic_revisions')
                .update(payload)
                .eq('id', existing.id);
            } else {
              await supabase
                .from('topic_revisions')
                .insert(payload);
            }
            totalApplied++;
          }
        }
        totalSchools++;
      }

      toast({ title: `Configuração aplicada a ${totalApplied} tópicos de ${totalSchools} escolas!` });
      
      if (selectedDiscipline && topics.length > 0) {
        const topicIds = topics.map(t => t.id);
        await fetchRevisions(topicIds);
      }
    } catch (error) {
      console.error('Error applying config to all schools:', error);
      toast({ title: 'Erro ao aplicar configuração', variant: 'destructive' });
    } finally {
      setApplyingAll(false);
    }
  };

  // Propagate source discipline revisions to all derived topics (pré-edital only)
  const propagateToAllSchools = async () => {
    if (!isSourceMode || !selectedDiscipline || topics.length === 0 || !selectedEdital) {
      toast({ title: 'Selecione uma disciplina fonte com tópicos', variant: 'destructive' });
      return;
    }

    const configuredTopics = topics.filter(t => revisions.has(t.id));
    if (configuredTopics.length === 0) {
      toast({ title: 'Configure as revisões da disciplina fonte primeiro', variant: 'destructive' });
      return;
    }

    if (!confirm(`Propagar revisões de ${configuredTopics.length} tópico(s) fonte para TODAS as escolas do edital? Isso sobrescreverá revisões existentes nos tópicos derivados.`)) return;

    setPropagating(true);
    let totalApplied = 0;

    try {
      for (const sourceTopic of configuredTopics) {
        const rev = revisions.get(sourceTopic.id);
        if (!rev) continue;

        const { data: derivedTopics, error } = await supabase
          .from('study_topics')
          .select('id')
          .eq('source_topic_id', sourceTopic.id)
          .eq('is_active', true);

        if (error) throw error;

        for (const derived of derivedTopics || []) {
          const payload = {
            topic_id: derived.id,
            revision_1_days: rev.revision_1_days,
            revision_2_days: rev.revision_2_days,
            revision_3_days: rev.revision_3_days,
            revision_4_days: rev.revision_4_days,
            revision_5_days: rev.revision_5_days,
            revision_6_days: rev.revision_6_days,
            is_active: true
          };

          const { data: existing } = await supabase
            .from('topic_revisions')
            .select('id')
            .eq('topic_id', derived.id)
            .single();

          if (existing) {
            await supabase.from('topic_revisions').update(payload).eq('id', existing.id);
          } else {
            await supabase.from('topic_revisions').insert(payload);
          }
          totalApplied++;
        }
      }

      toast({ title: `Revisões propagadas para ${totalApplied} tópicos derivados em todas as escolas!` });
    } catch (error) {
      console.error('Error propagating revisions:', error);
      toast({ title: 'Erro ao propagar revisões', variant: 'destructive' });
    } finally {
      setPropagating(false);
    }
  };

  // Apply revisions to the same discipline across ALL schools of the edital (pós-edital)
  const applyToAllSchoolsDiscipline = async () => {
    if (!isAllSchoolsMode || !selectedDiscipline || topics.length === 0 || !selectedEdital) {
      toast({ title: 'Selecione uma disciplina primeiro', variant: 'destructive' });
      return;
    }

    const configuredTopics = topics.filter(t => revisions.has(t.id));
    if (configuredTopics.length === 0) {
      toast({ title: 'Configure as revisões primeiro', variant: 'destructive' });
      return;
    }

    if (!confirm(`Aplicar revisões de ${configuredTopics.length} tópico(s) para a mesma disciplina em TODAS as ${schools.length} escolas do edital?`)) return;

    setPropagating(true);
    let totalApplied = 0;

    try {
      // The selected discipline is from edital_disciplines. We need to find the 
      // equivalent discipline in each school and apply revisions by matching topic names.
      
      // Build a map of topic_name -> revision config from the current view
      const revisionsByTopicName = new Map<string, TopicRevision>();
      for (const topic of configuredTopics) {
        const rev = revisions.get(topic.id);
        if (rev) {
          revisionsByTopicName.set(topic.name, rev);
        }
      }

      for (const school of schools) {
        // Find the same discipline in this school
        const { data: schoolDiscData } = await supabase
          .from('school_disciplines')
          .select('discipline_id, discipline:study_disciplines!inner(id, name)')
          .eq('school_id', school.id)
          .eq('is_active', true);

        const matchingDisc = (schoolDiscData || []).find(sd => {
          const disc = sd.discipline as unknown as Discipline;
          return disc?.name === disciplines.find(d => d.id === selectedDiscipline)?.name;
        });

        if (!matchingDisc) continue;

        const disc = matchingDisc.discipline as unknown as Discipline;

        // Get topics of this discipline in this school
        const { data: schoolTopics } = await supabase
          .from('study_topics')
          .select('id, name')
          .eq('study_discipline_id', disc.id)
          .eq('is_active', true);

        for (const schoolTopic of schoolTopics || []) {
          const sourceRev = revisionsByTopicName.get(schoolTopic.name);
          if (!sourceRev) continue;

          const payload = {
            topic_id: schoolTopic.id,
            revision_1_days: sourceRev.revision_1_days,
            revision_2_days: sourceRev.revision_2_days,
            revision_3_days: sourceRev.revision_3_days,
            revision_4_days: sourceRev.revision_4_days,
            revision_5_days: sourceRev.revision_5_days,
            revision_6_days: sourceRev.revision_6_days,
            is_active: true
          };

          const { data: existing } = await supabase
            .from('topic_revisions')
            .select('id')
            .eq('topic_id', schoolTopic.id)
            .single();

          if (existing) {
            await supabase.from('topic_revisions').update(payload).eq('id', existing.id);
          } else {
            await supabase.from('topic_revisions').insert(payload);
          }
          totalApplied++;
        }
      }

      toast({ title: `Revisões aplicadas a ${totalApplied} tópicos em ${schools.length} escolas!` });
    } catch (error) {
      console.error('Error applying to all schools:', error);
      toast({ title: 'Erro ao aplicar revisões', variant: 'destructive' });
    } finally {
      setPropagating(false);
    }
  };

  const hasRevision = (topicId: string) => revisions.has(topicId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Configuration Panel */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Configuração Global de Revisões
          </CardTitle>
          <CardDescription>
            Defina os dias para cada revisão e aplique a todos os tópicos de uma vez.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <div key={num} className="space-y-1">
                <Label className="text-xs">{num}ª Revisão (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  className="text-center"
                  value={globalConfig[`revision_${num}_days` as keyof typeof globalConfig]}
                  onChange={(e) => setGlobalConfig(prev => ({
                    ...prev,
                    [`revision_${num}_days`]: e.target.value
                  }))}
                />
              </div>
            ))}
          </div>
          
          <div className="flex flex-wrap gap-2 pt-2">
            <Button 
              onClick={() => applyGlobalToAllSchools()}
              disabled={!selectedEdital || applyingAll}
              variant="default"
              className="flex-1 md:flex-none"
            >
              {applyingAll && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Aplicar a Todas Escolas do Edital
            </Button>
            <Button 
              onClick={() => applyGlobalToAllDisciplines()}
              disabled={!selectedSchool || selectedSchool === '__fonte__' || selectedSchool === '__todas__' || applyingAll}
              variant="secondary"
              className="flex-1 md:flex-none"
            >
              {applyingAll && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Aplicar a Todas Disciplinas da Escola
            </Button>
            <Button 
              variant="outline"
              onClick={() => applyGlobalToAll(false)}
              disabled={!selectedDiscipline || applyingAll}
              className="flex-1 md:flex-none"
            >
              {applyingAll && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Aplicar a Todos da Disciplina
            </Button>
            <Button 
              variant="ghost"
              onClick={() => applyGlobalToAll(true)}
              disabled={!selectedDiscipline || applyingAll}
              className="flex-1 md:flex-none"
            >
              Apenas aos Não Configurados
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Selection Card */}
      <Card>
        <CardHeader>
          <CardTitle>Selecionar Edital, Escola e Disciplina</CardTitle>
          <CardDescription>
            {isPreEdital 
              ? 'No pré-edital, use "Disciplinas Fonte" para editar e propagar revisões para todas as escolas.'
              : 'Nos pós-editais, use "Todas as Escolas" para editar revisões de qualquer disciplina e aplicá-las em massa.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Edital</Label>
              <Select value={selectedEdital} onValueChange={setSelectedEdital}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um edital" />
                </SelectTrigger>
                <SelectContent>
                  {editais.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Escola</Label>
              <Select 
                value={selectedSchool} 
                onValueChange={setSelectedSchool}
                disabled={!selectedEdital}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma escola" />
                </SelectTrigger>
                <SelectContent>
                  {isPreEdital && (
                    <SelectItem value="__fonte__">📚 Disciplinas Fonte (editar e propagar)</SelectItem>
                  )}
                  {!isPreEdital && (
                    <SelectItem value="__todas__">🏫 Todas as Escolas do Edital</SelectItem>
                  )}
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Disciplina</Label>
              <Select 
                value={selectedDiscipline} 
                onValueChange={setSelectedDiscipline}
                disabled={!selectedSchool}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma disciplina" />
                </SelectTrigger>
                <SelectContent>
                  {disciplines.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {selectedDiscipline && topics.length > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
              <span>{topics.length} tópicos encontrados</span>
              <span>{topics.filter(t => revisions.has(t.id)).length} configurados</span>
            </div>
          )}
          
          {/* Alert: Topics without revisions */}
          {selectedDiscipline && topicsWithoutRevisions.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 mt-4">
              <div className="flex items-start gap-2">
                <RefreshCw className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-700 text-sm">
                    ⚠️ {topicsWithoutRevisions.length} tópico(s) sem revisões configuradas
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Esses tópicos existem na disciplina mas ainda não possuem intervalos de revisão definidos.
                    Use a configuração global acima para aplicar revisões em massa, ou configure cada tópico individualmente na tabela abaixo.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {topicsWithoutRevisions.slice(0, 5).map(topicId => {
                      const topic = topics.find(t => t.id === topicId);
                      return topic ? (
                        <Badge key={topicId} variant="outline" className="text-xs bg-amber-500/10">
                          {topic.name}
                        </Badge>
                      ) : null;
                    })}
                    {topicsWithoutRevisions.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{topicsWithoutRevisions.length - 5} mais
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDiscipline && topics.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ChevronRight className="w-5 h-5" />
              <span className="font-medium">
                Tópicos de: {disciplines.find(d => d.id === selectedDiscipline)?.name}
              </span>
              {isSourceMode && (
                <Badge variant="outline" className="ml-2">📚 Fonte</Badge>
              )}
              {isAllSchoolsMode && (
                <Badge variant="outline" className="ml-2">🏫 Todas as Escolas</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Tópico</TableHead>
                  <TableHead className="text-center w-[80px]">1ª Rev</TableHead>
                  <TableHead className="text-center w-[80px]">2ª Rev</TableHead>
                  <TableHead className="text-center w-[80px]">3ª Rev</TableHead>
                  <TableHead className="text-center w-[80px]">4ª Rev</TableHead>
                  <TableHead className="text-center w-[80px]">5ª Rev</TableHead>
                  <TableHead className="text-center w-[80px]">6ª Rev</TableHead>
                  <TableHead className="text-center w-[100px]">Status</TableHead>
                  <TableHead className="text-right w-[80px]">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topics.map((topic) => {
                  const form = formState.get(topic.id);
                  const configured = hasRevision(topic.id);
                  
                  return (
                    <TableRow key={topic.id}>
                      <TableCell className="font-medium">{topic.name}</TableCell>
                      {['revision_1_days', 'revision_2_days', 'revision_3_days', 'revision_4_days', 'revision_5_days', 'revision_6_days'].map((field) => (
                        <TableCell key={field} className="text-center">
                          <Input
                            type="number"
                            min={1}
                            className="w-16 text-center mx-auto"
                            placeholder="-"
                            value={form?.[field as keyof typeof form] || ''}
                            onChange={(e) => updateFormValue(topic.id, field, e.target.value)}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <Badge variant={configured ? 'default' : 'secondary'} className="flex items-center gap-1 w-fit mx-auto">
                          {configured ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {configured ? 'Configurado' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          onClick={() => handleSave(topic.id)}
                          disabled={saving === topic.id}
                        >
                          {saving === topic.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {topics.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Nenhum tópico encontrado para esta disciplina
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

          {/* Source mode propagation (pré-edital only) */}
          {isSourceMode && (
            <div className="mt-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Propagar para todas as escolas</p>
                  <p className="text-xs text-muted-foreground">
                    Copia as revisões configuradas acima para todos os tópicos derivados em todas as escolas do edital.
                  </p>
                </div>
                <Button 
                  onClick={propagateToAllSchools}
                  disabled={propagating || topics.filter(t => revisions.has(t.id)).length === 0}
                >
                  {propagating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Propagar para Escolas
                </Button>
              </div>
            </div>
          )}

          {/* All schools mode propagation (pós-edital only) */}
          {isAllSchoolsMode && (
            <div className="mt-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Aplicar a todas as escolas do edital</p>
                  <p className="text-xs text-muted-foreground">
                    Aplica as revisões configuradas acima para a mesma disciplina em todas as {schools.length} escolas do edital, fazendo correspondência por nome de tópico.
                  </p>
                </div>
                <Button 
                  onClick={applyToAllSchoolsDiscipline}
                  disabled={propagating || topics.filter(t => revisions.has(t.id)).length === 0}
                >
                  {propagating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Aplicar a Todas as Escolas
                </Button>
              </div>
            </div>
          )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
