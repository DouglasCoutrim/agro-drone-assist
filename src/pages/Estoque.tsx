import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Plus, 
  Search, 
  AlertTriangle, 
  Package, 
  TrendingDown, 
  TrendingUp,
  Edit,
  Trash2,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";

type ItemEstoque = Tables<"itens_estoque">;

export default function Estoque() {
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemEstoque | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [formData, setFormData] = useState({
    codigo: "",
    descricao: "",
    categoria: "",
    quantidade: 0,
    estoque_minimo: 0,
    custo_unitario: 0,
    preco_venda: 0,
    fornecedor: "",
    localizacao: ""
  });

  useEffect(() => {
    fetchItens();
  }, []);

  const fetchItens = async () => {
    try {
      const { data, error } = await supabase
        .from('itens_estoque')
        .select('*')
        .order('descricao');

      if (error) throw error;
      setItens(data || []);
    } catch (error: any) {
      console.error('Error fetching itens:', error);
      toast.error('Erro ao carregar estoque');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      if (editingItem) {
        const { error } = await supabase
          .from('itens_estoque')
          .update(formData)
          .eq('id', editingItem.id);

        if (error) throw error;
        toast.success('Item atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('itens_estoque')
          .insert(formData);

        if (error) throw error;
        toast.success('Item criado com sucesso!');
      }

      setDialogOpen(false);
      resetForm();
      fetchItens();
    } catch (error: any) {
      console.error('Error saving item:', error);
      toast.error('Erro ao salvar item: ' + error.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (item: ItemEstoque) => {
    setEditingItem(item);
    setFormData({
      codigo: item.codigo,
      descricao: item.descricao,
      categoria: item.categoria,
      quantidade: item.quantidade,
      estoque_minimo: item.estoque_minimo,
      custo_unitario: item.custo_unitario,
      preco_venda: item.preco_venda,
      fornecedor: item.fornecedor || "",
      localizacao: item.localizacao || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;

    try {
      const { error } = await supabase
        .from('itens_estoque')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Item excluído com sucesso!');
      fetchItens();
    } catch (error: any) {
      console.error('Error deleting item:', error);
      toast.error('Erro ao excluir item: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      codigo: "",
      descricao: "",
      categoria: "",
      quantidade: 0,
      estoque_minimo: 0,
      custo_unitario: 0,
      preco_venda: 0,
      fornecedor: "",
      localizacao: ""
    });
    setEditingItem(null);
  };

  const getStatusInfo = (item: ItemEstoque) => {
    if (item.quantidade <= 0) return { status: 'Sem Estoque', variant: 'destructive' as const, icon: TrendingDown };
    if (item.quantidade <= item.estoque_minimo) return { status: 'Baixo', variant: 'destructive' as const, icon: AlertTriangle };
    if (item.quantidade <= item.estoque_minimo * 1.5) return { status: 'Atenção', variant: 'secondary' as const, icon: AlertTriangle };
    return { status: 'Ok', variant: 'default' as const, icon: TrendingUp };
  };

  const filteredItens = itens.filter(item =>
    item.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const itensEstoqueBaixo = itens.filter(item => item.quantidade <= item.estoque_minimo);
  const valorTotal = itens.reduce((acc, item) => acc + (item.quantidade * item.custo_unitario), 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8 text-primary" />
              Controle de Estoque
            </h1>
            <p className="text-muted-foreground">
              Gerencie peças, componentes e produtos
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary shadow-medium">
                <Plus className="mr-2 h-4 w-4" />
                Novo Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? 'Editar Item' : 'Novo Item'}
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados do item de estoque
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código *</Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoria *</Label>
                    <Input
                      id="categoria"
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      placeholder="Ex: Baterias, Hélices, Motores"
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
                    <Label htmlFor="quantidade">Quantidade</Label>
                    <Input
                      id="quantidade"
                      type="number"
                      value={formData.quantidade}
                      onChange={(e) => setFormData({ ...formData, quantidade: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estoque_minimo">Estoque Mínimo</Label>
                    <Input
                      id="estoque_minimo"
                      type="number"
                      value={formData.estoque_minimo}
                      onChange={(e) => setFormData({ ...formData, estoque_minimo: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custo_unitario">Custo Unitário (R$)</Label>
                    <Input
                      id="custo_unitario"
                      type="number"
                      step="0.01"
                      value={formData.custo_unitario}
                      onChange={(e) => setFormData({ ...formData, custo_unitario: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preco_venda">Preço de Venda (R$)</Label>
                    <Input
                      id="preco_venda"
                      type="number"
                      step="0.01"
                      value={formData.preco_venda}
                      onChange={(e) => setFormData({ ...formData, preco_venda: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fornecedor">Fornecedor</Label>
                    <Input
                      id="fornecedor"
                      value={formData.fornecedor}
                      onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="localizacao">Localização</Label>
                    <Input
                      id="localizacao"
                      value={formData.localizacao}
                      onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
                      placeholder="Ex: Prateleira A1"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="gradient-primary" disabled={formLoading}>
                    {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingItem ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Itens</p>
                  <p className="text-2xl font-bold">{itens.length}</p>
                </div>
                <Package className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Baixo Estoque</p>
                  <p className="text-2xl font-bold text-destructive">{itensEstoqueBaixo.length}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Categorias</p>
                  <p className="text-2xl font-bold">{new Set(itens.map(i => i.categoria)).size}</p>
                </div>
                <Package className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, nome ou categoria..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Inventory Table */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Inventário</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredItens.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum item encontrado</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredItens.map((item) => {
                  const statusInfo = getStatusInfo(item);
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <div key={item.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                        <div className="space-y-1">
                          <p className="font-medium">{item.descricao}</p>
                          <p className="text-sm text-muted-foreground">{item.codigo}</p>
                          <Badge variant="outline">{item.categoria}</Badge>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Fornecedor</p>
                          <p className="font-medium">{item.fornecedor || '-'}</p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Estoque</p>
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-xl font-bold">{item.quantidade}</p>
                            <Badge variant={statusInfo.variant} className="flex items-center gap-1">
                              <StatusIcon className="h-3 w-3" />
                              {statusInfo.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Min: {item.estoque_minimo}</p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Custo</p>
                          <p className="font-medium">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.custo_unitario)}
                          </p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Preço Venda</p>
                          <p className="font-medium text-success">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco_venda)}
                          </p>
                        </div>
                        
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDelete(item.id)}>
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

        {/* Alerts */}
        {itensEstoqueBaixo.length > 0 && (
          <Card className="shadow-soft border-l-4 border-l-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Alertas de Estoque Baixo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {itensEstoqueBaixo.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5">
                    <div>
                      <p className="font-medium">{item.descricao}</p>
                      <p className="text-sm text-muted-foreground">{item.codigo}</p>
                    </div>
                    <Badge variant="destructive">
                      {item.quantidade} / {item.estoque_minimo} unidades
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
