import { Bot, ChevronRight, ExternalLink, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";

interface TutorRobotCardProps {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  url?: string | null;
  isMandatory?: boolean;
  areas?: { id: string; name: string }[];
  returnTo?: string | null;
}

export function TutorRobotCard({
  id,
  name,
  description,
  icon,
  url,
  isMandatory,
  areas = [],
  returnTo,
}: TutorRobotCardProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from");

  const handleClick = () => {
    if (url) {
      window.open(url, "_blank");
    } else {
      const params = new URLSearchParams();
      if (returnTo) params.set("fromCronograma", "true");
      if (from) params.set("from", from);
      const qs = params.toString();
      navigate(`/tutor/chat/${id}${qs ? `?${qs}` : ""}`);
    }
  };

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
        isMandatory && "border-primary/30 bg-primary/5"
      )}
      onClick={handleClick}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
          isMandatory ? "bg-primary/20" : "bg-secondary"
        )}>
          {icon ? (
            <span className="text-2xl">{icon}</span>
          ) : (
            <Bot className="h-6 w-6 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{name}</h3>
            {isMandatory && (
              <Star className="h-4 w-4 text-primary shrink-0" fill="currentColor" />
            )}
          </div>
          
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {description}
            </p>
          )}

        </div>

        <div className="shrink-0">
          {url ? (
            <ExternalLink className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
