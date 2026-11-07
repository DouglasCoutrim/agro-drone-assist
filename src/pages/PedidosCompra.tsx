import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, FileDown, Send, Trash2, ShoppingBag, Pencil, ClipboardList, Eye, Ban, X } from "lucide-react";
import { loadImageAsDataUrl } from "@/lib/pdf-padrao";
import { useConfirm } from "@/hooks/useConfirm";
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
  const [cotStatus, setCotStatus] = useState("aberta");
  const [cotForn, setCotForn] = useState("todos");
  const [cotDe, setCotDe] = useState("");
  const [cotAte, setCotAte] = useState("");
  const [cotAberta, setCotAberta] = useState<any>(null);
  const [cotFornEdit, setCotFornEdit] = useState(SEM);
  const [cotObs, setCotObs] = useState("");
  const [cotAdd, setCotAdd] = useState(SEM);
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

  const empresa = async () => (await supabase.from("empresa_config").select("nome_empresa, cnpj, telefone, endereco, logo_url").eq("organization_id", orgId!).maybeSingle()).data;

  const pdfCotacao = async (cot: any, linhas?: any[]) => {
    const e = await empresa();
    const its = linhas || solic.filter((s: any) => s.cotacao_id === cot.id);
    const f: any = fornecedores.find((x: any) => x.id === cot.fornecedor_id) || {};
    gerarCotacaoPDF({
      numero: cot.numero, data: new Date(cot.created_at).toLocaleDateString("pt-BR"),
      empresa: { nome: e?.nome_empresa || organization?.name || "", cnpj: e?.cnpj, telefone: e?.telefone, endereco: e?.endereco, logoDataUrl: await loadImageAsDataUrl(e?.logo_url) },
      observacoes: cot.observacoes,
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

  const confirm = useConfirm() as any;
  const perguntar = async (title: string, description: string) => {
    if (typeof confirm === "function") return await confirm({ title, description });
    if (confirm?.confirm) return await confirm.confirm({ title, description });
    return window.confirm(`${title}\n\n${description}`);
  };
  const itensCot = (c: any) => solic.filter((s: any) => s.cotacao_id === c?.id);
  const cotacoesFiltradas = cotacoes.filter((c: any) => {
    if (cotStatus !== "todas" && c.status !== cotStatus) return false;
    if (cotForn !== "todos" && (c.fornecedor_id || `nome:${c.fornecedor_nome}`) !== cotForn) return false;
    const d = String(c.created_at).slice(0, 10);
    if (cotDe && d < cotDe) return false;
    if (cotAte && d > cotAte) return false;
    return true;
  });
  const abrirCotacao = (c: any) => { setCotAberta(c); setCotFornEdit(c.fornecedor_id || SEM); setCotObs(c.observacoes || ""); setCotAdd(SEM); };
  const salvarCotacao = async () => {
    const f = fornecedores.find((x: any) => x.id === cotFornEdit);
    const upd = { fornecedor_id: f?.id || null, fornecedor_nome: f?.nome || (cotFornEdit === SEM ? cotAberta.fornecedor_nome : ""), observacoes: cotObs.trim() };
    const { error } = await supabase.from("cotacoes_compra").update(upd).eq("id", cotAberta.id);
    if (error) return toast.error(getErrorMessage(error));
    if (f) await supabase.from("solicitacoes_compra").update({ fornecedor_id: f.id, fornecedor_nome: f.nome }).eq("cotacao_id", cotAberta.id);
    toast.success("Cotação atualizada"); setCotAberta(null); refresh();
  };
  const tirarItemCotacao = async (id: string) => {
    const { error } = await supabase.from("solicitacoes_compra").update({ status: "pendente", cotacao_id: null }).eq("id", id);
    if (error) toast.error(getErrorMessage(error)); else { toast.success("Item voltou para Pendentes"); refresh(); }
  };
  const incluirItemCotacao = async () => {
    if (cotAdd === SEM) return;
    const { error } = await supabase.from("solicitacoes_compra").update({ status: "em_cotacao", cotacao_id: cotAberta.id }).eq("id", cotAdd);
    if (error) toast.error(getErrorMessage(error)); else { setCotAdd(SEM); refresh(); }
  };
  const cancelarCotacao = async (c: any) => {
    if (!(await perguntar(`Cancelar cotação nº ${c.numero}?`, "Os itens voltam para Pendentes para serem cotados novamente."))) return;
    await supabase.from("cotacoes_compra").update({ status: "cancelada" }).eq("id", c.id);
    await supabase.from("solicitacoes_compra").update({ status: "pendente", cotacao_id: null }).eq("cotacao_id", c.id).eq("status", "em_cotacao");
    toast.success("Cotação cancelada"); setCotAberta(null); refresh();
  };
  const excluirCotacao = async (c: any) => {
    if (!(await perguntar(`Excluir cotação nº ${c.numero}?`, "A cotação será apagada definitivamente. Itens ainda não comprados voltam para Pendentes."))) return;
    await supabase.from("solicitacoes_compra").update({ status: "pendente", cotacao_id: null }).eq("cotacao_id", c.id).eq("status", "em_cotacao");
    const { error } = await supabase.from("cotacoes_compra").delete().eq("id", c.id);
    if (error) return toast.error(getErrorMessage(error));
    toast.success("Cotação excluída"); setCotAberta(null); refresh();
  };
  const fornOpcoes = useMemo(() => { const m = new Map<string, string>(); cotacoes.forEach((c: any) => m.set(c.fornecedor_id || `nome:${c.fornecedor_nome}`, c.fornecedor_nome || "Sem fornecedor")); return [...m.entries()]; }, [cotacoes]);

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
            <Card><CardContent className="grid gap-2 p-3 sm:grid-cols-4">
              <div className="space-y-1"><Label className="text-xs">Situação</Label>
                <Select value={cotStatus} onValueChange={setCotStatus}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="aberta">Abertas</SelectItem><SelectItem value="comprada">Compradas</SelectItem><SelectItem value="cancelada">Canceladas</SelectItem><SelectItem value="todas">Todas</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Fornecedor</Label>
                <Select value={cotForn} onValueChange={setCotForn}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="todos">Todos</SelectItem>{fornOpcoes.map(([k, n]) => <SelectItem key={k} value={k}>{n}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" className="h-9" value={cotDe} onChange={(e) => setCotDe(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" className="h-9" value={cotAte} onChange={(e) => setCotAte(e.target.value)} /></div>
            </CardContent></Card>
            {!cotacoesFiltradas.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma cotação encontrada.</p>}
            {cotacoesFiltradas.map((c: any) => {
              const n = itensCot(c).length;
              return (
                <Card key={c.id} className="cursor-pointer hover:border-primary" onClick={() => abrirCotacao(c)}><CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                  <div className="flex-1"><p className="font-medium">Cotação nº {c.numero} — {c.fornecedor_nome || "Sem fornecedor"}</p><p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")} · {n} item(ns)</p></div>
                  <Badge variant={c.status === "cancelada" ? "destructive" : "outline"}>{c.status === "aberta" ? "Aberta" : c.status === "comprada" ? "Comprada" : "Cancelada"}</Badge>
                  <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" title="Ver / editar" onClick={() => abrirCotacao(c)}><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Baixar PDF" onClick={() => pdfCotacao(c)}><FileDown className="h-4 w-4" /></Button>
                    {isAdmin && c.status === "aberta" && <Button size="sm" onClick={() => mudarCotacao(c, "comprada")}>Marcar comprada</Button>}
                    {isAdmin && c.status === "aberta" && <Button size="icon" variant="ghost" title="Cancelar cotação" onClick={() => cancelarCotacao(c)}><Ban className="h-4 w-4" /></Button>}
                    {isAdmin && <Button size="icon" variant="ghost" title="Excluir cotação" onClick={() => excluirCotacao(c)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </CardContent></Card>
              );
            })}
          </TabsContent>
          <TabsContent value="historico" className="space-y-2">
            {historico.map((s: any) => <div key={s.id} className="flex justify-between rounded-md border p-3 text-sm"><span>{s.descricao} × {Number(s.quantidade)} — {fornNome(s) || "-"}</span><Badge variant="outline">{statusLabel[s.status]}</Badge></div>)}
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={!!cotAberta} onOpenChange={(o) => !o && setCotAberta(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Cotação nº {cotAberta?.numero}</DialogTitle></DialogHeader>
          {cotAberta && (() => {
            const editavel = isAdmin && cotAberta.status === "aberta";
            const its = itensCot(cotAberta);
            return (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground"><span>Criada em {new Date(cotAberta.created_at).toLocaleDateString("pt-BR")}</span>
                  <Badge variant="outline">{cotAberta.status === "aberta" ? "Aberta" : cotAberta.status === "comprada" ? "Comprada" : "Cancelada"}</Badge></div>
                <div className="space-y-1"><Label>Fornecedor</Label>
                  <Select value={cotFornEdit} onValueChange={setCotFornEdit} disabled={!editavel}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={SEM}>{cotAberta.fornecedor_nome || "Sem fornecedor"}{cotAberta.fornecedor_id ? "" : " (não cadastrado)"}</SelectItem>{fornecedores.filter((f: any) => f.id !== cotAberta.fornecedor_id).map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent></Select></div>
                <div className="rounded-md border">
                  {!its.length && <p className="py-4 text-center text-sm text-muted-foreground">Sem itens.</p>}
                  {its.map((s: any, i: number) => (
                    <div key={s.id} className="flex items-center gap-2 border-b p-2 text-sm last:border-b-0">
                      <span className="w-6 text-center text-xs text-muted-foreground">{i + 1}</span>
                      <span className="flex-1">{s.itens_estoque?.codigo && <span className="mr-1 font-mono text-xs text-muted-foreground">{s.itens_estoque.codigo}</span>}{s.descricao}</span>
                      <span className="text-muted-foreground">× {Number(s.quantidade)}</span>
                      {editavel && <Button size="icon" variant="ghost" className="h-8 w-8" title="Tirar da cotação" onClick={() => tirarItemCotacao(s.id)}><X className="h-4 w-4" /></Button>}
                    </div>
                  ))}
                </div>
                {editavel && (
                  <div className="flex gap-2">
                    <Select value={cotAdd} onValueChange={setCotAdd}><SelectTrigger className="flex-1"><SelectValue placeholder="Adicionar item pendente" /></SelectTrigger>
                      <SelectContent><SelectItem value={SEM}>Adicionar item pendente…</SelectItem>{solic.filter((s: any) => s.status === "pendente").map((s: any) => <SelectItem key={s.id} value={s.id}>{s.descricao} × {Number(s.quantidade)}</SelectItem>)}</SelectContent></Select>
                    <Button variant="outline" onClick={incluirItemCotacao} disabled={cotAdd === SEM}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
                  </div>
                )}
                <div className="space-y-1"><Label>Observações</Label><Input value={cotObs} disabled={!editavel} onChange={(e) => setCotObs(e.target.value)} placeholder="Ex.: entrega até sexta" /></div>
              </div>
            );
          })()}
          <DialogFooter className="flex-wrap gap-2">
            {cotAberta && <Button variant="outline" onClick={() => pdfCotacao(cotAberta)}><FileDown className="mr-1 h-4 w-4" />PDF</Button>}
            {isAdmin && cotAberta?.status === "aberta" && <Button variant="ghost" onClick={() => cancelarCotacao(cotAberta)}><Ban className="mr-1 h-4 w-4" />Cancelar cotação</Button>}
            {isAdmin && cotAberta && <Button variant="ghost" onClick={() => excluirCotacao(cotAberta)}><Trash2 className="mr-1 h-4 w-4" />Excluir</Button>}
            {isAdmin && cotAberta?.status === "aberta" && <Button onClick={salvarCotacao}>Salvar alterações</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PedidoCompraDialog open={open} onOpenChange={setOpen} pedido={editPedido} itensPedido={editPedido ? solic.filter((x: any) => x.pedido_id === editPedido.id) : []} estoque={itens} onSaved={refresh} />
    </MainLayout>
  );
}
