import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { KpiCard, PremiumCard, PremiumCardHeader, PremiumTable } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays, CheckCircle2, CircleDollarSign, Clock, Loader2, ShoppingCart } from "lucide-react";
import { formatCurrency, getErrorMessage } from "@/lib/formatters";
import { toast } from "sonner";

const FORMA_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  debito: "Débito",
  credito: "Crédito",
  pix: "PIX",
  cheque: "Cheque",
  boleto: "Boleto",
  nao_informada: "Não informada",
};

interface ResumoDia {
  data: string;
  quantidade_vendas: number;
  total_recebido: number;
  total_pendente: number;
  por_forma: Record<string, number>;
}

interface FechamentoRegistro {
  id: string;
  data: string;
  total_recebido: number;
  total_pendente: number;
  quantidade_vendas: number;
  dinheiro_contado: number | null;
  observacao: string | null;
  fechado_em: string;
}

interface VendaResumo {
  forma_pagamento: string | null;
  valor_total: number | null;
  status_pagamento: string | null;
}

interface FormaRow {
  forma: string;
  label: string;
  quantidade: number;
  total: number;
}

const hojeISO = () => {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const parseValor = (texto: string) => {
  const limpo = texto.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : 0;
};

export function FechamentoDia() {
  const { organization } = useOrganization();
  const [data, setData] = useState(hojeISO);
  const [resumo, setResumo] = useState<ResumoDia | null>(null);
  const [vendas, setVendas] = useState<VendaResumo[]>([]);
  const [fechamento, setFechamento] = useState<FechamentoRegistro | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dinheiroContado, setDinheiroContado] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [resumoRes, fechamentoRes, vendasRes] = await Promise.all([
        (supabase.rpc as any)("resumo_vendas_dia", { _data: data }),
        (supabase as any).from("fechamentos_dia").select("*").eq("data", data).maybeSingle(),
        (supabase as any).from("vendas").select("forma_pagamento, valor_total, status_pagamento").eq("data_venda", data),
      ]);
      if (resumoRes.error) throw resumoRes.error;
      if (fechamentoRes.error) throw fechamentoRes.error;
      if (vendasRes.error) throw vendasRes.error;
      setResumo((resumoRes.data as ResumoDia) ?? null);
      setFechamento((fechamentoRes.data as FechamentoRegistro) ?? null);
      setVendas((vendasRes.data as VendaResumo[]) ?? []);
    } catch (e) {
      console.error(e);
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const formas = useMemo<FormaRow[]>(() => {
    const mapa = new Map<string, FormaRow>();
    vendas.forEach((venda) => {
      if (venda.status_pagamento !== "pago") return;
      const chave = venda.forma_pagamento || "nao_informada";
      const atual = mapa.get(chave) ?? { forma: chave, label: FORMA_LABELS[chave] ?? chave, quantidade: 0, total: 0 };
      atual.quantidade += 1;
      atual.total += Number(venda.valor_total) || 0;
      mapa.set(chave, atual);
    });
    return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
  }, [vendas]);

  const totalDinheiro = useMemo(
    () => formas.find((f) => f.forma === "dinheiro")?.total ?? 0,
    [formas]
  );

  const confirmarFechamento = async () => {
    if (!organization) {
      toast.error("Não foi possível identificar a empresa do usuário.");
      return;
    }
    setSalvando(true);
    try {
      const { error } = await (supabase as any).from("fechamentos_dia").insert({
        organization_id: organization.id,
        data,
        total_recebido: resumo?.total_recebido ?? 0,
        total_pendente: resumo?.total_pendente ?? 0,
        quantidade_vendas: resumo?.quantidade_vendas ?? 0,
        por_forma: resumo?.por_forma ?? {},
        dinheiro_contado: totalDinheiro > 0 ? parseValor(dinheiroContado) : null,
        observacao: observacao.trim() || null,
      });
      if (error) throw error;
      toast.success("Dia fechado com sucesso.");
      setDialogOpen(false);
      setDinheiroContado("");
      setObservacao("");
      await carregar();
    } catch (e) {
      console.error(e);
      toast.error(getErrorMessage(e));
    } finally {
      setSalvando(false);
    }
  };

  const abrirDialogo = () => {
    setDinheiroContado(totalDinheiro > 0 ? String(totalDinheiro.toFixed(2)).replace(".", ",") : "");
    setObservacao("");
    setDialogOpen(true);
  };

  return (
    <PremiumCard>
      <PremiumCardHeader
        title="Fechamento do dia"
        subtitle="Resumo das vendas do dia e registro do fechamento"
        action={
          fechamento ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />Dia fechado
            </Badge>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="fechamento-data" className="text-xs">Data</Label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="fechamento-data"
              type="date"
              className="h-9 w-44 pl-9"
              value={data}
              max={hojeISO()}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <KpiCard label="Total recebido" value={formatCurrency(resumo?.total_recebido ?? 0)} icon={CircleDollarSign} color="green" />
            <KpiCard label="Total pendente" value={formatCurrency(resumo?.total_pendente ?? 0)} icon={Clock} color="yellow" />
            <KpiCard label="Quantidade de vendas" value={resumo?.quantidade_vendas ?? 0} icon={ShoppingCart} color="blue" />
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">Recebimentos por forma de pagamento</p>
            <PremiumTable
              columns={[
                { key: "label", label: "Forma" },
                { key: "quantidade", label: "Quantidade", align: "center" },
                { key: "total", label: "Total", align: "right" },
              ]}
              data={formas}
              rowKey={(row) => row.forma}
              pagination={false}
              renderCell={(row: FormaRow, key: string) => {
                if (key === "label") return <span className="font-medium">{row.label}</span>;
                if (key === "quantidade") return row.quantidade;
                return formatCurrency(row.total);
              }}
              emptyMessage="Nenhum recebimento registrado nesta data"
            />
          </div>

          {fechamento ? (
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-success" />Dia fechado
              </p>
              <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-3">
                <p>Data: <span className="text-foreground">{new Date(`${fechamento.data}T00:00:00`).toLocaleDateString("pt-BR")}</span></p>
                <p>Fechado em: <span className="text-foreground">{new Date(fechamento.fechado_em).toLocaleString("pt-BR")}</span></p>
                <p>Dinheiro contado: <span className="text-foreground">{fechamento.dinheiro_contado == null ? "-" : formatCurrency(fechamento.dinheiro_contado)}</span></p>
              </div>
              {fechamento.observacao && (
                <p className="mt-2 text-sm text-muted-foreground">Observação: <span className="text-foreground">{fechamento.observacao}</span></p>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <Button className="gradient-primary shadow-medium" onClick={abrirDialogo}>
                <CheckCircle2 className="mr-2 h-4 w-4" />Fechar o dia
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar o dia</DialogTitle>
            <DialogDescription>
              Confira os valores antes de registrar o fechamento de {new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR")}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-1 rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <p className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Total recebido</span>
                <span className="font-semibold">{formatCurrency(resumo?.total_recebido ?? 0)}</span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Quantidade de vendas</span>
                <span className="font-semibold">{resumo?.quantidade_vendas ?? 0}</span>
              </p>
            </div>


            {totalDinheiro > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="dinheiro-contado" className="text-xs">Dinheiro contado</Label>
                <Input
                  id="dinheiro-contado"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={dinheiroContado}
                  onChange={(e) => setDinheiroContado(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Total em dinheiro do dia: {formatCurrency(totalDinheiro)}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="observacao-fechamento" className="text-xs">Observação</Label>
              <Textarea
                id="observacao-fechamento"
                rows={3}
                placeholder="Informações adicionais sobre o fechamento (opcional)"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button className="gradient-primary shadow-medium" onClick={confirmarFechamento} disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar fechamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PremiumCard>
  );
}
