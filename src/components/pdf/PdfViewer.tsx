import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Maximize2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface PdfViewerProps {
  pdfUrl: string;
  pdfMaterialId: string;
  totalPages?: number;
  taskId?: string;
  initialPage?: number;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onProgressUpdate?: (progress: { currentPage: number; totalPages: number; percentage: number }) => void;
  allowDownload?: boolean;
  downloadFileName?: string;
}

async function applyWatermark(
  pdfBytes: ArrayBuffer,
  watermarkText: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const fontSize = 7;
  const textColor = rgb(0.45, 0.45, 0.45);

  for (const page of pages) {
    const { width } = page.getSize();
    const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
    const x = (width - textWidth) / 2;
    page.drawText(watermarkText, {
      x: Math.max(10, x),
      y: 12,
      size: fontSize,
      font,
      color: textColor,
    });
  }

  return pdfDoc.save();
}

export function PdfViewer({
  pdfUrl,
  pdfMaterialId,
  totalPages: initialTotalPages,
  taskId,
  initialPage = 1,
  isFullscreen = false,
  onToggleFullscreen,
  onProgressUpdate,
  allowDownload = false,
  downloadFileName,
}: PdfViewerProps) {
  const { user } = useAuth();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [markedComplete, setMarkedComplete] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string | null; cpf: string | null; email: string | null } | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [detectedPages, setDetectedPages] = useState<number>(initialTotalPages || 0);

  // Fetch profile for watermark
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('full_name, cpf, email')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user]);

  // Check existing progress
  useEffect(() => {
    if (!user || !pdfMaterialId) return;

    const loadProgress = async () => {
      const query = supabase
        .from('user_pdf_progress')
        .select('percentage_complete')
        .eq('user_id', user.id)
        .eq('pdf_material_id', pdfMaterialId);

      if (taskId) {
        query.eq('task_id', taskId);
      }

      const { data } = await query.maybeSingle();
      if (data?.percentage_complete === 100) {
        setMarkedComplete(true);
      }
    };

    loadProgress();
  }, [user, pdfMaterialId, taskId]);

  // Fetch PDF, apply watermark, create blob URL
  useEffect(() => {
    let cancelled = false;
    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error('Erro ao carregar o PDF');
        const rawBytes = await response.arrayBuffer();

        if (cancelled) return;

        // Detect page count from pdf-lib
        const tempDoc = await PDFDocument.load(rawBytes);
        const pageCount = tempDoc.getPageCount();
        setDetectedPages(pageCount);

        // Store raw bytes for download
        setPdfBytes(rawBytes);

        // Build watermark text
        const userName = profile?.full_name || '—';
        const userCpf = profile?.cpf || '—';
        const userEmail = profile?.email || user?.email || '—';
        const watermarkText = `Documento de uso exclusivo de: ${userName} | CPF: ${userCpf} | E-mail: ${userEmail}`;

        const watermarkedBytes = await applyWatermark(rawBytes, watermarkText);

        if (cancelled) return;

        const blob = new Blob([watermarkedBytes as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        if (!cancelled) setError(err.message || 'Erro ao carregar PDF');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    if (user) loadPdf();

    return () => {
      cancelled = true;
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [pdfUrl, user, profile]);

  // Save progress
  const saveProgress = useCallback(async (percentage: number) => {
    if (!user || !pdfMaterialId) return;

    const totalPages = detectedPages || initialTotalPages || 1;
    const currentPage = Math.round((percentage / 100) * totalPages);

    try {
      const query = supabase
        .from('user_pdf_progress')
        .select('id')
        .eq('user_id', user.id)
        .eq('pdf_material_id', pdfMaterialId);

      if (taskId) {
        query.eq('task_id', taskId);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        await supabase
          .from('user_pdf_progress')
          .update({
            last_page_read: currentPage,
            total_pages_read: currentPage,
            percentage_complete: percentage,
            last_read_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('user_pdf_progress')
          .insert({
            user_id: user.id,
            pdf_material_id: pdfMaterialId,
            task_id: taskId || null,
            last_page_read: currentPage,
            total_pages_read: currentPage,
            percentage_complete: percentage,
          });
      }

      onProgressUpdate?.({ currentPage, totalPages, percentage });
    } catch (err) {
      console.error('Error saving PDF progress:', err);
    }
  }, [user, pdfMaterialId, taskId, detectedPages, initialTotalPages, onProgressUpdate]);

  // Auto-save as "opened" (50%) when PDF loads
  useEffect(() => {
    if (blobUrl && !markedComplete) {
      saveProgress(50);
    }
  }, [blobUrl, markedComplete, saveProgress]);

  const handleMarkComplete = async () => {
    await saveProgress(100);
    setMarkedComplete(true);
    toast.success('Material marcado como concluído!');
  };

  const handleDownload = useCallback(async () => {
    if (downloading || !pdfBytes || !user) return;
    setDownloading(true);
    try {
      const userName = profile?.full_name || '—';
      const userCpf = profile?.cpf || '—';
      const userEmail = profile?.email || user?.email || '—';
      const watermarkText = `Documento de uso exclusivo de: ${userName} | CPF: ${userCpf} | E-mail: ${userEmail}`;

      const watermarkedBytes = await applyWatermark(pdfBytes, watermarkText);
      const blob = new Blob([watermarkedBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${downloadFileName || 'material'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Download realizado com sucesso!');
    } catch {
      toast.error('Erro ao realizar o download.');
    } finally {
      setDownloading(false);
    }
  }, [downloading, pdfBytes, user, profile, downloadFileName]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Preparando documento...</p>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4">
        <p className="text-destructive text-sm">{error || 'Erro ao carregar PDF'}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const iframeSrc = allowDownload
    ? `${blobUrl}#page=${initialPage}`
    : `${blobUrl}#page=${initialPage}&toolbar=0&navpanes=0`;

  return (
    <div className="flex flex-col h-full bg-muted/30 rounded-lg overflow-hidden">
      {/* Minimal info bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-background border-b">
        <div className="flex items-center gap-2">
          {detectedPages > 0 && (
            <span className="text-sm text-muted-foreground">
              {detectedPages} páginas
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!markedComplete && (
            <Button variant="outline" size="sm" onClick={handleMarkComplete}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Marcar como lido
            </Button>
          )}
          {markedComplete && (
            <span className="text-xs text-primary flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Concluído
            </span>
          )}
          {allowDownload && (
            <Button variant="outline" size="icon" onClick={handleDownload} disabled={downloading} title="Baixar PDF">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
          )}
          {onToggleFullscreen && (
            <Button variant="outline" size="icon" onClick={onToggleFullscreen} title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Native browser PDF viewer */}
      <div className="relative flex-1 overflow-hidden">
        {/* Overlay covers native toolbar when download is not yet unlocked */}
        {!allowDownload && (
          <div
            className="absolute top-0 left-0 right-0 z-10 bg-background"
            style={{ height: '34px' }}
          />
        )}
        <iframe
          src={iframeSrc}
          className="w-full border-0"
          title="Visualizador de PDF"
          style={allowDownload ? {
            height: '100%',
            minHeight: isFullscreen ? '100vh' : '70vh',
          } : {
            height: 'calc(100% + 34px)',
            marginTop: '-34px',
            minHeight: isFullscreen ? '100vh' : '70vh',
          }}
        />
      </div>
    </div>
  );
}
