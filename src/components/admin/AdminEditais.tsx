import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Trash2, FileText, Star, Map, BookOpen, School, FolderOpen, Link as LinkIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface Area {
  id: string;
  name: string;
}

interface Edital {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  area_id: string | null;
  created_at: string;
}

interface Discipline {
  id: string;
  name: string;
  source_notebook_folder_id?: string | null;
}

interface EditalDiscipline {
  id: string;
  edital_id: string;
  discipline_id: string;
  is_mandatory: boolean;
  display_order: number;
  discipline?: Discipline;
}

interface NotebookFolder {
  id: string;
  name: string;
  parent_folder_id: string | null;
}

interface Notebook {
  id: string;
  name: string;
  folder_id: string | null;
  study_topic_id: string | null;
  question_count: number;
}

interface Topic {
  id: string;
  name: string;
  study_discipline_id: string;
  source_notebook_id: string | null;
}

export function AdminEditais() {
  const { toast } = useToast();
  const [editais, setEditais] = useState<Edital[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Notebooks and folders for quick linking
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [folders, setFolders] = useState<NotebookFolder[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [disciplinesDialogOpen, setDisciplinesDialogOpen] = useState(false);
  const [createSchoolDialogOpen, setCreateSchoolDialogOpen] = useState(false);
  const [linkNotebookDialogOpen, setLinkNotebookDialogOpen] = useState(false);
  
  // Selected edital for discipline configuration
  const [selectedEdital, setSelectedEdital] = useState<Edital | null>(null);
  const [editalDisciplines, setEditalDisciplines] = useState<EditalDiscipline[]>([]);
  const [loadingDisciplines, setLoadingDisciplines] = useState(false);
  
  // Form states
  const [editingEdital, setEditingEdital] = useState<Edital | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_default: false,
    is_active: true,
    display_order: 0,
    area_id: '' as string | null
  });
  
  // For linking disciplines
  const [selectedDisciplines, setSelectedDisciplines] = useState<Set<string>>(new Set());
  const [mandatoryDisciplines, setMandatoryDisciplines] = useState<Set<string>>(new Set());
  
  // For creating schools
  const [availableDisciplines, setAvailableDisciplines] = useState<Discipline[]>([]);
  const [selectedSchoolDiscipline, setSelectedSchoolDiscipline] = useState<string>('');
  
  // For linking notebooks to topics
  const [selectedDisciplineForLink, setSelectedDisciplineForLink] = useState<string>('');
  const [selectedTopicForLink, setSelectedTopicForLink] = useState<string>('');
  const [selectedNotebookForLink, setSelectedNotebookForLink] = useState<string>('');

  const fetchEditais = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('editals')
        .select('*')
        .order('name');

      if (error) throw error;
      setEditais(data || []);
    } catch (error) {
      console.error('Error fetching editais:', error);
      toast({
        title: 'Erro ao carregar editais',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAreas = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('areas')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAreas(data || []);
    } catch (error) {
      console.error('Error fetching areas:', error);
    }
  };
  
  const fetchDisciplines = async () => {
    try {
      const { data, error } = await supabase
        .from('study_disciplines')
        .select('id, name, source_notebook_folder_id')
        .eq('is_active', true)
        .order('name') as { data: Discipline[] | null; error: Error | null };

      if (error) throw error;
      setDisciplines(data || []);
    } catch (error) {
      console.error('Error fetching disciplines:', error);
    }
  };

  const fetchNotebooksAndFolders = async () => {
    try {
      const [notebooksRes, foldersRes, topicsRes] = await Promise.all([
        supabase
          .from('admin_question_notebooks')
          .select('id, name, folder_id, study_topic_id, question_count')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('admin_notebook_folders')
          .select('id, name, parent_folder_id')
          .eq('is_active', true)
          .order('display_order'),
        supabase
          .from('study_topics')
          .select('id, name, study_discipline_id, source_notebook_id')
          .eq('is_active', true)
          .order('name')
      ]);

      setNotebooks((notebooksRes.data as unknown as Notebook[]) || []);
      setFolders((foldersRes.data as unknown as NotebookFolder[]) || []);
      setTopics((topicsRes.data as unknown as Topic[]) || []);
    } catch (error) {
      console.error('Error fetching notebooks:', error);
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
          discipline:study_disciplines(id, name)
        `)
        .eq('edital_id', editalId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      
      const formattedData = (data || []).map((item: any) => ({
        ...item,
        discipline: item.discipline as Discipline
      }));
      
      setEditalDisciplines(formattedData);
      
      // Set selected and mandatory sets
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
    Promise.all([fetchEditais(), fetchAreas(), fetchDisciplines(), fetchNotebooksAndFolders()]);
  }, []);

  const handleSubmit = async () => {
    try {
      if (!formData.name.trim()) {
        toast({ title: 'Nome é obrigatório', variant: 'destructive' });
        return;
      }

      const payload = {
        name: formData.name,
        description: formData.description || null,
        is_default: formData.is_default,
        is_active: formData.is_active,
        display_order: formData.display_order,
        area_id: formData.area_id || null
      };

      if (editingEdital) {
        const { error } = await supabase
          .from('editals')
          .update(payload)
          .eq('id', editingEdital.id);

        if (error) throw error;
        toast({ title: 'Edital atualizado com sucesso!' });
      } else {
        const { error } = await supabase
          .from('editals')
          .insert(payload);

        if (error) throw error;
        toast({ title: 'Edital criado com sucesso!' });
      }

      setEditDialogOpen(false);
      setEditingEdital(null);
      setFormData({ name: '', description: '', is_default: false, is_active: true, display_order: 0, area_id: '' });
      fetchEditais();
    } catch (error) {
      console.error('Error saving edital:', error);
      toast({ title: 'Erro ao salvar edital', variant: 'destructive' });
    }
  };

  const handleEdit = (edital: Edital) => {
    setEditingEdital(edital);
    setFormData({
      name: edital.name,
      description: edital.description || '',
      is_default: edital.is_default,
      is_active: edital.is_active,
      display_order: edital.display_order,
      area_id: edital.area_id || ''
    });
    setEditDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este edital e todas as escolas vinculadas?')) return;

    try {
      const { error } = await supabase
        .from('editals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Edital excluído com sucesso!' });
      fetchEditais();
    } catch (error) {
      console.error('Error deleting edital:', error);
      toast({ title: 'Erro ao excluir edital', variant: 'destructive' });
    }
  };

  const openNewDialog = () => {
    setEditingEdital(null);
    setFormData({ name: '', description: '', is_default: false, is_active: true, display_order: editais.length, area_id: '' });
    setEditDialogOpen(true);
  };

  const openDisciplinesDialog = async (edital: Edital) => {
    setSelectedEdital(edital);
    await fetchEditalDisciplines(edital.id);
    setDisciplinesDialogOpen(true);
  };

  const toggleDiscipline = (disciplineId: string) => {
    setSelectedDisciplines(prev => {
      const next = new Set(prev);
      if (next.has(disciplineId)) {
        next.delete(disciplineId);
        // Also remove from mandatory if removed from selected
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
      // Delete all existing disciplines for this edital
      await supabase
        .from('edital_disciplines')
        .delete()
        .eq('edital_id', selectedEdital.id);

      // Insert new ones
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

  const openCreateSchoolDialog = async (edital: Edital) => {
    setSelectedEdital(edital);
    await fetchEditalDisciplines(edital.id);
    
    // Get non-mandatory disciplines
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

      // Create the school linked to the edital
      const { data: newSchool, error: createError } = await supabase
        .from('schools')
        .insert({
          name: newSchoolName,
          description: `Escola criada a partir do edital ${selectedEdital.name} com disciplina específica ${discipline.name}`,
          area_id: selectedEdital.area_id,
          edital_id: selectedEdital.id,
          is_active: true,
          is_default: false,
          display_order: 0
        })
        .select()
        .single();

      if (createError) throw createError;

      // Copy all mandatory disciplines + the selected specific discipline to school_disciplines
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
      
    } catch (error) {
      console.error('Error creating school:', error);
      toast({ title: 'Erro ao criar escola', variant: 'destructive' });
    }
  };

  const getAreaName = (areaId: string | null) => {
    if (!areaId) return null;
    return areas.find(a => a.id === areaId)?.name;
  };

  // Link notebook to topic
  const linkNotebookToTopic = async () => {
    if (!selectedTopicForLink || !selectedNotebookForLink) {
      toast({ title: 'Selecione um tópico e um caderno', variant: 'destructive' });
      return;
    }

    try {
      // Update the topic with the notebook link
      const { error: topicError } = await supabase
        .from('study_topics')
        .update({ source_notebook_id: selectedNotebookForLink })
        .eq('id', selectedTopicForLink);

      if (topicError) throw topicError;

      // Update the notebook with the topic link
      const { error: notebookError } = await supabase
        .from('admin_question_notebooks')
        .update({ study_topic_id: selectedTopicForLink })
        .eq('id', selectedNotebookForLink);

      if (notebookError) throw notebookError;

      toast({ title: 'Caderno vinculado com sucesso! Meta de questões será criada automaticamente.' });
      setLinkNotebookDialogOpen(false);
      setSelectedDisciplineForLink('');
      setSelectedTopicForLink('');
      setSelectedNotebookForLink('');
      fetchNotebooksAndFolders();
    } catch (error) {
      console.error('Error linking notebook:', error);
      toast({ title: 'Erro ao vincular caderno', variant: 'destructive' });
    }
  };

  // Get topics by discipline
  const getTopicsByDiscipline = (disciplineId: string) => {
    return topics.filter(t => t.study_discipline_id === disciplineId);
  };

  // Get notebooks by folder (discipline)
  const getNotebooksByFolder = (folderId: string | null) => {
    return notebooks.filter(n => n.folder_id === folderId);
  };

  // Get folder linked to discipline
  const getFolderForDiscipline = (disciplineId: string) => {
    const discipline = disciplines.find(d => d.id === disciplineId);
    if (!discipline?.source_notebook_folder_id) return null;
    return folders.find(f => f.id === discipline.source_notebook_folder_id);
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Editais
              </CardTitle>
              <CardDescription>
                Gerencie os editais. Cada edital possui disciplinas obrigatórias e específicas que formam as escolas.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setLinkNotebookDialogOpen(true)}>
                <LinkIcon className="w-4 h-4 mr-2" />
                Vincular Caderno
              </Button>
              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNewDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Edital
                  </Button>
                </DialogTrigger>
                <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingEdital ? 'Editar Edital' : 'Novo Edital'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: IF Sudeste de MG"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descrição opcional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Área</Label>
                    <Select 
                      value={formData.area_id || 'none'} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, area_id: v === 'none' ? null : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma área" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem área</SelectItem>
                        {areas.map((area) => (
                          <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="order">Ordem de exibição</Label>
                    <Input
                      id="order"
                      type="number"
                      value={formData.display_order}
                      onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                      />
                      <Label htmlFor="is_active">Ativo</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="is_default"
                        checked={formData.is_default}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_default: checked }))}
                      />
                      <Label htmlFor="is_default">Padrão</Label>
                    </div>
                  </div>
                  <Button onClick={handleSubmit} className="w-full">
                    {editingEdital ? 'Salvar Alterações' : 'Criar Edital'}
                  </Button>
                </div>
              </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editais.map((edital) => (
                <TableRow key={edital.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {edital.name}
                      {edital.is_default && (
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {edital.area_id ? (
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        <Map className="w-3 h-3" />
                        {getAreaName(edital.area_id)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {edital.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={edital.is_active ? 'default' : 'secondary'}>
                      {edital.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => openDisciplinesDialog(edital)}
                      >
                        <BookOpen className="w-4 h-4 mr-1" />
                        Disciplinas
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => openCreateSchoolDialog(edital)}
                      >
                        <School className="w-4 h-4 mr-1" />
                        Criar Escola
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(edital)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(edital.id)}
                        disabled={edital.is_default}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {editais.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum edital cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Disciplines Dialog */}
      <Dialog open={disciplinesDialogOpen} onOpenChange={setDisciplinesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Disciplinas do Edital: {selectedEdital?.name}
            </DialogTitle>
          </DialogHeader>
          
          {loadingDisciplines ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecione as disciplinas do edital e marque quais são obrigatórias para todas as escolas.
              </p>
              
              <ScrollArea className="h-[400px] border rounded-lg p-4">
                <div className="space-y-2">
                  {disciplines.map((discipline) => {
                    const isSelected = selectedDisciplines.has(discipline.id);
                    const isMandatory = mandatoryDisciplines.has(discipline.id);
                    
                    return (
                      <div
                        key={discipline.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          isSelected ? 'bg-primary/5 border-primary' : 'bg-background'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`disc-${discipline.id}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleDiscipline(discipline.id)}
                          />
                          <Label htmlFor={`disc-${discipline.id}`} className="cursor-pointer">
                            {discipline.name}
                          </Label>
                        </div>
                        
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`mandatory-${discipline.id}`}
                              checked={isMandatory}
                              onCheckedChange={() => toggleMandatory(discipline.id)}
                            />
                            <Label htmlFor={`mandatory-${discipline.id}`} className="text-sm text-muted-foreground cursor-pointer">
                              Obrigatória
                            </Label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{selectedDisciplines.size} disciplinas selecionadas</span>
                <span>{mandatoryDisciplines.size} obrigatórias</span>
              </div>
            </div>
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
            <DialogTitle>
              Criar Escola: {selectedEdital?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Selecione a disciplina específica para criar a escola. A escola incluirá automaticamente 
              todas as {mandatoryDisciplines.size} disciplinas obrigatórias + a disciplina específica selecionada.
            </p>
            
            {availableDisciplines.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p>Nenhuma disciplina específica disponível.</p>
                <p className="text-sm mt-2">
                  Adicione disciplinas não-obrigatórias ao edital primeiro.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Disciplina Específica</Label>
                <Select value={selectedSchoolDiscipline} onValueChange={setSelectedSchoolDiscipline}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a disciplina específica" />
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
            )}
            
            {selectedSchoolDiscipline && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium">Nome da escola:</p>
                <p className="text-primary">
                  {disciplines.find(d => d.id === selectedSchoolDiscipline)?.name} - {selectedEdital?.name}
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateSchoolDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createSchool} disabled={!selectedSchoolDiscipline}>
              <School className="w-4 h-4 mr-2" />
              Criar Escola
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Notebook to Topic Dialog */}
      <Dialog open={linkNotebookDialogOpen} onOpenChange={setLinkNotebookDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Vincular Caderno ao Tópico
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Vincule um caderno de questões a um tópico. Isso criará automaticamente uma meta de questões para o tópico.
            </p>

            {/* Select Discipline */}
            <div className="space-y-2">
              <Label>Disciplina</Label>
              <Select 
                value={selectedDisciplineForLink || 'none'} 
                onValueChange={(v) => {
                  setSelectedDisciplineForLink(v === 'none' ? '' : v);
                  setSelectedTopicForLink('');
                  setSelectedNotebookForLink('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma disciplina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {disciplines.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Select Topic */}
            {selectedDisciplineForLink && (
              <div className="space-y-2">
                <Label>Tópico</Label>
                <Select 
                  value={selectedTopicForLink || 'none'} 
                  onValueChange={(v) => setSelectedTopicForLink(v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um tópico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {getTopicsByDiscipline(selectedDisciplineForLink).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.source_notebook_id && (
                          <span className="ml-2 text-muted-foreground">(já vinculado)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Select Notebook */}
            {selectedDisciplineForLink && (
              <div className="space-y-2">
                <Label>Caderno de Questões</Label>
                <Select 
                  value={selectedNotebookForLink || 'none'} 
                  onValueChange={(v) => setSelectedNotebookForLink(v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um caderno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {(() => {
                      const folder = getFolderForDiscipline(selectedDisciplineForLink);
                      const notebooksInFolder = folder ? getNotebooksByFolder(folder.id) : notebooks;
                      return notebooksInFolder.map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.name} ({n.question_count} questões)
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
                {getFolderForDiscipline(selectedDisciplineForLink) && (
                  <p className="text-xs text-muted-foreground">
                    Mostrando cadernos da pasta: {getFolderForDiscipline(selectedDisciplineForLink)?.name}
                  </p>
                )}
              </div>
            )}

            {selectedTopicForLink && selectedNotebookForLink && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium">Vinculação:</p>
                <p className="text-primary text-sm">
                  {topics.find(t => t.id === selectedTopicForLink)?.name} ←→ {notebooks.find(n => n.id === selectedNotebookForLink)?.name}
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkNotebookDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={linkNotebookToTopic} 
              disabled={!selectedTopicForLink || !selectedNotebookForLink}
            >
              <LinkIcon className="w-4 h-4 mr-2" />
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}