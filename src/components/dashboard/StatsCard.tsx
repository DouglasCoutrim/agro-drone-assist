import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: { value: number; trend: "up" | "down" };
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "destructive";
  onClick?: () => void;
}

export function StatsCard({ title, value, change, icon: Icon, variant = "default", onClick }: StatsCardProps) {
  return (
    <Card 
      className={cn(
        "shadow-soft transition-all duration-200 hover:shadow-medium border-border/50",
        onClick && "cursor-pointer hover:border-primary/20"
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-lg sm:text-xl font-bold text-foreground truncate">{value}</p>
            {change && (
              <p className={cn("text-[10px]", change.trend === "up" ? "text-success" : "text-destructive")}>
                {change.trend === "up" ? "↑" : "↓"} {change.value}%
              </p>
            )}
          </div>
          <div className={cn(
            "flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg shrink-0",
            variant === "success" && "bg-success/10 text-success",
            variant === "warning" && "bg-warning/10 text-warning",
            variant === "destructive" && "bg-destructive/10 text-destructive",
            variant === "default" && "bg-primary/10 text-primary"
          )}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
