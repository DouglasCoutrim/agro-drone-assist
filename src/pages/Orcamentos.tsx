import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Plus, FileText, Loader2, Edit, Trash2, Eye, ArrowRight, Search, Send, Download } from "lucide-react";
import { CatalogAutocomplete } from "@/components/ui/catalog-autocomplete";
import { OSItemsSection, OSItem } from "@/components/os/OSItemsSection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { generateOrcamentoPDF, shareOrcamentoViaWhatsApp } from "@/lib/orcamento-pdf";
import { formatCurrency } from "@/lib/formatters";
import { PayButton } from "@/components/PayButton";

type Cliente = Tables<"clientes">;

interface Orcamento {
  id: string;
  cliente_id: string;
  equipamento: string;
  descricao: string;
  valor: number;
  desconto?: number;
  itens?: OSItem[] | any;
  validade: string;
  status: string;
  ordem_servico_id: string | null;
  created_at: string;
  clientes?: { nome: string; telefone?: string } | null;
}

export default function Orcamentos() {
  const { user } = useAuth();
  const { config: empresa } = useEmpresaConfig();
  const { vendedores } = useTeamMembers();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrc, setEditingOrc] = useState<Orcamento | null>(null);
  const [viewingOrc, setViewingOrc] = useState<Orcamento | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [convertId, setConvertId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    cliente_id: "",
    equipamento: "",
    descricao: "",
    desconto: 0,
    validade: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    vendedor_id: "",
  });
  const [items, setItems] = useState<OSItem[]>([]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.valor_total, 0), [items]);
  const total = Math.max(0, subtotal - (formData.desconto || 0));

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single();
      setOrgId(profile?.organization_id || null);
    })();
  }, [user]);

  const fetchData = async () => {
    try {
      const [orcRes, cliRes] = await Promise.all([
        supabase.from("orcamentos").select("*, clientes(nome, telefone)").order("created_at", { ascending: false }),
        supabase.from("clientes").select("*").order("nome"),
      ]);
      if (orcRes.error) throw orcRes.error;
      if (cliRes.error) throw cliRes.error;
      setOrcamentos((orcRes.data || []) as any);
      setClientes(cliRes.data || []);
    } catch { toast.error("Erro ao carregar dados"); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload: any = {
        cliente_id: formData.cliente_id,
        equipamento: formData.equipamento,
        descricao: formData.descricao,
        valor: total,
        desconto: formData.desconto || 0,
        itens: items as any,
        validade: formData.validade,
        organization_id: orgId,
        vendedor_id: formData.vendedor_id || null,
      };
      if (editingOrc) {
        const { error } = await supabase.from("orcamentos").update(payload).eq("id", editingOrc.id);
        if (error) throw error;
        toast.success("Orçamento atualizado!");
      } else {
        const { error } = await supabase.from("orcamentos").insert(payload);
        if (error) throw error;
        toast.success("Orçamento criado!");
      }
      setDialogOpen(false); resetForm(); fetchData();
    } catch (err: any) { toast.error("Erro: " + err.message); } finally { setFormLoading(false); }
  };

  const handleEdit = (orc: Orcamento) => {
    setEditingOrc(orc);
    setFormData({
      cliente_id: orc.cliente_id, equipamento: orc.equipamento,
      descricao: orc.descricao, desconto: Number(orc.desconto || 0),
      validade: orc.validade?.split("T")[0] || "",
      vendedor_id: (orc as any).vendedor_id || "",
    });
    setItems(Array.isArray(orc.itens) ? (orc.itens as OSItem[]) : []);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este orçamento?")) return;
    try {
      const { error } = await supabase.from("orcamentos").delete().eq("id", id);
      if (error) throw error;
      toast.success("Orçamento excluído!"); fetchData();
    } catch (err: any) { toast.error("Erro: " + err.message); }
  };

  const handleConvertToOS = async (orc: Orcamento) => {
    if (!user) return;
    setFormLoading(true);
    try {
      const { data: osData, error: osErr } = await supabase.from("ordens_servico").insert({
        cliente_id: orc.cliente_id,
        tipo_equipamento: "outro" as any,
        modelo_equipamento: orc.equipamento,
        descricao_problema: orc.descricao,
        valor_orcamento: orc.valor,
        numero: "",
        tecnico_id: user.id,
        status: "aprovado" as any,
        prioridade: "media",
      }).select("id, organization_id").single();
      if (osErr) throw osErr;

      // Carry over items
      const orcItems: OSItem[] = Array.isArray(orc.itens) ? (orc.itens as any) : [];
      if (orcItems.length > 0) {
        await supabase.from("itens_os").insert(orcItems.map(it => ({
          ordem_servico_id: osData.id,
          tipo: it.tipo,
          produto_id: it.produto_id || null,
          servico_id: it.servico_id || null,
          descricao: it.descricao,
          quantidade: it.quantidade,
          valor_unitario: it.valor_unitario,
          valor_total: it.valor_total,
          organization_id: osData.organization_id || null,
        })));
      }

      await supabase.from("orcamentos").update({ status: "convertido", ordem_servico_id: osData.id }).eq("id", orc.id);
      toast.success("Orçamento convertido em OS aprovada!");
      setConvertId(null); setViewingOrc(null); fetchData();
    } catch (err: any) { toast.error("Erro ao converter: " + err.message); } finally { setFormLoading(false); }
  };

  const buildPdfData = (orc: Orcamento) => {
    const orcItems: OSItem[] = Array.isArray(orc.itens) ? (orc.itens as any) : [];
    const sub = orcItems.reduce((s, i) => s + i.valor_total, 0);
    const desc = Number(orc.desconto || 0);
    return {
      cliente: orc.clientes?.nome || "Cliente",
      cliente_telefone: orc.clientes?.telefone,
      equipamento: orc.equipamento,
      descricao: orc.descricao,
      itens: orcItems.map(i => ({
        tipo: i.tipo, descricao: i.descricao,
        quantidade: i.quantidade, valor_unitario: i.valor_unitario, valor_total: i.valor_total,
      })),
      subtotal: sub > 0 ? sub : Number(orc.valor),
      desconto: desc,
      total: Number(orc.valor),
      validade: new Date(orc.validade).toLocaleDateString("pt-BR"),
      empresa: {
        nome: empresa.nome_empresa, telefone: empresa.telefone,
        cnpj: empresa.cnpj, endereco: empresa.endereco,
      },
      termos: empresa.termos_servico,
    };
  };

  const handleDownloadPdf = (orc: Orcamento) => {
    const doc = generateOrcamentoPDF(buildPdfData(orc));
    doc.save(`orcamento-${(orc.clientes?.nome || "cliente").replace(/\s+/g, "-").toLowerCase()}.pdf`);
  };

  const handleSendWhatsApp = async (orc: Orcamento) => {
    const phone = orc.clientes?.telefone;
    if (!phone) { toast.error("Cliente não tem telefone cadastrado"); return; }
    try {
      await shareOrcamentoViaWhatsApp(buildPdfData(orc), phone);
      toast.success("Compartilhamento iniciado!");
    } catch (err: any) {
      toast.error("Erro ao compartilhar: " + (err?.message || ""));
    }
  };

  const resetForm = () => {
    setFormData({ cliente_id: "", equipamento: "", descricao: "", desconto: 0, validade: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0], vendedor_id: "" });
    setItems([]);
    setEditingOrc(null);
  };

  const filteredOrcamentos = orcamentos.filter(o =>
    o.clientes?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.equipamento.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.descricao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    pendente: { label: "Pendente", variant: "secondary" },
    aprovado: { label: "Aprovado", variant: "default" },
    convertido: { label: "Convertido em OS", variant: "default" },
    recusado: { label: "Recusado", variant: "destructive" },
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><FileText className="h-8 w-8 text-primary" />Orçamentos</h1>
            <p className="text-muted-foreground">Orçamentos rápidos com peças, serviços e desconto</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary shadow-medium"><Plus className="mr-2 h-4 w-4" />Novo Orçamento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingOrc ? "Editar Orçamento" : "Novo Orçamento"}</DialogTitle>
                <DialogDescription>Preencha os dados do orçamento</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select value={formData.cliente_id} onValueChange={(v) => setFormData({ ...formData, cliente_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                    <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Equipamento / Objeto *</Label>
                  <CatalogAutocomplete
                    value={formData.equipamento}
                    onChange={(v) => setFormData({ ...formData, equipamento: v })}
                    onSelect={(item) => setFormData(f => ({ ...f, equipamento: item.descricao }))}
                    placeholder="Buscar ou digitar..."
                    source="produtos"
                    mode="text"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vendedor Responsável</Label>
                  <Select value={formData.vendedor_id} onValueChange={(v) => setFormData({ ...formData, vendedor_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar vendedor..." /></SelectTrigger>
                    <SelectContent>{vendedores.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={2} placeholder="Observações gerais do orçamento..." />
                </div>

                <Separator />

                {/* Items: products + services */}
                <div className="space-y-3">
                  <Label className="text-sm font-bold">Itens e Serviços</Label>
                  <OSItemsSection
                    items={items}
                    onChange={setItems}
                    organizationId={orgId}
                  />
                </div>

                <Separator />

                {/* Totals + discount */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Desconto (R$)</Label>
                    <NumberInput
                      step="0.01" min="0"
                      value={formData.desconto}
                      onChange={(v) => setFormData({ ...formData, desconto: v })}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Validade *</Label>
                    <Input type="date" value={formData.validade} onChange={(e) => setFormData({ ...formData, validade: e.target.value })} required />
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 text-sm border-t pt-3">
                  <p>Subtotal: <span className="font-semibold">{formatCurrency(subtotal)}</span></p>
                  {formData.desconto > 0 && <p className="text-destructive">Desconto: - {formatCurrency(formData.desconto)}</p>}
                  <p className="text-lg font-bold">Total: <span className="text-primary">{formatCurrency(total)}</span></p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="gradient-primary" disabled={formLoading}>
                    {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingOrc ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-soft card-hover"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{orcamentos.length}</p><p className="text-sm text-muted-foreground">Total</p></CardContent></Card>
          <Card className="shadow-soft card-hover"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-warning">{orcamentos.filter(o => o.status === "pendente").length}</p><p className="text-sm text-muted-foreground">Pendentes</p></CardContent></Card>
          <Card className="shadow-soft card-hover"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-success">{orcamentos.filter(o => o.status === "convertido").length}</p><p className="text-sm text-muted-foreground">Convertidos em OS</p></CardContent></Card>
        </div>

        {/* Search */}
        <Card className="shadow-soft"><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar por cliente, equipamento..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></CardContent></Card>

        {/* List */}
        <Card className="shadow-soft">
          <CardHeader><CardTitle>Lista de Orçamentos</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredOrcamentos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><FileText className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Nenhum orçamento encontrado</p></div>
            ) : (
              <div className="space-y-4">
                {filteredOrcamentos.map((orc) => {
                  const sc = statusConfig[orc.status] || { label: orc.status, variant: "outline" as const };
                  return (
                    <div key={orc.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setViewingOrc(orc)}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="space-y-1 min-w-0">
                          <p className="font-medium truncate">{orc.clientes?.nome || "Cliente"}</p>
                          <p className="text-sm text-muted-foreground truncate">{orc.equipamento}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={sc.variant}>{sc.label}</Badge>
                            <span className="text-xs text-muted-foreground">Validade: {new Date(orc.validade).toLocaleDateString("pt-BR")}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="text-xl font-bold text-primary">{formatCurrency(orc.valor)}</p>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="ghost" title="Enviar WhatsApp" onClick={() => handleSendWhatsApp(orc)}>
                              <Send className="h-4 w-4 text-success" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Visualizar" onClick={() => setViewingOrc(orc)}><Eye className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" title="Editar" onClick={() => handleEdit(orc)}><Edit className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" title="Excluir" onClick={() => handleDelete(orc.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Dialog */}
        <Dialog open={!!viewingOrc} onOpenChange={(open) => { if (!open) setViewingOrc(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Detalhes do Orçamento</DialogTitle></DialogHeader>
            {viewingOrc && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Cliente</p><p className="font-medium">{viewingOrc.clientes?.nome || "-"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Equipamento</p><p className="font-medium">{viewingOrc.equipamento}</p></div>
                  {viewingOrc.descricao && <div className="col-span-2"><p className="text-xs text-muted-foreground">Descrição</p><p className="text-sm">{viewingOrc.descricao}</p></div>}
                  <div><p className="text-xs text-muted-foreground">Total</p><p className="font-bold text-primary text-lg">{formatCurrency(viewingOrc.valor)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Validade</p><p className="font-medium">{new Date(viewingOrc.validade).toLocaleDateString("pt-BR")}</p></div>
                </div>

                {Array.isArray(viewingOrc.itens) && viewingOrc.itens.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Itens</p>
                      {(viewingOrc.itens as OSItem[]).map((it, idx) => (
                        <div key={idx} className="flex justify-between text-sm border-b pb-1">
                          <span className="truncate flex-1">{it.tipo === "servico" ? "🔧 " : "📦 "}{it.descricao} × {it.quantidade}</span>
                          <span className="font-semibold">{formatCurrency(it.valor_total)}</span>
                        </div>
                      ))}
                      {Number(viewingOrc.desconto || 0) > 0 && (
                        <div className="flex justify-between text-sm text-destructive">
                          <span>Desconto</span>
                          <span>- {formatCurrency(Number(viewingOrc.desconto))}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <Separator />
                <div className="flex gap-2 justify-end flex-wrap">
                  <Button variant="outline" onClick={() => handleDownloadPdf(viewingOrc)}>
                    <Download className="mr-2 h-4 w-4" />PDF
                  </Button>
                  <Button variant="default" className="gap-2 bg-success hover:bg-success/90" onClick={() => handleSendWhatsApp(viewingOrc)}>
                    <Send className="h-4 w-4" />Enviar WhatsApp
                  </Button>
                  <PayButton
                    cliente_id={viewingOrc.cliente_id}
                    valor={Number(viewingOrc.valor) - Number(viewingOrc.desconto || 0)}
                    descricao={`Orçamento ${viewingOrc.equipamento || ''}`.trim()}
                    orcamento_id={viewingOrc.id}
                  />
                  {viewingOrc.status === "pendente" && (
                    <AlertDialog open={convertId === viewingOrc.id} onOpenChange={(open) => setConvertId(open ? viewingOrc.id : null)}>
                      <Button variant="default" className="gradient-primary gap-2" onClick={() => setConvertId(viewingOrc.id)}>
                        <ArrowRight className="h-4 w-4" />Converter em OS
                      </Button>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Converter em Ordem de Serviço?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Uma nova OS será criada com status "Aprovado" usando os dados deste orçamento.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleConvertToOS(viewingOrc)} disabled={formLoading}>
                            {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Button variant="outline" onClick={() => { handleEdit(viewingOrc); setViewingOrc(null); }}>
                    <Edit className="mr-2 h-4 w-4" />Editar
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
