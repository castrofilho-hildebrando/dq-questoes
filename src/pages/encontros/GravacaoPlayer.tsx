import ConselhoThemeWrapper from "@/components/ConselhoThemeWrapper";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, CheckCircle2, FileText, Loader2, Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PdfViewerDialog } from "@/components/pdf/PdfViewerDialog";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { toVideoEmbed } from "@/lib/videoEmbed";

export default function GravacaoPlayer() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pdfOpen, setPdfOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile-watermark", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("created_at, full_name, email, cpf, download_unlocked")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const daysSinceCreation = useMemo(() => {
    if (!profile?.created_at) return 0;
    return Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24));
  }, [profile]);

  const canDownload = profileLoading ? true : (daysSinceCreation >= 7 || profile?.download_unlocked === true);
  const daysRemaining = Math.max(0, 7 - daysSinceCreation);

  const { data: mod, isLoading } = useQuery({
    queryKey: ["gravacao-module", moduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gravacao_modules")
        .select("*, gravacao_sections(title)")
        .eq("id", moduleId!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!moduleId,
  });

  const { data: progressRow } = useQuery({
    queryKey: ["gravacao-progress-single", user?.id, moduleId],
    queryFn: async () => {
      if (!user?.id || !moduleId) return null;
      const { data } = await supabase
        .from("gravacao_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("module_id", moduleId)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !!moduleId,
  });

  const markComplete = useMutation({
    mutationFn: async () => {
      if (!user?.id || !moduleId) return;
      const { error } = await supabase.from("gravacao_progress").upsert(
        { user_id: user.id, module_id: moduleId, completed_at: new Date().toISOString() },
        { onConflict: "user_id,module_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Módulo marcado como concluído!");
      queryClient.invalidateQueries({ queryKey: ["gravacao-progress"] });
      queryClient.invalidateQueries({ queryKey: ["gravacao-progress-single"] });
    },
  });

  const handleDownload = useCallback(async () => {
    if (!canDownload || downloading || !mod?.pdf_url) return;
    setDownloading(true);
    try {
      const response = await fetch(mod.pdf_url);
      if (!response.ok) throw new Error("Erro ao baixar o PDF");
      const pdfBytes = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      const userName = profile?.full_name || "—";
      const userCpf = profile?.cpf || "—";
      const userEmail = profile?.email || user?.email || "—";
      const watermarkText = `Documento de uso exclusivo de: ${userName} | CPF: ${userCpf} | E-mail: ${userEmail}`;
      for (const page of pages) {
        const { width } = page.getSize();
        const tw = font.widthOfTextAtSize(watermarkText, 7);
        page.drawText(watermarkText, { x: Math.max(10, (width - tw) / 2), y: 12, size: 7, font, color: rgb(0.45, 0.45, 0.45) });
      }
      const modified = await pdfDoc.save();
      const blob = new Blob([modified as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${mod.title || "material"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Download realizado com sucesso!");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Erro ao realizar o download. Tente novamente.");
    } finally {
      setDownloading(false);
    }
  }, [canDownload, downloading, mod, profile, user?.email]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!mod) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Módulo não encontrado.</p>
        <Button variant="outline" onClick={() => navigate("/encontros-ao-vivo")}>Voltar</Button>
      </div>
    );
  }

  const isCompleted = !!progressRow?.completed_at;
  const hasVideo = mod.module_type === "video" || mod.module_type === "video_pdf";
  const hasPdf = mod.module_type === "pdf" || mod.module_type === "video_pdf";
  const sectionTitle = mod.gravacao_sections?.title;

  return (
    <ConselhoThemeWrapper>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/encontros-ao-vivo?from=dossie-if")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              {sectionTitle && <p className="text-xs text-muted-foreground truncate">{sectionTitle}</p>}
              <h1 className="text-sm font-semibold text-foreground truncate">{mod.title}</h1>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          {hasVideo && mod.video_url && (
            <div className="aspect-video rounded-lg overflow-hidden bg-black border border-border/40">
              <iframe
                src={toVideoEmbed(mod.video_url)}
                title={mod.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {!hasVideo && hasPdf && (
            <div className="rounded-lg border border-border bg-card p-8 flex flex-col items-center gap-4 text-center">
              <FileText className="h-12 w-12 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">{mod.title}</h2>
              <p className="text-muted-foreground text-sm">Este módulo é um material em PDF.</p>
              <Button onClick={() => setPdfOpen(true)}>Abrir PDF</Button>
            </div>
          )}

          {hasPdf && mod.pdf_url && !canDownload && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="py-3 flex items-center gap-3">
                <Lock className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  O download será liberado em <strong>{daysRemaining} dia{daysRemaining !== 1 ? "s" : ""}</strong>.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {hasPdf && mod.pdf_url && hasVideo && (
              <Button variant="outline" onClick={() => setPdfOpen(true)}>
                <FileText className="h-4 w-4 mr-2" />
                Material em PDF
              </Button>
            )}
            {hasPdf && mod.pdf_url && (
              <Button variant="outline" onClick={handleDownload} disabled={!canDownload || downloading}>
                {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Baixar PDF
              </Button>
            )}
            {!isCompleted ? (
              <Button onClick={() => markComplete.mutate()} disabled={markComplete.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Marcar como concluído
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Concluído
              </div>
            )}
          </div>
        </main>

        {hasPdf && mod.pdf_url && (
          <PdfViewerDialog
            open={pdfOpen}
            onOpenChange={setPdfOpen}
            pdfUrl={mod.pdf_url}
            pdfMaterialId={mod.id}
            title={mod.title}
            allowDownload={canDownload}
            downloadFileName={mod.title}
          />
        )}
      </div>
    </ConselhoThemeWrapper>
  );
}
