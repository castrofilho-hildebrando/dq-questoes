import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
  Search,
  GraduationCap,
  Calendar,
  Eye,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────

interface Edital {
  id: string;
  name: string;
}

interface School {
  id: string;
  name: string;
  edital_id: string | null;
}

interface TopicDraft {
  tempId: string;
  name: string;
  description: string;
  pdfLinks: PdfLinkDraft[];
  revisions: RevisionDraft;
}

interface PdfLinkDraft {
  pdfMaterialId: string;
  pdfName: string;
  durationMinutes: number;
}

interface RevisionDraft {
  revision_1_days: number | null;
  revision_2_days: number | null;
  revision_3_days: number | null;
  revision_4_days: number | null;
  revision_5_days: number | null;
  revision_6_days: number | null;
}

interface PdfMaterial {
  id: string;
  name: string;
  total_pages: number | null;
  total_study_minutes: number;
  folder_id: string | null;
}

interface PdfFolder {
  id: string;
  name: string;
  parent_folder_id: string | null;
}

const DEFAULT_REVISIONS: RevisionDraft = {
  revision_1_days: 1,
  revision_2_days: 3,
  revision_3_days: 7,
  revision_4_days: 14,
  revision_5_days: 30,
  revision_6_days: null,
};

const STEPS = [
  { label: 'Edital', icon: GraduationCap },
  { label: 'Disciplina & Tópicos', icon: BookOpen },
  { label: 'PDFs', icon: FileText },
  { label: 'Revisões', icon: Calendar },
  { label: 'Confirmar', icon: Check },
];

// ── Component ──────────────────────────────────────────

export function AdminDisciplinaAvulsa() {
  const [step, setStep] = useState(0);

  // Step 1 - Edital
  const [editais, setEditais] = useState<Edital[]>([]);
  const [selectedEditalId, setSelectedEditalId] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [loadingEditais, setLoadingEditais] = useState(true);

  // Step 2 - Discipline + Topics
  const [disciplineName, setDisciplineName] = useState('');
  const [topics, setTopics] = useState<TopicDraft[]>([]);
  const [newTopicName, setNewTopicName] = useState('');

  // Step 3 - PDFs
  const [pdfMaterials, setPdfMaterials] = useState<PdfMaterial[]>([]);
  const [pdfFolders, setPdfFolders] = useState<PdfFolder[]>([]);
  const [pdfSearchTerm, setPdfSearchTerm] = useState('');
  const [selectedTopicForPdf, setSelectedTopicForPdf] = useState<string>('');
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadStudyMinutes, setUploadStudyMinutes] = useState(60);
  const [uploadTotalPages, setUploadTotalPages] = useState<number | ''>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 4 - Revisions (already in topics state)

  // Step 5 - Confirm
  const [applying, setApplying] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // ── Data Loading ──────────────────────────────────────

  useEffect(() => {
    loadEditais();
    loadPdfData();
  }, []);

  useEffect(() => {
    if (selectedEditalId) {
      loadSchools(selectedEditalId);
    }
  }, [selectedEditalId]);

  const loadEditais = async () => {
    setLoadingEditais(true);
    const { data } = await supabase
      .from('editals')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    setEditais(data || []);
    setLoadingEditais(false);
  };

  const loadSchools = async (editalId: string) => {
    const { data } = await supabase
      .from('schools')
      .select('id, name, edital_id')
      .eq('edital_id', editalId)
      .eq('is_active', true)
      .order('name');
    setSchools(data || []);
  };

  const loadPdfData = async () => {
    const [materialsRes, foldersRes] = await Promise.all([
      supabase.from('pdf_materials').select('id, name, total_pages, total_study_minutes, folder_id').eq('is_active', true).order('name'),
      supabase.from('pdf_material_folders').select('id, name, parent_folder_id').eq('is_active', true).order('name'),
    ]);
    setPdfMaterials(materialsRes.data || []);
    setPdfFolders(foldersRes.data || []);
  };

  // ── Step 2 Handlers ──────────────────────────────────

  const addTopic = () => {
    if (!newTopicName.trim()) return;
    setTopics(prev => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        name: newTopicName.trim(),
        description: '',
        pdfLinks: [],
        revisions: { ...DEFAULT_REVISIONS },
      },
    ]);
    setNewTopicName('');
  };

  const removeTopic = (tempId: string) => {
    setTopics(prev => prev.filter(t => t.tempId !== tempId));
  };

  const updateTopicDescription = (tempId: string, desc: string) => {
    setTopics(prev => prev.map(t => t.tempId === tempId ? { ...t, description: desc } : t));
  };

  // ── Step 3 Handlers (PDFs) ───────────────────────────

  const openPdfSelector = (topicTempId: string) => {
    setSelectedTopicForPdf(topicTempId);
    setPdfSearchTerm('');
    setPdfDialogOpen(true);
  };

  const filteredPdfs = pdfMaterials.filter(m =>
    m.name.toLowerCase().includes(pdfSearchTerm.toLowerCase())
  );

  const addPdfToTopic = (pdf: PdfMaterial) => {
    setTopics(prev => prev.map(t => {
      if (t.tempId !== selectedTopicForPdf) return t;
      if (t.pdfLinks.some(l => l.pdfMaterialId === pdf.id)) return t;
      return {
        ...t,
        pdfLinks: [...t.pdfLinks, {
          pdfMaterialId: pdf.id,
          pdfName: pdf.name,
          durationMinutes: pdf.total_study_minutes || 60,
        }],
      };
    }));
  };

  const removePdfFromTopic = (topicTempId: string, pdfMaterialId: string) => {
    setTopics(prev => prev.map(t => {
      if (t.tempId !== topicTempId) return t;
      return { ...t, pdfLinks: t.pdfLinks.filter(l => l.pdfMaterialId !== pdfMaterialId) };
    }));
  };

  const updatePdfDuration = (topicTempId: string, pdfMaterialId: string, minutes: number) => {
    setTopics(prev => prev.map(t => {
      if (t.tempId !== topicTempId) return t;
      return {
        ...t,
        pdfLinks: t.pdfLinks.map(l => l.pdfMaterialId === pdfMaterialId ? { ...l, durationMinutes: minutes } : l),
      };
    }));
  };

  // Upload new PDF
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Apenas arquivos PDF são permitidos');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Arquivo muito grande (máximo 50MB)');
        return;
      }
      setSelectedFile(file);
      if (!uploadFileName) setUploadFileName(file.name.replace('.pdf', ''));
    }
  };

  const handleUploadPdf = async () => {
    if (!selectedFile || !uploadFileName.trim()) {
      toast.error('Preencha o nome e selecione um arquivo');
      return;
    }

    setUploadingFile(true);
    try {
      const timestamp = Date.now();
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${timestamp}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('pdf-materials')
        .upload(filePath, selectedFile, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('pdf-materials').getPublicUrl(filePath);

      const { data: newMaterial, error: insertError } = await supabase
        .from('pdf_materials')
        .insert({
          name: uploadFileName.trim(),
          current_file_url: urlData.publicUrl,
          total_study_minutes: uploadStudyMinutes,
          total_pages: uploadTotalPages || null,
          current_version: 1,
        })
        .select('id, name, total_pages, total_study_minutes, folder_id')
        .single();

      if (insertError || !newMaterial) throw insertError;

      // Create initial version
      await supabase.from('pdf_material_versions').insert({
        pdf_material_id: newMaterial.id,
        version_number: 1,
        file_url: urlData.publicUrl,
        total_pages: uploadTotalPages || null,
        change_notes: 'Versão inicial',
      });

      // Add to local state and auto-link to current topic
      setPdfMaterials(prev => [...prev, newMaterial]);

      if (selectedTopicForPdf) {
        setTopics(prev => prev.map(t => {
          if (t.tempId !== selectedTopicForPdf) return t;
          return {
            ...t,
            pdfLinks: [...t.pdfLinks, {
              pdfMaterialId: newMaterial.id,
              pdfName: newMaterial.name,
              durationMinutes: newMaterial.total_study_minutes || 60,
            }],
          };
        }));
      }

      toast.success('PDF enviado e vinculado com sucesso!');
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadFileName('');
      setUploadStudyMinutes(60);
      setUploadTotalPages('');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar PDF');
    } finally {
      setUploadingFile(false);
    }
  };

  // ── Step 4 Handlers (Revisions) ──────────────────────

  const updateRevision = (topicTempId: string, field: keyof RevisionDraft, value: number | null) => {
    setTopics(prev => prev.map(t => {
      if (t.tempId !== topicTempId) return t;
      return { ...t, revisions: { ...t.revisions, [field]: value } };
    }));
  };

  const applyRevisionsToAll = (sourceTopicTempId: string) => {
    const source = topics.find(t => t.tempId === sourceTopicTempId);
    if (!source) return;
    setTopics(prev => prev.map(t => ({ ...t, revisions: { ...source.revisions } })));
    toast.success('Revisões aplicadas a todos os tópicos');
  };

  // ── Step 5: Apply ────────────────────────────────────

  const handleApply = async () => {
    setApplying(true);
    try {
      // 1. Create discipline
      const { data: discipline, error: discError } = await supabase
        .from('study_disciplines')
        .insert({
          name: disciplineName.trim(),
          generation_type: 'manual_standalone',
          is_source: true,
          is_active: true,
          is_auto_generated: false,
        })
        .select('id')
        .single();

      if (discError || !discipline) throw discError || new Error('Failed to create discipline');

      // 2. Create topics
      const topicInserts = topics.map((t, idx) => ({
        name: t.name,
        description: t.description || null,
        study_discipline_id: discipline.id,
        display_order: idx,
        is_active: true,
        is_source: true,
        generation_type: 'manual_standalone',
      }));

      const { data: createdTopics, error: topicsError } = await supabase
        .from('study_topics')
        .insert(topicInserts)
        .select('id, name');

      if (topicsError || !createdTopics) throw topicsError || new Error('Failed to create topics');

      // Map tempId → realId by order
      const topicIdMap = new Map<string, string>();
      topics.forEach((draft, idx) => {
        if (createdTopics[idx]) {
          topicIdMap.set(draft.tempId, createdTopics[idx].id);
        }
      });

      // 3. Create topic goals (pdf_reading) for each topic
      const goalInserts: any[] = [];
      const pdfLinkInserts: any[] = [];

      for (const draft of topics) {
        const realTopicId = topicIdMap.get(draft.tempId);
        if (!realTopicId) continue;

        for (const pdfLink of draft.pdfLinks) {
          const goalName = `Leitura: ${pdfLink.pdfName}`;
          goalInserts.push({
            topic_id: realTopicId,
            name: goalName,
            goal_type: 'pdf_reading',
            duration_minutes: pdfLink.durationMinutes,
            pdf_links: [{ pdf_material_id: pdfLink.pdfMaterialId, name: pdfLink.pdfName }],
            is_active: true,
            display_order: goalInserts.length,
          });

          pdfLinkInserts.push({
            pdf_material_id: pdfLink.pdfMaterialId,
            study_topic_id: realTopicId,
          });
        }

        // If no PDFs, create a generic study goal
        if (draft.pdfLinks.length === 0) {
          goalInserts.push({
            topic_id: realTopicId,
            name: `Estudo: ${draft.name}`,
            goal_type: 'study',
            duration_minutes: 60,
            is_active: true,
            display_order: goalInserts.length,
          });
        }
      }

      if (goalInserts.length > 0) {
        const { error: goalsError } = await supabase.from('topic_goals').insert(goalInserts);
        if (goalsError) throw goalsError;
      }

      if (pdfLinkInserts.length > 0) {
        const { error: linksError } = await supabase.from('pdf_material_topic_links').insert(pdfLinkInserts);
        if (linksError) throw linksError;
      }

      // 4. Create topic revisions
      const revisionInserts = topics.map(draft => {
        const realTopicId = topicIdMap.get(draft.tempId)!;
        return {
          topic_id: realTopicId,
          ...draft.revisions,
          is_active: true,
        };
      }).filter(r => r.topic_id);

      if (revisionInserts.length > 0) {
        const { error: revError } = await supabase.from('topic_revisions').insert(revisionInserts);
        if (revError) throw revError;
      }

      // 5. Add discipline to all schools of the edital
      let successCount = 0;
      let errorCount = 0;

      for (const school of schools) {
        try {
          const { error: rpcError } = await supabase.rpc('add_source_disciplines_to_school', {
            p_school_id: school.id,
            p_discipline_ids: [discipline.id],
          });
          if (rpcError) {
            console.error(`Error adding to school ${school.name}:`, rpcError);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(`Error adding to school ${school.name}:`, err);
          errorCount++;
        }
      }

      if (errorCount > 0) {
        toast.warning(`Disciplina criada. ${successCount} escola(s) atualizadas, ${errorCount} com erro.`);
      } else {
        toast.success(`Disciplina "${disciplineName}" criada e adicionada a ${successCount} escola(s)! Os cronogramas serão atualizados no próximo recálculo.`);
      }

      // Reset wizard
      setStep(0);
      setDisciplineName('');
      setTopics([]);
      setSelectedEditalId('');
      setSchools([]);
      setConfirmDialogOpen(false);
    } catch (error) {
      console.error('Error applying standalone discipline:', error);
      toast.error('Erro ao criar disciplina avulsa');
    } finally {
      setApplying(false);
    }
  };

  // ── Validation ───────────────────────────────────────

  const canGoToStep = (targetStep: number): boolean => {
    if (targetStep <= 0) return true;
    if (targetStep === 1) return !!selectedEditalId && schools.length > 0;
    if (targetStep === 2) return !!disciplineName.trim() && topics.length > 0;
    if (targetStep === 3) return true; // PDFs are optional
    if (targetStep === 4) return true; // Revisions have defaults
    return true;
  };

  const getStepError = (targetStep: number): string | null => {
    if (targetStep === 1 && !selectedEditalId) return 'Selecione um edital';
    if (targetStep === 1 && schools.length === 0) return 'Nenhuma escola encontrada para este edital';
    if (targetStep === 2 && !disciplineName.trim()) return 'Informe o nome da disciplina';
    if (targetStep === 2 && topics.length === 0) return 'Adicione pelo menos um tópico';
    return null;
  };

  const handleNext = () => {
    const error = getStepError(step + 1);
    if (error) {
      toast.error(error);
      return;
    }
    if (canGoToStep(step + 1)) setStep(step + 1);
  };

  // ── Render ───────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Progress Stepper */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Criar Disciplina Avulsa
          </CardTitle>
          <CardDescription>
            Crie uma disciplina com metas de estudo e adicione-a a todas as escolas de um edital
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {STEPS.map((s, idx) => {
              const StepIcon = s.icon;
              const isActive = idx === step;
              const isDone = idx < step;
              return (
                <div key={idx} className="flex items-center gap-2">
                  {idx > 0 && <div className={`h-px w-6 ${isDone ? 'bg-primary' : 'bg-border'}`} />}
                  <button
                    onClick={() => canGoToStep(idx) && setStep(idx)}
                    disabled={!canGoToStep(idx) && idx > step}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : isDone
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <StepIcon className="h-3.5 w-3.5" />
                    {s.label}
                  </button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step 0: Select Edital */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>1. Selecionar Edital</CardTitle>
            <CardDescription>A disciplina será adicionada a todas as escolas deste edital</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingEditais ? (
              <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
            ) : (
              <>
                <Select value={selectedEditalId} onValueChange={setSelectedEditalId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um edital..." />
                  </SelectTrigger>
                  <SelectContent>
                    {editais.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedEditalId && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Escolas vinculadas ({schools.length})</Label>
                    {schools.length === 0 ? (
                      <p className="text-sm text-destructive">Nenhuma escola encontrada para este edital.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {schools.map(s => (
                          <Badge key={s.id} variant="secondary">{s.name}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 1: Discipline Name + Topics */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Disciplina e Tópicos</CardTitle>
            <CardDescription>Crie a disciplina e seus tópicos de estudo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Nome da Disciplina</Label>
              <Input
                value={disciplineName}
                onChange={e => setDisciplineName(e.target.value)}
                placeholder="Ex: Legislação Especial"
              />
            </div>

            <div className="space-y-3">
              <Label>Tópicos</Label>
              <div className="flex gap-2">
                <Input
                  value={newTopicName}
                  onChange={e => setNewTopicName(e.target.value)}
                  placeholder="Nome do tópico"
                  onKeyDown={e => e.key === 'Enter' && addTopic()}
                />
                <Button onClick={addTopic} disabled={!newTopicName.trim()}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>

              {topics.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum tópico adicionado.</p>
              ) : (
                <div className="space-y-3">
                  {topics.map((topic, idx) => (
                    <div key={topic.tempId} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{idx + 1}. {topic.name}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeTopic(topic.tempId)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <Textarea
                        value={topic.description}
                        onChange={e => updateTopicDescription(topic.tempId, e.target.value)}
                        placeholder="Descrição (opcional)"
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: PDFs */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Vincular PDFs aos Tópicos</CardTitle>
            <CardDescription>Adicione materiais PDF existentes ou faça upload de novos para cada tópico</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topics.map((topic, idx) => (
              <div key={topic.tempId} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{idx + 1}. {topic.name}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      setSelectedTopicForPdf(topic.tempId);
                      setUploadDialogOpen(true);
                    }}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> Enviar PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openPdfSelector(topic.tempId)}>
                      <Search className="h-3.5 w-3.5 mr-1" /> Selecionar Existente
                    </Button>
                  </div>
                </div>

                {topic.pdfLinks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum PDF vinculado. (Será criada uma meta genérica de estudo)</p>
                ) : (
                  <div className="space-y-2">
                    {topic.pdfLinks.map(pdf => (
                      <div key={pdf.pdfMaterialId} className="flex items-center gap-3 bg-muted/50 rounded-md px-3 py-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm flex-1 truncate">{pdf.pdfName}</span>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={pdf.durationMinutes}
                            onChange={e => updatePdfDuration(topic.tempId, pdf.pdfMaterialId, Number(e.target.value))}
                            className="w-20 h-8 text-sm"
                            min={1}
                          />
                          <span className="text-xs text-muted-foreground">min</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePdfFromTopic(topic.tempId, pdf.pdfMaterialId)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Revisions */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>4. Configurar Revisões</CardTitle>
            <CardDescription>Defina os intervalos de revisão em dias para cada tópico</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topics.map((topic, idx) => (
              <div key={topic.tempId} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{idx + 1}. {topic.name}</span>
                  <Button size="sm" variant="outline" onClick={() => applyRevisionsToAll(topic.tempId)}>
                    Aplicar a todos
                  </Button>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {([1, 2, 3, 4, 5, 6] as const).map(num => {
                    const field = `revision_${num}_days` as keyof RevisionDraft;
                    return (
                      <div key={num} className="space-y-1">
                        <Label className="text-xs">Rev. {num}</Label>
                        <Input
                          type="number"
                          value={topic.revisions[field] ?? ''}
                          onChange={e => {
                            const val = e.target.value === '' ? null : Number(e.target.value);
                            updateRevision(topic.tempId, field, val);
                          }}
                          className="h-8 text-sm"
                          placeholder="—"
                          min={1}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>5. Revisar e Confirmar</CardTitle>
            <CardDescription>Verifique os dados antes de aplicar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Edital</Label>
                <p className="text-sm">{editais.find(e => e.id === selectedEditalId)?.name}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Escolas ({schools.length})</Label>
                <div className="flex flex-wrap gap-1">
                  {schools.map(s => <Badge key={s.id} variant="outline" className="text-xs">{s.name}</Badge>)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Disciplina</Label>
              <p className="text-sm font-semibold">{disciplineName}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Tópicos ({topics.length})</Label>
              <div className="space-y-2">
                {topics.map((t, idx) => (
                  <div key={t.tempId} className="border rounded-md p-3 text-sm space-y-1">
                    <p className="font-medium">{idx + 1}. {t.name}</p>
                    {t.description && <p className="text-muted-foreground text-xs">{t.description}</p>}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {t.pdfLinks.map(pdf => (
                        <Badge key={pdf.pdfMaterialId} variant="secondary" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" />{pdf.pdfName} ({pdf.durationMinutes}min)
                        </Badge>
                      ))}
                      {t.pdfLinks.length === 0 && <Badge variant="outline" className="text-xs">Meta genérica (60min)</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Revisões: {[1, 2, 3, 4, 5, 6].map(n => {
                        const v = t.revisions[`revision_${n}_days` as keyof RevisionDraft];
                        return v ? `R${n}:${v}d` : null;
                      }).filter(Boolean).join(', ') || 'Nenhuma'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-200">⚠️ Atenção</p>
              <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                Ao confirmar, a disciplina será criada e adicionada a {schools.length} escola(s). 
                Os cronogramas dos alunos serão marcados para recálculo. As tarefas aparecerão após um recálculo (manual ou automático).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Anterior
        </Button>
        {step < 4 ? (
          <Button onClick={handleNext}>
            Próximo <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={() => setConfirmDialogOpen(true)} disabled={applying}>
            {applying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            Aplicar Disciplina
          </Button>
        )}
      </div>

      {/* PDF Selector Dialog */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Selecionar PDF Existente</DialogTitle>
            <DialogDescription>Busque e selecione materiais PDF já cadastrados</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={pdfSearchTerm}
                onChange={e => setPdfSearchTerm(e.target.value)}
                placeholder="Buscar por nome..."
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-64">
              <div className="space-y-1">
                {filteredPdfs.map(pdf => {
                  const topic = topics.find(t => t.tempId === selectedTopicForPdf);
                  const isLinked = topic?.pdfLinks.some(l => l.pdfMaterialId === pdf.id);
                  return (
                    <button
                      key={pdf.id}
                      onClick={() => !isLinked && addPdfToTopic(pdf)}
                      disabled={isLinked}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                        isLinked
                          ? 'bg-primary/10 text-primary cursor-default'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {isLinked ? <Check className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span className="truncate flex-1">{pdf.name}</span>
                      <span className="text-xs text-muted-foreground">{pdf.total_study_minutes}min</span>
                    </button>
                  );
                })}
                {filteredPdfs.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum PDF encontrado</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload PDF Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Novo PDF</DialogTitle>
            <DialogDescription>Faça upload de um novo material PDF</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Arquivo PDF</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {selectedFile ? selectedFile.name : 'Selecionar arquivo'}
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Nome do Material</Label>
              <Input value={uploadFileName} onChange={e => setUploadFileName(e.target.value)} placeholder="Nome do PDF" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tempo de Estudo (min)</Label>
                <Input type="number" value={uploadStudyMinutes} onChange={e => setUploadStudyMinutes(Number(e.target.value))} min={1} />
              </div>
              <div className="space-y-2">
                <Label>Total de Páginas</Label>
                <Input type="number" value={uploadTotalPages} onChange={e => setUploadTotalPages(e.target.value ? Number(e.target.value) : '')} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUploadPdf} disabled={uploadingFile || !selectedFile || !uploadFileName.trim()}>
              {uploadingFile ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Criação</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a criar a disciplina "{disciplineName}" com {topics.length} tópico(s) e adicioná-la a {schools.length} escola(s) do edital. 
              Os cronogramas dos alunos serão marcados para recálculo. Esta ação não pode ser desfeita facilmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApply} disabled={applying}>
              {applying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar e Aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
