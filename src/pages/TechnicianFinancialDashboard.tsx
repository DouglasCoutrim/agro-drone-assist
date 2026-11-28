"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PainelOrdenavel } from "@/components/layout/PainelOrdenavel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Wallet, CreditCard, Plus, Loader2, DollarSign, TrendingUp, TrendingDown,
  Save, Edit, Trash2, KeyRound, Clock, CheckCircle2, AlertTriangle, Receipt, Download,
  MessageCircle, XCircle, Calendar,
} from "lucide-react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { dateOnlyToIso, formatCurrency, formatDate, getErrorMessage, todayDateInput } from "@/lib/formatters";
import { KpiCard } from "@/components/premium/KpiCard";
import { PremiumCard } from "@/components/premium/PremiumCard";
import { PremiumTable } from "@/components/premium/PremiumTable";
import { cn } from "@/lib/utils";
import {
  useTechnicianFinancials, useTechnicianOSStatement, usePayoutInvoices, getPeriodRange,
  formatPeriodLabel, fetchPayoutInvoiceItems, savePixKey,
  type PeriodRange, type OSStatementItem, type Expense, type SituacaoComissao,
  type PayoutInvoice,
} from "@/hooks/useTechnicianFinancials";
import { PeriodFilterBar } from "@/components/os/PeriodFilterBar";
import { OSStatementTable } from "@/components/os/OSStatementTable";
import { PayoutInvoiceDialog } from "@/components/os/PayoutInvoiceDialog";
import { gerarFaturaSaquePDF, compartilharFaturaSaquePDF } from "@/lib/payout-invoice-pdf";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const EXPENSE_CATEGORIES = [
  { value: "ferramenta", label: "Ferramentas" },
  { value: "epi", label: "EPIs" },
  { value: "treinamento", label: "Treinamentos" },
  { value: "deslocamento", label: "Deslocamentos" },
  { value: "outros", label: "Outros" },
];

const PIX_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave aleatória" },
];

const SITUACOES: {
  key: SituacaoComissao;
  label: string;
  descricao: string;
  icon: typeof Clock;
  valor: keyof ReturnType<typeof situacaoFields>;
  cor: string;
  anel: string;
}[] = [
  {
    key: "A_RECEBER", label: "A receber", descricao: "Cliente pagou, fatura ainda não paga",
    icon: CheckCircle2, valor: "a_receber", cor: "text-emerald-600", anel: "border-emerald-500/40",
  },
  {
    key: "AGUARDANDO_CLIENTE", label: "Aguardando cliente", descricao: "OS concluída, cliente ainda não pagou",
    icon: Clock, valor: "aguardando_cliente", cor: "text-amber-600", anel: "border-amber-500/40",
  },
  {
    key: "RECEBIDO", label: "Recebido", descricao: "Você já recebeu (fatura paga)",
    icon: DollarSign, valor: "recebido", cor: "text-blue-600", anel: "border-blue-500/40",
  },
  {
    key: "DIVERGENCIA", label: "Divergência", descricao: "Você recebeu, mas o cliente não pagou",
    icon: AlertTriangle, valor: "divergencia", cor: "text-destructive", anel: "border-destructive/40",
  },
];

/** Nomes das chaves usadas em `SITUACOES[].valor`. */
function situacaoFields() {
  return {
    a_receber: 0, a_receber_count: 0,
    aguardando_cliente: 0, aguardando_cliente_count: 0,
    recebido: 0, recebido_count: 0,
    divergencia: 0, divergencia_count: 0,
  };
}

const STATUS_FATURA: Record<string, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground" },
  enviada: { label: "Enviada", className: "border-amber-500/30 bg-amber-500/15 text-amber-700" },
  paga: { label: "Paga", className: "border-blue-500/30 bg-blue-500/15 text-blue-700" },
  recusada: { label: "Recusada", className: "border-destructive/30 bg-destructive/15 text-destructive" },
  cancelada: { label: "Cancelada", className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground" },
};

export default function TechnicianFinancialDashboard() {
  const { user } = useAuth();
  const { config: empresa } = useEmpresaConfig();

  const [period, setPeriod] = useState<PeriodRange>(() => getPeriodRange("mes"));
  const [situacaoFiltro, setSituacaoFiltro] = useState<SituacaoComissao | null>(null);

  const { data: financialData, loading: financialLoading, refetch: refetchFinancials } = useTechnicianFinancials(period);
  const { data: osStatement, loading: statementLoading, refetch: refetchStatement } = useTechnicianOSStatement(period);
  const { invoices, adjustments, refetch: refetchInvoices, cancelInvoice } = usePayoutInvoices();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    description: "", amount: 0, expense_date: todayDateInput(), category: "ferramenta",
  });
  const [savingExpense, setSavingExpense] = useState(false);

  const [pixTipo, setPixTipo] = useState("cpf");
  const [pixChave, setPixChave] = useState("");
  const [savingPix, setSavingPix] = useState(false);

  const [faturaAberta, setFaturaAberta] = useState<{ osIds: string[]; items: OSStatementItem[] } | null>(null);
  const [perfil, setPerfil] = useState<{ nome: string; telefone: string | null } | null>(null);

  const fetchExpenses = useCallback(async () => {
    if (!user?.id) return;
    setExpensesLoading(true);
    try {
      const { data, error } = await supabase
        .from("technician_expenses")
        .select("*")
        .eq("technician_id", user.id)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      setExpenses(data || []);
    } catch (err: any) {
      console.error("Erro ao buscar despesas:", err);
    } finally {
      setExpensesLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("nome, telefone").eq("id", user.id).maybeSingle()
      .then(({ data }) => setPerfil(data ? { nome: data.nome, telefone: data.telefone } : null));
  }, [user?.id]);

  useEffect(() => {
    if (financialData) {
      setPixChave(financialData.pix_key || "");
      setPixTipo(financialData.pix_key_type || "cpf");
    }
  }, [financialData]);

  const recarregarTudo = useCallback(() => {
    refetchFinancials();
    refetchStatement();
    refetchInvoices();
  }, [refetchFinancials, refetchStatement, refetchInvoices]);

  const handleSavePix = async () => {
    if (!user?.id) return;
    setSavingPix(true);
    try {
      await savePixKey(user.id, pixTipo, pixChave);
      toast.success("Chave PIX salva");
      refetchFinancials();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSavingPix(false);
    }
  };

  const handleSaveExpense = async () => {
    if (!user?.id) return;
    if (!expenseForm.description.trim() || expenseForm.amount <= 0) {
      toast.error("Preencha descrição e valor");
      return;
    }
    setSavingExpense(true);
    try {
      const { data: profile } = await supabase
        .from("profiles").select("organization_id").eq("id", user.id).single();

      const payload = {
        technician_id: user.id,
        organization_id: profile?.organization_id,
        description: expenseForm.description,
        amount: expenseForm.amount,
        expense_date: dateOnlyToIso(expenseForm.expense_date),
        category: expenseForm.category,
        created_by: user.id,
      };

      if (editingExpense) {
        const { error } = await supabase.from("technician_expenses").update(payload).eq("id", editingExpense.id);
        if (error) throw error;
        toast.success("Despesa atualizada");
      } else {
        const { error } = await supabase.from("technician_expenses").insert(payload);
        if (error) throw error;
        toast.success("Despesa adicionada");
      }
      setShowExpenseDialog(false);
      setEditingExpense(null);
      resetExpenseForm();
      fetchExpenses();
      refetchFinancials();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "tente novamente"));
    } finally {
      setSavingExpense(false);
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      description: expense.description,
      amount: expense.amount,
      expense_date: expense.expense_date.split("T")[0],
      category: expense.category,
    });
    setShowExpenseDialog(true);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Excluir esta despesa?")) return;
    try {
      const { error } = await supabase.from("technician_expenses").delete().eq("id", id);
      if (error) throw error;
      toast.success("Despesa excluída");
      fetchExpenses();
      refetchFinancials();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  const resetExpenseForm = () => {
    setExpenseForm({ description: "", amount: 0, expense_date: todayDateInput(), category: "ferramenta" });
  };

  const openExpenseDialog = () => {
    setEditingExpense(null);
    resetExpenseForm();
    setShowExpenseDialog(true);
  };

  const extratoFiltrado = useMemo(
    () => (situacaoFiltro ? osStatement.filter((i) => i.situacao === situacaoFiltro) : osStatement),
    [osStatement, situacaoFiltro],
  );

  /** Ajustes de comissão que ainda não entraram em nenhuma fatura. */
  const ajustesPendentes = useMemo(
    () => adjustments.filter((a) => !a.invoice_id && !a.settled_at),
    [adjustments],
  );

  const serie = useMemo(
    () =>
      (financialData?.serie_diaria || []).map((p) => ({
        dia: `${p.dia.slice(8, 10)}/${p.dia.slice(5, 7)}`,
        total: Number(p.total) || 0,
      })),
    [financialData?.serie_diaria],
  );

  const gerarPdfFatura = async (invoice: PayoutInvoice) => {
    try {
      const itens = await fetchPayoutInvoiceItems(invoice.id);
      const doc = await gerarFaturaSaquePDF({
        invoice: {
          numero: invoice.numero, status: invoice.status, total: Number(invoice.total) || 0,
          period_start: invoice.period_start, period_end: invoice.period_end,
          pix_key: invoice.pix_key, pix_key_type: invoice.pix_key_type, notes: invoice.notes,
          sent_at: invoice.sent_at, paid_at: invoice.paid_at, rejected_reason: invoice.rejected_reason,
        },
        items: itens.map((i) => ({
          description: i.description, reference_date: i.reference_date,
          amount: Number(i.amount) || 0, kind: i.kind, snapshot: i.snapshot as Record<string, unknown>,
        })),
        empresa: {
          nome: empresa.nome_empresa, cnpj: empresa.cnpj, telefone: empresa.telefone,
          endereco: empresa.endereco, logo_url: empresa.logo_url,
        },
        tecnico: { nome: perfil?.nome || user?.email || "Técnico", telefone: perfil?.telefone },
      });
      doc.save(`fatura-saque-${invoice.numero}.pdf`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const enviarWhatsappFatura = async (invoice: PayoutInvoice) => {
    try {
      const itens = await fetchPayoutInvoiceItems(invoice.id);
      const doc = await gerarFaturaSaquePDF({
        invoice: {
          numero: invoice.numero, status: invoice.status, total: Number(invoice.total) || 0,
          period_start: invoice.period_start, period_end: invoice.period_end,
          pix_key: invoice.pix_key, pix_key_type: invoice.pix_key_type, notes: invoice.notes,
          sent_at: invoice.sent_at, paid_at: invoice.paid_at, rejected_reason: invoice.rejected_reason,
        },
        items: itens.map((i) => ({
          description: i.description, reference_date: i.reference_date,
          amount: Number(i.amount) || 0, kind: i.kind, snapshot: i.snapshot as Record<string, unknown>,
        })),
        empresa: {
          nome: empresa.nome_empresa, cnpj: empresa.cnpj, telefone: empresa.telefone,
          endereco: empresa.endereco, logo_url: empresa.logo_url,
        },
        tecnico: { nome: perfil?.nome || user?.email || "Técnico", telefone: perfil?.telefone },
      });
      const msg =
        `Fatura de saque *${invoice.numero}* — ${empresa.nome_empresa}\n\n` +
        `Total: *${formatCurrency(Number(invoice.total) || 0)}*\n` +
        `Chave PIX: ${invoice.pix_key || "não informada"}`;
      await compartilharFaturaSaquePDF(doc, `fatura-saque-${invoice.numero}.pdf`, msg);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const handleCancelarFatura = async (invoice: PayoutInvoice) => {
    if (!confirm(`Cancelar a fatura ${invoice.numero}? As OS voltam a ficar disponíveis.`)) return;
    try {
      await cancelInvoice(invoice.id);
      toast.success(`Fatura ${invoice.numero} cancelada`);
      recarregarTudo();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  if (financialLoading && !financialData) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  const situacoes = financialData ?? situacaoFields();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 data-tour="financeiro-tecnico-page" className="flex items-center gap-2 text-3xl font-bold">
              <Wallet className="h-8 w-8 text-primary" />
              Painel Financeiro
            </h1>
            <p className="text-muted-foreground">
              Comissões, faturas de saque e despesas · {formatPeriodLabel(period)}
            </p>
          </div>
          <PeriodFilterBar period={period} onChange={setPeriod} />
        </div>

        <PainelOrdenavel tela="tecnico-financeiro">

        {/* Chave PIX */}
        <div data-bloco="pix" data-rotulo="Chave PIX para recebimento">
        <PremiumCard delay={0}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-5 w-5 text-primary" /> Chave PIX para recebimento
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full space-y-1.5 sm:w-40">
              <Label>Tipo</Label>
              <Select value={pixTipo} onValueChange={setPixTipo}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {PIX_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>Chave</Label>
              <Input
                value={pixChave}
                onChange={(e) => setPixChave(e.target.value)}
                placeholder="Sua chave PIX"
                className="h-10"
              />
            </div>
            <Button className="gradient-primary" onClick={handleSavePix} disabled={savingPix}>
              {savingPix ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </CardContent>
          {!financialData?.pix_key && (
            <p className="flex items-center gap-1.5 px-6 pb-6 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" /> A chave PIX é obrigatória para gerar faturas de saque.
            </p>
          )}
        </PremiumCard>
        </div>

        {/* Totais por período */}
        <div data-bloco="totais" data-rotulo="Totais do período" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Comissão produzida no período"
            value={formatCurrency(Number(financialData?.comissao_periodo || 0))}
            icon={DollarSign}
            color="green"
            trend={{ value: financialData?.comissao_periodo_count || 0, label: `${financialData?.comissao_periodo_count || 0} OS(s) concluída(s)` }}
            delay={0}
          />
          <KpiCard
            label="Recebido no período"
            value={formatCurrency(Number(financialData?.recebido_periodo || 0))}
            icon={CheckCircle2}
            color="blue"
            trend={{ value: financialData?.recebido_periodo_count || 0, label: `${financialData?.recebido_periodo_count || 0} OS(s) pagas` }}
            delay={50}
          />
          <KpiCard
            label="Despesas do período"
            value={formatCurrency(Number(financialData?.despesas_periodo || 0))}
            icon={CreditCard}
            color="red"
            trend={{ value: financialData?.despesas_count || 0, label: `${financialData?.despesas_count || 0} lançamento(s)` }}
            delay={100}
          />
          <KpiCard
            label="Saldo líquido do período"
            value={formatCurrency(Number(financialData?.saldo_liquido || 0))}
            icon={Number(financialData?.saldo_liquido || 0) >= 0 ? TrendingUp : TrendingDown}
            color={Number(financialData?.saldo_liquido || 0) >= 0 ? "green" : "red"}
            trend={{
              value: financialData?.comissao_pendente || 0,
              label: `Em andamento: ${formatCurrency(Number(financialData?.comissao_pendente || 0))}`,
            }}
            delay={150}
          />
        </div>

        {/* Quatro situações */}
        <div data-bloco="situacoes" data-rotulo="Situações das comissões" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SITUACOES.map((s) => {
            const Icone = s.icon;
            const valor = Number((situacoes as Record<string, unknown>)[s.valor] || 0);
            const qtd = Number((situacoes as Record<string, unknown>)[`${s.valor}_count`] || 0);
            const ativo = situacaoFiltro === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSituacaoFiltro(ativo ? null : s.key)}
                className={cn(
                  "rounded-lg border border-border bg-card p-4 text-left shadow-soft transition-all hover:border-primary/40",
                  ativo && `ring-2 ring-primary/40 ${s.anel}`,
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={cn("mt-2 font-mono text-xl font-semibold tabular-nums", s.cor)}>
                      {formatCurrency(valor)}
                    </p>
                  </div>
                  <div className={cn("shrink-0 rounded-lg bg-muted/60 p-2.5", s.cor)}>
                    <Icone className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">{s.descricao} · {qtd} OS</p>
              </button>
            );
          })}
        </div>

        {/* Gráfico */}
        <div data-bloco="grafico" data-rotulo="Comissão por dia">
        <PremiumCard delay={0}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5 text-primary" /> Comissão por dia
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {serie.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sem comissão no período selecionado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v) => formatCurrency(Number(v))}
                    width={90}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatCurrency(Number(v)), "Comissão"]}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </PremiumCard>
        </div>

        {/* Extrato */}
        <div data-bloco="extrato" data-rotulo="Extrato de OS" className="space-y-6">
        {situacaoFiltro && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm">
            <span>
              Filtrando por <strong>{SITUACOES.find((s) => s.key === situacaoFiltro)?.label}</strong> — {extratoFiltrado.length} OS
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSituacaoFiltro(null)}>Limpar filtro</Button>
          </div>
        )}
        <OSStatementTable
          data={extratoFiltrado}
          loading={statementLoading}
          onGenerateInvoice={(osIds) =>
            setFaturaAberta({
              osIds,
              items: extratoFiltrado.filter((i) => osIds.includes(i.os_id)),
            })
          }
        />
        </div>

        {/* Ajustes de comissão */}
        {adjustments.length > 0 && (
          <PremiumCard delay={0}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" /> Ajustes de comissão
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border/40">
              {adjustments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{a.description || a.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(a.created_at)}{a.settled_at ? " · incluído em fatura" : " · a incluir em fatura"}
                    </p>
                  </div>
                  <span className={cn("font-mono tabular-nums", Number(a.amount) >= 0 ? "text-emerald-600" : "text-destructive")}>
                    {formatCurrency(Number(a.amount) || 0)}
                  </span>
                </div>
              ))}
            </CardContent>
          </PremiumCard>
        )}

        {/* Faturas */}
        <div data-bloco="faturas" data-rotulo="Faturas de saque">
        <PremiumCard delay={0}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-5 w-5 text-primary" /> Faturas de saque
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma fatura gerada. Selecione as OS no extrato e clique em "Gerar fatura de saque".
              </p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => {
                  const st = STATUS_FATURA[inv.status] ?? STATUS_FATURA.rascunho;
                  const cancelavel = inv.status === "rascunho" || inv.status === "enviada";
                  return (
                    <div key={inv.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">#{inv.numero}</span>
                          <Badge variant="outline" className={cn("text-[10px]", st.className)}>{st.label}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {inv.period_start && inv.period_end
                            ? `${formatDate(inv.period_start)} a ${formatDate(inv.period_end)}`
                            : `Criada em ${formatDate(inv.created_at)}`}
                          {inv.paid_at ? ` · paga em ${formatDate(inv.paid_at)}` : ""}
                          {inv.rejected_reason ? ` · ${inv.rejected_reason}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-semibold text-primary">
                          {formatCurrency(Number(inv.total) || 0)}
                        </span>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => gerarPdfFatura(inv)} title="Baixar PDF">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => enviarWhatsappFatura(inv)} title="Enviar por WhatsApp">
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        {cancelavel && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleCancelarFatura(inv)}
                            title="Cancelar fatura"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </PremiumCard>
        </div>

        {/* Despesas */}
        <div data-bloco="despesas" data-rotulo="Minhas despesas">
        <PremiumCard delay={0}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-5 w-5 text-red-500" /> Minhas Despesas
            </CardTitle>
            <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
              <DialogTrigger asChild>
                <Button className="gradient-primary shadow-medium" size="sm" onClick={openExpenseDialog}>
                  <Plus className="mr-2 h-4 w-4" /> Nova Despesa
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
                <DialogHeader className="shrink-0">
                  <DialogTitle>{editingExpense ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
                  <DialogDescription>Registre despesas pessoais (ferramentas, EPIs, treinamentos, etc.)</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-4 pb-24">
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Descrição *</Label>
                      <Input
                        value={expenseForm.description}
                        onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                        placeholder="Ex: Compra de multímetro digital"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor (R$) *</Label>
                      <NumberInput
                        step="0.01"
                        min="0.01"
                        value={expenseForm.amount}
                        onChange={(v) => setExpenseForm({ ...expenseForm, amount: v })}
                        className="h-10"
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data *</Label>
                      <Input
                        type="date"
                        value={expenseForm.expense_date}
                        onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria *</Label>
                      <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v })}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter className="shrink-0 border-t bg-background">
                  <div className="flex w-full justify-end gap-2 p-4">
                    <Button variant="outline" onClick={() => { setShowExpenseDialog(false); setEditingExpense(null); resetExpenseForm(); }}>
                      Cancelar
                    </Button>
                    <Button className="gradient-primary" onClick={handleSaveExpense} disabled={savingExpense}>
                      {savingExpense ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {editingExpense ? "Atualizar" : "Adicionar"}
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <PremiumTable
              data={expenses}
              columns={[
                { key: "expense_date", label: "Data" },
                { key: "description", label: "Descrição" },
                { key: "category", label: "Categoria" },
                { key: "amount", label: "Valor", align: "right" },
                { key: "actions", label: "" },
              ]}
              renderCell={(item: Expense, key) => {
                switch (key) {
                  case "expense_date": return formatDate(item.expense_date);
                  case "description": return item.description;
                  case "category": return <Badge variant="secondary" className="text-[10px]">{EXPENSE_CATEGORIES.find((c) => c.value === item.category)?.label || item.category}</Badge>;
                  case "amount": return formatCurrency(item.amount);
                  case "actions": return (
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditExpense(item)} className="h-7 w-7"><Edit className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteExpense(item.id)} className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  );
                  default: return null;
                }
              }}
              loading={expensesLoading}
              emptyMessage="Nenhuma despesa registrada"
              emptyAction={{ label: "Adicionar primeira despesa", onClick: openExpenseDialog }}
            />
          </CardContent>
        </PremiumCard>
        </div>
        </PainelOrdenavel>

        <PayoutInvoiceDialog
          open={!!faturaAberta}
          onOpenChange={(v) => !v && setFaturaAberta(null)}
          osIds={faturaAberta?.osIds || []}
          items={faturaAberta?.items || []}
          adjustments={ajustesPendentes}
          pixKey={financialData?.pix_key}
          pixKeyType={financialData?.pix_key_type}
          tecnicoNome={perfil?.nome}
          tecnicoTelefone={perfil?.telefone}
          onCreated={recarregarTudo}
        />
      </div>
    </MainLayout>
  );
}
