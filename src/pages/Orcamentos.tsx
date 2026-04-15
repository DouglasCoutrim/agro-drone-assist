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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Plus, FileText, Loader2, Edit, Trash2, Eye, ArrowRight, Search } from "lucide-react";
import { CatalogAutocomplete, CatalogResult } from "@/components/ui/catalog-autocomplete";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useTeamMembers } from "@/hooks/useTeamMembers";

type Cliente = Tables<"clientes">;

interface Orcamento {
  id: string;
  cliente_id: string;
  equipamento: string;
  descricao: string;
  valor: number;
  validade: string;
  status: string;
  ordem_servico_id: string | null;
  created_at: string;
  clientes?: { nome: string } | null;
}

export default function Orcamentos() {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const [formData, setFormData] = useState({
    cliente_id: "",
    equipamento: "",
    descricao: "",
    valor: 0,
    validade: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [orcRes, cliRes] = await Promise.all([
        supabase.from("orcamentos").select("*, clientes(nome)").order("created_at", { ascending: false }),
        supabase.from("clientes").select("*").order("nome"),
      ]);
      if (orcRes.error) throw orcRes.error;
      if (cliRes.error) throw cliRes.error;
      setOrcamentos(orcRes.data || []);
      setClientes(cliRes.data || []);
    } catch { toast.error("Erro ao carregar dados"); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      // Get user's organization_id
      let orgId: string | null = null;
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single();
        orgId = profile?.organization_id || null;
      }

      if (editingOrc) {
        const { error } = await supabase.from("orcamentos").update({ ...formData, organization_id: orgId }).eq("id", editingOrc.id);
        if (error) throw error;
        toast.success("Orçamento atualizado!");
      } else {
        const { error } = await supabase.from("orcamentos").insert({ ...formData, organization_id: orgId });
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
      descricao: orc.descricao, valor: orc.valor,
      validade: orc.validade?.split("T")[0] || "",
    });
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
      }).select("id").single();
      if (osErr) throw osErr;

      await supabase.from("orcamentos").update({ status: "convertido", ordem_servico_id: osData.id }).eq("id", orc.id);
      toast.success("Orçamento convertido em OS aprovada!");
      setConvertId(null);
      setViewingOrc(null);
      fetchData();
    } catch (err: any) { toast.error("Erro ao converter: " + err.message); } finally { setFormLoading(false); }
  };

  const resetForm = () => {
    setFormData({ cliente_id: "", equipamento: "", descricao: "", valor: 0, validade: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0] });
    setEditingOrc(null);
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

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
            <p className="text-muted-foreground">Orçamentos rápidos independentes das OS</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary shadow-medium"><Plus className="mr-2 h-4 w-4" />Novo Orçamento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
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
                  <Label>Equipamento *</Label>
                  <CatalogAutocomplete
                    value={formData.equipamento}
                    onChange={(v) => setFormData({ ...formData, equipamento: v })}
                    onSelect={(item) => setFormData(f => ({
                      ...f,
                      equipamento: item.descricao,
                      valor: item.preco > 0 ? item.preco : f.valor,
                    }))}
                    placeholder="Buscar produto ou digitar..."
                    source="produtos"
                    mode="text"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição *</Label>
                  <Textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={3} required placeholder="Descreva o serviço a ser orçado..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor (R$) *</Label>
                    <Input type="number" step="0.01" value={formData.valor} onChange={(e) => setFormData({ ...formData, valor: Number(e.target.value) })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Validade *</Label>
                    <Input type="date" value={formData.validade} onChange={(e) => setFormData({ ...formData, validade: e.target.value })} required />
                  </div>
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
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-medium">{orc.clientes?.nome || "Cliente"}</p>
                          <p className="text-sm text-muted-foreground">{orc.equipamento}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant={sc.variant}>{sc.label}</Badge>
                            <span className="text-xs text-muted-foreground">Validade: {new Date(orc.validade).toLocaleDateString("pt-BR")}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-xl font-bold text-primary">{formatCurrency(orc.valor)}</p>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="ghost" onClick={() => setViewingOrc(orc)}><Eye className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(orc)}><Edit className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(orc.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Detalhes do Orçamento</DialogTitle></DialogHeader>
            {viewingOrc && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Cliente</p><p className="font-medium">{viewingOrc.clientes?.nome || "-"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Equipamento</p><p className="font-medium">{viewingOrc.equipamento}</p></div>
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Descrição</p><p className="text-sm">{viewingOrc.descricao}</p></div>
                  <div><p className="text-xs text-muted-foreground">Valor</p><p className="font-bold text-primary text-lg">{formatCurrency(viewingOrc.valor)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Validade</p><p className="font-medium">{new Date(viewingOrc.validade).toLocaleDateString("pt-BR")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Status</p><Badge variant={(statusConfig[viewingOrc.status] || { variant: "outline" }).variant as any}>{(statusConfig[viewingOrc.status] || { label: viewingOrc.status }).label}</Badge></div>
                  <div><p className="text-xs text-muted-foreground">Criado em</p><p className="text-sm">{new Date(viewingOrc.created_at).toLocaleDateString("pt-BR")}</p></div>
                </div>
                <Separator />
                <div className="flex gap-2 justify-end">
                  {viewingOrc.status === "pendente" && (
                    <>
                      <AlertDialog open={convertId === viewingOrc.id} onOpenChange={(open) => setConvertId(open ? viewingOrc.id : null)}>
                        <Button variant="default" className="gradient-primary gap-2" onClick={() => setConvertId(viewingOrc.id)}>
                          <ArrowRight className="h-4 w-4" />Converter em OS
                        </Button>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Converter em Ordem de Serviço?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Uma nova OS será criada com status "Aprovado" usando os dados deste orçamento. O orçamento será marcado como convertido.
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
                    </>
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
