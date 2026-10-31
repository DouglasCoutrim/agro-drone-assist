import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, FileDown, Send, Trash2, ShoppingBag, Pencil, ClipboardList } from "lucide-react";
import { PedidoCompraDialog, SETORES, setorLabel } from "@/components/compras/PedidoCompraDialog";
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
  const [editPedido, setEditPedido] = useState<any>(null);
  const [setorFiltro, setSetorFiltro] = useState("todos");
  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos_compra", orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from("pedidos_compra").select("*").eq("organization_id", orgId!).order("created_at", { ascending: false })).data || [],
  });

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
  const refresh = () => { qc.invalidateQueries({ queryKey: ["pedidos_compra"] }); qc.invalidateQueries({ queryKey: ["solicitacoes_compra"] }); qc.invalidateQueries({ queryKey: ["cotacoes_compra"] }); };

  const pendentes = solic.filter((s: any) => s.status === "pendente" && (setorFiltro === "todos" || (s.setor || "estoque") === setorFiltro));
  const pedNum = (s: any) => pedidos.find((p: any) => p.id === s.pedido_id)?.numero;
  const fornNome = (s: any) => fornecedores.find((f: any) => f.id === s.fornecedor_id)?.nome || s.fornecedor_nome || "";

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
          <div><h1 className="text-2xl font-bold">Pedidos de Compra</h1><p className="text-sm text-muted-foreground">Pedidos por setor: estoque, ferramentas, limpeza, mantimentos, uniformes e mais</p></div>
          <Button onClick={() => { setEditPedido(null); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />Novo pedido</Button>
        </div>
        <Tabs defaultValue="pedidos">
          <TabsList className="flex-wrap h-auto"><TabsTrigger value="pedidos">Pedidos ({pedidos.length})</TabsTrigger><TabsTrigger value="pendentes">Pendentes ({pendentes.length})</TabsTrigger><TabsTrigger value="cotacoes">Cotações ({cotacoes.length})</TabsTrigger><TabsTrigger value="historico">Histórico</TabsTrigger></TabsList>
          <TabsContent value="pedidos" className="space-y-2">
            {!pedidos.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum pedido criado.</p>}
            {pedidos.map((p: any) => {
              const its = solic.filter((s: any) => s.pedido_id === p.id);
              const pend = its.filter((s: any) => s.status === "pendente").length;
              const pode = isAdmin || p.solicitado_por === user?.id;
              return (
                <Card key={p.id} className={pode ? "cursor-pointer hover:border-primary" : ""} onClick={() => { if (pode) { setEditPedido(p); setOpen(true); } }}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    <div className="min-w-[180px] flex-1">
                      <p className="font-medium">Pedido nº {p.numero}{p.titulo ? ` — ${p.titulo}` : ""}</p>
                      <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")} · {its.length} item(ns){pend !== its.length ? ` · ${pend} pendente(s)` : ""}</p>
                    </div>
                    <Badge variant="secondary">{setorLabel(p.setor)}</Badge>
                    {pode && <Button size="icon" variant="ghost" title="Editar pedido"><Pencil className="h-4 w-4" /></Button>}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
          <TabsContent value="pendentes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <div className="flex flex-wrap items-center gap-2"><CardTitle className="text-base">Itens aguardando cotação</CardTitle>
                  <Select value={setorFiltro} onValueChange={setSetorFiltro}><SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="todos">Todos os setores</SelectItem>{SETORES.map(x => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent></Select></div>
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
                        <Badge variant="outline">{setorLabel(s.setor)}</Badge>
                        {pedNum(s) && <Badge variant="outline">Pedido nº {pedNum(s)}</Badge>}
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
      <PedidoCompraDialog open={open} onOpenChange={setOpen} pedido={editPedido} itensPedido={editPedido ? solic.filter((x: any) => x.pedido_id === editPedido.id) : []} estoque={itens} onSaved={refresh} />
    </MainLayout>
  );
}
