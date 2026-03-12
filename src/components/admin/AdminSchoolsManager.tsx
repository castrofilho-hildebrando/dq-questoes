import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, School, FileText, BookOpen, Plus, Settings, Video, Layers, Bot, HelpCircle, Pencil } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Edital {
  id: string;
  name: string;
  area_id: string | null;
}

interface Discipline {
  id: string;
  name: string;
}

interface EditalDiscipline {
  id: string;
  edital_id: string;
  discipline_id: string;
  is_mandatory: boolean;
  display_order: number;
  discipline?: Discipline;
}

interface SchoolWithEdital {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  edital_id: string | null;
  has_banco_questoes: boolean;
  has_materials: boolean;
  has_videos: boolean;
  has_flashcards: boolean;
  has_robo_tutor: boolean;
  editals?: { id: string; name: string } | null;
  discipline_count?: number;
}

export function AdminSchoolsManager() {
  const { toast } = useToast();
  const [schools, setSchools] = useState<SchoolWithEdital[]>([]);
  const [editals, setEditals] = useState<Edital[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection states
  const [selectedEditalId, setSelectedEditalId] = useState<string>('');
  const [selectedEdital, setSelectedEdital] = useState<Edital | null>(null);
  
  // Dialog states
  const [disciplinesDialogOpen, setDisciplinesDialogOpen] = useState(false);
  const [createSchoolDialogOpen, setCreateSchoolDialogOpen] = useState(false);
  const [editSchoolDialogOpen, setEditSchoolDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolWithEdital | null>(null);
  const [loadingDisciplines, setLoadingDisciplines] = useState(false);
  
  // Discipline configuration
  const [editalDisciplines, setEditalDisciplines] = useState<EditalDiscipline[]>([]);
  const [selectedDisciplines, setSelectedDisciplines] = useState<Set<string>>(new Set());
  const [mandatoryDisciplines, setMandatoryDisciplines] = useState<Set<string>>(new Set());
  
  // For creating schools
  const [availableDisciplines, setAvailableDisciplines] = useState<Discipline[]>([]);
  const [selectedSchoolDiscipline, setSelectedSchoolDiscipline] = useState<string>('');
  
  // For editing school disciplines
  const [schoolDisciplines, setSchoolDisciplines] = useState<Set<string>>(new Set());
  const [loadingSchoolDisciplines, setLoadingSchoolDisciplines] = useState(false);
  
  // Filter for adding new disciplines by edital
  const [addDisciplineFilterEditalId, setAddDisciplineFilterEditalId] = useState<string>('all');
  const [addDisciplineFilterIds, setAddDisciplineFilterIds] = useState<Set<string> | null>(null);

  const fetchEditals = async () => {
    try {
      const { data, error } = await supabase
        .from('editals')
        .select('id, name, area_id')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setEditals(data || []);
    } catch (error) {
      console.error('Error fetching editals:', error);
    }
  };

  const fetchDisciplines = async () => {
    try {
      const { data, error } = await supabase
        .from('study_disciplines')
        .select('id, name')
        .eq('is_active', true)
        .order('name', { ascending: true }) as { data: Discipline[] | null; error: Error | null };

      if (error) throw error;
      setDisciplines(data || []);
    } catch (error) {
      console.error('Error fetching disciplines:', error);
    }
  };

  const fetchSchools = async () => {
    try {
      let query = supabase
        .from('schools')
        .select(`
          id,
          name,
          description,
          is_active,
          display_order,
          edital_id,
          has_banco_questoes,
          has_materials,
          has_videos,
          has_flashcards,
          has_robo_tutor,
          editals(id, name)
        `)
        .not('edital_id', 'is', null)
        .order('name');

      if (selectedEditalId) {
        query = query.eq('edital_id', selectedEditalId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const schoolsWithCounts = await Promise.all((data || []).map(async (school) => {
        const { count } = await supabase
          .from('school_disciplines')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id);
        
        return {
          ...school,
          has_banco_questoes: school.has_banco_questoes ?? true,
          has_materials: school.has_materials ?? true,
          has_videos: school.has_videos ?? true,
          has_flashcards: school.has_flashcards ?? true,
          has_robo_tutor: school.has_robo_tutor ?? true,
          editals: school.editals as { id: string; name: string } | null,
          discipline_count: count || 0
        };
      }));
      
      setSchools(schoolsWithCounts);
    } catch (error) {
      console.error('Error fetching schools:', error);
      toast({
        title: 'Erro ao carregar escolas',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEditalDisciplines = async (editalId: string) => {
    setLoadingDisciplines(true);
    try {
      const { data, error } = await (supabase as any)
        .from('edital_disciplines')
        .select(`
          id,
          edital_id,
          discipline_id,
          is_mandatory,
          display_order,
          discipline:study_disciplines!inner(id, name, is_active)
        `)
        .eq('edital_id', editalId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      
      // Filter out disciplines that are inactive
      const formattedData = (data || [])
        .filter((item: any) => item.discipline?.is_active !== false)
        .map((item: any) => ({
          ...item,
          discipline: item.discipline as Discipline
        }));
      
      setEditalDisciplines(formattedData);
      
      const selected = new Set<string>();
      const mandatory = new Set<string>();
      formattedData.forEach(ed => {
        selected.add(ed.discipline_id);
        if (ed.is_mandatory) {
          mandatory.add(ed.discipline_id);
        }
      });
      setSelectedDisciplines(selected);
      setMandatoryDisciplines(mandatory);
      
    } catch (error) {
      console.error('Error fetching edital disciplines:', error);
    } finally {
      setLoadingDisciplines(false);
    }
  };

  useEffect(() => {
    Promise.all([fetchEditals(), fetchDisciplines()]);
  }, []);

  useEffect(() => {
    fetchSchools();
    
    if (selectedEditalId) {
      const edital = editals.find(e => e.id === selectedEditalId);
      setSelectedEdital(edital || null);
      fetchEditalDisciplines(selectedEditalId);
    } else {
      setSelectedEdital(null);
      setEditalDisciplines([]);
      setSelectedDisciplines(new Set());
      setMandatoryDisciplines(new Set());
    }
  }, [selectedEditalId, editals]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir a escola "${name}"?\n\nIsso também excluirá:\n- Todas as disciplinas vinculadas\n- Todos os tópicos\n- Todas as metas\n- Cronogramas de usuários`)) return;

    try {
      const { data, error } = await supabase
        .rpc('delete_school_cascade', { p_school_id: id });

      if (error) throw error;
      
      const result = data as { success: boolean; deleted: { goals: number; topics: number; disciplines: number } };
      toast({ 
        title: 'Escola excluída com sucesso!',
        description: `Removidos: ${result.deleted.disciplines} disciplinas, ${result.deleted.topics} tópicos, ${result.deleted.goals} metas`
      });
      fetchSchools();
    } catch (error) {
      console.error('Error deleting school:', error);
      toast({ title: 'Erro ao excluir escola', variant: 'destructive' });
    }
  };

  const toggleDiscipline = (disciplineId: string) => {
    setSelectedDisciplines(prev => {
      const next = new Set(prev);
      if (next.has(disciplineId)) {
        next.delete(disciplineId);
        setMandatoryDisciplines(m => {
          const nextM = new Set(m);
          nextM.delete(disciplineId);
          return nextM;
        });
      } else {
        next.add(disciplineId);
      }
      return next;
    });
  };

  const toggleMandatory = (disciplineId: string) => {
    setMandatoryDisciplines(prev => {
      const next = new Set(prev);
      if (next.has(disciplineId)) {
        next.delete(disciplineId);
      } else {
        next.add(disciplineId);
      }
      return next;
    });
  };

  const saveDisciplines = async () => {
    if (!selectedEdital) return;
    
    try {
      await supabase
        .from('edital_disciplines')
        .delete()
        .eq('edital_id', selectedEdital.id);

      const toInsert = Array.from(selectedDisciplines).map((disciplineId, index) => ({
        edital_id: selectedEdital.id,
        discipline_id: disciplineId,
        is_mandatory: mandatoryDisciplines.has(disciplineId),
        display_order: index,
        is_active: true
      }));

      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('edital_disciplines')
          .insert(toInsert);
        
        if (error) throw error;
      }

      toast({ title: 'Disciplinas salvas com sucesso!' });
      setDisciplinesDialogOpen(false);
      
    } catch (error) {
      console.error('Error saving disciplines:', error);
      toast({ title: 'Erro ao salvar disciplinas', variant: 'destructive' });
    }
  };

  const openCreateSchoolDialog = () => {
    if (!selectedEdital) {
      toast({ title: 'Selecione um edital primeiro', variant: 'destructive' });
      return;
    }
    
    const nonMandatory = disciplines.filter(d => 
      selectedDisciplines.has(d.id) && !mandatoryDisciplines.has(d.id)
    );
    
    setAvailableDisciplines(nonMandatory);
    setSelectedSchoolDiscipline('');
    setCreateSchoolDialogOpen(true);
  };

  const createSchool = async () => {
    if (!selectedEdital || !selectedSchoolDiscipline) {
      toast({ title: 'Selecione uma disciplina específica', variant: 'destructive' });
      return;
    }

    try {
      const discipline = disciplines.find(d => d.id === selectedSchoolDiscipline);
      if (!discipline) return;

      const newSchoolName = `${discipline.name} - ${selectedEdital.name}`;

      const { data: newSchool, error: createError } = await supabase
        .from('schools')
        .insert({
          name: newSchoolName,
          description: `Escola criada a partir do edital ${selectedEdital.name} com disciplina específica ${discipline.name}`,
          area_id: selectedEdital.area_id,
          edital_id: selectedEdital.id,
          primary_discipline_id: selectedSchoolDiscipline,
          is_active: true,
          is_default: false,
          display_order: 0
        })
        .select()
        .single();

      if (createError) throw createError;

      const disciplinesToCopy = Array.from(mandatoryDisciplines).concat([selectedSchoolDiscipline]);
      
      const schoolDisciplines = disciplinesToCopy.map((disciplineId, index) => ({
        school_id: newSchool.id,
        discipline_id: disciplineId,
        is_mandatory: mandatoryDisciplines.has(disciplineId),
        display_order: index,
        is_active: true
      }));

      const { error: linkError } = await supabase
        .from('school_disciplines')
        .insert(schoolDisciplines);

      if (linkError) throw linkError;

      toast({ title: `Escola "${newSchoolName}" criada com sucesso!` });
      setCreateSchoolDialogOpen(false);
      fetchSchools();
      
    } catch (error) {
      console.error('Error creating school:', error);
      toast({ title: 'Erro ao criar escola', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="w-5 h-5" />
            Gerenciar Escolas
          </CardTitle>
          <CardDescription>
            Selecione um edital, configure suas disciplinas e crie escolas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Edital Selection */}
          <div className="space-y-2">
            <Label>Selecionar Edital</Label>
            <Select value={selectedEditalId || "all"} onValueChange={(v) => setSelectedEditalId(v === "all" ? "" : v)}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Selecione um edital" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os editais</SelectItem>
                {editals.map((edital) => (
                  <SelectItem key={edital.id} value={edital.id}>
                    {edital.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions when edital is selected */}
          {selectedEdital && (
            <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
              <Badge variant="outline" className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {selectedEdital.name}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => { setAddDisciplineFilterEditalId('all'); setAddDisciplineFilterIds(null); setDisciplinesDialogOpen(true); }}>
                <Settings className="w-4 h-4 mr-2" />
                Configurar Disciplinas
              </Button>
              <Button size="sm" onClick={openCreateSchoolDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Escola
              </Button>
            </div>
          )}

          {/* Disciplines Summary */}
          {selectedEdital && editalDisciplines.length > 0 && (
            <div className="p-4 border rounded-lg space-y-2">
              <Label className="text-sm font-medium">Disciplinas vinculadas ao edital:</Label>
              <div className="flex flex-wrap gap-2">
                {editalDisciplines.map((ed) => (
                  <Badge 
                    key={ed.id} 
                    variant={ed.is_mandatory ? "default" : "secondary"}
                  >
                    {ed.discipline?.name}
                    {ed.is_mandatory && " (Obrigatória)"}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Schools Table */}
          <Table>
            <TableHeader>
              <TableRow>
              <TableHead>Nome da Escola</TableHead>
              <TableHead>Edital Pai</TableHead>
              <TableHead>Disciplinas</TableHead>
              <TableHead>Recursos</TableHead>
                <TableHead>Recursos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.map((school) => (
                <TableRow key={school.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <School className="w-4 h-4 text-muted-foreground" />
                      {school.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {school.editals ? (
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        <FileText className="w-3 h-3" />
                        {school.editals.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                      <BookOpen className="w-3 h-3" />
                      {school.discipline_count} disciplinas
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {school.has_banco_questoes && <HelpCircle className="w-4 h-4 text-green-500" />}
                      {school.has_materials && <FileText className="w-4 h-4 text-blue-500" />}
                      {school.has_videos && <Video className="w-4 h-4 text-red-500" />}
                      {school.has_flashcards && <Layers className="w-4 h-4 text-purple-500" />}
                      {school.has_robo_tutor && <Bot className="w-4 h-4 text-amber-500" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={school.is_active ? 'default' : 'secondary'}>
                      {school.is_active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={async () => {
                          setEditingSchool(school);
                          setSchoolDisciplines(new Set());
                          setEditSchoolDialogOpen(true);
                          
                          // Load school disciplines AND edital disciplines
                          setLoadingSchoolDisciplines(true);
                          try {
                            // Load current school disciplines
                            const { data: schoolDiscData } = await supabase
                              .from('school_disciplines')
                              .select('discipline_id')
                              .eq('school_id', school.id);
                            
                            const disciplineIds = new Set((schoolDiscData || []).map(d => d.discipline_id));
                            setSchoolDisciplines(disciplineIds);

                            // Load edital disciplines if school has an edital_id
                            if (school.edital_id) {
                              const { data: editalDiscData } = await supabase
                                .from('edital_disciplines')
                                .select(`
                                  id,
                                  edital_id,
                                  discipline_id,
                                  is_mandatory,
                                  display_order,
                                  discipline:study_disciplines(id, name)
                                `)
                                .eq('edital_id', school.edital_id)
                                .eq('is_active', true)
                                .order('display_order');

                              setEditalDisciplines((editalDiscData || []).map((ed: any) => ({
                                ...ed,
                                discipline: ed.discipline
                              })));
                            } else {
                              setEditalDisciplines([]);
                            }
                          } catch (error) {
                            console.error('Error loading school disciplines:', error);
                          } finally {
                            setLoadingSchoolDisciplines(false);
                          }
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(school.id, school.name)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {schools.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {selectedEditalId 
                      ? 'Nenhuma escola encontrada para este edital. Clique em "Criar Escola" para criar uma.' 
                      : 'Selecione um edital para visualizar ou criar escolas.'
                    }
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Disciplines Configuration Dialog */}
      <Dialog open={disciplinesDialogOpen} onOpenChange={setDisciplinesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar Disciplinas - {selectedEdital?.name}</DialogTitle>
          </DialogHeader>
          
          {loadingDisciplines ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Selecione as disciplinas e marque quais são obrigatórias para todas as escolas deste edital.
                </p>
                {/* Show only disciplines linked to the edital (editalDisciplines) + allow adding new ones */}
                {editalDisciplines.length > 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground font-medium mt-2">Disciplinas vinculadas:</p>
                    {editalDisciplines.map((ed) => (
                      <div 
                        key={ed.discipline_id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedDisciplines.has(ed.discipline_id)}
                            onCheckedChange={() => toggleDiscipline(ed.discipline_id)}
                          />
                          <span>{ed.discipline?.name}</span>
                        </div>
                        {selectedDisciplines.has(ed.discipline_id) && (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={mandatoryDisciplines.has(ed.discipline_id)}
                              onCheckedChange={() => toggleMandatory(ed.discipline_id)}
                            />
                            <Label className="text-sm text-muted-foreground">Obrigatória</Label>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Nenhuma disciplina vinculada ainda. Adicione disciplinas abaixo.
                  </p>
                )}
                
                {/* Option to add more disciplines - show all disciplines NOT yet linked to the edital */}
                {(() => {
                  const editalDisciplineIds = new Set(editalDisciplines.map(ed => ed.discipline_id));
                  const unlinkedDisciplines = disciplines.filter(
                    d => !editalDisciplineIds.has(d.id)
                  );
                  
                  if (unlinkedDisciplines.length === 0) return null;
                  
                  const handleFilterEditalChange = async (editalId: string) => {
                    setAddDisciplineFilterEditalId(editalId);
                    if (editalId === 'all') {
                      setAddDisciplineFilterIds(null);
                      return;
                    }
                    try {
                      const { data } = await supabase
                        .from('edital_disciplines')
                        .select('discipline_id')
                        .eq('edital_id', editalId)
                        .eq('is_active', true);
                      setAddDisciplineFilterIds(new Set((data || []).map(d => d.discipline_id)));
                    } catch {
                      setAddDisciplineFilterIds(null);
                    }
                  };
                  
                  const filteredUnlinked = addDisciplineFilterIds
                    ? unlinkedDisciplines.filter(d => addDisciplineFilterIds.has(d.id))
                    : unlinkedDisciplines;
                  
                  return (
                    <details className="mt-4">
                      <summary className="text-sm font-medium cursor-pointer hover:text-primary">
                        + Adicionar novas disciplinas ao edital ({unlinkedDisciplines.length} disponíveis)
                      </summary>
                      <div className="mt-2 pl-2 border-l-2 border-muted">
                        <div className="mb-2">
                          <Label className="text-xs text-muted-foreground mb-1 block">Filtrar por edital de origem:</Label>
                          <Select value={addDisciplineFilterEditalId} onValueChange={handleFilterEditalChange}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Todos os editais" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos ({unlinkedDisciplines.length})</SelectItem>
                              {editals.filter(e => e.id !== selectedEdital?.id).map(edital => (
                                <SelectItem key={edital.id} value={edital.id}>{edital.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {filteredUnlinked.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2 text-center">
                            Nenhuma disciplina disponível {addDisciplineFilterEditalId !== 'all' ? 'neste edital' : ''}.
                          </p>
                        ) : filteredUnlinked.map((discipline) => (
                          <div 
                            key={discipline.id}
                            className="flex items-center justify-between p-2 border rounded hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedDisciplines.has(discipline.id)}
                                onCheckedChange={() => toggleDiscipline(discipline.id)}
                              />
                              <span className="text-sm">{discipline.name}</span>
                            </div>
                            {selectedDisciplines.has(discipline.id) && (
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={mandatoryDisciplines.has(discipline.id)}
                                  onCheckedChange={() => toggleMandatory(discipline.id)}
                                />
                                <Label className="text-sm text-muted-foreground">Obrigatória</Label>
                              </div>
                            )}
                          </div>
                        ))}
                        </div>
                      </div>
                    </details>
                  );
                })()}
              </div>
            </ScrollArea>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisciplinesDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveDisciplines}>
              Salvar Disciplinas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create School Dialog */}
      <Dialog open={createSchoolDialogOpen} onOpenChange={setCreateSchoolDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Escola - {selectedEdital?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Disciplina Específica</Label>
              <p className="text-sm text-muted-foreground">
                Selecione a disciplina específica que define esta escola. As disciplinas obrigatórias serão incluídas automaticamente.
              </p>
              <Select value={selectedSchoolDiscipline} onValueChange={setSelectedSchoolDiscipline}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma disciplina" />
                </SelectTrigger>
                <SelectContent>
                  {availableDisciplines.map((discipline) => (
                    <SelectItem key={discipline.id} value={discipline.id}>
                      {discipline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {availableDisciplines.length === 0 && (
              <p className="text-sm text-amber-600">
                Não há disciplinas não-obrigatórias disponíveis. Configure as disciplinas do edital primeiro.
              </p>
            )}

            {mandatoryDisciplines.size > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <Label className="text-sm">Disciplinas obrigatórias incluídas:</Label>
                <div className="flex flex-wrap gap-1 mt-2">
                  {Array.from(mandatoryDisciplines).map((id) => {
                    const disc = disciplines.find(d => d.id === id);
                    return disc ? (
                      <Badge key={id} variant="outline">{disc.name}</Badge>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateSchoolDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createSchool} disabled={!selectedSchoolDiscipline}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Escola
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit School Dialog */}
      <Dialog open={editSchoolDialogOpen} onOpenChange={setEditSchoolDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Editar Escola - {editingSchool?.name}</DialogTitle>
          </DialogHeader>
          
          {editingSchool && (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Disciplines Section */}
                <div className="space-y-3">
                  <Label className="font-medium flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Disciplinas da Escola
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Selecione quais disciplinas devem estar disponíveis para os alunos desta escola.
                  </p>
                  
                  {loadingSchoolDisciplines ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Show edital disciplines if edital is selected */}
                      {editingSchool.edital_id && editalDisciplines.length > 0 ? (
                        editalDisciplines.map((ed) => (
                          <div 
                            key={ed.discipline_id} 
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={schoolDisciplines.has(ed.discipline_id)}
                                onCheckedChange={(checked) => {
                                  const next = new Set(schoolDisciplines);
                                  if (checked) {
                                    next.add(ed.discipline_id);
                                  } else {
                                    next.delete(ed.discipline_id);
                                  }
                                  setSchoolDisciplines(next);
                                }}
                                disabled={ed.is_mandatory}
                              />
                              <span className={ed.is_mandatory ? 'font-medium' : ''}>
                                {ed.discipline?.name}
                              </span>
                            </div>
                            {ed.is_mandatory && (
                              <Badge variant="default" className="text-xs">
                                Obrigatória
                              </Badge>
                            )}
                          </div>
                        ))
                      ) : (
                        // Fallback: show all disciplines
                        disciplines.map((discipline) => (
                          <div 
                            key={discipline.id} 
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={schoolDisciplines.has(discipline.id)}
                                onCheckedChange={(checked) => {
                                  const next = new Set(schoolDisciplines);
                                  if (checked) {
                                    next.add(discipline.id);
                                  } else {
                                    next.delete(discipline.id);
                                  }
                                  setSchoolDisciplines(next);
                                }}
                              />
                              <span>{discipline.name}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Separator */}
                <div className="border-t" />

                {/* Resources Section */}
                <div className="space-y-3">
                  <Label className="font-medium flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Recursos Disponíveis
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Selecione quais recursos estarão habilitados para os alunos desta escola.
                  </p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-green-500" />
                        <span>Banco de Questões</span>
                      </div>
                      <Checkbox
                        checked={editingSchool.has_banco_questoes}
                        onCheckedChange={(checked) => setEditingSchool({
                          ...editingSchool,
                          has_banco_questoes: !!checked
                        })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span>Materiais (PDFs)</span>
                      </div>
                      <Checkbox
                        checked={editingSchool.has_materials}
                        onCheckedChange={(checked) => setEditingSchool({
                          ...editingSchool,
                          has_materials: !!checked
                        })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-red-500" />
                        <span>Vídeos</span>
                      </div>
                      <Checkbox
                        checked={editingSchool.has_videos}
                        onCheckedChange={(checked) => setEditingSchool({
                          ...editingSchool,
                          has_videos: !!checked
                        })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-500" />
                        <span>Flashcards</span>
                      </div>
                      <Checkbox
                        checked={editingSchool.has_flashcards}
                        onCheckedChange={(checked) => setEditingSchool({
                          ...editingSchool,
                          has_flashcards: !!checked
                        })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-amber-500" />
                        <span>Robô Tutor (IA)</span>
                      </div>
                      <Checkbox
                        checked={editingSchool.has_robo_tutor}
                        onCheckedChange={(checked) => setEditingSchool({
                          ...editingSchool,
                          has_robo_tutor: !!checked
                        })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSchoolDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={async () => {
              if (!editingSchool) return;
              try {
                // Update school resources
                const { error: updateError } = await supabase
                  .from('schools')
                  .update({
                    has_banco_questoes: editingSchool.has_banco_questoes,
                    has_materials: editingSchool.has_materials,
                    has_videos: editingSchool.has_videos,
                    has_flashcards: editingSchool.has_flashcards,
                    has_robo_tutor: editingSchool.has_robo_tutor
                  })
                  .eq('id', editingSchool.id);
                
                if (updateError) throw updateError;
                
                // Update school disciplines
                // First, delete all existing school disciplines
                await supabase
                  .from('school_disciplines')
                  .delete()
                  .eq('school_id', editingSchool.id);
                
                // Then insert the new ones
                if (schoolDisciplines.size > 0) {
                  const disciplinesToInsert = Array.from(schoolDisciplines).map((disciplineId, index) => ({
                    school_id: editingSchool.id,
                    discipline_id: disciplineId,
                    is_mandatory: mandatoryDisciplines.has(disciplineId),
                    display_order: index,
                    is_active: true
                  }));
                  
                  const { error: insertError } = await supabase
                    .from('school_disciplines')
                    .insert(disciplinesToInsert);
                  
                  if (insertError) throw insertError;
                }
                
                toast({ title: 'Escola atualizada com sucesso!' });
                setEditSchoolDialogOpen(false);
                fetchSchools();
              } catch (error) {
                console.error('Error updating school:', error);
                toast({ title: 'Erro ao atualizar escola', variant: 'destructive' });
              }
            }}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
