import * as React from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ItensAccordionProps<T extends { id: string }> {
  /** Itens exibidos na lista. */
  itens: T[];
  /** Conteúdo da linha quando o item está fechado (nome, quantidade, total, etc.). */
  renderResumo: (item: T, idx: number) => React.ReactNode;
  /** Campos de edição quando o item está aberto. Cada tela decide quais mostrar. */
  renderCampos: (item: T, idx: number) => React.ReactNode;
  /** Retorna true se o item ainda não foi preenchido. */
  isVazio: (item: T) => boolean;
  /** Chamado pelo botão "+ Adicionar". */
  onAdd: () => void;
  /** Chamado pelo botão "Remover item" e ao fechar um item vazio. */
  onRemove: (idx: number) => void;
  /** Texto da linha de total (padrão: "Total dos itens"). */
  totalLabel?: string;
  /** Valor exibido na linha de total, já formatado pela tela. */
  total: React.ReactNode;
}

/**
 * Lista de itens em accordion (single/colapsável): apenas um item aberto por vez.
 * Genérico em T para ser reutilizado em várias telas.
 */
export function ItensAccordion<T extends { id: string }>({
  itens,
  renderResumo,
  renderCampos,
  isVazio,
  onAdd,
  onRemove,
  totalLabel = "Total dos itens",
  total,
}: ItensAccordionProps<T>) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const prevLen = React.useRef(itens.length);

  // Ao crescer (após onAdd), abre automaticamente o último item.
  React.useEffect(() => {
    if (itens.length > prevLen.current) {
      setOpenId(itens[itens.length - 1]?.id ?? null);
    }
    prevLen.current = itens.length;
  }, [itens]);

  const handleOpenChange = (item: T, idx: number, nextOpen: boolean) => {
    if (nextOpen) {
      setOpenId(item.id);
      return;
    }
    setOpenId(null);
    // Fechou um item vazio: ele some da lista.
    if (isVazio(item)) onRemove(idx);
  };

  const handleRemove = (item: T, idx: number) => {
    if (openId === item.id) setOpenId(null);
    onRemove(idx);
  };

  if (itens.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
        Nenhum item adicionado
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="divide-y divide-border border-y border-border">
        {itens.map((item, idx) => {
          const open = openId === item.id;
          return (
            <Collapsible
              key={item.id}
              open={open}
              onOpenChange={(nextOpen) => handleOpenChange(item, idx, nextOpen)}
            >
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-[44px] w-full items-center gap-2 px-3 py-3 text-left text-sm hover:bg-muted/50"
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      open && "rotate-180",
                    )}
                  />
                  <div className="min-w-0 flex-1">{renderResumo(item, idx)}</div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 pt-1">
                  {renderCampos(item, idx)}
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-[44px] text-destructive hover:text-destructive"
                      onClick={() => handleRemove(item, idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover item
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <span className="text-sm font-bold">{totalLabel}</span>
        <span className="text-sm font-bold">{total}</span>
      </div>

      <div className="px-3 pb-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] w-full"
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>
    </div>
  );
}

export default ItensAccordion;
