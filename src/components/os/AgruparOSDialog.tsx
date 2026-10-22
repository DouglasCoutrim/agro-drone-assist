import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NumberInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import { SmartSelect } from "@/components/ui/smart-select";
import { Loader2, Download, MessageCircle, Save, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { getStatusLabel } from "@/components/os/StatusPipeline";
import { formatCurrency, formatDate, getErrorMessage } from "@/lib/formatters";
import {
  ConsolidadoGrupo, GroupedStoredItem, generateOrcamentoConsolidadoPDF, grupoSubtotal,
  loadImageAsDataUrl, shareConsolidadoPDF,
} from "@/lib/orcamento-consolidado-pdf";

const TIPO: Record<string, string> = {
  drone_agricola: "Drone Agrícola", drone_convencional: "Drone", controle: "Controle Remoto", bateria: "Bateria", outro: "Outro",
};
const CLOSED = ["entregue", "cancelada", "finalizada"];

interface OSRow {
  id: string; numero: string; status: string; tipo_equipamento: string; marca: string | null;
  modelo_equipamento: string | null; numero_serie: string | null; descricao_problema: string;
  diagnostico: string | null; valor_orcamento: number | null; desconto: number; data_entrada: string;
}

const equipLabel = (o: OSRow) =>
  [TIPO[o.tipo_equipamento] || o.tipo_equipamento, o.marca, o.modelo_equipamento, o.numero_serie ? `S/N ${o.numero_serie}` : ""]
    .filter(Boolean).join(" · ");

export function AgruparOSDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { organization } = useOrganization();
  const { config: empresa } = useEmpresaConfig();
  const [clientes, setClientes] = useState<{ id: string; nome: string; telefone: string }[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [osList, setOsList] = useState<OSRow[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [itemsByOS, setItemsByOS] = useState<Record<string, any[]>>({});
  const [loadingOS, setLoadingOS] = useState(false);
  const [desconto, setDesconto] = useState(0);
  const [validade, setValidade] = useState(new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0]);
  const [observacao, setObservacao] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !organization?.id) return;
    supabase.from("clientes").select("id, nome, telefone").eq("organization_id", organization.id).order("nome")
      .then(({ data }) => setClientes((data as any) || []));
  }, [open, organization?.id]);

  useEffect(() => {
    if (!clienteId || !organization?.id) { setOsList([]); setSelected(new Set()); return; }
    setLoadingOS(true);
    (async () => {
      try {
        const { data, error } = await supabase.from("ordens_servico")
          .select("id, numero, status, tipo_equipamento, marca, modelo_equipamento, numero_serie, descricao_problema, diagnostico, valor_orcamento, desconto, data_entrada")
          .eq("organization_id", organization.id).eq("cliente_id", clienteId).order("data_entrada", { ascending: true });
        if (error) throw error;
        const list = (data as any as OSRow[]) || [];
        setOsList(list);
        const ids = list.map(o => o.id);
        const map: Record<string, any[]> = {};
        if (ids.length) {
          const { data: its, error: e2 } = await supabase.from("itens_os")
            .select("ordem_servico_id, tipo, descricao, quantidade, valor_unitario, valor_total, created_at")
            .in("ordem_servico_id", ids).order("created_at");
          if (e2) throw e2;
          for (const it of its || []) (map[(it as any).ordem_servico_id] ||= []).push(it);
        }
        setItemsByOS(map);
        setSelected(new Set(list.filter(o => !CLOSED.includes(o.status)).map(o => o.id)));
      } catch (e) { toast.error("Erro ao carregar OS: " + getErrorMessage(e)); }
      finally { setLoadingOS(false); }
    })();
  }, [clienteId, organization?.id]);

  const visible = useMemo(() => showAll ? osList : osList.filter(o => !CLOSED.includes(o.status)), [osList, showAll]);
  const cliente = clientes.find(c => c.id === clienteId);

  const grupos: ConsolidadoGrupo[] = useMemo(() => osList.filter(o => selected.has(o.id)).map(o => {
    const its = itemsByOS[o.id] || [];
    const itens = its.length
      ? its.map(i => ({ tipo: i.tipo, descricao: i.descricao, quantidade: Number(i.quantidade) || 0, valor_unitario: Number(i.valor_unitario) || 0, valor_total: Number(i.valor_total) || 0 }))
      : Number(o.valor_orcamento) > 0
        ? [{ tipo: "servico", descricao: "Serviço conforme orçamento da OS", quantidade: 1, valor_unitario: Number(o.valor_orcamento), valor_total: Number(o.valor_orcamento) }]
        : [];
    return { os_numero: o.numero, equipamento: equipLabel(o), defeito: o.descricao_problema, diagnostico: o.diagnostico || undefined, itens, _id: o.id } as any;
  }), [osList, selected, itemsByOS]);

  const subtotal = grupos.reduce((s, g) => s + grupoSubtotal(g), 0);
  const total = Math.max(0, subtotal - desconto);

  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const buildDoc = async (numero?: string) => generateOrcamentoConsolidadoPDF({
    numero,
    data: new Date().toLocaleDateString("pt-BR"),
    validade: new Date(validade + "T12:00:00").toLocaleDateString("pt-BR"),
    cliente: { nome: cliente?.nome || "Cliente", telefone: cliente?.telefone },
    empresa: { nome: empresa.nome_empresa, telefone: empresa.telefone, cnpj: empresa.cnpj, endereco: empresa.endereco, logoDataUrl: await loadImageAsDataUrl(empresa.logo_url) },
    grupos, desconto, observacao, termos: empresa.termos_servico,
  });
  const fileName = () => `orcamento-consolidado-${(cliente?.nome || "cliente").replace(/\s+/g, "-").toLowerCase()}.pdf`;

  const guard = () => { if (!cliente || grupos.length === 0) { toast.error("Selecione o cliente e ao menos uma OS."); return false; } return true; };

  const handleDownload = async () => { if (!guard()) return; setBusy(true); try { (await buildDoc()).save(fileName()); } finally { setBusy(false); } };
  const handleShare = async () => {
    if (!guard()) return;
    setBusy(true);
    try {
      const msg = `Olá *${cliente!.nome}*! 👋\n\nSegue o orçamento consolidado da *${empresa.nome_empresa}* referente a ${grupos.length} ordem(ns) de serviço (${grupos.map(g => g.os_numero).join(", ")}).\n\n💰 *Total: ${formatCurrency(total)}*\n📅 Válido até: ${new Date(validade + "T12:00:00").toLocaleDateString("pt-BR")}`;
      await shareConsolidadoPDF(await buildDoc(), fileName(), msg, cliente!.telefone);
    } catch (e) { toast.error("Erro ao compartilhar: " + getErrorMessage(e)); } finally { setBusy(false); }
  };
  const handleSave = async () => {
    if (!guard() || !organization?.id) return;
    setBusy(true);
    try {
      const itens: GroupedStoredItem[] = grupos.flatMap((g: any) => g.itens.map((i: any) => ({
        ...i, ordem_servico_id: g._id, os_numero: g.os_numero, os_equipamento: g.equipamento, os_defeito: g.defeito, os_diagnostico: g.diagnostico,
      })));
      const { error } = await supabase.from("orcamentos").insert({
        organization_id: organization.id, cliente_id: clienteId,
        equipamento: `Agrupado: ${grupos.map(g => g.os_numero).join(", ")}`,
        descricao: observacao || `Orçamento consolidado de ${grupos.length} OS`,
        valor: total, desconto, validade, status: "pendente", itens: itens as any,
      } as any);
      if (error) throw error;
      toast.success("Orçamento agrupado salvo em Orçamentos.");
    } catch (e) { toast.error("Erro ao salvar: " + getErrorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Layers className="h-5 w-5 text-primary" />Agrupar OS em orçamento</DialogTitle>
          <DialogDescription>Escolha o cliente e as ordens de serviço que entram no orçamento único.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <SmartSelect options={clientes.map(c => ({ value: c.id, label: c.nome }))} value={clienteId} onValueChange={setClienteId} placeholder="Selecione o cliente" />
          </div>

          {clienteId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ordens de serviço</Label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={showAll} onCheckedChange={(v) => setShowAll(!!v)} />Mostrar entregues/finalizadas
                </label>
              </div>
              {loadingOS ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
                : visible.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma OS encontrada para este cliente.</p>
                : (
                  <div className="space-y-2">
                    {visible.map(o => {
                      const g = grupos.find((x: any) => x._id === o.id);
                      const its = itemsByOS[o.id] || [];
                      const val = its.length ? its.reduce((s, i) => s + Number(i.valor_total || 0), 0) : Number(o.valor_orcamento || 0);
                      return (
                        <label key={o.id} className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40">
                          <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} className="mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-sm font-semibold">{o.numero}</span>
                              <span className="font-mono text-sm font-semibold text-primary">{formatCurrency(val)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{equipLabel(o)}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px]">{getStatusLabel(o.status as any)}</Badge>
                              <span className="text-[10px] text-muted-foreground">{formatDate(o.data_entrada)} · {its.length} item(ns)</span>
                            </div>
                            {g && its.length > 0 && (
                              <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                                {its.map((i, idx) => <li key={idx} className="flex justify-between gap-2"><span className="truncate">{i.quantidade}× {i.descricao}</span><span className="font-mono">{formatCurrency(i.valor_total)}</span></li>)}
                              </ul>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
            </div>
          )}

          {grupos.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Desconto geral (R$)</Label><NumberInput value={desconto} onChange={(v: any) => setDesconto(Number(v) || 0)} /></div>
                <div className="space-y-1.5"><Label>Validade</Label><Input type="date" value={validade} onChange={e => setValidade(e.target.value)} /></div>
              </div>
              <div className="space-y-1.5"><Label>Observação para o cliente</Label><Textarea rows={2} value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex.: condições de pagamento, prazo de execução..." /></div>

              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 text-sm">
                {grupos.map(g => <div key={g.os_numero} className="flex justify-between"><span>{g.os_numero}</span><span className="font-mono">{formatCurrency(grupoSubtotal(g))}</span></div>)}
                <div className="flex justify-between border-t border-border pt-1"><span>Subtotal</span><span className="font-mono">{formatCurrency(subtotal)}</span></div>
                {desconto > 0 && <div className="flex justify-between"><span>Desconto</span><span className="font-mono">- {formatCurrency(desconto)}</span></div>}
                <div className="flex justify-between font-bold text-base"><span>TOTAL</span><span className="font-mono text-primary">{formatCurrency(total)}</span></div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Button variant="outline" onClick={handleSave} disabled={busy}><Save className="h-4 w-4 mr-1.5" />Salvar orçamento</Button>
                <Button variant="outline" onClick={handleDownload} disabled={busy}><Download className="h-4 w-4 mr-1.5" />Baixar PDF</Button>
                <Button onClick={handleShare} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-1.5" />}Enviar por WhatsApp</Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
