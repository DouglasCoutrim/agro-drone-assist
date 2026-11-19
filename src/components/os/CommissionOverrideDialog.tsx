import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Loader2, SlidersHorizontal, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, getErrorMessage } from "@/lib/formatters";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  osId: string | null;
  osNumero?: string | null;
  /** Comissão gravada hoje na OS (já inclui o ajuste, quando existe). */
  comissaoAtual?: number | null;
  /** Ajuste manual gravado, quando existe. */
  override?: number | null;
  motivoAtual?: string | null;
  /** Comissão que a regra calcula hoje — referência para o administrador. */
  calculada?: number | null;
  /** Saldo a dividir da OS, para avisar quando o valor passa do saldo. */
  saldo?: number | null;
  onSaved?: () => void;
}

export function CommissionOverrideDialog({
  open,
  onOpenChange,
  osId,
  osNumero,
  comissaoAtual,
  override,
  motivoAtual,
  calculada,
  saldo,
  onSaved,
}: Props) {
  const [valor, setValor] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValor(Number(override ?? calculada ?? comissaoAtual ?? 0));
    setMotivo(motivoAtual ?? "");
  }, [open, override, calculada, comissaoAtual, motivoAtual]);

  const temAjuste = override != null;
  const acimaDoSaldo = saldo != null && valor > Number(saldo) + 0.004;
  const invalido = valor < 0;

  const enviar = async (novoValor: number | null) => {
    if (!osId) return;
    setSalvando(true);
    try {
      const { error } = await supabase.rpc("ajustar_comissao_os", {
        _os_id: osId,
        _valor: novoValor,
        _motivo: novoValor === null ? null : motivo.trim() || null,
      });
      if (error) throw error;
      toast.success(
        novoValor === null
          ? "Ajuste removido — a comissão voltou a seguir a regra."
          : "Comissão ajustada!",
      );
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!salvando) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" /> Ajustar comissão
          </DialogTitle>
          <DialogDescription>
            {osNumero ? `OS ${osNumero} — ` : ""}
            O valor informado aqui substitui a comissão calculada pela regra. Somente administradores podem alterar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1 text-sm">
            {calculada != null && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Comissão pela regra</span>
                <span className="font-mono tabular-nums">{formatCurrency(calculada)}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{temAjuste ? "Comissão ajustada hoje" : "Comissão gravada"}</span>
              <span className="font-mono tabular-nums">{formatCurrency(Number(comissaoAtual) || 0)}</span>
            </div>
            {saldo != null && (
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Saldo a dividir</span>
                <span className="font-mono tabular-nums">{formatCurrency(Number(saldo) || 0)}</span>
              </div>
            )}
          </div>

          <div>
            <Label>Valor da comissão (R$)</Label>
            <NumberInput value={valor} onChange={(v) => setValor(Number(v) || 0)} />
            {invalido && (
              <p className="mt-1 flex items-start gap-1.5 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> O valor não pode ser negativo.
              </p>
            )}
            {!invalido && acimaDoSaldo && (
              <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                O valor fica acima do saldo a dividir — a diferença sai da parte da loja.
              </p>
            )}
          </div>

          <div>
            <Label>Motivo do ajuste (opcional)</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Ex: acerto com o técnico pelo serviço extra"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              O motivo aparece no rateio da OS, para o técnico entender o valor.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {temAjuste && (
            <Button variant="ghost" onClick={() => enviar(null)} disabled={salvando}>
              <Undo2 className="mr-1.5 h-4 w-4" /> Remover ajuste
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => enviar(valor)} disabled={salvando || invalido} className="gradient-primary">
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SlidersHorizontal className="mr-2 h-4 w-4" />}
            Salvar ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
