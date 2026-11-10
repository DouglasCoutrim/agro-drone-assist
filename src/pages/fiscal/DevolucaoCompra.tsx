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
import { FiscalHeader, ItensSelecaoTable, ResultadoEmissao, fiscalErrorMessage, type ItemSelecao } from "@/components/fiscal/fiscalShared";

const db = supabase as any;

export default function DevolucaoCompra() {
  const { organization } = useOrganization();
  const [notas, setNotas] = useState<any[]>([]);
  const [nota, setNota] = useState<any>(null);
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [nf, setNf] = useState<any>(null);

  useEffect(() => {
    if (!organization?.id) return;
    db.from("notas_compra").select("id, numero, serie, chave_acesso, valor_total, data_emissao, fornecedores(nome), notas_compra_itens(id, descricao, quantidade, quantidade_devolvida)")
      .eq("organization_id", organization.id).order("data_emissao", { ascending: false }).limit(300)
      .then(({ data }: any) => setNotas(data || []));
  }, [organization?.id]);

  const itens: ItemSelecao[] = (nota?.notas_compra_itens || []).map((i: any) => ({ id: i.id, descricao: i.descricao, total: Number(i.quantidade), devolvido: Number(i.quantidade_devolvida || 0) }));
  const saldoNota = (n: any) => (n.notas_compra_itens || []).reduce((s: number, i: any) => s + Math.max(0, Number(i.quantidade) - Number(i.quantidade_devolvida || 0)), 0);

  const emitir = async () => {
    if (!nota || busy || nf) return;
    const sel = Object.entries(qtd).filter(([, q]) => q > 0).map(([nota_compra_item_id, quantidade]) => ({ nota_compra_item_id, quantidade }));
    if (!sel.length) return setErro("Informe a quantidade de pelo menos um item.");
    setBusy(true); setErro("");
    const { data, error } = await supabase.functions.invoke("emitir-devolucao-compra", { body: { action: "emitir", nota_compra_id: nota.id, itens: sel, motivo: motivo || undefined } });
    setBusy(false);
    let nfId = data?.nf_id;
    if (!nfId && error) { try { nfId = (await (error as any)?.context?.clone?.().json())?.nf_id; } catch { /* */ } }
    if (nfId) { const { data: row } = await supabase.from("nota_fiscal_emitida").select("*").eq("id", nfId).maybeSingle(); setNf(row); }
    if (error || data?.error) return setErro(await fiscalErrorMessage(error, data, "Não foi possível emitir a devolução."));
    toast.success("Devolução enviada para a SEFAZ. O estoque sai quando a nota for autorizada.");
  };

  return (
    <MainLayout>
      <div className="space-y-4 py-6">
        <FiscalHeader titulo="Devolução de compra" operacao="NF-e de saída para o fornecedor" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">{nota ? `Nota ${nota.numero} · ${nota.fornecedores?.nome || "sem fornecedor"}` : "Escolha a nota de compra"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!nota ? (
                <div className="divide-y rounded-md border max-h-[60vh] overflow-y-auto">
                  {notas.map((n) => (
                    <button key={n.id} onClick={() => { setNota(n); setQtd({}); setErro(""); setNf(null); setMotivo(""); }} className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm hover:bg-muted/40">
                      <span><span className="font-mono">{n.numero}</span> <span className="text-muted-foreground">· {n.fornecedores?.nome || "sem fornecedor"}</span></span>
                      <span className="text-right"><span className="font-medium">{formatCurrency(Number(n.valor_total || 0))}</span><br /><span className="text-xs text-muted-foreground">Saldo devolvível: {saldoNota(n)}</span></span>
                    </button>
                  ))}
                  {!notas.length && <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma nota de compra importada.</p>}
                </div>
              ) : (<>
                <ItensSelecaoTable itens={itens} qtd={qtd} onChange={setQtd} disabled={busy || !!nf} />
                <Input placeholder="Motivo (opcional)" value={motivo} maxLength={500} disabled={busy || !!nf} onChange={(e) => setMotivo(e.target.value)} />
                {erro && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive whitespace-pre-line">{erro}</p>}
                <div className="flex flex-wrap justify-between gap-2">
                  <Button variant="outline" disabled={busy} onClick={() => { setNota(null); setNf(null); setErro(""); }}>Trocar nota</Button>
                  <Button onClick={emitir} disabled={busy || !!nf}>
                    {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando para a SEFAZ...</> : <><Send className="h-4 w-4 mr-2" />Emitir devolução</>}
                  </Button>
                </div>
              </>)}
            </CardContent>
          </Card>
          <div>{nf ? <ResultadoEmissao nf={nf} funcao="emitir-devolucao-compra" onAtualizado={setNf} /> :
            <Card><CardContent className="p-4 text-sm text-muted-foreground">O resultado da emissão aparece aqui.</CardContent></Card>}</div>
        </div>
      </div>
    </MainLayout>
  );
}
