import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ItemCombobox } from "./ItemCombobox";
import { Plus, Trash2 } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type ItemEstoque = Tables<"itens_estoque">;

export interface CostLine {
  id: string;
  item_id: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
}

interface CostFieldArrayProps {
  label: string;
  lines: CostLine[];
  onChange: (lines: CostLine[]) => void;
  items?: ItemEstoque[];
  onItemsChange?: () => void;
}

const genId = () => Math.random().toString(36).slice(2, 9);

export function CostFieldArray({ label, lines, onChange, items, onItemsChange }: CostFieldArrayProps) {
  const addLine = () => {
    onChange([...lines, { id: genId(), item_id: "", descricao: "", quantidade: 1, valor_unitario: 0, subtotal: 0 }]);
  };

  const removeLine = (id: string) => {
    onChange(lines.filter(l => l.id !== id));
  };

  const updateLine = (id: string, field: Partial<CostLine>) => {
    onChange(lines.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, ...field };
      updated.subtotal = updated.quantidade * updated.valor_unitario;
      return updated;
    }));
  };

  const total = lines.reduce((sum, l) => sum + l.subtotal, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">{label}</Label>
        <Button type="button" variant="outline" size="sm" onClick={addLine} className="h-7 text-xs">
          <Plus className="mr-1 h-3 w-3" />Adicionar
        </Button>
      </div>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">Nenhum item adicionado</p>
      ) : (
        <div className="space-y-2">
          {lines.map((line) => (
            <div key={line.id} className="grid grid-cols-12 gap-2 items-end p-2 rounded-lg border bg-muted/30">
              <div className="col-span-5 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase">Item</span>
                <ItemCombobox
                  value={line.item_id}
                  items={items}
                  onItemsChange={onItemsChange}
                  onValueChange={(v) => updateLine(line.id, { item_id: v })}
                  onItemSelected={(item) => updateLine(line.id, {
                    item_id: item.id,
                    descricao: item.descricao,
                    valor_unitario: Number(item.preco_venda),
                    subtotal: line.quantidade * Number(item.preco_venda),
                  })}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase">Qtd</span>
                <Input type="number" min="1" className="h-9 text-sm" value={line.quantidade}
                  onChange={(e) => updateLine(line.id, { quantidade: Number(e.target.value) })} />
              </div>
              <div className="col-span-2 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase">Vlr Unit.</span>
                <Input type="number" step="0.01" className="h-9 text-sm" value={line.valor_unitario}
                  onChange={(e) => updateLine(line.id, { valor_unitario: Number(e.target.value) })} />
              </div>
              <div className="col-span-2 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase">Subtotal</span>
                <Input value={`R$ ${line.subtotal.toFixed(2)}`} readOnly disabled className="h-9 text-sm font-medium bg-muted" />
              </div>
              <div className="col-span-1 flex justify-center">
                <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => removeLine(line.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex justify-end pr-12">
            <div className="text-right">
              <span className="text-xs text-muted-foreground">TOTAL: </span>
              <span className="text-lg font-bold text-primary">R$ {total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
