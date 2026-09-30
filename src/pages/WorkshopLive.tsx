import { useEffect, useState, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  LogIn, CheckCheck, Wrench, Hourglass, MonitorPlay, Loader2
} from "lucide-react";

interface FeedItem {
  id: string;
  numero: string;
  cliente: string | null;
  equipamento: string | null;
  status: string;
  prioridade: string;
  tecnico: string;
  evento: "entrada" | "finalizada" | "atualizacao";
  updated_at: string;
}

interface BoardPayload {
  entradas_hoje: number;
  finalizadas_hoje: number;
  em_bancada: number;
  aguardando_aprovacao: number;
  feed: FeedItem[];
}

const STATUS_LABEL: Record<string, string> = {
  recebido: "Recebido", aberta: "Recebido", aguardando_diagnostico: "Diagnóstico",
  aguardando_aprovacao: "Aguard. Aprovação", aprovado: "Aprovado",
  aguardando_peca: "Aguard. Peça", em_reparo: "Em Reparo", em_andamento: "Em Andamento",
  em_testes: "Em Testes", concluida: "Concluída", pronto_retirada: "Pronta",
  entregue: "Entregue", cancelada: "Cancelada",
};

const prioridadeVariant = (p: string) => {
  const v = (p || "normal").toLowerCase();
  if (v === "alta" || v === "urgente") return "destructive" as const;
  if (v === "media") return "default" as const;
  return "secondary" as const;
};

function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    /* áudio indisponível */
  }
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-5 flex items-center gap-4">
      <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
        <Icon className="h-6 w-6 text-emerald-400" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-sm text-white/60 mt-1">{label}</p>
      </div>
    </div>
  );
}

export default function WorkshopLive() {
  const { user } = useAuth();
  const [data, setData] = useState<BoardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const previousFeedRef = useRef<string[]>([]);

  const load = useCallback(async () => {
    try {
      const { data: res } = await supabase.rpc("get_workshop_board" as any);
      const payload = (res ?? null) as BoardPayload | null;
      const ids = (payload?.feed || []).map(f => f.id);
      const prev = previousFeedRef.current;

      if (payload && prev.length > 0) {
        const hasNewEntry = payload.feed.some(f => f.evento === "entrada" && !prev.includes(f.id));
        const hasNewDone = payload.feed.some(f => f.evento === "finalizada" && !prev.includes(f.id));
        if (hasNewEntry || hasNewDone) playChime();
      }

      if (prev.join(",") !== ids.join(",")) previousFeedRef.current = ids;
      setData(payload);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 12000);
    return () => clearInterval(id);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
      </div>
    );
  }

  const d = data || { entradas_hoje: 0, finalizadas_hoje: 0, em_bancada: 0, aguardando_aprovacao: 0, feed: [] };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MonitorPlay className="h-8 w-8 text-emerald-400" />
          <h1 className="text-3xl font-bold tracking-tight">Oficina ao Vivo</h1>
        </div>
        <span className="inline-flex items-center gap-2 text-sm text-white/50">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          ATUALIZADO AUTOMATICAMENTE
        </span>
      </div>

      {!user && (
        <div className="mb-4 bg-amber-500/15 border border-amber-500/30 text-amber-200 px-4 py-2 rounded-lg text-sm">
          Sessão expirada. Esta tela requer um login ativo.
        </div>
      )}

      {/* Métricas globais */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard label="Entradas Hoje" value={d.entradas_hoje} icon={LogIn} />
        <MetricCard label="Finalizadas Hoje" value={d.finalizadas_hoje} icon={CheckCheck} />
        <MetricCard label="Em Andamento na Bancada" value={d.em_bancada} icon={Wrench} />
        <MetricCard label="Aguardando Aprovação" value={d.aguardando_aprovacao} icon={Hourglass} />
      </div>

      {/* Feed geral */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-white/80 mb-3">Movimentação da Oficina</h2>
        {d.feed.length === 0 ? (
          <p className="text-white/40">Aguardando movimentações de OS...</p>
        ) : (
          d.feed.map((f) => (
            <div
              key={f.id}
              className={`flex items-center gap-4 rounded-xl px-4 py-3 border ${
                f.evento === "entrada" ? "bg-emerald-500/10 border-emerald-500/30"
                : f.evento === "finalizada" ? "bg-white/5 border-white/10"
                : "bg-white/[0.03] border-white/10"
              }`}
            >
              <span className="font-mono text-xl font-bold w-32 shrink-0">{f.numero}</span>
              <span className="text-lg font-medium flex-1 min-w-0 truncate">{f.cliente || "—"}</span>
              <span className="text-white/70 hidden md:block">{f.equipamento || "—"}</span>
              <Badge variant={prioridadeVariant(f.prioridade)} className="capitalize">{f.prioridade}</Badge>
              <span className="text-sm text-white/60">{STATUS_LABEL[f.status] || f.status}</span>
              <span className="hidden lg:block text-sm text-white/40">{f.tecnico}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}