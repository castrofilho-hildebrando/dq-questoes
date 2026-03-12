import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  GraduationCap,
  BookOpen,
  Target,
  FileText,
  Link2,
  Plus,
  Trash2,
  Clock,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PdfSearchDialog } from './PdfSearchDialog';

interface Edital {
  id: string;
  name: string;
}

interface Discipline {
  id: string;
  name: string;
}

interface Topic {
  id: string;
  name: string;
  discipline_id: string;
  discipline_name: string;
}

interface TopicLink {
  id: string;
  pdf_material_id: string;
  auto_created_goal_id: string | null;
  pdf_name: string;
  pdf_study_minutes: number;
}

interface TopicWithLinks extends Topic {
  links: TopicLink[];
}

export function AdminPdfLinkByEdital() {
  const [loading, setLoading] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);
  
  // Data
  const [editais, setEditais] = useState<Edital[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [topicsWithLinks, setTopicsWithLinks] = useState<TopicWithLinks[]>([]);
  
  // Selected values
  const [selectedEdital, setSelectedEdital] = useState<string>('');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('');
  
  // Dialog state
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<{ id: string; name: string; discipline_name: string } | null>(null);
  const [selectedTopicPdfIds, setSelectedTopicPdfIds] = useState<string[]>([]);

  useEffect(() => {
    fetchEditais();
  }, []);

  useEffect(() => {
    if (selectedEdital) {
      fetchDisciplines(selectedEdital);
      setSelectedDiscipline('');
      setTopicsWithLinks([]);
    }
  }, [selectedEdital]);

  useEffect(() => {
    if (selectedDiscipline) {
      fetchTopicsWithLinks(selectedDiscipline);
    }
  }, [selectedDiscipline]);

  const fetchEditais = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('editals')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setEditais(data);
    }
    setLoading(false);
  };

  const fetchDisciplines = async (editalId: string) => {
    // 1. Fetch mandatory disciplines from edital_disciplines
    const { data: editalData } = await supabase
      .from('edital_disciplines')
      .select(`
        discipline_id,
        study_disciplines!inner(id, name)
      `)
      .eq('edital_id', editalId)
      .eq('is_active', true)
      .eq('is_mandatory', true);

    // 2. Fetch schools for this edital, then find standalone source disciplines
    const { data: schoolsData } = await supabase
      .from('schools')
      .select('id')
      .eq('edital_id', editalId)
      .eq('is_active', true);

    const disciplineMap = new Map<string, { id: string; name: string }>();

    if (editalData) {
      for (const d of editalData as any[]) {
        disciplineMap.set(d.study_disciplines.id, {
          id: d.study_disciplines.id,
          name: d.study_disciplines.name
        });
      }
    }

    if (schoolsData && schoolsData.length > 0) {
      const schoolIds = schoolsData.map(s => s.id);
      const { data: standaloneData } = await supabase
        .from('school_disciplines')
        .select(`
          discipline_id,
          study_disciplines!inner(id, name, is_source, generation_type)
        `)
        .in('school_id', schoolIds)
        .eq('is_active', true);

      if (standaloneData) {
        for (const d of standaloneData as any[]) {
          if (d.study_disciplines.generation_type === 'manual_standalone' && 
              d.study_disciplines.is_source &&
              !disciplineMap.has(d.study_disciplines.id)) {
            disciplineMap.set(d.study_disciplines.id, {
              id: d.study_disciplines.id,
              name: d.study_disciplines.name
            });
          }
        }
      }
    }

    const allDisciplines = Array.from(disciplineMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));
    setDisciplines(allDisciplines);
  };

  const fetchTopicsWithLinks = async (disciplineId: string) => {
    setLoadingTopics(true);
    
    const discipline = disciplines.find(d => d.id === disciplineId);
    
    // Fetch topics
    const { data: topicsData, error: topicsError } = await supabase
      .from('study_topics')
      .select('id, name')
      .eq('study_discipline_id', disciplineId)
      .eq('is_active', true)
      .order('display_order');

    if (topicsError || !topicsData) {
      setLoadingTopics(false);
      return;
    }

    // Fetch all links for these topics
    const topicIds = topicsData.map(t => t.id);
    const { data: linksData } = await supabase
      .from('pdf_material_topic_links')
      .select(`
        id,
        study_topic_id,
        pdf_material_id,
        auto_created_goal_id,
        pdf_materials!inner(name, total_study_minutes)
      `)
      .in('study_topic_id', topicIds)
      .eq('is_active', true);

    // Build topics with links
    const result: TopicWithLinks[] = topicsData.map(topic => {
      const topicLinks = (linksData || [])
        .filter((l: any) => l.study_topic_id === topic.id)
        .map((l: any) => ({
          id: l.id,
          pdf_material_id: l.pdf_material_id,
          auto_created_goal_id: l.auto_created_goal_id,
          pdf_name: l.pdf_materials.name,
          pdf_study_minutes: l.pdf_materials.total_study_minutes
        }));

      return {
        id: topic.id,
        name: topic.name,
        discipline_id: disciplineId,
        discipline_name: discipline?.name || '',
        links: topicLinks
      };
    });

    setTopicsWithLinks(result);
    setLoadingTopics(false);
  };

  const handleOpenSearchDialog = (topic: TopicWithLinks) => {
    setSelectedTopic({
      id: topic.id,
      name: topic.name,
      discipline_name: topic.discipline_name
    });
    setSelectedTopicPdfIds(topic.links.map(l => l.pdf_material_id));
    setSearchDialogOpen(true);
  };

  const handlePdfLinked = () => {
    // Refresh topics to show new link
    if (selectedDiscipline) {
      fetchTopicsWithLinks(selectedDiscipline);
    }
  };

  const handleRemoveLink = async (link: TopicLink) => {
    try {
      // Remove auto-created goal if exists
      if (link.auto_created_goal_id) {
        await supabase
          .from('topic_goals')
          .update({ is_active: false })
          .eq('id', link.auto_created_goal_id);
      }

      // Deactivate the link
      const { error } = await supabase
        .from('pdf_material_topic_links')
        .update({ is_active: false })
        .eq('id', link.id);

      if (error) throw error;

      toast.success('Vínculo removido!');
      
      // Refresh
      if (selectedDiscipline) {
        fetchTopicsWithLinks(selectedDiscipline);
      }
    } catch (error) {
      console.error('Error removing link:', error);
      toast.error('Erro ao remover vínculo');
    }
  };

  const formatStudyTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  const totalLinkedPdfs = topicsWithLinks.reduce((acc, t) => acc + t.links.length, 0);
  const topicsWithPdfs = topicsWithLinks.filter(t => t.links.length > 0).length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Vincular PDFs por Edital
          </CardTitle>
          <CardDescription>
            Selecione um edital e disciplina para vincular PDFs aos tópicos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <GraduationCap className="w-4 h-4" />
                Edital
              </Label>
              <Select value={selectedEdital} onValueChange={setSelectedEdital}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um edital..." />
                </SelectTrigger>
                <SelectContent>
                  {editais.map(edital => (
                    <SelectItem key={edital.id} value={edital.id}>
                      {edital.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4" />
                Disciplina
              </Label>
              <Select 
                value={selectedDiscipline} 
                onValueChange={setSelectedDiscipline}
                disabled={!selectedEdital}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedEdital ? "Selecione uma disciplina..." : "Escolha um edital primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {disciplines.map(disc => (
                    <SelectItem key={disc.id} value={disc.id}>
                      {disc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stats */}
          {selectedDiscipline && !loadingTopics && topicsWithLinks.length > 0 && (
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <Badge variant="secondary">
                {topicsWithLinks.length} tópicos
              </Badge>
              <Badge variant="outline">
                {topicsWithPdfs} com PDFs vinculados
              </Badge>
              <Badge>
                {totalLinkedPdfs} PDFs no total
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchTopicsWithLinks(selectedDiscipline)}
                className="ml-auto"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Topics list */}
          {loadingTopics ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !selectedDiscipline ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Selecione um edital e disciplina para ver os tópicos</p>
            </div>
          ) : topicsWithLinks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum tópico encontrado para esta disciplina</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Accordion type="multiple" className="space-y-2">
                {topicsWithLinks.map(topic => (
                  <AccordionItem 
                    key={topic.id} 
                    value={topic.id}
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3 flex-1">
                        <Target className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-left flex-1">{topic.name}</span>
                        {topic.links.length > 0 ? (
                          <Badge className="mr-2">
                            {topic.links.length} PDF{topic.links.length > 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="mr-2 text-muted-foreground">
                            Sem PDFs
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="space-y-3">
                        {/* Linked PDFs */}
                        {topic.links.length > 0 && (
                          <div className="space-y-2">
                            {topic.links.map(link => (
                              <div 
                                key={link.id}
                                className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-4 h-4 text-red-500 shrink-0" />
                                  <span className="truncate">{link.pdf_name}</span>
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {formatStudyTime(link.pdf_study_minutes)}
                                  </Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                                  onClick={() => handleRemoveLink(link)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Add PDF button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleOpenSearchDialog(topic)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Adicionar PDF
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <PdfSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        topic={selectedTopic}
        existingPdfIds={selectedTopicPdfIds}
        onPdfLinked={handlePdfLinked}
      />
    </>
  );
}
