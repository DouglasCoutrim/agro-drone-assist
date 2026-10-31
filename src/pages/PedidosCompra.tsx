import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, FileDown, Send, Trash2, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getErrorMessage } from "@/lib/formatters";
import { gerarCotacaoPDF } from "@/lib/cotacao-pdf";
import { toast } from "sonner";

const SEM = "__sem__";
const statusLabel: Record<string, string> = { pendente: "Pendente", em_cotacao: "Em cotação", comprado: "Comprado", cancelado: "Cancelado" };

export default function PedidosCompra() {
  const { organization } = useOrganization();
  const { user, roles } = useAuth() as any;
  const isAdmin = (roles || []).includes("admin");
  const orgId = organization?.id;
  const qc = useQueryClient();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ item_estoque_id: "", descricao: "", quantidade: 1, fornecedor_id: SEM, observacoes: "" });

  const { data: solic = [] } = useQuery({
    queryKey: ["solicitacoes_compra", orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from("solicitacoes_compra").select("*, itens_estoque(codigo, quantidade, estoque_minimo)").eq("organization_id", orgId!).order("created_at", { ascending: false })).data || [],
  });
  const { data: cotacoes = [] } = useQuery({
    queryKey: ["cotacoes_compra", orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from("cotacoes_compra").select("*").eq("organization_id", orgId!).order("created_at", { ascending: false })).data || [],
  });
  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-lista", orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from("fornecedores").select("id, nome, cpf_cnpj, telefone, email").eq("organization_id", orgId!).order("nome")).data || [],
  });
  const { data: itens = [] } = useQuery({
    queryKey: ["itens-estoque-compra", orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from("itens_estoque").select("id, codigo, descricao, fornecedor").eq("organization_id", orgId!).order("descricao")).data || [],
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["solicitacoes_compra"] }); qc.invalidateQueries({ queryKey: ["cotacoes_compra"] }); };

  const pendentes = solic.filter((s: any) => s.status === "pendente");
  const fornNome = (s: any) => fornecedores.find((f: any) => f.id === s.fornecedor_id)?.nome || s.fornecedor_nome || "";

  const salvar = async () => {
    const item = itens.find((i: any) => i.id === form.item_estoque_id);
    const descricao = item?.descricao || form.descricao.trim();
    if (!descricao) return toast.error("Escolha um item do estoque ou descreva o item.");
    const forn = fornecedores.find((f: any) => f.id === form.fornecedor_id);
    const { error } = await supabase.from("solicitacoes_compra").insert({
      organization_id: orgId!, item_estoque_id: item?.id || null, descricao, quantidade: form.quantidade || 1,
      fornecedor_id: forn?.id || null, fornecedor_nome: forn?.nome || item?.fornecedor || "", observacoes: form.observacoes,
      origem: "tecnico", solicitado_por: user?.id,
    });
    if (error) return toast.error(getErrorMessage(error));
    toast.success("Solicitação enviada para compras");
    setOpen(false); setForm({ item_estoque_id: "", descricao: "", quantidade: 1, fornecedor_id: SEM, observacoes: "" }); refresh();
  };

  const definirFornecedor = async (id: string, fid: string) => {
    const f = fornecedores.find((x: any) => x.id === fid);
    const { error } = await supabase.from("solicitacoes_compra").update({ fornecedor_id: f?.id || null, fornecedor_nome: f?.nome || "" }).eq("id", id);
    if (error) toast.error(getErrorMessage(error)); else refresh();
  };
  const excluir = async (id: string) => {
    const { error } = await supabase.from("solicitacoes_compra").delete().eq("id", id);
    if (error) toast.error(getErrorMessage(error)); else refresh();
  };

  const empresa = async () => (await supabase.from("empresa_config").select("nome_empresa, cnpj, telefone, endereco").eq("organization_id", orgId!).maybeSingle()).data;

  const pdfCotacao = async (cot: any, linhas?: any[]) => {
    const e = await empresa();
    const its = linhas || solic.filter((s: any) => s.cotacao_id === cot.id);
    const f: any = fornecedores.find((x: any) => x.id === cot.fornecedor_id) || {};
    gerarCotacaoPDF({
      numero: cot.numero, data: new Date(cot.created_at).toLocaleDateString("pt-BR"),
      empresa: { nome: e?.nome_empresa || organization?.name || "", cnpj: e?.cnpj, telefone: e?.telefone, endereco: e?.endereco },
      fornecedor: { nome: cot.fornecedor_nome || "Fornecedor não definido", cnpj: f.cpf_cnpj, telefone: f.telefone, email: f.email },
      itens: its.map((s: any) => ({ codigo: s.itens_estoque?.codigo, descricao: s.descricao, quantidade: Number(s.quantidade) })),
    });
  };

  const gerarCotacoes = async () => {
    const escolhidos = pendentes.filter((s: any) => sel.has(s.id));
    if (!escolhidos.length) return toast.error("Selecione os itens que vão para cotação.");
    const grupos = new Map<string, any[]>();
    escolhidos.forEach((s: any) => { const k = s.fornecedor_id || `nome:${fornNome(s)}`; grupos.set(k, [...(grupos.get(k) || []), s]); });
    for (const lista of grupos.values()) {
      const s0 = lista[0];
      const { data: cot, error } = await supabase.from("cotacoes_compra").insert({ organization_id: orgId!, fornecedor_id: s0.fornecedor_id, fornecedor_nome: fornNome(s0), created_by: user?.id }).select().single();
      if (error || !cot) return toast.error(getErrorMessage(error));
      const { error: e2 } = await supabase.from("solicitacoes_compra").update({ status: "em_cotacao", cotacao_id: cot.id }).in("id", lista.map((s: any) => s.id));
      if (e2) return toast.error(getErrorMessage(e2));
      await pdfCotacao(cot, lista);
    }
    toast.success(`${grupos.size} cotação(ões) gerada(s), uma por fornecedor`);
    setSel(new Set()); refresh();
  };

  const mudarCotacao = async (cot: any, status: string) => {
    await supabase.from("cotacoes_compra").update({ status }).eq("id", cot.id);
    await supabase.from("solicitacoes_compra").update({ status: status === "comprada" ? "comprado" : "cancelado" }).eq("cotacao_id", cot.id);
    refresh();
  };

  const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const historico = useMemo(() => solic.filter((s: any) => s.status !== "pendente"), [solic]);

  return (
    <MainLayout>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h1 className="text-2xl font-bold">Pedidos de Compra</h1><p className="text-sm text-muted-foreground">Solicitações dos técnicos e itens com estoque baixo</p></div>
          <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Solicitar item</Button>
        </div>
        <Tabs defaultValue="pendentes">
          <TabsList><TabsTrigger value="pendentes">Pendentes ({pendentes.length})</TabsTrigger><TabsTrigger value="cotacoes">Cotações ({cotacoes.length})</TabsTrigger><TabsTrigger value="historico">Histórico</TabsTrigger></TabsList>
          <TabsContent value="pendentes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">Itens aguardando cotação</CardTitle>
                {isAdmin && <Button size="sm" onClick={gerarCotacoes} disabled={!sel.size}><Send className="mr-1 h-4 w-4" />Enviar {sel.size || ""} para cotação</Button>}
              </CardHeader>
              <CardContent className="space-y-2">
                {!pendentes.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>}
                {pendentes.map((s: any) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                    {isAdmin && <Checkbox checked={sel.has(s.id)} onCheckedChange={() => toggle(s.id)} aria-label="Selecionar" />}
                    <div className="min-w-[180px] flex-1">
                      <p className="font-medium">{s.descricao} <span className="text-muted-foreground">× {Number(s.quantidade)}</span></p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        <Badge variant={s.origem === "estoque_baixo" ? "destructive" : "secondary"}>{s.origem === "estoque_baixo" ? "Estoque baixo" : "Solicitação técnico"}</Badge>
                        {s.itens_estoque && <Badge variant="outline">Saldo {s.itens_estoque.quantidade} / mín {s.itens_estoque.estoque_minimo}</Badge>}
                      </div>
                    </div>
                    {isAdmin ? (
                      <Select value={s.fornecedor_id || SEM} onValueChange={v => definirFornecedor(s.id, v)}>
                        <SelectTrigger className="w-56"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
                        <SelectContent><SelectItem value={SEM}>{s.fornecedor_nome ? `${s.fornecedor_nome} (não cadastrado)` : "Sem fornecedor"}</SelectItem>{fornecedores.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <span className="text-sm text-muted-foreground">{fornNome(s) || "Sem fornecedor"}</span>}
                    {(isAdmin || s.solicitado_por === user?.id) && <Button variant="ghost" size="icon" title="Excluir solicitação" onClick={() => excluir(s.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="cotacoes" className="space-y-2">
            {!cotacoes.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma cotação gerada.</p>}
            {cotacoes.map((c: any) => {
              const n = solic.filter((s: any) => s.cotacao_id === c.id).length;
              return (
                <Card key={c.id}><CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                  <div className="flex-1"><p className="font-medium">Cotação nº {c.numero} — {c.fornecedor_nome || "Sem fornecedor"}</p><p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")} · {n} item(ns)</p></div>
                  <Badge variant="outline">{c.status === "aberta" ? "Aberta" : c.status === "comprada" ? "Comprada" : "Cancelada"}</Badge>
                  <Button size="sm" variant="outline" onClick={() => pdfCotacao(c)}><FileDown className="mr-1 h-4 w-4" />PDF</Button>
                  {isAdmin && c.status === "aberta" && <><Button size="sm" onClick={() => mudarCotacao(c, "comprada")}>Marcar comprada</Button><Button size="sm" variant="ghost" onClick={() => mudarCotacao(c, "cancelada")}>Cancelar</Button></>}
                </CardContent></Card>
              );
            })}
          </TabsContent>
          <TabsContent value="historico" className="space-y-2">
            {historico.map((s: any) => <div key={s.id} className="flex justify-between rounded-md border p-3 text-sm"><span>{s.descricao} × {Number(s.quantidade)} — {fornNome(s) || "-"}</span><Badge variant="outline">{statusLabel[s.status]}</Badge></div>)}
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Solicitar item para compra</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Item do estoque</Label>
              <Select value={form.item_estoque_id || SEM} onValueChange={v => setForm(f => ({ ...f, item_estoque_id: v === SEM ? "" : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={SEM}>Item novo (não cadastrado)</SelectItem>{itens.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.codigo} — {i.descricao}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {!form.item_estoque_id && <div className="space-y-1"><Label>Descrição do item</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex.: Hélice 30 pol. DJI T40" /></div>}
            <div className="space-y-1"><Label>Quantidade</Label><Input type="number" min={1} value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: Number(e.target.value) }))} /></div>
            <div className="space-y-1"><Label>Fornecedor sugerido (opcional)</Label>
              <Select value={form.fornecedor_id} onValueChange={v => setForm(f => ({ ...f, fornecedor_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={SEM}>Não sei</SelectItem>{fornecedores.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Observação</Label><Input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Ex.: urgente, OS 045" /></div>
          </div>
          <DialogFooter><Button onClick={salvar}>Enviar solicitação</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
