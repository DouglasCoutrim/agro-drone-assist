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
import { Plus, Search, Edit, FileText, Loader2, Eye, Printer, MessageCircle, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables, Enums } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";

type OrdemServico = Tables<"ordens_servico"> & { clientes: { nome: string; telefone?: string } | null };
type Cliente = Tables<"clientes">;

export default function OrdensServico() {
  const { user } = useAuth();
  const { config: empresa } = useEmpresaConfig();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingOS, setViewingOS] = useState<OrdemServico | null>(null);
  const [editingOS, setEditingOS] = useState<OrdemServico | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [formData, setFormData] = useState({
    cliente_id: "", tipo_equipamento: "bateria" as Enums<"tipo_equipamento">,
    modelo_equipamento: "", numero_serie: "", descricao_problema: "",
    prioridade: "media", data_previsao: "", valor_orcamento: 0, observacoes: ""
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [ordensRes, clientesRes] = await Promise.all([
        supabase.from('ordens_servico').select('*, clientes(nome, telefone)').order('created_at', { ascending: false }),
        supabase.from('clientes').select('*').order('nome')
      ]);
      if (ordensRes.error) throw ordensRes.error;
      if (clientesRes.error) throw clientesRes.error;
      setOrdens(ordensRes.data || []);
      setClientes(clientesRes.data || []);
    } catch (error: any) { toast.error('Erro ao carregar dados'); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error('Usuário não autenticado'); return; }
    setFormLoading(true);
    try {
      const osData = { ...formData, valor_orcamento: formData.valor_orcamento || null, data_previsao: formData.data_previsao || null };
      if (editingOS) {
        const { error } = await supabase.from('ordens_servico').update(osData).eq('id', editingOS.id);
        if (error) throw error;
        toast.success('OS atualizada com sucesso!');
      } else {
        const { error } = await supabase.from('ordens_servico').insert({ ...osData, numero: '', tecnico_id: user.id });
        if (error) throw error;
        toast.success('OS criada com sucesso!');
      }
      setDialogOpen(false); resetForm(); fetchData();
    } catch (error: any) { toast.error('Erro ao salvar OS: ' + error.message); } finally { setFormLoading(false); }
  };

  const handleEdit = (os: OrdemServico) => {
    setEditingOS(os);
    setFormData({ cliente_id: os.cliente_id, tipo_equipamento: os.tipo_equipamento, modelo_equipamento: os.modelo_equipamento || "", numero_serie: os.numero_serie || "", descricao_problema: os.descricao_problema, prioridade: os.prioridade, data_previsao: os.data_previsao || "", valor_orcamento: os.valor_orcamento || 0, observacoes: os.observacoes || "" });
    setDialogOpen(true);
  };

  const handleView = (os: OrdemServico) => {
    setViewingOS(os);
    setViewDialogOpen(true);
  };

  const handlePrintOS = () => {
    if (!viewingOS) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error('Popup bloqueado. Permita popups para imprimir.'); return; }
    
    const fmtCur = (v: number | null) => v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '-';
    const fmtDt = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

    printWindow.document.write(`<!DOCTYPE html><html><head><title>OS ${viewingOS.numero}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; max-width: 210mm; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #4CAF50; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { font-size: 24px; color: #4CAF50; }
        .header .os-number { font-size: 20px; font-weight: bold; color: #333; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 14px; font-weight: bold; color: #4CAF50; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 12px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
        .field { margin-bottom: 8px; }
        .field-label { font-size: 11px; color: #888; text-transform: uppercase; }
        .field-value { font-size: 14px; font-weight: 500; }
        .full-width { grid-column: 1 / -1; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; background: #E8F5E9; color: #2E7D32; }
        .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 16px; display: flex; justify-content: space-between; }
        .signature { width: 200px; text-align: center; border-top: 1px solid #333; padding-top: 8px; font-size: 12px; }
        @media print { body { padding: 20px; } }
      </style>
    </head><body>
      <div class="header">
        ${empresa.logo_url ? `<img src="${empresa.logo_url}" alt="Logo" style="max-height:50px;margin-right:12px" />` : ''}
        <div><h1>${empresa.nome_empresa || 'Volt Control'}</h1><p style="font-size:12px;color:#888">${empresa.cnpj ? 'CNPJ: ' + empresa.cnpj : ''} ${empresa.telefone ? '| Tel: ' + empresa.telefone : ''}</p>${empresa.endereco ? `<p style="font-size:11px;color:#888">${empresa.endereco}</p>` : ''}</div>
        <div style="text-align:right"><div class="os-number">OS ${viewingOS.numero}</div><div class="status-badge">${getStatusLabel(viewingOS.status)}</div></div>
      </div>
      <div class="section"><div class="section-title">Dados do Cliente</div><div class="grid">
        <div class="field"><div class="field-label">Nome</div><div class="field-value">${viewingOS.clientes?.nome || '-'}</div></div>
      </div></div>
      <div class="section"><div class="section-title">Equipamento</div><div class="grid">
        <div class="field"><div class="field-label">Tipo</div><div class="field-value">${getTipoEquipamento(viewingOS.tipo_equipamento)}</div></div>
        <div class="field"><div class="field-label">Modelo</div><div class="field-value">${viewingOS.modelo_equipamento || '-'}</div></div>
        <div class="field"><div class="field-label">Nº Série</div><div class="field-value">${viewingOS.numero_serie || '-'}</div></div>
        <div class="field"><div class="field-label">Prioridade</div><div class="field-value">${viewingOS.prioridade}</div></div>
      </div></div>
      <div class="section"><div class="section-title">Problema / Diagnóstico</div><div class="grid">
        <div class="field full-width"><div class="field-label">Descrição do Problema</div><div class="field-value">${viewingOS.descricao_problema}</div></div>
        <div class="field full-width"><div class="field-label">Diagnóstico</div><div class="field-value">${viewingOS.diagnostico || '-'}</div></div>
        <div class="field full-width"><div class="field-label">Solução</div><div class="field-value">${viewingOS.solucao || '-'}</div></div>
      </div></div>
      <div class="section"><div class="section-title">Valores e Datas</div><div class="grid">
        <div class="field"><div class="field-label">Valor Orçamento</div><div class="field-value">${fmtCur(viewingOS.valor_orcamento)}</div></div>
        <div class="field"><div class="field-label">Valor Final</div><div class="field-value">${fmtCur(viewingOS.valor_final)}</div></div>
        <div class="field"><div class="field-label">Data Entrada</div><div class="field-value">${fmtDt(viewingOS.data_entrada)}</div></div>
        <div class="field"><div class="field-label">Previsão</div><div class="field-value">${fmtDt(viewingOS.data_previsao)}</div></div>
        <div class="field"><div class="field-label">Conclusão</div><div class="field-value">${fmtDt(viewingOS.data_conclusao)}</div></div>
        <div class="field"><div class="field-label">Entrega</div><div class="field-value">${fmtDt(viewingOS.data_entrega)}</div></div>
      </div></div>
      ${viewingOS.observacoes ? `<div class="section"><div class="section-title">Observações</div><p style="font-size:14px">${viewingOS.observacoes}</p></div>` : ''}
      <div class="footer"><div class="signature">Técnico Responsável</div><div class="signature">Cliente</div></div>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const handleWhatsApp = () => {
    if (!viewingOS) return;
    
    // Get client phone from the related clientes table
    const cliente = clientes.find(c => c.id === viewingOS.cliente_id);
    const telefone = cliente?.telefone || '';
    
    // Clean phone number - keep only digits
    const cleanPhone = telefone.replace(/\D/g, '');
    const phone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    const fmtCur = (v: number | null) => v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : 'A definir';
    
    const texto = `Olá, *${viewingOS.clientes?.nome || 'Cliente'}*! 👋

Aqui é da *${empresa.nome_empresa || 'Volt Control'}*.

Sua Ordem de Serviço está atualizada:

📋 *OS:* ${viewingOS.numero}
🔧 *Equipamento:* ${getTipoEquipamento(viewingOS.tipo_equipamento)}${viewingOS.modelo_equipamento ? ` - ${viewingOS.modelo_equipamento}` : ''}
📌 *Status:* ${getStatusLabel(viewingOS.status)}
💰 *Valor:* ${fmtCur(viewingOS.valor_orcamento)}

${viewingOS.diagnostico ? `🔍 *Diagnóstico:* ${viewingOS.diagnostico}\n` : ''}${viewingOS.observacoes ? `📝 *Obs:* ${viewingOS.observacoes}\n` : ''}
Qualquer dúvida, estamos à disposição!`;
    
    const encoded = encodeURIComponent(texto);
    const url = `https://wa.me/${phone}?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleStatusChange = async (osId: string, newStatus: Enums<"status_os">) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'concluida') updateData.data_conclusao = new Date().toISOString();
      if (newStatus === 'entregue') updateData.data_entrega = new Date().toISOString();
      const { error } = await supabase.from('ordens_servico').update(updateData).eq('id', osId);
      if (error) throw error;
      toast.success('Status atualizado!');
      fetchData();
    } catch (error: any) { toast.error('Erro ao atualizar status: ' + error.message); }
  };

  const resetForm = () => {
    setFormData({ cliente_id: "", tipo_equipamento: "bateria", modelo_equipamento: "", numero_serie: "", descricao_problema: "", prioridade: "media", data_previsao: "", valor_orcamento: 0, observacoes: "" });
    setEditingOS(null);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'aberta': 'Aberta', 'em_andamento': 'Em Andamento', 'aguardando_peca': 'Aguardando Peça',
      'concluida': 'Concluída', 'entregue': 'Entregue', 'cancelada': 'Cancelada',
    };
    return labels[status] || status;
  };

  const getStatusBadge = (status: string) => {
    const cfg: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      'aberta': { label: 'Aberta', variant: 'outline' }, 'em_andamento': { label: 'Em Andamento', variant: 'default' },
      'aguardando_peca': { label: 'Aguardando Peça', variant: 'secondary' }, 'concluida': { label: 'Concluída', variant: 'default' },
      'entregue': { label: 'Entregue', variant: 'default' }, 'cancelada': { label: 'Cancelada', variant: 'destructive' },
    };
    const c = cfg[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const getTipoEquipamento = (tipo: string) => {
    const tipos: Record<string, string> = {
      'drone_agricola': 'Drone Agrícola', 'drone_convencional': 'Drone de Consumo',
      'controle': 'Controle', 'bateria': 'Bateria', 'outro': 'Outro'
    };
    return tipos[tipo] || tipo;
  };

  const formatCurrency = (v: number | null) => v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '-';
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

  const filteredOrdens = ordens.filter(os =>
    os.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
    os.clientes?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    os.descricao_problema.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    abertas: ordens.filter(os => os.status === 'aberta').length,
    emAndamento: ordens.filter(os => os.status === 'em_andamento').length,
    aguardandoPeca: ordens.filter(os => os.status === 'aguardando_peca').length,
    concluidas: ordens.filter(os => os.status === 'concluida' || os.status === 'entregue').length
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><FileText className="h-8 w-8 text-primary" />Ordens de Serviço</h1>
            <p className="text-muted-foreground">Gerencie manutenções de drones, baterias e equipamentos</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild><Button className="gradient-primary shadow-medium"><Plus className="mr-2 h-4 w-4" />Nova OS</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingOS ? 'Editar OS' : 'Nova Ordem de Serviço'}</DialogTitle>
                <DialogDescription>Preencha os dados da ordem de serviço</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Cliente *</Label>
                    <Select value={formData.cliente_id} onValueChange={(v) => setFormData({ ...formData, cliente_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                      <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Equipamento *</Label>
                    <Select value={formData.tipo_equipamento} onValueChange={(v: Enums<"tipo_equipamento">) => setFormData({ ...formData, tipo_equipamento: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="drone_agricola">Drone Agrícola</SelectItem>
                        <SelectItem value="drone_convencional">Drone de Consumo / Enterprise</SelectItem>
                        <SelectItem value="bateria">Bateria</SelectItem>
                        <SelectItem value="controle">Controle Remoto</SelectItem>
                        <SelectItem value="outro">Gerador / Carregador / Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <Select value={formData.prioridade} onValueChange={(v) => setFormData({ ...formData, prioridade: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Modelo</Label><Input value={formData.modelo_equipamento} onChange={(e) => setFormData({ ...formData, modelo_equipamento: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Número de Série</Label><Input value={formData.numero_serie} onChange={(e) => setFormData({ ...formData, numero_serie: e.target.value })} /></div>
                  <div className="col-span-2 space-y-2"><Label>Descrição do Problema *</Label><Textarea value={formData.descricao_problema} onChange={(e) => setFormData({ ...formData, descricao_problema: e.target.value })} rows={3} required /></div>
                  <div className="space-y-2"><Label>Previsão de Entrega</Label><Input type="date" value={formData.data_previsao} onChange={(e) => setFormData({ ...formData, data_previsao: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Valor Orçamento (R$)</Label><Input type="number" step="0.01" value={formData.valor_orcamento} onChange={(e) => setFormData({ ...formData, valor_orcamento: Number(e.target.value) })} /></div>
                  <div className="col-span-2 space-y-2"><Label>Observações</Label><Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={2} /></div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="gradient-primary" disabled={formLoading}>
                    {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingOS ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-soft card-hover"><CardContent className="p-4"><div className="text-center"><p className="text-2xl font-bold text-warning">{stats.abertas}</p><p className="text-sm text-muted-foreground">Abertas</p></div></CardContent></Card>
          <Card className="shadow-soft card-hover"><CardContent className="p-4"><div className="text-center"><p className="text-2xl font-bold text-primary">{stats.emAndamento}</p><p className="text-sm text-muted-foreground">Em Andamento</p></div></CardContent></Card>
          <Card className="shadow-soft card-hover"><CardContent className="p-4"><div className="text-center"><p className="text-2xl font-bold text-secondary-foreground">{stats.aguardandoPeca}</p><p className="text-sm text-muted-foreground">Aguard. Peças</p></div></CardContent></Card>
          <Card className="shadow-soft card-hover"><CardContent className="p-4"><div className="text-center"><p className="text-2xl font-bold text-success">{stats.concluidas}</p><p className="text-sm text-muted-foreground">Concluídas</p></div></CardContent></Card>
        </div>

        <Card className="shadow-soft"><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar por OS, cliente ou equipamento..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></CardContent></Card>

        <Card className="shadow-soft">
          <CardHeader><CardTitle>Lista de Ordens de Serviço</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredOrdens.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><FileText className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Nenhuma ordem de serviço encontrada</p></div>
            ) : (
              <div className="space-y-4">
                {filteredOrdens.map((os) => (
                  <div key={os.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-primary">{os.numero}</p>
                          <Badge variant={os.prioridade === 'alta' ? 'destructive' : os.prioridade === 'media' ? 'secondary' : 'outline'}>{os.prioridade === 'alta' ? 'Alta' : os.prioridade === 'media' ? 'Média' : 'Baixa'}</Badge>
                        </div>
                        <p className="text-sm font-medium">{os.clientes?.nome}</p>
                      </div>
                      <div><p className="text-sm text-muted-foreground">Equipamento</p><p className="font-medium">{getTipoEquipamento(os.tipo_equipamento)}</p>{os.modelo_equipamento && <p className="text-xs text-muted-foreground">{os.modelo_equipamento}</p>}</div>
                      <div><p className="text-sm text-muted-foreground">Status</p>{getStatusBadge(os.status)}</div>
                      <div><p className="text-sm text-muted-foreground">Entrada</p><p className="text-sm">{new Date(os.data_entrada).toLocaleDateString('pt-BR')}</p></div>
                      <div className="flex gap-2 items-start justify-end">
                        <Button size="sm" variant="outline" onClick={() => handleView(os)} title="Visualizar">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleEdit(os)} title="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Select onValueChange={(v: Enums<"status_os">) => handleStatusChange(os.id, v)}>
                          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Ação" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="em_andamento">Iniciar</SelectItem>
                            <SelectItem value="aguardando_peca">Aguard. Peça</SelectItem>
                            <SelectItem value="concluida">Concluir</SelectItem>
                            <SelectItem value="entregue">Entregar</SelectItem>
                            <SelectItem value="cancelada">Cancelar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* View OS Dialog (Read-only) */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>OS {viewingOS?.numero}</span>
                {viewingOS && getStatusBadge(viewingOS.status)}
              </DialogTitle>
              <DialogDescription>Visualização da ordem de serviço</DialogDescription>
            </DialogHeader>
            {viewingOS && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-primary uppercase mb-3">Dados do Cliente</h3>
                  <p className="font-medium">{viewingOS.clientes?.nome || '-'}</p>
                </div>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold text-primary uppercase mb-3">Equipamento</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-muted-foreground">Tipo</p><p className="font-medium">{getTipoEquipamento(viewingOS.tipo_equipamento)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Modelo</p><p className="font-medium">{viewingOS.modelo_equipamento || '-'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Nº Série</p><p className="font-medium">{viewingOS.numero_serie || '-'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Prioridade</p><p className="font-medium capitalize">{viewingOS.prioridade}</p></div>
                  </div>
                </div>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold text-primary uppercase mb-3">Problema e Solução</h3>
                  <div className="space-y-3">
                    <div><p className="text-xs text-muted-foreground">Descrição do Problema</p><p className="text-sm">{viewingOS.descricao_problema}</p></div>
                    <div><p className="text-xs text-muted-foreground">Diagnóstico</p><p className="text-sm">{viewingOS.diagnostico || '-'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Solução</p><p className="text-sm">{viewingOS.solucao || '-'}</p></div>
                  </div>
                </div>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold text-primary uppercase mb-3">Valores e Datas</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-muted-foreground">Valor Orçamento</p><p className="font-medium">{formatCurrency(viewingOS.valor_orcamento)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Valor Final</p><p className="font-medium">{formatCurrency(viewingOS.valor_final)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Data Entrada</p><p className="text-sm">{formatDate(viewingOS.data_entrada)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Previsão</p><p className="text-sm">{formatDate(viewingOS.data_previsao)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Conclusão</p><p className="text-sm">{formatDate(viewingOS.data_conclusao)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Entrega</p><p className="text-sm">{formatDate(viewingOS.data_entrega)}</p></div>
                  </div>
                </div>
                {viewingOS.observacoes && (<><Separator /><div><p className="text-xs text-muted-foreground">Observações</p><p className="text-sm">{viewingOS.observacoes}</p></div></>)}
                
                {/* Action Buttons */}
                <Separator />
                <div className="flex flex-wrap gap-3 justify-end pt-2">
                  <Button variant="outline" onClick={handlePrintOS}>
                    <Download className="mr-2 h-4 w-4" />Baixar PDF
                  </Button>
                  <Button onClick={handleWhatsApp} className="bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,38%)] text-white">
                    <MessageCircle className="mr-2 h-4 w-4" />Enviar WhatsApp
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
