import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export type Expense = Database["public"]["Tables"]["technician_expenses"]["Row"];

export type PeriodPreset = "current_month" | "last_month" | "custom";

export interface PeriodRange {
  start: Date;
  end: Date;
  preset: PeriodPreset;
}

export interface TechnicianFinancialData {
  comissoes_realizadas_periodo: number;
  impostos_retidos_periodo: number;
  valor_bruto_periodo: number;
  os_count: number;
  despesas_periodo: number;
  despesas_count: number;
}

export interface OSStatementItem {
  os_numero: string;
  os_id: string;
  role: "PRINCIPAL" | "AUXILIARY" | "VENDA";
  comissao_servicos?: number;
  comissao_pecas?: number;
  data_conclusao: string;
  valor_bruto: number;
  imposto_descontado: number;
  comissao_liquida: number;
  nfe_emitida: boolean;
}

function getPeriodRange(preset: PeriodPreset, customStart?: Date, customEnd?: Date): PeriodRange {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (preset) {
    case "current_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    case "last_month":
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    case "custom":
      start = customStart || new Date(now.getFullYear(), now.getMonth(), 1);
      end = customEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
  }

  return { start, end, preset };
}

function formatDateForDB(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function useTechnicianFinancials() {
  const { user } = useAuth();
  const [data, setData] = useState<TechnicianFinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodRange>(() => getPeriodRange("current_month"));

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data: result, error: rpcError } = await supabase.rpc("get_technician_financial_dashboard", {
        _tecnico_id: user.id,
        _period_start: formatDateForDB(period.start),
        _period_end: formatDateForDB(period.end),
      });
      
      if (rpcError) throw rpcError;
      setData(result && typeof result === "object" && !Array.isArray(result) ? result as unknown as TechnicianFinancialData : null);
    } catch (err: any) {
      console.error("Erro ao buscar dados financeiros do técnico:", err);
      setError(err.message || "Erro ao carregar dados");
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  }, [user?.id, period.start, period.end]);

  const changePeriod = useCallback((preset: PeriodPreset, customStart?: Date, customEnd?: Date) => {
    const newPeriod = getPeriodRange(preset, customStart, customEnd);
    setPeriod(newPeriod);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saldoLiquido = (data?.comissoes_realizadas_periodo || 0) - (data?.despesas_periodo || 0);

  return {
    data,
    loading,
    error,
    period,
    changePeriod,
    refetch: fetchData,
    // KPIs computados
    kpis: {
      ganhos_servicos: data?.comissoes_realizadas_periodo || 0,
      despesas_pessoais: data?.despesas_periodo || 0,
      saldo_liquido: saldoLiquido,
    },
  };
}

export function useTechnicianOSStatement(period: PeriodRange) {
  const { user } = useAuth();
  const [data, setData] = useState<OSStatementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data: result, error: rpcError } = await supabase.rpc("get_technician_os_statement", {
        _tecnico_id: user.id,
        _period_start: formatDateForDB(period.start),
        _period_end: formatDateForDB(period.end),
      });
      
      if (rpcError) throw rpcError;
      setData(Array.isArray(result) ? result as unknown as OSStatementItem[] : []);
    } catch (err: any) {
      console.error("Erro ao buscar extrato de serviços:", err);
      setError(err.message || "Erro ao carregar extrato");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, period.start, period.end]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}

// Helper para formatar período para exibição
export function formatPeriodLabel(period: PeriodRange): string {
  const { start, end, preset } = period;
  
  if (preset === "current_month") return "Mês atual";
  if (preset === "last_month") return "Mês passado";
  
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${fmt(start)} - ${fmt(end)}`;
}