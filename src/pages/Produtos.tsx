import { useState, useEffect, useMemo, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter, DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus, AlertTriangle, Package, TrendingDown, TrendingUp,
  Edit, Trash2, Loader2, Eye, Search, Tag, ChevronDown,
  FileText, DollarSign, Box
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";
import { useConfirm } from "@/hooks/useConfirm";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { PremiumCard, KpiCard, PremiumTable, AlertBox } from "@/components/premium";
import { useProdutosData, CategoriaProduto, Produto, EstoqueMovimentacao } from "@/hooks/useProdutosData";

export default function Produtos() {
  const { organization } = useOrganization();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const {
    categorias,
    produtos,
    movimentacoes,
    loading,
    error,
    fetchData,
    createCategoria,
    updateCategoria,
    deleteCategoria,
    createProduto,
    updateProduto,
    deleteProduto,
    updateEstoque,
  } = useProdutosData();

  const [activeTab, setActiveTab] = useState<"produtos" | "categorias" | "movimentacoes">("produtos");
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [viewingProduto, setViewingProduto] = useState<Produto | null>(null);
  const [editingCategoria, setEditingCategoria] = useState<CategoriaProduto | null>(null);
  const [categoriaDialogOpen, setCategoriaDialogOpen] = useState(false);
  const isSubmittingRef = useRef(false);

  const [produtoFormData, setProdutoFormData] = useState({
    nome: "",
    descricao: "",
    categoria_id: "",
    ncm: "",
    cfop: "5102",
    preco_custo: 0,
    preco_venda: 0,
    margem_lucro: 0,
    estoque_minimo: 10,
    estoque_atual: 0,
    aplica_icms: true,
    aplica_ipi: false,
    aplica_pis_cofins: true,
    ativo: true,
  });

  const [categoriaFormData, setCategoriaFormData] = useState({
    nome: "",
    descricao: "",
  });

  const [estoqueDialogOpen, setEstoqueDialogOpen] = useState(false);
  const [estoqueProduto, setEstoqueProduto] = useState<Produto | null>(null);
  const [estoqueFormData, setEstoqueFormData] = useState({
    novaQuantidade: 0,
    tipo: "ajuste",
    motivo: "ajuste",
  });

  useEffect(() => {
    if (organization?.id) fetchData();
  }, [organization?.id, fetchData]);

  const resetProdutoForm = () => {
    setProdutoFormData({
      nome: "", descricao: "", categoria_id: "", ncm: "", cfop: "5102",
      preco_custo: 0, preco_venda: 0, margem_lucro: 0,
      estoque_minimo: 10, estoque_atual: 0,
      aplica_icms: true, aplica_ipi: false, aplica_pis_cofins: true, ativo: true,
    });
    setEditingProduto(null);
  };

  const handleOpenNewProduto = () => {
    resetProdutoForm();
    setDialogOpen(true);
  };

  const handleEditProduto = (produto: Produto) => {
    setEditingProduto(produto);
    setProdutoFormData({
      nome: produto.nome,
      descricao: produto.descricao || "",
      categoria_id: produto.categoria_id || "",
      ncm: produto.ncm || "",
      cfop: produto.cfop || "5102",
      preco_custo: produto.preco_custo,
      preco_venda: produto.preco_venda,
      margem_lucro: produto.margem_lucro,
      estoque_minimo: produto.estoque_minimo,
      estoque_atual: produto.estoque_atual,
      aplica_icms: produto.aplica_icms,
      aplica_ipi: produto.aplica_ipi,
      aplica_pis_cofins: produto.aplica_pis_cofins,
      ativo: produto.ativo,
    });
    setDialogOpen(true);
  };

  const handleSubmitProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    if (!organization?.id) {
      toast.error("Sua conta não está vinculada a uma empresa.");
      return;
    }
    isSubmittingRef.current = true;
    setFormLoading(true);
    try {
      if (editingProduto) {
        await updateProduto(editingProduto.id, produtoFormData);
        toast.success("Produto atualizado com sucesso!");
      } else {
        await createProduto({ ...produtoFormData, organization_id: organization.id });
        toast.success("Produto criado com sucesso!");
      }
      setDialogOpen(false);
      resetProdutoForm();
    } catch (err: any) {
      toast.error("Erro ao salvar produto: " + err.message);
    } finally {
      isSubmittingRef.current = false;
      setFormLoading(false);
    }
  };

  const handleDeleteProduto = async (id: string) => {
    if (!await confirm({ title: "Excluir produto", description: "Esta ação não pode ser desfeita.", variant: "destructive", confirmText: "Excluir" })) return;
    try {
      await deleteProduto(id);
      toast.success("Produto excluído com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  const handleOpenEstoque = (produto: Produto) => {
    setEstoqueProduto(produto);
    setEstoqueFormData({ novaQuantidade: produto.estoque_atual, tipo: "ajuste", motivo: "ajuste" });
    setEstoqueDialogOpen(true);
  };

  const handleSubmitEstoque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estoqueProduto || !organization?.id) return;
    try {
      await updateEstoque(
        estoqueProduto.id,
        estoqueFormData.novaQuantidade,
        estoqueFormData.tipo,
        estoqueFormData.motivo,
        undefined,
        undefined
      );
      toast.success("Estoque atualizado!");
      setEstoqueDialogOpen(false);
      setEstoqueProduto(null);
    } catch (err: any) {
      toast.error("Erro ao atualizar estoque: " + err.message);
    }
  };

  // ==================== CATEGORIAS ====================
  const resetCategoriaForm = () => {
    setCategoriaFormData({ nome: "", descricao: "" });
    setEditingCategoria(null);
  };

  const handleOpenNewCategoria = () => {
    resetCategoriaForm();
    setCategoriaDialogOpen(true);
  };

  const handleEditCategoria = (cat: CategoriaProduto) => {
    setEditingCategoria(cat);
    setCategoriaFormData({ nome: cat.nome, descricao: cat.descricao || "" });
    setCategoriaDialogOpen(true);
  };

  const handleSubmitCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;
    try {
      if (editingCategoria) {
        await updateCategoria(editingCategoria.id, categoriaFormData);
        toast.success("Categoria atualizada!");
      } else {
        await createCategoria(categoriaFormData.nome, categoriaFormData.descricao);
        toast.success("Categoria criada!");
      }
      setCategoriaDialogOpen(false);
      resetCategoriaForm();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  const handleDeleteCategoria = async (id: string) => {
    if (!await confirm({ title: "Excluir categoria", description: "Produtos desta categoria ficarão sem categoria.", variant: "destructive", confirmText: "Excluir" })) return;
    try {
      await deleteCategoria(id);
      toast.success("Categoria excluída!");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  // ==================== COMPUTED ====================
  const filteredProdutos = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return produtos.filter((p) =>
      p.nome.toLowerCase().includes(term) ||
      p.descricao?.toLowerCase().includes(term) ||
      p.ncm?.includes(term) ||
      p.categoria_nome?.toLowerCase().includes(term)
    );
  }, [produtos, searchTerm]);

  const produtosEstoqueBaixo = useMemo(() => produtos.filter((p) => p.estoque_atual <= p.estoque_minimo), [produtos]);
  const valorTotalEstoque = useMemo(() => produtos.reduce((acc, p) => acc + p.estoque_atual * p.preco_custo, 0), [produtos]);

  const getStatusInfo = (p: Produto) => {
    if (p.estoque_atual <= 0) return { status: "Sem Estoque", variant: "destructive" as const, icon: TrendingDown };
    if (p.estoque_atual <= p.estoque_minimo) return { status: "Crítico", variant: "destructive" as const, icon: AlertTriangle };
    if (p.estoque_atual <= p.estoque_minimo * 1.5) return { status: "Atenção", variant: "secondary" as const, icon: AlertTriangle };
    return { status: "OK", variant: "default" as const, icon: TrendingUp };
  };

  const tableData = filteredProdutos.map((p) => ({ ...p, statusInfo: getStatusInfo(p) }));

  const columns = [
    { key: "nome", label: "Produto", width: "flex-1" },
    { key: "categoria_nome", label: "Categoria", width: "w-[120px]" },
    { key: "ncm", label: "NCM", width: "w-[100px]" },
    { key: "estoque_atual", label: "Estoque", width: "w-[80px]", align: "right" as const },
    { key: "preco_custo", label: "Custo", width: "w-[100px]", align: "right" as const },
    { key: "preco_venda", label: "Venda", width: "w-[100px]", align: "right" as const },
    { key: "margem_lucro", label: "Margem %", width: "w-[80px]", align: "right" as const },
    { key: "status", label: "Status", width: "w-[100px]", align: "center" as const },
    { key: "acoes", label: "Ações", width: "w-[120px]" },
  ];

  const renderCell = (item: any, key: string) => {
    if (key === "estoque_atual") {
      return (
        <div className="text-right">
          <span className="font-bold">{item.estoque_atual}</span>
          <span className="text-xs text-gray-500 block">min: {item.estoque_minimo}</span>
        </div>
      );
    }
    if (key === "preco_custo") return <span className="font-medium">{formatCurrency(item.preco_custo)}</span>;
    if (key === "preco_venda") return <span className="font-medium text-green-700">{formatCurrency(item.preco_venda)}</span>;
    if (key === "margem_lucro") {
      const color = item.margem_lucro >= 30 ? "text-green-700" : item.margem_lucro >= 15 ? "text-yellow-700" : "text-red-700";
      return <span className={`font-medium ${color}`}>{item.margem_lucro.toFixed(1)}%</span>;
    }
    if (key === "categoria_nome") return <Badge variant="outline">{item.categoria_nome || "—"}</Badge>;
    if (key === "ncm") return <span className="font-mono text-sm">{item.ncm || "—"}</span>;
    if (key === "status") {
      const { status, variant, icon: Icon } = item.statusInfo;
      const variantMap = {
        destructive: "bg-red-50 text-red-700",
        secondary: "bg-yellow-50 text-yellow-700",
        default: "bg-green-50 text-green-700",
      };
      return (
        <Badge variant="outline" className={`gap-1 ${variantMap[variant]}`}>
          <Icon className="h-3 w-3" />{status}
        </Badge>
      );
    }
    if (key === "acoes") {
      return (
        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingProduto(item)}><Eye className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditProduto(item)}><Edit className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleOpenEstoque(item)}><Box className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDeleteProduto(item.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      );
    }
    return item[key];
  };

  // ==================== VIEW DIALOG ====================
  const handleCloseView = () => setViewingProduto(null);

  // ==================== RENDER ====================
  if (loading) return <MainLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Produtos & Estoque</h1>
            <p className="text-gray-500">Gerencie produtos, categorias e movimentações de estoque</p>
          </div>
          {activeTab === "produtos" && <Button onClick={handleOpenNewProduto}><Plus className="h-4 w-4 mr-2" />Novo Produto</Button>}
          {activeTab === "categorias" && <Button onClick={handleOpenNewCategoria}><Plus className="h-4 w-4 mr-2" />Nova Categoria</Button>}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard label="Total de Produtos" value={produtos.length} icon={Package} />
          <KpiCard label="Estoque Baixo" value={produtosEstoqueBaixo.length} icon={AlertTriangle} color="orange" />
          <KpiCard label="Valor Estoque (Custo)" value={formatCurrency(valorTotalEstoque)} icon={DollarSign} />
          <KpiCard label="Categorias" value={categorias.length} icon={Tag} />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="produtos"><Box className="h-4 w-4 mr-2" />Produtos</TabsTrigger>
            <TabsTrigger value="categorias"><Tag className="h-4 w-4 mr-2" />Categorias</TabsTrigger>
            <TabsTrigger value="movimentacoes"><FileText className="h-4 w-4 mr-2" />Movimentações</TabsTrigger>
          </TabsList>

          {/* PRODUTOS TAB */}
          <TabsContent value="produtos" className="mt-4">
            <div className="mb-4 flex gap-2">
              <Input
                placeholder="Buscar produto, NCM, categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 max-w-md"
              >
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </Input>
            </div>

            <PremiumTable
              data={tableData}
              columns={columns}
              renderCell={renderCell}
              emptyMessage="Nenhum produto cadastrado"
              loading={loading}
            />

            {/* View Dialog */}
            <Dialog open={!!viewingProduto} onOpenChange={handleCloseView}>
              <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader className="shrink-0">
                  <DialogTitle>{viewingProduto?.nome}</DialogTitle>
                  <DialogDescription>{viewingProduto?.descricao}</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-4 pb-24">
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Categoria</Label><p>{viewingProduto?.categoria_nome || "—"}</p></div>
                      <div><Label>NCM</Label><p>{viewingProduto?.ncm || "—"}</p></div>
                      <div><Label>CFOP</Label><p>{viewingProduto?.cfop || "5102"}</p></div>
                      <div><Label>Status</Label><p>{viewingProduto?.ativo ? "Ativo" : "Inativo"}</p></div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-3 gap-4">
                      <div><Label>Estoque Atual</Label><p className="text-2xl font-bold">{viewingProduto?.estoque_atual}</p></div>
                      <div><Label>Estoque Mínimo</Label><p>{viewingProduto?.estoque_minimo}</p></div>
                      <div><Label>Margem</Label><p>{viewingProduto?.margem_lucro.toFixed(1)}%</p></div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-3 gap-4">
                      <div><Label>Preço Custo</Label><p className="text-xl font-bold">{formatCurrency(viewingProduto?.preco_custo || 0)}</p></div>
                      <div><Label>Preço Venda</Label><p className="text-xl font-bold text-green-700">{formatCurrency(viewingProduto?.preco_venda || 0)}</p></div>
                      <div><Label>Lucro Unitário</Label><p className="text-xl font-bold">{formatCurrency((viewingProduto?.preco_venda || 0) - (viewingProduto?.preco_custo || 0))}</p></div>
                    </div>
                    <div className="flex gap-2">
                      <Label className="flex items-center gap-1"><input type="checkbox" checked={viewingProduto?.aplica_icms} readOnly /> ICMS</Label>
                      <Label className="flex items-center gap-1"><input type="checkbox" checked={viewingProduto?.aplica_ipi} readOnly /> IPI</Label>
                      <Label className="flex items-center gap-1"><input type="checkbox" checked={viewingProduto?.aplica_pis_cofins} readOnly /> PIS/COFINS</Label>
                    </div>
                  </div>
                </div>
                <DialogFooter className="shrink-0">
                  <Button variant="outline" onClick={handleCloseView}>Fechar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit/Create Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader className="shrink-0">
                  <DialogTitle>{editingProduto ? "Editar Produto" : "Novo Produto"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmitProduto} id="produto-form" className="flex-1 overflow-y-auto p-4 pb-24">
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label>Nome do Produto *</Label>
                        <Input value={produtoFormData.nome} onChange={(e) => setProdutoFormData({...produtoFormData, nome: e.target.value})} required />
                      </div>
                      <div className="col-span-2">
                        <Label>Descrição</Label>
                        <Input value={produtoFormData.descricao} onChange={(e) => setProdutoFormData({...produtoFormData, descricao: e.target.value})} />
                      </div>
                      <div>
                        <Label>Categoria</Label>
                        <Select value={produtoFormData.categoria_id} onValueChange={(v) => setProdutoFormData({...produtoFormData, categoria_id: v})}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Sem categoria</SelectItem>
                            {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>NCM</Label>
                        <Input value={produtoFormData.ncm} onChange={(e) => setProdutoFormData({...produtoFormData, ncm: e.target.value})} placeholder="Ex: 3926109000" />
                      </div>
                      <div>
                        <Label>CFOP</Label>
                        <Input value={produtoFormData.cfop} onChange={(e) => setProdutoFormData({...produtoFormData, cfop: e.target.value})} placeholder="Ex: 5102" />
                      </div>
                    </div>
                    <Separator />
                    <h4 className="font-semibold">Preços & Margem</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Preço Custo</Label>
                        <NumberInput value={produtoFormData.preco_custo} onChange={(v) => setProdutoFormData({...produtoFormData, preco_custo: v})} step={0.01} />
                      </div>
                      <div>
                        <Label>Preço Venda</Label>
                        <NumberInput value={produtoFormData.preco_venda} onChange={(v) => setProdutoFormData({...produtoFormData, preco_venda: v})} step={0.01} />
                      </div>
                      <div>
                        <Label>Margem Lucro %</Label>
                        <NumberInput value={produtoFormData.margem_lucro} onChange={(v) => setProdutoFormData({...produtoFormData, margem_lucro: v})} step={0.1} readOnly />
                      </div>
                    </div>
                    <Separator />
                    <h4 className="font-semibold">Estoque</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Estoque Atual</Label>
                        <NumberInput value={produtoFormData.estoque_atual} onChange={(v) => setProdutoFormData({...produtoFormData, estoque_atual: v})} step={1} />
                      </div>
                      <div>
                        <Label>Estoque Mínimo</Label>
                        <NumberInput value={produtoFormData.estoque_minimo} onChange={(v) => setProdutoFormData({...produtoFormData, estoque_minimo: v})} step={1} />
                      </div>
                    </div>
                    <Separator />
                    <h4 className="font-semibold">Impostos</h4>
                    <div className="flex gap-4">
                      <Label className="flex items-center gap-2"><input type="checkbox" checked={produtoFormData.aplica_icms} onChange={(e) => setProdutoFormData({...produtoFormData, aplica_icms: e.target.checked})} /> ICMS</Label>
                      <Label className="flex items-center gap-2"><input type="checkbox" checked={produtoFormData.aplica_ipi} onChange={(e) => setProdutoFormData({...produtoFormData, aplica_ipi: e.target.checked})} /> IPI</Label>
                      <Label className="flex items-center gap-2"><input type="checkbox" checked={produtoFormData.aplica_pis_cofins} onChange={(e) => setProdutoFormData({...produtoFormData, aplica_pis_cofins: e.target.checked})} /> PIS/COFINS</Label>
                    </div>
                    <div className="flex items-center gap-4">
                      <Label className="flex items-center gap-2"><input type="checkbox" checked={produtoFormData.ativo} onChange={(e) => setProdutoFormData({...produtoFormData, ativo: e.target.checked})} /> Produto Ativo</Label>
                    </div>
                  </div>
                </form>
                <DialogFooter className="shrink-0">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" form={editingProduto ? undefined : "produto-form"} disabled={formLoading}>{formLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-2" />Salvar</>}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Estoque Dialog */}
            <Dialog open={estoqueDialogOpen} onOpenChange={setEstoqueDialogOpen}>
              <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
                <DialogHeader className="shrink-0">
                  <DialogTitle>Ajustar Estoque: {estoqueProduto?.nome}</DialogTitle>
                  <DialogDescription>Estoque atual: {estoqueProduto?.estoque_atual} | Mínimo: {estoqueProduto?.estoque_minimo}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmitEstoque} id="estoque-form" className="flex-1 overflow-y-auto p-4 pb-24">
                  <div className="grid gap-4 py-4">
                    <div>
                      <Label>Nova Quantidade</Label>
                      <NumberInput value={estoqueFormData.novaQuantidade} onChange={(v) => setEstoqueFormData({...estoqueFormData, novaQuantidade: v})} step={1} required />
                    </div>
                    <div>
                      <Label>Tipo</Label>
                      <Select value={estoqueFormData.tipo} onValueChange={(v) => setEstoqueFormData({...estoqueFormData, tipo: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entrada">Entrada</SelectItem>
                          <SelectItem value="saida">Saída</SelectItem>
                          <SelectItem value="ajuste">Ajuste</SelectItem>
                          <SelectItem value="devolucao">Devolução</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Motivo</Label>
                      <Input value={estoqueFormData.motivo} onChange={(e) => setEstoqueFormData({...estoqueFormData, motivo: e.target.value})} />
                    </div>
                  </div>
                </form>
                <DialogFooter className="shrink-0">
                  <Button type="button" variant="outline" onClick={() => setEstoqueDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" form="estoque-form">Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* CATEGORIAS TAB */}
          <TabsContent value="categorias" className="mt-4">
            <div className="space-y-4">
              {categorias.length === 0 ? (
                <AlertBox type="info" title="Nenhuma categoria" items={[{ label: "", value: "Crie categorias para organizar seus produtos" }]} />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {categorias.map((cat) => (
                    <div key={cat.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{cat.nome}</h3>
                          <p className="text-sm text-gray-500">{cat.descricao || "Sem descrição"}</p>
                          <p className="text-xs text-gray-400 mt-1">Criada em {formatDate(cat.created_at)}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditCategoria(cat)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-red-600" onClick={() => handleDeleteCategoria(cat.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Categoria Dialog */}
            <Dialog open={categoriaDialogOpen} onOpenChange={setCategoriaDialogOpen}>
              <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
                <DialogHeader className="shrink-0">
                  <DialogTitle>{editingCategoria ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmitCategoria} id="categoria-form" className="flex-1 overflow-y-auto p-4 pb-24">
                  <div className="grid gap-4 py-4">
                    <div>
                      <Label>Nome *</Label>
                      <Input value={categoriaFormData.nome} onChange={(e) => setCategoriaFormData({...categoriaFormData, nome: e.target.value})} required />
                    </div>
                    <div className="col-span-2">
                      <Label>Descrição</Label>
                      <Input value={categoriaFormData.descricao} onChange={(e) => setCategoriaFormData({...categoriaFormData, descricao: e.target.value})} />
                    </div>
                  </div>
                </form>
                <DialogFooter className="shrink-0">
                  <Button type="button" variant="outline" onClick={() => setCategoriaDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" form="categoria-form">Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* MOVIMENTAÇÕES TAB */}
          <TabsContent value="movimentacoes" className="mt-4">
            {movimentacoes.length === 0 ? (
              <AlertBox type="info" title="Sem movimentações" items={[{ label: "", value: "As movimentações aparecerão aqui conforme ajustes de estoque" }]} />
            ) : (
              <PremiumTable
                data={movimentacoes}
                columns={[
                  { key: "registrado_em", label: "Data/Hora", width: "w-[150px]" },
                  { key: "produto_nome", label: "Produto", width: "flex-1" },
                  { key: "tipo", label: "Tipo", width: "w-[100px]", align: "center" as const },
                  { key: "motivo", label: "Motivo", width: "w-[100px]" },
                  { key: "quantidade_movimento", label: "Qtd", width: "w-[80px]", align: "right" as const },
                  { key: "quantidade_final", label: "Final", width: "w-[80px]", align: "right" as const },
                  { key: "documento_referencia", label: "Doc. Ref.", width: "w-[120px]" },
                ]}
                renderCell={(item, key) => {
                  if (key === "registrado_em") return <span>{formatDate(item.registrado_em)}</span>;
                  if (key === "tipo") {
                    const colors = { entrada: "bg-green-50 text-green-700", saida: "bg-red-50 text-red-700", ajuste: "bg-blue-50 text-blue-700", devolucao: "bg-purple-50 text-purple-700" };
                    return <Badge variant="outline" className={colors[item.tipo as keyof typeof colors] || "bg-gray-50 text-gray-700"}>{item.tipo}</Badge>;
                  }
                  if (key === "quantidade_movimento") {
                    const color = item.quantidade_movimento > 0 ? "text-green-700" : "text-red-700";
                    const sign = item.quantidade_movimento > 0 ? "+" : "";
                    return <span className={`font-bold ${color}`}>{sign}{item.quantidade_movimento}</span>;
                  }
                  if (key === "quantidade_final") return <span className="font-medium">{item.quantidade_final}</span>;
                  return item[key];
                }}
                emptyMessage="Nenhuma movimentação"
                loading={loading}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}