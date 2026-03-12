import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { RequireCpfDialog } from "@/components/RequireCpfDialog";

interface Area {
  id: string;
  name: string;
  description?: string | null;
}

interface RequireUserAreasProps {
  children: React.ReactNode;
}

export function RequireUserAreas({ children }: RequireUserAreasProps) {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  // Fetch all active areas
  const { data: allAreas, isLoading: areasLoading, error: areasError } = useQuery({
    queryKey: ["all-areas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("areas")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data as Area[];
    },
    enabled: !!user,
  });

  // Detect expired session: if user exists but areas query fails or returns empty
  // (there are always active areas in production), force session refresh
  useEffect(() => {
    if (!user || areasLoading) return;
    if (areasError || (allAreas && allAreas.length === 0)) {
      console.warn("Session may be expired: areas query returned empty/error. Attempting refresh...");
      supabase.auth.refreshSession().then(({ error }) => {
        if (error) {
          console.warn("Session refresh failed, signing out:", error.message);
          supabase.auth.signOut();
        } else {
          // Refresh succeeded, invalidate queries to re-fetch with fresh token
          queryClient.invalidateQueries({ queryKey: ["all-areas"] });
          queryClient.invalidateQueries({ queryKey: ["user-areas"] });
          queryClient.invalidateQueries({ queryKey: ["user-profile-cpf"] });
        }
      });
    }
  }, [user, areasLoading, areasError, allAreas, queryClient]);

  // Check if user has CPF
  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile-cpf", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("cpf")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch user's current areas
  const { data: userAreas, isLoading: userAreasLoading } = useQuery({
    queryKey: ["user-areas", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("user_areas")
        .select("area_id, areas(id, name)")
        .eq("user_id", user.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Save areas mutation
  const saveMutation = useMutation({
    mutationFn: async (areaIds: string[]) => {
      if (!user?.id) throw new Error("User not authenticated");

      // Delete existing areas
      await supabase
        .from("user_areas")
        .delete()
        .eq("user_id", user.id);

      // Insert new areas
      if (areaIds.length > 0) {
        const { error } = await supabase
          .from("user_areas")
          .insert(areaIds.map(areaId => ({
            user_id: user.id,
            area_id: areaId,
          })));
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-areas"] });
      queryClient.invalidateQueries({ queryKey: ["robots"] });
      toast.success("Áreas selecionadas com sucesso!");
    },
    onError: (error) => {
      console.error("Error saving areas:", error);
      toast.error("Erro ao salvar áreas");
    },
  });

  const toggleArea = (areaId: string) => {
    setSelectedAreas(prev => {
      if (prev.includes(areaId)) {
        return prev.filter(id => id !== areaId);
      }
      if (prev.length >= 2) {
        toast.warning("Você pode selecionar no máximo 2 áreas");
        return prev;
      }
      return [...prev, areaId];
    });
  };

  const handleSave = () => {
    if (selectedAreas.length === 0) {
      toast.error("Selecione pelo menos uma área");
      return;
    }
    saveMutation.mutate(selectedAreas);
  };

  // Loading state
  if (authLoading || areasLoading || userAreasLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // User not logged in - let the auth guard handle it
  if (!user) {
    return <>{children}</>;
  }

  // User has areas selected - check CPF next
  const hasAreas = userAreas && userAreas.length > 0;
  const hasCpf = !!userProfile?.cpf;

  if (hasAreas && !hasCpf) {
    return (
      <>
        {children}
        <RequireCpfDialog
          open={true}
          userId={user.id}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["user-profile-cpf"] })}
        />
      </>
    );
  }

  if (hasAreas) {
    return <>{children}</>;
  }

  // Show mandatory area selection dialog
  return (
    <Dialog open={true}>
      <DialogContent 
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">Bem-vindo! Selecione suas Áreas</DialogTitle>
          <DialogDescription className="text-base">
            Para personalizar sua experiência, escolha até <strong>2 áreas</strong> de conhecimento.
            Isso determinará quais robôs tutores e conteúdos estarão disponíveis para você.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-4 max-h-[50vh] overflow-y-auto">
          {allAreas?.map((area) => {
            const isSelected = selectedAreas.includes(area.id);
            return (
              <button
                key={area.id}
                onClick={() => toggleArea(area.id)}
                className={`flex items-center justify-between p-4 rounded-lg border text-left transition-colors ${
                  isSelected 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div>
                  <p className="font-medium">{area.name}</p>
                </div>
                {isSelected && <Check className="h-5 w-5 text-primary flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-sm text-muted-foreground text-center">
            {selectedAreas.length}/2 áreas selecionadas
          </div>
          <Button 
            onClick={handleSave}
            disabled={selectedAreas.length === 0 || saveMutation.isPending}
            className="w-full"
            size="lg"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Continuar"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
