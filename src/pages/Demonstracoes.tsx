import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import { Plus, FileDown, CheckCircle2, Undo2, Banknote } from "lucide-react";
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

export default function Demonstracoes() {
  const { organization } = useOrganization();
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const { members } = useTeamMembers();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState("ativos");
  const [novo, setNovo] = useState<{ item: string; qtd: string; obs: string; busca: string } | null>(null);
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
  const { data: itens = [] } = useQuery({
    queryKey: ["demo-itens", organization?.id], enabled: !!novo && !!organization?.id,
    queryFn: async () => {
      const { data } = await supabase.from("itens_estoque").select("id,codigo,descricao,quantidade,preco_venda").eq("organization_id", organization!.id).gt("quantidade", 0).order("descricao");
      return data ?? [];
    },
  });

  const nome = (id: string) => members?.find((m) => m.id === id)?.nome ?? (id === user?.id ? "Você" : "Funcionário");
  const filtrados = useMemo(() => lista.filter((s: any) =>
    filtro === "todos" ? true : filtro === "ativos" ? s.status === "em_posse" : filtro === "cobrados" ? ["cobrado", "quitado"].includes(s.status) : ["vendido", "devolvido"].includes(s.status)), [lista, filtro]);
  const emPosse = lista.filter((s: any) => s.status === "em_posse");
  const cobrado = lista.filter((s: any) => s.status === "cobrado").reduce((t: number, s: any) => t + Number(s.valor_cobrado || 0), 0);

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

  async function criar() {
    if (!novo?.item || !(Number(novo.qtd) > 0)) return toast.error("Escolha o item e a quantidade");
    setSalvando(true);
    const { data, error } = await supabase.rpc("criar_saida_demonstracao", { _item: novo.item, _qtd: Number(novo.qtd), _obs: novo.obs || null });
    setSalvando(false);
    if (error) return toast.error(getErrorMessage(error));
    toast.success("Nota interna gerada. O item saiu do estoque da loja e está com você por 7 dias.");
    setNovo(null);
    await qc.invalidateQueries({ queryKey: key });
    const { data: s } = await supabase.from("saidas_demonstracao").select("*").eq("id", data as string).single();
    if (s) notaPDF(s);
  }

  async function concluir(id: string, acao: string, msg: string) {
    if (!window.confirm(msg)) return;
    const { error } = await supabase.rpc("concluir_saida_demonstracao", { _id: id, _acao: acao });
    if (error) return toast.error(getErrorMessage(error));
    toast.success("Atualizado");
    qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["estoque"] });
  }

  const itensFiltrados = itens.filter((i: any) => !novo?.busca || `${i.codigo} ${i.descricao}`.toLowerCase().includes(novo.busca.toLowerCase())).slice(0, 50);

  return (
    <MainLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Itens para Demonstração</h1>
            <p className="text-sm text-muted-foreground">Retire itens do estoque para mostrar a clientes. Prazo de 7 dias para vender ou devolver; depois disso o valor é cobrado do funcionário.</p>
          </div>
          <Button onClick={() => setNovo({ item: "", qtd: "1", obs: "", busca: "" })}><Plus className="mr-1 h-4 w-4" />Nova retirada</Button>
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
            <div><Label>Buscar item</Label><Input value={novo.busca} placeholder="Código ou descrição" onChange={(e) => setNovo({ ...novo, busca: e.target.value })} /></div>
            <div><Label>Item do estoque</Label>
              <Select value={novo.item} onValueChange={(v) => setNovo({ ...novo, item: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{itensFiltrados.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.codigo} · {i.descricao} (disp. {i.quantidade}) · {formatCurrency(i.preco_venda)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Quantidade</Label><Input type="number" min="1" value={novo.qtd} onChange={(e) => setNovo({ ...novo, qtd: e.target.value })} /></div>
            <div><Label>Observação (cliente, motivo...)</Label><Input value={novo.obs} onChange={(e) => setNovo({ ...novo, obs: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">Ao confirmar, o item sai do estoque da loja e fica sob sua responsabilidade por 7 dias. Se não for vendido nem devolvido nesse prazo, o valor de venda é cobrado de você.</p>
          </div>}
          <DialogFooter><Button onClick={criar} disabled={salvando}>{salvando ? "Gerando..." : "Gerar nota interna"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
