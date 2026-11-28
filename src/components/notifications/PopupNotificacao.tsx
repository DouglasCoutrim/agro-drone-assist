import { Bell, CreditCard, LifeBuoy, ShoppingCart, Wrench, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PopupNotificacaoProps {
  tipo: string;
  titulo: string;
  corpo: string | null;
  aoAbrir: () => void;
  aoFechar: () => void;
}

const ICONES: Record<string, LucideIcon> = {
  os: Wrench,
  estoque: ShoppingCart,
  financeiro: CreditCard,
  suporte: LifeBuoy,
  plataforma: Bell,
};

/** Cartão de aviso que aparece na tela assim que uma notificação chega. */
export function PopupNotificacao({ tipo, titulo, corpo, aoAbrir, aoFechar }: PopupNotificacaoProps) {
  const Icone = ICONES[tipo] || Bell;

  return (
    <div className="pointer-events-auto w-full rounded-xl border border-border bg-card shadow-xl ring-1 ring-primary/20 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-start gap-3 p-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg gradient-primary text-primary-foreground">
          <Icone className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug break-words">{titulo}</p>
          {corpo && <p className="mt-0.5 text-xs text-muted-foreground break-words">{corpo}</p>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground"
          onClick={aoFechar}
          aria-label="Fechar aviso"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={aoFechar}>
          Fechar
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={aoAbrir}>
          Abrir
        </Button>
      </div>
    </div>
  );
}
