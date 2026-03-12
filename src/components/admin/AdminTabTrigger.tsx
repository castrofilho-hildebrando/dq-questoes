import { TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AdminTabTriggerProps {
  value: string;
  icon: React.ReactNode;
  label: string;
  showLabel?: boolean;
  description?: string;
}

export function AdminTabTrigger({ 
  value, 
  icon, 
  label, 
  showLabel = true,
  description 
}: AdminTabTriggerProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <TabsTrigger value={value} className="flex items-center gap-2">
            {icon}
            {showLabel && <span className="hidden sm:inline">{label}</span>}
            {!showLabel && <span className="sr-only">{label}</span>}
          </TabsTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium">{label}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
