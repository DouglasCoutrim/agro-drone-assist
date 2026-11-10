import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { functionErrorMessage } from "@/lib/function-error";

type Item = { id: string; descricao: string; quantidade: number; quantidade_devolvida: number; valor_unitario: number };

export function DevolucaoCompraDialog({ notaCompraId, onOpenChange }: { notaCompraId: string | null; onOpenChange: (o: boolean) => void }) {
  const [itens, setItens] = useState<Item[]>([]);
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!notaCompraId) return;
    setQtd({}); setMotivo("");
    (supabase as any).from("notas_compra_itens").select("id,descricao,quantidade,quantidade_devolvida,valor_unitario")
      .eq("nota_compra_id", notaCompraId).then(({ data }: any) => setItens(data || []));
  }, [notaCompraId]);

  const emitir = async () => {
    const sel = Object.entries(qtd).filter(([, q]) => q > 0).map(([nota_compra_item_id, quantidade]) => ({ nota_compra_item_id, quantidade }));
    if (!sel.length) return toast.error("Informe a quantidade de pelo menos um item.");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("emitir-devolucao-compra", { body: { action: "emitir", nota_compra_id: notaCompraId, itens: sel, motivo: motivo || undefined } });
    setBusy(false);
    if (error || data?.error) {
      const msg = data?.problemas?.join(" ") || data?.error || await functionErrorMessage(error, "Não foi possível emitir a devolução.");
      return toast.error(msg);
    }
    toast.success("Devolução enviada à SEFAZ. O estoque sai quando a nota for autorizada.");
    onOpenChange(false);
  };

  return (
    <Dialog open={!!notaCompraId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Devolver ao fornecedor</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {itens.map((i) => {
            const saldo = Number(i.quantidade) - Number(i.quantidade_devolvida || 0);
            return (
              <div key={i.id} className="flex items-center gap-2 border rounded-md p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{i.descricao}</p>
                  <p className="text-xs text-muted-foreground">Disponível para devolver: {saldo}</p>
                </div>
                <Input type="number" min={0} max={saldo} step="1" className="w-24" disabled={saldo <= 0}
                  value={qtd[i.id] ?? ""} onChange={(e) => setQtd((q) => ({ ...q, [i.id]: Math.min(saldo, Math.max(0, Number(e.target.value) || 0)) }))} />
              </div>);
          })}
          <Input placeholder="Motivo (opcional)" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={emitir} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Emitir devolução</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
