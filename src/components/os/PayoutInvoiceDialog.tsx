"use client";

import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, KeyRound, Loader2, MessageCircle, Receipt, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { formatCurrency, formatDate, getErrorMessage } from "@/lib/formatters";
import { gerarFaturaSaquePDF, compartilharFaturaSaquePDF } from "@/lib/payout-invoice-pdf";
import {
  fetchPayoutInvoiceItems, usePayoutInvoices, type OSStatementItem,
} from "@/hooks/useTechnicianFinancials";

interface PayoutInvoiceDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** OS selecionadas para entrar na fatura. */
  osIds: string[];
  /** Linhas do extrato correspondentes, para a prévia. */
  items: OSStatementItem[];
  pixKey?: string | null;
  pixKeyType?: string | null;
  tecnicoNome?: string | null;
  tecnicoTelefone?: string | null;
  onCreated?: () => void;
}

interface Criada {
  id: string;
  numero: string;
  total: number;
}

const totalSelecionado = (items: OSStatementItem[]) =>
  items.reduce((soma, i) => soma + Number(i.comissao || 0), 0);

export function PayoutInvoiceDialog({
  open, onOpenChange, osIds, items, pixKey, pixKeyType, tecnicoNome, tecnicoTelefone, onCreated,
}: PayoutInvoiceDialogProps) {
  const { user } = useAuth();
  const { config: empresa } = useEmpresaConfig();
  const { createInvoice, sendInvoice } = usePayoutInvoices();

  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [criada, setCriada] = useState<Criada | null>(null);

  const total = useMemo(() => totalSelecionado(items), [items]);
  const temPix = Boolean(pixKey && pixKey.trim());

  const fechar = (v: boolean) => {
    if (!v) {
      setCriada(null);
      setNotes("");
    }
    onOpenChange(v);
  };

  const gerar = async () => {
    if (!temPix) {
      toast.error("Cadastre sua chave PIX antes de gerar a fatura de saque.");
      return;
    }
    setBusy(true);
    try {
      const resultado = await createInvoice(osIds, notes.trim() || undefined);
      setCriada({ id: resultado.id, numero: resultado.numero, total: Number(resultado.total) || 0 });
      onCreated?.();
      toast.success(`Fatura ${resultado.numero} criada como rascunho.`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const baixarPdf = async () => {
    if (!criada) return;
    setBusy(true);
    try {
      const itens = await fetchPayoutInvoiceItems(criada.id);
      const doc = await gerarFaturaSaquePDF({
        invoice: {
          numero: criada.numero, status: "rascunho", total: criada.total,
          period_start: items[items.length - 1]?.data_conclusao ?? null,
          period_end: items[0]?.data_conclusao ?? null,
          pix_key: pixKey, pix_key_type: pixKeyType, notes,
        },
        items: itens.map((i) => ({
          description: i.description, reference_date: i.reference_date,
          amount: Number(i.amount) || 0, kind: i.kind, snapshot: i.snapshot as Record<string, unknown>,
        })),
        empresa: {
          nome: empresa.nome_empresa, cnpj: empresa.cnpj, telefone: empresa.telefone,
          endereco: empresa.endereco, logo_url: empresa.logo_url,
        },
        tecnico: { nome: tecnicoNome || user?.email || "Técnico", telefone: tecnicoTelefone },
      });
      doc.save(`fatura-saque-${criada.numero}.pdf`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const enviarWhatsapp = async () => {
    if (!criada) return;
    setBusy(true);
    try {
      const itens = await fetchPayoutInvoiceItems(criada.id);
      const doc = await gerarFaturaSaquePDF({
        invoice: {
          numero: criada.numero, status: "rascunho", total: criada.total,
          period_start: itens[itens.length - 1]?.reference_date ?? null,
          period_end: itens[0]?.reference_date ?? null,
          pix_key: pixKey, pix_key_type: pixKeyType, notes,

        },
        items: itens.map((i) => ({
          description: i.description, reference_date: i.reference_date,
          amount: Number(i.amount) || 0, kind: i.kind, snapshot: i.snapshot as Record<string, unknown>,
        })),
        empresa: {
          nome: empresa.nome_empresa, cnpj: empresa.cnpj, telefone: empresa.telefone,
          endereco: empresa.endereco, logo_url: empresa.logo_url,
        },
        tecnico: { nome: tecnicoNome || user?.email || "Técnico", telefone: tecnicoTelefone },
      });
      const msg =
        `Fatura de saque *${criada.numero}* — ${empresa.nome_empresa}\n\n` +
        `Total: *${formatCurrency(criada.total)}*\n` +
        `Chave PIX: ${pixKey}\n` +
        `${itens.length} lançamento(s)`;
      await compartilharFaturaSaquePDF(doc, `fatura-saque-${criada.numero}.pdf`, msg);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const enviarParaEmpresa = async () => {
    if (!criada) return;
    setBusy(true);
    try {
      await sendInvoice(criada.id);
      toast.success(`Fatura ${criada.numero} enviada para a empresa.`);
      onCreated?.();
      fechar(false);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            {criada ? `Fatura ${criada.numero}` : "Gerar fatura de saque"}
          </DialogTitle>
          <DialogDescription>
            {criada
              ? "Baixe o PDF, envie por WhatsApp ou envie para a empresa aprovar o pagamento."
              : "Confira as OS e o total antes de criar a fatura. Os valores ficam congelados como retrato."}
          </DialogDescription>
        </DialogHeader>

        {!temPix && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Cadastre sua chave PIX no cartão do topo do painel antes de gerar a fatura de saque.</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_90px] gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>OS</span>
              <span className="text-right">Comissão</span>
            </div>
            <div className="divide-y divide-border/40">
              {items.map((i) => (
                <div key={i.os_id} className="grid grid-cols-[1fr_90px] gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-mono">#{i.os_numero}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{formatDate(i.data_conclusao)}</span>
                  </span>
                  <span className="text-right font-mono tabular-nums">{formatCurrency(Number(i.comissao || 0))}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-2.5">
              <span className="text-sm font-semibold">Total ({items.length} OS)</span>
              <span className="font-mono text-base font-bold text-primary">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">PIX</span>
            <span className="font-medium">{pixKey ? `${pixKeyType || "chave"}: ${pixKey}` : "não cadastrado"}</span>
          </div>

          {!criada && (
            <div className="space-y-1.5">
              <Label htmlFor="payout-notes">Observação para a empresa (opcional)</Label>
              <Textarea
                id="payout-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: referente às OS entregues em novembro."
              />
            </div>
          )}

          {criada && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Fatura {criada.numero} criada como rascunho — total {formatCurrency(criada.total)}.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          {!criada ? (
            <>
              <Button variant="outline" onClick={() => fechar(false)} disabled={busy}>Cancelar</Button>
              <Button className="gradient-primary" onClick={gerar} disabled={busy || !temPix || osIds.length === 0}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Receipt className="mr-1.5 h-4 w-4" />}
                Gerar fatura
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={baixarPdf} disabled={busy}>
                <Download className="mr-1.5 h-4 w-4" /> Baixar PDF
              </Button>
              <Button variant="outline" onClick={enviarWhatsapp} disabled={busy}>
                <MessageCircle className="mr-1.5 h-4 w-4" /> Enviar por WhatsApp
              </Button>
              <Button className="gradient-primary" onClick={enviarParaEmpresa} disabled={busy}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                Enviar para a empresa
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
