import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DollarSign, TrendingUp, TrendingDown, Plus, Wallet, Receipt, Loader2, Edit, Trash2, Search, MessageCircle, ClipboardList, CreditCard } from "lucide-react";
import { CatalogAutocomplete } from "@/components/ui/catalog-autocomplete";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables, Enums } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useConfirm";
import { useOrganization } from "@/hooks/useOrganization";
import { formatCurrency } from "@/lib/formatters";
import { CobrancaClienteDialog } from "@/components/financeiro/CobrancaClienteDialog";
import { fetchOsComValores, OsCobranca } from "@/lib/os-billing";
import { PremiumCard } from "@/components/premium/PremiumCard";
import { KpiCard } from "@/components/premium/KpiCard";
import { PremiumTable } from "@/components/premium/PremiumTable";

type Transacao = Tables<"financeiro">;


export default function Financeiro() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { organization } = useOrganization();
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<Transacao | null>(null);
  const [viewingTransacao, setViewingTransacao] = useState<Transacao | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [cobrancaOpen, setCobrancaOpen] = useState(false);
  const [cobrancaCliente, setCobrancaCliente] = useState<string | undefined>(undefined);
  const [osAbertas, setOsAbertas] = useState<OsCobranca[]>([]);

  const [formData, setFormData] = useState({
    tipo: "receita" as Enums<"tipo_transacao">,
    descricao: "", valor: 0, categoria: "",
    data_transacao: new Date().toISOString().split('T')[0], observacoes: ""
  });

  useEffect(() => {
    if (!organization?.id) return;
    fetchTransacoes();
    fetchOsComValores(organization.id)
      .then(list => setOsAbertas(list.filter(o => !o.pago && o.valor > 0)))
      .catch(() => { /* silent */ });
  }, [organization?.id]);


  const fetchTransacoes = async () => {
    if (!organization?.id) return;
    try {
      const { data, error } = await supabase.from('financeiro').select('*').eq('organization_id', organization.id).order('data_transacao', { ascending: false });
      if (error) throw error;
      setTransacoes(data || []);
    } catch {
      toast.error('Erro ao carregar transações');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.descricao.trim()) { toast.error('Erro: Preencha a descrição'); return; }
    if (!formData.valor || formData.valor <= 0) { toast.error('Erro: Informe um valor válido'); return; }
    if (!user) { toast.error('Usuário não autenticado'); return; }
    setFormLoading(true);
    try {
      const transacaoData = { ...formData, usuario_id: user.id, organization_id: organization?.id, observacoes: formData.observacoes || null, categoria: formData.categoria || null };
      if (editingTransacao) {
        const { error } = await supabase.from('financeiro').update(transacaoData).eq('id', editingTransacao.id);
        if (error) throw error;
        toast.success('Transação atualizada!');
      } else {
        const { error } = await supabase.from('financeiro').insert(transacaoData);
        if (error) throw error;
        toast.success('Transação criada!');
      }
      setDialogOpen(false);
      resetForm();
      fetchTransacoes();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + (error?.message || 'Tente novamente'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (transacao: Transacao) => {
    setEditingTransacao(transacao);
    setFormData({
      tipo: transacao.tipo, descricao: transacao.descricao, valor: transacao.valor,
      categoria: transacao.categoria || "", data_transacao: transacao.data_transacao.split('T')[0],
      observacoes: transacao.observacoes || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await confirm({ title: 'Excluir transação', description: 'Esta ação não pode ser desfeita.', variant: 'destructive', confirmText: 'Excluir' })) return;
    try {
      const { error } = await supabase.from('financeiro').delete().eq('id', id);
      if (error) throw error;
      toast.success('Transação excluída!');
      fetchTransacoes();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + (error?.message || 'Tente novamente'));
    }
  };

  const resetForm = () => {
    setFormData({ tipo: "receita", descricao: "", valor: 0, categoria: "", data_transacao: new Date().toISOString().split('T')[0], observacoes: "" });
    setEditingTransacao(null);
  };

  

  const { receitaMensal, despesaMensal, comissoesMensal, lucroLiquido } = useMemo(() => {
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
    const thisMonth = transacoes.filter(t => new Date(t.data_transacao) >= startOfMonth);
    const r = thisMonth.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + Number(t.valor), 0);
    const d = thisMonth.filter(t => t.tipo === 'despesa' || t.tipo === 'salario').reduce((acc, t) => acc + Number(t.valor), 0);
    const c = thisMonth.filter(t => t.tipo === 'comissao').reduce((acc, t) => acc + Number(t.valor), 0);
    return { receitaMensal: r, despesaMensal: d, comissoesMensal: c, lucroLiquido: r - d - c };
  }, [transacoes]);

  const getTipoConfig = (tipo: string) => {
    const config: Record<string, { label: string; color: string; badgeVariant: "default" | "secondary" | "outline" | "destructive" }> = {
      'receita': { label: 'Receita', color: 'text-success', badgeVariant: 'default' },
      'despesa': { label: 'Despesa', color: 'text-destructive', badgeVariant: 'destructive' },
      'salario': { label: 'Salário', color: 'text-warning', badgeVariant: 'secondary' },
      'comissao': { label: 'Comissão', color: 'text-primary', badgeVariant: 'outline' }
    };
    return config[tipo] || { label: tipo, color: 'text-foreground', badgeVariant: 'outline' as const };
  };

  const filteredTransacoes = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return transacoes.filter(t =>
      t.descricao.toLowerCase().includes(term) ||
      t.categoria?.toLowerCase().includes(term) ||
      t.observacoes?.toLowerCase().includes(term)
    );
  }, [transacoes, searchTerm]);

  const totalAReceber = useMemo(() => osAbertas.reduce((s, o) => s + o.valor, 0), [osAbertas]);

  const abrirCobranca = (clienteId?: string) => { setCobrancaCliente(clienteId); setCobrancaOpen(true); };

  return (
    <MainLayout>
      <div className="space-y-4" data-tour="financeiro-page">
        {/* Header */}
        <PremiumCard delay={0}>
          <PremiumCard.Header>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full">
              <div>
                <h1 className="text-lg font-bold flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" />Financeiro</h1>
                <p className="text-xs text-muted-foreground">Controle de receitas, despesas e cobranças</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => abrirCobranca()}>
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" />Cobrar Cliente
                </Button>
                <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gradient-primary shadow-soft"><Plus className="mr-1.5 h-3.5 w-3.5" />Nova Transação</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-base">{editingTransacao ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
                      <DialogDescription className="text-xs">Registre uma nova transação financeira</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Tipo *</Label>
                          <Select value={formData.tipo} onValueChange={(value: Enums<"tipo_transacao">) => setFormData({ ...formData, tipo: value })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="receita">Receita</SelectItem>
                              <SelectItem value="despesa">Despesa</SelectItem>
                              <SelectItem value="salario">Salário</SelectItem>
                              <SelectItem value="comissao">Comissão</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5"><Label className="text-xs">Valor (R$) *</Label><NumberInput step="0.01" className="h-9" value={formData.valor} onChange={(v) => setFormData({ ...formData, valor: v })} placeholder="0,00" required /></div>
                        <div className="sm:col-span-2 space-y-1.5">
                          <Label className="text-xs">Descrição *</Label>
                          <CatalogAutocomplete
                            value={formData.descricao}
                            onChange={(v) => setFormData({ ...formData, descricao: v })}
                            onSelect={(item) => setFormData(f => ({
                              ...f,
                              descricao: item.descricao,
                              valor: item.preco > 0 ? item.preco : f.valor,
                              categoria: item.categoria || f.categoria,
                            }))}
                            placeholder="Buscar produto/serviço ou digitar..."
                            mode="text"
                            required
                            currentCategory={formData.categoria}
                          />
                        </div>
                        <div className="space-y-1.5"><Label className="text-xs">Categoria</Label><Input className="h-9" value={formData.categoria} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })} placeholder="Ex: Serviços, Estoque" /></div>
                        <div className="space-y-1.5"><Label className="text-xs">Data *</Label><Input type="date" className="h-9" value={formData.data_transacao} onChange={(e) => setFormData({ ...formData, data_transacao: e.target.value })} required /></div>
                        <div className="sm:col-span-2 space-y-1.5"><Label className="text-xs">Observações</Label><Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={2} /></div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button type="submit" size="sm" className="gradient-primary" disabled={formLoading}>
                          {formLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{editingTransacao ? 'Salvar' : 'Criar'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </PremiumCard.Header>
        </PremiumCard>

        {/* KPI Cards */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="Receita do Mês"
            value={formatCurrency(receitaMensal)}
            trend={{ value: 0, label: "vs mês anterior" }}
            icon={TrendingUp}
            color="green"
            delay={0}
          />
          <KpiCard
            label="Despesas do Mês"
            value={formatCurrency(despesaMensal)}
            trend={{ value: 0, label: "vs mês anterior" }}
            icon={TrendingDown}
            color="red"
            delay={100}
          />
          <KpiCard
            label="Lucro Líquido"
            value={formatCurrency(lucroLiquido)}
            trend={{ value: 0, label: "vs mês anterior" }}
            icon={Wallet}
            color={lucroLiquido >= 0 ? "green" : "red"}
            delay={200}
          />
          <KpiCard
            label="Comissões do Mês"
            value={formatCurrency(comissoesMensal)}
            trend={{ value: 0, label: "vs mês anterior" }}
            icon={DollarSign}
            color="yellow"
            delay={300}
          />
          <KpiCard
            label="A Receber (OS)"
            value={formatCurrency(totalAReceber)}
            trend={{ value: 0, label: "em aberto" }}
            icon={ClipboardList}
            color="blue"
            onClick={() => abrirCobranca()}
            delay={400}
          />
        </div>

        {/* OS em aberto para cobrança */}
        {osAbertas.length > 0 && (
          <PremiumCard delay={100}>
            <PremiumCard.Header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-primary" />
                <span className="font-semibold">OS aguardando pagamento</span>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => abrirCobranca()}>Cobrar em lote</Button>
            </PremiumCard.Header>
            <PremiumCard.Content className="space-y-2 p-0">
              {osAbertas.slice(0, 6).map(os => (
                <div key={os.id} className="flex items-center justify-between gap-2 p-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{os.cliente_nome}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">#{os.numero} · {os.equipamento}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold">{formatCurrency(os.valor)}</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => abrirCobranca(os.cliente_id)}>
                      <MessageCircle className="mr-1 h-3 w-3" />Cobrar
                    </Button>
                  </div>
                </div>
              ))}
              {osAbertas.length > 6 && (
                <p className="text-[11px] text-muted-foreground text-center py-2">+{osAbertas.length - 6} outras OS em aberto</p>
              )}
            </PremiumCard.Content>
          </PremiumCard>
        )}

        {/* Search */}
        <PremiumCard delay={200}>
          <div className="p-4 border-b border-border">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por descrição, categoria..." className="pl-9 h-9 text-xs bg-muted/30 border-border/50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </PremiumCard>

        {/* Transações Table */}
        <PremiumCard delay={300}>
          <PremiumCard.Header className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-primary" />
              <span className="font-semibold">Transações Recentes</span>
            </div>
          </PremiumCard.Header>
          <PremiumCard.Content className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredTransacoes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{searchTerm ? 'Nenhuma transação encontrada' : 'Nenhuma transação cadastrada'}</p>
              </div>
            ) : (
              <PremiumTable<Transacao>
                columns={[
                  { key: 'data', header: 'Data', align: 'left' },
                  { key: 'descricao', header: 'Descrição', align: 'left' },
                  { key: 'categoria', header: 'Categoria', align: 'center' },
                  { key: 'tipo', header: 'Tipo', align: 'center' },
                  { key: 'valor', header: 'Valor', align: 'right' },
                  { key: 'actions', header: '', align: 'right' },
                ]}
                data={filteredTransacoes.slice(0, 30)}
                rowKey="id"
                loading={loading}
                emptyMessage={searchTerm ? 'Nenhuma transação encontrada' : 'Nenhuma transação cadastrada'}
                emptyIcon={Receipt}
                emptyAction={{ label: "Nova Transação", onClick: () => { setDialogOpen(true); } }}
                striped
                hoverable
                animateRows
                renderCell={(column, row) => {
                  const tipoConfig = getTipoConfig(row.tipo);
                  switch (column.key) {
                    case 'data':
                      return <span className="text-sm font-mono text-muted-foreground">{new Date(row.data_transacao).toLocaleDateString('pt-BR')}</span>;
                    case 'descricao':
                      return <span className="text-sm font-medium truncate max-w-[250px]">{row.descricao}</span>;
                    case 'categoria':
                      return row.categoria ? (
                        <Badge variant="secondary" className="text-[10px] h-5">{row.categoria}</Badge>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">-</span>
                      );
                    case 'tipo':
                      return <Badge variant={tipoConfig.badgeVariant} className="text-[10px] h-5">{tipoConfig.label}</Badge>;
                    case 'valor':
                      return (
                        <span className={`text-sm font-bold ${tipoConfig.color}`}>
                          {row.tipo === 'receita' ? '+' : '-'}{formatCurrency(row.valor)}
                        </span>
                      );
                    case 'actions':
                      return (
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleEdit(row); }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      );
                    default:
                      return null;
                  }
                }}
                onRowClick={(row) => setViewingTransacao(row)}
              />
            )}
          </PremiumCard.Content>
        </PremiumCard>

        {/* View Transaction Dialog */}
        <Dialog open={!!viewingTransacao} onOpenChange={(open) => { if (!open) setViewingTransacao(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-base">Detalhes da Transação</DialogTitle></DialogHeader>
            {viewingTransacao && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Descrição</p><p className="font-bold text-lg">{viewingTransacao.descricao}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tipo</p><Badge variant={getTipoConfig(viewingTransacao.tipo).badgeVariant}>{getTipoConfig(viewingTransacao.tipo).label}</Badge></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Valor</p><p className={`font-bold text-lg ${getTipoConfig(viewingTransacao.tipo).color}`}>{formatCurrency(viewingTransacao.valor)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Categoria</p><p className="text-sm font-medium">{viewingTransacao.categoria || "-"}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Data</p><p className="text-sm font-medium">{new Date(viewingTransacao.data_transacao).toLocaleDateString('pt-BR')}</p></div>
                  {viewingTransacao.observacoes && <div className="col-span-2"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Observações</p><p className="text-sm">{viewingTransacao.observacoes}</p></div>}
                </div>
                <Separator />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => { handleEdit(viewingTransacao); setViewingTransacao(null); }}>
                    <Edit className="mr-1.5 h-3.5 w-3.5" />Editar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <CobrancaClienteDialog open={cobrancaOpen} onOpenChange={setCobrancaOpen} clienteIdInicial={cobrancaCliente} />
      </div>
    </MainLayout>
  );
}
