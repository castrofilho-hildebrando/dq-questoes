import ConselhoThemeWrapper from "@/components/ConselhoThemeWrapper";
import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

import { Button } from "@/components/ui/button";
import { PdfViewerDialog } from "@/components/pdf/PdfViewerDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ArrowLeft, FileText, BookOpen, Loader2, Lock, Download } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { TutorialActionCard } from "@/components/TutorialActionCard";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface PdfSection {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
}

interface PdfFolder {
  id: string;
  name: string;
  section_id: string | null;
  thumbnail_url: string | null;
  display_order: number;
}

interface PdfMaterial {
  id: string;
  name: string;
  description: string | null;
  current_file_url: string;
  total_pages: number | null;
  total_study_minutes: number;
  folder_id: string | null;
  is_active: boolean;
  display_order: number;
}

function MateriaisDissecadosContent() {
  const navigate = useNavigate();
  const { goBack } = useBackNavigation();
  const { user } = useAuth();

  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<PdfMaterial | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<PdfFolder | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Fetch user profile for 7-day restriction and watermark
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
    const created = new Date(profile.created_at);
    return Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
  }, [profile]);

  const canDownload = profileLoading ? true : (daysSinceCreation >= 7 || profile?.download_unlocked === true);
  const daysRemaining = Math.max(0, 7 - daysSinceCreation);

  // Fetch sections
  const { data: sections = [], isLoading: loadingSections } = useQuery({
    queryKey: ["pdf-material-sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdf_material_sections")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as PdfSection[];
    },
  });

  // Fetch folders (modules)
  const { data: folders = [], isLoading: loadingFolders } = useQuery({
    queryKey: ["pdf-material-folders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdf_material_folders")
        .select("id, name, section_id, thumbnail_url, display_order")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as PdfFolder[];
    },
  });

  // Fetch materials
  const { data: materials = [], isLoading: loadingMaterials } = useQuery({
    queryKey: ["pdf-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdf_materials")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as PdfMaterial[];
    },
  });

  const isLoading = loadingSections || loadingFolders || loadingMaterials;

  const handleOpenMaterial = (material: PdfMaterial) => {
    setSelectedMaterial(material);
    setViewerOpen(true);
  };

  const handleDownload = useCallback(async (material: PdfMaterial) => {
    if (!canDownload || downloading) return;
    setDownloading(material.id);
    try {
      const response = await fetch(material.current_file_url);
      if (!response.ok) throw new Error("Erro ao baixar o PDF");
      const pdfBytes = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();

      const userName = profile?.full_name || "—";
      const userCpf = profile?.cpf || "—";
      const userEmail = profile?.email || user?.email || "—";
      const watermarkText = `Documento de uso exclusivo de: ${userName} | CPF: ${userCpf} | E-mail: ${userEmail}`;
      const fontSize = 7;
      const textColor = rgb(0.45, 0.45, 0.45);

      for (const page of pages) {
        const { width } = page.getSize();
        const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
        page.drawText(watermarkText, {
          x: Math.max(10, (width - textWidth) / 2),
          y: 12,
          size: fontSize,
          font,
          color: textColor,
        });
      }

      const modifiedPdfBytes = await pdfDoc.save();
      const blob = new Blob([modifiedPdfBytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${material.name}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Download realizado com sucesso!");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Erro ao realizar o download. Tente novamente.");
    } finally {
      setDownloading(null);
    }
  }, [canDownload, downloading, profile, user?.email]);

  // === Inside a folder: show PDF cards ===
  if (selectedFolder) {
    const folderMaterials = materials.filter(m => m.folder_id === selectedFolder.id);

    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedFolder(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">{selectedFolder.name}</h1>
              <p className="text-sm text-muted-foreground">
                {folderMaterials.length} {folderMaterials.length !== 1 ? "materiais" : "material"}
              </p>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Download restriction notice */}
          {!canDownload && (
            <Card className="border-amber-500/30 bg-amber-500/5 mb-6">
              <CardContent className="py-3 flex items-center gap-3">
                <Lock className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  O download dos materiais será liberado em <strong>{daysRemaining} dia{daysRemaining !== 1 ? "s" : ""}</strong>.
                </p>
              </CardContent>
            </Card>
          )}

          {folderMaterials.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum material disponível neste módulo.</p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {folderMaterials.map((material, index) => (
                <motion.div
                  key={material.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <div className="group rounded-lg border border-border/60 bg-card overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all">
                    {/* PDF icon area */}
                    <div className="aspect-[4/2] bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center relative">
                      <FileText className="w-8 h-8 text-primary/40" />
                      {material.total_pages && (
                        <span className="absolute bottom-1 right-1 text-[10px] text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded">
                          {material.total_pages} págs
                        </span>
                      )}
                    </div>
                    <div className="p-2 space-y-1.5">
                      <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight min-h-[2rem]">
                        {material.name}
                      </p>
                      {material.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {material.description}
                        </p>
                      )}
                      <div className="flex flex-col gap-1.5">
                        <Button size="sm" className="w-full text-xs h-7" onClick={() => handleOpenMaterial(material)}>
                          Abrir
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs h-7"
                          disabled={!canDownload || downloading === material.id}
                          onClick={() => handleDownload(material)}
                        >
                          {downloading === material.id ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : canDownload ? (
                            <Download className="w-3 h-3" />
                          ) : (
                            <Lock className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </main>

        {selectedMaterial && (
          <PdfViewerDialog
            open={viewerOpen}
            onOpenChange={setViewerOpen}
            pdfUrl={selectedMaterial.current_file_url}
            pdfMaterialId={selectedMaterial.id}
            title={selectedMaterial.name}
            totalPages={selectedMaterial.total_pages || undefined}
            allowDownload={canDownload}
            downloadFileName={selectedMaterial.name}
          />
        )}
      </div>
    );
  }

  // === Main view: Netflix-style sections ===
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Materiais Dissecados</h1>
        </div>
      </header>

      {/* Hero */}
      <div className="relative py-10 px-6 overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: "var(--gradient-primary)" }}
        />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Materiais Dissecados
          </h2>
          <p className="text-muted-foreground text-base md:text-lg">
            PDFs completos e organizados por disciplina. Estude no seu ritmo.
          </p>
        </div>
      </div>

      {/* Sections */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-10">
        <TutorialActionCard productSlug="materiais-dissecados" />

        {sections.length === 0 && (
          <p className="text-center text-muted-foreground py-20">
            Nenhum conteúdo disponível ainda. Volte em breve!
          </p>
        )}

        {sections.map((section) => {
          const sectionFolders = folders.filter(f => f.section_id === section.id);
          if (sectionFolders.length === 0) return null;

          return (
            <div key={section.id}>
              <div className="mb-3 px-1">
                <h3 className="text-xl font-semibold text-foreground">
                  {section.name}
                </h3>
                {section.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {section.description}
                  </p>
                )}
              </div>

              <ScrollArea className="w-full">
                <div className="flex gap-4 pb-4">
                  {sectionFolders.map((folder) => {
                    const count = materials.filter(m => m.folder_id === folder.id).length;
                    return (
                      <ModuleCard
                        key={folder.id}
                        folder={folder}
                        materialCount={count}
                        onClick={() => setSelectedFolder(folder)}
                      />
                    );
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          );
        })}

        {/* Folders without section */}
        {(() => {
          const unsectioned = folders.filter(f => !f.section_id);
          if (unsectioned.length === 0) return null;
          return (
            <div>
              <div className="mb-3 px-1">
                <h3 className="text-xl font-semibold text-foreground">Outros</h3>
              </div>
              <ScrollArea className="w-full">
                <div className="flex gap-4 pb-4">
                  {unsectioned.map((folder) => {
                    const count = materials.filter(m => m.folder_id === folder.id).length;
                    return (
                      <ModuleCard
                        key={folder.id}
                        folder={folder}
                        materialCount={count}
                        onClick={() => setSelectedFolder(folder)}
                      />
                    );
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          );
        })()}
      </main>
    </div>
  );
}

function ModuleCard({
  folder,
  materialCount,
  onClick,
}: {
  folder: PdfFolder;
  materialCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex-shrink-0 w-52 rounded-lg overflow-hidden border border-border/60 bg-card transition-all hover:border-primary/50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
      )}
    >
      {/* 9:16 Thumbnail */}
      <AspectRatio ratio={9 / 16}>
        {folder.thumbnail_url ? (
          <img
            src={folder.thumbnail_url}
            alt={folder.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-primary/30" />
          </div>
        )}
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {/* Text overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
          <p className="text-sm font-semibold text-white line-clamp-2 leading-tight drop-shadow">
            {folder.name}
          </p>
          <p className="text-[11px] text-white/70 mt-0.5">
            {materialCount} PDF{materialCount !== 1 ? "s" : ""}
          </p>
        </div>
      </AspectRatio>
    </button>
  );
}

export default function MateriaisDissecadosPage() {
  return <ConselhoThemeWrapper><MateriaisDissecadosContent /></ConselhoThemeWrapper>;
}
