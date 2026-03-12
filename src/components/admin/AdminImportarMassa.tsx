import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  Upload,
  FolderArchive,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FolderOpen,
  FileJson,
  BookOpen,
  Layers,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import JSZip from 'jszip';

interface ParsedQuestion {
  question: string;
  associated_text: string;
  answer: string;
  prof_comment: string;
  question_type: string;
  images: string[];
  orgao: string;
  disciplina: string;
  topico: string;
  subtopicos: string[];
  banca: string;
  prova: string;
  ano: string;
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
  topicos?: string[];
}

interface FolderStructure {
  name: string;
  notebooks: {
    name: string;
    questions: ParsedQuestion[];
    jsonPath: string;
  }[];
}

interface UpdatedQuestionDetail {
  question_id: string;
  changes: Record<string, unknown>;
}

interface ImportStats {
  topics_created: number;
  topics_reused: number;
  questions_inserted: number;
  questions_updated: number;
  questions_skipped: number;
  questions_linked: number;
  questions_reactivated: number;
  low_quality: number;
  updated_details?: UpdatedQuestionDetail[];
}

interface ChunkProgress {
  current: number;
  total: number;
  questionsProcessed: number;
}

interface ImportResult {
  batch_id: string;
  mode: string;
  is_finalized: boolean;
  stats: ImportStats;
  errors: string[];
  chunks_processed: number;
}

interface ExistingDiscipline {
  id: string;
  name: string;
  is_source: boolean;
  generation_type: string | null;
}

interface PreviewInfo {
  disciplineId: string | null;
  disciplineName: string;
  isNewDiscipline: boolean;
  isMergeMode: boolean;
  existingTopics: string[];
  newTopics: string[];
  totalQuestions: number;
  isBlockedByDerived?: boolean;
  questionsWithoutHashV4?: number;
  totalExistingQuestions?: number;
}

// Response type for ensure_discipline_folder RPC (returns jsonb)
interface EnsureFolderResponse {
  success: boolean;
  folder_id: string | null;
  created: boolean;
  message?: string;
  error?: string;
}

// =====================================================
// Transport shielding: encode rich fields to avoid
// gateway/WAF blocking on patterns like <script>, SQL, etc.
// =====================================================
const B64_PREFIX = '__b64__:';

const base64EncodeUtf8 = (input: string): string => {
  // Convert UTF-8 bytes -> base64 safely
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  // Chunk to avoid call-stack issues with very large strings
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    let chunkStr = '';
    for (let j = 0; j < chunk.length; j++) chunkStr += String.fromCharCode(chunk[j]);
    binary += chunkStr;
  }
  return btoa(binary);
};

const encodeForTransport = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (!str) return '';
  // Only encode when there's potentially “dangerous” patterns.
  // Keeps payload smaller for plain text.
  const looksSensitive = /<\/?\w+|%3c|\bscript\b|SELECT\s|INSERT\s|UPDATE\s|DELETE\s|--#|\.\.\/|%2e%2e%2f|%2e%2e%5c|\/etc\/hosts|etc\/hosts/i.test(str);
  return looksSensitive ? `${B64_PREFIX}${base64EncodeUtf8(str)}` : str;
};

const encodeOptionsForTransport = (options: ParsedQuestion['options']): ParsedQuestion['options'] => ({
  a: encodeForTransport(options?.a),
  b: encodeForTransport(options?.b),
  c: encodeForTransport(options?.c),
  d: encodeForTransport(options?.d),
  e: encodeForTransport(options?.e),
});

// Normalize answer field to letter format
const normalizeAnswer = (answer: unknown, questionType: string): string => {
  if (answer === null || answer === undefined) return '';
  const answerStr = String(answer).trim();
  if (answerStr === '') return '';
  const cleanAnswer = answerStr.toUpperCase();
  
  if (questionType === 'certo_errado' || questionType === 'ce' || questionType === 'tf') {
    if (cleanAnswer.includes('CERTO') || cleanAnswer === 'C') return 'C';
    if (cleanAnswer.includes('ERRADO') || cleanAnswer === 'E') return 'E';
    const match = cleanAnswer.match(/[CE]/);
    if (match) return match[0];
    return cleanAnswer;
  }
  
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
    if (ceMatch) return ceMatch[1].charAt(0).toUpperCase(); // C or E
    return '';
  }
  
  // Multiple choice: look for "Gabarito\nLetra X" or "Letra X" at end
  const gabMatch = text.match(/(?:Gabarito|Resposta)\s*(?:Letra\s*)?([A-E])/i);
  if (gabMatch) return gabMatch[1].toUpperCase();
  const letraMatch = text.match(/Letra\s+([A-E])\s*$/i);
  if (letraMatch) return letraMatch[1].toUpperCase();
  return '';
};

// Normalize topic name for matching (same logic as SQL normalize_topic_name_soft)
const normalizeTopicNameSoft = (name: string): string => {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove invisible chars
};

type ImportQuestionRequestItem = {
  topic_name: string;
  question: string;
  answer: string;
  associated_text: string;
  prof_comment: string;
  question_type: string;
  year: string;
  banca: string;
  orgao: string;
  prova: string;
  options: ParsedQuestion['options'];
  images: string[];
  // V2 fields
  external_code?: string;
  prof_comment_json?: Record<string, unknown>;
  prof_comment_citations?: string[];
  prof_comment_videos?: string[];
  topicos?: string[];
};

// Chunks menores para evitar bloqueios de gateway/WAF
const MAX_QUESTIONS_PER_CHUNK = 80;
const MAX_CHUNK_BYTES = 500_000; // ~500KB - margem de segurança

const chunkQuestionsForRequest = (
  questions: ImportQuestionRequestItem[]
): ImportQuestionRequestItem[][] => {
  if (questions.length === 0) return [[]];

  const encoder = new TextEncoder();
  const chunks: ImportQuestionRequestItem[][] = [];
  let current: ImportQuestionRequestItem[] = [];
  let currentBytes = 0;

  for (const q of questions) {
    const qBytes = encoder.encode(JSON.stringify(q)).length;

    const wouldExceed =
      current.length >= MAX_QUESTIONS_PER_CHUNK ||
      (current.length > 0 && currentBytes + qBytes > MAX_CHUNK_BYTES);

    if (wouldExceed) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }

    current.push(q);
    currentBytes += qBytes;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
};

// ============================================
// TEST GATE: 3-chunk simulation for validation
// Call via console: window.__testChunkedImport('discipline-id-here')
// ============================================
const runChunkedImportTest = async (disciplineId: string): Promise<void> => {
  console.log('🧪 Starting 3-chunk test for discipline:', disciplineId);
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  // Get session token
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.access_token) {
    console.error('❌ No session - please login first');
    return;
  }
  const token = sessionData.session.access_token;

  // Mock data for test
  const mockTopics = [{ name: 'Test Topic 1', order: 0 }];
  const mockQuestions = (chunkIdx: number) => [{
    topic_name: 'Test Topic 1',
    question: `Test question chunk ${chunkIdx} - ${Date.now()}`,
    answer: 'A',
    question_type: 'mult',
  }];

  let batchId: string | null = null;
  const totalChunks = 3;

  for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
    const isLast = chunkIdx === totalChunks - 1;
    console.log(`📤 Sending chunk ${chunkIdx + 1}/${totalChunks}${isLast ? ' (finalize)' : ''}`);

    const payload = {
      discipline_id: disciplineId,
      zip_filename: chunkIdx === 0 ? 'test-3-chunks.zip' : undefined,
      mode: 'merge',
      batch_id: batchId,
      topics: chunkIdx === 0 ? mockTopics : [],
      questions: mockQuestions(chunkIdx),
      chunk_index: chunkIdx,
      total_chunks: totalChunks,
    };

    const response = await fetch(`${supabaseUrl}/functions/v1/import-questions-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': anonKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log(`📥 Chunk ${chunkIdx + 1} response:`, data);

    if (!data.success) {
      console.error(`❌ Chunk ${chunkIdx + 1} failed:`, data.error);
      return;
    }

    if (chunkIdx === 0 && data.batch_id) {
      batchId = data.batch_id;
      console.log('📝 Batch ID:', batchId);
    }

    if (isLast) {
      console.log('✅ Final chunk processed');
      console.log('   is_finalized:', data.is_finalized);
      console.log('   stats:', data.stats);
      
      // Verify batch status
      if (batchId) {
        const { data: batchData } = await supabase
          .from('import_batches')
          .select('status, chunks_received, chunks_total')
          .eq('id', batchId)
          .single();
        
        console.log('📊 Batch verification:', batchData);
        
        if (batchData?.status === 'completed' && batchData?.chunks_received === 3) {
          console.log('✅ TEST PASSED: batch completed with 3 chunks');
        } else {
          console.warn('⚠️ TEST INCOMPLETE: check batch status');
        }
      }
    }
  }
  
  console.log('🏁 3-chunk test completed');
};

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).__testChunkedImport = runChunkedImportTest;
}

/**
 * PATCH: Link newly created ZIP discipline to default edital and ensure area_id
 */
const linkDisciplineToPreEditalAndArea = async (
  disciplineId: string,
  disciplineName: string
): Promise<void> => {
  try {
    const normalizedDisciplineName = (disciplineName ?? '').trim().replace(/\s+/g, ' ');

    console.log('[AutoLink] Starting auto-link for discipline:', disciplineName, disciplineId);

    // 1) Find default edital
    const { data: defaultEdital, error: editalError } = await supabase
      .from('editals')
      .select('id, name')
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();

    if (editalError) {
      console.error('[AutoLink] Error fetching default edital:', editalError);
      toast.error(`Erro ao buscar edital padrão: ${editalError.message}`);
      return;
    }

    if (!defaultEdital) {
      console.warn('[AutoLink] No default edital found (is_default=true). Skipping link.');
      toast.warning('Nenhum edital padrão encontrado. Disciplina não vinculada ao Pré-Edital.');
      return;
    }

    console.log('[AutoLink] Found default edital:', defaultEdital.name, defaultEdital.id);

    // 2) Insert edital_disciplines link
    const { error: linkError } = await supabase
      .from('edital_disciplines')
      .upsert(
        {
          edital_id: defaultEdital.id,
          discipline_id: disciplineId,
          is_active: true,
        },
        { onConflict: 'edital_id,discipline_id' }
      );

    if (linkError) {
      console.error('[AutoLink] Error linking to edital:', linkError);
      toast.error(`Erro ao vincular disciplina ao edital: ${linkError.message}`);
    } else {
      console.log('[AutoLink] Successfully linked discipline to edital:', defaultEdital.name);
    }

    // 3) Find or create area with same name as discipline
    const { data: existingArea, error: areaSearchError } = await supabase
      .from('areas')
      .select('id, name')
      .ilike('name', normalizedDisciplineName)
      .limit(1)
      .maybeSingle();

    if (areaSearchError) {
      console.error('[AutoLink] Error searching for area:', areaSearchError);
      toast.error(`Erro ao buscar área: ${areaSearchError.message}`);
      return;
    }

    let areaId: string;

    if (existingArea) {
      console.log('[AutoLink] Found existing area:', existingArea.name, existingArea.id);
      areaId = existingArea.id;
    } else {
      // Create new area
      console.log('[AutoLink] Creating new area:', normalizedDisciplineName);
      const { data: newArea, error: areaCreateError } = await supabase
        .from('areas')
        .insert({
          name: normalizedDisciplineName,
          is_active: true,
        })
        .select('id')
        .single();

      if (areaCreateError) {
        // Most common cause: unique index is on LOWER(TRIM(name)); if input has extra whitespace,
        // the insert can conflict even if the exact string search didn't find it.
        const isUniqueViolation = (areaCreateError as any)?.code === '23505' || /duplicate/i.test(areaCreateError.message);
        if (!isUniqueViolation) {
          console.error('[AutoLink] Error creating area:', areaCreateError);
          toast.error(`Erro ao criar área: ${areaCreateError.message}`);
          return;
        }

        console.warn('[AutoLink] Area insert hit unique constraint; re-fetching existing area...');
        const { data: areaAfterConflict, error: refetchError } = await supabase
          .from('areas')
          .select('id, name')
          .ilike('name', normalizedDisciplineName)
          .limit(1)
          .maybeSingle();

        if (refetchError || !areaAfterConflict) {
          console.error('[AutoLink] Could not refetch area after unique violation:', refetchError);
          toast.error('Erro ao resolver área após conflito de nome (unique).');
          return;
        }

        console.log('[AutoLink] Resolved existing area after conflict:', areaAfterConflict.name, areaAfterConflict.id);
        areaId = areaAfterConflict.id;
      } else {
        console.log('[AutoLink] Created new area:', normalizedDisciplineName, newArea.id);
        areaId = newArea.id;
      }
    }

    // 4) Update discipline with area_id
    const { error: updateError } = await supabase
      .from('study_disciplines')
      .update({ area_id: areaId, source_discipline_id: disciplineId })
      .eq('id', disciplineId);

    if (updateError) {
      console.error('[AutoLink] Error updating discipline area_id:', updateError);
      toast.error(`Erro ao atribuir área à disciplina: ${updateError.message}`);
      return;
    }

    console.log('[AutoLink] Successfully set area_id on discipline:', areaId);
    console.log('[AutoLink] ✅ Auto-link complete for:', disciplineName);

  } catch (err: any) {
    console.error('[AutoLink] Unexpected error:', err);
    toast.error(`Erro inesperado no auto-link: ${err.message}`);
  }
};

export function AdminImportarMassa() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [parsedStructure, setParsedStructure] = useState<FolderStructure[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [previewInfo, setPreviewInfo] = useState<PreviewInfo | null>(null);
  const [zipFilename, setZipFilename] = useState('');

  const handleBackfillHashV4 = async () => {
    if (!previewInfo?.disciplineId) return;
    setIsBackfilling(true);
    try {
      const { error } = await supabase.rpc('backfill_match_hash_v4' as any, {
        p_discipline_id: previewInfo.disciplineId,
      } as any);
      if (error) throw error;
      toast.success(`Backfill concluído! Recalculando preview...`);
      // Re-run preview to refresh counts
      if (parsedStructure.length > 0) {
        await generatePreviewInfo(parsedStructure);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err)
          ? String((err as { message: string }).message)
          : JSON.stringify(err);
      console.error('Backfill error:', err);
      toast.error(`Erro no backfill: ${msg}`);
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!/\.zip$/i.test(file.name)) {
      toast.error('Por favor, selecione um arquivo ZIP');
      return;
    }

    setIsLoading(true);
    setParsedStructure([]);
    setImportResult(null);
    setPreviewInfo(null);
    setZipFilename(file.name);

    try {
      const zip = await JSZip.loadAsync(file);
      const structure: FolderStructure[] = [];
      const disciplineFromZipName = file.name.replace(/\.zip$/i, '').trim();
      
      const jsonFiles: { path: string; content: string }[] = [];
      let nestedZipCount = 0;

      const isMetaPath = (p: string) =>
        p.startsWith('__MACOSX/') || p.startsWith('.') || p.includes('/.') || p === '.DS_Store';

      for (const [path, zipEntry] of Object.entries(zip.files)) {
        const normalizedPath = path.replace(/\\/g, '/');
        if (zipEntry.dir) continue;
        if (isMetaPath(normalizedPath)) continue;

        const isJson = /\.json$/i.test(normalizedPath);
        const isZip = /\.zip$/i.test(normalizedPath);

        if (isJson) {
          const content = await zipEntry.async('string');
          jsonFiles.push({ path: normalizedPath, content });
          continue;
        }

        if (isZip) {
          nestedZipCount += 1;
          const topicZipName = (normalizedPath.split('/').pop() || 'Topico').replace(/\.zip$/i, '').trim();
          try {
            const buffer = await zipEntry.async('arraybuffer');
            const topicZip = await JSZip.loadAsync(buffer);

            for (const [innerPath, innerEntry] of Object.entries(topicZip.files)) {
              const normalizedInnerPath = innerPath.replace(/\\/g, '/');
              if (innerEntry.dir) continue;
              if (isMetaPath(normalizedInnerPath)) continue;
              if (!/\.json$/i.test(normalizedInnerPath)) continue;

              const innerContent = await innerEntry.async('string');
              jsonFiles.push({
                path: `${disciplineFromZipName}/${topicZipName}/${normalizedInnerPath}`,
                content: innerContent,
              });
            }
          } catch (e) {
            console.error('Error reading nested topic zip:', normalizedPath, e);
          }
        }
      }

      if (jsonFiles.length === 0) {
        toast.error(
          nestedZipCount > 0
            ? 'Encontrei ZIP(s) de tópicos, mas nenhum arquivo .json válido dentro deles.'
            : 'Nenhum arquivo .json encontrado dentro do ZIP',
        );
        return;
      }

      let skipRootFolder = false;
      if (jsonFiles.length > 0) {
        const firstParts = jsonFiles[0].path.split('/').filter(p => p.length > 0);
        if (firstParts.length >= 4) {
          const potentialRoot = firstParts[0];
          const allShareRoot = jsonFiles.every(f => {
            const parts = f.path.split('/').filter(p => p.length > 0);
            return parts[0] === potentialRoot;
          });
          if (allShareRoot) {
            skipRootFolder = true;
          }
        }
      }

      const folderMap = new Map<string, Map<string, { questions: ParsedQuestion[]; jsonPath: string }>>();

      for (const { path, content } of jsonFiles) {
        let parts = path.split('/').filter(p => p.length > 0);
        if (skipRootFolder) parts = parts.slice(1);
        if (parts.length < 1) continue;

        let disciplineName: string;
        let topicName: string;

        if (parts.length >= 3) {
          disciplineName = parts[0];
          topicName = parts[1];
        } else if (parts.length === 2) {
          disciplineName = disciplineFromZipName || 'Disciplina';
          topicName = parts[0];
        } else {
          disciplineName = disciplineFromZipName || 'Disciplina';
          topicName = parts[0].replace(/\.json$/i, '');
        }

        let data;
        try {
          let text = content.trim();
          try {
            data = JSON.parse(text);
          } catch (parseError: any) {
            if (parseError?.message?.includes('Unexpected end of JSON')) {
              if (text.endsWith(',')) text = text.slice(0, -1);
              const openBraces = (text.match(/{/g) || []).length;
              const closeBraces = (text.match(/}/g) || []).length;
              const openBrackets = (text.match(/\[/g) || []).length;
              const closeBrackets = (text.match(/]/g) || []).length;
              for (let i = 0; i < openBrackets - closeBrackets; i++) text += ']';
              for (let i = 0; i < openBraces - closeBraces; i++) text += '}';
              data = JSON.parse(text);
            } else {
              throw parseError;
            }
          }
        } catch (e) {
          console.error('Error parsing JSON:', path, e);
          continue;
        }

        if (!data.questions || !Array.isArray(data.questions)) continue;

        const questions: ParsedQuestion[] = data.questions.map((q: any) => {
          const rawType = (q.question_type || '').toLowerCase();
          const questionType = (rawType === 'ce' || rawType === 'tf' || rawType === 'certo_errado' || rawType === 'true_false') 
            ? 'tf' 
            : 'mult';
          
          const rawAnswer = q.answer ?? q.gabarito ?? q.resposta ?? q.correct_answer ?? q.correctAnswer ?? '';
          let normalizedAnswer = normalizeAnswer(rawAnswer, rawType);
          
          // Fallback: extract answer from prof_comment if empty
          const profCommentRaw = q.prof_comment;
          const profCommentText = typeof profCommentRaw === 'string' ? profCommentRaw : '';
          if (!normalizedAnswer && profCommentText) {
            normalizedAnswer = extractAnswerFromProfComment(profCommentText, questionType);
          }

          // V2: structured prof_comment (JSONB)
          const profCommentJson = (typeof profCommentRaw === 'object' && profCommentRaw !== null) ? profCommentRaw : undefined;
          
          return {
            question: q.question || q.question_html || '',
            associated_text: q.associated_text || q.associated_text_html || '',
            answer: normalizedAnswer,
            prof_comment: profCommentText,
            question_type: questionType,
            images: q.image || q.images || [],
            orgao: q.orgao || '',
            disciplina: q.disciplina || disciplineName,
            topico: q.topico || topicName,
            subtopicos: q.subtopicos || [],
            banca: q.banca || '',
            prova: q.prova || '',
            ano: q.ano || '',
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
            topicos: Array.isArray(q.topicos) ? q.topicos : undefined,
          };
        });

        if (!folderMap.has(disciplineName)) {
          folderMap.set(disciplineName, new Map());
        }
        
        const topicMap = folderMap.get(disciplineName)!;
        if (topicMap.has(topicName)) {
          const existing = topicMap.get(topicName)!;
          existing.questions.push(...questions);
        } else {
          topicMap.set(topicName, { questions, jsonPath: path });
        }
      }

      if (folderMap.size === 0) {
        toast.error('Nenhum arquivo de questões válido encontrado');
        return;
      }

      for (const [disciplineName, topicMap] of folderMap) {
        const notebooks: FolderStructure['notebooks'] = [];
        for (const [topicName, data] of topicMap) {
          notebooks.push({ name: topicName, questions: data.questions, jsonPath: data.jsonPath });
        }
        structure.push({ name: disciplineName, notebooks });
      }

      structure.sort((a, b) => a.name.localeCompare(b.name));
      structure.forEach(s => s.notebooks.sort((a, b) => a.name.localeCompare(b.name)));

      setParsedStructure(structure);

      // Generate preview info
      await generatePreviewInfo(structure);
      
      const totalQuestions = structure.reduce((sum, f) => 
        sum + f.notebooks.reduce((s, n) => s + n.questions.length, 0), 0
      );
      
      toast.success(`ZIP processado: ${structure.length} disciplina(s), ${structure.reduce((s, f) => s + f.notebooks.length, 0)} tópico(s), ${totalQuestions} questão(ões)`);

    } catch (error: any) {
      console.error('Error processing ZIP:', error);
      toast.error('Erro ao processar o arquivo ZIP');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const generatePreviewInfo = async (structure: FolderStructure[]) => {
    if (structure.length === 0) return;

    // For now, handle single discipline (most common case)
    const firstDiscipline = structure[0];
    const disciplineName = firstDiscipline.name;

    try {
      // Check ALL disciplines with this name (to detect derived conflicts)
      const { data: allDisciplines } = await supabase
        .from('study_disciplines')
        .select('id, name, is_source, generation_type')
        .ilike('name', disciplineName)
        .eq('is_active', true);

      // Filter matching disciplines by exact name (case-insensitive)
      const matchingDisciplines = (allDisciplines || []).filter(
        (d: ExistingDiscipline) => d.name.toLowerCase() === disciplineName.toLowerCase()
      );

      // ========== FIX: Strict source enforcement in Preview ==========
      const existingSourceDiscipline = matchingDisciplines.find(
        (d: ExistingDiscipline) => d.is_source === true && d.generation_type === 'zip_import'
      );
      
      const existingDerivedDiscipline = matchingDisciplines.find(
        (d: ExistingDiscipline) => d.is_source !== true || d.generation_type !== 'zip_import'
      );

      // If there's a derived discipline with same name but NO source, block in preview
      const isBlockedByDerived = !existingSourceDiscipline && !!existingDerivedDiscipline;

      const existingDiscipline = existingSourceDiscipline || null;
      const isMergeMode = existingDiscipline !== null && !isBlockedByDerived;

      let existingTopics: string[] = [];
      let newTopics: string[] = [];

      if (existingDiscipline) {
        // Fetch existing topics for this discipline
        const { data: existingTopicData } = await supabase
          .from('study_topics')
          .select('name')
          .eq('study_discipline_id', existingDiscipline.id)
          .eq('is_active', true);

        const existingTopicNames = (existingTopicData || []).map(t => 
          normalizeTopicNameSoft(t.name)
        );

        for (const notebook of firstDiscipline.notebooks) {
          const normalizedName = normalizeTopicNameSoft(notebook.name);
          if (existingTopicNames.includes(normalizedName)) {
            existingTopics.push(notebook.name);
          } else {
            newTopics.push(notebook.name);
          }
        }
      } else {
        // All topics are new (will create new discipline)
        newTopics = firstDiscipline.notebooks.map(n => n.name);
      }

      const totalQuestions = firstDiscipline.notebooks.reduce(
        (sum, n) => sum + n.questions.length, 0
      );

      // ========== CHECK: Existing questions without match_hash (v4) ==========
      let questionsWithoutHashV4 = 0;
      let totalExistingQuestions = 0;
      if (existingDiscipline && isMergeMode) {
        const { data: hashStats } = await supabase
          .from('questions')
          .select('id, match_hash', { count: 'exact', head: false })
          .eq('study_discipline_id', existingDiscipline.id)
          .eq('is_active', true);
        
        if (hashStats) {
          totalExistingQuestions = hashStats.length;
          questionsWithoutHashV4 = hashStats.filter(q => !q.match_hash).length;
        }
      }

      setPreviewInfo({
        disciplineId: existingDiscipline?.id || null,
        disciplineName,
        isNewDiscipline: !existingDiscipline && !isBlockedByDerived,
        isMergeMode,
        existingTopics,
        newTopics,
        totalQuestions,
        isBlockedByDerived,
        questionsWithoutHashV4,
        totalExistingQuestions,
      });
    } catch (error) {
      console.error('Error generating preview:', error);
    }
  };

  const handleImport = async () => {
    if (parsedStructure.length === 0) {
      toast.error('Nenhum dado para importar');
      return;
    }

    setConfirmDialogOpen(false);
    setIsImporting(true);
    setImportProgress(0);
    setImportStatus('Iniciando importação por chunks...');

    const result: ImportResult = {
      batch_id: '',
      mode: 'merge',
      is_finalized: false,
      stats: {
        topics_created: 0,
        topics_reused: 0,
        questions_inserted: 0,
        questions_updated: 0,
        questions_skipped: 0,
        questions_linked: 0,
        questions_reactivated: 0,
        low_quality: 0,
        updated_details: [],
      },
      errors: [],
      chunks_processed: 0,
    };

    try {
      // Process each discipline
      for (const folder of parsedStructure) {
        const disciplineNameNormalized = (folder.name ?? '').trim();
        setImportStatus(`Processando disciplina: ${disciplineNameNormalized}`);

        // Check if discipline exists (for merge mode) or create it - prioritize source disciplines
        const { data: existingDisciplines } = await supabase
          .from('study_disciplines')
          .select('id, name, is_source, generation_type, area_id')
          .ilike('name', disciplineNameNormalized)
          .eq('is_active', true);

        let disciplineId: string | null = null;
        let isMerge = false;
        let importMode: 'merge' | 'create' = 'create';

        // Filter matching disciplines by exact name (case-insensitive)
        const matchingDisciplines = (existingDisciplines || []).filter(
          (d) => d.name?.toLowerCase() === disciplineNameNormalized.toLowerCase()
        );

        // ========== FIX TICKET 1: Strict source discipline enforcement ==========
        // Find ONLY source discipline (is_source=true, generation_type=zip_import)
        const existingSourceDiscipline = matchingDisciplines.find(
          (d) => d.is_source === true && d.generation_type === 'zip_import'
        );
        
        // Check if there's a non-source discipline with the same name (BLOCK this scenario)
        const existingDerivedDiscipline = matchingDisciplines.find(
          (d) => d.is_source !== true || d.generation_type !== 'zip_import'
        );

        if (!existingSourceDiscipline && existingDerivedDiscipline) {
          // CRITICAL: Block import - there's a derived discipline with same name
          result.errors.push(
            `Existe uma disciplina com o nome "${folder.name}", mas ela NÃO é fonte ` +
            `(is_source=true, generation_type=zip_import). Renomeie o item no ZIP ou ` +
            `ajuste a disciplina no banco. Importação bloqueada para evitar gravação no pós-edital.`
          );
          continue;
        }

        if (existingSourceDiscipline) {
          // Discipline exists and is a valid source - use it for merge
          disciplineId = existingSourceDiscipline.id;
          isMerge = true;
          importMode = 'merge';
          
          // ========== FIX TICKET 1: Ensure folder exists via centralized RPC (returns jsonb) ==========
          setImportStatus(`Verificando pasta da disciplina: ${disciplineNameNormalized}`);
          const { data: folderResRaw, error: folderErr } = await supabase.rpc('ensure_discipline_folder', {
            p_discipline_id: disciplineId
          });
          const folderRes = folderResRaw as unknown as EnsureFolderResponse | null;
          
          if (folderErr) {
            result.errors.push(`Erro ao garantir pasta para disciplina "${folder.name}": ${folderErr.message}`);
            continue;
          }
          if (!folderRes?.success) {
            result.errors.push(`Erro ao garantir pasta para disciplina "${folder.name}": ${folderRes?.error || 'falha desconhecida'}`);
            continue;
          }
          console.log(`[AdminImportarMassa] Folder ensured for merge: ${disciplineNameNormalized}, folder_id: ${folderRes.folder_id}, created: ${folderRes.created}`);
          
        } else {
          // ========== CREATE NEW DISCIPLINE ==========
          setImportStatus(`Criando disciplina: ${disciplineNameNormalized}`);
          
          // Create the discipline first (folder will be created by RPC)
          const { data: newDiscipline, error: disciplineError } = await supabase
            .from('study_disciplines')
            .insert({
              name: disciplineNameNormalized,
              is_source: true,
              is_active: true,
              generation_type: 'zip_import',
            })
            .select('id')
            .single();
          
          if (disciplineError) {
            result.errors.push(`Erro ao criar disciplina "${disciplineNameNormalized}": ${disciplineError.message}`);
            continue;
          }
          
          disciplineId = newDiscipline.id;
          importMode = 'create';
          console.log(`[AdminImportarMassa] Created new discipline: ${disciplineNameNormalized} with id ${disciplineId}`);

          // ========== FIX TICKET 1: Use centralized RPC to create folder (returns jsonb) ==========
          const { data: folderResRaw, error: folderErr } = await supabase.rpc('ensure_discipline_folder', {
            p_discipline_id: disciplineId
          });
          const folderRes = folderResRaw as unknown as EnsureFolderResponse | null;
          
          if (folderErr || !folderRes?.success) {
            result.errors.push(
              `Erro ao criar/garantir pasta para disciplina "${disciplineNameNormalized}": ${
                folderErr?.message || folderRes?.error || 'falha desconhecida'
              }`
            );
            // Rollback seguro (soft delete) - hard delete pode falhar com RLS
            await supabase
              .from('study_disciplines')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq('id', disciplineId);
            continue;
          }
          console.log(`[AdminImportarMassa] Folder created for new discipline: ${disciplineNameNormalized}, folder_id: ${folderRes.folder_id}, created: ${folderRes.created}`);

          // Set source_discipline_id to self for source disciplines
          const { error: selfRefError } = await supabase
            .from('study_disciplines')
            .update({ source_discipline_id: disciplineId })
            .eq('id', disciplineId);
          
          if (selfRefError) {
            console.error('[AdminImportarMassa] Error setting source_discipline_id to self:', selfRefError);
          } else {
            console.log(`[AdminImportarMassa] Set source_discipline_id to self for: ${disciplineNameNormalized}`);
          }

          // Auto-link to Pré-Edital + Area
          await linkDisciplineToPreEditalAndArea(disciplineId, disciplineNameNormalized);
        }

        // Prepare all topics and questions
        const allTopics = folder.notebooks.map((nb, idx) => ({
          name: nb.name,
          order: idx,
        }));

        const allQuestions: ImportQuestionRequestItem[] = folder.notebooks.flatMap(nb =>
          nb.questions.map(q => ({
            topic_name: nb.name,
            question: encodeForTransport(q.question),
            answer: q.answer,
            associated_text: encodeForTransport(q.associated_text),
            prof_comment: encodeForTransport(q.prof_comment),
            question_type: q.question_type,
            year: q.ano,
            banca: q.banca,
            orgao: q.orgao,
            prova: q.prova,
            options: encodeOptionsForTransport(q.options),
            images: q.images,
            // V2 fields
            external_code: q.external_code || undefined,
            prof_comment_json: q.prof_comment_json || undefined,
            prof_comment_citations: q.prof_comment_citations || undefined,
            prof_comment_videos: q.prof_comment_videos || undefined,
            topicos: q.topicos || undefined,
          }))
        );

        // Calculate total chunks (by payload size)
        const questionChunks = chunkQuestionsForRequest(allQuestions);
        const totalChunks = questionChunks.length;
        let chunkFailed = false;

        // ========== CREATE batch_id BEFORE sending any chunks ==========
        setImportStatus(`Criando batch de importação para ${folder.name}...`);
        
        const { data: newBatch, error: batchError } = await supabase
          .from('import_batches')
          .insert({
            discipline_id: disciplineId,
            zip_filename: zipFilename || null,
            chunks_total: totalChunks,
            chunks_received: 0,
            status: 'ingesting', // RPC expects 'ingesting' to process chunks
          })
          .select('id')
          .single();
        
        if (batchError || !newBatch?.id) {
          result.errors.push(`Erro ao criar batch para "${folder.name}": ${batchError?.message || 'ID não retornado'}`);
          continue;
        }
        
        const batchId = newBatch.id;
        result.batch_id = batchId;
        console.log(`[AdminImportarMassa] Created import_batch BEFORE chunks. batch_id: ${batchId}`);

        for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
          if (chunkFailed) break;

          const chunkQuestions = questionChunks[chunkIdx] ?? [];
          const isLastChunk = chunkIdx === totalChunks - 1;

          setImportStatus(`Chunk ${chunkIdx + 1} de ${totalChunks} (${chunkQuestions.length} questões)${isLastChunk ? ' - finalizando...' : ''}`);
          setImportProgress(Math.round(((chunkIdx) / totalChunks) * 90));

          const { data: session } = await supabase.auth.getSession();
          if (!session?.session?.access_token) {
            throw new Error('Sessão expirada. Faça login novamente.');
          }

          // Build request payload - batch_id is ALWAYS set (never null)
          const requestPayload = {
            discipline_id: disciplineId,
            zip_filename: chunkIdx === 0 ? zipFilename : undefined,
            mode: importMode,
            batch_id: batchId, // Always set - created before loop
            topics: chunkIdx === 0 ? allTopics : [], // Only send topics on first chunk
            questions: chunkQuestions,
            chunk_index: chunkIdx,
            total_chunks: totalChunks,
          };

          // ========== DIAGNOSTIC LOGS ==========
          const endpointUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-questions-batch`;
          const bodyStr = JSON.stringify(requestPayload);
          const bodyBytes = new TextEncoder().encode(bodyStr).length;
          
          console.log("[IMPORT] ========== CHUNK REQUEST ==========");
          console.log("[IMPORT] endpoint:", endpointUrl);
          console.log("[IMPORT] chunk:", chunkIdx, "/", totalChunks, "questions:", chunkQuestions.length, "bytes:", bodyBytes);
          console.log("[IMPORT] discipline_id:", disciplineId);
          console.log("[IMPORT] batch_id:", batchId); // Log the batch_id
          console.log("[IMPORT] ======================================");
          
          let response: Response | null = null;
          let responseText: string = "";
          let responseData: any = null;
          
          // Retry logic with exponential backoff
          const maxRetries = 3;
          let lastError: any = null;
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              console.log(`[IMPORT] Attempt ${attempt}/${maxRetries} for chunk ${chunkIdx + 1}/${totalChunks}`);
              
              response = await fetch(endpointUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.session.access_token}`,
                  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                },
                body: bodyStr,
              });
              
              console.log("[IMPORT] response status:", response.status, response.statusText);
              
              responseText = await response.text();
              console.log("[IMPORT] response text (first 500):", responseText.slice(0, 500));
              
              try {
                responseData = responseText ? JSON.parse(responseText) : null;
              } catch (parseErr) {
                console.error("[IMPORT] JSON parse error:", parseErr);
                responseData = null;
              }
              
              // If we got here, the fetch succeeded
              lastError = null;
              break;
              
            } catch (fetchError: any) {
              lastError = fetchError;
              console.error(`[IMPORT] ========== FETCH FAILED (attempt ${attempt}) ==========`);
              console.error("[IMPORT] error:", fetchError?.message);
              console.error("[IMPORT] =====================================");
              
              if (attempt < maxRetries) {
                const waitMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                console.log(`[IMPORT] Waiting ${waitMs}ms before retry...`);
                setImportStatus(`Chunk ${chunkIdx + 1}: aguardando ${waitMs / 1000}s para reenviar...`);
                await new Promise(resolve => setTimeout(resolve, waitMs));
              }
            }
          }
          
          if (lastError) {
            result.errors.push(`Erro de rede no chunk ${chunkIdx + 1}/${totalChunks}: ${lastError?.message || 'Failed to fetch'}`);
            chunkFailed = true;
            toast.error(`Falha de rede no chunk ${chunkIdx + 1}`);
            break;
          }

          if (!response || !response.ok || !responseData?.success) {
            const fallbackMsg = response?.status
              ? `${response.status} ${response.statusText}`
              : 'Falha de rede (sem resposta)';

            const errorMsg =
              responseData?.error ||
              (responseText && responseText.trim().length > 0
                ? `Resposta não-JSON: ${responseText.slice(0, 200)}`
                : fallbackMsg);

            console.error("[IMPORT] request failed:", errorMsg);
            result.errors.push(`Erro no chunk ${chunkIdx + 1}/${totalChunks}: ${errorMsg}`);
            chunkFailed = true;
            toast.error(`Falha no chunk ${chunkIdx + 1}: ${errorMsg}`);
            break;
          }

          result.chunks_processed = chunkIdx + 1;

          // Track finalization
          if (responseData.is_finalized) {
            result.is_finalized = true;
          }

          // Accumulate stats from each chunk (RPC returns per-chunk stats, not cumulative)
          if (responseData.stats) {
            result.stats.topics_created += (responseData.stats.topics_created || 0);
            result.stats.topics_reused += (responseData.stats.topics_reused || 0);
            result.stats.questions_inserted += (responseData.stats.questions_inserted || 0);
            result.stats.questions_updated += (responseData.stats.questions_updated || 0);
            result.stats.questions_skipped += (responseData.stats.questions_skipped || 0);
            result.stats.questions_linked += (responseData.stats.questions_linked || 0);
            result.stats.questions_reactivated += (responseData.stats.questions_reactivated || 0);
            result.stats.low_quality += (responseData.stats.low_quality || 0);
            result.stats.updated_details = [
              ...(result.stats.updated_details || []),
              ...(responseData.stats.updated_details || []),
            ];
          }

          // Update progress
          setImportProgress(Math.round(((chunkIdx + 1) / totalChunks) * 90));
        }

        if (chunkFailed) {
          // Don't continue with other disciplines if a chunk failed
          break;
        }
      }

      setImportProgress(100);
      setImportStatus(result.is_finalized ? 'Importação finalizada!' : 'Importação concluída (verifique status)');
      setImportResult(result);

      const statsMessage = `${result.stats.questions_inserted} inserida(s), ${result.stats.questions_updated} atualizada(s), ${result.stats.questions_skipped} ignorada(s), ${result.stats.questions_linked} vinculada(s), ${result.stats.questions_reactivated} reativada(s), ${result.stats.topics_created} tópico(s) novo(s)`;
      
      if (result.errors.length === 0 && result.is_finalized) {
        toast.success(`Importação concluída com sucesso! ${statsMessage}`);
        setParsedStructure([]);
        setPreviewInfo(null);
      } else if (result.errors.length > 0) {
        toast.warning(`Importação parou com ${result.errors.length} erro(s). Chunks processados: ${result.chunks_processed}. ${statsMessage}`);
      } else {
        toast.info(`Importação concluída. ${statsMessage}`);
      }

    } catch (error: any) {
      console.error('Import error:', error);
      toast.error('Erro durante a importação: ' + error.message);
      result.errors.push(`Erro geral: ${error.message}`);
      setImportResult(result);
    } finally {
      setIsImporting(false);
    }
  };

  const getTotalQuestions = () => {
    return parsedStructure.reduce((sum, f) => 
      sum + f.notebooks.reduce((s, n) => s + n.questions.length, 0), 0
    );
  };

  const getTotalNotebooks = () => {
    return parsedStructure.reduce((s, f) => s + f.notebooks.length, 0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderArchive className="w-5 h-5" />
          Adicionar Tópicos e Questões — Pré-Edital (Disciplinas Fonte)
        </CardTitle>
        <CardDescription>
          Importe questões de um arquivo ZIP <strong>exclusivamente para disciplinas-fonte</strong> (pré-edital).
          O sistema detecta duplicatas automaticamente via hash SHA-256.
          Estrutura esperada: Disciplina/Tópico/arquivo.json
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Important Notice */}
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm">
          <div className="flex items-start gap-2">
            <Layers className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-blue-700">Modo Pré-Edital (Fonte)</p>
              <p className="text-muted-foreground mt-1">
                Este ZIP adicionará tópicos e questões <strong>apenas nas disciplinas-fonte</strong> (is_source=true, generation_type=zip_import).
                Disciplinas pós-edital <strong>não serão alteradas</strong>. A sincronização para pós-edital é feita manualmente em outra tela.
              </p>
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <div 
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isLoading || isImporting}
          />
          
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-muted-foreground">Processando arquivo ZIP...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="font-medium">Clique para selecionar um arquivo ZIP</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Estrutura esperada: Disciplina/Tópico/questoes.json
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Preview Info - Source Discipline Mode Detection */}
        {previewInfo && (
          <div className={`p-4 rounded-lg border ${previewInfo.isMergeMode ? 'border-blue-500 bg-blue-500/10' : previewInfo.isNewDiscipline ? 'border-green-500 bg-green-500/10' : 'border-destructive bg-destructive/10'}`}>
            <div className="flex items-start gap-3">
              {previewInfo.isMergeMode ? (
                <RefreshCw className="w-5 h-5 text-blue-600 mt-0.5" />
              ) : previewInfo.isNewDiscipline ? (
                <Plus className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {previewInfo.isMergeMode 
                    ? `✅ Modo MERGE (Pré-Edital): Disciplina-fonte "${previewInfo.disciplineName}" encontrada`
                    : previewInfo.isNewDiscipline 
                      ? `➕ Disciplina-fonte "${previewInfo.disciplineName}" será CRIADA (Pré-Edital)`
                      : `❌ Disciplina "${previewInfo.disciplineName}" existe, mas NÃO é fonte (pós-edital) — Importação bloqueada`
                  }
                </p>
                
                {!previewInfo.isMergeMode && !previewInfo.isNewDiscipline && (
                  <p className="text-sm text-destructive mt-2">
                    Este ZIP só pode importar para disciplinas-fonte (is_source=true, generation_type=zip_import).
                    A sincronização para pós-edital deve ser feita manualmente na tela de edição do edital/escola.
                  </p>
                )}
                
                {(previewInfo.isMergeMode || previewInfo.isNewDiscipline) && (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-green-600 flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Tópicos novos: {previewInfo.newTopics.length}
                        </p>
                        {previewInfo.newTopics.length > 0 && (
                          <ul className="text-muted-foreground mt-1 list-disc pl-4">
                            {previewInfo.newTopics.slice(0, 5).map((t, i) => (
                              <li key={i}>{t}</li>
                            ))}
                            {previewInfo.newTopics.length > 5 && (
                              <li>...e mais {previewInfo.newTopics.length - 5}</li>
                            )}
                          </ul>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-blue-600 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" /> Tópicos existentes: {previewInfo.existingTopics.length}
                        </p>
                        {previewInfo.existingTopics.length > 0 && (
                          <ul className="text-muted-foreground mt-1 list-disc pl-4">
                            {previewInfo.existingTopics.slice(0, 5).map((t, i) => (
                              <li key={i}>{t}</li>
                            ))}
                            {previewInfo.existingTopics.length > 5 && (
                              <li>...e mais {previewInfo.existingTopics.length - 5}</li>
                            )}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* Hash V4 missing warning - blocks import */}
                    {previewInfo.isMergeMode && (previewInfo.questionsWithoutHashV4 ?? 0) > 0 && (
                      <div className="mt-3 p-3 rounded-lg border border-destructive bg-destructive/10 text-sm">
                        <p className="font-medium text-destructive flex items-center gap-2">
                          <XCircle className="w-4 h-4" />
                          🚫 Importação BLOQUEADA — {previewInfo.questionsWithoutHashV4} de {previewInfo.totalExistingQuestions} questões existentes não possuem match_hash (V4)
                        </p>
                        <p className="text-muted-foreground mt-2">
                          A reimportação sem hash V4 nas questões antigas criará <strong>duplicatas</strong> em vez de atualizar.
                        </p>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="mt-3"
                          disabled={isBackfilling}
                          onClick={handleBackfillHashV4}
                        >
                          {isBackfilling ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Calculando hashes...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Executar Backfill V4 ({previewInfo.questionsWithoutHashV4} questões)
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    <div className="mt-3 p-2 rounded bg-muted/50 text-sm">
                      <p className="text-muted-foreground">
                        💡 Questões duplicadas serão atualizadas automaticamente via hash SHA-256.
                        <br/>
                        ⚠️ <strong>Pós-edital NÃO será alterado</strong> — apenas a disciplina-fonte.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Parsed Structure Preview */}
        {parsedStructure.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="gap-1">
                  <FolderOpen className="w-3 h-3" />
                  {parsedStructure.length} Disciplina(s)
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <BookOpen className="w-3 h-3" />
                  {getTotalNotebooks()} Caderno(s)
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <FileJson className="w-3 h-3" />
                  {getTotalQuestions()} Questão(ões)
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setParsedStructure([]);
                    setPreviewInfo(null);
                  }}
                  disabled={isImporting}
                >
                  Limpar
                </Button>
                {/* Hidden test button - visible only to developers (shift+click to activate) */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 hover:opacity-100 text-xs"
                  onClick={(e) => {
                    if (e.shiftKey && previewInfo?.disciplineId) {
                      console.log('🧪 Running 3-chunk test...');
                      runChunkedImportTest(previewInfo.disciplineId);
                    } else {
                      console.log('💡 Shift+Click to run 3-chunk test. Or use: window.__testChunkedImport("discipline-id")');
                    }
                  }}
                  title="Shift+Click para testar 3 chunks"
                >
                  Test
                </Button>
                <Button
                  onClick={() => setConfirmDialogOpen(true)}
                  disabled={isImporting || (previewInfo && !previewInfo.isMergeMode && !previewInfo.isNewDiscipline) || (previewInfo?.isMergeMode && (previewInfo?.questionsWithoutHashV4 ?? 0) > 0)}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Importar via RPC
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[400px] border rounded-lg p-4">
              <Accordion type="multiple" className="w-full">
                {parsedStructure.map((folder, folderIdx) => (
                  <AccordionItem key={folderIdx} value={`folder-${folderIdx}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                          <FolderOpen className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium">{folder.name}</span>
                        <Badge variant="secondary" className="ml-2">
                          {folder.notebooks.length} caderno(s)
                        </Badge>
                        <Badge variant="outline">
                          {folder.notebooks.reduce((s, n) => s + n.questions.length, 0)} questão(ões)
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pl-11 space-y-2">
                        {folder.notebooks.map((notebook, nbIdx) => (
                          <div 
                            key={nbIdx}
                            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                          >
                            <BookOpen className="w-4 h-4 text-muted-foreground" />
                            <span>{notebook.name}</span>
                            <Badge variant="outline" className="ml-auto">
                              {notebook.questions.length} questão(ões)
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
          </div>
        )}

        {/* Import Progress */}
        {isImporting && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="font-medium">{importStatus}</span>
            </div>
            <Progress value={importProgress} />
            <p className="text-sm text-muted-foreground text-right">{importProgress}%</p>
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div className={`p-4 rounded-lg border ${importResult.errors.length > 0 ? 'border-warning bg-warning/10' : 'border-green-500 bg-green-500/10'}`}>
            <div className="flex items-start gap-3">
              {importResult.errors.length > 0 ? (
                <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {importResult.errors.length > 0 
                    ? `Importação parou com erros (${importResult.chunks_processed} chunk(s) processado(s))` 
                    : importResult.is_finalized 
                      ? 'Importação finalizada com sucesso!'
                      : 'Importação concluída'}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm text-muted-foreground">
                  <span className="text-green-600">{importResult.stats.questions_inserted} inserida(s)</span>
                  <span className="text-orange-600">{importResult.stats.questions_updated} atualizada(s)</span>
                  <span className="text-blue-600">{importResult.stats.questions_skipped} ignorada(s)</span>
                  <span className="text-purple-600">{importResult.stats.questions_linked} vinculada(s)</span>
                  {importResult.stats.questions_reactivated > 0 && (
                    <span className="text-emerald-600">🔄 {importResult.stats.questions_reactivated} reativada(s)</span>
                  )}
                  <span className="text-green-600">{importResult.stats.topics_created} tópico(s) novo(s)</span>
                  <span className="text-blue-600">{importResult.stats.topics_reused} tópico(s) reusado(s)</span>
                  <span className="text-yellow-600">{importResult.stats.low_quality} low-quality</span>
                </div>
                {/* Relatório de questões atualizadas */}
                {importResult.stats.updated_details && importResult.stats.updated_details.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-orange-600 mb-1">
                      Questões atualizadas ({importResult.stats.updated_details.length}):
                    </p>
                    <div className="max-h-40 overflow-y-auto">
                      <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1 font-mono">
                        {importResult.stats.updated_details.slice(0, 50).map((detail, idx) => (
                          <li key={idx}>
                            <span className="select-all cursor-pointer hover:text-foreground">{detail.question_id}</span>
                            {detail.changes && Object.keys(detail.changes).length > 0 && (
                              <span className="ml-1 text-orange-500">
                                [{Object.keys(detail.changes).join(', ')}]
                              </span>
                            )}
                          </li>
                        ))}
                        {importResult.stats.updated_details.length > 50 && (
                          <li>...e mais {importResult.stats.updated_details.length - 50} questão(ões)</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
                <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-4">
                  {importResult.batch_id && (
                    <span className="font-mono">
                      Batch: <span className="select-all cursor-pointer hover:text-foreground">{importResult.batch_id}</span>
                    </span>
                  )}
                  <span>Chunks: {importResult.chunks_processed}</span>
                  <span>Status: {importResult.is_finalized ? '✅ Finalizado' : '⏳ Não finalizado'}</span>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-warning mb-1">Erros:</p>
                    <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                      {importResult.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                      {importResult.errors.length > 5 && (
                        <li>...e mais {importResult.errors.length - 5} erro(s)</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Confirmar Importação — Pré-Edital (Fonte)
              </DialogTitle>
              <DialogDescription>
                Este ZIP será importado <strong>exclusivamente na disciplina-fonte</strong>.
                Pós-edital, escolas e cronogramas <strong>não serão afetados</strong>.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3 py-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <FolderOpen className="w-5 h-5 text-primary" />
                <span><strong>{parsedStructure.length}</strong> disciplina(s) fonte</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <BookOpen className="w-5 h-5 text-primary" />
                <span><strong>{getTotalNotebooks()}</strong> tópico(s)</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <Layers className="w-5 h-5 text-primary" />
                <span><strong>{getTotalQuestions()}</strong> questão(ões)</span>
              </div>
              {getTotalQuestions() > MAX_QUESTIONS_PER_CHUNK && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500">
                  <RefreshCw className="w-5 h-5 text-amber-600" />
                  <span className="text-sm">
                    Será dividido em <strong>{Math.ceil(getTotalQuestions() / MAX_QUESTIONS_PER_CHUNK)}</strong>+ chunks.
                  </span>
                </div>
              )}
            </div>

            <div className="text-sm text-muted-foreground space-y-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p>
                ✅ Questões duplicadas serão atualizadas (hash SHA-256).
              </p>
              <p>
                ✅ Novos tópicos aparecerão automaticamente em Metas e Revisões (sem metas criadas).
              </p>
              <p className="font-medium text-blue-700">
                ⚠️ Pós-edital NÃO será alterado — sincronização é feita manualmente.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleImport}>
                <Upload className="w-4 h-4 mr-2" />
                Confirmar Importação (Pré-Edital)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
