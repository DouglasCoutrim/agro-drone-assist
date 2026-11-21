import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { todayDateInput } from "@/lib/formatters";
import type { Database } from "@/integrations/supabase/types";

export type Expense = Database["public"]["Tables"]["technician_expenses"]["Row"];
export type PayoutInvoice = Database["public"]["Tables"]["technician_payout_invoices"]["Row"];
export type PayoutInvoiceItem = Database["public"]["Tables"]["technician_payout_invoice_items"]["Row"];
export type CommissionAdjustment = Database["public"]["Tables"]["commission_adjustments"]["Row"];

export type SituacaoComissao = "A_RECEBER" | "AGUARDANDO_CLIENTE" | "RECEBIDO" | "DIVERGENCIA";

export type PeriodPreset = "hoje" | "semana" | "mes" | "ano" | "custom";

export interface PeriodRange {
  start: Date;
  end: Date;
  preset: PeriodPreset;
}

export interface TechnicianFinancialData {
  periodo_inicio: string;
  periodo_fim: string;
  pix_key: string | null;
  pix_key_type: string | null;
  a_receber: number;
  a_receber_count: number;
  aguardando_cliente: number;
  aguardando_cliente_count: number;
  recebido: number;
  recebido_count: number;
  divergencia: number;
  divergencia_count: number;
  comissao_periodo: number;
  comissao_periodo_count: number;
  recebido_periodo: number;
  recebido_periodo_count: number;
  comissao_pendente: number;
  os_pendentes_count: number;
  despesas_periodo: number;
  despesas_count: number;
  saldo_liquido: number;
  serie_diaria: { dia: string; total: number }[];
}

export interface OSStatementItem {
  os_id: string;
  os_numero: string;
  data_conclusao: string;
  valor_os: number;
  commission_base: number;
  imposto: number;
  custo: number;
  taxa_sem_nota: number;
  loja: number;
  comissao: number;
  commission_rate: number;
  commission_tax_rate: number;
  nfe_emitida: boolean;
  status_os: string;
  congelado_em: string | null;
  pago_em: string | null;
  /** OS calculada pela regra antiga: tem comissão, mas o rateio não foi gravado. */
  sem_rateio: boolean;
  fatura_id: string | null;
  fatura_numero: string | null;
  fatura_status: string | null;
  cliente_pagou: boolean;
  situacao: SituacaoComissao;
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  hoje: "Hoje",
  semana: "Semana",
  mes: "Mês",
  ano: "Ano",
  custom: "Período",
};

export function getPeriodRange(preset: PeriodPreset): PeriodRange {
  const agora = new Date();
  const fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  let inicio = new Date(fim);

  if (preset === "custom") {
    inicio = new Date(fim.getFullYear(), fim.getMonth(), 1);
  } else if (preset === "semana") {
    const diaSemana = (fim.getDay() + 6) % 7; // segunda = 0
    inicio = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() - diaSemana);
  } else if (preset === "mes") {
    inicio = new Date(fim.getFullYear(), fim.getMonth(), 1);
  } else if (preset === "ano") {
    inicio = new Date(fim.getFullYear(), 0, 1);
  }

  return { start: inicio, end: fim, preset };
}

export function formatPeriodLabel(period: PeriodRange): string {
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return period.preset === "hoje" ? `Hoje · ${fmt(period.start)}` : `${fmt(period.start)} — ${fmt(period.end)}`;
}

const periodoInvalido = (period: PeriodRange) => !period.start || !period.end;

export function useTechnicianFinancials(period: PeriodRange) {
  const { user } = useAuth();
  const [data, setData] = useState<TechnicianFinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id || periodoInvalido(period)) return;

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: rpcError } = await supabase.rpc("get_technician_financial_dashboard", {
        _tecnico_id: user.id,
        _period_start: todayDateInput(period.start),
        _period_end: todayDateInput(period.end),
      });

      if (rpcError) throw rpcError;
      setData(
        result && typeof result === "object" && !Array.isArray(result)
          ? (result as unknown as TechnicianFinancialData)
          : null,
      );
    } catch (err: any) {
      console.error("Erro ao buscar dados financeiros do técnico:", err);
      setError(err.message || "Erro ao carregar dados");
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  }, [user?.id, period.start, period.end]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useTechnicianOSStatement(period: PeriodRange) {
  const { user } = useAuth();
  const [data, setData] = useState<OSStatementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id || periodoInvalido(period)) return;

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: rpcError } = await supabase.rpc("get_technician_os_statement", {
        _tecnico_id: user.id,
        _period_start: todayDateInput(period.start),
        _period_end: todayDateInput(period.end),
      });

      if (rpcError) throw rpcError;
      setData(Array.isArray(result) ? (result as unknown as OSStatementItem[]) : []);
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

  return { data, loading, error, refetch: fetchData };
}

export function usePayoutInvoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<PayoutInvoice[]>([]);
  const [adjustments, setAdjustments] = useState<CommissionAdjustment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [faturas, ajustes] = await Promise.all([
        supabase
          .from("technician_payout_invoices")
          .select("*")
          .eq("technician_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("commission_adjustments")
          .select("*")
          .eq("technician_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      if (faturas.error) throw faturas.error;
      if (ajustes.error) throw ajustes.error;
      setInvoices(faturas.data || []);
      setAdjustments(ajustes.data || []);
    } catch (err: any) {
      console.error("Erro ao buscar faturas de saque:", err);
      toast.error("Erro ao carregar faturas de saque");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createInvoice = useCallback(
    async (osIds: string[], notes?: string, adjustmentIds?: string[]) => {
      const { data, error } = await supabase.rpc("create_technician_payout_invoice", {
        _os_ids: osIds,
        _notes: notes ?? undefined,
        _adjustment_ids: adjustmentIds?.length ? adjustmentIds : undefined,
      });
      if (error) throw error;
      await fetchData();
      return data as unknown as { id: string; numero: string; total: number; ajustes?: number };
    },
    [fetchData],
  );

  const sendInvoice = useCallback(
    async (invoiceId: string) => {
      const { error } = await supabase.rpc("send_technician_payout_invoice", { _invoice_id: invoiceId });
      if (error) throw error;
      await fetchData();
    },
    [fetchData],
  );

  const cancelInvoice = useCallback(
    async (invoiceId: string) => {
      const { error } = await supabase.rpc("cancel_technician_payout_invoice", { _invoice_id: invoiceId });
      if (error) throw error;
      await fetchData();
    },
    [fetchData],
  );

  return { invoices, adjustments, loading, refetch: fetchData, createInvoice, sendInvoice, cancelInvoice };
}

export async function fetchPayoutInvoiceItems(invoiceId: string): Promise<PayoutInvoiceItem[]> {
  const { data, error } = await supabase
    .from("technician_payout_invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("reference_date", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function savePixKey(userId: string, type: string, key: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ pix_key: key.trim() || null, pix_key_type: type || null })
    .eq("id", userId);
  if (error) throw error;
}
