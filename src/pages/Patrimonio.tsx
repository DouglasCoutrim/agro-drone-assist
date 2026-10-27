import { FormEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Wrench, ArrowRightLeft, Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useConfirm";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, getErrorMessage } from "@/lib/formatters";
import { mesesDecorridos, valorDepreciado } from "@/lib/depreciacao";
import { toast } from "sonner";

const STATUS: Record<string, string> = {
  disponivel: "No almoxarifado", em_uso: "Com funcionário", manutencao: "Em manutenção",
  danificado: "Danificado", extraviado: "Extraviado", baixado: "Baixado",
};
const empty = { nome: "", categoria: "", marca_modelo: "", numero_serie: "", valor_referencia: "", data_aquisicao: new Date().toISOString().slice(0, 10), vida_util_meses: "36", valor_residual_pct: "10", observacao: "" };

export default function Patrimonio({ meu = false }: { meu?: boolean }) {
  const { organization } = useOrganization();
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin") && !meu;
  const confirm = useConfirm();
  const qc = useQueryClient();
  const { members } = useTeamMembers();
  const [filtro, setFiltro] = useState("todos");
  const [form, setForm] = useState<any>(null);
  const [entrega, setEntrega] = useState<any>(null);
  const [calc, setCalc] = useState<any>(null);

  const key = ["patrimonio", organization?.id, meu];
  const { data: itens = [], isLoading } = useQuery({
    queryKey: key, enabled: !!organization?.id && !!user,
    queryFn: async () => {
      let q = supabase.from("patrimonio_ferramentas").select("*").eq("organization_id", organization!.id).order("nome");
      if (meu) q = q.eq("tecnico_atual_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["patrimonio"] });
  const nomeDe = (id?: string | null) => members.find((m) => m.id === id)?.nome || "—";

  const enriched = itens.map((i) => {
    const meses = mesesDecorridos(i.data_aquisicao);
    return { ...i, meses, ...valorDepreciado(Number(i.valor_referencia || 0), i.vida_util_meses, Number(i.valor_residual_pct), meses) };
  }).filter((i) => filtro === "todos" || (filtro === "livre" ? !i.tecnico_atual_id : i.tecnico_atual_id === filtro));

  const totalCompra = enriched.reduce((s, i) => s + Number(i.valor_referencia || 0), 0);
  const totalAtual = enriched.reduce((s, i) => s + i.atual, 0);

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !Number(form.valor_referencia)) return toast.error("Informe nome e valor de compra.");
    const payload = {
      nome: form.nome.trim(), categoria: form.categoria || null, marca_modelo: form.marca_modelo || null,
      numero_serie: form.numero_serie || null, valor_referencia: Number(form.valor_referencia),
      data_aquisicao: form.data_aquisicao, vida_util_meses: Math.max(1, Number(form.vida_util_meses) || 1),
      valor_residual_pct: Number(form.valor_residual_pct) || 0, observacao: form.observacao || null,
    };
    const res = form.id
      ? await supabase.from("patrimonio_ferramentas").update(payload).eq("id", form.id)
      : await supabase.from("patrimonio_ferramentas").insert({ ...payload, organization_id: organization!.id, status: "disponivel" });
    if (res.error) return toast.error(getErrorMessage(res.error));
    toast.success("Ferramenta salva."); setForm(null); refresh();
  };

  const movimentar = async () => {
    const { item, tecnico, status } = entrega;
    const novo = tecnico === "none" ? null : tecnico;
    const novoStatus = novo ? "em_uso" : status || "disponivel";
    const { error } = await supabase.from("patrimonio_ferramentas").update({
      tecnico_atual_id: novo, status: novoStatus, data_entrega: novo ? new Date().toISOString().slice(0, 10) : null,
    }).eq("id", item.id);
    if (error) return toast.error(getErrorMessage(error));
    await supabase.from("patrimonio_movimentacoes").insert({
      patrimonio_id: item.id, tipo: novo ? "entrega" : novoStatus, tecnico_anterior_id: item.tecnico_atual_id, tecnico_novo_id: novo,
      confirmado_por: user!.id, observacao: entrega.obs || null,
    });
    toast.success("Responsável atualizado."); setEntrega(null); refresh();
  };

  const excluir = async (i: any) => {
    if (!(await confirm({ title: "Excluir ferramenta?", description: i.nome }))) return;
    const { error } = await supabase.from("patrimonio_ferramentas").delete().eq("id", i.id);
    if (error) return toast.error(getErrorMessage(error));
    refresh();
  };

  return (
    <MainLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Wrench className="h-6 w-6 text-primary" />{meu ? "Meu Estoque" : "Ferramentas e Equipamentos"}</h1>
            <p className="text-sm text-muted-foreground">{meu ? "Ferramentas sob sua responsabilidade, com valor atualizado." : "Patrimônio da empresa entregue aos funcionários."}</p>
          </div>
          {isAdmin && <Button onClick={() => setForm({ ...empty })}><Plus className="h-4 w-4 mr-1" />Nova ferramenta</Button>}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Itens</p><p className="text-xl font-bold">{enriched.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Valor de compra</p><p className="text-xl font-bold">{formatCurrency(totalCompra)}</p></CardContent></Card>
          <Card className="col-span-2 md:col-span-1"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Valor atual (com desvalorização)</p><p className="text-xl font-bold text-primary">{formatCurrency(totalAtual)}</p></CardContent></Card>
        </div>

        {isAdmin && (
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="w-full md:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os itens</SelectItem>
              <SelectItem value="livre">No almoxarifado</SelectItem>
              {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {isLoading ? <p className="text-muted-foreground">Carregando…</p> : enriched.length === 0 ? (
          <p className="text-muted-foreground text-center py-10">Nenhuma ferramenta {meu ? "sob sua responsabilidade" : "cadastrada"}.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {enriched.map((i) => (
              <Card key={i.id}><CardContent className="p-4 space-y-2">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{i.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{[i.marca_modelo, i.numero_serie && `S/N ${i.numero_serie}`].filter(Boolean).join(" · ") || i.categoria || "—"}</p>
                  </div>
                  <Badge variant={i.status === "em_uso" ? "default" : "secondary"}>{STATUS[i.status] || i.status}</Badge>
                </div>
                {!meu && <p className="text-sm">Responsável: <b>{nomeDe(i.tecnico_atual_id)}</b></p>}
                {i.data_entrega && <p className="text-xs text-muted-foreground">Entregue em {new Date(i.data_entrega + "T00:00:00").toLocaleDateString("pt-BR")}</p>}
                <div className="grid grid-cols-2 text-sm gap-1">
                  <span className="text-muted-foreground">Compra</span><span className="text-right">{formatCurrency(Number(i.valor_referencia || 0))}</span>
                  <span className="text-muted-foreground">Uso</span><span className="text-right">{i.meses} de {i.vida_util_meses} meses</span>
                  <span className="text-muted-foreground">Valor atual</span><span className="text-right font-semibold text-primary">{formatCurrency(i.atual)}</span>
                </div>
                <div className="flex gap-1 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setCalc(i)} aria-label="Calcular ressarcimento"><Calculator className="h-4 w-4" /></Button>
                  {isAdmin && <>
                    <Button size="sm" variant="outline" onClick={() => setEntrega({ item: i, tecnico: i.tecnico_atual_id || "none", status: "disponivel" })} aria-label="Entregar ou devolver"><ArrowRightLeft className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setForm({ ...i, valor_referencia: String(i.valor_referencia ?? ""), vida_util_meses: String(i.vida_util_meses), valor_residual_pct: String(i.valor_residual_pct) })} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => excluir(i)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  </>}
                </div>
              </CardContent></Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Editar ferramenta" : "Nova ferramenta"}</DialogTitle></DialogHeader>
          {form && <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
            {([["nome", "Nome *"], ["categoria", "Categoria"], ["marca_modelo", "Marca / modelo"], ["numero_serie", "Número de série"]] as const).map(([k, l]) => (
              <div key={k}><Label>{l}</Label><Input value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
            ))}
            <div><Label>Valor de compra (R$) *</Label><Input type="number" step="0.01" value={form.valor_referencia} onChange={(e) => setForm({ ...form, valor_referencia: e.target.value })} /></div>
            <div><Label>Data de compra</Label><Input type="date" value={form.data_aquisicao} onChange={(e) => setForm({ ...form, data_aquisicao: e.target.value })} /></div>
            <div><Label>Vida útil (meses)</Label><Input type="number" min={1} value={form.vida_util_meses} onChange={(e) => setForm({ ...form, vida_util_meses: e.target.value })} /></div>
            <div><Label>Valor mínimo (% da compra)</Label><Input type="number" min={0} max={100} value={form.valor_residual_pct} onChange={(e) => setForm({ ...form, valor_residual_pct: e.target.value })} /></div>
            <DialogFooter className="sm:col-span-2"><Button type="submit">Salvar</Button></DialogFooter>
          </form>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!entrega} onOpenChange={(o) => !o && setEntrega(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Responsável por {entrega?.item.nome}</DialogTitle></DialogHeader>
          {entrega && <div className="space-y-3">
            <Label>Funcionário</Label>
            <Select value={entrega.tecnico} onValueChange={(v) => setEntrega({ ...entrega, tecnico: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguém (devolver)</SelectItem>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {entrega.tecnico === "none" && <>
              <Label>Situação na devolução</Label>
              <Select value={entrega.status} onValueChange={(v) => setEntrega({ ...entrega, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["disponivel", "manutencao", "danificado", "extraviado", "baixado"].map((s) => <SelectItem key={s} value={s}>{STATUS[s]}</SelectItem>)}</SelectContent>
              </Select>
            </>}
            <Label>Observação</Label>
            <Input value={entrega.obs || ""} onChange={(e) => setEntrega({ ...entrega, obs: e.target.value })} />
            <DialogFooter><Button onClick={movimentar}>Confirmar</Button></DialogFooter>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!calc} onOpenChange={(o) => !o && setCalc(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Valor para ressarcimento</DialogTitle></DialogHeader>
          {calc && <div className="grid grid-cols-2 gap-2 text-sm">
            <span>Valor de compra</span><span className="text-right">{formatCurrency(Number(calc.valor_referencia || 0))}</span>
            <span>Desvalorização por mês</span><span className="text-right">{formatCurrency(calc.mensal)}</span>
            <span>Meses de uso</span><span className="text-right">{calc.meses}</span>
            <span>Desvalorização acumulada</span><span className="text-right">− {formatCurrency(calc.depreciado)}</span>
            <span className="font-bold">Valor a ressarcir hoje</span><span className="text-right font-bold text-primary">{formatCurrency(calc.atual)}</span>
          </div>}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
