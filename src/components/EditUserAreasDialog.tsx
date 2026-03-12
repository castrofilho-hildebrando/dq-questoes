import { useState, useEffect } from "react";
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

interface Area {
  id: string;
  name: string;
  description?: string | null;
}

interface EditUserAreasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserAreasDialog({ open, onOpenChange }: EditUserAreasDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  // Fetch all active areas
  const { data: allAreas, isLoading: areasLoading } = useQuery({
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
    enabled: open,
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
    enabled: !!user?.id && open,
  });

  // Initialize selected areas when user areas load
  useEffect(() => {
    if (userAreas && userAreas.length > 0) {
      setSelectedAreas(userAreas.map((ua: any) => ua.area_id));
    }
  }, [userAreas]);

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
      toast.success("Áreas atualizadas com sucesso!");
      onOpenChange(false);
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

  const isLoading = areasLoading || userAreasLoading;

  // Get current area names for display
  const currentAreaNames = userAreas?.map((ua: any) => ua.areas?.name).filter(Boolean) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Editar suas Áreas</DialogTitle>
          <DialogDescription className="text-base">
            Escolha até <strong>2 áreas</strong> de conhecimento para personalizar sua experiência.
            {currentAreaNames.length > 0 && (
              <span className="block mt-2 text-sm">
                Áreas atuais: <strong>{currentAreaNames.join(", ")}</strong>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
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
                  "Salvar Alterações"
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
