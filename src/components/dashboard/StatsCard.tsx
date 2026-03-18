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
        "shadow-soft card-hover",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {change && (
              <p className={cn("text-xs", change.trend === "up" ? "text-success" : "text-destructive")}>
                {change.trend === "up" ? "+" : "-"}{change.value}%
              </p>
            )}
          </div>
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            variant === "success" && "bg-success/10 text-success",
            variant === "warning" && "bg-warning/10 text-warning",
            variant === "destructive" && "bg-destructive/10 text-destructive",
            variant === "default" && "bg-primary/10 text-primary"
          )}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
