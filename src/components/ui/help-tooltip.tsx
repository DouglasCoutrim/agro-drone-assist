import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HelpTooltipProps {
  content: React.ReactNode;
  className?: string;
  size?: number;
  side?: "top" | "right" | "bottom" | "left";
}

export function HelpTooltip({ content, className, size = 16, side = "top" }: HelpTooltipProps) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Ajuda"
          className={cn(
            "inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full",
            className,
          )}
        >
          <Info size={size} />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[260px] text-xs leading-relaxed">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export default HelpTooltip;
