import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

export interface PaymentData {
  valor: number;
  forma_pagamento: string;
  observacoes?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  osNumero?: string;
  valorSugerido?: number;
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
  valorSugerido = 0,
  loading,
  onConfirm,
  onSkip,
  title = "Confirmar Recebimento",
  description = "Registre o valor recebido para lançar no Financeiro.",
}: Props) {
  const [valor, setValor] = useState<number>(valorSugerido);
  const [forma, setForma] = useState<string>("pix");
  const [obs, setObs] = useState<string>("");

  useEffect(() => {
    if (open) {
      setValor(valorSugerido || 0);
      setForma("pix");
      setObs("");
    }
  }, [open, valorSugerido]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription>
            {osNumero ? `OS ${osNumero} — ` : ""}{description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label>Valor Recebido (R$)</Label>
            <NumberInput value={valor} onChange={(v) => setValor(Number(v) || 0)} />
            {valorSugerido > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Sugerido: {formatCurrency(valorSugerido)}
              </p>
            )}
          </div>
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
          <Button
            onClick={() => onConfirm({ valor, forma_pagamento: forma, observacoes: obs })}
            disabled={loading || valor <= 0}
            className="gradient-primary"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
            Confirmar e Lançar no Financeiro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
