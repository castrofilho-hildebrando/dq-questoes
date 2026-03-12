import ConselhoThemeWrapper from "@/components/ConselhoThemeWrapper";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { TutorialActionCard } from "@/components/TutorialActionCard";

function DissertativaCoursesContent() {
  const navigate = useNavigate();
  const { goBack, fromSuffix } = useBackNavigation();

  const { data: courses, isLoading } = useQuery({
    queryKey: ["dissertative-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dissertative_courses")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dissecando a Dissertativa</h1>
            <p className="text-muted-foreground text-sm">Pratique questões dissertativas com correção por IA</p>
          </div>
        </div>

        <TutorialActionCard productSlug="dissecando-discursiva" />

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        ) : !courses?.length ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhum curso disponível no momento.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <Card
                key={course.id}
                className="cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                onClick={() => navigate(`/dissertativa/${course.id}${fromSuffix}`)}
              >
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  {course.image_url ? (
                    <img src={course.image_url} alt={course.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <CardHeader className="pb-3 pt-4 bg-card">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    {course.title}
                  </CardTitle>
                  {course.description && (
                    <CardDescription>{course.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DissertativaCourses() {
  return <ConselhoThemeWrapper><DissertativaCoursesContent /></ConselhoThemeWrapper>;
}
