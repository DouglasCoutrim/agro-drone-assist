"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Wallet,
  CreditCard,
  FileText,
  Plus,
  Loader2,
  AlertTriangle,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Save,
  Edit,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { KpiCard } from "@/components/premium/KpiCard";
import { PremiumCard } from "@/components/premium/PremiumCard";
import { PremiumTable } from "@/components/premium/PremiumTable";
import { cn } from "@/lib/utils";
import { useTechnicianFinancials, useTechnicianOSStatement, type PeriodRange, type OSStatementItem, type Expense } from "@/hooks/useTechnicianFinancials";
import { PeriodFilterBar } from "@/components/os/PeriodFilterBar";
import { OSStatementTable } from "@/components/os/OSStatementTable";

const EXPENSE_CATEGORIES = [
  { value: "ferramenta", label: "Ferramentas" },
  { value: "epi", label: "EPIs" },
  { value: "treinamento", label: "Treinamentos" },
  { value: "deslocamento", label: "Deslocamentos" },
  { value: "outros", label: "Outros" },
];

export default function TechnicianFinancialDashboard() {
  const { user } = useAuth();
  
  // Hooks principais
  const { 
    data: financialData, 
    loading: financialLoading, 
    error: financialError,
    period, 
    changePeriod, 
    refetch: refetchFinancials,
    kpis 
  } = useTechnicianFinancials();
  
  const { 
    data: osStatement, 
    loading: statementLoading,
    refetch: refetchStatement 
  } = useTechnicianOSStatement(period);

  // Estados locais
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

  // Buscar despesas (não filtradas por período - são históricas)
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

  // Efeito inicial
  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleSaveExpense = async () => {
    if (!user?.id) return;
    if (!expenseForm.description.trim() || expenseForm.amount <= 0) {
      toast.error("Preencha descrição e valor");
      return;
    }
    setSavingExpense(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      
      const payload = {
        technician_id: user.id,
        organization_id: profile?.organization_id,
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

  if (financialLoading) {
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
        {/* Header com filtro de período */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Wallet className="h-8 w-8 text-primary" />
              Painel Financeiro
            </h1>
            <p className="text-muted-foreground">
              Comissões e despesas pessoais
            </p>
          </div>
          <PeriodFilterBar period={period} onChange={(range) => changePeriod(range.preset, range.start, range.end)} />
        </div>

        {/* KPIs Principais - Atualizados conforme spec Phase 3 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Ganhos com Serviços"
            value={kpis.ganhos_servicos}
            icon={DollarSign}
            color="green"
            trend={{ value: financialData?.os_count || 0, label: `${financialData?.os_count || 0} OS(s) no período` }}
            delay={0}
          />
          <KpiCard
            label="Despesas Pessoais"
            value={kpis.despesas_pessoais}
            icon={CreditCard}
            color="red"
            trend={{ value: financialData?.despesas_count || 0, label: `${financialData?.despesas_count || 0} lançamento(s)` }}
            delay={100}
          />
          <KpiCard
            label="Saldo Líquido do Técnico"
            value={kpis.saldo_liquido}
            icon={kpis.saldo_liquido >= 0 ? TrendingUp : TrendingDown}
            color={kpis.saldo_liquido >= 0 ? "green" : "red"}
            trend={{ 
              value: kpis.ganhos_servicos - kpis.despesas_pessoais, 
              label: `Ganhos: ${formatCurrency(kpis.ganhos_servicos)} - Despesas: ${formatCurrency(kpis.despesas_pessoais)}` 
            }}
            delay={200}
          />
        </div>

        {/* Extrato de Serviços - NOVO conforme spec Phase 3 */}
        <OSStatementTable data={osStatement} loading={statementLoading} />

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
                </div>
                <DialogFooter className="shrink-0 border-t bg-background">
                  <div className="flex justify-end gap-2 w-full p-4">
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
                  case "category": return <Badge variant="secondary" className="text-[10px]">{EXPENSE_CATEGORIES.find(c => c.value === item.category)?.label || item.category}</Badge>;
                  case "amount": return formatCurrency(item.amount);
                  case "actions": return <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEditExpense(item)} className="h-7 w-7"><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteExpense(item.id)} className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>;
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