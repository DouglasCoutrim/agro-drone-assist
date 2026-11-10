import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";
import { FiscalHeader, ResultadoEmissao, fiscalErrorMessage } from "@/components/fiscal/fiscalShared";

export default function NfeVenda() {
  const { organization } = useOrganization();
  const [vendas, setVendas] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [venda, setVenda] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [nf, setNf] = useState<any>(null);

  useEffect(() => {
    if (!organization?.id) return;
    supabase.from("vendas").select("id, numero, cliente_nome, cliente_cpf_cnpj, valor_total, created_at, status_pagamento")
      .eq("organization_id", organization.id).is("nf_numero", null).neq("status_pagamento", "cancelado")
      .order("created_at", { ascending: false }).limit(300).then(({ data }) => setVendas(data || []));
  }, [organization?.id]);

  const escolher = async (id: string) => {
    setErro(""); setNf(null);
    const { data } = await supabase.from("vendas").select("*, venda_itens(*)").eq("id", id).eq("organization_id", organization!.id).maybeSingle();
    setVenda(data);
  };

  const emitir = async () => {
    if (!venda || busy || nf) return;
    setBusy(true); setErro("");
    const { data, error } = await supabase.functions.invoke("emitir-nfe-venda", { body: { action: "emitir", venda_id: venda.id } });
    setBusy(false);
    if (error || data?.error) {
      const msg = await fiscalErrorMessage(error, data, "Não foi possível emitir a NF-e.");
      setErro(msg);
      const nfId = data?.nf_id;
      if (nfId) { const { data: row } = await supabase.from("nota_fiscal_emitida").select("*").eq("id", nfId).maybeSingle(); setNf(row); }
      return;
    }
    const nfId = data?.nf?.id || data?.nf_id;
    const { data: row } = nfId ? await supabase.from("nota_fiscal_emitida").select("*").eq("id", nfId).maybeSingle() : { data: data?.nf };
    setNf(row || data?.nf);
    setVendas((v) => v.filter((x) => x.id !== venda.id));
    toast.success("NF-e enviada para a SEFAZ.");
  };

  const lista = vendas.filter((v) => !busca || `${v.numero} ${v.cliente_nome}`.toLowerCase().includes(busca.toLowerCase()));

  return (
    <MainLayout>
      <div className="space-y-4 py-6">
        <FiscalHeader titulo="NF-e de venda" operacao="Vendas sem nota fiscal" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">{venda ? `Venda ${venda.numero}` : "Escolha a venda"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!venda ? (<>
                <Input placeholder="Buscar por número ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
                <div className="divide-y rounded-md border max-h-[60vh] overflow-y-auto">
                  {lista.map((v) => (
                    <button key={v.id} onClick={() => escolher(v.id)} className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm hover:bg-muted/40">
                      <span><span className="font-mono">{v.numero}</span> <span className="text-muted-foreground">· {v.cliente_nome}</span></span>
                      <span className="font-medium">{formatCurrency(Number(v.valor_total || 0))}</span>
                    </button>
                  ))}
                  {!lista.length && <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma venda sem nota.</p>}
                </div>
              </>) : (<>
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <p><span className="text-muted-foreground">Cliente: </span>{venda.cliente_nome}</p>
                  <p><span className="text-muted-foreground">CPF/CNPJ: </span>{venda.cliente_cpf_cnpj || "-"}</p>
                  <p><span className="text-muted-foreground">Data: </span>{new Date(venda.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="rounded-md border divide-y text-sm">
                  {(venda.venda_itens || []).map((i: any) => (
                    <div key={i.id} className="flex justify-between gap-2 p-2"><span>{i.quantidade}x {i.nome_produto}</span><span>{formatCurrency(Number(i.valor_total || 0))}</span></div>
                  ))}
                  <div className="flex justify-between p-2 font-semibold"><span>Total</span><span>{formatCurrency(Number(venda.valor_total || 0))}</span></div>
                </div>
                {erro && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive whitespace-pre-line">{erro}</p>}
                <div className="flex flex-wrap justify-between gap-2">
                  <Button variant="outline" disabled={busy} onClick={() => { setVenda(null); setNf(null); setErro(""); }}>Trocar venda</Button>
                  <Button onClick={emitir} disabled={busy || !!nf}>
                    {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando para a SEFAZ...</> : <><Send className="h-4 w-4 mr-2" />Emitir NF-e</>}
                  </Button>
                </div>
              </>)}
            </CardContent>
          </Card>
          <div>{nf ? <ResultadoEmissao nf={nf} funcao="emitir-nfe-venda" onAtualizado={setNf} /> :
            <Card><CardContent className="p-4 text-sm text-muted-foreground">O resultado da emissão aparece aqui.</CardContent></Card>}</div>
        </div>
      </div>
    </MainLayout>
  );
}
