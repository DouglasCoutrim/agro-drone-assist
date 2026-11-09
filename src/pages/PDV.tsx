import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useVendasData } from "@/hooks/useVendasData";
import { SmartSelect } from "@/components/ui/smart-select";
import { NumberInput } from "@/components/ui/number-input";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, FileText, Loader2, Receipt, Search, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { limitarPercentualDesconto, calcularValorDesconto, calcularTotalComDesconto, tetoDesconto } from "@/lib/desconto";
import { gerarDocumentoPadrao, loadImageAsDataUrl } from "@/lib/pdf-padrao";
import { cn } from "@/lib/utils";

// Campo de valor em reais (mostra o prefixo R$)
function MoneyInput({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
      <NumberInput value={value} step={0.01} min={0} onChange={onChange} className={cn("h-8 pl-6 pr-1.5 text-sm", className)} />
    </div>
  );
}

const FORMAS = [
  { value: "dinheiro", label: "Dinheiro" }, { value: "pix", label: "PIX" },
  { value: "debito", label: "Débito" }, { value: "credito", label: "Crédito" },
];

const SELECT_PRODUTO = "id,codigo,descricao,preco_venda,ncm,cfop,quantidade,desconto_maximo_percentual";

// Busca produtos no servidor por código ou descrição (máx. 20)
async function buscarProdutos(organizationId: string, termo: string) {
  // Remove caracteres que quebram o filtro .or()
  const safe = termo.replace(/[,()%*]/g, " ").trim();
  if (!safe) return [];
  const { data } = await supabase
    .from("itens_estoque")
    .select(SELECT_PRODUTO)
    .eq("organization_id", organizationId)
    .or(`codigo.ilike.%${safe}%,descricao.ilike.%${safe}%`)
    .order("descricao")
    .limit(20);
  return data || [];
}

interface Linha { key: string; produto_id: string; codigo: string; nome: string; ncm: string; cfop: string; qtd: number; preco: number; pct: number; max: number; }

export default function PDV() {
  const { organization } = useOrganization();
  const { createVenda, fetchData } = useVendasData();
  const [clientes, setClientes] = useState<any[]>([]);
  const [termoBusca, setTermoBusca] = useState("");
  const [resultados, setResultados] = useState<any[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [cliente, setCliente] = useState<any | null>(null);
  const [forma, setForma] = useState("dinheiro");
  const [recebido, setRecebido] = useState(0);
  const [saving, setSaving] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!organization?.id) return;
    supabase.from("clientes").select("*").eq("organization_id", organization.id).order("nome").then(({ data }) => setClientes(data || []));
  }, [organization?.id]);

  // Busca de produtos no servidor, com debounce de 250 ms
  useEffect(() => {
    if (!organization?.id) return;
    const termo = termoBusca.trim();
    if (termo.length < 2) { setResultados([]); return; }
    const timeout = setTimeout(() => {
      buscarProdutos(organization.id, termo).then(setResultados);
    }, 250);
    return () => clearTimeout(timeout);
  }, [termoBusca, organization?.id]);

  const calc = (l: Linha) => ({ desc: calcularValorDesconto(l.qtd, l.preco, l.pct), total: calcularTotalComDesconto(l.qtd, l.preco, l.pct) });
  const subtotal = useMemo(() => linhas.reduce((s, l) => s + l.qtd * l.preco, 0), [linhas]);
  const descontos = useMemo(() => linhas.reduce((s, l) => s + calc(l).desc, 0), [linhas]);
  const total = Math.max(0, Math.round((subtotal - descontos) * 100) / 100);
  const troco = forma === "dinheiro" && recebido > total ? recebido - total : 0;

  const addProduto = async (id: string) => {
    let p: any = resultados.find((x) => x.id === id);
    if (!p && organization?.id) {
      const { data } = await supabase.from("itens_estoque").select(SELECT_PRODUTO).eq("id", id).eq("organization_id", organization.id).maybeSingle();
      p = data;
    }
    if (!p) return;
    setLinhas((prev) => {
      const ex = prev.find((l) => l.produto_id === id);
      if (ex) return prev.map((l) => (l === ex ? { ...l, qtd: l.qtd + 1 } : l));
      return [...prev, { key: crypto.randomUUID(), produto_id: id, codigo: p.codigo || "", nome: p.descricao, ncm: p.ncm || "", cfop: p.cfop || "5102", qtd: 1, preco: Number(p.preco_venda) || 0, pct: 0, max: Number(p.desconto_maximo_percentual) || 0 }];
    });
    setTermoBusca("");
    setResultados([]);
    buscaRef.current?.focus();
  };

  // Enter: usa o código exato ou o único resultado encontrado
  const adicionarPorEnter = async () => {
    const termo = termoBusca.trim();
    if (termo.length < 2 || !organization?.id) return;
    const lista = resultados.length > 0 ? resultados : await buscarProdutos(organization.id, termo);
    const exato = lista.find((p) => (p.codigo || "").toLowerCase() === termo.toLowerCase());
    const alvo = exato || (lista.length === 1 ? lista[0] : null);
    if (alvo) { await addProduto(alvo.id); return; }
    if (lista.length === 0) toast.error("Produto não encontrado");
    else setResultados(lista);
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

  // F2 finaliza a venda em qualquer lugar da tela
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "F2") return;
      e.preventDefault();
      if (saving || linhas.length === 0) return;
      finalizar(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saving, linhas, finalizar]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto pb-24 bg-slate-100 min-h-screen">
      <div className="flex items-center gap-2"><Calculator className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">PDV — Nova venda</h1></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={buscaRef}
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setTermoBusca(""); setResultados([]); return; }
                if (e.key === "Enter") { e.preventDefault(); adicionarPorEnter(); }
              }}
              placeholder="Buscar produto por código ou nome..."
              autoComplete="off"
              className="h-9 pl-9 text-sm"
            />
          </div>
          {resultados.length > 0 && (
            <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
              {resultados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduto(p.id)}
                  className="flex w-full items-center gap-2 border-b border-border/30 px-3 py-2 text-left last:border-b-0 hover:bg-muted/50"
                >
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{p.codigo || "—"}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{p.descricao}</span>
                  <span className="shrink-0 text-sm font-semibold text-primary">{formatCurrency(p.preco_venda)}</span>
                </button>
              ))}
            </div>
          )}
          {linhas.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
              <ShoppingCart className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">Busque um produto para começar</p>
              <p className="text-xs text-muted-foreground">Pressione Enter após digitar o código ou nome</p>
            </div>
          )}
          {linhas.length > 0 && (
            <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_96px_124px_88px_112px_32px] md:items-center md:gap-3 rounded-lg border-b border-slate-200 bg-vc-green-light px-3 pt-4 pb-2 text-xs uppercase tracking-wide text-vc-green-text">
              <span>Produto</span>
              <span className="text-right">Qtd</span>
              <span className="text-right">Preço</span>
              <span className="text-right">Desc %</span>
              <span className="text-right">Total</span>
              <span />
            </div>
          )}
          <div className="divide-y divide-slate-200">
            {linhas.map((l) => { const c = calc(l); return (
              <div key={l.key} className="relative px-2 py-2 hover:bg-slate-50 md:grid md:grid-cols-[minmax(0,1fr)_96px_124px_88px_112px_32px] md:items-center md:gap-3">
                <div className="min-w-0 pr-9 md:pr-0">
                  {l.codigo && <p className="truncate text-xs text-slate-500">{l.codigo}</p>}
                  <p className="truncate text-sm font-medium">{l.nome}</p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 md:contents">
                  <div className="space-y-1">
                    <span className="block text-xs uppercase tracking-wide text-slate-500 md:hidden">Qtd</span>
                    <NumberInput min={1} step={1} inputMode="numeric" value={l.qtd} onChange={(v) => upd(l.key, { qtd: Math.round(v) })} placeholder="Qtd" className="h-10 w-full text-right text-sm" />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-xs uppercase tracking-wide text-slate-500 md:hidden">Preço</span>
                    <MoneyInput value={l.preco} onChange={(v) => upd(l.key, { preco: v })} className="h-10 text-right" />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-xs uppercase tracking-wide text-slate-500 md:hidden">Desc %</span>
                    <NumberInput min={0} max={tetoDesconto(l.max)} step={0.1} value={l.pct} onChange={(v) => upd(l.key, { pct: v })} placeholder="Desc %" title={`Desconto máximo: ${tetoDesconto(l.max)}%`} className="h-10 w-full text-right text-sm" />
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="block text-xs uppercase tracking-wide text-slate-500 md:hidden">Total</span>
                    <p className="truncate text-right text-sm font-semibold">{formatCurrency(c.total)}</p>
                    {c.desc > 0 && <p className="text-xs text-emerald-700">- {formatCurrency(c.desc)} ({l.pct}%)</p>}
                  </div>
                </div>
                <Button type="button" size="icon" variant="ghost" className="absolute right-2 top-2 h-8 w-8 shrink-0 p-0 text-slate-400 hover:text-destructive md:static md:justify-self-center" title="Remover item" onClick={() => setLinhas((p) => p.filter((x) => x.key !== l.key))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ); })}
          </div>
        </section>
        <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-4 h-fit lg:sticky lg:top-4">
          <div><Label>Cliente (opcional)</Label>
            <SmartSelect placeholder="Consumidor" options={clientes.map((c) => ({ id: c.id, label: c.nome, sublabel: c.cpf_cnpj || "" }))} value={cliente?.id} onSelect={(o) => setCliente(clientes.find((c) => c.id === o.id) || null)} onClear={() => setCliente(null)} />
          </div>
          <div><Label>Pagamento</Label>
            <Select value={forma} onValueChange={setForma}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FORMAS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select>
          </div>
          {forma === "dinheiro" && <div><Label>Valor recebido</Label><MoneyInput value={recebido} onChange={setRecebido} className="h-10 pl-7 pr-3" /></div>}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between text-destructive"><span>Descontos</span><span>-{formatCurrency(descontos)}</span></div>
            <div className="mt-2 flex items-center justify-between border-t pt-2 text-xl font-bold text-primary"><span>Total</span><span>{formatCurrency(total)}</span></div>
            {troco > 0 && <div className="flex justify-between rounded-md bg-primary/10 px-2 py-1 font-semibold"><span>Troco</span><span>{formatCurrency(troco)}</span></div>}
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Button
              className="w-full gap-2"
              size="lg"
              disabled={saving || linhas.length === 0 || !cliente}
              title={!cliente ? "Selecione um cliente cadastrado para emitir a nota fiscal" : undefined}
              onClick={() => finalizar(true)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Emitir Nota Fiscal
            </Button>
            <Button variant="outline" className="w-full gap-2" size="lg" disabled={saving || linhas.length === 0} onClick={() => finalizar(false)}>
              <Receipt className="h-4 w-4" />
              Emitir Recibo
            </Button>
          </div>
          {linhas.length === 0 && <p className="text-center text-xs text-muted-foreground">Adicione pelo menos um produto</p>}
          {linhas.length > 0 && !cliente && <p className="text-center text-xs text-muted-foreground">Selecione um cliente cadastrado para emitir a nota fiscal.</p>}
          <p className="text-center text-xs text-muted-foreground">Venda sem nota fiscal</p>
          <p className="text-center text-[11px] text-muted-foreground">Pressione <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">F2</kbd> para finalizar com recibo.</p>
        </aside>
      </div>
    </div>
  );
}
