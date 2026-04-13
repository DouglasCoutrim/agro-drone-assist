import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

type KpiColor = "green" | "amber" | "red" | "blue" | "slate";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: KpiColor;
  trend?: { value: number; label: string };
  onClick?: () => void;
}

const colorClasses: Record<KpiColor, { icon: string; bar: string; trend: string }> = {
  green: { icon: "bg-vc-green-light text-vc-green-text", bar: "bg-primary", trend: "text-vc-green-text" },
  amber: { icon: "bg-vc-amber-light text-vc-amber-text", bar: "bg-warning", trend: "text-vc-amber-text" },
  red: { icon: "bg-vc-red-light text-vc-red-text", bar: "bg-destructive", trend: "text-vc-red-text" },
  blue: { icon: "bg-vc-blue-light text-vc-blue-text", bar: "bg-vc-blue", trend: "text-vc-blue-text" },
  slate: { icon: "bg-vc-slate-light text-vc-slate-text", bar: "bg-vc-slate", trend: "text-vc-slate-text" },
};

export function KpiCard({ label, value, icon: Icon, color, trend, onClick }: KpiCardProps) {
  const classes = colorClasses[color];

  return (
    <div
      className={cn(
        "relative bg-card border border-border rounded-2xl p-5 transition-all duration-200 overflow-hidden",
        "shadow-soft hover:shadow-medium hover:-translate-y-0.5 hover:border-input",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      {/* Top color bar */}
      <div className={cn("absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl", classes.bar)} />

      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-muted-foreground">{label}</p>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", classes.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <p className="font-display text-[32px] font-bold leading-none text-foreground mb-1.5">{value}</p>

      {trend && (
        <div className={cn("text-xs flex items-center gap-1", trend.value >= 0 ? "text-vc-green-text" : "text-vc-red-text")}>
          {trend.value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{Math.abs(trend.value)}% {trend.label}</span>
        </div>
      )}
    </div>
  );
}
