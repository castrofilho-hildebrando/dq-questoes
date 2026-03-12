import ConselhoThemeWrapper from "@/components/ConselhoThemeWrapper";
import { Bot, Loader2, ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { useRobots } from "@/hooks/useRobots";
import { TutorRobotCard } from "@/components/tutor/TutorRobotCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TutorialActionCard } from "@/components/TutorialActionCard";

export default function TutorDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromCronograma = searchParams.get("fromCronograma") === "true";
  const { goBack } = useBackNavigation();
  const { mandatoryRobots, areaRobots, isLoading, error } = useRobots();
  
  const handleBack = () => {
    if (fromCronograma) {
      window.close();
    } else {
      goBack();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </header>
        <main className="container max-w-3xl py-6 space-y-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Erro ao carregar robôs tutores</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const hasRobots = (mandatoryRobots?.length || 0) + (areaRobots?.length || 0) > 0;

  return (
    <ConselhoThemeWrapper>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-4 py-4">
        <div className="container max-w-3xl">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Robô Tutor</h1>
                <p className="text-sm text-muted-foreground">
                  Seus tutores de IA para questões de concurso
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-3xl py-6">
        <TutorialActionCard productSlug="robo-tutor" />
        {!hasRobots ? (
          <div className="text-center py-12">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Nenhum robô disponível</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Selecione suas áreas de interesse para ver robôs tutores especializados.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Mandatory robots */}
            {mandatoryRobots && mandatoryRobots.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4">
                  Robôs Principais
                </h2>
                <div className="space-y-3">
                  {mandatoryRobots.map((robot) => (
                    <TutorRobotCard
                      key={robot.id}
                      id={robot.id}
                      name={robot.name}
                      description={robot.description}
                      icon={robot.icon}
                      url={robot.url}
                      isMandatory={true}
                      areas={robot.areas}
                      returnTo={fromCronograma ? "cronograma" : null}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Area robots */}
            {areaRobots && areaRobots.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4">
                  Robôs das suas Áreas
                </h2>
                <div className="space-y-3">
                  {areaRobots.map((robot) => (
                    <TutorRobotCard
                      key={robot.id}
                      id={robot.id}
                      name={robot.name}
                      description={robot.description}
                      icon={robot.icon}
                      url={robot.url}
                      isMandatory={false}
                      areas={robot.areas}
                      returnTo={fromCronograma ? "cronograma" : null}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
    </ConselhoThemeWrapper>
  );
}
