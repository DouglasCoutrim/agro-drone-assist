import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface AlertBoxProps {
  title: string;
  items: { label: string; value: string }[];
  type: "error" | "warning" | "info" | "success";
  onAction?: () => void;
  actionLabel?: string;
  icon: LucideIcon;
  className?: string;
  delay?: number; // Stagger delay for entrance animation
}

const typeMap = {
  error: { bg: "bg-red-50", border: "border-red-200", icon: "bg-red-100 text-red-600", title: "text-red-900", text: "text-red-700" },
  warning: { bg: "bg-yellow-50", border: "border-yellow-200", icon: "bg-yellow-100 text-yellow-600", title: "text-yellow-900", text: "text-yellow-700" },
  info: { bg: "bg-blue-50", border: "border-blue-200", icon: "bg-blue-100 text-blue-600", title: "text-blue-900", text: "text-blue-700" },
  success: { bg: "bg-green-50", border: "border-green-200", icon: "bg-green-100 text-green-600", title: "text-green-900", text: "text-green-700" },
};

export function AlertBox({
  title,
  items,
  type,
  onAction,
  actionLabel,
  icon: Icon,
  className,
  delay = 0,
}: AlertBoxProps) {
  const styles = typeMap[type];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        "bg-white border rounded-lg p-4 hover:shadow-sm transition-all duration-300",
        styles.border,
        className,
        visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95"
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex gap-3">
        {/* Ícone */}
        <div className={cn("flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg", styles.icon)}>
          <Icon className="h-4 w-4" />
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <h3 className={cn("text-sm font-semibold", styles.title)}>{title}</h3>

          {/* Lista de itens */}
          {items.length > 0 && (
            <div className="mt-2 space-y-1">
              {items.map((item, idx) => (
                <p key={idx} className={cn("text-sm", styles.text)}>
                  <span className="font-medium text-gray-900">{item.label}</span>
                  {" — "}{item.value}
                </p>
              ))}
            </div>
          )}

          {/* CTA */}
          {onAction && actionLabel && (
            <button
              onClick={onAction}
              className={cn("mt-3 text-xs font-semibold transition-colors", styles.text, "hover:underline")}
            >
              {actionLabel} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}