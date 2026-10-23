import { useState, useEffect, useMemo, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  Plus, AlertTriangle, Package, TrendingDown, TrendingUp,
  Edit, Trash2, Loader2, Eye, Search
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { SearchableInput } from "@/components/ui/searchable-input";
import { useOrganization } from "@/hooks/useOrganization";
import { useConfirm } from "@/hooks/useConfirm";
import { useNavigate } from "react-router-dom";
import { CsvImportExport, parseNumberBR, emptyToNull } from "@/components/CsvImportExport";
import { PremiumCard, KpiCard, PremiumTable, AlertBox } from "@/components/premium";

const ESTOQUE_CSV_COLUMNS = [
  "codigo", "descricao", "categoria", "quantidade", "estoque_minimo",
  "custo_unitario", "preco_venda", "fornecedor", "localizacao",
];

type ItemEstoque = Tables<"itens_estoque">;

export default function Estoque() {
  const { organization } = useOrganization();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemEstoque | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [viewingItem, setViewingItem] = useState<ItemEstoque | null>(null);
  const isSubmittingRef = useRef(false);

  const [formData, setFormData] = useState({
    codigo: "", descricao: "", categoria: "", quantidade: 0,
    estoque_minimo: 0, custo_unitario: 0, preco_venda: 0,
    fornecedor: "", localizacao: "",
    ncm: "", cest: "", cfop: "5102", origem: 0, csosn: "102", unidade: "UN", gtin: ""
  });

  useEffect(() => {
    if (organization?.id) fetchItens();
  }, [organization?.id]);

  const fetchItens = async () => {
    if (!organization?.id) return;
    try {
      const { data, error } = await supabase.from('itens_estoque').select('*').eq('organization_id', organization.id).order('descricao');
      if (error) throw error;
      setItens(data || []);
    } catch (error: any) { toast.error('Erro ao carregar estoque'); } finally { setLoading(false); }
  };

  const ensureActiveSession = async (): Promise<string | null> => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.access_token) return null;

    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const tokenAboutToExpire = !expiresAt || expiresAt <= Date.now() + 60_000;

    if (tokenAboutToExpire) {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr || !refreshed.session?.access_token) return null;
      return refreshed.session.access_token;
    }

    return session.access_token;
  };

  const redirectToLogin = () => {
    supabase.auth.signOut().catch(() => {});
    toast.error('Sessão expirada. Faça login novamente para continuar.');
    navigate('/auth', { replace: true });
  };

  // Auto-generate code for new items
  const generateCode = async () => {
    try {
      const { data } = await supabase.from('itens_estoque').select('codigo').eq('organization_id', organization?.id || '').order('codigo', { ascending: false });
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

  const fiscalClean = (d: typeof formData) => ({
    ...d,
    ncm: d.ncm.replace(/\D/g, "") || null,
    cest: d.cest.replace(/\D/g, "") || null,
    gtin: d.gtin || null,
    cfop: d.cfop || "5102",
    unidade: d.unidade || "UN",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    if (!organization?.id) {
      toast.error('Sua conta não está vinculada a uma empresa. Contate o administrador.');
      return;
    }
    const faltando = validarProdutoFiscal(formData as any);
    if (faltando.length) { toast.error("Preencha os dados fiscais (NF-e)", { description: faltando.join(" • "), duration: 10000 }); return; }
    isSubmittingRef.current = true;
    setFormLoading(true);
    try {
      if (editingItem) {
        const { error } = await supabase.from('itens_estoque').update(fiscalClean(formData) as any).eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Item atualizado com sucesso!');
      } else {
        const payload = { ...fiscalClean(formData), organization_id: organization.id };
        const { error } = await supabase.from('itens_estoque').insert(payload as any);

        if (error?.code === '23505') {
          const nextCode = await generateCode();
          const { error: retryError } = await supabase
            .from('itens_estoque')
            .insert({ ...payload, codigo: nextCode } as any);
          if (retryError) throw retryError;
        } else if (error) {
          throw error;
        }
        toast.success('Item criado com sucesso!');
      }
      setDialogOpen(false); resetForm(); fetchItens();
    } catch (error: any) {
      const message = error?.code === '23505'
        ? 'Não foi possível reservar um código único para este produto. Tente novamente.'
        : error?.message || 'Não foi possível salvar o produto.';
      toast.error('Erro ao salvar item: ' + message);
    } finally {
      isSubmittingRef.current = false;
      setFormLoading(false);
    }
  };

  const handleEdit = (item: ItemEstoque) => {
    setEditingItem(item);
    setFormData({
      codigo: item.codigo, descricao: item.descricao, categoria: item.categoria,
      quantidade: item.quantidade, estoque_minimo: item.estoque_minimo,
      custo_unitario: item.custo_unitario, preco_venda: item.preco_venda,
      fornecedor: item.fornecedor || "", localizacao: item.localizacao || "",
      ncm: (item as any).ncm || "", cest: (item as any).cest || "", cfop: (item as any).cfop || "5102",
      origem: (item as any).origem ?? 0, csosn: (item as any).csosn || "102", unidade: (item as any).unidade || "UN", gtin: (item as any).gtin || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await confirm({ title: 'Excluir item', description: 'Esta ação não pode ser desfeita.', variant: 'destructive', confirmText: 'Excluir' })) return;
    try {
      const { error } = await supabase.from('itens_estoque').delete().eq('id', id);
      if (error) throw error;
      toast.success('Item excluído com sucesso!'); fetchItens();
    } catch (error: any) { toast.error('Erro ao excluir item: ' + error.message); }
  };

  const resetForm = () => {
    setFormData({ codigo: "", descricao: "", categoria: "", quantidade: 0, estoque_minimo: 0, custo_unitario: 0, preco_venda: 0, fornecedor: "", localizacao: "", ncm: "", cest: "", cfop: "5102", origem: 0, csosn: "102", unidade: "UN", gtin: "" });
    setEditingItem(null);
  };

  const handleOpenNewDialog = async () => {
    resetForm();
    const code = await generateCode();
    setFormData(prev => ({ ...prev, codigo: code }));
    setDialogOpen(true);
  };

  const getStatusInfo = (item: ItemEstoque) => {
    if (item.quantidade <= 0) return { status: 'Sem Estoque', variant: 'destructive' as const, icon: TrendingDown };
    if (item.quantidade <= item.estoque_minimo) return { status: 'Baixo', variant: 'destructive' as const, icon: AlertTriangle };
    if (item.quantidade <= item.estoque_minimo * 1.5) return { status: 'Atenção', variant: 'secondary' as const, icon: AlertTriangle };
    return { status: 'Ok', variant: 'default' as const, icon: TrendingUp };
  };

  const filteredItens = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return itens.filter(item =>
      item.descricao.toLowerCase().includes(term) ||
      item.codigo.toLowerCase().includes(term) ||
      item.categoria.toLowerCase().includes(term)
    );
  }, [itens, searchTerm]);

  const itensEstoqueBaixo = useMemo(() => itens.filter(item => item.quantidade <= item.estoque_minimo), [itens]);
  const valorTotal = useMemo(() => itens.reduce((acc, item) => acc + (item.quantidade * item.custo_unitario), 0), [itens]);
  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const categorias = useMemo(() => [...new Set(itens.map(i => i.categoria).filter(Boolean))], [itens]);
  const fornecedores = useMemo(() => [...new Set(itens.map(i => i.fornecedor).filter(Boolean) as string[])], [itens]);

  // Transform data for PremiumTable
  const tableData = filteredItens.map(item => ({
    ...item,
    statusInfo: getStatusInfo(item),
  }));

  const columns = [
    { key: "codigo", label: "Código", width: "w-[80px]" },
    { key: "descricao", label: "Descrição", width: "flex-1" },
    { key: "categoria", label: "Categoria", width: "w-[100px]", align: "center" as const },
    { key: "quantidade", label: "Qtd", width: "w-[80px]", align: "right" as const },
    { key: "custo_unitario", label: "Custo", width: "w-[100px]", align: "right" as const },
    { key: "preco_venda", label: "Preço Venda", width: "w-[120px]", align: "right" as const },
    { key: "status", label: "Status", width: "w-[100px]", align: "center" as const },
    { key: "acoes", label: "Ações", width: "w-[120px]" },
  ];

  const renderCell = (item: any, key: string) => {
    if (key === "quantidade") {
      return (
        <div className="text-right">
          <span className="font-bold">{item.quantidade}</span>
          <span className="text-xs text-gray-500 block">min: {item.estoque_minimo}</span>
        </div>
      );
    }
    if (key === "custo_unitario") {
      return <span className="font-medium">{formatCurrency(item.custo_unitario)}</span>;
    }
    if (key === "preco_venda") {
      return <span className="font-medium text-green-700">{formatCurrency(item.preco_venda)}</span>;
    }
    if (key === "categoria") {
      return <Badge variant="outline">{item.categoria}</Badge>;
    }
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
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingItem(item)}><Eye className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}><Edit className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
        </div>
      );
    }
    return item[key];
  };

  return (
    <MainLayout>
      <div className="space-y-6 py-8" data-tour="estoque-page">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 font-display leading-tight flex items-center gap-2">
              <Package className="h-7 w-7 text-primary-600" />Estoque
            </h1>
            <p className="text-gray-600 mt-1">Gerencie peças, componentes e materiais</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { window.location.href = "/estoque/importar-xml"; }}>
              Importar XML (NF-e)
            </Button>
            <Button className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold" onClick={handleOpenNewDialog}>
              <Plus className="mr-2 h-4 w-4" />Novo Item
            </Button>
          </div>
        </div>

        {/* CSV Import/Export */}
        <div className="flex items-center gap-2">
          <CsvImportExport
            tableName="itens_estoque"
            organizationId={organization?.id}
            exportColumns={ESTOQUE_CSV_COLUMNS}
            templateColumns={ESTOQUE_CSV_COLUMNS}
            filename="estoque"
            onImported={fetchItens}
            transformRow={(row) => {
              const codigo = (row.codigo || "").trim();
              const descricao = (row.descricao || "").trim();
              if (!codigo || !descricao) return null;
              return {
                codigo,
                descricao,
                categoria: (row.categoria || "").trim() || "Geral",
                quantidade: parseNumberBR(row.quantidade),
                estoque_minimo: parseNumberBR(row.estoque_minimo),
                custo_unitario: parseNumberBR(row.custo_unitario),
                preco_venda: parseNumberBR(row.preco_venda),
                fornecedor: emptyToNull(row.fornecedor),
                localizacao: emptyToNull(row.localizacao),
              };
            }}
          />
        </div>

        {/* KPI Grid */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          <KpiCard
            label="Total de Itens"
            value={itens.length}
            icon={Package}
            color="blue"
            delay={0}
          />
          <KpiCard
            label="Estoque Baixo"
            value={itensEstoqueBaixo.length}
            trend={{ value: itensEstoqueBaixo.length > 0 ? 1 : 0, label: itensEstoqueBaixo.length > 0 ? "itens críticos" : "tudo ok" }}
            icon={AlertTriangle}
            color="yellow"
            delay={100}
          />
          <KpiCard
            label="Valor Total (Custo)"
            value={formatCurrency(valorTotal)}
            icon={TrendingUp}
            color="green"
            delay={200}
          />
          <KpiCard
            label="Categorias"
            value={new Set(itens.map(i => i.categoria)).size}
            icon={Package}
            color="purple"
            delay={300}
          />
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar por código, nome ou categoria..."
            className="pl-9 h-10 text-sm bg-gray-50 border-gray-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Main Table */}
        <PremiumCard delay={100}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Inventário</h2>
            {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          </div>

          <PremiumTable
            columns={columns}
            data={tableData}
            renderCell={renderCell}
            onRowClick={(item) => setViewingItem(item)}
            loading={loading}
            emptyMessage="Nenhum item encontrado"
            emptyIcon={<Package className="h-8 w-8" />}
            emptyAction={{
              label: "Adicionar primeiro item",
              onClick: handleOpenNewDialog
            }}
            animateRows={true}
          />
        </PremiumCard>

        {/* Low Stock Alerts */}
        {itensEstoqueBaixo.length > 0 && (
          <AlertBox
            title={`${itensEstoqueBaixo.length} Itens com Estoque Baixo`}
            items={itensEstoqueBaixo.slice(0, 5).map(item => ({
              label: item.descricao,
              value: `${item.quantidade} un. (mín: ${item.estoque_minimo})`,
            }))}
            type="warning"
            icon={AlertTriangle}
            delay={200}
          />
        )}

        {/* New/Edit Item Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
          <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item'}</DialogTitle>
              <DialogDescription>Preencha os dados do item de estoque</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 pb-24">
              <form onSubmit={handleSubmit} id="estoque-item-form">
                <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código *</Label>
                  <Input id="codigo" value={formData.codigo} onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))} required className="h-10" />
                  {!editingItem && <p className="text-xs text-gray-500">Gerado automaticamente (editável)</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria *</Label>
                  <SearchableInput
                    id="categoria"
                    value={formData.categoria}
                    onChange={(v) => setFormData(prev => ({ ...prev, categoria: v }))}
                    suggestions={categorias}
                    placeholder="Digite ou selecione..."
                    onAddNew={(v) => setFormData(prev => ({ ...prev, categoria: v }))}
                    addNewLabel="Criar categoria"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição *</Label>
                  <Input
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                    placeholder="Digite a descrição do produto..."
                    required
                    className="h-10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="quantidade">Quantidade</Label><NumberInput id="quantidade" value={formData.quantidade} onChange={(v) => setFormData(prev => ({ ...prev, quantidade: v }))} placeholder="0" className="h-10" /></div>
                  <div className="space-y-2"><Label htmlFor="estoque_minimo">Estoque Mínimo</Label><NumberInput id="estoque_minimo" value={formData.estoque_minimo} onChange={(v) => setFormData(prev => ({ ...prev, estoque_minimo: v }))} placeholder="0" className="h-10" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="custo_unitario">Custo Unitário (R$)</Label>
                    <NumberInput id="custo_unitario" step="0.01" value={formData.custo_unitario} onChange={(v) => setFormData(prev => ({ ...prev, custo_unitario: v }))} placeholder="0,00" min={0} className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preco_venda">Preço de Venda (R$)</Label>
                    <NumberInput id="preco_venda" step="0.01" value={formData.preco_venda} onChange={(v) => setFormData(prev => ({ ...prev, preco_venda: v }))} placeholder="0,00" min={0} className="h-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fornecedor">Fornecedor</Label>
                  <SearchableInput
                    id="fornecedor"
                    value={formData.fornecedor}
                    onChange={(v) => setFormData(prev => ({ ...prev, fornecedor: v }))}
                    suggestions={fornecedores}
                    placeholder="Digite ou selecione..."
                    onAddNew={(v) => setFormData(prev => ({ ...prev, fornecedor: v }))}
                    addNewLabel="Adicionar fornecedor"
                  />
                </div>
                <div className="space-y-2"><Label htmlFor="localizacao">Localização</Label><Input id="localizacao" value={formData.localizacao} onChange={(e) => setFormData(prev => ({ ...prev, localizacao: e.target.value }))} placeholder="Ex: Prateleira A1" className="h-10" /></div>
              </div>
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Dados fiscais (NF-e)</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5"><Label htmlFor="ncm">NCM</Label><Input id="ncm" value={formData.ncm} onChange={(e) => setFormData(p => ({ ...p, ncm: e.target.value.replace(/[^\d.]/g, "") }))} placeholder="8 dígitos" inputMode="numeric" maxLength={10} className="h-10 font-mono" /></div>
                  <div className="space-y-1.5"><Label htmlFor="cfop">CFOP</Label><Input id="cfop" value={formData.cfop} onChange={(e) => setFormData(p => ({ ...p, cfop: e.target.value.replace(/\D/g, "") }))} maxLength={4} inputMode="numeric" className="h-10 font-mono" /></div>
                  <div className="space-y-1.5"><Label htmlFor="unidade">Unidade</Label><Input id="unidade" value={formData.unidade} onChange={(e) => setFormData(p => ({ ...p, unidade: e.target.value.toUpperCase() }))} maxLength={6} className="h-10" /></div>
                  <div className="space-y-1.5">
                    <Label>Origem</Label>
                    <Select value={String(formData.origem)} onValueChange={(v) => setFormData(p => ({ ...p, origem: Number(v) }))}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 — Nacional</SelectItem>
                        <SelectItem value="1">1 — Importação direta</SelectItem>
                        <SelectItem value="2">2 — Importada (mercado interno)</SelectItem>
                        <SelectItem value="3">3 — Nacional, 40–70% importado</SelectItem>
                        <SelectItem value="5">5 — Nacional, até 40% importado</SelectItem>
                        <SelectItem value="8">8 — Nacional, mais de 70% importado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>CSOSN (Simples)</Label>
                    <Select value={formData.csosn} onValueChange={(v) => setFormData(p => ({ ...p, csosn: v }))}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="101">101 — Com crédito</SelectItem>
                        <SelectItem value="102">102 — Sem crédito</SelectItem>
                        <SelectItem value="103">103 — Isenção (faixa)</SelectItem>
                        <SelectItem value="300">300 — Imune</SelectItem>
                        <SelectItem value="400">400 — Não tributada</SelectItem>
                        <SelectItem value="500">500 — ICMS já retido (ST)</SelectItem>
                        <SelectItem value="900">900 — Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label htmlFor="cest">CEST</Label><Input id="cest" value={formData.cest} onChange={(e) => setFormData(p => ({ ...p, cest: e.target.value }))} placeholder="Se houver ST" className="h-10 font-mono" /></div>
                  <div className="space-y-1.5 col-span-2 sm:col-span-3"><Label htmlFor="gtin">Código de barras (GTIN/EAN)</Label><Input id="gtin" value={formData.gtin} onChange={(e) => setFormData(p => ({ ...p, gtin: e.target.value.replace(/\D/g, "") }))} placeholder="Opcional" inputMode="numeric" className="h-10 font-mono" /></div>
                </div>
              </div>
            </form>
          </div>
            <DialogFooter className="shrink-0 border-t bg-background">
              <div className="flex justify-end gap-2 w-full p-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" form="estoque-item-form" className="bg-primary-600 hover:bg-primary-700 text-white" disabled={formLoading}>
                  {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingItem ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Item Dialog */}
        <Dialog open={!!viewingItem} onOpenChange={(open) => { if (!open) setViewingItem(null); }}>
          <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle>Detalhes do Item</DialogTitle>
            </DialogHeader>
            {viewingItem && (
              <>
                <div className="flex-1 overflow-y-auto p-4 pb-24">
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><p className="text-xs text-gray-500">Código</p><p className="font-medium">{viewingItem.codigo}</p></div>
                      <div><p className="text-xs text-gray-500">Categoria</p><Badge variant="outline">{viewingItem.categoria}</Badge></div>
                      <div className="col-span-2"><p className="text-xs text-gray-500">Descrição</p><p className="font-medium">{viewingItem.descricao}</p></div>
                      <div><p className="text-xs text-gray-500">Quantidade</p><p className="font-bold text-lg">{viewingItem.quantidade}</p></div>
                      <div><p className="text-xs text-gray-500">Estoque Mínimo</p><p className="font-medium">{viewingItem.estoque_minimo}</p></div>
                      <div><p className="text-xs text-gray-500">Custo Unitário</p><p className="font-medium">{formatCurrency(viewingItem.custo_unitario)}</p></div>
                      <div><p className="text-xs text-gray-500">Preço de Venda</p><p className="font-medium text-green-700">{formatCurrency(viewingItem.preco_venda)}</p></div>
                      <div><p className="text-xs text-gray-500">Fornecedor</p><p className="font-medium">{viewingItem.fornecedor || "-"}</p></div>
                      <div><p className="text-xs text-gray-500">Localização</p><p className="font-medium">{viewingItem.localizacao || "-"}</p></div>
                    </div>
                  </div>
                </div>
                <Separator />
                <DialogFooter className="shrink-0 border-t bg-background">
                  <div className="flex justify-end gap-2 w-full p-4">
                    <Button variant="outline" onClick={() => { handleEdit(viewingItem); setViewingItem(null); }}>
                      <Edit className="mr-2 h-4 w-4" />Editar
                    </Button>
                  </div>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}