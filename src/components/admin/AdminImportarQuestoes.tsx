import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileJson,
  Eye,
  Upload,
  Info,
  Copy,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DisciplineOption {
  id: string;
  name: string;
  is_source: boolean;
}

interface StudyTopic {
  id: string;
  name: string;
  study_discipline_id: string;
}

interface ImportStats {
  success: boolean;
  dry_run: boolean;
  topic_id: string;
  topic_name: string;
  discipline_name: string;
  notebook_id: string | null;
  total_received: number;
  inserted: number;
  updated: number;
  duplicates: number;
  errors: number;
  error_messages: string[];
  error?: string;
}

interface ParsedQuestion {
  question: string;
  associated_text?: string;
  answer: string;
  prof_comment: string;
  question_type: string;
  images: string[];
  banca: string;
  orgao: string;
  prova: string;
  ano: string;
  year?: number;
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
    e: string;
  };
  // V2 fields
  external_code?: string;
  prof_comment_json?: Record<string, unknown>;
  prof_comment_citations?: string[];
  prof_comment_videos?: string[];
}

// Normalize the answer field to just letter format
const normalizeAnswer = (answer: unknown, questionType: string): string => {
  if (answer === null || answer === undefined) return '';
  
  const answerStr = String(answer).trim();
  if (answerStr === '') return '';
  
  const cleanAnswer = answerStr.toUpperCase();
  
  // For certo/errado questions
  if (questionType === 'certo_errado' || questionType === 'ce' || questionType === 'tf') {
    if (cleanAnswer.includes('CERTO') || cleanAnswer === 'C') return 'C';
    if (cleanAnswer.includes('ERRADO') || cleanAnswer === 'E') return 'E';
    const match = cleanAnswer.match(/[CE]/);
    if (match) return match[0];
    return cleanAnswer;
  }
  
  // For multiple choice
  if (/^[A-E]$/i.test(cleanAnswer)) return cleanAnswer;
  
  const labeledMatch = cleanAnswer.match(/(?:LETRA|ALTERNATIVA|RESPOSTA|GABARITO)[:\s]*([A-E])/i);
  if (labeledMatch) return labeledMatch[1];
  
  const prefixMatch = cleanAnswer.match(/^([A-E])[).:\s]/i);
  if (prefixMatch) return prefixMatch[1];
  
  const wordBoundaryMatch = cleanAnswer.match(/\b([A-E])\b/);
  if (wordBoundaryMatch) return wordBoundaryMatch[1];
  
  const anyLetterMatch = cleanAnswer.match(/([A-E])/i);
  if (anyLetterMatch) return anyLetterMatch[1].toUpperCase();
  
  return cleanAnswer;
};

// Extract answer from prof_comment when answer field is empty
const extractAnswerFromProfComment = (profComment: string, questionType: string): string => {
  if (!profComment || profComment.trim() === '') return '';
  const text = profComment.replace(/<[^>]*>/g, ' ').trim();
  
  if (questionType === 'tf' || questionType === 'ce' || questionType === 'certo_errado') {
    const ceMatch = text.match(/(?:Gabarito|Resposta)[:\s]*(Certo|Errado)/i);
    if (ceMatch) return ceMatch[1].charAt(0).toUpperCase();
    return '';
  }
  
  const gabMatch = text.match(/(?:Gabarito|Resposta)\s*(?:Letra\s*)?([A-E])/i);
  if (gabMatch) return gabMatch[1].toUpperCase();
  const letraMatch = text.match(/Letra\s+([A-E])\s*$/i);
  if (letraMatch) return letraMatch[1].toUpperCase();
  return '';
};

export function AdminImportarQuestoes() {
  // Data states
  const [disciplines, setDisciplines] = useState<DisciplineOption[]>([]);
  const [topics, setTopics] = useState<StudyTopic[]>([]);
  const [editals, setEditals] = useState<{ id: string; name: string }[]>([]);
  const [importMode, setImportMode] = useState<'source' | 'derived' | 'copy_from_source'>('source');
  
  // Selection states
  const [selectedEditalId, setSelectedEditalId] = useState<string>('');
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');

  // Input state
  const [jsonInput, setJsonInput] = useState<string>('');
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  
  // Copy-from-source states
  const [sourceDisciplines, setSourceDisciplines] = useState<DisciplineOption[]>([]);
  const [sourceTopics, setSourceTopics] = useState<StudyTopic[]>([]);
  const [selectedSourceDisciplineId, setSelectedSourceDisciplineId] = useState<string>('');
  const [selectedSourceTopicId, setSelectedSourceTopicId] = useState<string>('');
  const [isCopying, setIsCopying] = useState(false);
  const [copyResult, setCopyResult] = useState<any>(null);

  // Import states
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] = useState<ImportStats | null>(null);
  const [importResult, setImportResult] = useState<ImportStats | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [preSelectApplied, setPreSelectApplied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (importMode === 'source') {
      fetchDisciplines();
    } else if (importMode === 'derived') {
      fetchEditals();
      setDisciplines([]);
      setSelectedDisciplineId('');
      setSelectedTopicId('');
    } else if (importMode === 'copy_from_source') {
      // Need both: source disciplines + edital-based target
      fetchSourceDisciplines();
      fetchEditals();
      setDisciplines([]);
      setSelectedDisciplineId('');
      setSelectedTopicId('');
      setSelectedSourceDisciplineId('');
      setSelectedSourceTopicId('');
      setCopyResult(null);
    }
  }, [importMode]);

  useEffect(() => {
    if (selectedSourceDisciplineId) {
      fetchSourceTopics(selectedSourceDisciplineId);
    } else {
      setSourceTopics([]);
      setSelectedSourceTopicId('');
    }
  }, [selectedSourceDisciplineId]);

  useEffect(() => {
    if ((importMode === 'derived' || importMode === 'copy_from_source') && selectedEditalId) {
      fetchDerivedDisciplines(selectedEditalId);
    }
  }, [selectedEditalId]);

  useEffect(() => {
    if (selectedDisciplineId) {
      fetchTopics(selectedDisciplineId);
    } else {
      setTopics([]);
      setSelectedTopicId('');
    }
  }, [selectedDisciplineId]);

  // Parse JSON when input changes
  useEffect(() => {
    if (!jsonInput.trim()) {
      setParsedQuestions([]);
      setParseError(null);
      setValidationResult(null);
      setImportResult(null);
      return;
    }

    try {
      let data = JSON.parse(jsonInput);
      
      // Support both { questions: [...] } and direct array
      let questionsArray: any[] = [];
      if (Array.isArray(data)) {
        questionsArray = data;
      } else if (data.questions && Array.isArray(data.questions)) {
        questionsArray = data.questions;
      } else {
        throw new Error('JSON deve ser um array ou objeto com propriedade "questions"');
      }

      // Parse and normalize questions
      const normalized: ParsedQuestion[] = questionsArray.map((q: any) => {
        const rawType = (q.question_type || '').toLowerCase();
        const questionType = (rawType === 'ce' || rawType === 'tf' || rawType === 'certo_errado' || rawType === 'true_false') 
          ? 'tf' 
          : 'mult';

        const questionText = typeof q.question === 'string' ? q.question.trim() : '';
        const questionHtml = typeof q.question_html === 'string' ? q.question_html.trim() : '';
        const associatedText = typeof q.associated_text === 'string' ? q.associated_text : '';
        const associatedTextHtml = typeof q.associated_text_html === 'string' ? q.associated_text_html : '';

        const normalizedQuestion = questionText.length > 0 ? q.question : questionHtml;
        const normalizedAssociatedText = associatedText.length > 0 ? associatedText : associatedTextHtml;
        
        const rawAnswer = q.answer ?? q.gabarito ?? q.resposta ?? q.correct_answer ?? q.correctAnswer ?? '';
        let normalizedAnswer = normalizeAnswer(rawAnswer, rawType);
        
        // Same logic as AdminImportarMassa (ZIP import)
        const profCommentRaw = q.prof_comment;
        const profCommentText = typeof profCommentRaw === 'string' ? profCommentRaw : '';
        if (!normalizedAnswer && profCommentText) {
          normalizedAnswer = extractAnswerFromProfComment(profCommentText, questionType);
        }

        // V2: structured prof_comment (JSONB)
        const profCommentJson = (typeof profCommentRaw === 'object' && profCommentRaw !== null) ? profCommentRaw : undefined;

        return {
          question: normalizedQuestion,
          associated_text: normalizedAssociatedText,
          answer: normalizedAnswer,
          prof_comment: profCommentText,
          question_type: questionType,
          images: q.image || q.images || [],
          banca: q.banca || '',
          orgao: q.orgao || '',
          prova: q.prova || '',
          ano: q.ano || '',
          year: q.ano ? parseInt(String(q.ano)) : (q.year || null),
          options: {
            a: q.aa_tag || q.aa || q.option_a || '',
            b: q.ab_tag || q.ab || q.option_b || '',
            c: q.ac_tag || q.ac || q.option_c || '',
            d: q.ad_tag || q.ad || q.option_d || '',
            e: q.ae_tag || q.ae || q.option_e || '',
          },
          // V2 fields
          external_code: q.external_code || q.codigo_externo || undefined,
          prof_comment_json: profCommentJson,
          prof_comment_citations: Array.isArray(q.prof_comment_citations) ? q.prof_comment_citations : undefined,
          prof_comment_videos: Array.isArray(q.prof_comment_videos) ? q.prof_comment_videos : undefined,
        };
      });

      setParsedQuestions(normalized);
      setParseError(null);
      setValidationResult(null);
      setImportResult(null);
    } catch (error: any) {
      setParsedQuestions([]);
      setParseError(error.message || 'Erro ao interpretar JSON');
    }
  }, [jsonInput]);

  const fetchDisciplines = async () => {
    setLoading(true);
    setSelectedDisciplineId('');
    setSelectedTopicId('');
    
    let query = supabase
      .from('study_disciplines')
      .select('id, name, is_source')
      .eq('is_active', true);

    if (importMode === 'source') {
      query = query.eq('is_source', true).eq('generation_type', 'zip_import');
    } else {
      query = query.eq('is_source', false);
    }

    const { data, error } = await query.order('name');

    if (error) {
      toast.error('Erro ao carregar disciplinas');
      console.error(error);
    }
    
    setDisciplines((data || []).map(d => ({ id: d.id, name: d.name, is_source: d.is_source ?? false })));
    setLoading(false);
  };

  const fetchEditals = async () => {
    setLoading(true);
    setSelectedEditalId('');
    setSelectedDisciplineId('');
    setSelectedTopicId('');

    const { data, error } = await supabase
      .from('editals')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (error) {
      toast.error('Erro ao carregar editais');
      console.error(error);
    }

    setEditals(data || []);
    setLoading(false);
  };

  const fetchDerivedDisciplines = async (editalId: string) => {
    setSelectedDisciplineId('');
    setSelectedTopicId('');

    const { data, error } = await supabase
      .from('edital_disciplines')
      .select('discipline_id, study_disciplines!inner(id, name, is_source)')
      .eq('edital_id', editalId)
      .eq('is_active', true)
      .eq('study_disciplines.is_active', true);

    if (error) {
      toast.error('Erro ao carregar disciplinas do edital');
      console.error(error);
      setDisciplines([]);
      return;
    }

    const discList = (data || [])
      .map((ed: any) => ({
        id: ed.study_disciplines.id,
        name: ed.study_disciplines.name,
        is_source: ed.study_disciplines.is_source ?? false,
      }))
      .sort((a: DisciplineOption, b: DisciplineOption) => a.name.localeCompare(b.name, 'pt-BR'));

    setDisciplines(discList);
  };

  const fetchTopics = async (disciplineId: string) => {
    const { data, error } = await supabase
      .from('study_topics')
      .select('id, name, study_discipline_id')
      .eq('study_discipline_id', disciplineId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar tópicos');
      console.error(error);
    }
    
    setTopics(data || []);
  };

  const fetchSourceDisciplines = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('study_disciplines')
      .select('id, name, is_source')
      .eq('is_active', true)
      .eq('is_source', true)
      .eq('generation_type', 'zip_import')
      .order('name');

    if (error) {
      toast.error('Erro ao carregar disciplinas-fonte');
      console.error(error);
    }
    setSourceDisciplines((data || []).map(d => ({ id: d.id, name: d.name, is_source: true })));
    setLoading(false);
  };

  const fetchSourceTopics = async (disciplineId: string) => {
    const { data, error } = await supabase
      .from('study_topics')
      .select('id, name, study_discipline_id')
      .eq('study_discipline_id', disciplineId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar tópicos-fonte');
      console.error(error);
    }
    setSourceTopics(data || []);
  };

  const handleCopy = async (dryRun: boolean) => {
    if (!selectedSourceTopicId || !selectedTopicId) {
      toast.error('Selecione o tópico-fonte e o tópico-destino');
      return;
    }

    setIsCopying(true);
    setCopyResult(null);

    try {
      const { data, error } = await supabase.rpc('copy_source_topic_to_derived' as any, {
        p_source_topic_id: selectedSourceTopicId,
        p_target_topic_id: selectedTopicId,
        p_dry_run: dryRun,
      });

      if (error) throw error;

      setCopyResult(data);
      const result = data as any;

      if (result.success) {
        if (dryRun) {
          toast.success(`Prévia: ${result.newly_linked} novas questões serão vinculadas (${result.already_linked} já existentes)`);
        } else {
          toast.success(`Cópia concluída: ${result.newly_linked} questões vinculadas ao tópico derivado`);
        }
      } else {
        toast.error(result.error || 'Erro na cópia');
      }
    } catch (error: any) {
      console.error('Copy error:', error);
      toast.error('Erro ao copiar: ' + error.message);
    } finally {
      setIsCopying(false);
    }
  };

  const handleValidate = async () => {
    if (!selectedTopicId) {
      toast.error('Selecione um tópico');
      return;
    }

    if (parsedQuestions.length === 0) {
      toast.error('Nenhuma questão para validar');
      return;
    }

    setIsValidating(true);
    setValidationResult(null);
    setImportResult(null);

    try {
      const rpcName = importMode === 'source' ? 'import_questions_to_topic_v3' : 'import_questions_to_derived_topic';
      const { data, error } = await supabase.rpc(rpcName as any, {
        p_topic_id: selectedTopicId,
        p_questions: JSON.parse(JSON.stringify(parsedQuestions)),
        p_dry_run: true,
      });

      if (error) throw error;

      const result = data as unknown as ImportStats;
      setValidationResult(result);
      
      if (result.success) {
        const parts = [];
        if (result.inserted > 0) parts.push(`${result.inserted} novas`);
        if ((result as any).updated > 0) parts.push(`${(result as any).updated} atualizadas`);
        if (result.duplicates > 0) parts.push(`${result.duplicates} duplicadas`);
        toast.success(`Validação concluída: ${parts.join(', ') || '0 alterações'}`);
      } else {
        toast.error(result.error || 'Erro na validação');
      }
    } catch (error: any) {
      console.error('Validation error:', error);
      toast.error('Erro ao validar: ' + error.message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!selectedTopicId) {
      toast.error('Selecione um tópico');
      return;
    }

    if (parsedQuestions.length === 0) {
      toast.error('Nenhuma questão para importar');
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const rpcName = importMode === 'source' ? 'import_questions_to_topic_v3' : 'import_questions_to_derived_topic';
      const { data, error } = await supabase.rpc(rpcName as any, {
        p_topic_id: selectedTopicId,
        p_questions: JSON.parse(JSON.stringify(parsedQuestions)),
        p_dry_run: false,
      });

      if (error) throw error;

      const result = data as unknown as ImportStats;
      setImportResult(result);
      
      if (result.success) {
        const parts = [];
        if (result.inserted > 0) parts.push(`${result.inserted} inseridas`);
        if (result.updated > 0) parts.push(`${result.updated} atualizadas`);
        if (result.duplicates > 0) parts.push(`${result.duplicates} duplicadas`);
        toast.success(`Importação concluída: ${parts.join(', ') || '0 alterações'}`);
        // Clear input after successful import
        if (result.inserted > 0 || result.updated > 0) {
          setJsonInput('');
          setParsedQuestions([]);
          setValidationResult(null);
        }
      } else {
        toast.error(result.error || 'Erro na importação');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error('Erro ao importar: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClear = () => {
    setJsonInput('');
    setParsedQuestions([]);
    setParseError(null);
    setValidationResult(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Selecione um arquivo .json');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setJsonInput(content);
    };
    reader.onerror = () => {
      toast.error('Erro ao ler o arquivo');
    };
    reader.readAsText(file);
  };

  const filteredTopics = topics;

  // Pre-select from URL params (deep-link from discipline panel)
  useEffect(() => {
    if (preSelectApplied) return;
    const urlTopicId = searchParams.get('topicId');
    const urlDisciplineId = searchParams.get('disciplineId');
    const urlEditalId = searchParams.get('editalId');

    if (urlTopicId && urlDisciplineId) {
      setImportMode('derived');
      setPreSelectApplied(true);
      
      // Chain: fetch editals → set edital → fetch disciplines → set discipline → fetch topics → set topic
      (async () => {
        // Fetch editals
        const { data: editalsData } = await supabase
          .from('editals')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        setEditals(editalsData || []);

        if (urlEditalId) {
          setSelectedEditalId(urlEditalId);
          
          // Fetch derived disciplines for this edital
          const { data: edData } = await supabase
            .from('edital_disciplines')
            .select('discipline_id, study_disciplines!inner(id, name, is_source)')
            .eq('edital_id', urlEditalId)
            .eq('is_active', true)
            .eq('study_disciplines.is_active', true);

          const discList = (edData || [])
            .map((ed: any) => ({
              id: ed.study_disciplines.id,
              name: ed.study_disciplines.name,
              is_source: ed.study_disciplines.is_source ?? false,
            }))
            .sort((a: DisciplineOption, b: DisciplineOption) => a.name.localeCompare(b.name, 'pt-BR'));
          setDisciplines(discList);
        }

        setSelectedDisciplineId(urlDisciplineId);

        // Fetch topics for the discipline
        const { data: topicsData } = await supabase
          .from('study_topics')
          .select('id, name, study_discipline_id')
          .eq('study_discipline_id', urlDisciplineId)
          .eq('is_active', true)
          .order('display_order', { ascending: true });
        setTopics(topicsData || []);

        setSelectedTopicId(urlTopicId);
        setLoading(false);
      })();
    }
  }, [searchParams, preSelectApplied]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileJson className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Importar Questões (V3)</CardTitle>
              <CardDescription>
                Importação individual de questões via JSON com deduplicação por hash
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Mode Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Label className="text-sm font-medium">Modo:</Label>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={importMode === 'source' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setImportMode('source')}
              >
                Disciplinas-fonte
              </Button>
              <Button
                variant={importMode === 'derived' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setImportMode('derived')}
              >
                Disciplinas derivadas
              </Button>
              <Button
                variant={importMode === 'copy_from_source' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setImportMode('copy_from_source')}
                className="gap-1"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar de fonte
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>
          {importMode === 'source' ? 'Modo Fonte' : importMode === 'derived' ? 'Modo Derivado' : 'Copiar de Fonte'}
        </AlertTitle>
        <AlertDescription>
          {importMode === 'source' ? (
            <>Importação em <strong>disciplinas-fonte</strong> (pré-edital). Questões são deduplicadas via hash SHA-256.</>
          ) : importMode === 'derived' ? (
            <>Importação direta em <strong>disciplinas derivadas</strong> (pós-edital). Use para tópicos sem equivalente na fonte. Duplicatas existentes serão vinculadas ao tópico.</>
          ) : (
            <>Copie todas as questões de um <strong>tópico-fonte</strong> para um <strong>tópico derivado</strong>. As questões serão vinculadas (não duplicadas) ao tópico de destino.</>
          )}
        </AlertDescription>
      </Alert>

      {/* Copy from Source - Source Selector */}
      {importMode === 'copy_from_source' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1. Selecionar Origem (Tópico-fonte)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Disciplina-fonte *</Label>
                <Select value={selectedSourceDisciplineId} onValueChange={setSelectedSourceDisciplineId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma disciplina-fonte..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceDisciplines.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tópico-fonte *</Label>
                <Select 
                  value={selectedSourceTopicId} 
                  onValueChange={setSelectedSourceTopicId}
                  disabled={!selectedSourceDisciplineId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedSourceDisciplineId ? "Selecione um tópico..." : "Selecione a disciplina primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceTopics.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selection - Target */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {importMode === 'copy_from_source' ? '2. Selecionar Destino (Tópico derivado)' : '1. Selecionar Destino'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Edital filter - in derived and copy modes */}
          {(importMode === 'derived' || importMode === 'copy_from_source') && (
            <div className="space-y-2">
              <Label>Edital *</Label>
              <Select value={selectedEditalId} onValueChange={setSelectedEditalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um edital..." />
                </SelectTrigger>
                <SelectContent>
                  {editals.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{importMode === 'source' ? 'Disciplina-fonte' : 'Disciplina derivada'} *</Label>
              <Select 
                value={selectedDisciplineId} 
                onValueChange={setSelectedDisciplineId}
                disabled={(importMode === 'derived' || importMode === 'copy_from_source') && !selectedEditalId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={(importMode === 'derived' || importMode === 'copy_from_source') && !selectedEditalId ? "Selecione o edital primeiro" : "Selecione uma disciplina..."} />
                </SelectTrigger>
                <SelectContent>
                  {disciplines.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {((importMode === 'source' && disciplines.length === 0) || ((importMode === 'derived' || importMode === 'copy_from_source') && selectedEditalId && disciplines.length === 0)) && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma disciplina {importMode === 'source' ? 'fonte' : 'derivada'} encontrada
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tópico {importMode === 'copy_from_source' ? 'destino' : ''} *</Label>
              <Select 
                value={selectedTopicId} 
                onValueChange={setSelectedTopicId}
                disabled={!selectedDisciplineId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedDisciplineId ? "Selecione um tópico..." : "Selecione a disciplina primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredTopics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDisciplineId && filteredTopics.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum tópico encontrado nesta disciplina
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Copy Result */}
      {importMode === 'copy_from_source' && copyResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {copyResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              {copyResult.dry_run ? 'Prévia da Cópia' : 'Resultado da Cópia'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {copyResult.success ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{copyResult.total_in_source}</div>
                    <div className="text-sm text-muted-foreground">Total na fonte</div>
                  </div>
                  <div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{copyResult.newly_linked}</div>
                    <div className="text-sm text-muted-foreground">Novas</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{copyResult.already_linked}</div>
                    <div className="text-sm text-muted-foreground">Já vinculadas</div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Origem:</strong> {copyResult.source_discipline} → {copyResult.source_topic}</p>
                  <p><strong>Destino:</strong> {copyResult.target_discipline} → {copyResult.target_topic}</p>
                </div>
              </div>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{copyResult.error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Copy Actions */}
      {importMode === 'copy_from_source' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => handleCopy(true)}
                disabled={!selectedSourceTopicId || !selectedTopicId || isCopying}
              >
                {isCopying ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verificando...</>
                ) : (
                  <><Eye className="h-4 w-4 mr-2" />Prévia (Dry-run)</>
                )}
              </Button>
              <Button
                onClick={() => handleCopy(false)}
                disabled={!selectedSourceTopicId || !selectedTopicId || isCopying}
              >
                {isCopying ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Copiando...</>
                ) : (
                  <><Copy className="h-4 w-4 mr-2" />Copiar questões</>
                )}
              </Button>
            </div>
            {(!selectedSourceTopicId || !selectedTopicId) && (
              <p className="text-sm text-muted-foreground mt-3">
                Selecione o tópico-fonte e o tópico-destino acima
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* JSON Input - only for source and derived modes */}
      {importMode !== 'copy_from_source' && <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. Carregar JSON das Questões</CardTitle>
          <CardDescription>
            Selecione um arquivo .json com as questões. Formatos aceitos: array direto ou objeto com propriedade "questions"
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Arquivo JSON</Label>
              {parsedQuestions.length > 0 && (
                <Badge variant="secondary">
                  {parsedQuestions.length} questão(ões) detectada(s)
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <FileJson className="h-4 w-4" />
                Selecionar arquivo .json
              </Button>
              {jsonInput && (
                <span className="text-sm text-muted-foreground">
                  {parsedQuestions.length} questões carregadas
                </span>
              )}
            </div>
            {parseError && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                {parseError}
              </p>
            )}
          </div>

          {/* Sample questions preview */}
          {parsedQuestions.length > 0 && (
            <div className="space-y-2">
              <Label>Prévia das questões</Label>
              <ScrollArea className="h-[150px] border rounded-md p-3">
                <div className="space-y-2">
                  {parsedQuestions.slice(0, 5).map((q, i) => (
                    <div key={i} className="text-sm p-2 bg-muted rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {i + 1}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {q.question_type === 'tf' ? 'C/E' : 'Múltipla'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Resp: {q.answer || '?'}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground line-clamp-2">
                        {q.question?.substring(0, 150)}...
                      </p>
                    </div>
                  ))}
                  {parsedQuestions.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      ... e mais {parsedQuestions.length - 5} questão(ões)
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>}

      {importMode !== 'copy_from_source' && <>

      {/* Validation Result */}
      {validationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Resultado da Validação (Dry-run)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {validationResult.success ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{validationResult.total_received}</div>
                    <div className="text-sm text-muted-foreground">Recebidas</div>
                  </div>
                  <div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{validationResult.inserted}</div>
                    <div className="text-sm text-muted-foreground">Novas</div>
                  </div>
                  <div className="text-center p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{validationResult.updated || 0}</div>
                    <div className="text-sm text-muted-foreground">Atualizadas</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{validationResult.duplicates}</div>
                    <div className="text-sm text-muted-foreground">Duplicadas</div>
                  </div>
                  <div className="text-center p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{validationResult.errors}</div>
                    <div className="text-sm text-muted-foreground">Erros</div>
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <strong>Destino:</strong> {validationResult.discipline_name} → {validationResult.topic_name}
                </div>

                {validationResult.error_messages && validationResult.error_messages.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Erros encontrados</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside mt-2">
                        {validationResult.error_messages.slice(0, 5).map((msg, i) => (
                          <li key={i}>{msg}</li>
                        ))}
                        {validationResult.error_messages.length > 5 && (
                          <li>... e mais {validationResult.error_messages.length - 5} erros</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Validação falhou</AlertTitle>
                <AlertDescription>{validationResult.error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import Result */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Resultado da Importação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {importResult.success ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{importResult.total_received}</div>
                    <div className="text-sm text-muted-foreground">Recebidas</div>
                  </div>
                  <div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{importResult.inserted}</div>
                    <div className="text-sm text-muted-foreground">Inseridas</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{importResult.duplicates}</div>
                    <div className="text-sm text-muted-foreground">Ignoradas (dup)</div>
                  </div>
                  <div className="text-center p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{importResult.errors}</div>
                    <div className="text-sm text-muted-foreground">Erros</div>
                  </div>
                </div>

                {importResult.notebook_id && (
                  <p className="text-sm text-muted-foreground">
                    <strong>Caderno atualizado:</strong> {importResult.topic_name}
                  </p>
                )}

                {importResult.error_messages && importResult.error_messages.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Alguns erros ocorreram</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside mt-2">
                        {importResult.error_messages.slice(0, 5).map((msg, i) => (
                          <li key={i}>{msg}</li>
                        ))}
                        {importResult.error_messages.length > 5 && (
                          <li>... e mais {importResult.error_messages.length - 5} erros</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Importação falhou</AlertTitle>
                <AlertDescription>{importResult.error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={!selectedTopicId || parsedQuestions.length === 0 || isValidating || isImporting}
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validando...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Validar (Dry-run)
                </>
              )}
            </Button>

            <Button
              onClick={handleImport}
              disabled={!selectedTopicId || parsedQuestions.length === 0 || isValidating || isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={handleClear}
              disabled={isValidating || isImporting}
            >
              Limpar
            </Button>
          </div>

          {!selectedDisciplineId && (
            <p className="text-sm text-muted-foreground mt-3">
              Selecione uma disciplina para começar
            </p>
          )}
          {selectedDisciplineId && !selectedTopicId && (
            <p className="text-sm text-muted-foreground mt-3">
              Selecione um tópico de destino
            </p>
          )}
          {selectedTopicId && parsedQuestions.length === 0 && !parseError && (
            <p className="text-sm text-muted-foreground mt-3">
              Cole o JSON das questões acima
            </p>
          )}
        </CardContent>
      </Card>
      </>}
    </div>
  );
}
