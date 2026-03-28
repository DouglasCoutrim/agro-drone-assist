import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";

export default function Onboarding() {
  const { createOrganization } = useOrganization();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [segmento, setSegmento] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Informe o nome da oficina"); return; }
    if (!segmento) { toast.error("Selecione o segmento"); return; }

    setLoading(true);
    try {
      await createOrganization(name.trim(), segmento);
      toast.success("Oficina cadastrada! Configure os dados da sua empresa.");
      navigate("/empresa", { replace: true });
    } catch (err: any) {
      toast.error("Erro ao cadastrar: " + (err?.message || "Tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-soft">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Zap className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Bem-vindo ao VoltControl</CardTitle>
          <CardDescription>
            Cadastre sua oficina para começar a gerenciar ordens de serviço, estoque e clientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Nome da Oficina *</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Drone Tech Manutenção"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Segmento Principal *</Label>
              <Select value={segmento} onValueChange={setSegmento}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drones">Drones (Agrícola e Consumo)</SelectItem>
                  <SelectItem value="mobilidade">Mobilidade Elétrica (Patinetes, Bikes, Motos)</SelectItem>
                  <SelectItem value="ambos">Drones + Mobilidade</SelectItem>
                  <SelectItem value="outro">Outro / Manutenção Geral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full gradient-primary" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />}
              Cadastrar Oficina
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
