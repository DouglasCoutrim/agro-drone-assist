import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, Square, Plus, Trash2, Edit3 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Apontamento {
  id: string;
  inicio: string;
  fim: string | null;
  horas_lancadas: number | null;
  origem: "cronometro" | "manual";
  observacao: string | null;
  created_at: string;
}

interface OsapontamentoHorasProps {
  osId: string;
  itemOsId?: string;
  tecnicoId: string;
  valorHoraEfetivo: number;
}

export function OsapontamentoHoras({ osId, itemOsId, tecnicoId, valorHoraEfetivo }: OsapontamentoHorasProps) {
  const { user } = useAuth();
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [inicioApto, setInicioApto] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [horasManual, setHorasManual] = useState("");
  const [carregando, setCarregando] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);

  useEffect(() => {
    carregarApontamentos();
  }, [osId]);

  const carregarApontamentos = async () => {
    try {
      const { data, error } = await supabase
        .from("os_apontamentos_horas")
        .select("*")
        .eq("os_id", osId)
        .order("created_at", { ascending: true });
      if (!error && data) setApontamentos(data);
    } catch (e) {
      console.error("Erro ao carregar apontamentos:", e);
    } finally {
      setCarregando(false);
    }
  };

  const iniciarCronometro = async () => {
    try {
      const { data, error } = await supabase
        .from("os_apontamentos_horas")
        .insert({ os_id: osId, item_os_id: itemOsId, tecnico_id: tecnicoId, inicio: new Date().toISOString(), origem: "cronometro" })
        .select()
        .single();
      if (error) throw error;
      setInicioApto(true);
      setCarregando(false);

      timerRef.current = setInterval(() => {
        setTempoDecorrido(prev => prev + 1);
      }, 1000);

      toast.success("Cronômetro iniciado");
    } catch (e: any) {
      toast.error("Erro ao iniciar cronômetro: " + e.message);
    }
  };

  const finalizarCronometro = async () => {
    if (!timerRef.current) return;
    clearInterval(timerRef.current);
    setTempoDecorrido(0);

    try {
      const aberto = apontamentos.find(a => !a.fim);
      if (aberto) {
        const horas = tempoDecorrido / 3600;
        await supabase
          .from("os_apontamentos_horas")
          .update({ fim: new Date().toISOString(), horas_lancadas: Math.round(horas * 100) / 100 })
          .eq("id", aberto.id);
        toast.success(`Cronômetro finalizado: ${horas.toFixed(2)}h`);
      }
      setInicioApto(false);
      carregarApontamentos();
    } catch (e: any) {
      toast.error("Erro ao finalizar cronômetro: " + e.message);
    }
  };

  const lancarManual = async () => {
    if (!horasManual || parseFloat(horasManual) <= 0) {
      toast.error("Informe um valor de horas válido");
      return;
    }
    try {
      await supabase
        .from("os_apontamentos_horas")
        .insert({
          os_id: osId,
          item_os_id: itemOsId,
          tecnico_id: tecnicoId,
          inicio: new Date().toISOString(),
          fim: new Date().toISOString(),
          horas_lancadas: parseFloat(horasManual),
          origem: "manual",
          observacao: observacao || null,
        });
      setObservacao("");
      setHorasManual("");
      toast.success("Horas lançadas manualmente");
      carregarApontamentos();
    } catch (e: any) {
      toast.error("Erro ao lançar horas: " + e.message);
    }
  };

  const excluirApontamento = async (id: string) => {
    try {
      await supabase.from("os_apontamentos_horas").delete().eq("id", id);
      toast.success("Apontamento excluído");
      carregarApontamentos();
    } catch (e: any) {
      toast.error("Erro ao excluir apontamento: " + e.message);
    }
  };

  const totalHoras = apontamentos.reduce((acc, a) => acc + (a.horas_lancadas || 0), 0);
  const valorTotal = totalHoras * valorHoraEfetivo;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Apontamento de Horas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {!inicioApto ? (
            <Button onClick={iniciarCronometro} size="sm">
              <Play className="h-4 w-4 mr-1" /> Iniciar
            </Button>
          ) : (
            <Button onClick={finalizarCronometro} size="sm" variant="destructive">
              <Square className="h-4 w-4 mr-1" /> Finalizar
            </Button>
          )}
          {inicioApto && tempoDecorrido > 0 && (
            <Badge variant="secondary">{formatDistanceToNow(new Date(Date.now() - tempoDecorrido * 1000), { addSuffix: true })}</Badge>
          )}
        </div>

        <div className="border rounded p-3 space-y-2">
          <Label>Lançamento Manual</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.5"
              placeholder="Horas"
              value={horasManual}
              onChange={e => setHorasManual(e.target.value)}
              className="w-24"
            />
            <Input
              placeholder="Observação"
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              className="flex-1"
            />
            <Button onClick={lancarManual} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Lançar
            </Button>
          </div>
        </div>

        <div>
          <h4 className="font-medium text-sm mb-2">Apontamentos</h4>
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : apontamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum apontamento registrado</p>
          ) : (
            <ul className="space-y-2">
              {apontamentos.map(a => (
                <li key={a.id} className="flex items-center justify-between border rounded p-2 text-sm">
                  <div>
                    <Badge variant={a.origem === "cronometro" ? "outline" : "secondary"}>{a.origem}</Badge>
                    <span className="ml-2">
                      {a.horas_lancadas?.toFixed(2) || "—"}h
                      {a.inicio && a.fim && ` — ${formatDistanceToNow(new Date(a.inicio))} até ${formatDistanceToNow(new Date(a.fim))}`}
                    </span>
                    {a.observacao && <p className="text-xs text-muted-foreground">{a.observacao}</p>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => excluirApontamento(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {valorHoraEfetivo > 0 && (
          <div className="border-t pt-2 flex justify-between font-medium">
            <span>Total: {totalHoras.toFixed(2)}h × R${valorHoraEfetivo.toFixed(2)}/h</span>
            <span>R${valorTotal.toFixed(2)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
