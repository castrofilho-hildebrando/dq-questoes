import { useState, useRef, useEffect } from "react";
import { Send, Loader2, StopCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface TutorChatInputProps {
  onSend: (message: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  placeholder?: string;
  twoStepMode?: boolean;
}

type Step = "question" | "answer";

const ANSWER_OPTIONS = ["A", "B", "C", "D", "E"] as const;

export function TutorChatInput({ 
  onSend, 
  onCancel, 
  isLoading, 
  placeholder = "Digite sua questão aqui...",
  twoStepMode = false
}: TutorChatInputProps) {
  const [input, setInput] = useState("");
  const [step, setStep] = useState<Step>("question");
  const [questionText, setQuestionText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (isLoading) return;

    if (twoStepMode) {
      if (step === "question" && input.trim()) {
        // Save the question and move to answer step
        setQuestionText(input.trim());
        setInput("");
        setStep("answer");
      }
      // Answer step is handled by handleAnswerSelect
    } else {
      // Original single-step behavior
      if (input.trim()) {
        onSend(input.trim());
        setInput("");
      }
    }
  };

  const handleAnswerSelect = (answer: string) => {
    if (isLoading) return;
    
    // Send the formatted message
    const formattedMessage = `${questionText}\n\nResposta: ${answer}`;
    onSend(formattedMessage);
    
    // Reset state
    setQuestionText("");
    setStep("question");
    setInput("");
  };

  const handleBack = () => {
    // Go back to question step with the saved question
    setInput(questionText);
    setQuestionText("");
    setStep("question");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Two-step mode: Answer selection step
  if (twoStepMode && step === "answer") {
    return (
      <div className="border-t bg-card p-4">
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="h-8 px-2"
              disabled={isLoading}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <span className="text-sm font-medium text-muted-foreground">
              Etapa 2/2: Selecione o gabarito
            </span>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 max-h-24 overflow-y-auto">
            <p className="text-xs text-muted-foreground line-clamp-3">
              {questionText}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 justify-center">
          {ANSWER_OPTIONS.map((option) => (
            <Button
              key={option}
              variant="outline"
              size="lg"
              onClick={() => handleAnswerSelect(option)}
              disabled={isLoading}
              className="w-12 h-12 text-lg font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {option}
            </Button>
          ))}
        </div>
        
        <p className="mt-3 text-xs text-muted-foreground text-center">
          Clique na letra correspondente à resposta correta
        </p>
      </div>
    );
  }

  // Default: Question input step (or single-step mode)
  return (
    <div className="border-t bg-card p-4">
      {twoStepMode && (
        <div className="mb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Etapa 1/2: Digite o enunciado da questão
          </span>
        </div>
      )}
      
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={twoStepMode ? "Cole ou digite o enunciado completo da questão..." : placeholder}
          disabled={isLoading}
          className="min-h-[44px] max-h-[200px] resize-none"
          rows={1}
        />
        
        {isLoading ? (
          <Button
            variant="destructive"
            size="icon"
            onClick={onCancel}
            className="shrink-0"
          >
            <StopCircle className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <p className="mt-2 text-xs text-muted-foreground text-center">
        {twoStepMode 
          ? "Pressione Enter para avançar para a seleção do gabarito" 
          : "Pressione Enter para enviar, Shift+Enter para nova linha"}
      </p>
    </div>
  );
}
