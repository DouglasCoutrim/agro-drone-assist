import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Copy, Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Exact server message for handled function errors, including the list of validation problems. */
export async function fiscalErrorMessage(error: any, data: any, fallback: string): Promise<string> {
  let body = data;
  if (error?.context instanceof Response) {
    try { body = await error.context.clone().json(); } catch { /* corpo sem JSON */ }
  }
  const problemas: string[] = Array.isArray(body?.problemas) ? body.problemas : [];
  if (problemas.length) return problemas.join("\n");
  return (typeof body?.error === "string" && body.error) || error?.message || fallback;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  processando: { label: "Processando", cls: "bg-warning/15 text-warning border-warning/30" },
  autorizado: { label: "Autorizada", cls: "bg-success/15 text-success border-success/30" },
  rejeitado: { label: "Rejeitada", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  denegado: { label: "Denegada", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  cancelado: { label: "Cancelada", cls: "bg-muted text-muted-foreground line-through" },
};

export function NotaStatusBadge({ status }: { status?: string | null }) {
  const s = STATUS[String(status || "rascunho").toLowerCase()] || { label: status || "-", cls: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
}

export function ResultadoEmissao({ nf, funcao, onAtualizado }: { nf: any; funcao: string; onAtualizado: (nf: any) => void }) {
  const [busy, setBusy] = useState(false);
  if (!nf) return null;
  const consultar = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke(funcao, { body: { action: "consultar", nf_id: nf.id } });
    setBusy(false);
    if (error || data?.error) return toast.error(await fiscalErrorMessage(error, data, "Não foi possível consultar a nota."));
    if (data?.nf) onAtualizado(data.nf);
  };
  const copiar = () => { navigator.clipboard.writeText(nf.chave_acesso); toast.success("Chave copiada"); };
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Resultado</CardTitle>
        <NotaStatusBadge status={nf.status} />
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div><p className="text-xs text-muted-foreground">Número</p><p className="font-medium">{nf.numero || "aguardando"}{nf.serie ? ` / série ${nf.serie}` : ""}</p></div>
        {nf.chave_acesso && (
          <div>
            <p className="text-xs text-muted-foreground">Chave de acesso</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs break-all flex-1">{nf.chave_acesso}</p>
              <Button size="icon" variant="ghost" aria-label="Copiar chave" onClick={copiar}><Copy className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
        {nf.motivo_rejeicao && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive whitespace-pre-line">{nf.motivo_rejeicao}</p>}
        <div className="flex flex-wrap gap-2">
          {nf.xml_url && <Button size="sm" variant="outline" asChild><a href={nf.xml_url} target="_blank" rel="noreferrer"><Download className="h-4 w-4 mr-1" />XML</a></Button>}
          {nf.pdf_url && <Button size="sm" variant="outline" asChild><a href={nf.pdf_url} target="_blank" rel="noreferrer"><FileText className="h-4 w-4 mr-1" />DANFE</a></Button>}
          {nf.status === "processando" && (
            <Button size="sm" variant="outline" onClick={consultar} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}Atualizar status
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export type ItemSelecao = { id: string; descricao: string; total: number; devolvido: number };

export function ItensSelecaoTable({ itens, qtd, onChange, disabled }: {
  itens: ItemSelecao[]; qtd: Record<string, number>; onChange: (q: Record<string, number>) => void; disabled?: boolean;
}) {
  const set = (id: string, v: number, saldo: number) => onChange({ ...qtd, [id]: Math.min(saldo, Math.max(0, v)) });
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr><th className="p-2 w-8" /><th className="p-2 text-left">Descrição</th><th className="p-2 text-right">Vendido</th><th className="p-2 text-right">Devolvido</th><th className="p-2 text-right">Saldo</th><th className="p-2 text-right w-28">Quantidade</th></tr>
        </thead>
        <tbody>
          {itens.map((i) => {
            const saldo = Math.max(0, Number(i.total) - Number(i.devolvido || 0));
            const marcado = (qtd[i.id] || 0) > 0;
            return (
              <tr key={i.id} className="border-t">
                <td className="p-2"><Checkbox checked={marcado} disabled={disabled || saldo <= 0} onCheckedChange={(c) => set(i.id, c ? saldo : 0, saldo)} /></td>
                <td className="p-2">{i.descricao}</td>
                <td className="p-2 text-right font-mono">{i.total}</td>
                <td className="p-2 text-right font-mono">{i.devolvido || 0}</td>
                <td className="p-2 text-right font-mono">{saldo}</td>
                <td className="p-2"><Input type="number" min={0} max={saldo} step="1" className="h-8 text-right" disabled={disabled || saldo <= 0}
                  value={qtd[i.id] ?? ""} onChange={(e) => set(i.id, Number(e.target.value) || 0, saldo)} /></td>
              </tr>
            );
          })}
          {!itens.length && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhum item.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function FiscalHeader({ titulo, operacao }: { titulo: string; operacao: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6 text-primary" />{titulo}</h1>
      <p className="text-sm text-muted-foreground">Fiscal › {operacao}</p>
    </div>
  );
}
