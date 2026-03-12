import ConselhoThemeWrapper from "@/components/ConselhoThemeWrapper";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ArrowLeft, ExternalLink, Users } from "lucide-react";
import { TutorialActionCard } from "@/components/TutorialActionCard";

interface Section {
  id: string;
  title: string;
  sort_order: number;
}

interface Group {
  id: string;
  section_id: string;
  name: string;
  description: string | null;
  link: string | null;
  qr_code_url: string | null;
  image_url: string | null;
  sort_order: number;
}

export default function Comunidades() {
  const navigate = useNavigate();
  const { goBack } = useBackNavigation();
  const [sections, setSections] = useState<Section[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const [secRes, grpRes] = await Promise.all([
        supabase.from("community_sections").select("*").order("sort_order"),
        supabase.from("community_groups").select("*").order("sort_order"),
      ]);
      if (secRes.data) setSections(secRes.data);
      if (grpRes.data) setGroups(grpRes.data);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ConselhoThemeWrapper>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <h1 className="font-heading text-lg font-bold">Comunidades Dissecadores</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-8">
        <TutorialActionCard productSlug="dossie_if" />
        {sections.map(section => {
          const sectionGroups = groups.filter(g => g.section_id === section.id);
          if (sectionGroups.length === 0) return null;

          return (
            <section key={section.id}>
              <h2 className="text-xl font-bold mb-4 text-foreground">{section.title}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {sectionGroups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroup(group)}
                    className="group flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all text-center"
                  >
                    {group.image_url ? (
                      <img
                        src={group.image_url}
                        alt={group.name}
                        className="w-full aspect-square rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center">
                        <Users className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-foreground leading-tight">{group.name}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        {sections.every(s => groups.filter(g => g.section_id === s.id).length === 0) && (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma comunidade disponível no momento.</p>
          </div>
        )}
      </main>

      {/* Group Detail Dialog */}
      <Dialog open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{selectedGroup?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedGroup?.description && (
              <p className="text-sm text-muted-foreground">{selectedGroup.description}</p>
            )}

            {selectedGroup?.qr_code_url && (
              <div className="flex justify-center">
                <img
                  src={selectedGroup.qr_code_url}
                  alt="QR Code"
                  className="w-48 h-48 rounded-lg object-contain border border-border"
                />
              </div>
            )}

            {selectedGroup?.link && (
              <Button asChild className="w-full">
                <a href={selectedGroup.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Entrar no Grupo
                </a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </ConselhoThemeWrapper>
  );
}
