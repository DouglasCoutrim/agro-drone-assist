import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Wallet,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  FileText,
  Plus,
  Loader2,
  AlertTriangle,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { KpiCard } from "@/components/premium/KpiCard";
import { PremiumCard } from "@/components/premium/PremiumCard";
import { PremiumTable } from "@/components/premium/PremiumTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberInput } from "@/components/ui/number-input";
import { cn } from "@/lib/utils";

const EXPENSE_CATEGORIES = [
  { value: "ferramenta", label: "Ferramentas" },
  { value: "epi", label: "EPIs" },
  { value: "treinamento", label: "Treinamentos" },
  { value: "deslocamento", label: "Deslocamentos" },
  { value: "outros", label: "Outros" },
];

type FinancialData = {
  comissoes_realizadas_mes: number;
  impostos_retidos_mes: number;
  valor_bruto_mes: number;
  os_count: number;
  despesas_mes: number;
  despesas_count: number;
  retencoes_pendentes: number;
  retencoes_count: number;
  retencoes_liberadas_mes: number;
};

type Retention = {
  id: string;
  os_id: string;
  os_numero: string;
  amount: number;
  status: "RETAINED" | "RELEASED_TO_TECH" | "PAID_TO_GOV";
  retained_at: string;
  release_date: string;
  released_at: string | null;
};

type Expense = {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  category: string;
  reference_type: string | null;
  reference_id: string | null;
};

export default function TechnicianFinancialDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinancialData | null>(null);
  const [retentions, setRetentions] = useState<Retention[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);

  // Modal states
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: 0,
    expense_date: new Date().toISOString().split("T")[0],
    category: "ferramenta",
  });
  const [savingExpense, setSavingExpense] = useState(false);

  const fetchFinancialData = async () => {
    if (!user?.id) return;
    try {
      const { data: result, error } = await supabase.rpc("get_technician_financial_dashboard" as any, {
        _tecnico_id: user.id,
      } as any);
      if (error) throw error;
      setData(result as unknown as FinancialData);
    } catch (err: any) {
      console.error("Erro ao buscar dashboard financeiro:", err);
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  };

  const fetchRetentions = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("tax_retention_ledger")
        .select(`
          id,
          os_id,
          amount,
          status,
          retained_at,
          release_date,
          released_at,
          ordens_servico!inner(numero)
        `)
        .eq("technician_id", user.id)
        .order("retained_at", { ascending: false });
      if (error) throw error;
      setRetentions((data || []).map(r => ({
        ...r,
        os_numero: (r.ordens_servico as any)?.numero || "",
      })));
    } catch (err: any) {
      console.error("Erro ao buscar retenções:", err);
    }
  };

  const fetchExpenses = async () => {
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
  };

  useEffect(() => {
    fetchFinancialData();
    fetchRetentions();
    fetchExpenses();
  }, [user?.id]);

  const handleSaveExpense = async () => {
    if (!user?.id) return;
    if (!expenseForm.description.trim() || expenseForm.amount <= 0) {
      toast.error("Preencha descrição e valor");
      return;
    }
    setSavingExpense(true);
    try {
      const payload = {
        technician_id: user.id,
        organization_id: (await supabase.from("profiles").select("organization_id").eq("id", user.id).single()).data?.organization_id,
        description: expenseForm.description,
        amount: expenseForm.amount,
        expense_date: expenseForm.expense_date,
        category: expenseForm.category,
        created_by: user.id,
      };

      if (editingExpense) {
        const { error } = await supabase
          .from("technician_expenses")
          .update(payload)
          .eq("id", editingExpense.id);
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
      fetchFinancialData(); // Atualiza totais
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
      fetchFinancialData();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      description: "",
      amount: 0,
      expense_date: new Date().toISOString().split("T")[0],
      category: "ferramenta",
    });
  };

  const openExpenseDialog = () => {
    setEditingExpense(null);
    resetExpenseForm();
    setShowExpenseDialog(true);
  };

  const getStatusBadge = (status: Retention["status"]) => {
    switch (status) {
      case "RETAINED":
        return <Badge variant="default" className="bg-amber-100 text-amber-800 border-amber-200">Retido</Badge>;
      case "RELEASED_TO_TECH":
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Liberado</Badge>;
      case "PAID_TO_GOV":
        return <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200">Pago ao Gov</Badge>;
    }
  };

  const getStatusIcon = (status: Retention["status"]) => {
    switch (status) {
      case "RETAINED": return <Clock className="h-3.5 w-3.5 text-amber-600" />;
      case "RELEASED_TO_TECH": return <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />;
      case "PAID_TO_GOV": return <FileText className="h-3.5 w-3.5 text-blue-600" />;
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-8 w-8 text-primary" />
            Painel Financeiro
          </h1>
          <p className="text-muted-foreground">
            Comissões, retenções de impostos e despesas pessoais
          </p>
        </div>

        {/* KPIs Principais */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Comissões Realizadas (Mês)"
            value={data?.comissoes_realizadas_mes || 0}
            icon={DollarSign}
            color="green"
            trend={{ value: data?.retencoes_liberadas_mes || 0, label: "Retenções liberadas" }}
            delay={0}
          />
          <KpiCard
            label="Impostos Retidos (Mês)"
            value={data?.impostos_retidos_mes || 0}
            icon={AlertTriangle}
            color="yellow"
            trend={{ value: data?.valor_bruto_mes || 0, label: "Valor bruto antes de impostos" }}
            delay={100}
          />
          <KpiCard
            label="Despesas do Mês"
            value={data?.despesas_mes || 0}
            icon={CreditCard}
            color="red"
            trend={{ value: data?.despesas_count || 0, label: `${data?.despesas_count || 0} lançamento(s)` }}
            delay={200}
          />
          <KpiCard
            label="Retenções Pendentes"
            value={data?.retencoes_pendentes || 0}
            icon={Clock}
            color="blue"
            trend={{ value: data?.retencoes_count || 0, label: `${data?.retencoes_count || 0} item(ns)` }}
            delay={300}
          />
        </div>

        {/* Cards de Detalhamento */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Comissões por papel */}
          <PremiumCard delay={0}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Comissões por Papel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                  <p className="text-xs text-green-700 font-medium">Como Principal</p>
                  <p className="text-xl font-bold text-green-900">{formatCurrency(data?.comissoes_realizadas_mes || 0)}</p>
                  <p className="text-[10px] text-green-600">{data?.os_count || 0} OS(s) finalizada(s)</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <p className="text-xs text-blue-700 font-medium">Como Auxiliar</p>
                  <p className="text-xl font-bold text-blue-900">{formatCurrency(data?.retencoes_liberadas_mes || 0)}</p>
                  <p className="text-[10px] text-blue-600">Retenções liberadas no mês</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Impostos Retidos no Mês
                </p>
                <p className="text-lg font-bold text-amber-900">{formatCurrency(data?.impostos_retidos_mes || 0)}</p>
                <p className="text-[10px] text-amber-600">Vão para o Fundo de Retenção — liberação após 6 meses da conclusão da OS</p>
              </div>
            </CardContent>
          </PremiumCard>

          {/* Resumo de Retenções */}
          <PremiumCard delay={100}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Fundo de Retenção de Impostos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <p className="text-2xl font-bold text-amber-700">{formatCurrency(data?.retencoes_pendentes || 0)}</p>
                  <p className="text-[10px] text-amber-600">Pendentes ({data?.retencoes_count || 0})</p>
                </div>
                <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(data?.retencoes_liberadas_mes || 0)}</p>
                  <p className="text-[10px] text-green-600">Liberadas este mês</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-2xl font-bold text-gray-700">{formatCurrency((data?.retencoes_pendentes || 0) + (data?.retencoes_liberadas_mes || 0))}</p>
                  <p className="text-[10px] text-gray-600">Total no fundo</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Liberação automática 6 meses após a data de conclusão da OS.
                Admin pode liberar antecipadamente se NFS-e for emitida.
              </p>
            </CardContent>
          </PremiumCard>
        </div>

        {/* Tabela de Retenções */}
        <PremiumCard delay={200}>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Histórico de Retenções
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PremiumTable
              data={retentions}
              columns={[
                { key: "os_numero", label: "OS" },
                { key: "retained_at", label: "Retido em" },
                { key: "release_date", label: "Liberação prevista" },
                { key: "amount", label: "Valor", align: "right" },
                { key: "status", label: "Status" },
              ]}
              renderCell={(r: Retention, key) => {
                switch (key) {
                  case "os_numero": return <span className="font-mono text-sm">{r.os_numero}</span>;
                  case "retained_at": return formatDate(r.retained_at);
                  case "release_date": return formatDate(r.release_date);
                  case "amount": return formatCurrency(r.amount);
                  case "status": return getStatusBadge(r.status);
                  default: return null;
                }
              }}
              emptyMessage="Nenhuma retenção encontrada"
              emptyAction={{
                label: "Ver como emitir NFS-e",
                onClick: () => toast.info("Funcionalidade de emissão NFS-e em desenvolvimento"),
              }}
            />
          </CardContent>
        </PremiumCard>

        {/* Despesas do Técnico */}
        <PremiumCard delay={300}>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-red-500" />
              Minhas Despesas
            </CardTitle>
            <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
              <DialogTrigger asChild>
                <Button className="gradient-primary shadow-medium" size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Nova Despesa
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingExpense ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
                  <DialogDescription>Registre despesas pessoais (ferramentas, EPIs, treinamentos, etc.)</DialogDescription>
                </DialogHeader>
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
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setShowExpenseDialog(false); setEditingExpense(null); resetExpenseForm(); }}>
                    Cancelar
                  </Button>
                  <Button className="gradient-primary" onClick={handleSaveExpense} disabled={savingExpense}>
                    {savingExpense ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {editingExpense ? "Atualizar" : "Adicionar"}
                  </Button>
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
                { key: "actions", label: "", align: "right" },
              ]}
              renderCell={(e: Expense, key) => {
                switch (key) {
                  case "expense_date": return formatDate(e.expense_date);
                  case "description": return e.description;
                  case "category": return (
                  <Badge variant="secondary" className="text-[10px]">
                    {EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label || e.category}
                  </Badge>
                  );
                  case "amount": return formatCurrency(e.amount);
                  case "actions": return (
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEditExpense(e)} className="h-7 w-7">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteExpense(e.id)} className="h-7 w-7 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  );
                  default: return null;
                }
              }}
              loading={expensesLoading}
              emptyMessage="Nenhuma despesa registrada"
              emptyAction={{
                label: "Adicionar primeira despesa",
                onClick: openExpenseDialog,
              }}
            />
          </CardContent>
        </PremiumCard>
      </div>
    </MainLayout>
  );
}

// Import missing icons
import { Save, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";