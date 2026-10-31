import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage } from "@/lib/formatters";
import { toast } from "sonner";

export const SETORES = [
  { value: "estoque", label: "Estoque (peças e produtos)" },
  { value: "ferramentas", label: "Ferramentas e equipamentos" },
  { value: "limpeza", label: "Limpeza e higiene" },
  { value: "mantimentos", label: "Mantimentos / copa" },
  { value: "uniformes", label: "Uniformes e EPI" },
  { value: "escritorio", label: "Escritório" },
  { value: "outros", label: "Outros" },
];
export const setorLabel = (v?: string | null) => SETORES.find((s) => s.value === (v || "estoque"))?.label.split(" (")[0] || "Outros";

type Linha = { key: string; id?: string; item_estoque_id: string | null; descricao: string; quantidade: number; status?: string; codigo?: string };

export function PedidoCompraDialog({ open, onOpenChange, pedido, itensPedido, estoque, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; pedido: any | null; itensPedido: any[]; estoque: any[]; onSaved: () => void;
}) {
  const { organization } = useOrganization();
  const { user } = useAuth() as any;
  const [setor, setSetor] = useState("estoque");
  const [titulo, setTitulo] = useState("");
  const [obs, setObs] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [busca, setBusca] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSetor(pedido?.setor || "estoque"); setTitulo(pedido?.titulo || ""); setObs(pedido?.observacoes || ""); setBusca("");
    setLinhas(itensPedido.map((s) => ({ key: s.id, id: s.id, item_estoque_id: s.item_estoque_id, descricao: s.descricao, quantidade: Number(s.quantidade), status: s.status, codigo: s.itens_estoque?.codigo })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pedido?.id]);

  const sugestoes = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (t.length < 2) return [];
    return estoque.filter((i) => `${i.codigo} ${i.descricao}`.toLowerCase().includes(t)).slice(0, 8);
  }, [busca, estoque]);

  const add = (l: Omit<Linha, "key">) => {
    setLinhas((p) => {
      const ex = l.item_estoque_id && p.find((x) => x.item_estoque_id === l.item_estoque_id && x.status !== "em_cotacao");
      if (ex) return p.map((x) => (x === ex ? { ...x, quantidade: x.quantidade + 1 } : x));
      return [...p, { ...l, key: crypto.randomUUID() }];
    });
    setBusca("");
  };
  const editavel = (l: Linha) => !l.status || l.status === "pendente";

  const salvar = async () => {
    const validas = linhas.filter((l) => l.descricao.trim() && l.quantidade > 0);
    if (!validas.length) return toast.error("Adicione pelo menos um item ao pedido.");
    setSaving(true);
    try {
      let pid = pedido?.id;
      const head = { setor, titulo: titulo.trim(), observacoes: obs.trim(), updated_at: new Date().toISOString() };
      if (pid) {
        const { error } = await supabase.from("pedidos_compra").update(head).eq("id", pid);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("pedidos_compra").insert({ ...head, organization_id: organization!.id, solicitado_por: user?.id }).select("id").single();
        if (error) throw error;
        pid = data.id;
      }
      const atuais = new Set(validas.filter((l) => l.id).map((l) => l.id));
      const removidos = itensPedido.filter((s) => s.status === "pendente" && !atuais.has(s.id)).map((s) => s.id);
      if (removidos.length) {
        const { error } = await supabase.from("solicitacoes_compra").delete().in("id", removidos);
        if (error) throw error;
      }
      for (const l of validas.filter((x) => x.id && editavel(x))) {
        const { error } = await supabase.from("solicitacoes_compra").update({ descricao: l.descricao.trim(), quantidade: l.quantidade, setor }).eq("id", l.id!);
        if (error) throw error;
      }
      const novos = validas.filter((l) => !l.id).map((l) => {
        const it = estoque.find((i) => i.id === l.item_estoque_id);
        return { organization_id: organization!.id, pedido_id: pid, setor, item_estoque_id: l.item_estoque_id, descricao: l.descricao.trim(), quantidade: l.quantidade, fornecedor_nome: it?.fornecedor || "", observacoes: obs.trim(), origem: "tecnico", solicitado_por: user?.id };
      });
      if (novos.length) {
        const { error } = await supabase.from("solicitacoes_compra").insert(novos);
        if (error) throw error;
      }
      toast.success(pedido ? "Pedido atualizado" : "Pedido enviado para compras");
      onSaved(); onOpenChange(false);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const excluirPedido = async () => {
    if (!pedido || itensPedido.some((s) => s.status !== "pendente")) return toast.error("Só é possível excluir pedidos sem itens em cotação.");
    const { error } = await supabase.from("pedidos_compra").delete().eq("id", pedido.id);
    if (error) return toast.error(getErrorMessage(error));
    toast.success("Pedido excluído"); onSaved(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pedido ? `Pedido nº ${pedido.numero}` : "Novo pedido de compra"}</DialogTitle>
          <DialogDescription>Adicione ou remova itens à vontade. Itens já em cotação ficam travados.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Setor</Label>
              <Select value={setor} onValueChange={setSetor}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SETORES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1"><Label>Título (opcional)</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Reposição mensal da copa" /></div>
          </div>

          <div className="space-y-1">
            <Label>Adicionar item</Label>
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={setor === "estoque" ? "Buscar no estoque ou digitar item novo" : "Digite o item, ex.: detergente 5L"}
                    onKeyDown={(e) => { if (e.key === "Enter" && busca.trim()) { e.preventDefault(); add({ item_estoque_id: null, descricao: busca.trim(), quantidade: 1 }); } }} />
                </div>
                <Button type="button" variant="outline" disabled={!busca.trim()} onClick={() => add({ item_estoque_id: null, descricao: busca.trim(), quantidade: 1 })}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
              </div>
              {sugestoes.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                  {sugestoes.map((i) => (
                    <button key={i.id} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => add({ item_estoque_id: i.id, descricao: i.descricao, quantidade: 1, codigo: i.codigo })}>
                      <span className="font-mono text-xs text-muted-foreground">{i.codigo}</span><span className="flex-1">{i.descricao}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-md border">
            {!linhas.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum item no pedido.</p>}
            {linhas.map((l, idx) => (
              <div key={l.key} className="flex flex-wrap items-center gap-2 border-b p-2 last:border-b-0">
                <span className="w-6 text-center text-xs text-muted-foreground">{idx + 1}</span>
                <div className="min-w-[160px] flex-1">
                  {l.item_estoque_id || !editavel(l) ? <p className="text-sm font-medium">{l.codigo && <span className="mr-1 font-mono text-xs text-muted-foreground">{l.codigo}</span>}{l.descricao}</p>
                    : <Input className="h-8" value={l.descricao} onChange={(e) => setLinhas((p) => p.map((x) => x.key === l.key ? { ...x, descricao: e.target.value } : x))} />}
                  {!editavel(l) && <Badge variant="outline" className="mt-1">Em cotação</Badge>}
                </div>
                <Input type="number" min={1} className="h-8 w-20" disabled={!editavel(l)} value={l.quantidade}
                  onChange={(e) => setLinhas((p) => p.map((x) => x.key === l.key ? { ...x, quantidade: Number(e.target.value) } : x))} aria-label="Quantidade" />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={!editavel(l)} title="Remover item"
                  onClick={() => setLinhas((p) => p.filter((x) => x.key !== l.key))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>

          <div className="space-y-1"><Label>Observação</Label><Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: urgente, OS 045" /></div>
        </div>
        <DialogFooter className="gap-2">
          {pedido && <Button variant="ghost" onClick={excluirPedido}><Trash2 className="mr-1 h-4 w-4" />Excluir pedido</Button>}
          <Button onClick={salvar} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{pedido ? "Salvar pedido" : "Enviar pedido"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
