import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  Link2,
  Unlink,
  GraduationCap,
  BookOpen,
  Target,
  FileText,
  Clock,
  Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PdfMaterial {
  id: string;
  name: string;
  total_study_minutes: number;
}

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
}

interface TopicLink {
  id: string;
  study_topic_id: string;
  school_id: string | null;
  auto_created_goal_id: string | null;
  topic_name?: string;
  discipline_name?: string;
  edital_name?: string;
}

interface PdfTopicLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: PdfMaterial | null;
  onLinksChanged: () => void;
}

export function PdfTopicLinkDialog({ 
  open, 
  onOpenChange, 
  material,
  onLinksChanged 
}: PdfTopicLinkDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Existing links
  const [existingLinks, setExistingLinks] = useState<TopicLink[]>([]);
  
  // Cascading select data
  const [editais, setEditais] = useState<Edital[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  
  // Selected values
  const [selectedEdital, setSelectedEdital] = useState<string>('');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');

  useEffect(() => {
    if (open && material) {
      fetchEditais();
      fetchExistingLinks();
    }
  }, [open, material]);

  useEffect(() => {
    if (selectedEdital) {
      fetchDisciplines(selectedEdital);
      setSelectedDiscipline('');
      setSelectedTopic('');
      setTopics([]);
    }
  }, [selectedEdital]);

  useEffect(() => {
    if (selectedDiscipline) {
      fetchTopics(selectedDiscipline);
      setSelectedTopic('');
    }
  }, [selectedDiscipline]);

  const fetchEditais = async () => {
    const { data, error } = await supabase
      .from('editals')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setEditais(data);
    }
  };

  const fetchDisciplines = async (editalId: string) => {
    // Get mandatory disciplines linked to this edital
    const { data, error } = await supabase
      .from('edital_disciplines')
      .select(`
        discipline_id,
        study_disciplines!inner(id, name)
      `)
      .eq('edital_id', editalId)
      .eq('is_active', true)
      .eq('is_mandatory', true);

    if (!error && data) {
      const disciplines = data
        .map((d: any) => ({
          id: d.study_disciplines.id,
          name: d.study_disciplines.name
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setDisciplines(disciplines);
    }
  };

  const fetchTopics = async (disciplineId: string) => {
    const { data, error } = await supabase
      .from('study_topics')
      .select('id, name')
      .eq('study_discipline_id', disciplineId)
      .eq('is_active', true)
      .order('display_order');

    if (!error && data) {
      setTopics(data);
    }
  };

  const fetchExistingLinks = async () => {
    if (!material) return;
    
    setLoading(true);
    
    const { data, error } = await supabase
      .from('pdf_material_topic_links')
      .select(`
        id,
        study_topic_id,
        school_id,
        auto_created_goal_id,
        study_topics!inner(
          name,
          study_disciplines!inner(name)
        )
      `)
      .eq('pdf_material_id', material.id)
      .eq('is_active', true);

    if (!error && data) {
      const links: TopicLink[] = data.map((link: any) => ({
        id: link.id,
        study_topic_id: link.study_topic_id,
        school_id: link.school_id,
        auto_created_goal_id: link.auto_created_goal_id,
        topic_name: link.study_topics?.name,
        discipline_name: link.study_topics?.study_disciplines?.name
      }));
      setExistingLinks(links);
    }
    
    setLoading(false);
  };

  const handleAddLink = async () => {
    if (!material || !selectedTopic) {
      toast.error('Selecione um tópico');
      return;
    }

    // Check if link already exists
    const existingLink = existingLinks.find(
      l => l.study_topic_id === selectedTopic
    );
    
    if (existingLink) {
      toast.error('Este material já está vinculado a este tópico');
      return;
    }

    setSaving(true);

    try {
      // 1. Create the topic_goal for this PDF
      const { data: goalData, error: goalError } = await supabase
        .from('topic_goals')
        .insert({
          topic_id: selectedTopic,
          name: material.name,
          goal_type: 'pdf',
          duration_minutes: material.total_study_minutes,
          pdf_links: [{ pdf_material_id: material.id }],
          is_active: true
        })
        .select('id')
        .single();

      if (goalError) throw goalError;

      // 2. Create the link record (no school_id since we're using edital)
      const { error: linkError } = await supabase
        .from('pdf_material_topic_links')
        .insert({
          pdf_material_id: material.id,
          study_topic_id: selectedTopic,
          auto_created_goal_id: goalData.id
        });

      if (linkError) throw linkError;

      toast.success('Material vinculado com sucesso!');
      
      // Reset selections
      setSelectedEdital('');
      setSelectedDiscipline('');
      setSelectedTopic('');
      setDisciplines([]);
      setTopics([]);
      
      // Refresh links
      fetchExistingLinks();
      onLinksChanged();
      
    } catch (error) {
      console.error('Error linking PDF:', error);
      toast.error('Erro ao vincular material');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLink = async (link: TopicLink) => {
    try {
      // 1. Remove the auto-created goal if exists
      if (link.auto_created_goal_id) {
        await supabase
          .from('topic_goals')
          .update({ is_active: false })
          .eq('id', link.auto_created_goal_id);
      }

      // 2. Deactivate the link
      const { error } = await supabase
        .from('pdf_material_topic_links')
        .update({ is_active: false })
        .eq('id', link.id);

      if (error) throw error;

      toast.success('Vínculo removido!');
      fetchExistingLinks();
      onLinksChanged();
      
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Vincular a Tópicos
          </DialogTitle>
          <DialogDescription>
            {material && (
              <div className="flex items-center gap-2 mt-2">
                <FileText className="w-4 h-4 text-red-500" />
                <span className="font-medium">{material.name}</span>
                <Badge variant="outline" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatStudyTime(material.total_study_minutes)}
                </Badge>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add new link section */}
          <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Adicionar Novo Vínculo
            </h4>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1 mb-1.5">
                  <GraduationCap className="w-3 h-3" />
                  Edital
                </Label>
                <Select value={selectedEdital} onValueChange={setSelectedEdital}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione..." />
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
                <Label className="text-xs flex items-center gap-1 mb-1.5">
                  <BookOpen className="w-3 h-3" />
                  Disciplina Obrigatória
                </Label>
                <Select 
                  value={selectedDiscipline} 
                  onValueChange={setSelectedDiscipline}
                  disabled={!selectedEdital}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={selectedEdital ? "Selecione..." : "Escolha edital"} />
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

              <div>
                <Label className="text-xs flex items-center gap-1 mb-1.5">
                  <Target className="w-3 h-3" />
                  Tópico
                </Label>
                <Select 
                  value={selectedTopic} 
                  onValueChange={setSelectedTopic}
                  disabled={!selectedDiscipline}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={selectedDiscipline ? "Selecione..." : "Escolha disciplina"} />
                  </SelectTrigger>
                  <SelectContent>
                    {topics.map(topic => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={handleAddLink} 
              disabled={!selectedTopic || saving}
              className="w-full"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Vincular ao Tópico
            </Button>
          </div>

          {/* Existing links */}
          <div>
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <Unlink className="w-4 h-4" />
              Vínculos Existentes ({existingLinks.length})
            </h4>

            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : existingLinks.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg">
                Nenhum vínculo ainda. Adicione um acima.
              </div>
            ) : (
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {existingLinks.map(link => (
                    <div 
                      key={link.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            <BookOpen className="w-3 h-3 mr-1" />
                            {link.discipline_name}
                          </Badge>
                          <Badge className="text-xs">
                            <Target className="w-3 h-3 mr-1" />
                            {link.topic_name}
                          </Badge>
                        </div>
                        {link.auto_created_goal_id && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Meta de estudo criada automaticamente
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveLink(link)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
