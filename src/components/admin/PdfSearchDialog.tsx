import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  Search,
  FileText,
  Folder,
  Clock,
  Check,
  Plus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PdfMaterial {
  id: string;
  name: string;
  folder_id: string | null;
  total_study_minutes: number;
  folder_name?: string;
}

interface TopicInfo {
  id: string;
  name: string;
  discipline_name: string;
}

interface PdfSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: TopicInfo | null;
  existingPdfIds: string[];
  onPdfLinked: () => void;
}

export function PdfSearchDialog({ 
  open, 
  onOpenChange, 
  topic,
  existingPdfIds,
  onPdfLinked 
}: PdfSearchDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [materials, setMaterials] = useState<PdfMaterial[]>([]);

  useEffect(() => {
    if (open) {
      fetchMaterials();
      setSearchTerm('');
    }
  }, [open]);

  const fetchMaterials = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('pdf_materials')
      .select(`
        id,
        name,
        folder_id,
        total_study_minutes,
        pdf_material_folders(name)
      `)
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      const formatted = data.map((m: any) => ({
        id: m.id,
        name: m.name,
        folder_id: m.folder_id,
        total_study_minutes: m.total_study_minutes,
        folder_name: m.pdf_material_folders?.name
      }));
      setMaterials(formatted);
    }
    
    setLoading(false);
  };

  const filteredMaterials = materials.filter(m => {
    const search = searchTerm.toLowerCase();
    return (
      m.name.toLowerCase().includes(search) ||
      m.folder_name?.toLowerCase().includes(search)
    );
  });

  const handleLinkPdf = async (pdf: PdfMaterial) => {
    if (!topic) return;
    
    setSaving(pdf.id);

    try {
      // 1. Create the topic_goal for this PDF
      const { data: goalData, error: goalError } = await supabase
        .from('topic_goals')
        .insert({
          topic_id: topic.id,
          name: pdf.name,
          goal_type: 'pdf',
          duration_minutes: pdf.total_study_minutes,
          pdf_links: [{ pdf_material_id: pdf.id }],
          is_active: true
        })
        .select('id')
        .single();

      if (goalError) throw goalError;

      // 2. Create the link record
      const { error: linkError } = await supabase
        .from('pdf_material_topic_links')
        .insert({
          pdf_material_id: pdf.id,
          study_topic_id: topic.id,
          auto_created_goal_id: goalData.id
        });

      if (linkError) throw linkError;

      toast.success(`PDF "${pdf.name}" vinculado!`);
      onPdfLinked();
      
    } catch (error) {
      console.error('Error linking PDF:', error);
      toast.error('Erro ao vincular PDF');
    } finally {
      setSaving(null);
    }
  };

  const formatStudyTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  const isAlreadyLinked = (pdfId: string) => existingPdfIds.includes(pdfId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Buscar PDF para Vincular
          </DialogTitle>
          <DialogDescription asChild>
            <div>
              {topic && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="secondary">{topic.discipline_name}</Badge>
                  <span className="text-foreground font-medium">{topic.name}</span>
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou pasta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? 'Nenhum PDF encontrado' : 'Nenhum PDF disponível'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMaterials.map(pdf => {
                const linked = isAlreadyLinked(pdf.id);
                const isSaving = saving === pdf.id;
                
                return (
                  <div 
                    key={pdf.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      linked 
                        ? 'bg-muted/50 border-primary/30' 
                        : 'bg-card hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-destructive shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium break-words">{pdf.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {pdf.folder_name && (
                            <span className="flex items-center gap-1">
                              <Folder className="w-3 h-3" />
                              {pdf.folder_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatStudyTime(pdf.total_study_minutes)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex justify-end">
                      {linked ? (
                        <Badge variant="outline" className="text-primary border-primary">
                          <Check className="w-3 h-3 mr-1" />
                          Vinculado
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLinkPdf(pdf);
                          }}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-1" />
                              Vincular
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
