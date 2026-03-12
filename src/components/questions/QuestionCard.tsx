import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  BookmarkPlus,
  MessageSquare,
  MessageCircle,
  BarChart,
  BookOpen,
  PenLine,
  Flag,
  Scissors,
  ChevronDown,
  ChevronUp,
  Bot
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Question } from "@/hooks/useQuestions";
import { supabase } from "@/integrations/supabase/client";
import { ReportErrorDialog } from "./ReportErrorDialog";
import { QuestionComments } from "./QuestionComments";
import { QuestionTutorDialog } from "./QuestionTutorDialog";
import { sanitizeHTML } from "@/hooks/useSanitizedHTML";
import { useAuth } from "@/hooks/useAuth";
import { useCardAccess } from "@/hooks/useCardAccess";

interface QuestionCardProps {
  question: Question;
  index: number;
  onSubmitAnswer: (questionId: string, answer: string) => Promise<{ isCorrect: boolean; correctAnswer: string; profComment: string | null } | null>;
  onAddToNotebook?: (questionId: string) => void;
  onCreateNote?: (question: Question) => void;
  filterDisciplineId?: string | null;
  filterTopicId?: string | null;
}

interface AnswerStats {
  [key: string]: number;
}

type RichTextResult = {
  html: string;
  extractedImageUrls: string[];
};

/**
 * Check if a URL points to an image.
 * Handles:
 * - Standard image extensions (.png, .jpg, .webp, .gif)
 * - Cloudflare Images URLs (imagedelivery.net/.../public)
 * - S3/storage URLs that may have image extensions
 */
const isImageUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  
  // Standard image extensions
  if (/\.(png|jpe?g|webp|gif|svg|bmp|ico)(\?.*)?$/i.test(url)) {
    return true;
  }
  
  // Cloudflare Images (imagedelivery.net/xxx/public or /variant)
  if (/imagedelivery\.net\/[^/]+\/[^/]+\/(public|thumbnail|avatar|[a-z]+)$/i.test(url)) {
    return true;
  }
  
  // Generic image hosting patterns
  if (/\/(image|img|photo|picture|media)\//i.test(url) && /^https?:\/\//i.test(url)) {
    // Only if it doesn't look like a document/page
    if (!/\.(html?|php|aspx?|jsp)(\?.*)?$/i.test(url)) {
      return true;
    }
  }
  
  return false;
};

const stripAnchors = (html: string) => html.replace(/<a\b[^>]*>/gi, '').replace(/<\/a>/gi, '');

const normalizeImgAttributes = (html: string) => {
  // Promote common lazy attributes into src so images render
  return html
    .replace(/<img([^>]*?)\sdata-src="([^"]+)"([^>]*?)>/gi, '<img$1 src="$2"$3>')
    .replace(/<img([^>]*?)\sdata-original="([^"]+)"([^>]*?)>/gi, '<img$1 src="$2"$3>')
    .replace(/<img([^>]*?)\sdata-lazy-src="([^"]+)"([^>]*?)>/gi, '<img$1 src="$2"$3>');
};

/**
 * P0 FIX: Remove Bootstrap collapse classes and visibility-hiding attributes
 * that prevent content from being displayed.
 * 
 * SAFE VERSION:
 * - Only removes 'collapse' and 'collapsing' classes (NOT 'in'/'show' which are generic)
 * - Removes collapse control attributes (aria-expanded, data-toggle, etc.)
 * - Uses DOMParser with regex fallback for SSR/Node compatibility
 * - Early-return if no problematic patterns detected (performance optimization)
 */
const stripProblematicBootstrapCollapse = (html: string): string => {
  if (!html || typeof html !== 'string') return html || '';
  
  // Early-return: skip parsing if no collapse patterns detected
  const hasCollapsePatterns = /\b(collapse|collapsing)\b/i.test(html) ||
    /aria-expanded|data-toggle|data-target|data-bs-toggle|data-bs-target/i.test(html);
  if (!hasCollapsePatterns) return html;
  
  // Check for DOMParser availability (browser environment)
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // Remove ONLY 'collapse' and 'collapsing' classes (NOT 'in'/'show' - too generic)
      doc.querySelectorAll('[class]').forEach((el) => {
        const classes = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
        const collapseClasses = ['collapse', 'collapsing'];
        
        const filtered = classes.filter(
          (c) => !collapseClasses.includes(c.toLowerCase())
        );

        if (filtered.length) {
          el.setAttribute('class', filtered.join(' '));
        } else {
          el.removeAttribute('class');
        }
      });

      // Remove attributes that control Bootstrap collapse visibility
      doc.querySelectorAll('[aria-expanded],[data-toggle],[data-target],[data-bs-toggle],[data-bs-target]').forEach((el) => {
        el.removeAttribute('aria-expanded');
        el.removeAttribute('data-toggle');
        el.removeAttribute('data-target');
        el.removeAttribute('data-bs-toggle');
        el.removeAttribute('data-bs-target');
      });

      return doc.body.innerHTML;
    } catch {
      // Fall through to regex fallback
    }
  }
  
  // Regex fallback for SSR/Node or DOMParser failure
  return html
    // Remove 'collapse' and 'collapsing' from class attributes (NOT 'in'/'show')
    .replace(/\bclass="([^"]*)"/gi, (_match, classes) => {
      const filtered = classes
        .split(/\s+/)
        .filter((c: string) => !['collapse', 'collapsing'].includes(c.toLowerCase()))
        .join(' ')
        .trim();
      return filtered ? `class="${filtered}"` : '';
    })
    // Remove collapse control attributes
    .replace(/\s*aria-expanded="[^"]*"/gi, '')
    .replace(/\s*data-toggle="[^"]*"/gi, '')
    .replace(/\s*data-target="[^"]*"/gi, '')
    .replace(/\s*data-bs-toggle="[^"]*"/gi, '')
    .replace(/\s*data-bs-target="[^"]*"/gi, '');
};

/**
 * P0 FIX: Remove inline styles that hide content.
 * 
 * SAFE VERSION:
 * - Removes: display:none, visibility:hidden, height:0, max-height:0, overflow:hidden
 * - Does NOT remove height:\d+px globally (too dangerous - breaks layouts)
 * - Removes color/background that can make text invisible
 * - Uses DOMParser with regex fallback for SSR/Node compatibility
 * - Early-return if no style attributes detected (performance optimization)
 */
const stripProblematicInlineStyles = (html: string): string => {
  if (!html || typeof html !== 'string') return html || '';
  
  // Early-return: skip parsing if no style attributes detected
  if (!html.includes('style=')) return html;
  
  const cleanStyleString = (style: string): string => {
    return style
      // Remove visibility-hiding styles
      .replace(/display\s*:\s*none\s*(!important)?\s*;?/gi, '')
      .replace(/visibility\s*:\s*hidden\s*(!important)?\s*;?/gi, '')
      // Remove ONLY zero height/max-height (NOT arbitrary px values)
      .replace(/height\s*:\s*0(px)?\s*(!important)?\s*;?/gi, '')
      .replace(/max-height\s*:\s*0(px)?\s*(!important)?\s*;?/gi, '')
      // Remove overflow hidden that can clip content
      .replace(/overflow\s*:\s*hidden\s*(!important)?\s*;?/gi, '')
      // Remove color/background that can make text invisible
      .replace(/(^|;)\s*(color|background|background-color|font-size)\s*:\s*[^;]+/gi, '$1')
      // Clean up multiple semicolons and whitespace
      .replace(/;;+/g, ';')
      .replace(/^\s*;\s*/g, '')
      .replace(/\s*;\s*$/g, '')
      .trim();
  };
  
  // Check for DOMParser availability (browser environment)
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');

      doc.querySelectorAll('[style]').forEach((el) => {
        const style = el.getAttribute('style') || '';
        if (!style) return;

        const cleaned = cleanStyleString(style);

        if (cleaned) {
          el.setAttribute('style', cleaned);
        } else {
          el.removeAttribute('style');
        }
      });

      return doc.body.innerHTML;
    } catch {
      // Fall through to regex fallback
    }
  }
  
  // Regex fallback for SSR/Node or DOMParser failure
  return html.replace(/\sstyle="([^"]*)"/gi, (_match, style) => {
    const cleaned = cleanStyleString(style);
    return cleaned ? ` style="${cleaned}"` : '';
  });
};

const extractInlineImageUrls = (html: string) => {
  const urls: string[] = [];

  // 1) JSON arrays printed as text: ["https://...png"]
  const jsonArrayRe = /\[\s*"https?:\/\/[^\]"]+"(?:\s*,\s*"https?:\/\/[^\]"]+")*\s*\]/g;
  html = html.replace(jsonArrayRe, (match) => {
    try {
      const parsed = JSON.parse(match);
      if (Array.isArray(parsed)) {
        const imageUrls = parsed.filter((u) => typeof u === 'string' && isImageUrl(u));
        if (imageUrls.length > 0) {
          urls.push(...imageUrls);
          return '';
        }
      }
    } catch {
      // ignore
    }
    return match;
  });

  // 2) Bare image URLs in text (we remove them and render as images instead)
  const urlRe = /https?:\/\/[^\s"'<>]+?\.(?:png|jpe?g|webp|gif)(?:\?[^\s"'<>]+)?/gi;
  html = html.replace(urlRe, (match: string, offset: number, full: string) => {
    const before = full.slice(Math.max(0, offset - 12), offset).toLowerCase();
    // Keep URLs that are already inside a src attribute
    if (before.includes('src=')) return match;
    urls.push(match);
    return '';
  });

  return { html, urls };
};

const parseQuestionImagesField = (images: any): string[] => {
  const urls: string[] = [];
  if (!images) return urls;

  const pushUrl = (u: any) => {
    if (typeof u === 'string' && isImageUrl(u)) urls.push(u);
  };

  try {
    if (Array.isArray(images)) {
      for (const item of images) {
        if (typeof item === 'string') {
          // Sometimes a JSON array is stored as a single string inside an array
          if (item.trim().startsWith('[')) {
            try {
              const parsed = JSON.parse(item);
              if (Array.isArray(parsed)) parsed.forEach(pushUrl);
              else pushUrl(item);
            } catch {
              pushUrl(item);
            }
          } else {
            pushUrl(item);
          }
        } else if (item && typeof item === 'object') {
          pushUrl(item.url);
          pushUrl(item.src);
        }
      }
      return Array.from(new Set(urls));
    }

    if (typeof images === 'string') {
      const trimmed = images.trim();
      if (trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) parsed.forEach(pushUrl);
      } else {
        pushUrl(trimmed);
      }
      return Array.from(new Set(urls));
    }

    if (images && typeof images === 'object') {
      pushUrl(images.url);
      pushUrl(images.src);
      return Array.from(new Set(urls));
    }
  } catch {
    // ignore
  }

  return Array.from(new Set(urls));
};

// Convert inline "( )" markers to line breaks for better readability
const formatParenthesesItems = (html: string): string => {
  // Pattern: ( ) followed by text - these are typically list items that should be on separate lines
  // Match "( )" or "( )" with possible whitespace variations, NOT at the very beginning
  return html.replace(/(?<!^)(?<!\n)\s*\(\s*\)\s*/g, '<br/><br/>( ) ');
};

const prepareQuestionHtml = (raw: string | null | undefined): RichTextResult => {
  if (!raw) return { html: '', extractedImageUrls: [] };

  const trimmed = raw.trim();
  
  // Handle pure JSON array of URLs (e.g., '["https://...png"]')
  // This is common for associated_text containing only images
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const imageUrls = parsed
          .filter((u): u is string => typeof u === 'string' && isImageUrl(u));
        if (imageUrls.length > 0) {
          // Return empty HTML but with extracted image URLs
          return { html: '', extractedImageUrls: imageUrls };
        }
      }
    } catch {
      // Not valid JSON, continue with normal processing
    }
  }

  // Handle plain text URL (not wrapped in HTML or JSON)
  // e.g., "https://s3.amazonaws.com/..."
  if (trimmed.startsWith('http') && !trimmed.includes('<') && !trimmed.includes('\n')) {
    // Single URL on its own - treat as image if it's an image URL
    if (isImageUrl(trimmed)) {
      return { html: '', extractedImageUrls: [trimmed] };
    }
    // Non-image URL - don't display raw URL, just return empty
    return { html: '', extractedImageUrls: [] };
  }

  let html = normalizeImgAttributes(raw);
  
  // P0 FIX: Strip Bootstrap collapse classes and attributes BEFORE sanitization
  // This ensures collapsed content becomes visible
  html = stripProblematicBootstrapCollapse(html);
  
  // P0 FIX: Strip visibility-hiding inline styles
  html = stripProblematicInlineStyles(html);

  const extracted = extractInlineImageUrls(html);
  html = extracted.html;

  // Format parentheses items before sanitization (so <br/> gets preserved)
  html = formatParenthesesItems(html);

  const sanitized = stripAnchors(sanitizeHTML(html));

  return {
    html: sanitized,
    extractedImageUrls: Array.from(new Set(extracted.urls)),
  };
};

export function QuestionCard({ question, index, onSubmitAnswer, onAddToNotebook, onCreateNote, filterDisciplineId, filterTopicId }: QuestionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false); // Always start fresh for new attempt
  const [isCorrect, setIsCorrect] = useState<boolean | undefined>(undefined);
  const [correctAnswer, setCorrectAnswer] = useState<string | undefined>(undefined);
  const [profComment, setProfComment] = useState<string | null | undefined>(question.prof_comment);
  const [strikethroughOptions, setStrikethroughOptions] = useState<Set<string>>(new Set());
  const [showDissecada, setShowDissecada] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [answerStats, setAnswerStats] = useState<AnswerStats>({});
  const [loadingStats, setLoadingStats] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [showTutorDialog, setShowTutorDialog] = useState(false);

  const { user } = useAuth();
  const { isCardUnlocked } = useCardAccess(user?.id);
  const hasTutorAccess = isCardUnlocked("robo-tutor");
  const [showAllProvas, setShowAllProvas] = useState(false);

  // Sort disciplines and topics to prioritize filter matches
  const sortedDisciplines = (() => {
    const disciplines = question.all_disciplines || [];
    if (!filterDisciplineId || disciplines.length <= 1) return disciplines;
    return [...disciplines].sort((a, b) => {
      if (a.id === filterDisciplineId) return -1;
      if (b.id === filterDisciplineId) return 1;
      return 0;
    });
  })();

  const sortedTopics = (() => {
    const topics = question.all_topics || [];
    if (!filterTopicId || topics.length <= 1) return topics;
    return [...topics].sort((a, b) => {
      if (a.id === filterTopicId) return -1;
      if (b.id === filterTopicId) return 1;
      return 0;
    });
  })();

  const options = [
    { key: 'A', value: question.option_a },
    { key: 'B', value: question.option_b },
    { key: 'C', value: question.option_c },
    { key: 'D', value: question.option_d },
    { key: 'E', value: question.option_e },
  ].filter(opt => opt.value);

  const isTrueFalse = question.question_type === 'tf';

  const richAssociated = useMemo(
    () => prepareQuestionHtml(question.associated_text),
    [question.associated_text]
  );

  const richQuestion = useMemo(
    () => prepareQuestionHtml(question.question),
    [question.question]
  );

  const imagesFromField = useMemo(
    () => parseQuestionImagesField((question as any).images),
    [question]
  );

  // Check if an image URL appears in HTML content (to avoid duplication)
  const isImageInHtml = (url: string, html: string): boolean => {
    if (!url || !html) return false;
    
    // Normalize URL for comparison: remove protocol, trailing slashes, query params variations
    const normalizeUrl = (u: string) => {
      return u
        .replace(/^https?:/, '')  // Remove protocol
        .replace(/\/+$/, '')      // Remove trailing slashes
        .split('?')[0]            // Remove query params for base comparison
        .toLowerCase();
    };
    
    const normalizedUrl = normalizeUrl(url);
    const normalizedHtml = html.replace(/https?:/g, '').toLowerCase();
    
    // Direct inclusion check
    if (normalizedHtml.includes(normalizedUrl)) return true;
    
    // Also check just the filename/path portion (handles CDN URL variations)
    const urlPath = normalizedUrl.split('/').slice(-2).join('/'); // Last 2 path segments
    if (urlPath && urlPath.length > 10 && normalizedHtml.includes(urlPath)) return true;
    
    return false;
  };

  const mergedImageUrls = useMemo(() => {
    // Use RAW HTML (before sanitization) for duplicate detection
    // This ensures we catch images that might be modified during sanitization
    const rawHtmlForDetection = (question.associated_text || '') + (question.question || '');
    
    // Filter out images that already appear in the RAW HTML content
    const filteredImagesFromField = imagesFromField.filter(
      url => !isImageInHtml(url, rawHtmlForDetection)
    );
    
    const urls = [
      ...filteredImagesFromField,
      ...richAssociated.extractedImageUrls,
      ...richQuestion.extractedImageUrls,
    ]
      .map((u) => String(u || '').trim())
      .filter(Boolean);
    return Array.from(new Set(urls));
  }, [imagesFromField, richAssociated, richQuestion, question.associated_text, question.question]);

  // Categorize image rendering: 'text' (português etc), 'formula' (math/physics/chemistry), 'default'
  type ImageCategory = 'text' | 'formula' | 'default';
  const imageCategory = useMemo((): ImageCategory => {
    const textKeywords = [
      'portugues', 'letras', 'redacao', 'literatura',
      'lingua portuguesa', 'interpretacao de texto', 'compreensao textual',
      'ingles', 'lingua inglesa', 'lingua estrangeira',
      'espanhol', 'lingua espanhola',
    ];
    const formulaKeywords = [
      'matematica', 'fisica', 'quimica',
      'calculo', 'algebra', 'geometria', 'trigonometria',
      'estatistica', 'raciocinio logico',
    ];
    
    const normalize = (str: string) => 
      (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    const allNames: string[] = [];
    (question.all_disciplines || []).forEach(d => allNames.push(normalize(d.name)));
    allNames.push(normalize(question.discipline_name || ''));
    allNames.push(normalize(question.prova_name || ''));
    
    const matchesAny = (keywords: string[]) =>
      allNames.some(name => keywords.some(kw => name.includes(kw)));
    
    if (matchesAny(formulaKeywords)) return 'formula';
    if (matchesAny(textKeywords)) return 'text';
    return 'default';
  }, [question.all_disciplines, question.prova_name, question.discipline_name]);

  const getImageStyle = (category: ImageCategory): React.CSSProperties => {
    switch (category) {
      case 'text':
        return { width: '100%', maxWidth: '720px', height: 'auto' };
      case 'formula':
        return { width: 'auto', maxWidth: '100%', height: 'auto' };
      default:
        return { width: 'auto', maxWidth: '100%', maxHeight: '500px' };
    }
  };

  // P0 FIX VALIDATED - Debug logs removed after confirmation

  // Format question code: DQ-XXXYYYYYYY (uppercase, preserve zeros)
  const formatQuestionCode = (code: string) => {
    // If already in correct format, just ensure uppercase
    if (code && code.toUpperCase().startsWith('DQ-')) {
      return code.toUpperCase();
    }
    // Fallback for old format codes
    return code;
  };

  const loadStats = async () => {
    if (loadingStats || Object.keys(answerStats).length > 0) {
      setShowStats(!showStats);
      return;
    }
    
    setLoadingStats(true);
    try {
      const { data, error } = await supabase
        .from('user_answers')
        .select('selected_answer')
        .eq('question_id', question.id);
      
      if (error) throw error;
      
      const stats: AnswerStats = {};
      (data || []).forEach(answer => {
        stats[answer.selected_answer] = (stats[answer.selected_answer] || 0) + 1;
      });
      
      setAnswerStats(stats);
      setShowStats(true);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const totalAnswers = Object.values(answerStats).reduce((sum, count) => sum + count, 0);

  // Map V/F (user selection) to C/E (database format) for tf questions
  const mapAnswerToDb = (answer: string): string => {
    if (!isTrueFalse) return answer;
    if (answer === 'V') return 'C';
    if (answer === 'F') return 'E';
    return answer;
  };

  // Map C/E (database format) to V/F (display format) for tf questions
  const mapAnswerFromDb = (answer: string): string => {
    if (!isTrueFalse) return answer;
    if (answer === 'C') return 'V';
    if (answer === 'E') return 'F';
    return answer;
  };

  // Format answer for display (Certo/Errado for tf, Letra X for multiple choice)
  const formatAnswerDisplay = (answer: string): string => {
    if (!answer) return 'Gabarito indisponível';
    if (!isTrueFalse) return `Letra ${answer}`;
    if (answer === 'C' || answer === 'V') return 'Certo';
    if (answer === 'E' || answer === 'F') return 'Errado';
    return answer;
  };

  const handleSubmit = async () => {
    if (!selectedAnswer) return;

    setIsSubmitting(true);
    // Convert V/F to C/E before sending to backend
    const answerToSend = mapAnswerToDb(selectedAnswer);
    const result = await onSubmitAnswer(question.id, answerToSend);
    
    if (result !== null) {
      setHasSubmitted(true);
      setIsCorrect(result.isCorrect);
      // Store the correct answer in display format (V/F for tf)
      setCorrectAnswer(mapAnswerFromDb(result.correctAnswer));
      setProfComment(result.profComment);
    }
    setIsSubmitting(false);
  };

  const toggleStrikethrough = (optionKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStrikethroughOptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(optionKey)) {
        newSet.delete(optionKey);
      } else {
        newSet.add(optionKey);
      }
      return newSet;
    });
  };

  const OptionCircle = ({ letter }: { letter: string }) => {
    // All options in blue except V (green) and F (red)
    let bgColor = 'bg-blue-500';
    if (letter === 'V') bgColor = 'bg-green-500';
    if (letter === 'F') bgColor = 'bg-red-500';
    
    return (
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 text-white",
        bgColor
      )}>
        {letter}
      </div>
    );
  };

  const getStatusBorder = () => {
    if (!hasSubmitted) return "border-l-4 border-l-blue-500";
    return isCorrect 
      ? "border-l-4 border-l-green-500" 
      : "border-l-4 border-l-red-500";
  };

  // Helper to format prof_comment - replace "Gabarito: Gabarito X" with "Letra X"
  const formatProfComment = (comment: string | null | undefined) => {
    if (!comment) return comment;
    // Replace variations of "Gabarito: Gabarito X" or "Gabarito X" patterns
    let formatted = comment.replace(/Gabarito:\s*Gabarito\s+([A-E])/gi, 'Letra $1');
    formatted = formatted.replace(/Gabarito\s+([A-E])(?!\w)/gi, 'Letra $1');
    return formatted;
  };

  return (
    <Card 
      className={cn(
        "bg-white hover:shadow-md transition-all animate-fade-in border border-slate-200 overflow-hidden",
        getStatusBorder()
      )}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <CardContent className="p-0">
        {/* Header Section - Gray background */}
        <div className="bg-slate-100 px-5 py-3 border-b border-slate-200">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5 flex-1">
              {/* Question number, code and discipline breadcrumb */}
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-black font-bold">{index + 1}</span>
                <span className="text-slate-600 font-medium">{formatQuestionCode(question.code)}</span>
                {/* Show first discipline (prioritized by filter) */}
                {sortedDisciplines.length > 0 && (
                  <>
                    <span className="text-slate-400">›</span>
                    <span className={cn(
                      "text-slate-600",
                      sortedDisciplines[0].id === filterDisciplineId && "font-semibold text-primary"
                    )}>
                      {sortedDisciplines[0].name}
                    </span>
                    {sortedDisciplines.length > 1 && (
                      <span className="text-slate-400 text-xs">
                        +{sortedDisciplines.length - 1}
                      </span>
                    )}
                  </>
                )}
              </div>
              
              {/* Topics row with collapsible overflow */}
              {sortedTopics.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-slate-500 font-medium flex-shrink-0">Tópicos:</span>
                  <div className="flex-1 min-w-0">
                    {!showAllTopics ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={cn(
                          "text-slate-600 truncate max-w-[500px]",
                          sortedTopics[0].id === filterTopicId && "font-semibold text-primary"
                        )}>
                          {sortedTopics[0].name}
                        </span>
                        {sortedTopics.length > 1 && (
                          <button
                            onClick={() => setShowAllTopics(true)}
                            className="flex items-center gap-0.5 text-blue-600 hover:text-blue-700 text-xs font-medium flex-shrink-0"
                          >
                            +{sortedTopics.length - 1} mais
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {sortedTopics.map((t, idx) => (
                          <span 
                            key={t.id} 
                            className={cn(
                              "text-slate-600 block",
                              t.id === filterTopicId && "font-semibold text-primary"
                            )}
                          >
                            {t.name}{idx < sortedTopics.length - 1 ? ',' : ''}
                          </span>
                        ))}
                        <button
                          onClick={() => setShowAllTopics(false)}
                          className="flex items-center gap-0.5 text-blue-600 hover:text-blue-700 text-xs font-medium"
                        >
                          Recolher
                          <ChevronUp className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Metadata row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {question.year && (
                  <span>
                    <span className="text-slate-700 font-medium">Ano:</span>{' '}
                    <span className="text-slate-600">{question.year}</span>
                  </span>
                )}
                {question.banca_name && (
                  <span>
                    <span className="text-slate-700 font-medium">Banca:</span>{' '}
                    <span className="text-blue-600">{question.banca_name}</span>
                  </span>
                )}
                {question.orgao_name && (
                  <span>
                    <span className="text-slate-700 font-medium">Órgão:</span>{' '}
                    <span className="text-blue-600">{question.orgao_name}</span>
                  </span>
                )}
              </div>

              {/* Prova line - Green color with collapsible for multiple provas */}
              {question.prova_name && (
                <div className="text-sm">
                  <span className="text-slate-700 font-medium">Prova:</span>{' '}
                  {(() => {
                    const provas = question.prova_name.split(' | ').map(p => p.trim()).filter(Boolean);
                    const maxVisible = 3;
                    
                    if (provas.length <= maxVisible) {
                      return <span className="text-green-600">{question.prova_name}</span>;
                    }
                    
                    if (!showAllProvas) {
                      return (
                        <span className="inline">
                          <span className="text-green-600">
                            {provas.slice(0, maxVisible).join(' | ')}
                          </span>
                          <button
                            onClick={() => setShowAllProvas(true)}
                            className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-700 text-xs font-medium ml-2"
                          >
                            +{provas.length - maxVisible} mais
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    }
                    
                    return (
                      <span className="inline">
                        <span className="text-green-600">{question.prova_name}</span>
                        <button
                          onClick={() => setShowAllProvas(false)}
                          className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-700 text-xs font-medium ml-2"
                        >
                          Recolher
                          <ChevronUp className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Previously answered badge */}
            {question.user_answered && (
              <div className={cn(
                "text-xs font-semibold px-2 py-1 rounded",
                question.user_is_correct 
                  ? "bg-green-100 text-green-700" 
                  : "bg-red-100 text-red-700"
              )}>
                {question.user_is_correct ? "Resolvida Certa" : "Resolvida Errada"}
              </div>
            )}
          </div>
        </div>

        {/* Question Content */}
        <div className="px-5 py-5 space-y-5">
          {/* Images extracted from fields or pasted as URLs */}
          {mergedImageUrls.length > 0 && (
            <div className="space-y-3 my-4">
              {mergedImageUrls.map((imgUrl, idx) => (
                 <img
                   key={idx}
                   src={imgUrl}
                   alt={`Imagem ${idx + 1} da questão`}
                   loading="lazy"
                   className="h-auto rounded-lg border border-border shadow-sm"
                   style={getImageStyle(imageCategory)}
                 />
              ))}
            </div>
          )}

          {/* Associated Text (supporting text for the question) */}
          {richAssociated.html.trim() !== '' && (
            <div className={cn("question-rich-content bg-white border border-border rounded-lg p-4", `img-category-${imageCategory}`)}>
              <div
                className="leading-relaxed prose prose-sm max-w-none prose-p:my-2 prose-blockquote:border-l-primary prose-blockquote:bg-white prose-blockquote:py-1 prose-blockquote:px-3 text-gray-900"
                dangerouslySetInnerHTML={{ __html: richAssociated.html }}
              />
            </div>
          )}

          {/* Question Text */}
          <div
            className={cn("question-rich-content leading-relaxed prose prose-sm max-w-none text-gray-900 bg-white p-4 rounded-lg border border-border", `img-category-${imageCategory}`)}
            dangerouslySetInnerHTML={{ __html: richQuestion.html }}
          />

          {/* Answer Options */}
          {isTrueFalse ? (
            <RadioGroup
              value={selectedAnswer}
              onValueChange={setSelectedAnswer}
              disabled={hasSubmitted}
              className="space-y-3"
            >
              {['V', 'F'].map((option) => (
                <div
                  key={option}
                  className={cn(
                    "flex items-center gap-3 py-2 cursor-pointer transition-all rounded-lg px-2 -mx-2",
                    !hasSubmitted && "hover:bg-slate-50",
                    selectedAnswer === option && !hasSubmitted && "bg-blue-50 shadow-md ring-2 ring-blue-200",
                    hasSubmitted && correctAnswer === option && "font-medium",
                    strikethroughOptions.has(option) && "opacity-50"
                  )}
                  onClick={() => !hasSubmitted && !strikethroughOptions.has(option) && setSelectedAnswer(option)}
                >
                  <RadioGroupItem value={option} id={`option-${question.id}-${option}`} className="hidden" />
                  <OptionCircle letter={option} />
                  <Label 
                    htmlFor={`option-${question.id}-${option}`}
                    className={cn(
                      "flex-1 cursor-pointer text-slate-700 text-sm",
                      strikethroughOptions.has(option) && "line-through"
                    )}
                  >
                    {option === 'V' ? 'Verdadeiro (Certo)' : 'Falso (Errado)'}
                  </Label>
                  {!hasSubmitted && (
                    <button
                      onClick={(e) => toggleStrikethrough(option, e)}
                      className="p-1 hover:bg-slate-200 rounded transition-colors"
                      title="Riscar alternativa"
                    >
                      <Scissors className="h-4 w-4 text-slate-400" />
                    </button>
                  )}
                </div>
              ))}
            </RadioGroup>
          ) : (
            <RadioGroup
              value={selectedAnswer}
              onValueChange={setSelectedAnswer}
              disabled={hasSubmitted}
              className="space-y-3"
            >
              {options.map((option) => (
                <div
                  key={option.key}
                  className={cn(
                    "flex items-start gap-3 cursor-pointer transition-all py-2 rounded-lg px-2 -mx-2",
                    !hasSubmitted && "hover:bg-slate-50",
                    selectedAnswer === option.key && !hasSubmitted && "bg-blue-50 shadow-md ring-2 ring-blue-200",
                    hasSubmitted && correctAnswer === option.key && "font-medium",
                    strikethroughOptions.has(option.key) && "opacity-50"
                  )}
                  onClick={() => !hasSubmitted && !strikethroughOptions.has(option.key) && setSelectedAnswer(option.key)}
                >
                  <RadioGroupItem value={option.key} id={`option-${question.id}-${option.key}`} className="hidden" />
                  <OptionCircle letter={option.key} />
                  <Label 
                    htmlFor={`option-${question.id}-${option.key}`}
                    className={cn(
                      "flex-1 cursor-pointer text-slate-700 text-sm leading-relaxed pt-0.5 prose prose-sm max-w-none",
                      strikethroughOptions.has(option.key) && "line-through"
                    )}
                    dangerouslySetInnerHTML={{ __html: sanitizeHTML(option.value) }}
                  />
                  {!hasSubmitted && (
                    <button
                      onClick={(e) => toggleStrikethrough(option.key, e)}
                      className="p-1 hover:bg-slate-200 rounded transition-colors flex-shrink-0"
                      title="Riscar alternativa"
                    >
                      <Scissors className="h-4 w-4 text-slate-400" />
                    </button>
                  )}
                </div>
              ))}
            </RadioGroup>
          )}

          {/* Submit Button - Blue */}
          {!hasSubmitted && (
            <div className="flex justify-start pt-2">
              <Button 
                onClick={handleSubmit} 
                disabled={!selectedAnswer || isSubmitting}
                className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-2 rounded font-medium"
              >
                {isSubmitting ? "Enviando..." : "Responder"}
              </Button>
            </div>
          )}

          {/* Answer Feedback Section - Only Gabarito after submit */}
          {hasSubmitted && (
            <div className="space-y-4">
              {/* Gabarito Box */}
              <div className="bg-slate-100 rounded-lg p-4 border border-slate-200">
                <h4 className="text-slate-800 font-semibold mb-1">Gabarito</h4>
                <p className={cn(
                  "font-medium",
                  isCorrect ? "text-green-600" : "text-red-600"
                )}>
                  {formatAnswerDisplay(correctAnswer || '')}
                </p>
                <p className={cn(
                  "mt-2 font-semibold text-lg",
                  isCorrect ? "text-green-600" : "text-red-600"
                )}>
                  {isCorrect ? "Você acertou!" : "Você errou!"}
                </p>
              </div>

          {/* Questão Dissecada / Professor Comment - Shown by default, toggleable */}
              {showDissecada && profComment && (
                <div>
                  <span className="inline-block px-3 py-1 text-sm font-medium text-green-700 border border-green-600 rounded-full mb-3">
                    Questão Dissecada
                  </span>
                  
                  <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
                    <div 
                      className="text-slate-700 leading-relaxed prose prose-sm max-w-none prose-headings:text-slate-900 prose-strong:text-slate-900"
                      dangerouslySetInnerHTML={{ __html: sanitizeHTML(formatProfComment(profComment)) }}
                    />
                  </div>
                </div>
              )}

              {/* Statistics Section */}
              {showStats && totalAnswers > 0 && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <h4 className="text-slate-800 font-semibold mb-3">Estatísticas ({totalAnswers} respostas)</h4>
                  <div className="space-y-2">
                    {(isTrueFalse ? ['V', 'F'] : options.map(o => o.key)).map(optKey => {
                      const count = answerStats[optKey] || 0;
                      const percentage = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;
                      const isCorrectOption = optKey === correctAnswer;
                      
                      return (
                        <div key={optKey} className="flex items-center gap-3">
                          <span className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white",
                            isCorrectOption ? "bg-green-500" : "bg-blue-500"
                          )}>
                            {optKey}
                          </span>
                          <div className="flex-1 h-5 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all",
                                isCorrectOption ? "bg-green-500" : "bg-blue-400"
                              )}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-slate-600 w-16 text-right">
                            {count} ({percentage}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Related Content */}
              {question.related_contents && (
                <div className="bg-amber-50 rounded-lg p-5 border border-amber-100">
                  <h4 className="text-amber-900 font-semibold mb-2">Conteúdo Relacionado</h4>
                  <p className="text-amber-800 text-sm">{question.related_contents}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            {/* Tutor IA Button - Only after submitting and if user has robo-tutor access */}
            {hasSubmitted && correctAnswer && hasTutorAccess && (
              <button 
                className="flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors font-medium"
                onClick={() => setShowTutorDialog(true)}
              >
                <Bot className="h-4 w-4" />
                <span>Tirar Dúvida</span>
              </button>
            )}
            {profComment && (
              <button 
                className={cn(
                  "flex items-center gap-1.5 transition-colors",
                  showDissecada ? "text-blue-600 font-medium" : "hover:text-blue-600"
                )}
                onClick={() => setShowDissecada(!showDissecada)}
              >
                <MessageSquare className="h-4 w-4" />
                <span>{showDissecada ? "Ocultar Gabarito" : "Gabarito Comentado"}</span>
              </button>
            )}
            <button 
              className={cn(
                "flex items-center gap-1.5 transition-colors",
                showComments ? "text-blue-600" : "hover:text-blue-600"
              )}
              onClick={() => setShowComments(!showComments)}
            >
              <MessageCircle className="h-4 w-4" />
              <span>Comentários</span>
            </button>
            <button 
              className={cn(
                "flex items-center gap-1.5 transition-colors",
                showStats ? "text-blue-600" : "hover:text-blue-600"
              )}
              onClick={loadStats}
            >
              <BarChart className="h-4 w-4" />
              <span>{loadingStats ? "Carregando..." : "Estatísticas"}</span>
            </button>
            <button 
              className="flex items-center gap-1.5 hover:text-blue-600 transition-colors"
              onClick={() => onAddToNotebook?.(question.id)}
            >
              <BookOpen className="h-4 w-4" />
              <span>Cadernos</span>
            </button>
            <button 
              className="flex items-center gap-1.5 hover:text-blue-600 transition-colors"
              onClick={() => onCreateNote?.(question)}
            >
              <PenLine className="h-4 w-4" />
              <span>Criar anotações</span>
            </button>
            <button 
              className="flex items-center gap-1.5 hover:text-red-600 transition-colors"
              onClick={() => setShowReportDialog(true)}
            >
              <Flag className="h-4 w-4" />
              <span>Notificar Erro</span>
            </button>
          </div>
        </div>

        {/* Comments Section */}
        <QuestionComments questionId={question.id} isOpen={showComments} />
      </CardContent>

      <ReportErrorDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        questionId={question.id}
        questionCode={formatQuestionCode(question.code)}
      />

      {/* Tutor Dialog */}
      {hasSubmitted && correctAnswer && hasTutorAccess && (
        <QuestionTutorDialog
          open={showTutorDialog}
          onOpenChange={setShowTutorDialog}
          question={question}
          correctAnswer={correctAnswer}
          profComment={profComment || null}
        />
      )}
    </Card>
  );
}
