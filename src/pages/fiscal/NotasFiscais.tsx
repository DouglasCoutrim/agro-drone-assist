import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { formatCurrency } from "@/lib/formatters";
import { FiscalHeader, NotaStatusBadge } from "@/components/fiscal/fiscalShared";

const TIPOS: Record<string, string> = {
  venda: "NF-e de venda", devolucao_venda: "Devolução de venda", devolucao_compra: "Devolução de compra", nfse: "NFS-e", nfe: "NF-e",
};

function tipoNota(n: any): string {
  if (n.tipo === "nfse") return "nfse";
  if (n.tipo_operacao) return n.tipo_operacao;
  if (n.venda_id) return "venda";
  if (String(n.referencia || "").includes("-devcompra-")) return "devolucao_compra";
  return "nfe";
}

const hoje = new Date();
const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);

export default function NotasFiscais() {
  const { organization } = useOrganization();
  const [notas, setNotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [de, setDe] = useState(inicioMes);
  const [ate, setAte] = useState(hoje.toISOString().slice(0, 10));
  const [sel, setSel] = useState<any>(null);

  useEffect(() => {
    if (!organization?.id) return;
    setLoading(true);
    let q = supabase.from("nota_fiscal_emitida").select("*").eq("organization_id", organization.id)
      .gte("created_at", `${de}T00:00:00`).lte("created_at", `${ate}T23:59:59`).order("created_at", { ascending: false }).limit(500);
    if (status !== "todos") q = q.eq("status", status);
    q.then(({ data }) => { setNotas(data || []); setLoading(false); });
  }, [organization?.id, de, ate, status]);

  const lista = useMemo(() => notas.filter((n) => tipo === "todos" || tipoNota(n) === tipo), [notas, tipo]);

  return (
    <MainLayout>
      <div className="space-y-4 py-6">
        <FiscalHeader titulo="Notas Fiscais" operacao="Todas as notas emitidas" />
        <Card>
          <CardContent className="grid gap-3 pt-6 sm:grid-cols-4">
            <div className="space-y-1.5"><Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="todos">Todos</SelectItem>{Object.entries(TIPOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {["processando", "autorizado", "rejeitado", "cancelado"].map((s) => <SelectItem key={s} value={s}><NotaStatusBadge status={s} /></SelectItem>)}
                </SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr><th className="p-3 text-left">Número</th><th className="p-3 text-left">Tipo</th><th className="p-3 text-left">Cliente / fornecedor</th><th className="p-3 text-left">Data</th><th className="p-3 text-right">Valor</th><th className="p-3 text-left">Status</th></tr>
                </thead>
                <tbody>
                  {lista.map((n) => (
                    <tr key={n.id} className="border-t cursor-pointer hover:bg-muted/40" onClick={() => setSel(n)}>
                      <td className="p-3 font-mono">{n.numero || "-"}</td>
                      <td className="p-3">{TIPOS[tipoNota(n)]}</td>
                      <td className="p-3">{n.cliente_nome || "-"}</td>
                      <td className="p-3">{new Date(n.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="p-3 text-right">{formatCurrency(Number(n.valor_total || 0))}</td>
                      <td className="p-3"><NotaStatusBadge status={n.status} /></td>
                    </tr>
                  ))}
                  {!lista.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma nota no período.</td></tr>}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="overflow-y-auto">
          {sel && (<>
            <SheetHeader><SheetTitle>{TIPOS[tipoNota(sel)]} {sel.numero || ""}</SheetTitle></SheetHeader>
            <div className="mt-4 space-y-3 text-sm">
              <NotaStatusBadge status={sel.status} />
              <p><span className="text-muted-foreground">Cliente / fornecedor: </span>{sel.cliente_nome || "-"}</p>
              <p><span className="text-muted-foreground">CPF/CNPJ: </span>{sel.cliente_cpf_cnpj || "-"}</p>
              <p><span className="text-muted-foreground">Valor: </span>{formatCurrency(Number(sel.valor_total || 0))}</p>
              <p><span className="text-muted-foreground">Ambiente: </span>{sel.ambiente === "producao" ? "Produção" : "Homologação"}</p>
              {sel.chave_acesso && <p className="font-mono text-xs break-all"><span className="text-muted-foreground font-sans">Chave: </span>{sel.chave_acesso}</p>}
              {sel.protocolo && <p><span className="text-muted-foreground">Protocolo: </span>{sel.protocolo}</p>}
              {sel.motivo_rejeicao && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive">{sel.motivo_rejeicao}</p>}
              <div className="flex gap-2">
                {sel.xml_url && <Button size="sm" variant="outline" asChild><a href={sel.xml_url} target="_blank" rel="noreferrer">XML</a></Button>}
                {sel.pdf_url && <Button size="sm" variant="outline" asChild><a href={sel.pdf_url} target="_blank" rel="noreferrer">DANFE</a></Button>}
              </div>
            </div>
          </>)}
        </SheetContent>
      </Sheet>
    </MainLayout>
  );
}
