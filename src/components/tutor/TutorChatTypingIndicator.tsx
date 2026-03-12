import { motion } from "framer-motion";
import { Bot } from "lucide-react";

interface TutorChatTypingIndicatorProps {
  robotIcon?: string | null;
}

export function TutorChatTypingIndicator({ robotIcon }: TutorChatTypingIndicatorProps) {
  return (
    <div className="flex gap-3 p-4 bg-background">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
        {robotIcon ? (
          <span className="text-lg">{robotIcon}</span>
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
      
      <div className="flex items-center gap-1 py-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-2 w-2 rounded-full bg-primary"
            initial={{ opacity: 0.4 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </div>
  );
}
