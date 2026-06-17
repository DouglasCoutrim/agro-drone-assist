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
import { Plus, MapPin, Loader2, Edit, Trash2, Eye, MessageCircle, Navigation, DollarSign, Search, Route } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { Tables } from "@/integrations/supabase/types";
import { useOrganization } from "@/hooks/useOrganization";
import { useConfirm } from "@/hooks/useConfirm";

type Cliente = Tables<"clientes">;

interface RotaDB {
  id: string;
  cliente_id: string;
  origem: string;
  destino: string;
  distancia_km: number;
  custo_rota: number;
  observacoes: string | null;
  created_at: string;
  clientes?: { nome: string; telefone: string } | null;
}

export default function Rotas() {
  const { organization } = useOrganization();
  const confirm = useConfirm();
  const [rotas, setRotas] = useState<RotaDB[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRota, setEditingRota] = useState<RotaDB | null>(null);
  const [viewingRota, setViewingRota] = useState<RotaDB | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    cliente_id: "",
    origem: "",
    destino: "",
    distancia_km: 0,
    custo_rota: 0,
    observacoes: "",
  });

  useEffect(() => { if (organization?.id) fetchData(); }, [organization?.id]);

  const fetchData = async () => {
    if (!organization?.id) return;
    try {
      const [rotasRes, cliRes] = await Promise.all([
        supabase.from("rotas").select("*, clientes(nome, telefone)").eq("organization_id", organization.id).order("created_at", { ascending: false }),
        supabase.from("clientes").select("*").eq("organization_id", organization.id).order("nome"),
      ]);
      if (rotasRes.error) throw rotasRes.error;
      if (cliRes.error) throw cliRes.error;
      setRotas(rotasRes.data || []);
      setClientes(cliRes.data || []);
    } catch { toast.error("Erro ao carregar dados"); } finally { setLoading(false); }
  };

  const handleCalcRoute = async () => {
    if (!formData.origem || !formData.destino) { toast.error("Preencha origem e destino"); return; }
    setCalculando(true);
    try {
      const [origRes, destRes] = await Promise.all([
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.origem)}&limit=1`).then(r => r.json()),
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.destino)}&limit=1`).then(r => r.json()),
      ]);
      if (!origRes.length || !destRes.length) { toast.error("Endereços não encontrados"); return; }
      const routeRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${origRes[0].lon},${origRes[0].lat};${destRes[0].lon},${destRes[0].lat}?overview=false`);
      const routeData = await routeRes.json();
      if (routeData.routes?.[0]) {
        const distKm = Math.round(routeData.routes[0].distance / 1000);
        setFormData(prev => ({ ...prev, distancia_km: distKm }));
        toast.success(`Rota calculada: ${distKm} km`);
      } else { toast.error("Não foi possível calcular a rota"); }
    } catch { toast.error("Erro ao calcular rota"); } finally { setCalculando(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = { ...formData, observacoes: formData.observacoes || null };
      if (editingRota) {
        const { error } = await supabase.from("rotas").update(payload).eq("id", editingRota.id);
        if (error) throw error;
        toast.success("Rota atualizada!");
      } else {
        const { error } = await supabase.from("rotas").insert({ ...payload, organization_id: organization?.id } as any);
        if (error) throw error;
        toast.success("Rota registrada!");
      }
      setDialogOpen(false); resetForm(); fetchData();
    } catch (err: any) { toast.error("Erro: " + err.message); } finally { setFormLoading(false); }
  };

  const handleEdit = (rota: RotaDB) => {
    setEditingRota(rota);
    setFormData({
      cliente_id: rota.cliente_id, origem: rota.origem, destino: rota.destino,
      distancia_km: rota.distancia_km, custo_rota: rota.custo_rota, observacoes: rota.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await confirm({ title: 'Excluir rota', description: 'Esta ação não pode ser desfeita.', variant: 'destructive', confirmText: 'Excluir' })) return;
    try {
      const { error } = await supabase.from("rotas").delete().eq("id", id);
      if (error) throw error;
      toast.success("Rota excluída!"); fetchData();
    } catch (err: any) { toast.error("Erro: " + err.message); }
  };

  const handleWhatsApp = (rota: RotaDB) => {
    const telefone = rota.clientes?.telefone || "";
    const cleanPhone = telefone.replace(/\D/g, "");
    const phone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const texto = `Olá, *${rota.clientes?.nome || "Cliente"}*! 🚗\n\nSegue o detalhamento da rota:\n\n📍 *Origem:* ${rota.origem}\n📍 *Destino:* ${rota.destino}\n📏 *Distância:* ${rota.distancia_km} km\n💰 *Custo da Rota:* ${formatCurrency(rota.custo_rota)}\n${rota.observacoes ? `\n📝 *Obs:* ${rota.observacoes}` : ""}\n\nQualquer dúvida, estamos à disposição!`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(texto)}`, "_blank");
  };

  const resetForm = () => {
    setFormData({ cliente_id: "", origem: "", destino: "", distancia_km: 0, custo_rota: 0, observacoes: "" });
    setEditingRota(null);
  };

  

  const totalKm = rotas.reduce((a, r) => a + Number(r.distancia_km), 0);
  const totalCusto = rotas.reduce((a, r) => a + Number(r.custo_rota), 0);

  const filteredRotas = rotas.filter(r =>
    r.clientes?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.origem.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.destino.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><MapPin className="h-8 w-8 text-primary" />Rotas</h1>
            <p className="text-muted-foreground">Cálculo de rotas e custos de deslocamento</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary shadow-medium"><Plus className="mr-2 h-4 w-4" />Nova Rota</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingRota ? "Editar Rota" : "Nova Rota"}</DialogTitle>
                <DialogDescription>Preencha os dados da rota</DialogDescription>
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
                  <Label>Origem *</Label>
                  <Input value={formData.origem} onChange={(e) => setFormData({ ...formData, origem: e.target.value })} placeholder="Ex: Goiânia, GO" required />
                </div>
                <div className="space-y-2">
                  <Label>Destino *</Label>
                  <Input value={formData.destino} onChange={(e) => setFormData({ ...formData, destino: e.target.value })} placeholder="Ex: Rio Verde, GO" required />
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={handleCalcRoute} disabled={calculando}>
                  {calculando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Route className="mr-2 h-4 w-4" />}
                  Calcular Distância (OSRM)
                </Button>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Distância (km)</Label>
                    <Input type="number" value={formData.distancia_km} onChange={(e) => setFormData({ ...formData, distancia_km: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Custo da Rota (R$) *</Label>
                    <Input type="number" step="0.01" value={formData.custo_rota} onChange={(e) => setFormData({ ...formData, custo_rota: Number(e.target.value) })} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={2} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="gradient-primary" disabled={formLoading}>
                    {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingRota ? "Salvar" : "Registrar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-soft card-hover"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><Navigation className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Total km</p><p className="text-2xl font-bold">{totalKm.toLocaleString()} km</p></div></div></CardContent></Card>
          <Card className="shadow-soft card-hover"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-success/10"><DollarSign className="h-5 w-5 text-success" /></div><div><p className="text-sm text-muted-foreground">Custo Total</p><p className="text-2xl font-bold text-success">{formatCurrency(totalCusto)}</p></div></div></CardContent></Card>
          <Card className="shadow-soft card-hover"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><MapPin className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Rotas Registradas</p><p className="text-2xl font-bold">{rotas.length}</p></div></div></CardContent></Card>
        </div>

        {/* Search */}
        <Card className="shadow-soft"><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar por cliente, origem ou destino..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></CardContent></Card>

        {/* List */}
        <Card className="shadow-soft">
          <CardHeader><CardTitle>Rotas Calculadas</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredRotas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Nenhuma rota encontrada</p></div>
            ) : (
              <div className="space-y-4">
                {filteredRotas.map((rota) => (
                  <div key={rota.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setViewingRota(rota)}>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">{rota.clientes?.nome || "Cliente"}</p>
                        <p className="text-sm text-muted-foreground">{rota.origem} → {rota.destino}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{rota.distancia_km} km</Badge>
                          <span>•</span>
                          <span>{new Date(rota.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-xl font-bold text-primary">{formatCurrency(rota.custo_rota)}</p>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" onClick={() => setViewingRota(rota)}><Eye className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(rota)}><Edit className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(rota.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Dialog */}
        <Dialog open={!!viewingRota} onOpenChange={(open) => { if (!open) setViewingRota(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Detalhes da Rota</DialogTitle></DialogHeader>
            {viewingRota && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Cliente</p><p className="font-medium">{viewingRota.clientes?.nome || "-"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Data</p><p className="font-medium">{new Date(viewingRota.created_at).toLocaleDateString("pt-BR")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Origem</p><p className="font-medium">{viewingRota.origem}</p></div>
                  <div><p className="text-xs text-muted-foreground">Destino</p><p className="font-medium">{viewingRota.destino}</p></div>
                  <div><p className="text-xs text-muted-foreground">Distância</p><p className="font-bold text-lg">{viewingRota.distancia_km} km</p></div>
                  <div><p className="text-xs text-muted-foreground">Custo da Rota</p><p className="font-bold text-primary text-lg">{formatCurrency(viewingRota.custo_rota)}</p></div>
                  {viewingRota.observacoes && <div className="col-span-2"><p className="text-xs text-muted-foreground">Observações</p><p className="text-sm">{viewingRota.observacoes}</p></div>}
                </div>
                <Separator />
                <div className="flex gap-2 justify-end">
                  <Button onClick={() => handleWhatsApp(viewingRota)} className="bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,38%)] text-white">
                    <MessageCircle className="mr-2 h-4 w-4" />Enviar Rota ao Cliente
                  </Button>
                  <Button variant="outline" onClick={() => { handleEdit(viewingRota); setViewingRota(null); }}>
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
