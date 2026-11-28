import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PainelOrdenavel } from "@/components/layout/PainelOrdenavel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarClock, TrendingDown, Plus, Wallet, Loader2, Edit, Trash2, Search, CreditCard, AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useConfirm";
import { useOrganization } from "@/hooks/useOrganization";
import { formatCurrency, formatDate, getErrorMessage, todayDateInput } from "@/lib/formatters";
import { PremiumCard } from "@/components/premium/PremiumCard";
import { KpiCard } from "@/components/premium/KpiCard";
import { PremiumTable } from "@/components/premium/PremiumTable";
import { SearchableInput } from "@/components/ui/searchable-input";

type ContaPagar = {
  id: string;
  organization_id: string;
  descricao: string;
  fornecedor_id: string | null;
  categoria: string;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: "pendente" | "atrasado" | "pago";
  recorrente: boolean;
  periodicidade: string | null;
  observacoes: string | null;
  valor_pago: number;
  saldo: number;
  created_at: string;
};

type Fornecedor = { id: string; nome: string };

const CATEGORIAS_PADRAO = [
  "Fornecedores",
  "Compra de Peças",
  "Aluguel",
  "Energia",
  "Água",
  "Internet/Telefone",
  "Folha de Pagamento",
  "Impostos",
  "Combustível",
  "Manutenção",
  "Marketing",
  "Geral",
];

const FORMAS_PAGAMENTO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "outro", label: "Outro" },
];

// A tabela contas_pagar não está no types.ts gerado (colunas novas), então as
// consultas passam por `any` propositalmente.
const contasTable = () => supabase.from("contas_pagar" as any) as any;

export default function ContasPagar() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { organization } = useOrganization();

  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_PADRAO);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("abertos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContaPagar | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [viewing, setViewing] = useState<ContaPagar | null>(null);

  const [pagarConta, setPagarConta] = useState<ContaPagar | null>(null);
  const [pagarValor, setPagarValor] = useState(0);
  const [pagarForma, setPagarForma] = useState("pix");
  const [pagarObs, setPagarObs] = useState("");
  const [pagarLoading, setPagarLoading] = useState(false);

  const [formData, setFormData] = useState({
    descricao: "",
    fornecedor_id: "",
    categoria: "",
    valor: 0,
    data_vencimento: todayDateInput(),
    recorrente: false,
    periodicidade: "mensal",
    observacoes: "",
  });

  useEffect(() => {
    if (!organization?.id) return;
    fetchContas();
    fetchFornecedores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  const fetchContas = async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      const { data, error } = await contasTable()
        .select("*")
        .eq("organization_id", organization.id)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      const lista = (data || []) as unknown as ContaPagar[];
      setContas(lista);
      const usadas = [...new Set(lista.map((c) => c.categoria).filter(Boolean))].sort();
      setCategorias([...new Set([...usadas, ...CATEGORIAS_PADRAO])]);
    } catch (error) {
      toast.error("Erro ao carregar contas a pagar: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchFornecedores = async () => {
    if (!organization?.id) return;
    const { data } = await supabase
      .from("fornecedores")
      .select("id, nome")
      .eq("organization_id", organization.id)
      .eq("ativo", true)
      .order("nome");
    setFornecedores((data || []) as Fornecedor[]);
  };

  const fornecedorNome = (id: string | null) => fornecedores.find((f) => f.id === id)?.nome || "";

  const resetForm = () => {
    setFormData({
      descricao: "",
      fornecedor_id: "",
      categoria: "",
      valor: 0,
      data_vencimento: todayDateInput(),
      recorrente: false,
      periodicidade: "mensal",
      observacoes: "",
    });
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.descricao.trim()) { toast.error("Preencha a descrição"); return; }
    if (!formData.valor || formData.valor <= 0) { toast.error("Informe um valor válido"); return; }
    if (!formData.data_vencimento) { toast.error("Informe o vencimento"); return; }
    if (!organization?.id || !user) { toast.error("Usuário não autenticado"); return; }
    setFormLoading(true);
    try {
      const payload: any = {
        organization_id: organization.id,
        descricao: formData.descricao.trim(),
        fornecedor_id: formData.fornecedor_id || null,
        categoria: formData.categoria.trim() || "Geral",
        valor: formData.valor,
        data_vencimento: formData.data_vencimento,
        recorrente: formData.recorrente,
        periodicidade: formData.recorrente ? formData.periodicidade : null,
        observacoes: formData.observacoes.trim() || null,
      };
      if (editing) {
        const { error } = await contasTable().update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Conta atualizada!");
      } else {
        const { error } = await contasTable().insert({ ...payload, created_by: user.id });
        if (error) throw error;
        toast.success("Conta cadastrada!");
      }
      setDialogOpen(false);
      resetForm();
      fetchContas();
    } catch (error) {
      toast.error("Erro ao salvar: " + getErrorMessage(error));
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (conta: ContaPagar) => {
    setEditing(conta);
    setFormData({
      descricao: conta.descricao,
      fornecedor_id: conta.fornecedor_id || "",
      categoria: conta.categoria || "",
      valor: Number(conta.valor),
      data_vencimento: conta.data_vencimento?.split("T")[0] || todayDateInput(),
      recorrente: conta.recorrente,
      periodicidade: conta.periodicidade || "mensal",
      observacoes: conta.observacoes || "",
    });
    setViewing(null);
    setDialogOpen(true);
  };

  const handleDelete = async (conta: ContaPagar) => {
    if (!await confirm({
      title: "Excluir conta a pagar",
      description: `"${conta.descricao}" será removida. Esta ação não pode ser desfeita.`,
      variant: "destructive",
      confirmText: "Excluir",
    })) return;
    try {
      const { error } = await contasTable().delete().eq("id", conta.id);
      if (error) throw error;
      toast.success("Conta excluída!");
      setViewing(null);
      fetchContas();
    } catch (error) {
      toast.error("Erro ao excluir: " + getErrorMessage(error));
    }
  };

  const abrirPagar = (conta: ContaPagar) => {
    setPagarConta(conta);
    setPagarValor(Number(conta.saldo ?? conta.valor));
    setPagarForma("pix");
    setPagarObs("");
    setViewing(null);
  };

  const confirmarPagamento = async () => {
    if (!pagarConta) return;
    const valor = Number(pagarValor) || 0;
    if (valor <= 0) { toast.error("Informe um valor válido"); return; }
    setPagarLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)("pagar_conta_pagar", {
        p_conta_id: pagarConta.id,
        p_valor: valor,
        p_forma: pagarForma,
        p_obs: pagarObs.trim() || null,
      });
      if (error) throw error;
      const saldo = Number(data?.saldo ?? 0);
      if (saldo > 0.005) {
        toast.success("Pagamento parcial registrado", { description: `Saldo em aberto: ${formatCurrency(saldo)}.` });
      } else {
        toast.success("Conta quitada!");
      }
      setPagarConta(null);
      fetchContas();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPagarLoading(false);
    }
  };

  const handleReabrir = async (conta: ContaPagar) => {
    if (!await confirm({
      title: "Reabrir conta",
      description: "Os pagamentos registrados serão zerados e a conta volta para em aberto.",
      confirmText: "Reabrir",
    })) return;
    try {
      const { error } = await contasTable()
        .update({ valor_pago: 0, data_pagamento: null, status: "pendente" })
        .eq("id", conta.id);
      if (error) throw error;
      toast.success("Conta reaberta!");
      setViewing(null);
      fetchContas();
    } catch (error) {
      toast.error("Erro ao reabrir: " + getErrorMessage(error));
    }
  };

  const kpis = useMemo(() => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    let aVencer = 0, atrasado = 0, pagoMes = 0, totalAberto = 0;
    for (const c of contas) {
      const saldo = Number(c.saldo ?? c.valor);
      if (c.status === "pago") {
        if (c.data_pagamento && new Date(c.data_pagamento + "T00:00:00") >= startOfMonth) {
          pagoMes += Number(c.valor_pago ?? c.valor);
        }
        continue;
      }
      totalAberto += saldo;
      if (c.status === "atrasado") atrasado += saldo;
      else aVencer += saldo;
    }
    return { aVencer, atrasado, pagoMes, totalAberto };
  }, [contas]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return contas.filter((c) => {
      if (statusFilter !== "todas") {
        if (statusFilter === "abertos" && c.status === "pago") return false;
        if (statusFilter !== "abertos" && c.status !== statusFilter) return false;
      }
      if (!term) return true;
      return (
        c.descricao.toLowerCase().includes(term) ||
        (c.categoria || "").toLowerCase().includes(term) ||
        fornecedorNome(c.fornecedor_id).toLowerCase().includes(term)
      );
    });
  }, [contas, searchTerm, statusFilter, fornecedores]);

  const statusBadge = (status: string) => {
    if (status === "pago") return <Badge className="text-[10px] h-5 bg-success/15 text-success border-success/30" variant="outline">Pago</Badge>;
    if (status === "atrasado") return <Badge variant="destructive" className="text-[10px] h-5">Atrasado</Badge>;
    return <Badge variant="secondary" className="text-[10px] h-5">Pendente</Badge>;
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <PremiumCard delay={0}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full">
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" />Contas a Pagar</h1>
              <p className="text-xs text-muted-foreground">Despesas, fornecedores e vencimentos</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gradient-primary shadow-soft w-full sm:w-auto"><Plus className="mr-1.5 h-3.5 w-3.5" />Nova Conta</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
                <DialogHeader className="shrink-0">
                  <DialogTitle className="text-base">{editing ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}</DialogTitle>
                  <DialogDescription className="text-xs">Cadastre uma despesa com o vencimento</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-4 pb-24">
                  <form id="conta-pagar-form" onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2 space-y-1.5">
                        <Label className="text-xs">Descrição *</Label>
                        <Input className="h-9" value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} placeholder="Ex: Compra de hélices, Aluguel do galpão" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Fornecedor</Label>
                        <Select value={formData.fornecedor_id || "nenhum"} onValueChange={(v) => setFormData({ ...formData, fornecedor_id: v === "nenhum" ? "" : v })}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nenhum">Sem fornecedor</SelectItem>
                            {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Categoria</Label>
                        <SearchableInput value={formData.categoria} onChange={(v) => setFormData({ ...formData, categoria: v })} suggestions={categorias} placeholder="Ex: Fornecedores" onAddNew={(v) => setFormData({ ...formData, categoria: v })} addNewLabel="Usar" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Valor (R$) *</Label>
                        <NumberInput step="0.01" className="h-9" value={formData.valor} onChange={(v) => setFormData({ ...formData, valor: v })} placeholder="0,00" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Vencimento *</Label>
                        <Input type="date" className="h-9" value={formData.data_vencimento} onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })} required />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border px-3 h-9">
                        <Label className="text-xs">Recorrente</Label>
                        <Switch checked={formData.recorrente} onCheckedChange={(v) => setFormData({ ...formData, recorrente: v })} />
                      </div>
                      {formData.recorrente && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Periodicidade</Label>
                          <Select value={formData.periodicidade} onValueChange={(v) => setFormData({ ...formData, periodicidade: v })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="semanal">Semanal</SelectItem>
                              <SelectItem value="mensal">Mensal</SelectItem>
                              <SelectItem value="anual">Anual</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="sm:col-span-2 space-y-1.5">
                        <Label className="text-xs">Observações</Label>
                        <Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={2} />
                      </div>
                    </div>
                  </form>
                </div>
                <DialogFooter className="shrink-0 border-t bg-background">
                  <div className="flex justify-end gap-2 w-full p-4">
                    <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit" form="conta-pagar-form" size="sm" className="gradient-primary" disabled={formLoading}>
                      {formLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{editing ? "Salvar" : "Criar"}
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </PremiumCard>

        <PainelOrdenavel tela="contas-pagar">

        {/* KPIs */}
        <div data-bloco="indicadores" data-rotulo="Indicadores" className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <KpiCard label="A vencer" value={formatCurrency(kpis.aVencer)} trend="em aberto" icon={CalendarClock} color="blue" delay={0} />
          <KpiCard label="Atrasado" value={formatCurrency(kpis.atrasado)} trend="vencido" icon={AlertTriangle} color="red" delay={100} />
          <KpiCard label="Pago no mês" value={formatCurrency(kpis.pagoMes)} trend="liquidado" icon={CheckCircle2} color="green" delay={200} />
          <KpiCard label="Total em aberto" value={formatCurrency(kpis.totalAberto)} trend="a pagar" icon={Wallet} color="orange" delay={300} />
        </div>

        {/* Filtros */}
        <div data-bloco="filtros" data-rotulo="Busca e filtros">
        <PremiumCard delay={150}>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar descrição, categoria, fornecedor..." className="pl-9 h-9 text-xs bg-muted/30 border-border/50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full sm:w-48 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="abertos">Em aberto</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="atrasado">Atrasadas</SelectItem>
                <SelectItem value="pago">Pagas</SelectItem>
                <SelectItem value="todas">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </PremiumCard>
        </div>

        {/* Tabela */}
        <div data-bloco="contas" data-rotulo="Lista de contas">
        <PremiumCard delay={250} padding="sm">
          <div className="px-1 pb-3 flex items-center gap-1.5">
            <TrendingDown className="h-4 w-4 text-primary" />
            <span className="font-semibold">Contas</span>
            <span className="text-xs text-muted-foreground">({filtered.length})</span>
          </div>
          <PremiumTable
            columns={[
              { key: "vencimento", label: "Vencimento", align: "left" },
              { key: "descricao", label: "Descrição", align: "left" },
              { key: "categoria", label: "Categoria", align: "center" },
              { key: "valor", label: "Valor", align: "right" },
              { key: "saldo", label: "Em aberto", align: "right" },
              { key: "status", label: "Status", align: "center" },
              { key: "actions", label: "", align: "right" },
            ]}
            data={filtered}
            rowKey={(row) => row.id}
            loading={loading}
            emptyMessage={searchTerm || statusFilter !== "abertos" ? "Nenhuma conta encontrada" : "Nenhuma conta a pagar cadastrada"}
            emptyIcon={<CalendarClock className="h-8 w-8" />}
            emptyAction={{ label: "Nova Conta", onClick: () => setDialogOpen(true) }}
            striped
            hoverable
            animateRows
            renderCell={(row: ContaPagar, columnKey) => {
              switch (columnKey) {
                case "vencimento":
                  return <span className={`text-sm font-mono ${row.status === "atrasado" ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{formatDate(row.data_vencimento)}</span>;
                case "descricao":
                  return (
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate max-w-[260px]">{row.descricao}</p>
                      {(fornecedorNome(row.fornecedor_id) || row.recorrente) && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {fornecedorNome(row.fornecedor_id)}{fornecedorNome(row.fornecedor_id) && row.recorrente ? " · " : ""}{row.recorrente ? `recorrente (${row.periodicidade || "mensal"})` : ""}
                        </p>
                      )}
                    </div>
                  );
                case "categoria":
                  return row.categoria ? <Badge variant="secondary" className="text-[10px] h-5">{row.categoria}</Badge> : <span className="text-[11px] text-muted-foreground">-</span>;
                case "valor":
                  return <span className="text-sm font-semibold tabular-nums">{formatCurrency(row.valor)}</span>;
                case "saldo":
                  return row.status === "pago"
                    ? <span className="text-sm text-success tabular-nums">Quitada</span>
                    : <span className="text-sm font-bold text-amber-600 tabular-nums">{formatCurrency(row.saldo ?? row.valor)}</span>;
                case "status":
                  return statusBadge(row.status);
                case "actions":
                  return (
                    <div className="flex items-center justify-end gap-1">
                      {row.status !== "pago" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); abrirPagar(row); }}>
                          <CreditCard className="mr-1 h-3 w-3" />Pagar
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleEdit(row); }}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleDelete(row); }}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  );
                default:
                  return null;
              }
            }}
            onRowClick={(row: ContaPagar) => setViewing(row)}
          />
        </PremiumCard>
        </div>
        </PainelOrdenavel>

        {/* Detalhes */}
        <Dialog open={!!viewing} onOpenChange={(open) => { if (!open) setViewing(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader className="shrink-0"><DialogTitle className="text-base">Detalhes da Conta</DialogTitle></DialogHeader>
            {viewing && (
              <>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Descrição</p><p className="font-bold text-lg">{viewing.descricao}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</p>{statusBadge(viewing.status)}</div>
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Valor</p><p className="font-bold text-lg">{formatCurrency(viewing.valor)}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Já pago</p><p className="text-sm font-medium">{formatCurrency(viewing.valor_pago ?? 0)}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Em aberto</p><p className={`text-sm font-bold ${viewing.status === "pago" ? "text-success" : "text-amber-600"}`}>{viewing.status === "pago" ? formatCurrency(0) : formatCurrency(viewing.saldo ?? viewing.valor)}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Vencimento</p><p className="text-sm font-medium">{formatDate(viewing.data_vencimento)}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pago em</p><p className="text-sm font-medium">{viewing.data_pagamento ? formatDate(viewing.data_pagamento) : "-"}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Categoria</p><p className="text-sm font-medium">{viewing.categoria || "-"}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Fornecedor</p><p className="text-sm font-medium">{fornecedorNome(viewing.fornecedor_id) || "-"}</p></div>
                    {viewing.recorrente && <div className="col-span-2"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Recorrência</p><p className="text-sm font-medium capitalize">{viewing.periodicidade || "mensal"}</p></div>}
                    {viewing.observacoes && <div className="col-span-2"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Observações</p><p className="text-sm whitespace-pre-wrap">{viewing.observacoes}</p></div>}
                  </div>
                </div>
                <DialogFooter className="shrink-0 border-t bg-background">
                  <div className="flex flex-wrap gap-2 justify-end w-full p-4">
                    {viewing.status === "pago" && (
                      <Button variant="outline" size="sm" onClick={() => handleReabrir(viewing)}>
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reabrir
                      </Button>
                    )}
                    {viewing.status !== "pago" && (
                      <Button size="sm" className="gradient-primary" onClick={() => abrirPagar(viewing)}>
                        <CreditCard className="mr-1.5 h-3.5 w-3.5" />Pagar
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleEdit(viewing)}>
                      <Edit className="mr-1.5 h-3.5 w-3.5" />Editar
                    </Button>
                  </div>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Pagar */}
        <Dialog open={!!pagarConta} onOpenChange={(open) => { if (!open) setPagarConta(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" />Registrar pagamento</DialogTitle>
              <DialogDescription>{pagarConta?.descricao}</DialogDescription>
            </DialogHeader>
            {pagarConta && (
              <div className="space-y-3 py-2">
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor da conta</span><span className="font-semibold">{formatCurrency(pagarConta.valor)}</span></div>
                  {Number(pagarConta.valor_pago) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Já pago</span><span>{formatCurrency(pagarConta.valor_pago)}</span></div>}
                  <div className="flex justify-between border-t pt-1"><span className="text-muted-foreground">Em aberto</span><span className="font-semibold">{formatCurrency(pagarConta.saldo ?? pagarConta.valor)}</span></div>
                </div>
                <div>
                  <Label className="text-xs">Valor pago (R$)</Label>
                  <NumberInput value={pagarValor} onChange={(v) => setPagarValor(v)} />
                  <p className="text-[11px] text-muted-foreground mt-1">Pode ser parcial. A conta só fica "Paga" quando zerar.</p>
                </div>
                <div>
                  <Label className="text-xs">Forma de pagamento</Label>
                  <Select value={pagarForma} onValueChange={setPagarForma}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Observação</Label>
                  <Textarea value={pagarObs} onChange={(e) => setPagarObs(e.target.value)} rows={2} placeholder="Referência, nº do comprovante..." />
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPagarConta(null)} disabled={pagarLoading}>Cancelar</Button>
              <Button onClick={confirmarPagamento} disabled={pagarLoading} className="gradient-primary">
                {pagarLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
                Confirmar pagamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
