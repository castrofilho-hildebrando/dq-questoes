import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, FileText, ChevronRight, ChevronDown, Link2, Trash2, Search, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QuestionNote {
  id: string;
  question_id: string;
  discipline_id: string | null;
  topic_id: string | null;
  discipline_name: string | null;
  topic_name: string | null;
  content: string;
  created_at: string;
  question_code?: string;
}

interface GroupedNotes {
  [disciplineName: string]: {
    [topicName: string]: QuestionNote[];
  };
}

export default function Anotacoes() {
  const navigate = useNavigate();
  const { goBack } = useBackNavigation();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  const { data: notes, isLoading } = useQuery({
    queryKey: ["user-question-notes", user?.id],
    queryFn: async (): Promise<QuestionNote[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("question_notes")
        .select(`
          id,
          question_id,
          discipline_id,
          topic_id,
          discipline_name,
          topic_name,
          content,
          created_at,
          questions!inner(code)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching notes:", error);
        throw error;
      }

      return (data || []).map((note: any) => ({
        id: note.id,
        question_id: note.question_id,
        discipline_id: note.discipline_id,
        topic_id: note.topic_id,
        discipline_name: note.discipline_name || "Sem Disciplina",
        topic_name: note.topic_name || "Sem Tópico",
        content: note.content,
        created_at: note.created_at,
        question_code: note.questions?.code,
      }));
    },
    enabled: !!user?.id,
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from("question_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-question-notes"] });
      toast.success("Anotação excluída com sucesso!");
    },
    onError: (error) => {
      console.error("Error deleting note:", error);
      toast.error("Erro ao excluir anotação");
    },
  });

  // Group notes by discipline and topic
  const groupedNotes = useMemo(() => {
    if (!notes) return {} as GroupedNotes;

    const filtered = notes.filter(note => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        note.content.toLowerCase().includes(search) ||
        note.discipline_name?.toLowerCase().includes(search) ||
        note.topic_name?.toLowerCase().includes(search) ||
        note.question_code?.toLowerCase().includes(search)
      );
    });

    return filtered.reduce((acc, note) => {
      const discipline = note.discipline_name || "Sem Disciplina";
      const topic = note.topic_name || "Sem Tópico";

      if (!acc[discipline]) {
        acc[discipline] = {};
      }
      if (!acc[discipline][topic]) {
        acc[discipline][topic] = [];
      }
      acc[discipline][topic].push(note);
      return acc;
    }, {} as GroupedNotes);
  }, [notes, searchTerm]);

  const toggleDiscipline = (discipline: string) => {
    setExpandedDisciplines((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(discipline)) {
        newSet.delete(discipline);
      } else {
        newSet.add(discipline);
      }
      return newSet;
    });
  };

  const toggleTopic = (key: string) => {
    setExpandedTopics((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleGoToQuestion = (questionId: string) => {
    // Navigate to banco-questoes with specific question filter
    navigate(`/banco-questoes?questionId=${questionId}`);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const totalNotes = notes?.length || 0;
  const disciplineCount = Object.keys(groupedNotes).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={goBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="font-heading text-xl font-bold">Minhas Anotações</h1>
                  <p className="text-sm text-muted-foreground">
                    {totalNotes} anotação{totalNotes !== 1 ? "ões" : ""} em {disciplineCount} disciplina{disciplineCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar anotações..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : Object.keys(groupedNotes).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedNotes)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([disciplineName, topics]) => {
                const isDisciplineExpanded = expandedDisciplines.has(disciplineName);
                const topicCount = Object.keys(topics).length;
                const noteCount = Object.values(topics).flat().length;

                return (
                  <Card key={disciplineName} className="overflow-hidden">
                    <CardHeader
                      className="cursor-pointer hover:bg-muted/50 transition-colors py-4"
                      onClick={() => toggleDiscipline(disciplineName)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isDisciplineExpanded ? (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          )}
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-primary" />
                          </div>
                          <CardTitle className="text-base font-semibold">
                            {disciplineName}
                          </CardTitle>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {topicCount} tópico{topicCount !== 1 ? "s" : ""} • {noteCount} anotação{noteCount !== 1 ? "ões" : ""}
                        </span>
                      </div>
                    </CardHeader>

                    {isDisciplineExpanded && (
                      <CardContent className="pt-0 pb-4">
                        <div className="space-y-3 pl-8">
                          {Object.entries(topics)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([topicName, topicNotes]) => {
                              const topicKey = `${disciplineName}-${topicName}`;
                              const isTopicExpanded = expandedTopics.has(topicKey);

                              return (
                                <div key={topicKey} className="border rounded-lg overflow-hidden">
                                  <div
                                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => toggleTopic(topicKey)}
                                  >
                                    <div className="flex items-center gap-2">
                                      {isTopicExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                      )}
                                      <span className="font-medium text-sm">{topicName}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {topicNotes.length} anotação{topicNotes.length !== 1 ? "ões" : ""}
                                    </span>
                                  </div>

                                  {isTopicExpanded && (
                                    <div className="border-t bg-muted/20">
                                      {topicNotes.map((note) => (
                                        <div
                                          key={note.id}
                                          className="p-4 border-b last:border-b-0"
                                        >
                                          <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 mb-2">
                                                <button
                                                  onClick={() => handleGoToQuestion(note.question_id)}
                                                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                                                >
                                                  <Link2 className="w-3 h-3" />
                                                  {note.question_code || "Ver questão"}
                                                </button>
                                                <span className="text-xs text-muted-foreground">
                                                  • {formatDate(note.created_at)}
                                                </span>
                                              </div>
                                              <p className="text-sm text-foreground whitespace-pre-wrap">
                                                {note.content}
                                              </p>
                                            </div>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                              onClick={() => {
                                                if (confirm("Tem certeza que deseja excluir esta anotação?")) {
                                                  deleteNoteMutation.mutate(note.id);
                                                }
                                              }}
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">Nenhuma anotação encontrada</p>
            <p className="text-muted-foreground text-center max-w-md">
              {searchTerm
                ? "Nenhuma anotação corresponde à sua busca."
                : "Crie anotações nas questões do banco para organizá-las aqui automaticamente por disciplina e tópico."}
            </p>
            {!searchTerm && (
              <Button onClick={() => navigate("/banco-questoes")}>
                Ir para o Banco de Questões
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
