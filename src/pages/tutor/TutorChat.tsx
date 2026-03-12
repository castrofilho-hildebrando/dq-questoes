import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useRobot } from "@/hooks/useRobots";
import { useTutorChat } from "@/hooks/useTutorChat";
import { TutorChatHeader } from "@/components/tutor/TutorChatHeader";
import { TutorChatMessage } from "@/components/tutor/TutorChatMessage";
import { TutorChatInput } from "@/components/tutor/TutorChatInput";
import { TutorChatTypingIndicator } from "@/components/tutor/TutorChatTypingIndicator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export default function TutorChat() {
  const { robotId } = useParams<{ robotId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: robot, isLoading: robotLoading, error: robotError } = useRobot(robotId);

  const {
    messages,
    isLoading: chatLoading,
    error: chatError,
    sendMessage,
    cancelRequest,
    clearMessages,
  } = useTutorChat({
    robotId: robotId || "",
    systemPrompt: robot?.systemPrompt || "",
    model: robot?.model || "gpt-4o",
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Redirect if robot not found
  useEffect(() => {
    if (robotError) {
      navigate(from ? `/tutor?from=${from}` : "/tutor");
    }
  }, [robotError, navigate, from]);

  if (robotLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!robot) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <TutorChatHeader
        robotName={robot.name}
        robotIcon={robot.icon}
        robotUrl={robot.url}
        onClearChat={clearMessages}
      />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="text-4xl mb-4">
              {robot.icon || "🤖"}
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {robot.name}
            </h2>
            <p className="text-muted-foreground max-w-md">
              {robot.description || "Envie uma questão de concurso para receber uma explicação detalhada."}
            </p>
            <div className="mt-6 p-4 bg-muted rounded-lg max-w-md text-left">
              <p className="text-sm font-medium mb-2">💡 Dica:</p>
              <p className="text-sm text-muted-foreground">
                Cole a questão completa e informe a resposta correta no formato:
                <br />
                <code className="bg-background px-1 rounded">Resposta: A</code>
              </p>
            </div>
          </div>
        ) : (
          <div>
            {messages.map((message) => (
              <TutorChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
                robotIcon={robot.icon}
              />
            ))}
            
            {chatLoading && messages[messages.length - 1]?.content === "" && (
              <TutorChatTypingIndicator robotIcon={robot.icon} />
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error display */}
      {chatError && (
        <Alert variant="destructive" className="mx-4 mb-2">
          <AlertDescription>{chatError}</AlertDescription>
        </Alert>
      )}

      <TutorChatInput
        onSend={sendMessage}
        onCancel={cancelRequest}
        isLoading={chatLoading}
        placeholder="Digite sua questão aqui..."
        twoStepMode={true}
      />
    </div>
  );
}
