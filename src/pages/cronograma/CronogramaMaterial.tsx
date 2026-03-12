import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PdfViewer } from "@/components/pdf/PdfViewer";
import { differenceInDays } from "date-fns";

interface PdfMaterial {
  id: string;
  name: string;
  current_file_url: string;
  total_pages: number | null;
  total_study_minutes: number;
}

export default function CronogramaMaterial() {
  const { materialId } = useParams<{ materialId: string }>();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get("taskId");
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [material, setMaterial] = useState<PdfMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ created_at: string; download_unlocked?: boolean } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Fetch profile for download logic
  useEffect(() => {
    if (!user) return;
    setProfileLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("created_at, download_unlocked")
          .eq("user_id", user.id)
          .single();
        if (data) setProfile(data);
      } finally {
        setProfileLoading(false);
      }
    })();
  }, [user]);

  const daysSinceCreation = useMemo(() => {
    if (!profile?.created_at) return 0;
    return differenceInDays(new Date(), new Date(profile.created_at));
  }, [profile]);

  const canDownload = !profile ? false : (daysSinceCreation >= 7 || profile?.download_unlocked === true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/auth");
      return;
    }

    if (!materialId) {
      setError("Material não especificado");
      setLoading(false);
      return;
    }

    const fetchMaterial = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("pdf_materials")
          .select("id, name, current_file_url, total_pages, total_study_minutes")
          .eq("id", materialId)
          .single();

        if (fetchError) throw fetchError;
        if (!data) throw new Error("Material não encontrado");

        setMaterial(data);
      } catch (err: any) {
        console.error("Error fetching material:", err);
        setError(err.message || "Erro ao carregar material");
      } finally {
        setLoading(false);
      }
    };

    fetchMaterial();
  }, [materialId, user, authLoading, navigate]);

  const fromCronograma = searchParams.get("fromCronograma") === "true";
  
  const handleBack = () => {
    if (fromCronograma) {
      window.close();
    } else {
      navigate(-1);
    }
  };

  if (authLoading || loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !material) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">{error || "Material não encontrado"}</p>
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex items-center gap-3">
        <Button onClick={handleBack} variant="ghost" size="icon">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold truncate flex-1">
          {material.name}
        </h1>
      </header>

      {/* PDF Viewer */}
      <div className="flex-1">
        <PdfViewer
          pdfUrl={material.current_file_url}
          pdfMaterialId={material.id}
          totalPages={material.total_pages || undefined}
          taskId={taskId || undefined}
          allowDownload={canDownload}
          downloadFileName={material.name}
        />
      </div>
    </div>
  );
}
