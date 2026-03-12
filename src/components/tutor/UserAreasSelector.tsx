import { useState } from "react";
import { Check, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Area {
  id: string;
  name: string;
  description?: string | null;
}

export function UserAreasSelector() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  // Fetch all active areas
  const { data: allAreas } = useQuery({
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
  });

  // Fetch user's current areas
  const { data: userAreas } = useQuery({
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

  // Initialize selected areas when dialog opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && userAreas) {
      setSelectedAreas(userAreas.map((ua: any) => ua.area_id));
    }
  };

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
      setIsOpen(false);
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

  const currentAreas = userAreas?.map((ua: any) => ua.areas).filter(Boolean) || [];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {currentAreas.length > 0 ? (
        currentAreas.map((area: Area) => (
          <Badge key={area.id} variant="secondary">
            {area.name}
          </Badge>
        ))
      ) : (
        <span className="text-sm text-muted-foreground">
          Nenhuma área selecionada
        </span>
      )}

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            {currentAreas.length > 0 ? "Alterar" : "Selecionar"} Áreas
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecione suas Áreas</DialogTitle>
            <DialogDescription>
              Escolha até 2 áreas de conhecimento para ver robôs tutores especializados.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-4">
            {allAreas?.map((area) => {
              const isSelected = selectedAreas.includes(area.id);
              return (
                <button
                  key={area.id}
                  onClick={() => toggleArea(area.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                    isSelected 
                      ? "border-primary bg-primary/10" 
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div>
                    <p className="font-medium">{area.name}</p>
                  </div>
                  {isSelected && <Check className="h-5 w-5 text-primary" />}
                </button>
              );
            })}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => saveMutation.mutate(selectedAreas)}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
