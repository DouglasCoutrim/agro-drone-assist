import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Edit, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables, Enums } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";

type OrdemServico = Tables<"ordens_servico"> & { clientes: { nome: string } | null };
type Cliente = Tables<"clientes">;

export default function OrdensServico() {
  const { user } = useAuth();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
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
        supabase.from('ordens_servico').select('*, clientes(nome)').order('created_at', { ascending: false }),
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
                        <Button size="sm" variant="outline" onClick={() => handleEdit(os)}><Edit className="h-4 w-4" /></Button>
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
      </div>
    </MainLayout>
  );
}
