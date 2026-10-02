import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface KpiCardProps {
  label: string;
  value: string | number;
  trend?: { value: number; label: string } | string; // Support both object and string
  icon: LucideIcon;
  color: "blue" | "green" | "yellow" | "red" | "purple" | "orange";
  onClick?: () => void;
  className?: string;
  delay?: number; // Stagger delay in ms
}

const colorMap = {
  blue: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400", badge: "bg-blue-50", border: "border-blue-100" },
  green: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-400", badge: "bg-green-50", border: "border-green-100" },
  yellow: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-400", badge: "bg-yellow-50", border: "border-yellow-100" },
  red: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-400", badge: "bg-red-50", border: "border-red-100" },
  purple: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-400", badge: "bg-purple-50", border: "border-purple-100" },
  orange: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-400", badge: "bg-orange-50", border: "border-orange-100" },
};

export function KpiCard({ label, value, trend, icon: Icon, color, onClick, className, delay = 0 }: KpiCardProps) {
  const colors = colorMap[color];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        "bg-white rounded-lg border p-6 shadow-sm transition-all duration-300",
        colors.border,
        onClick && "cursor-pointer hover:shadow-md hover:border-primary-300 hover:-translate-y-1",
        className,
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}
      onClick={onClick}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Badge para label */}
          <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md mb-4", colors.badge, colors.border)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", colors.dot)} />
            <p className={cn("text-xs font-semibold uppercase tracking-wide", colors.text)}>{label}</p>
          </div>

          {/* Valor principal */}
          <p className="text-3xl font-bold text-gray-900 truncate transition-all duration-300">{value}</p>

          {/* Tendência */}
          {trend && (
            <p className="text-sm text-gray-500 mt-3">
              {typeof trend === "string" ? (
                <span className="font-semibold text-blue-600">{trend}</span>
              ) : (
                <span className={cn("font-semibold", trend.value > 0 ? "text-green-600" : "text-red-600")}>
                  {trend.value > 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
                </span>
              )}
              {typeof trend !== "string" && <span>{" "}{trend.label}</span>}
            </p>
          )}
        </div>

        {/* Ícone em background */}
        <div className={cn("flex-shrink-0 p-3 rounded-lg transition-transform duration-300", colors.bg, onClick && "group-hover:scale-110")}>
          <Icon className={cn("h-5 w-5", colors.text)} />
        </div>
      </div>
    </div>
  );
}