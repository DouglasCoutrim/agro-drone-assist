import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useVendasData } from "@/hooks/useVendasData";
import { SmartSelect } from "@/components/ui/smart-select";
import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, FileText, Loader2, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { limitarPercentualDesconto, calcularValorDesconto, calcularTotalComDesconto, tetoDesconto } from "@/lib/desconto";
import { gerarDocumentoPadrao, loadImageAsDataUrl } from "@/lib/pdf-padrao";
import { cn } from "@/lib/utils";

// Campo de valor em reais (mostra o prefixo R$)
function MoneyInput({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
      <NumberInput value={value} step={0.01} min={0} onChange={onChange} className={cn("h-8 pl-8 pr-2 text-sm", className)} />
    </div>
  );
}

const FORMAS = [
  { value: "dinheiro", label: "Dinheiro" }, { value: "pix", label: "PIX" },
  { value: "debito", label: "Débito" }, { value: "credito", label: "Crédito" },
];

interface Linha { key: string; produto_id: string; nome: string; ncm: string; cfop: string; qtd: number; preco: number; pct: number; max: number; }

export default function PDV() {
  const { organization } = useOrganization();
  const { createVenda, fetchData } = useVendasData();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [cliente, setCliente] = useState<any | null>(null);
  const [forma, setForma] = useState("dinheiro");
  const [recebido, setRecebido] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!organization?.id) return;
    supabase.from("itens_estoque").select("id,codigo,descricao,preco_venda,ncm,cfop,quantidade,desconto_maximo_percentual").eq("organization_id", organization.id).order("descricao").then(({ data }) => setProdutos(data || []));
    supabase.from("clientes").select("*").eq("organization_id", organization.id).order("nome").then(({ data }) => setClientes(data || []));
  }, [organization?.id]);

  const calc = (l: Linha) => ({ desc: calcularValorDesconto(l.qtd, l.preco, l.pct), total: calcularTotalComDesconto(l.qtd, l.preco, l.pct) });
  const subtotal = useMemo(() => linhas.reduce((s, l) => s + l.qtd * l.preco, 0), [linhas]);
  const descontos = useMemo(() => linhas.reduce((s, l) => s + calc(l).desc, 0), [linhas]);
  const total = Math.max(0, Math.round((subtotal - descontos) * 100) / 100);
  const troco = forma === "dinheiro" && recebido > total ? recebido - total : 0;

  const addProduto = (id: string) => {
    const p = produtos.find((x) => x.id === id);
    if (!p) return;
    setLinhas((prev) => {
      const ex = prev.find((l) => l.produto_id === id);
      if (ex) return prev.map((l) => (l === ex ? { ...l, qtd: l.qtd + 1 } : l));
      return [...prev, { key: crypto.randomUUID(), produto_id: id, nome: p.descricao, ncm: p.ncm || "", cfop: p.cfop || "5102", qtd: 1, preco: Number(p.preco_venda) || 0, pct: 0, max: Number(p.desconto_maximo_percentual) || 0 }];
    });
  };

  const upd = (key: string, patch: Partial<Linha>) => setLinhas((prev) => prev.map((l) => {
    if (l.key !== key) return l;
    const n = { ...l, ...patch };
    if (patch.pct !== undefined) {
      const r = limitarPercentualDesconto(patch.pct, l.max);
      if (r.limitado) toast.warning(`Desconto máximo deste item: ${tetoDesconto(l.max)}%`);
      n.pct = r.percentual;
    }
    return n;
  }));

  const gerarRecibo = async (venda: any) => {
    const { data: e } = await supabase.from("empresa_config").select("nome_empresa, cnpj, telefone, endereco, logo_url").eq("organization_id", organization!.id).maybeSingle();
    const doc = gerarDocumentoPadrao({
      titulo: "Recibo de Venda",
      numero: venda.numero,
      linhasCabecalho: [`Emissão: ${new Date().toLocaleString("pt-BR")}`, "Documento sem valor fiscal"],
      empresa: { nome: e?.nome_empresa || organization?.name || "Empresa", cnpj: e?.cnpj, telefone: e?.telefone, endereco: e?.endereco, logoDataUrl: await loadImageAsDataUrl(e?.logo_url) },
      parte: { rotulo: "Cliente", nome: venda.cliente_nome, detalhes: [venda.cliente_cpf_cnpj ? `CPF/CNPJ: ${venda.cliente_cpf_cnpj}` : ""] },
      tabela: {
        titulo: "Itens",
        colunas: [{ titulo: "Descrição" }, { titulo: "Qtd", largura: 14, alinhar: "right" }, { titulo: "Unit.", largura: 26, alinhar: "right" }, { titulo: "Desc.", largura: 24, alinhar: "right" }, { titulo: "Total", largura: 28, alinhar: "right" }],
        linhas: linhas.map((l) => { const c = calc(l); return [l.nome, String(l.qtd), formatCurrency(l.preco), c.desc > 0 ? `${formatCurrency(c.desc)} (${l.pct}%)` : "—", formatCurrency(c.total)]; }),
      },
      totais: [
        { rotulo: "Subtotal", valor: subtotal },
        ...(descontos > 0 ? [{ rotulo: "Descontos", valor: descontos, negativo: true }] : []),
        { rotulo: "TOTAL PAGO", valor: total, destaque: true },
        ...(troco > 0 ? [{ rotulo: "Valor recebido", valor: recebido }, { rotulo: "Troco", valor: troco }] : []),
      ],
      observacao: `Forma de pagamento: ${FORMAS.find((f) => f.value === forma)?.label}`,
      assinaturas: [e?.nome_empresa || organization?.name || "Empresa", venda.cliente_nome],
    });
    doc.save(`recibo-${venda.numero}.pdf`);
  };

  // Conclui a venda e, em seguida, emite a nota fiscal ou gera o recibo.
  const finalizar = async (emitirNotaFiscal: boolean) => {
    if (linhas.length === 0) return toast.error("Adicione pelo menos um produto");
    if (forma === "dinheiro" && recebido > 0 && recebido < total) return toast.error("Valor recebido menor que o total");
    setSaving(true);
    try {
      const itens = linhas.map((l) => { const c = calc(l); return {
        produto_id: l.produto_id, nome_produto: l.nome, ncm: l.ncm, cfop: l.cfop, quantidade: l.qtd, preco_unitario: l.preco,
        desconto_percentual: l.pct, desconto_valor: c.desc, valor_total: c.total,
        icms_percentual: null, icms_valor: null, pis_cofins_valor: null, ipi_valor: null,
      }; });
      const venda = await createVenda({
        data_venda: new Date().toISOString().split("T")[0],
        cliente_id: cliente?.id || null, cliente_nome: cliente?.nome || "Consumidor",
        cliente_cpf_cnpj: cliente?.cpf_cnpj || null, cliente_email: cliente?.email || null,
        forma_pagamento: forma, status_pagamento: "pago",
        obs: emitirNotaFiscal ? "Venda PDV" : "Venda PDV (recibo, sem nota fiscal)",
        nf_numero: null, nf_chave: null, nf_emitida_em: null, nf_provider: null,
        nfe_dados: { emitir_nota: emitirNotaFiscal, origem: "pdv" },
      } as any, itens as any);

      if (emitirNotaFiscal) {
        try {
          const { error } = await supabase.functions.invoke("emitir-nfe-venda", { body: { action: "emitir", venda_id: venda.id } });
          if (error) throw error;
          await fetchData();
          toast.success(`Venda ${venda.numero} registrada e NF-e enviada!`);
        } catch (err: any) {
          let msg = err?.message;
          try {
            const body = await err.context?.json?.();
            if (body?.problemas?.length) msg = body.problemas.join("\n");
            else if (body?.error) msg = body.error;
          } catch { /* ignora */ }
          toast.error("Venda salva, mas a NF-e não foi emitida", { description: msg, duration: 12000 });
        }
      } else {
        await gerarRecibo(venda);
        toast.success(`Venda ${venda.numero} registrada e recibo gerado`);
      }
      setLinhas([]); setCliente(null); setRecebido(0);
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível finalizar a venda");
    } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto pb-24">
      <div className="flex items-center gap-2"><Calculator className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">PDV — Nova venda</h1></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-xl border bg-card p-4 space-y-3">
          <SmartSelect
            placeholder="Buscar produto por código ou nome..."
            options={produtos.map((p) => ({ id: p.id, label: `${p.codigo ? p.codigo + " · " : ""}${p.descricao}`, sublabel: formatCurrency(p.preco_venda) }))}
            value={undefined}
            onSelect={(o) => addProduto(o.id)}
          />
          {linhas.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum produto adicionado</p>}
          {linhas.map((l) => { const c = calc(l); return (
            <div key={l.key} className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end border rounded-lg p-2">
              <div className="col-span-2 md:col-span-3"><Label className="text-xs">Produto</Label><p className="text-sm font-medium truncate">{l.nome}</p></div>
              <div className="md:col-span-2"><Label className="text-xs">Qtd</Label><NumberInput value={l.qtd} min={1} step={1} inputMode="numeric" onChange={(v) => upd(l.key, { qtd: Math.round(v) })} className="h-8 px-2 text-sm" /></div>
              <div className="md:col-span-2"><Label className="text-xs">Preço</Label><MoneyInput value={l.preco} onChange={(v) => upd(l.key, { preco: v })} /></div>
              <div className="md:col-span-1"><Label className="text-xs">Desc %</Label><NumberInput value={l.pct} min={0} max={tetoDesconto(l.max)} step={0.1} onChange={(v) => upd(l.key, { pct: v })} className="h-8 px-2 text-sm" /></div>
              <div className="md:col-span-3 text-right"><Label className="text-xs">Total</Label><p className="font-bold text-primary">{formatCurrency(c.total)}</p>{c.desc > 0 && <p className="text-xs text-destructive">-{formatCurrency(c.desc)}</p>}</div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Remover item" onClick={() => setLinhas((p) => p.filter((x) => x.key !== l.key))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ); })}
        </section>
        <aside className="rounded-xl border bg-card p-4 space-y-4 h-fit lg:sticky lg:top-4">
          <div><Label>Cliente (opcional)</Label>
            <SmartSelect placeholder="Consumidor" options={clientes.map((c) => ({ id: c.id, label: c.nome, sublabel: c.cpf_cnpj || "" }))} value={cliente?.id} onSelect={(o) => setCliente(clientes.find((c) => c.id === o.id) || null)} onClear={() => setCliente(null)} />
          </div>
          <div><Label>Pagamento</Label>
            <Select value={forma} onValueChange={setForma}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FORMAS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select>
          </div>
          {forma === "dinheiro" && <div><Label>Valor recebido</Label><MoneyInput value={recebido} onChange={setRecebido} className="h-10 pl-9 pr-3" /></div>}
          <div className="space-y-1 text-sm border-t pt-3">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between text-destructive"><span>Descontos</span><span>-{formatCurrency(descontos)}</span></div>
            <div className="flex justify-between text-xl font-bold text-primary"><span>Total</span><span>{formatCurrency(total)}</span></div>
            {troco > 0 && <div className="flex justify-between font-semibold"><span>Troco</span><span>{formatCurrency(troco)}</span></div>}
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Button className="w-full gap-2" size="lg" disabled={saving || linhas.length === 0} onClick={() => finalizar(true)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Emitir Nota Fiscal
            </Button>
            <Button variant="outline" className="w-full gap-2" size="lg" disabled={saving || linhas.length === 0} onClick={() => finalizar(false)}>
              <Receipt className="h-4 w-4" />
              Emitir Recibo
            </Button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">Ao clicar, a venda é concluída e o documento é gerado em seguida.</p>
        </aside>
      </div>
    </div>
  );
}
