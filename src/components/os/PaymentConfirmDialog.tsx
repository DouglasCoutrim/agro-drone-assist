import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

export interface PaymentData {
  valor: number;
  forma_pagamento: string;
  observacoes?: string;
  /** Recebimento parcial: fica saldo em aberto (conta a receber). */
  parcial?: boolean;
  equipamento?: string;
  condicoes_pagamento?: string;
  vencimento?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  osNumero?: string;
  /** Total da OS (valor_final/orçamento/itens). */
  valorTotal?: number;
  /** Já recebido nesta OS antes deste lançamento. */
  valorJaPago?: number;
  /** Equipamento da OS, usado para pré-preencher "Equipamento retirado". */
  osEquipamento?: string;
  loading?: boolean;
  onConfirm: (data: PaymentData) => void | Promise<void>;
  onSkip?: () => void | Promise<void>;
  title?: string;
  description?: string;
}

const FORMAS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "outro", label: "Outro" },
];

export function PaymentConfirmDialog({
  open,
  onOpenChange,
  osNumero,
  valorTotal = 0,
  valorJaPago = 0,
  osEquipamento = "",
  loading,
  onConfirm,
  onSkip,
  title = "Confirmar Recebimento",
  description = "Registre o valor recebido para lançar no Financeiro.",
}: Props) {
  const [parcial, setParcial] = useState(false);
  const [valor, setValor] = useState<number>(0);
  const [forma, setForma] = useState<string>("pix");
  const [equipamento, setEquipamento] = useState<string>("");
  const [condicoes, setCondicoes] = useState<string>("");
  const [vencimento, setVencimento] = useState<string>("");
  const [obs, setObs] = useState<string>("");

  const saldoAtual = Math.max(0, Math.round((valorTotal - valorJaPago) * 100) / 100);

  useEffect(() => {
    if (open) {
      setParcial(false);
      setValor(saldoAtual);
      setForma("pix");
      setEquipamento(osEquipamento || "");
      setCondicoes("");
      setVencimento("");
      setObs("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, valorTotal, valorJaPago, osEquipamento]);

  const valorEfetivo = parcial ? Number(valor) || 0 : saldoAtual;
  const saldoDepois = Math.max(0, Math.round((saldoAtual - valorEfetivo) * 100) / 100);
  const bloqueia = loading || valorEfetivo <= 0;

  const confirmar = () => {
    onConfirm({
      valor: valorEfetivo,
      forma_pagamento: forma,
      observacoes: obs,
      parcial: parcial && saldoDepois > 0,
      equipamento: parcial ? equipamento : undefined,
      condicoes_pagamento: parcial ? condicoes : undefined,
      vencimento: parcial && vencimento ? vencimento : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription>
            {osNumero ? `OS ${osNumero} — ` : ""}{description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {valorTotal > 0 && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total da OS</span>
                <span className="font-semibold">{formatCurrency(valorTotal)}</span>
              </div>
              {valorJaPago > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Já recebido</span>
                  <span className="font-medium">{formatCurrency(valorJaPago)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t pt-1">
                <span className="text-muted-foreground">Em aberto</span>
                <span className="font-semibold">{formatCurrency(saldoAtual)}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Recebimento parcial</p>
              <p className="text-xs text-muted-foreground">O cliente paga uma parte e o restante fica em aberto.</p>
            </div>
            <Switch checked={parcial} onCheckedChange={setParcial} />
          </div>

          <div>
            <Label>Valor Recebido (R$)</Label>
            <NumberInput
              value={parcial ? valor : saldoAtual}
              onChange={(v) => setValor(parcial ? v : saldoAtual)}
              disabled={!parcial}
            />
            {!parcial && saldoAtual > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Quita o saldo de {formatCurrency(saldoAtual)}.</p>
            )}
          </div>

          {parcial && (
            <>
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm flex items-center justify-between">
                <span className="text-muted-foreground">Saldo em aberto</span>
                <span className="font-semibold text-amber-600">{formatCurrency(saldoDepois)}</span>
              </div>
              <div>
                <Label>Equipamento retirado</Label>
                <Input
                  value={equipamento}
                  onChange={(e) => setEquipamento(e.target.value)}
                  placeholder="Ex.: Drone Agras T40 — série 12345"
                />
              </div>
              <div>
                <Label>Condições de pagamento do restante</Label>
                <Textarea
                  value={condicoes}
                  onChange={(e) => setCondicoes(e.target.value)}
                  rows={2}
                  placeholder="Ex.: restante em 2x sem juros, 30 e 60 dias"
                />
              </div>
              <div>
                <Label>Vencimento do saldo</Label>
                <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
              </div>
            </>
          )}

          <div>
            <Label>Forma de Pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMAS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações (opcional)</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Ex: Pagamento parcial, desconto à vista, etc." />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {onSkip && (
            <Button variant="ghost" onClick={onSkip} disabled={loading}>
              Sem cobrança
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={bloqueia} className="gradient-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
            {parcial ? "Registrar parcial" : "Confirmar e Lançar no Financeiro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
