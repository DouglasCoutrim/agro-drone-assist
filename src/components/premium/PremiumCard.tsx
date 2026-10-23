import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface PremiumCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean; // Ativa hover effect
  padding?: "sm" | "md" | "lg"; // p-3, p-4, p-6
  bordered?: boolean; // Mostra borda
  delay?: number; // Stagger delay for entrance animation
}

export function PremiumCard({
  children,
  className,
  hover = false,
  padding = "md",
  bordered = true,
  delay = 0,
}: PremiumCardProps) {
  const paddingClass = {
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  }[padding];

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        "bg-card text-card-foreground rounded-lg",
        bordered && "border border-border",
        "shadow-sm",
        hover &&
          "hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer",
        paddingClass,
        className,
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// Header variant for PremiumCard
export function PremiumCardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// Content variant for PremiumCard
export function PremiumCardContent({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

// Footer variant for PremiumCard
export function PremiumCardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 pt-4 border-t border-border flex items-center justify-end gap-2">
      {children}
    </div>
  );
}