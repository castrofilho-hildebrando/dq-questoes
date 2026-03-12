import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface TutorChatMessageProps {
  role: "user" | "assistant";
  content: string;
  robotIcon?: string | null;
}

export function TutorChatMessage({ role, content, robotIcon }: TutorChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={cn(
      "flex gap-3 p-4",
      isUser ? "bg-muted/50" : "bg-background"
    )}>
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        isUser ? "bg-primary text-primary-foreground" : "bg-secondary"
      )}>
        {isUser ? (
          <User className="h-4 w-4" />
        ) : robotIcon ? (
          <span className="text-lg">{robotIcon}</span>
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
      
      <div className="flex-1 space-y-2 overflow-hidden">
        <p className="text-sm font-medium">
          {isUser ? "Você" : "Tutor"}
        </p>
        <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
