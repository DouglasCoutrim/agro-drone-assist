import { LucideIcon, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface AlertBoxProps {
  title: string;
  items: { label: string; value: string }[];
  type: "error" | "warning" | "info" | "success";
  onAction?: () => void;
  actionLabel?: string;
  icon?: LucideIcon;
  className?: string;
  delay?: number; // Stagger delay for entrance animation
}

const typeMap = {
  error: { bg: "bg-destructive/10", border: "border-destructive/30", icon: "bg-destructive/15 text-destructive", title: "text-destructive", text: "text-destructive/90" },
  warning: { bg: "bg-warning/10", border: "border-warning/30", icon: "bg-warning/15 text-warning", title: "text-warning", text: "text-warning/90" },
  info: { bg: "bg-primary/10", border: "border-primary/30", icon: "bg-primary/15 text-primary", title: "text-primary", text: "text-primary/90" },
  success: { bg: "bg-success/10", border: "border-success/30", icon: "bg-success/15 text-success", title: "text-success", text: "text-success/90" },
};

export function AlertBox({
  title,
  items,
  type,
  onAction,
  actionLabel,
  icon: Icon = Info,
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
        "livreos-glass border rounded-lg p-4 hover:shadow-md transition-all duration-300",
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
                  <span className="font-medium text-foreground">{item.label}</span>
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