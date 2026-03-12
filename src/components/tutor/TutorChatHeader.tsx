import { ArrowLeft, Bot, RotateCcw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";

interface TutorChatHeaderProps {
  robotName: string;
  robotIcon?: string | null;
  robotUrl?: string | null;
  onClearChat: () => void;
}

export function TutorChatHeader({ 
  robotName, 
  robotIcon, 
  robotUrl,
  onClearChat 
}: TutorChatHeaderProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromCronograma = searchParams.get("fromCronograma") === "true";
  const from = searchParams.get("from");

  const handleBack = () => {
    if (fromCronograma) {
      window.close();
    } else {
      navigate(from ? `/tutor?from=${from}` : '/tutor');
    }
  };

  return (
    <header className="flex items-center justify-between border-b bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center gap-2">
          {robotIcon ? (
            <span className="text-2xl">{robotIcon}</span>
          ) : (
            <Bot className="h-6 w-6 text-primary" />
          )}
          <div>
            <h1 className="font-semibold">{robotName}</h1>
            <p className="text-xs text-muted-foreground">Robô Tutor</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {robotUrl && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.open(robotUrl, "_blank")}
            title="Abrir link externo"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearChat}
          title="Limpar conversa"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
