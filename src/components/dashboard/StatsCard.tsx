import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: "up" | "down";
  };
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "destructive";
}

export function StatsCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  variant = "default" 
}: StatsCardProps) {
  return (
    <Card className="relative overflow-hidden shadow-soft hover:shadow-medium transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {change && (
              <p className={cn(
                "text-sm font-medium",
                change.trend === "up" ? "text-success" : "text-destructive"
              )}>
                {change.trend === "up" ? "+" : "-"}{change.value}% vs mês anterior
              </p>
            )}
          </div>
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-lg",
            variant === "success" && "bg-success/10 text-success",
            variant === "warning" && "bg-warning/10 text-warning",
            variant === "destructive" && "bg-destructive/10 text-destructive",
            variant === "default" && "bg-primary/10 text-primary"
          )}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}