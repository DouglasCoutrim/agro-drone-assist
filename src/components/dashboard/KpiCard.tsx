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

const colorClasses: Record<KpiColor, { 
  bg: string;
  icon: string; 
  bar: string; 
  trend: string;
}> = {
  green: { 
    bg: "bg-green-50", 
    icon: "bg-green-100 text-green-700", 
    bar: "bg-green-500", 
    trend: "text-green-700" 
  },
  amber: { 
    bg: "bg-amber-50", 
    icon: "bg-amber-100 text-amber-700", 
    bar: "bg-amber-500", 
    trend: "text-amber-700" 
  },
  red: { 
    bg: "bg-red-50", 
    icon: "bg-red-100 text-red-700", 
    bar: "bg-red-500", 
    trend: "text-red-700" 
  },
  blue: { 
    bg: "bg-blue-50", 
    icon: "bg-blue-100 text-blue-700", 
    bar: "bg-blue-500", 
    trend: "text-blue-700" 
  },
  slate: { 
    bg: "bg-slate-50", 
    icon: "bg-slate-100 text-slate-700", 
    bar: "bg-slate-500", 
    trend: "text-slate-700" 
  },
};

export function KpiCard({ label, value, icon: Icon, color, trend, onClick }: KpiCardProps) {
  const classes = colorClasses[color];

  return (
    <div
      className={cn(
        "relative rounded-2xl p-5 transition-all duration-200 overflow-hidden shadow-sm border border-slate-100/50",
        classes.bg,
        onClick && "cursor-pointer hover:-translate-y-0.5"
      )}
      onClick={onClick}
    >
      {/* Top color bar */}
      <div className={cn("absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl", classes.bar)} />

      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-slate-600">{label}</p>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", classes.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <p className="text-3xl font-bold leading-none text-slate-800 mb-1.5">{value}</p>

      {trend && (
        <div className={cn("text-xs flex items-center gap-1", trend.value >= 0 ? "text-green-700" : "text-red-700")}>
          {trend.value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{Math.abs(trend.value)}% {trend.label}</span>
        </div>
      )}
    </div>
  );
}
