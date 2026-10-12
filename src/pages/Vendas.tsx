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
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Plus, Package, DollarSign, CreditCard, FileText, Search,
  Edit, Trash2, Loader2, Eye, ChevronDown, Truck, User,
  FileCheck, XCircle, AlertTriangle, Download
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useConfirm";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { PremiumCard, KpiCard, PremiumTable, AlertBox } from "@/components/premium";
import { useVendasData, Venda, VendaItem, NotaFiscalEmitida } from "@/hooks/useVendasData";
import { useProdutosData } from "@/hooks/useProdutosData";

const FORMAS_PAGAMENTO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
  { value: "pix", label: "PIX" },
  { value: "cheque", label: "Cheque" },
  { value: "boleto", label: "Boleto" },
];

const STATUS_PAGAMENTO = [
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago" },
  { value: "parcial", label: "Parcial" },
];

export default function Vendas() {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { produtos } = useProdutosData();
  const {
    vendas,
    ganhosTecnico,
    notasFiscais,
    loading,
    error,
    fetchData,
    createVenda,
    updateVenda,
    cancelarVenda,
    emitirNFeVenda,
    emitirNFSeOS,
    cancelarNotaFiscal,
  } = useVendasData();

  const [activeTab, setActiveTab] = useState<"vendas" | "ganhos" | "notas">("vendas");
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVenda, setEditingVenda] = useState<Venda | null>(null);
  const [viewingVenda, setViewingVenda] = useState<Venda | null>(null);
  const [viewingNF, setViewingNF] = useState<NotaFiscalEmitida | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const isSubmittingRef = useRef(false);

  // Form state para nova venda
  const [vendaFormData, setVendaFormData] = useState({
    cliente_id: "",
    cliente_nome: "",
    cliente_cpf_cnpj: "",
    cliente_email: "",
    data_venda: new Date().toISOString().split("T")[0],
    forma_pagamento: "pix",
    status_pagamento: "pendente",
    obs: "",
  });

  const [itensForm, setItensForm] = useState<Array<{
    id: string;
    produto_id: string | null;
    nome_produto: string;
    ncm: string;
    cfop: string;
    quantidade: number;
    preco_unitario: number;
    valor_total: number;
    desconto_percentual: number;
    desconto_valor: number;
    icms_percentual: number | null;
    icms_valor: number | null;
    pis_cofins_valor: number | null;
    ipi_valor: number | null;
  }>>([]);

  useEffect(() => {
    if (organization?.id) fetchData();
  }, [organization?.id, fetchData]);

  const resetVendaForm = () => {
    setVendaFormData({
      cliente_id: "", cliente_nome: "", cliente_cpf_cnpj: "", cliente_email: "",
      data_venda: new Date().toISOString().split("T")[0],
      forma_pagamento: "pix", status_pagamento: "pendente", obs: "",
    });
    setItensForm([]);
    setEditingVenda(null);
  };

  const handleOpenNewVenda = () => {
    resetVendaForm();
    setDialogOpen(true);
  };

  const handleEditVenda = (venda: Venda) => {
    setEditingVenda(venda);
    setVendaFormData({
      cliente_id: venda.cliente_id || "",
      cliente_nome: venda.cliente_nome,
      cliente_cpf_cnpj: venda.cliente_cpf_cnpj || "",
      cliente_email: venda.cliente_email || "",
      data_venda: venda.data_venda,
      forma_pagamento: venda.forma_pagamento || "pix",
      status_pagamento: venda.status_pagamento,
      obs: venda.obs || "",
    });
    setItensForm((venda.itens || []).map((item) => ({
      id: item.id,
      produto_id: item.produto_id,
      nome_produto: item.nome_produto,
      ncm: item.ncm || "",
      cfop: item.cfop || "5102",
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      valor_total: item.valor_total,
      desconto_percentual: item.desconto_percentual,
      desconto_valor: item.desconto_valor,
      icms_percentual: item.icms_percentual,
      icms_valor: item.icms_valor,
      pis_cofins_valor: item.pis_cofins_valor,
      ipi_valor: item.ipi_valor,
    })));
    setDialogOpen(true);
  };

  const handleAddItem = () => {
    const newItem = {
      id: crypto.randomUUID(),
      produto_id: null,
      nome_produto: "",
      ncm: "",
      cfop: "5102",
      quantidade: 1,
      preco_unitario: 0,
      valor_total: 0,
      desconto_percentual: 0,
      desconto_valor: 0,
      icms_percentual: null,
      icms_valor: null,
      pis_cofins_valor: null,
      ipi_valor: null,
    };
    setItensForm((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    setItensForm((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItensForm((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      
      // Auto-calcular valor_total
      if (field === "quantidade" || field === "preco_unitario" || field === "desconto_valor") {
        const qtd = field === "quantidade" ? value : item.quantidade;
        const preco = field === "preco_unitario" ? value : item.preco_unitario;
        const desc = field === "desconto_valor" ? value : item.desconto_valor;
        item.valor_total = Math.max(0, qtd * preco - desc);
      }
      
      // Auto-preencher produto selecionado
      if (field === "produto_id" && value) {
        const prod = produtos.find((p) => p.id === value);
        if (prod) {
          item.nome_produto = prod.nome;
          item.ncm = prod.ncm || "";
          item.cfop = prod.cfop || "5102";
          item.preco_unitario = prod.preco_venda;
          item.valor_total = prod.preco_venda * item.quantidade;
        }
      }
      
      updated[index] = item;
      return updated;
    });
  };

  const handleSubmitVenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    if (!organization?.id || !user) {
      toast.error("Sem permissão");
      return;
    }
    if (itensForm.length === 0) {
      toast.error("Adicione pelo menos um item");
      return;
    }
    if (!vendaFormData.cliente_nome) {
      toast.error("Informe o nome do cliente");
      return;
    }

    isSubmittingRef.current = true;
    setFormLoading(true);
    try {
      // Calculate required totals for the sale
      const subtotal = itensForm.reduce((sum, item) => sum + (item.quantidade * item.preco_unitario), 0);
      const totalDescontos = itensForm.reduce((sum, item) => sum + item.desconto_valor, 0);
      const totalImpostos = itensForm.reduce((sum, item) => sum + 
        (item.icms_valor || 0) + (item.pis_cofins_valor || 0) + (item.ipi_valor || 0), 0);
      const valorTotal = itensForm.reduce((sum, item) => sum + item.valor_total, 0);
      
      // Build complete sale data with all required fields
      const completeVendaData = {
        ...vendaFormData,
        organization_id: organization!.id,
        numero: `VDA-${Date.now()}`, // Generate unique sale number
        valor_produtos: subtotal,
        valor_desconto: totalDescontos,
        valor_impostos: totalImpostos,
        valor_total: valorTotal,
        vendedor_id: user!.id,
        status_pagamento: vendaFormData.status_pagamento as Venda["status_pagamento"],
        forma_pagamento: vendaFormData.forma_pagamento as Venda["forma_pagamento"],
        nf_numero: null,
        nf_chave: null,
        nf_emitida_em: null,
        nf_provider: null,
        vendido_por: null,
        status: "ativo"
      };

      if (editingVenda) {
        await updateVenda(editingVenda.id, completeVendaData);
      } else {
        await createVenda(completeVendaData, itensForm);
      }
      toast.success("Venda criada com sucesso!");
      setDialogOpen(false);
      resetVendaForm();
    } catch (err: any) {
      toast.error("Erro ao criar venda: " + err.message);
    } finally {
      isSubmittingRef.current = false;
      setFormLoading(false);
    }
  };

  const handleCancelarVenda = async (id: string) => {
    if (!await confirm({ title: "Cancelar venda", description: "O estoque será estornado. Continuar?", variant: "destructive", confirmText: "Cancelar Venda" })) return;
    try {
      await cancelarVenda(id);
      toast.success("Venda cancelada e estoque estornado!");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  const handleEmitirNFe = async (vendaId: string) => {
    try {
      setFormLoading(true);
      await emitirNFeVenda(vendaId, "focusnfe");
      toast.success("NFe emitida com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao emitir NFe: " + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleCancelarNF = async (nfId: string) => {
    const motivo = prompt("Motivo do cancelamento:");
    if (!motivo) return;
    try {
      await cancelarNotaFiscal(nfId, motivo);
      toast.success("Nota fiscal cancelada!");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  // ==================== COMPUTED ====================
  const filteredVendas = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return vendas.filter((v) =>
      v.numero.toLowerCase().includes(term) ||
      v.cliente_nome.toLowerCase().includes(term) ||
      v.cliente_cpf_cnpj?.includes(term)
    );
  }, [vendas, searchTerm]);

  const vendasPendentes = useMemo(() => vendas.filter((v) => v.status_pagamento === "pendente").length, [vendas]);
  const valorTotalMes = useMemo(() => {
    const mesAtual = new Date().getMonth();
    const anoAtual = new Date().getFullYear();
    return vendas
      .filter((v) => {
        const d = new Date(v.data_venda);
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
      })
      .reduce((acc, v) => acc + v.valor_total, 0);
  }, [vendas]);

  const statusConfig = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline"; icon: any }> = {
      pendente: { label: "Pendente", variant: "secondary", icon: AlertTriangle },
      pago: { label: "Pago", variant: "default", icon: FileCheck },
      parcial: { label: "Parcial", variant: "outline", icon: AlertTriangle },
      cancelado: { label: "Cancelado", variant: "destructive", icon: XCircle },
    };
    return map[status] || { label: status, variant: "outline", icon: AlertTriangle };
  };

  // ==================== RENDER ====================
  if (loading) return <MainLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Vendas</h1>
            <p className="text-gray-500">Gerencie vendas, emissão de notas e comissões</p>
          </div>
          {activeTab === "vendas" && <Button onClick={handleOpenNewVenda}><Plus className="h-4 w-4 mr-2" />Nova Venda</Button>}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard label="Vendas do Mês" value={formatCurrency(valorTotalMes)} icon={DollarSign} color="green" />
          <KpiCard label="Pendentes" value={vendasPendentes} icon={AlertTriangle} color="orange" />
          <KpiCard label="Total de Vendas" value={vendas.length} icon={Package} color="blue" />
          <KpiCard label="NFs Emitidas" value={notasFiscais.filter((n) => n.status === "autorizado").length} icon={FileCheck} color="purple" />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="vendas"><Package className="h-4 w-4 mr-2" />Vendas</TabsTrigger>
            <TabsTrigger value="ganhos"><DollarSign className="h-4 w-4 mr-2" />Meus Ganhos</TabsTrigger>
            <TabsTrigger value="notas"><FileText className="h-4 w-4 mr-2" />Notas Fiscais</TabsTrigger>
          </TabsList>

          {/* VENDAS TAB */}
          <TabsContent value="vendas" className="mt-4">
            <div className="mb-4 flex gap-2">
              <Input
                placeholder="Buscar venda, cliente, CPF/CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 max-w-md"
              >
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </Input>
            </div>

            <PremiumTable
              data={filteredVendas}
              columns={[
                { key: "numero", label: "Número", width: "w-[110px]" },
                { key: "data_venda", label: "Data", width: "w-[100px]" },
                { key: "cliente_nome", label: "Cliente", width: "flex-1" },
                { key: "valor_total", label: "Total", width: "w-[120px]", align: "right" as const },
                { key: "forma_pagamento", label: "Pagamento", width: "w-[100px]" },
                { key: "status_pagamento", label: "Status", width: "w-[100px]", align: "center" as const },
                { key: "nf_numero", label: "NF-e", width: "w-[100px]" },
                { key: "acoes", label: "Ações", width: "w-[160px]" },
              ]}
              renderCell={(item, key) => {
                if (key === "data_venda") return <span>{formatDate(item.data_venda)}</span>;
                if (key === "valor_total") return <span className="font-bold text-green-700">{formatCurrency(item.valor_total)}</span>;
                if (key === "forma_pagamento") {
                  const f = FORMAS_PAGAMENTO.find((x) => x.value === item.forma_pagamento);
                  return <Badge variant="outline">{f?.label || item.forma_pagamento}</Badge>;
                }
                if (key === "status_pagamento") {
                  const cfg = statusConfig(item.status_pagamento);
                  return <Badge variant={cfg.variant} className="gap-1"><cfg.icon className="h-3 w-3" />{cfg.label}</Badge>;
                }
                if (key === "nf_numero") {
                  if (item.nf_numero) {
                    return (
                      <Badge variant="outline" className="bg-green-50 text-green-700 cursor-pointer" onClick={() => setViewingNF(notasFiscais.find((n) => n.venda_id === item.id)!)}>
                        <FileCheck className="h-3 w-3 mr-1" />{item.nf_numero}
                      </Badge>
                    );
                  }
                  return <span className="text-gray-400">—</span>;
                }
                if (key === "acoes") {
                  return (
                    <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingVenda(item)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditVenda(item)}><Edit className="h-4 w-4" /></Button>
                      {!item.nf_numero && item.status_pagamento !== "cancelado" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleEmitirNFe(item.id)} title="Emitir NFe"><FileText className="h-4 w-4" /></Button>
                      )}
                      {item.nf_numero && item.status_pagamento !== "cancelado" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleCancelarNF(notasFiscais.find((n) => n.venda_id === item.id)!.id)} title="Cancelar NF"><XCircle className="h-4 w-4" /></Button>
                      )}
                      {item.status_pagamento !== "cancelado" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleCancelarVenda(item.id)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  );
                }
                return item[key];
              }}
              emptyMessage="Nenhuma venda cadastrada"
              loading={loading}
            />

            {/* View Dialog */}
            <Dialog open={!!viewingVenda} onOpenChange={() => setViewingVenda(null)}>
              <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader className="shrink-0">
                  <DialogTitle>Venda {viewingVenda?.numero}</DialogTitle>
                  <DialogDescription>Data: {formatDate(viewingVenda?.data_venda)} | {formatCurrency(viewingVenda?.valor_total || 0)}</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-4 pb-24">
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Cliente</Label><p>{viewingVenda?.cliente_nome}</p></div>
                      <div><Label>CPF/CNPJ</Label><p>{viewingVenda?.cliente_cpf_cnpj || "—"}</p></div>
                      <div><Label>Email</Label><p>{viewingVenda?.cliente_email || "—"}</p></div>
                      <div><Label>Pagamento</Label><p>{FORMAS_PAGAMENTO.find(f => f.value === viewingVenda?.forma_pagamento)?.label || viewingVenda?.forma_pagamento}</p></div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-4 gap-4">
                      <div><Label>Produtos</Label><p className="text-xl font-bold">{formatCurrency(viewingVenda?.valor_produtos || 0)}</p></div>
                      <div><Label>Desconto</Label><p className="text-xl font-bold text-red-700">-{formatCurrency(viewingVenda?.valor_desconto || 0)}</p></div>
                      <div><Label>Impostos</Label><p className="text-xl font-bold">{formatCurrency(viewingVenda?.valor_impostos || 0)}</p></div>
                      <div><Label>Total</Label><p className="text-xl font-bold text-green-700">{formatCurrency(viewingVenda?.valor_total || 0)}</p></div>
                    </div>
                    <Separator />
                    <h4 className="font-semibold">Itens</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b"><th className="text-left p-2">Produto</th><th className="text-right p-2">Qtd</th><th className="text-right p-2">Unit.</th><th className="text-right p-2">Desc.</th><th className="text-right p-2">Total</th></tr></thead>
                        <tbody>
                          {viewingVenda?.itens?.map((item) => (
                            <tr key={item.id} className="border-b">
                              <td className="p-2">{item.nome_produto}</td>
                              <td className="text-right p-2">{item.quantidade}</td>
                              <td className="text-right p-2">{formatCurrency(item.preco_unitario)}</td>
                              <td className="text-right p-2">{formatCurrency(item.desconto_valor)}</td>
                              <td className="text-right p-2 font-medium">{formatCurrency(item.valor_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {viewingVenda?.obs && (
                      <div><Label>Observações</Label><p>{viewingVenda?.obs}</p></div>
                    )}
                  </div>
                </div>
                <DialogFooter className="shrink-0">
                  <Button variant="outline" onClick={() => setViewingVenda(null)}>Fechar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader className="shrink-0">
                  <DialogTitle>{editingVenda ? "Editar Venda" : "Nova Venda"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmitVenda} id="venda-form" className="flex-1 overflow-y-auto p-4 pb-24">
                  <div className="grid gap-4 py-4">
                    <h4 className="font-semibold">Dados do Cliente</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label>Nome do Cliente *</Label>
                        <Input value={vendaFormData.cliente_nome} onChange={(e) => setVendaFormData({...vendaFormData, cliente_nome: e.target.value})} required />
                      </div>
                      <div>
                        <Label>CPF/CNPJ</Label>
                        <Input value={vendaFormData.cliente_cpf_cnpj} onChange={(e) => setVendaFormData({...vendaFormData, cliente_cpf_cnpj: e.target.value})} />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input type="email" value={vendaFormData.cliente_email} onChange={(e) => setVendaFormData({...vendaFormData, cliente_email: e.target.value})} />
                      </div>
                    </div>
                    <Separator />
                    <h4 className="font-semibold">Itens da Venda</h4>
                    {itensForm.length === 0 && <p className="text-gray-500 text-center py-4">Nenhum item adicionado</p>}
                    <div className="space-y-2">
                      {itensForm.map((item, idx) => (
                        <div key={item.id} className="border rounded-lg p-3 grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-4">
                            <Label className="text-xs">Produto</Label>
                            <Select value={item.produto_id || ""} onValueChange={(v) => handleItemChange(idx, "produto_id", v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione produto" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Digite manualmente</SelectItem>
                                {produtos.filter(p => p.ativo).map((p) => (
                                  <SelectItem key={p.id} value={p.id}>{p.nome} - {formatCurrency(p.preco_venda)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Nome</Label>
                            <Input value={item.nome_produto} onChange={(e) => handleItemChange(idx, "nome_produto", e.target.value)} />
                          </div>
                          <div className="col-span-1">
                            <Label className="text-xs">Qtd</Label>
                            <NumberInput value={item.quantidade} onChange={(v) => handleItemChange(idx, "quantidade", v)} step={0.001} min={0.001} />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Preço Unit.</Label>
                            <NumberInput value={item.preco_unitario} onChange={(v) => handleItemChange(idx, "preco_unitario", v)} />
                          </div>
                          <div className="col-span-1">
                            <Label className="text-xs">Desc. %</Label>
                            <NumberInput value={item.desconto_percentual} onChange={(v) => handleItemChange(idx, "desconto_percentual", v)} step={0.1} />
                          </div>
                          <div className="col-span-1">
                            <Label className="text-xs">Desc. R$</Label>
                            <NumberInput value={item.desconto_valor} onChange={(v) => handleItemChange(idx, "desconto_valor", v)} />
                          </div>
                          <div className="col-span-1">
                            <Label className="text-xs">Total</Label>
                            <Input value={formatCurrency(item.valor_total)} readOnly className="font-bold text-green-700 text-right" />
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="text-red-600" onClick={() => handleRemoveItem(idx)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                    <Button type="button" variant="outline" onClick={handleAddItem} className="w-fit"><Plus className="h-4 w-4 mr-2" />Adicionar Item</Button>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Data da Venda</Label>
                        <Input type="date" value={vendaFormData.data_venda} onChange={(e) => setVendaFormData({...vendaFormData, data_venda: e.target.value})} />
                      </div>
                      <div>
                        <Label>Forma de Pagamento</Label>
                        <Select value={vendaFormData.forma_pagamento} onValueChange={(v) => setVendaFormData({...vendaFormData, forma_pagamento: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Status Pagamento</Label>
                        <Select value={vendaFormData.status_pagamento} onValueChange={(v) => setVendaFormData({...vendaFormData, status_pagamento: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUS_PAGAMENTO.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Separator />
                    <h4 className="font-semibold">Totais</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div><Label>Subtotal</Label><p className="text-xl font-bold">{formatCurrency(itensForm.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0))}</p></div>
                      <div><Label>Descontos</Label><p className="text-xl font-bold text-red-700">-{formatCurrency(itensForm.reduce((s, i) => s + i.desconto_valor, 0))}</p></div>
                      <div><Label>Impostos (est.)</Label><p className="text-xl font-bold">{formatCurrency(itensForm.reduce((s, i) => s + (i.icms_valor || 0) + (i.pis_cofins_valor || 0) + (i.ipi_valor || 0), 0))}</p></div>
                      <div><Label>Total</Label><p className="text-xl font-bold text-green-700">{formatCurrency(itensForm.reduce((s, i) => s + i.valor_total, 0))}</p></div>
                    </div>
                    <div>
                      <Label>Observações</Label>
                      <Input value={vendaFormData.obs} onChange={(e) => setVendaFormData({...vendaFormData, obs: e.target.value})} />
                    </div>
                  </div>
                </form>
                <DialogFooter className="shrink-0">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" form="venda-form" disabled={formLoading}>{formLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-2" />Salvar</>}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* GANHOS TAB */}
          <TabsContent value="ganhos" className="mt-4">
            {ganhosTecnico.length === 0 ? (
              <AlertBox type="info" title="Nenhum ganho registrado" items={[{ label: "", value: "Suas comissões sobre vendas aparecerão aqui" }]} />
            ) : (
              <PremiumTable
                data={ganhosTecnico}
                columns={[
                  { key: "created_at", label: "Data", width: "w-[100px]" },
                  { key: "venda_id", label: "Venda", width: "w-[120px]" },
                  { key: "valor_venda", label: "Valor Venda", width: "w-[120px]", align: "right" as const },
                  { key: "comissao_percentual", label: "% Comissão", width: "w-[100px]", align: "right" as const },
                  { key: "valor_comissao", label: "Sua Comissão", width: "w-[120px]", align: "right" as const },
                  { key: "status", label: "Status", width: "w-[100px]", align: "center" as const },
                ]}
                renderCell={(item, key) => {
                  if (key === "created_at") return <span>{formatDate(item.created_at)}</span>;
                  if (key === "venda_id") return <span className="font-mono text-sm">{item.venda_id.slice(0, 8)}...</span>;
                  if (key === "valor_venda") return <span>{formatCurrency(item.valor_venda || 0)}</span>;
                  if (key === "comissao_percentual") return <span className="font-medium">{item.comissao_percentual?.toFixed(1) || 0}%</span>;
                  if (key === "valor_comissao") return <span className="font-bold text-green-700">{formatCurrency(item.valor_comissao || 0)}</span>;
                  if (key === "status") {
                    const cfg = statusConfig(item.status);
                    return <Badge variant={cfg.variant} className="gap-1"><cfg.icon className="h-3 w-3" />{cfg.label}</Badge>;
                  }
                  return item[key];
                }}
                emptyMessage="Nenhum ganho"
                loading={loading}
              />
            )}
          </TabsContent>

          {/* NOTAS FISCAIS TAB */}
          <TabsContent value="notas" className="mt-4">
            {notasFiscais.length === 0 ? (
              <AlertBox type="info" title="Nenhuma nota fiscal" items={[{ label: "", value: "Notas emitidas para vendas e OS aparecerão aqui" }]} />
            ) : (
              <PremiumTable
                data={notasFiscais}
                columns={[
                  { key: "tipo", label: "Tipo", width: "w-[80px]", align: "center" as const },
                  { key: "numero", label: "Número", width: "w-[100px]" },
                  { key: "emitida_em", label: "Emissão", width: "w-[150px]" },
                  { key: "cliente_nome", label: "Cliente", width: "flex-1" },
                  { key: "valor_total", label: "Total", width: "w-[120px]", align: "right" as const },
                  { key: "status", label: "Status", width: "w-[120px]", align: "center" as const },
                  { key: "acoes", label: "Ações", width: "w-[120px]" },
                ]}
                renderCell={(item, key) => {
                  if (key === "tipo") {
                    const colors = { nfe: "bg-blue-50 text-blue-700", nfse: "bg-green-50 text-green-700", nfce: "bg-purple-50 text-purple-700" };
                    return <Badge variant="outline" className={colors[item.tipo as keyof typeof colors] || "bg-gray-50 text-gray-700"}>{item.tipo.toUpperCase()}</Badge>;
                  }
                  if (key === "emitida_em") return <span>{formatDateTime(item.emitida_em)}</span>;
                  if (key === "valor_total") return <span className="font-bold">{formatCurrency(item.valor_total || 0)}</span>;
                  if (key === "status") {
                    const statusMap: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
                      autorizado: { label: "Autorizado", variant: "default" },
                      rejeitado: { label: "Rejeitado", variant: "destructive" },
                      cancelado: { label: "Cancelado", variant: "destructive" },
                      pendente: { label: "Pendente", variant: "secondary" },
                    };
                    const cfg = statusMap[item.status || "pendente"];
                    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
                  }
                  if (key === "acoes") {
                    return (
                      <div className="flex gap-1 justify-end">
                        {item.xml_url && (
                          <a href={item.xml_url} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver XML"><Download className="h-4 w-4" /></Button>
                          </a>
                        )}
                        {item.pdf_url && (
                          <a href={item.pdf_url} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver PDF"><FileText className="h-4 w-4" /></Button>
                          </a>
                        )}
                        {item.status === "autorizado" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleCancelarNF(item.id)}><XCircle className="h-4 w-4" /></Button>
                        )}
                      </div>
                    );
                  }
                  return item[key];
                }}
                emptyMessage="Nenhuma nota fiscal"
                loading={loading}
              />
            )}
          </TabsContent>
        </Tabs>

        {/* NF View Dialog */}
        <Dialog open={!!viewingNF} onOpenChange={() => setViewingNF(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle>NF-e {viewingNF?.numero}</DialogTitle>
              <DialogDescription>Chave: {viewingNF?.chave_acesso}</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 pb-24">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Tipo</Label><p>{viewingNF?.tipo?.toUpperCase()}</p></div>
                <div><Label>Status</Label><p>{viewingNF?.status}</p></div>
                <div><Label>Cliente</Label><p>{viewingNF?.cliente_nome}</p></div>
                <div><Label>Emissão</Label><p>{formatDateTime(viewingNF?.emitida_em)}</p></div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Valor Total</Label><p className="text-xl font-bold">{formatCurrency(viewingNF?.valor_total || 0)}</p></div>
                <div><Label>Valor Líquido</Label><p className="text-xl font-bold">{formatCurrency(viewingNF?.valor_liquido || 0)}</p></div>
              </div>
              <Separator />
              <div className="flex gap-2">
                {viewingNF?.xml_url && (
                  <a href={viewingNF.xml_url} target="_blank" rel="noreferrer">
                    <Button variant="outline"><Download className="h-4 w-4 mr-2" />XML</Button>
                  </a>
                )}
                {viewingNF?.pdf_url && (
                  <a href={viewingNF.pdf_url} target="_blank" rel="noreferrer">
                    <Button variant="outline"><FileText className="h-4 w-4 mr-2" />DANFE/PDF</Button>
                  </a>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewingNF(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
