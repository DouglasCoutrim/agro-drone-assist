import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useDentroDeBlocoPainel } from "@/components/layout/painel-bloco-context";

interface PremiumCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean; // Ativa hover effect
  padding?: "sm" | "md" | "lg"; // p-3, p-4, p-6
  bordered?: boolean; // Mostra borda
  delay?: number; // Stagger delay for entrance animation
  recolhivel?: boolean; // Mostra o botão de encolher/expandir (padrão: ligado)
  recolhidoInicial?: boolean; // Começa encolhido
  rotulo?: string; // Nome do card, exibido quando está encolhido
}

export function PremiumCard({
  children,
  className,
  hover = false,
  padding = "md",
  bordered = true,
  delay = 0,
  recolhivel = true,
  recolhidoInicial = false,
  rotulo,
}: PremiumCardProps) {
  const paddingClass = {
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  }[padding];

  const [visible, setVisible] = useState(false);
  const [aberto, setAberto] = useState(!recolhidoInicial);
  const conteudoId = useId();
  // Dentro de um bloco do painel é o bloco que encolhe: evita dois botões para a mesma coisa.
  const dentroDeBloco = useDentroDeBlocoPainel();
  const mostrarControle = recolhivel && !dentroDeBloco;

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
      {mostrarControle && (
        <div
          className={cn(
            "flex items-center gap-2",
            aberto ? "justify-end" : "justify-between",
            aberto && "mb-3"
          )}
        >
          {!aberto && (
            <span className="gradient-primary truncate rounded-full px-3 py-1 text-sm font-semibold shadow-soft">
              {rotulo || "Conteúdo"}
            </span>
          )}
          <button
            type="button"
            aria-expanded={aberto}
            aria-controls={conteudoId}
            title={aberto ? "Encolher" : "Expandir"}
            onClick={() => setAberto((atual) => !atual)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              aberto
                ? "rounded-md border-transparent px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                : "border-primary/60 bg-card px-2.5 py-1 text-xs text-primary hover:bg-primary/10"
            )}
          >
            <ChevronDown
              className={cn(
                "transition-transform",
                aberto ? "h-3.5 w-3.5" : "h-4 w-4",
                !aberto && "-rotate-90"
              )}
            />
            {aberto ? "Encolher" : "Expandir"}
          </button>
        </div>
      )}

      <div id={conteudoId} hidden={!aberto}>
        {children}
      </div>
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
