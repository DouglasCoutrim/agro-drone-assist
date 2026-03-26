import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DollarSign, TrendingUp, TrendingDown, Plus, CreditCard, Wallet, Receipt, Loader2, Edit, Trash2, Eye, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables, Enums } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";

type Transacao = Tables<"financeiro">;

export default function Financeiro() {
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<Transacao | null>(null);
  const [viewingTransacao, setViewingTransacao] = useState<Transacao | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    tipo: "receita" as Enums<"tipo_transacao">,
    descricao: "", valor: 0, categoria: "",
    data_transacao: new Date().toISOString().split('T')[0], observacoes: ""
  });

  useEffect(() => { fetchTransacoes(); }, []);

  const fetchTransacoes = async () => {
    try {
      const { data, error } = await supabase.from('financeiro').select('*').order('data_transacao', { ascending: false });
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
      const transacaoData = { ...formData, usuario_id: user.id, observacoes: formData.observacoes || null, categoria: formData.categoria || null, organization_id: organizationId };
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
    if (!confirm('Excluir esta transação?')) return;
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

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
  const thisMonthTransacoes = transacoes.filter(t => new Date(t.data_transacao) >= startOfMonth);
  const receitaMensal = thisMonthTransacoes.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + Number(t.valor), 0);
  const despesaMensal = thisMonthTransacoes.filter(t => t.tipo === 'despesa' || t.tipo === 'salario').reduce((acc, t) => acc + Number(t.valor), 0);
  const comissoesMensal = thisMonthTransacoes.filter(t => t.tipo === 'comissao').reduce((acc, t) => acc + Number(t.valor), 0);
  const lucroLiquido = receitaMensal - despesaMensal - comissoesMensal;

  const getTipoConfig = (tipo: string) => {
    const config: Record<string, { label: string; color: string; badgeVariant: "default" | "secondary" | "outline" | "destructive" }> = {
      'receita': { label: 'Receita', color: 'text-success', badgeVariant: 'default' },
      'despesa': { label: 'Despesa', color: 'text-destructive', badgeVariant: 'destructive' },
      'salario': { label: 'Salário', color: 'text-warning', badgeVariant: 'secondary' },
      'comissao': { label: 'Comissão', color: 'text-primary', badgeVariant: 'outline' }
    };
    return config[tipo] || { label: tipo, color: 'text-foreground', badgeVariant: 'outline' as const };
  };

  const filteredTransacoes = transacoes.filter(t =>
    t.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.categoria?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.observacoes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" />Financeiro</h1>
            <p className="text-xs text-muted-foreground">Controle de receitas e despesas</p>
          </div>
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
                  <div className="space-y-1.5"><Label className="text-xs">Valor (R$) *</Label><Input type="number" step="0.01" className="h-9" value={formData.valor} onChange={(e) => setFormData({ ...formData, valor: Number(e.target.value) })} required /></div>
                  <div className="sm:col-span-2 space-y-1.5"><Label className="text-xs">Descrição *</Label><Input className="h-9" value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} required /></div>
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

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-soft border-border/50"><CardContent className="p-3"><div className="flex items-center gap-2.5"><div className="p-2 rounded-lg bg-success/10"><TrendingUp className="h-4 w-4 text-success" /></div><div className="min-w-0"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Receita</p><p className="text-base sm:text-lg font-bold text-success truncate">{formatCurrency(receitaMensal)}</p></div></div></CardContent></Card>
          <Card className="shadow-soft border-border/50"><CardContent className="p-3"><div className="flex items-center gap-2.5"><div className="p-2 rounded-lg bg-destructive/10"><TrendingDown className="h-4 w-4 text-destructive" /></div><div className="min-w-0"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Despesas</p><p className="text-base sm:text-lg font-bold text-destructive truncate">{formatCurrency(despesaMensal)}</p></div></div></CardContent></Card>
          <Card className="shadow-soft border-border/50"><CardContent className="p-3"><div className="flex items-center gap-2.5"><div className="p-2 rounded-lg bg-primary/10"><Wallet className="h-4 w-4 text-primary" /></div><div className="min-w-0"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Lucro</p><p className={`text-base sm:text-lg font-bold truncate ${lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(lucroLiquido)}</p></div></div></CardContent></Card>
          <Card className="shadow-soft border-border/50"><CardContent className="p-3"><div className="flex items-center gap-2.5"><div className="p-2 rounded-lg bg-warning/10"><DollarSign className="h-4 w-4 text-warning" /></div><div className="min-w-0"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Comissões</p><p className="text-base sm:text-lg font-bold text-warning truncate">{formatCurrency(comissoesMensal)}</p></div></div></CardContent></Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por descrição, categoria..." className="pl-9 h-9 text-xs bg-muted/30 border-border/50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        {/* List */}
        <Card className="shadow-soft border-border/50">
          <CardHeader className="pb-2 px-4 pt-4"><CardTitle className="text-sm flex items-center gap-1.5"><Receipt className="h-4 w-4 text-primary" />Transações Recentes</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4">
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filteredTransacoes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">{searchTerm ? 'Nenhuma transação encontrada' : 'Nenhuma transação cadastrada'}</p></div>
            ) : (
              <div className="space-y-2">
                {filteredTransacoes.slice(0, 30).map((transacao) => {
                  const tipoConfig = getTipoConfig(transacao.tipo);
                  return (
                    <div key={transacao.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setViewingTransacao(transacao)}>
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-medium truncate">{transacao.descricao}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant={tipoConfig.badgeVariant} className="text-[10px] h-5">{tipoConfig.label}</Badge>
                          {transacao.categoria && <Badge variant="secondary" className="text-[10px] h-5">{transacao.categoria}</Badge>}
                          <span className="text-[10px] text-muted-foreground">{new Date(transacao.data_transacao).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className={`text-sm font-bold ${tipoConfig.color}`}>{transacao.tipo === 'receita' ? '+' : '-'}{formatCurrency(transacao.valor)}</p>
                        <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(transacao)}><Edit className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(transacao.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

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
      </div>
    </MainLayout>
  );
}
