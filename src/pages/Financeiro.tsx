import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Plus,
  CreditCard,
  Wallet,
  Receipt,
  Loader2,
  Edit,
  Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables, Enums } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";

type Transacao = Tables<"financeiro">;

export default function Financeiro() {
  const { user } = useAuth();
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<Transacao | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [formData, setFormData] = useState({
    tipo: "receita" as Enums<"tipo_transacao">,
    descricao: "",
    valor: 0,
    categoria: "",
    data_transacao: new Date().toISOString().split('T')[0],
    observacoes: ""
  });

  useEffect(() => {
    fetchTransacoes();
  }, []);

  const fetchTransacoes = async () => {
    try {
      const { data, error } = await supabase
        .from('financeiro')
        .select('*')
        .order('data_transacao', { ascending: false });

      if (error) throw error;
      setTransacoes(data || []);
    } catch (error: any) {
      console.error('Error fetching transacoes:', error);
      toast.error('Erro ao carregar transações');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }
    setFormLoading(true);

    try {
      const transacaoData = {
        ...formData,
        usuario_id: user.id,
        observacoes: formData.observacoes || null,
        categoria: formData.categoria || null
      };

      if (editingTransacao) {
        const { error } = await supabase
          .from('financeiro')
          .update(transacaoData)
          .eq('id', editingTransacao.id);

        if (error) throw error;
        toast.success('Transação atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('financeiro')
          .insert(transacaoData);

        if (error) throw error;
        toast.success('Transação criada com sucesso!');
      }

      setDialogOpen(false);
      resetForm();
      fetchTransacoes();
    } catch (error: any) {
      console.error('Error saving transacao:', error);
      toast.error('Erro ao salvar transação: ' + error.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (transacao: Transacao) => {
    setEditingTransacao(transacao);
    setFormData({
      tipo: transacao.tipo,
      descricao: transacao.descricao,
      valor: transacao.valor,
      categoria: transacao.categoria || "",
      data_transacao: transacao.data_transacao.split('T')[0],
      observacoes: transacao.observacoes || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return;

    try {
      const { error } = await supabase
        .from('financeiro')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Transação excluída com sucesso!');
      fetchTransacoes();
    } catch (error: any) {
      toast.error('Erro ao excluir transação: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      tipo: "receita",
      descricao: "",
      valor: 0,
      categoria: "",
      data_transacao: new Date().toISOString().split('T')[0],
      observacoes: ""
    });
    setEditingTransacao(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Calculate stats
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const thisMonthTransacoes = transacoes.filter(t => 
    new Date(t.data_transacao) >= startOfMonth
  );

  const receitaMensal = thisMonthTransacoes
    .filter(t => t.tipo === 'receita')
    .reduce((acc, t) => acc + Number(t.valor), 0);

  const despesaMensal = thisMonthTransacoes
    .filter(t => t.tipo === 'despesa' || t.tipo === 'salario')
    .reduce((acc, t) => acc + Number(t.valor), 0);

  const comissoesMensal = thisMonthTransacoes
    .filter(t => t.tipo === 'comissao')
    .reduce((acc, t) => acc + Number(t.valor), 0);

  const lucroLiquido = receitaMensal - despesaMensal - comissoesMensal;

  const getTipoConfig = (tipo: string) => {
    const config: Record<string, { label: string; color: string }> = {
      'receita': { label: 'Receita', color: 'text-success' },
      'despesa': { label: 'Despesa', color: 'text-destructive' },
      'salario': { label: 'Salário', color: 'text-warning' },
      'comissao': { label: 'Comissão', color: 'text-primary' }
    };
    return config[tipo] || { label: tipo, color: 'text-foreground' };
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <DollarSign className="h-8 w-8 text-primary" />
              Financeiro
            </h1>
            <p className="text-muted-foreground">
              Controle financeiro e transações
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary shadow-medium">
                <Plus className="mr-2 h-4 w-4" />
                Nova Transação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingTransacao ? 'Editar Transação' : 'Nova Transação'}
                </DialogTitle>
                <DialogDescription>
                  Registre uma nova transação financeira
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo *</Label>
                    <Select
                      value={formData.tipo}
                      onValueChange={(value: Enums<"tipo_transacao">) => setFormData({ ...formData, tipo: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receita">Receita</SelectItem>
                        <SelectItem value="despesa">Despesa</SelectItem>
                        <SelectItem value="salario">Salário</SelectItem>
                        <SelectItem value="comissao">Comissão</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="valor">Valor (R$) *</Label>
                    <Input
                      id="valor"
                      type="number"
                      step="0.01"
                      value={formData.valor}
                      onChange={(e) => setFormData({ ...formData, valor: Number(e.target.value) })}
                      required
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="descricao">Descrição *</Label>
                    <Input
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoria</Label>
                    <Input
                      id="categoria"
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      placeholder="Ex: Serviços, Estoque, Operacional"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="data_transacao">Data *</Label>
                    <Input
                      id="data_transacao"
                      type="date"
                      value={formData.data_transacao}
                      onChange={(e) => setFormData({ ...formData, data_transacao: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="gradient-primary" disabled={formLoading}>
                    {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingTransacao ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Financial Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Receita Mensal</p>
                  <p className="text-2xl font-bold text-success">{formatCurrency(receitaMensal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <CreditCard className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Despesas</p>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(despesaMensal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lucro Líquido</p>
                  <p className={`text-2xl font-bold ${lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(lucroLiquido)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <DollarSign className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Comissões</p>
                  <p className="text-2xl font-bold text-warning">{formatCurrency(comissoesMensal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions List */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Transações Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : transacoes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma transação encontrada</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transacoes.slice(0, 20).map((transacao) => {
                  const tipoConfig = getTipoConfig(transacao.tipo);
                  return (
                    <div key={transacao.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="space-y-1">
                        <p className="font-medium">{transacao.descricao}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {tipoConfig.label}
                          </Badge>
                          {transacao.categoria && (
                            <Badge variant="secondary" className="text-xs">
                              {transacao.categoria}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(transacao.data_transacao).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className={`font-bold ${tipoConfig.color}`}>
                          {transacao.tipo === 'receita' ? '+' : '-'}{formatCurrency(transacao.valor)}
                        </p>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(transacao)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(transacao.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
