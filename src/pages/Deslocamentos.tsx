import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { MapPin, Navigation, Plus, DollarSign, Loader2, Route, Calculator } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";

interface Deslocamento {
  id: string;
  origem: string;
  destino: string;
  distanciaKm: number;
  pedagios: number;
  valorKm: number;
  valorTotal: number;
  data: string;
  cliente: string;
}

const mockDeslocamentos: Deslocamento[] = [
  { id: '1', origem: 'Oficina - Goiânia, GO', destino: 'Fazenda Santa Clara - Rio Verde, GO', distanciaKm: 230, pedagios: 45.00, valorKm: 2.50, valorTotal: 620.00, data: '2026-03-01', cliente: 'Fazenda Santa Clara' },
  { id: '2', origem: 'Oficina - Goiânia, GO', destino: 'Cooperativa Agrícola - Jataí, GO', distanciaKm: 320, pedagios: 67.50, valorKm: 2.50, valorTotal: 867.50, data: '2026-02-28', cliente: 'Cooperativa Agrícola' },
];

export default function Deslocamentos() {
  const [deslocamentos, setDeslocamentos] = useState<Deslocamento[]>(mockDeslocamentos);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [formData, setFormData] = useState({
    origem: '', destino: '', cliente: '', valorKm: 2.50, pedagios: 0, distanciaKm: 0
  });

  useEffect(() => {
    // Dynamically load Leaflet CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapLoaded) return;
    import('leaflet').then((L) => {
      const map = L.map(mapRef.current!).setView([-15.7801, -47.9292], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
      setMapLoaded(true);
    });
  }, [mapRef.current]);

  const handleCalcRoute = async () => {
    if (!formData.origem || !formData.destino) {
      toast.error('Preencha origem e destino');
      return;
    }
    setCalculando(true);
    try {
      // Geocode origin
      const origRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.origem)}&limit=1`);
      const origData = await origRes.json();
      
      // Geocode destination
      const destRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.destino)}&limit=1`);
      const destData = await destRes.json();
      
      if (!origData.length || !destData.length) {
        toast.error('Não foi possível encontrar os endereços');
        setCalculando(false);
        return;
      }

      // OSRM route calculation
      const routeRes = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${origData[0].lon},${origData[0].lat};${destData[0].lon},${destData[0].lat}?overview=false`
      );
      const routeData = await routeRes.json();
      
      if (routeData.routes && routeData.routes.length > 0) {
        const distKm = Math.round(routeData.routes[0].distance / 1000);
        setFormData(prev => ({ ...prev, distanciaKm: distKm }));
        toast.success(`Rota calculada: ${distKm} km`);
      } else {
        toast.error('Não foi possível calcular a rota');
      }
    } catch (error) {
      toast.error('Erro ao calcular rota');
    } finally {
      setCalculando(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valorTotal = (formData.distanciaKm * formData.valorKm) + formData.pedagios;
    const novo: Deslocamento = {
      id: Date.now().toString(),
      origem: formData.origem,
      destino: formData.destino,
      distanciaKm: formData.distanciaKm,
      pedagios: formData.pedagios,
      valorKm: formData.valorKm,
      valorTotal,
      data: new Date().toISOString().split('T')[0],
      cliente: formData.cliente
    };
    setDeslocamentos(prev => [novo, ...prev]);
    setDialogOpen(false);
    setFormData({ origem: '', destino: '', cliente: '', valorKm: 2.50, pedagios: 0, distanciaKm: 0 });
    toast.success(`Deslocamento registrado! Total: ${formatCurrency(valorTotal)}`);
  };

  

  const totalKm = deslocamentos.reduce((a, d) => a + d.distanciaKm, 0);
  const totalValor = deslocamentos.reduce((a, d) => a + d.valorTotal, 0);
  const totalPedagios = deslocamentos.reduce((a, d) => a + d.pedagios, 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><MapPin className="h-8 w-8 text-primary" />Deslocamentos</h1>
            <p className="text-muted-foreground">Controle de rotas, quilometragem e pedágios</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary shadow-medium"><Plus className="mr-2 h-4 w-4" />Novo Deslocamento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Registrar Deslocamento</DialogTitle><DialogDescription className="sr-only">Formulário de registro de deslocamento</DialogDescription></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Input value={formData.cliente} onChange={(e) => setFormData({ ...formData, cliente: e.target.value })} placeholder="Nome do cliente" required />
                </div>
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Input value={formData.origem} onChange={(e) => setFormData({ ...formData, origem: e.target.value })} placeholder="Ex: Goiânia, GO" required />
                </div>
                <div className="space-y-2">
                  <Label>Destino</Label>
                  <Input value={formData.destino} onChange={(e) => setFormData({ ...formData, destino: e.target.value })} placeholder="Ex: Rio Verde, GO" required />
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={handleCalcRoute} disabled={calculando}>
                  {calculando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Route className="mr-2 h-4 w-4" />}
                  Calcular Rota (OSRM)
                </Button>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Distância (km)</Label>
                    <Input type="number" value={formData.distanciaKm} onChange={(e) => setFormData({ ...formData, distanciaKm: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>R$/km</Label>
                    <Input type="number" step="0.01" value={formData.valorKm} onChange={(e) => setFormData({ ...formData, valorKm: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Pedágios (R$)</Label>
                    <Input type="number" step="0.01" value={formData.pedagios} onChange={(e) => setFormData({ ...formData, pedagios: Number(e.target.value) })} />
                  </div>
                </div>
                {formData.distanciaKm > 0 && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total estimado:</span>
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency((formData.distanciaKm * formData.valorKm) + formData.pedagios)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="gradient-primary"><Calculator className="mr-2 h-4 w-4" />Registrar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Navigation className="h-5 w-5 text-primary" /></div>
                <div><p className="text-sm text-muted-foreground">Total km</p><p className="text-2xl font-bold">{totalKm.toLocaleString()} km</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10"><Route className="h-5 w-5 text-warning" /></div>
                <div><p className="text-sm text-muted-foreground">Pedágios</p><p className="text-2xl font-bold text-warning">{formatCurrency(totalPedagios)}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10"><DollarSign className="h-5 w-5 text-success" /></div>
                <div><p className="text-sm text-muted-foreground">Valor Total</p><p className="text-2xl font-bold text-success">{formatCurrency(totalValor)}</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map */}
        <Card className="shadow-soft">
          <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />Mapa</CardTitle></CardHeader>
          <CardContent>
            <div ref={mapRef} className="h-[300px] rounded-lg border relative z-0" style={{ zIndex: 0 }} />
          </CardContent>
        </Card>

        {/* List */}
        <Card className="shadow-soft">
          <CardHeader><CardTitle>Histórico de Deslocamentos</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {deslocamentos.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="space-y-1">
                    <p className="font-medium">{d.cliente}</p>
                    <p className="text-sm text-muted-foreground">{d.origem} → {d.destino}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{d.distanciaKm} km</Badge>
                      <span>•</span>
                      <span>Pedágios: {formatCurrency(d.pedagios)}</span>
                      <span>•</span>
                      <span>{new Date(d.data).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-primary">{formatCurrency(d.valorTotal)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
