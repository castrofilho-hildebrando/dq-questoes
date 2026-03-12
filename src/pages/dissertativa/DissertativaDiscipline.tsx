import ConselhoThemeWrapper from "@/components/ConselhoThemeWrapper";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBackNavigation } from "@/hooks/useBackNavigation";

function DisciplineContent() {
  const { courseId, disciplineId } = useParams<{ courseId: string; disciplineId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fromSuffix } = useBackNavigation();

  const { data: discipline } = useQuery({
    queryKey: ["study-discipline", disciplineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_disciplines")
        .select("id, name")
        .eq("id", disciplineId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!disciplineId,
  });

  const { data: questions, isLoading } = useQuery({
    queryKey: ["dissertative-questions", courseId, disciplineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dissertative_questions")
        .select("id, statement, display_order, topic_id, dissertative_topics(title)")
        .eq("course_id", courseId!)
        .eq("discipline_id", disciplineId!)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!courseId && !!disciplineId,
  });

  const { data: submissions } = useQuery({
    queryKey: ["dissertative-submissions-list", courseId, disciplineId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dissertative_submissions")
        .select("question_id, score")
        .eq("course_id", courseId!)
        .eq("discipline_id", disciplineId!)
        .eq("user_id", user!.id);
      if (error) throw error;
      const map: Record<string, number> = {};
      data.forEach((s) => {
        if (!map[s.question_id] || (s.score ?? 0) > map[s.question_id]) {
          map[s.question_id] = s.score ?? 0;
        }
      });
      return map;
    },
    enabled: !!courseId && !!disciplineId && !!user?.id,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/dissertativa/${courseId}${fromSuffix}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{discipline?.name || "Disciplina"}</h1>
            <p className="text-muted-foreground text-sm">
              {questions?.length || 0} {(questions?.length || 0) === 1 ? "questão" : "questões"} disponíveis
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : !questions?.length ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Nenhuma questão cadastrada para esta disciplina.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {questions.map((q, idx) => {
              const bestScore = submissions?.[q.id];
              const answered = bestScore !== undefined;
              return (
                <Card
                  key={q.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(`/dissertativa/${courseId}/${disciplineId}/${q.id}${fromSuffix}`)}
                >
                  <CardHeader className="py-4">
                     <CardTitle className="text-sm font-medium flex items-center justify-between gap-3">
                       <div className="flex items-center gap-2 flex-1 min-w-0">
                         {answered ? (
                           <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                         ) : (
                           <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                         )}
                         <div className="min-w-0">
                           <span className="truncate block">Questão {idx + 1}</span>
                           {(q as any).dissertative_topics?.title && (
                             <span className="text-xs font-normal text-muted-foreground truncate block">
                               {(q as any).dissertative_topics.title}
                             </span>
                           )}
                         </div>
                       </div>
                       {answered && (
                         <Badge variant="secondary" className="shrink-0">
                           Nota: {bestScore}/10
                         </Badge>
                       )}
                     </CardTitle>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DissertativaDiscipline() {
  return <ConselhoThemeWrapper><DisciplineContent /></ConselhoThemeWrapper>;
}
