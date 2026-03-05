import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Plus, Search, AlertTriangle, Package, TrendingDown, TrendingUp,
  Edit, Trash2, Loader2, Link as LinkIcon, ImageIcon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";

type ItemEstoque = Tables<"itens_estoque">;

const DEFAULT_MARGIN = 30; // Margem de lucro padrão (%)

export default function Estoque() {
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemEstoque | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [margemLucro, setMargemLucro] = useState(DEFAULT_MARGIN);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlLink, setMlLink] = useState("");

  const [formData, setFormData] = useState({
    codigo: "", descricao: "", categoria: "", quantidade: 0,
    estoque_minimo: 0, custo_unitario: 0, preco_venda: 0,
    fornecedor: "", localizacao: ""
  });

  useEffect(() => {
    fetchItens();
    const savedMargin = localStorage.getItem('volt_margin');
    if (savedMargin) setMargemLucro(Number(savedMargin));
  }, []);

  const fetchItens = async () => {
    try {
      const { data, error } = await supabase.from('itens_estoque').select('*').order('descricao');
      if (error) throw error;
      setItens(data || []);
    } catch (error: any) { toast.error('Erro ao carregar estoque'); } finally { setLoading(false); }
  };

  const handleCustoChange = (custo: number) => {
    const preco_venda = Number((custo * (1 + margemLucro / 100)).toFixed(2));
    setFormData(prev => ({ ...prev, custo_unitario: custo, preco_venda }));
  };

  const handleMargemChange = (newMargin: number) => {
    setMargemLucro(newMargin);
    localStorage.setItem('volt_margin', String(newMargin));
    if (formData.custo_unitario > 0) {
      const preco_venda = Number((formData.custo_unitario * (1 + newMargin / 100)).toFixed(2));
      setFormData(prev => ({ ...prev, preco_venda }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (editingItem) {
        const { error } = await supabase.from('itens_estoque').update(formData).eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Item atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('itens_estoque').insert(formData);
        if (error) throw error;
        toast.success('Item criado com sucesso!');
      }
      setDialogOpen(false); resetForm(); fetchItens();
    } catch (error: any) { toast.error('Erro ao salvar item: ' + error.message); } finally { setFormLoading(false); }
  };

  const handleEdit = (item: ItemEstoque) => {
    setEditingItem(item);
    setFormData({
      codigo: item.codigo, descricao: item.descricao, categoria: item.categoria,
      quantidade: item.quantidade, estoque_minimo: item.estoque_minimo,
      custo_unitario: item.custo_unitario, preco_venda: item.preco_venda,
      fornecedor: item.fornecedor || "", localizacao: item.localizacao || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    try {
      const { error } = await supabase.from('itens_estoque').delete().eq('id', id);
      if (error) throw error;
      toast.success('Item excluído com sucesso!'); fetchItens();
    } catch (error: any) { toast.error('Erro ao excluir item: ' + error.message); }
  };

  const resetForm = () => {
    setFormData({ codigo: "", descricao: "", categoria: "", quantidade: 0, estoque_minimo: 0, custo_unitario: 0, preco_venda: 0, fornecedor: "", localizacao: "" });
    setEditingItem(null); setMlLink("");
  };

  const extractMLId = (url: string): string | null => {
    const match = url.match(/(MLB)\s*[-]?\s*(\d+)/i);
    if (!match) return null;
    return match[2]; // Return only the numeric part
  };

  const handleMLImport = async () => {
    if (!mlLink.trim()) { toast.error('Cole o link do anúncio do Mercado Livre'); return; }
    const idNumerico = extractMLId(mlLink);
    if (!idNumerico) { toast.error('Link inválido. Use um link de produto do Mercado Livre (ex: MLB-123456789).'); return; }

    setMlLoading(true);
    const loadingToast = toast.loading('Buscando dados do Mercado Livre...');

    const applyData = (data: any) => {
      if (data.error === 'not_found' || !data.title) {
        toast.dismiss(loadingToast);
        toast.error('Produto não encontrado no Mercado Livre. Verifique o link.');
        return;
      }
      const price = data.price || 0;
      const imageUrl = data.pictures?.[0]?.secure_url || data.thumbnail || '';
      setFormData(prev => ({
        ...prev,
        descricao: data.title || prev.descricao,
        custo_unitario: price,
        preco_venda: Number((price * (1 + margemLucro / 100)).toFixed(2)),
      }));
      toast.dismiss(loadingToast);
      toast.success(`Produto importado: ${data.title}`);
      if (imageUrl) {
        toast.info('Imagem disponível: ' + imageUrl.substring(0, 60) + '...');
      }
    };

    try {
      const res = await fetch(`https://api.mercadolibre.com/items/MLB${idNumerico}`);
      if (!res.ok) throw new Error('CORS_OR_NOT_FOUND');
      const data = await res.json();
      if (data.error) throw new Error('CORS_OR_NOT_FOUND');
      applyData(data);
    } catch {
      // Fallback via corsproxy.io
      try {
        const proxyRes = await fetch(`https://corsproxy.io/?url=https://api.mercadolibre.com/items/MLB${idNumerico}`);
        if (!proxyRes.ok) {
          toast.dismiss(loadingToast);
          toast.error('Produto não encontrado no Mercado Livre. Verifique o link.');
          return;
        }
        const data = await proxyRes.json();
        applyData(data);
      } catch (proxyError: any) {
        toast.dismiss(loadingToast);
        toast.error('Não foi possível buscar os dados. Verifique o link e tente novamente.');
      }
    } finally { setMlLoading(false); }
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
  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8 text-primary" />Controle de Estoque
            </h1>
            <p className="text-muted-foreground">Peças para drones, baterias, geradores e carregadores</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Margem Padrão</Label>
              <Input type="number" className="w-16 h-7 text-sm text-center" value={margemLucro}
                onChange={(e) => handleMargemChange(Number(e.target.value))} min={0} max={500} />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gradient-primary shadow-medium"><Plus className="mr-2 h-4 w-4" />Novo Item</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item'}</DialogTitle>
                  <DialogDescription>Preencha os dados do item de estoque</DialogDescription>
                </DialogHeader>

                {/* Mercado Livre Import */}
                {!editingItem && (
                  <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Importar do Mercado Livre</span>
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Cole o link do anúncio aqui..." value={mlLink}
                        onChange={(e) => setMlLink(e.target.value)} className="flex-1" />
                      <Button type="button" variant="outline" onClick={handleMLImport} disabled={mlLoading}>
                        {mlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        <span className="ml-1">Buscar</span>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Preenche automaticamente nome e preço do produto.</p>
                  </div>
                )}

                <Separator />

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Código *</Label><Input value={formData.codigo} onChange={(e) => setFormData({ ...formData, codigo: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Categoria *</Label><Input value={formData.categoria} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })} placeholder="Ex: Baterias, Hélices, Motores" required /></div>
                    <div className="col-span-2 space-y-2"><Label>Descrição *</Label><Input value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Quantidade</Label><Input type="number" value={formData.quantidade} onChange={(e) => setFormData({ ...formData, quantidade: Number(e.target.value) })} /></div>
                    <div className="space-y-2"><Label>Estoque Mínimo</Label><Input type="number" value={formData.estoque_minimo} onChange={(e) => setFormData({ ...formData, estoque_minimo: Number(e.target.value) })} /></div>
                    <div className="space-y-2">
                      <Label>Custo Unitário (R$)</Label>
                      <Input type="number" step="0.01" value={formData.custo_unitario}
                        onChange={(e) => handleCustoChange(Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Preço de Venda (R$)
                        <span className="text-xs text-muted-foreground">(+{margemLucro}%)</span>
                      </Label>
                      <Input type="number" step="0.01" value={formData.preco_venda}
                        onChange={(e) => setFormData({ ...formData, preco_venda: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-2"><Label>Fornecedor</Label><Input value={formData.fornecedor} onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Localização</Label><Input value={formData.localizacao} onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })} placeholder="Ex: Prateleira A1" /></div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit" className="gradient-primary" disabled={formLoading}>
                      {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingItem ? 'Salvar' : 'Criar'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-soft card-hover"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Itens</p><p className="text-2xl font-bold">{itens.length}</p></div><Package className="h-8 w-8 text-primary" /></div></CardContent></Card>
          <Card className="shadow-soft card-hover"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Baixo Estoque</p><p className="text-2xl font-bold text-destructive">{itensEstoqueBaixo.length}</p></div><AlertTriangle className="h-8 w-8 text-destructive" /></div></CardContent></Card>
          <Card className="shadow-soft card-hover"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Valor Total</p><p className="text-2xl font-bold">{formatCurrency(valorTotal)}</p></div><TrendingUp className="h-8 w-8 text-success" /></div></CardContent></Card>
          <Card className="shadow-soft card-hover"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Categorias</p><p className="text-2xl font-bold">{new Set(itens.map(i => i.categoria)).size}</p></div><Package className="h-8 w-8 text-primary" /></div></CardContent></Card>
        </div>

        {/* Search */}
        <Card className="shadow-soft"><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar por código, nome ou categoria..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></CardContent></Card>

        {/* Table */}
        <Card className="shadow-soft">
          <CardHeader><CardTitle>Inventário</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredItens.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><Package className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Nenhum item encontrado</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Foto</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Preço Venda</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItens.map((item) => {
                      const statusInfo = getStatusInfo(item);
                      const StatusIcon = statusInfo.icon;
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.descricao}</p>
                              <p className="text-xs text-muted-foreground">{item.codigo}</p>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline">{item.categoria}</Badge></TableCell>
                          <TableCell className="text-center">
                            <span className="font-bold text-lg">{item.quantidade}</span>
                            <span className="text-xs text-muted-foreground block">min: {item.estoque_minimo}</span>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.custo_unitario)}</TableCell>
                          <TableCell className="text-right font-medium text-success">{formatCurrency(item.preco_venda)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={statusInfo.variant} className="gap-1">
                              <StatusIcon className="h-3 w-3" />{statusInfo.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => handleEdit(item)}><Edit className="h-4 w-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        {itensEstoqueBaixo.length > 0 && (
          <Card className="shadow-soft border-l-4 border-l-destructive">
            <CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Alertas de Estoque Baixo</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {itensEstoqueBaixo.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg">
                    <div>
                      <p className="font-medium">{item.descricao}</p>
                      <p className="text-sm text-muted-foreground">{item.codigo} · {item.categoria}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-destructive">{item.quantidade} un.</p>
                      <p className="text-xs text-muted-foreground">Mín: {item.estoque_minimo}</p>
                    </div>
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
