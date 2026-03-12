import ConselhoThemeWrapper from "@/components/ConselhoThemeWrapper";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, FileText, Lock, Video } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function CourseContent() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { fromSuffix } = useBackNavigation();



  const { data: course, isLoading: loadingCourse } = useQuery({
    queryKey: ["dissertative-course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dissertative_courses")
        .select("*")
        .eq("id", courseId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  const { data: disciplines, isLoading: loadingDisciplines } = useQuery({
    queryKey: ["dissertative-course-disciplines", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dissertative_course_disciplines")
        .select(`
          *,
          discipline:study_disciplines!dissertative_course_disciplines_discipline_id_fkey(id, name)
        `)
        .eq("course_id", courseId!)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;

      // Show ALL disciplines explicitly linked to this dissertative course
      // The link in dissertative_course_disciplines is the source of truth
      return data;
    },
    enabled: !!courseId,
  });

  // Fetch user's area names to match against discipline names
  const { data: userAreaNames } = useQuery({
    queryKey: ["user-area-names", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_areas")
        .select("area_id, areas(name)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).map((ua: any) => ua.areas?.name?.toLowerCase().trim()).filter(Boolean) as string[];
    },
    enabled: !!user?.id,
  });

  const { data: questionCounts } = useQuery({
    queryKey: ["dissertative-question-counts", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dissertative_questions")
        .select("discipline_id")
        .eq("course_id", courseId!)
        .eq("is_active", true);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((q) => {
        counts[q.discipline_id] = (counts[q.discipline_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!courseId,
  });

  const isSpecialEmail = user?.email?.toLowerCase() === "dissecadordequestoes@gmail.com";

  const isDisciplineUnlocked = (disciplineName: string): boolean => {
    if (isAdmin || isSpecialEmail) return true;
    // If course access_mode is 'all', unlock everything for all students
    if (course?.access_mode === 'all') return true;
    if (!userAreaNames || userAreaNames.length === 0) return false;
    const normalized = disciplineName.toLowerCase().trim();
    return userAreaNames.some((areaName) => 
      normalized.includes(areaName) || areaName.includes(normalized)
    );
  };

  const isLoading = loadingCourse || loadingDisciplines;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Curso não encontrado.</p>
      </div>
    );
  }

  // Sort: unlocked first, then locked
  const sortedDisciplines = [...(disciplines || [])].sort((a, b) => {
    const aName = (a as any).discipline?.name || "";
    const bName = (b as any).discipline?.name || "";
    const aUnlocked = isDisciplineUnlocked(aName);
    const bUnlocked = isDisciplineUnlocked(bName);
    if (aUnlocked && !bUnlocked) return -1;
    if (!aUnlocked && bUnlocked) return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/dissertativa${fromSuffix}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{course.title}</h1>
            {course.description && <p className="text-muted-foreground text-sm">{course.description}</p>}
          </div>
        </div>

        <Tabs defaultValue="disciplines" className="space-y-4">
          <TabsList>
            <TabsTrigger value="disciplines">Disciplinas</TabsTrigger>
            <TabsTrigger value="modules">Materiais</TabsTrigger>
          </TabsList>

          <TabsContent value="disciplines" className="space-y-3">
            {!disciplines?.length ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  Nenhuma disciplina cadastrada.
                </CardContent>
              </Card>
            ) : (
              <TooltipProvider>
                {sortedDisciplines.map((cd) => {
                  const count = questionCounts?.[cd.discipline_id] || 0;
                  const name = (cd as any).discipline?.name || "Disciplina";
                  const unlocked = isDisciplineUnlocked(name);

                  return (
                    <Tooltip key={cd.id}>
                      <TooltipTrigger asChild>
                        <Card
                          className={`transition-colors ${
                            unlocked
                              ? "cursor-pointer hover:border-primary/50 border-primary/20 bg-card"
                              : "opacity-50 cursor-not-allowed border-border/50 bg-muted/30"
                          }`}
                          onClick={() => {
                            if (unlocked) navigate(`/dissertativa/${courseId}/${cd.discipline_id}${fromSuffix}`);
                          }}
                        >
                          <CardHeader className="py-4">
                            <CardTitle className="text-base flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                {unlocked ? (
                                  <BookOpen className="w-4 h-4 text-primary" />
                                ) : (
                                  <Lock className="w-4 h-4 text-muted-foreground" />
                                )}
                                <span className={unlocked ? "text-foreground" : "text-muted-foreground"}>
                                  {name}
                                </span>
                              </span>
                              <div className="flex items-center gap-2">
                                {unlocked && course?.access_mode !== 'all' && (
                                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                                    Sua área
                                  </Badge>
                                )}
                                <Badge variant="secondary">{count} {count === 1 ? "questão" : "questões"}</Badge>
                              </div>
                            </CardTitle>
                          </CardHeader>
                        </Card>
                      </TooltipTrigger>
                      {!unlocked && (
                        <TooltipContent>
                          <p>Esta disciplina não faz parte das suas áreas selecionadas</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
            )}
          </TabsContent>

          <TabsContent value="modules">
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`/dissertativa/${courseId}/materiais${fromSuffix}`)}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Video className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Acessar Materiais</h3>
                  <p className="text-sm text-muted-foreground">Vídeos e PDFs organizados por seção</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function DissertativaCourse() {
  return <ConselhoThemeWrapper><CourseContent /></ConselhoThemeWrapper>;
}
