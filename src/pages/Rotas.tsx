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
import { Plus, MapPin, Loader2, Edit, Trash2, Eye, MessageCircle, Navigation, DollarSign, Search, Route, Calculator, Fuel, Gauge, MapPinned, Location, Check } from "lucide-react";
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

type ModoEntrada = "endereco" | "coordenadas";
type ModoCalculo = "combustivel" | "valor_km";

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
  const [calcDialogOpen, setCalcDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    cliente_id: "",
    origem: "",
    destino: "",
    distancia_km: 0,
    custo_rota: 0,
    observacoes: "",
  });

  const [calcForm, setCalcForm] = useState({
    modoEntrada: "endereco" as ModoEntrada,
    origem: "",
    destino: "",
    origemLat: "",
    origemLon: "",
    destinoLat: "",
    destinoLon: "",
    modoCalculo: "combustivel" as ModoCalculo,
    precoLitro: "",
    consumoKm: "",
    valorKm: "",
  });

  const [calcResult, setCalcResult] = useState<{
    distanciaKm: number;
    custoTotal: number;
    custoCombustivel: number;
    custoKm: number;
    litrosUsados: number;
    origem?: { lat: number; lon: number; nome: string };
    destino?: { lat: number; lon: number; nome: string };
  } | null>(null);

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

  const geocodeAddress = async (query: string) => {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), nome: data[0].display_name };
  };

  const handleCalcRoute = async () => {
    if (!calcForm.origem || !calcForm.destino) { toast.error("Preencha origem e destino"); return; }
    setCalculando(true);
    setCalcResult(null);
    try {
      let origemCoords: { lat: number; lon: number; nome: string } | null = null;
      let destinoCoords: { lat: number; lon: number; nome: string } | null = null;

      if (calcForm.modoEntrada === "coordenadas") {
        const oLat = parseFloat(calcForm.origemLat);
        const oLon = parseFloat(calcForm.origemLon);
        const dLat = parseFloat(calcForm.destinoLat);
        const dLon = parseFloat(calcForm.destinoLon);
        if (isNaN(oLat) || isNaN(oLon) || isNaN(dLat) || isNaN(dLon)) {
          toast.error("Informe coordenadas válidas (lat/lon)");
          setCalculando(false);
          return;
        }
        origemCoords = { lat: oLat, lon: oLon, nome: `${oLat}, ${oLon}` };
        destinoCoords = { lat: dLat, lon: dLon, nome: `${dLat}, ${dLon}` };
      } else {
        [origemCoords, destinoCoords] = await Promise.all([
          geocodeAddress(calcForm.origem),
          geocodeAddress(calcForm.destino),
        ]);
        if (!origemCoords || !destinoCoords) { toast.error("Endereços não encontrados"); setCalculando(false); return; }
      }

      const routeRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${origemCoords.lon},${origemCoords.lat};${destinoCoords.lon},${destinoCoords.lat}?overview=false`);
      const routeData = await routeRes.json();
      if (!routeData.routes?.[0]) { toast.error("Não foi possível calcular a rota"); setCalculando(false); return; }

      const distKm = Math.round(routeData.routes[0].distance / 1000);
      let custoTotal = 0;
      let custoComb = 0;
      let custoKm = 0;
      let litros = 0;

      if (calcForm.modoCalculo === "combustivel") {
        const precoL = parseFloat(calcForm.precoLitro);
        const consKm = parseFloat(calcForm.consumoKm);
        if (isNaN(precoL) || isNaN(consKm) || consKm <= 0) { toast.error("Informe preço/litro e consumo válidos"); setCalculando(false); return; }
        litros = (distKm / consKm);
        custoComb = litros * precoL;
        custoTotal = custoComb;
      } else {
        const vKm = parseFloat(calcForm.valorKm);
        if (isNaN(vKm) || vKm <= 0) { toast.error("Informe o valor do km válido"); setCalculando(false); return; }
        custoKm = distKm * vKm;
        custoTotal = custoKm;
      }

      setCalcResult({
        distanciaKm: distKm,
        custoTotal: Math.round(custoTotal * 100) / 100,
        custoCombustivel: Math.round(custoComb * 100) / 100,
        custoKm: Math.round(custoKm * 100) / 100,
        litrosUsados: Math.round(litros * 100) / 100,
        origem: origemCoords,
        destino: destinoCoords,
      });

      setFormData(prev => ({ ...prev, origem: calcForm.origem, destino: calcForm.destino, distancia_km: distKm }));
      toast.success(`Rota calculada: ${distKm} km | ${formatCurrency(custoTotal)}`);
    } catch { toast.error("Erro ao calcular rota"); } finally { setCalculando(false); }
  };

  const handleApplyCalc = () => {
    if (!calcResult) return;
    setFormData(prev => ({ ...prev, distancia_km: calcResult.distanciaKm, custo_rota: calcResult.custoTotal }));
    setCalcDialogOpen(false);
    setCalcResult(null);
    setDialogOpen(true);
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
    setCalcResult(null);
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
                  <Input value={formData.origem} onChange={(e) => setFormData({ ...formData, origem: e.target.value })} placeholder="Ex: Goiânia, GO ou coordenadas" required />
                </div>
                <div className="space-y-2">
                  <Label>Destino *</Label>
                  <Input value={formData.destino} onChange={(e) => setFormData({ ...formData, destino: e.target.value })} placeholder="Ex: Rio Verde, GO ou coordenadas" required />
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={() => { setDialogOpen(false); setCalcDialogOpen(true); }} disabled={!formData.origem || !formData.destino}>
                  <Calculator className="mr-2 h-4 w-4" />Calcular Rota Completa
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

        {/* Calcular Rota Dialog */}
        <Dialog open={calcDialogOpen} onOpenChange={(open) => { setCalcDialogOpen(open); if (!open) setCalcResult(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle><Calculator className="inline h-5 w-5 mr-2 text-primary" />Calculadora de Rota</DialogTitle>
              <DialogDescription>Informe origem, destino e parâmetros de custo para calcular o valor da rota</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Modo de entrada */}
              <div className="space-y-2">
                <Label>Modo de entrada</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={calcForm.modoEntrada === "endereco" ? "default" : "outline"} className="flex-1" onClick={() => setCalcForm(prev => ({ ...prev, modoEntrada: "endereco" }))}>
                    <MapPinned className="mr-2 h-3.5 w-3.5" />Endereço/Cidade
                  </Button>
                  <Button type="button" variant={calcForm.modoEntrada === "coordenadas" ? "default" : "outline"} className="flex-1" onClick={() => setCalcForm(prev => ({ ...prev, modoEntrada: "coordenadas" }))}>
                    <Location className="mr-2 h-3.5 w-3.5" />Coordenadas
                  </Button>
                </div>
              </div>

              {/* Origem */}
              <div className="space-y-2">
                <Label>Origem *</Label>
                {calcForm.modoEntrada === "endereco" ? (
                  <Input value={calcForm.origem} onChange={(e) => setCalcForm(prev => ({ ...prev, origem: e.target.value }))} placeholder="Ex: Goiânia, GO ou endereço completo" />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Lat" value={calcForm.origemLat} onChange={(e) => setCalcForm(prev => ({ ...prev, origemLat: e.target.value }))} type="number" step="any" />
                    <Input placeholder="Lon" value={calcForm.origemLon} onChange={(e) => setCalcForm(prev => ({ ...prev, origemLon: e.target.value }))} type="number" step="any" />
                  </div>
                )}
              </div>

              {/* Destino */}
              <div className="space-y-2">
                <Label>Destino *</Label>
                {calcForm.modoEntrada === "endereco" ? (
                  <Input value={calcForm.destino} onChange={(e) => setCalcForm(prev => ({ ...prev, destino: e.target.value }))} placeholder="Ex: Rio Verde, GO ou endereço completo" />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Lat" value={calcForm.destinoLat} onChange={(e) => setCalcForm(prev => ({ ...prev, destinoLat: e.target.value }))} type="number" step="any" />
                    <Input placeholder="Lon" value={calcForm.destinoLon} onChange={(e) => setCalcForm(prev => ({ ...prev, destinoLon: e.target.value }))} type="number" step="any" />
                  </div>
                )}
              </div>

              <Separator />

              {/* Modo de cálculo */}
              <div className="space-y-2">
                <Label>Modo de cálculo</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={calcForm.modoCalculo === "combustivel" ? "default" : "outline"} className="flex-1" onClick={() => setCalcForm(prev => ({ ...prev, modoCalculo: "combustivel" }))}>
                    <Fuel className="mr-2 h-3.5 w-3.5" />Preço por Litro
                  </Button>
                  <Button type="button" variant={calcForm.modoCalculo === "valor_km" ? "default" : "outline"} className="flex-1" onClick={() => setCalcForm(prev => ({ ...prev, modoCalculo: "valor_km" }))}>
                    <Gauge className="mr-2 h-3.5 w-3.5" />Valor do Km
                  </Button>
                </div>
              </div>

              {calcForm.modoCalculo === "combustivel" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Preço do Litro (R$) *</Label>
                      <Input type="number" step="0.01" value={calcForm.precoLitro} onChange={(e) => setCalcForm(prev => ({ ...prev, precoLitro: e.target.value }))} placeholder="Ex: 5.80" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Consumo (km/l) *</Label>
                      <Input type="number" step="0.1" value={calcForm.consumoKm} onChange={(e) => setCalcForm(prev => ({ ...prev, consumoKm: e.target.value }))} placeholder="Ex: 10" required />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Fuel className="h-3 w-3" />Litros gastos = Distância ÷ Consumo × Preço do litro</p>
                </>
              )}

              {calcForm.modoCalculo === "valor_km" && (
                <div className="space-y-2">
                  <Label>Valor por Km Rodado (R$) *</Label>
                  <Input type="number" step="0.01" value={calcForm.valorKm} onChange={(e) => setCalcForm(prev => ({ ...prev, valorKm: e.target.value }))} placeholder="Ex: 3.50" required />
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Gauge className="h-3 w-3" />Custo total = Distância × Valor do km</p>
                </div>
              )}

              {/* Botão calcular */}
              <Button type="button" className="w-full gradient-primary" onClick={handleCalcRoute} disabled={calculando}>
                {calculando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
                Calcular Rota
              </Button>

              {/* Resultado */}
              {calcResult && (
                <Card className="border-success/30 bg-success/5">
                  <CardHeader>
                    <CardTitle className="text-sm text-success flex items-center gap-2"><Route className="h-4 w-4" />Resultado da Rota</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Distância</p>
                        <p className="font-bold text-lg">{calcResult.distanciaKm} km</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Custo Total</p>
                        <p className="font-bold text-lg text-success">{formatCurrency(calcResult.custoTotal)}</p>
                      </div>
                    </div>
                    {calcForm.modoCalculo === "combustivel" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Litros usados</p>
                          <p>{calcResult.litrosUsados} L</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Custo combustível</p>
                          <p>{formatCurrency(calcResult.custoCombustivel)}</p>
                        </div>
                      </div>
                    )}
                    {calcForm.modoCalculo === "valor_km" && (
                      <div>
                        <p className="text-xs text-muted-foreground">Custo por km</p>
                        <p>{formatCurrency(calcResult.custoKm)}</p>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button type="button" size="sm" className="flex-1" onClick={handleApplyCalc}>
                        <Check className="mr-2 h-3.5 w-3.5" />Usar na Rota
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => { setCalcResult(null); setCalcDialogOpen(false); }}>
                        Fechar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>

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