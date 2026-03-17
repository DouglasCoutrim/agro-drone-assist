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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Plus, Search, AlertTriangle, Package, TrendingDown, TrendingUp,
  Edit, Trash2, Loader2, Link as LinkIcon, Eye, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { SearchableInput } from "@/components/ui/searchable-input";

type ItemEstoque = Tables<"itens_estoque">;

const DEFAULT_MARGIN = 30;

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
  const [bulkLoading, setBulkLoading] = useState(false);
  const [viewingItem, setViewingItem] = useState<ItemEstoque | null>(null);

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

  // Auto-generate code for new items
  const generateCode = async () => {
    try {
      const { data } = await supabase.from('itens_estoque').select('codigo').order('codigo', { ascending: false });
      const codes = (data || []).map(i => i.codigo).filter(c => /^P-\d+$/.test(c));
      let nextNum = 1;
      if (codes.length > 0) {
        const maxNum = Math.max(...codes.map(c => parseInt(c.replace('P-', ''), 10)));
        nextNum = maxNum + 1;
      }
      return `P-${String(nextNum).padStart(5, '0')}`;
    } catch {
      return `P-${String(Date.now()).slice(-5)}`;
    }
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

  const handleBulkApplyMargin = async () => {
    setBulkLoading(true);
    try {
      const { data, error } = await supabase.from('itens_estoque').select('id, custo_unitario');
      if (error) throw error;
      if (!data || data.length === 0) { toast.info('Nenhum produto no estoque'); return; }

      let updated = 0;
      for (const item of data) {
        const newPrice = Number((item.custo_unitario * (1 + margemLucro / 100)).toFixed(2));
        const { error: upErr } = await supabase.from('itens_estoque').update({ preco_venda: newPrice }).eq('id', item.id);
        if (!upErr) updated++;
      }
      toast.success(`Margem de ${margemLucro}% aplicada a ${updated} produtos!`);
      fetchItens();
    } catch (err: any) {
      toast.error('Erro ao atualizar preços: ' + err.message);
    } finally {
      setBulkLoading(false);
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

  const handleOpenNewDialog = async () => {
    resetForm();
    const code = await generateCode();
    setFormData(prev => ({ ...prev, codigo: code }));
    setDialogOpen(true);
  };

  const extractMLId = (url: string): string | null => {
    const match = url.match(/MLB[-\s]?(\d+)/i);
    if (match) return `MLB${match[1]}`;
    // Also try just the ID without prefix
    const idOnly = url.match(/^(\d{10,13})$/);
    if (idOnly) return `MLB${idOnly[1]}`;
    return null;
  };

  const handleMLImport = async () => {
    if (!mlLink.trim()) { toast.error('Cole o link ou ID do anúncio do Mercado Livre'); return; }
    const mlId = extractMLId(mlLink.trim());
    if (!mlId) { toast.error('Link ou ID inválido. Use um link do Mercado Livre ou ID (ex: MLB6104761844).'); return; }

    setMlLoading(true);
    const loadingToast = toast.loading('Buscando dados do Mercado Livre...');

    try {
      const { data, error } = await supabase.functions.invoke('mercadolivre', {
        body: { mlId },
      });

      toast.dismiss(loadingToast);

      if (error || data?.error) {
        toast.error(data?.error || 'Produto não encontrado no Mercado Livre. Verifique o link.');
        return;
      }

      const price = data.price || 0;
      setFormData(prev => ({
        ...prev,
        descricao: data.title || prev.descricao,
        custo_unitario: price,
        preco_venda: Number((price * (1 + margemLucro / 100)).toFixed(2)),
        categoria: data.category_id || prev.categoria,
      }));
      toast.success(`Produto importado: ${data.title}`);
    } catch {
      toast.dismiss(loadingToast);
      toast.error('Não foi possível buscar os dados do Mercado Livre.');
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

  // Get unique categories for SearchableInput
  const categorias = [...new Set(itens.map(i => i.categoria).filter(Boolean))];
  const fornecedores = [...new Set(itens.map(i => i.fornecedor).filter(Boolean) as string[])];

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
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Margem Padrão</Label>
              <Input type="number" className="w-16 h-7 text-sm text-center" value={margemLucro}
                onChange={(e) => handleMargemChange(Number(e.target.value))} min={0} max={500} />
              <span className="text-xs text-muted-foreground">%</span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={bulkLoading}>
                    {bulkLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Aplicar a todos
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Atualizar todos os preços?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá recalcular o preço de venda de <strong>todos os {itens.length} produtos</strong> do estoque
                      usando a margem de <strong>{margemLucro}%</strong> sobre o custo unitário atual de cada item.
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkApplyMargin}>
                      Sim, aplicar a todos
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
              <Button className="gradient-primary shadow-medium" onClick={handleOpenNewDialog}>
                <Plus className="mr-2 h-4 w-4" />Novo Item
              </Button>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item'}</DialogTitle>
                  <DialogDescription>Preencha os dados do item de estoque</DialogDescription>
                </DialogHeader>

                {!editingItem && (
                  <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Importar do Mercado Livre</span>
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Cole o link ou ID (ex: MLB6104761844)..." value={mlLink}
                        onChange={(e) => setMlLink(e.target.value)} className="flex-1" />
                      <Button type="button" variant="outline" onClick={handleMLImport} disabled={mlLoading}>
                        {mlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        <span className="ml-1">Buscar</span>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Preenche automaticamente nome, preço e categoria do produto.</p>
                  </div>
                )}

                <Separator />

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Código *</Label>
                      <Input value={formData.codigo} onChange={(e) => setFormData({ ...formData, codigo: e.target.value })} required className="bg-muted" readOnly={!editingItem} />
                      {!editingItem && <p className="text-xs text-muted-foreground">Gerado automaticamente</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria *</Label>
                      <SearchableInput
                        value={formData.categoria}
                        onChange={(v) => setFormData({ ...formData, categoria: v })}
                        suggestions={categorias}
                        placeholder="Digite ou selecione..."
                        onAddNew={(v) => setFormData({ ...formData, categoria: v })}
                        addNewLabel="Criar categoria"
                        required
                      />
                    </div>
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
                        disabled className="bg-muted font-semibold" />
                    </div>
                    <div className="space-y-2">
                      <Label>Fornecedor</Label>
                      <SearchableInput
                        value={formData.fornecedor}
                        onChange={(v) => setFormData({ ...formData, fornecedor: v })}
                        suggestions={fornecedores}
                        placeholder="Digite ou selecione..."
                        onAddNew={(v) => setFormData({ ...formData, fornecedor: v })}
                        addNewLabel="Adicionar fornecedor"
                      />
                    </div>
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
                        <TableRow key={item.id} className="cursor-pointer" onClick={() => setViewingItem(item)}>
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
                            <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="ghost" onClick={() => setViewingItem(item)}><Eye className="h-4 w-4" /></Button>
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

        {/* View Item Dialog */}
        <Dialog open={!!viewingItem} onOpenChange={(open) => { if (!open) setViewingItem(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes do Item</DialogTitle>
            </DialogHeader>
            {viewingItem && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Código</p><p className="font-medium">{viewingItem.codigo}</p></div>
                  <div><p className="text-xs text-muted-foreground">Categoria</p><Badge variant="outline">{viewingItem.categoria}</Badge></div>
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Descrição</p><p className="font-medium">{viewingItem.descricao}</p></div>
                  <div><p className="text-xs text-muted-foreground">Quantidade</p><p className="font-bold text-lg">{viewingItem.quantidade}</p></div>
                  <div><p className="text-xs text-muted-foreground">Estoque Mínimo</p><p className="font-medium">{viewingItem.estoque_minimo}</p></div>
                  <div><p className="text-xs text-muted-foreground">Custo Unitário</p><p className="font-medium">{formatCurrency(viewingItem.custo_unitario)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Preço de Venda</p><p className="font-medium text-success">{formatCurrency(viewingItem.preco_venda)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Fornecedor</p><p className="font-medium">{viewingItem.fornecedor || "-"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Localização</p><p className="font-medium">{viewingItem.localizacao || "-"}</p></div>
                </div>
                <Separator />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { handleEdit(viewingItem); setViewingItem(null); }}>
                    <Edit className="mr-2 h-4 w-4" />Editar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Low Stock Alerts */}
        {itensEstoqueBaixo.length > 0 && (
          <Card className="shadow-soft border-l-4 border-l-destructive">
            <CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Alertas de Estoque Baixo</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {itensEstoqueBaixo.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg cursor-pointer hover:bg-destructive/10 transition-colors" onClick={() => setViewingItem(item)}>
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
