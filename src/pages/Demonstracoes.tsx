import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import { Plus, FileDown, CheckCircle2, Undo2, Banknote, Search, Loader2, Package, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
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
import { toast } from "sonner";

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  em_posse: { label: "Com o funcionário", variant: "default" },
  vendido: { label: "Vendido", variant: "secondary" },
  devolvido: { label: "Devolvido", variant: "outline" },
  cobrado: { label: "Cobrado do funcionário", variant: "destructive" },
  quitado: { label: "Cobrança quitada", variant: "secondary" },
};
const fmtData = (d: string) => new Date(d).toLocaleDateString("pt-BR");

type ItemRetirada = { id: string; codigo: string; descricao: string; estoque: number; preco_venda: number; qtd: number };

export default function Demonstracoes() {
  const { organization } = useOrganization();
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const { members } = useTeamMembers();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState("ativos");
  const [novo, setNovo] = useState<{ obs: string; busca: string; func: string } | null>(null);
  const [itens, setItens] = useState<ItemRetirada[]>([]);
  const [resultados, setResultados] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const key = ["demonstracoes", organization?.id];

  useEffect(() => {
    if (organization?.id) supabase.rpc("processar_demonstracoes_vencidas").then(({ data }) => { if (data) qc.invalidateQueries({ queryKey: key }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  const { data: lista = [], isLoading } = useQuery({
    queryKey: key, enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("saidas_demonstracao").select("*").eq("organization_id", organization!.id).order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
  });

  const termo = novo?.busca ?? "";
  useEffect(() => {
    if (!termo.trim() || !organization?.id) { setResultados([]); return; }
    const t = setTimeout(async () => {
      setBuscando(true);
      const like = `%${termo.trim().replace(/[,()%]/g, " ")}%`;
      const { data } = await supabase.from("itens_estoque").select("id,codigo,descricao,quantidade,preco_venda")
        .eq("organization_id", organization.id).gt("quantidade", 0).or(`descricao.ilike.${like},codigo.ilike.${like}`).order("descricao").limit(20);
      setResultados(data ?? []); setBuscando(false);
    }, 250);
    return () => clearTimeout(t);
  }, [termo, organization?.id]);

  const nome = (id: string) => members?.find((m) => m.id === id)?.nome ?? (id === user?.id ? "Você" : "Funcionário");
  const filtrados = useMemo(() => lista.filter((s: any) =>
    filtro === "todos" ? true : filtro === "ativos" ? s.status === "em_posse" : filtro === "cobrados" ? ["cobrado", "quitado"].includes(s.status) : ["vendido", "devolvido"].includes(s.status)), [lista, filtro]);
  const emPosse = lista.filter((s: any) => s.status === "em_posse");
  const cobrado = lista.filter((s: any) => s.status === "cobrado").reduce((t: number, s: any) => t + Number(s.valor_cobrado || 0), 0);
  const totalRetirada = itens.reduce((t, i) => t + i.qtd * i.preco_venda, 0);

  function notaPDF(s: any) {
    const doc = new jsPDF();
    let y = 18;
    doc.setFont("helvetica", "bold").setFontSize(14).text(organization?.name || "Empresa", 14, y);
    doc.setFontSize(12).text(`NOTA INTERNA DE SAÍDA PARA DEMONSTRAÇÃO Nº ${s.numero}`, 14, (y += 10));
    doc.setFont("helvetica", "normal").setFontSize(10);
    [`Funcionário responsável: ${nome(s.funcionario_id)}`, `Data de saída: ${fmtData(s.created_at)}`, `Prazo para venda ou devolução: ${fmtData(s.prazo_ate)}`,
      "", `Item: ${s.descricao}`, `Quantidade: ${s.quantidade}`, `Valor unitário: ${formatCurrency(s.valor_unitario)}`, `Valor total: ${formatCurrency(s.quantidade * s.valor_unitario)}`,
      s.observacao ? `Observação: ${s.observacao}` : ""].forEach((l) => doc.text(l, 14, (y += 7)));
    y += 10;
    doc.text(doc.splitTextToSize("Declaro que recebi o(s) item(ns) acima para apresentação a clientes e me comprometo a concluir a venda ou devolvê-lo(s) em perfeito estado até a data indicada. Caso contrário, o valor total será cobrado de mim.", 180), 14, y);
    y += 40;
    doc.line(14, y, 100, y); doc.text("Assinatura do funcionário", 14, y + 5);
    doc.line(115, y, 196, y); doc.text("Responsável pelo estoque", 115, y + 5);
    doc.save(`nota-interna-${s.numero}.pdf`);
  }

  function notaPDFMultipla(registros: any[]) {
    if (registros.length === 1) return notaPDF(registros[0]);
    const doc = new jsPDF();
    let y = 18;
    doc.setFont("helvetica", "bold").setFontSize(14).text(organization?.name || "Empresa", 14, y);
    doc.setFontSize(12).text("NOTA INTERNA DE SAÍDA PARA DEMONSTRAÇÃO", 14, (y += 10));
    doc.setFont("helvetica", "normal").setFontSize(10);
    const total = registros.reduce((t, s) => t + s.quantidade * s.valor_unitario, 0);
    [`Funcionário responsável: ${nome(registros[0].funcionario_id)}`, `Data de saída: ${fmtData(registros[0].created_at)}`, `Prazo para venda ou devolução: ${fmtData(registros[0].prazo_ate)}`, ""].forEach((l) => doc.text(l, 14, (y += 7)));
    registros.forEach((s, idx) => {
      doc.text(doc.splitTextToSize(`${idx + 1}. ${s.descricao} — ${s.quantidade} × ${formatCurrency(s.valor_unitario)} = ${formatCurrency(s.quantidade * s.valor_unitario)} (nota nº ${s.numero})`, 180), 14, (y += 7));
    });
    doc.setFont("helvetica", "bold").text(`Valor total: ${formatCurrency(total)}`, 14, (y += 9));
    doc.setFont("helvetica", "normal");
    if (registros[0].observacao) doc.text(doc.splitTextToSize(`Observação: ${registros[0].observacao}`, 180), 14, (y += 7));
    y += 10;
    doc.text(doc.splitTextToSize("Declaro que recebi o(s) item(ns) acima para apresentação a clientes e me comprometo a concluir a venda ou devolvê-lo(s) em perfeito estado até a data indicada. Caso contrário, o valor total será cobrado de mim.", 180), 14, y);
    y += 40;
    doc.line(14, y, 100, y); doc.text("Assinatura do funcionário", 14, y + 5);
    doc.line(115, y, 196, y); doc.text("Responsável pelo estoque", 115, y + 5);
    doc.save(`nota-interna-demonstracao.pdf`);
  }

  function adicionarItem(i: any) {
    setItens((prev) => {
      const existente = prev.find((p) => p.id === i.id);
      if (existente) return prev.map((p) => p.id === i.id ? { ...p, qtd: Math.min(p.qtd + 1, Number(i.quantidade)) } : p);
      return [...prev, { id: i.id, codigo: i.codigo, descricao: i.descricao, estoque: Number(i.quantidade), preco_venda: Number(i.preco_venda), qtd: 1 }];
    });
    if (novo) setNovo({ ...novo, busca: "" });
  }

  async function criar() {
    if (!novo?.func) return toast.error("Selecione o funcionário");
    const validos = itens.filter((i) => i.qtd > 0);
    if (validos.length === 0) return toast.error("Adicione pelo menos um item");
    const semEstoque = validos.find((i) => i.qtd > i.estoque);
    if (semEstoque) return toast.error(`Quantidade de "${semEstoque.descricao}" maior que o estoque disponível`);
    setSalvando(true);
    const ids: string[] = [];
    for (const i of validos) {
      const { data, error } = await supabase.rpc("criar_saida_demonstracao", { _item: i.id, _qtd: i.qtd, _obs: novo.obs || null, _funcionario: novo.func });
      if (error) {
        setSalvando(false);
        if (ids.length > 0) toast.warning(`${ids.length} item(ns) já foram retirados antes do erro.`);
        return toast.error(getErrorMessage(error));
      }
      ids.push(data as string);
    }
    setSalvando(false);
    toast.success(validos.length > 1 ? `Nota interna gerada com ${validos.length} itens.` : "Nota interna gerada. O item saiu do estoque da loja por 7 dias.");
    setNovo(null); setItens([]);
    await qc.invalidateQueries({ queryKey: key });
    const { data: registros } = await supabase.from("saidas_demonstracao").select("*").in("id", ids);
    if (registros?.length) notaPDFMultipla(registros);
  }

  async function concluir(id: string, acao: string, msg: string) {
    if (!window.confirm(msg)) return;
    const { error } = await supabase.rpc("concluir_saida_demonstracao", { _id: id, _acao: acao });
    if (error) return toast.error(getErrorMessage(error));
    toast.success("Atualizado");
    qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["estoque"] });
  }

  return (
    <MainLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Itens para Demonstração</h1>
            <p className="text-sm text-muted-foreground">Retire itens do estoque para mostrar a clientes. Prazo de 7 dias para vender ou devolver; depois disso o valor é cobrado do funcionário.</p>
          </div>
          {isAdmin && <Button onClick={() => { setItens([]); setNovo({ obs: "", busca: "", func: "" }); }}><Plus className="mr-1 h-4 w-4" />Nova retirada</Button>}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Itens com funcionários</p><p className="text-xl font-bold">{emPosse.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Valor fora da loja</p><p className="text-xl font-bold">{formatCurrency(emPosse.reduce((t: number, s: any) => t + s.quantidade * s.valor_unitario, 0))}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cobranças em aberto</p><p className="text-xl font-bold text-destructive">{formatCurrency(cobrado)}</p></CardContent></Card>
        </div>

        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Com funcionários</SelectItem>
            <SelectItem value="concluidos">Vendidos / devolvidos</SelectItem>
            <SelectItem value="cobrados">Cobrados</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>

        {isLoading ? <p className="text-muted-foreground">Carregando...</p> : filtrados.length === 0 ? <p className="py-10 text-center text-muted-foreground">Nenhum registro.</p> : (
          <div className="space-y-2">
            {filtrados.map((s: any) => {
              const dias = Math.ceil((new Date(s.prazo_ate).getTime() - Date.now()) / 86400000);
              const dono = s.funcionario_id === user?.id;
              return (
                <Card key={s.id}><CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">#{s.numero} · {s.descricao} <span className="font-normal text-muted-foreground">× {s.quantidade}</span></p>
                    <p className="text-xs text-muted-foreground">{nome(s.funcionario_id)} · saiu em {fmtData(s.created_at)} · {formatCurrency(s.quantidade * s.valor_unitario)}</p>
                    {s.status === "em_posse" && <p className={`text-xs font-medium ${dias <= 2 ? "text-destructive" : "text-muted-foreground"}`}>Prazo até {fmtData(s.prazo_ate)} ({dias > 0 ? `${dias} dia(s)` : "vence hoje"})</p>}
                    {s.valor_cobrado != null && <p className="text-xs font-medium text-destructive">Valor cobrado: {formatCurrency(s.valor_cobrado)}</p>}
                  </div>
                  <Badge variant={STATUS[s.status].variant}>{STATUS[s.status].label}</Badge>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" title="Baixar nota interna" onClick={() => notaPDF(s)}><FileDown className="h-4 w-4" /></Button>
                    {(s.status === "em_posse" && (dono || isAdmin) || s.status === "cobrado" && isAdmin) && <>
                      <Button size="sm" variant="outline" onClick={() => concluir(s.id, "vendido", "Confirmar que o item foi vendido? Lembre-se de registrar a venda em Vendas.")}><CheckCircle2 className="mr-1 h-4 w-4" />Vendido</Button>
                      <Button size="sm" variant="outline" onClick={() => concluir(s.id, "devolvido", "Confirmar devolução? O item volta para o estoque da loja.")}><Undo2 className="mr-1 h-4 w-4" />Devolvido</Button>
                    </>}
                    {s.status === "cobrado" && isAdmin && <Button size="sm" onClick={() => concluir(s.id, "quitado", "Confirmar que o funcionário pagou este valor?")}><Banknote className="mr-1 h-4 w-4" />Quitar</Button>}
                  </div>
                </CardContent></Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!novo} onOpenChange={(o) => !o && setNovo(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova retirada para demonstração</DialogTitle></DialogHeader>
          {novo && <div className="space-y-3">
            <div><Label>Funcionário responsável *</Label>
              <Select value={novo.func} onValueChange={(v) => setNovo({ ...novo, func: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o funcionário" /></SelectTrigger>
                <SelectContent>{(members ?? []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nome}{m.id === user?.id ? " (você)" : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Itens do estoque *</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" value={novo.busca} placeholder="Buscar peça ou produto para adicionar..." onChange={(e) => setNovo({ ...novo, busca: e.target.value })} />
                {buscando && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
                {novo.busca.trim() && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                    {resultados.length === 0 && !buscando && <div className="px-3 py-2 text-center text-sm text-muted-foreground">Nenhum resultado com estoque disponível.</div>}
                    {resultados.map((i: any) => (
                      <button key={i.id} type="button" onClick={() => adicionarItem(i)}
                        className="flex w-full items-center gap-2 border-b border-border/30 px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/50">
                        <Package className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{i.descricao}</p>
                          <p className="text-xs text-muted-foreground">{[i.codigo, `Estoque: ${i.quantidade}`].filter(Boolean).join(" · ")}</p></div>
                        <span className="shrink-0 text-sm font-semibold text-primary">{formatCurrency(i.preco_venda)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {itens.length > 0 && (
              <div className="space-y-2 rounded-md border p-2">
                {itens.map((i, idx) => (
                  <div key={i.id} className="rounded-md bg-muted/40 p-2">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">{idx + 1}. {i.descricao}</p>
                      <Button size="icon" variant="ghost" title="Remover item" onClick={() => setItens(itens.filter((p) => p.id !== i.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Input type="number" min="1" max={i.estoque} className="w-20" value={i.qtd}
                        onChange={(e) => setItens(itens.map((p) => p.id === i.id ? { ...p, qtd: Math.max(1, Number(e.target.value) || 1) } : p))} />
                      <span className="text-xs text-muted-foreground">× {formatCurrency(i.preco_venda)}</span>
                      <span className="ml-auto text-sm font-semibold text-primary">{formatCurrency(i.qtd * i.preco_venda)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end border-t pt-2 text-sm font-bold">Total: {formatCurrency(totalRetirada)}</div>
              </div>
            )}
            <div><Label>Observação (cliente, motivo...)</Label><Input value={novo.obs} onChange={(e) => setNovo({ ...novo, obs: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">Ao confirmar, os itens saem do estoque da loja e ficam sob responsabilidade do funcionário por 7 dias. Se não forem vendidos nem devolvidos nesse prazo, o valor de venda é cobrado dele.</p>
          </div>}
          <DialogFooter><Button onClick={criar} disabled={salvando}>{salvando ? "Gerando..." : "Gerar nota interna"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
