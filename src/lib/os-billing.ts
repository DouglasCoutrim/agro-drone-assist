import { supabase } from "@/integrations/supabase/client";
import { valorCobradoOS, type OsValorInput } from "./os-valor";

export interface OsCobranca {
  id: string;
  numero: string;
  status: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  equipamento: string;
  data_entrada: string | null;
  data_conclusao: string | null;
  data_entrega: string | null;
  valor: number;
  totalPago: number;
  saldo: number;
  pago: boolean;
}

/** Busca as OS da organização com o valor consolidado (valor_final > orçamento > soma dos itens - desconto)
 * e marca quais já possuem lançamento de recebimento no Financeiro.
 * Usa a função calcular_valores_os como fonte única do valor da OS.
 */
export async function fetchOsComValores(orgId: string, clienteId?: string): Promise<OsCobranca[]> {
  if (!orgId) return [];

  let query = supabase
    .from("ordens_servico")
    .select("id, numero, status, cliente_id, data_entrada, data_conclusao, data_entrega, valor_final, valor_orcamento, desconto, tipo_equipamento, modelo_equipamento, clientes(nome, telefone)")
    .eq("organization_id", orgId)
    .order("data_entrada", { ascending: false });

  if (clienteId) query = query.eq("cliente_id", clienteId);

  const { data: osData, error } = await query;
  if (error) throw error;

  const ordens = (osData || []).filter((o: any) => !["cancelada"].includes(o.status));
  if (ordens.length === 0) return [];

  const ids = ordens.map((o: any) => o.id);

  const [finRes, itensRes] = await Promise.all([
    supabase
      .from("financeiro")
      .select("ordem_servico_id, valor, tipo")
      .eq("organization_id", orgId)
      .in("ordem_servico_id", ids),
    supabase
      .from("itens_os")
      .select("ordem_servico_id, valor_total")
      .in("ordem_servico_id", ids),
  ]);

  if (finRes.error) throw finRes.error;
  if (itensRes.error) throw itensRes.error;

  const finData = finRes.data;
  const itensData = itensRes.data;

  const pagoPorOS = new Map<string, number>();
  (finData || [])
    .filter((f: any) => f.tipo === "receita" && f.ordem_servico_id)
    .forEach((f: any) => {
      pagoPorOS.set(f.ordem_servico_id, (pagoPorOS.get(f.ordem_servico_id) || 0) + Number(f.valor || 0));
    });

  const totalItens = new Map<string, number>();
  (itensData || []).forEach((i: any) => {
    totalItens.set(i.ordem_servico_id, (totalItens.get(i.ordem_servico_id) || 0) + Number(i.valor_total || 0));
  });

  return ordens.map((o: any) => {
    // Usa a fonte única: calcular_valores_os para o valor da OS
    const valorFinal = Number(o.valor_final ?? 0);
    const desconto = Number(o.desconto ?? 0);
    const totalItensOS = totalItens.get(o.id) || 0;

    // Valor cobrado: valor_final > (itens - desconto) > valor_orcamento
    let valorCobrado = 0;
    if (valorFinal > 0) {
      valorCobrado = valorFinal;
    } else if (totalItensOS > 0) {
      valorCobrado = Math.max(0, totalItensOS - desconto);
    } else {
      valorCobrado = Math.max(0, Number(o.valor_orcamento ?? 0));
    }

    const totalPago = pagoPorOS.get(o.id) || 0;
    const saldo = Math.max(0, Math.round((valorCobrado - totalPago) * 100) / 100);
    return {
      id: o.id,
      numero: o.numero,
      status: o.status,
      cliente_id: o.cliente_id,
      cliente_nome: o.clientes?.nome || "Cliente",
      cliente_telefone: o.clientes?.telefone || null,
      equipamento: o.modelo_equipamento || o.tipo_equipamento || "Equipamento",
      data_entrada: o.data_entrada,
      data_conclusao: o.data_conclusao,
      data_entrega: o.data_entrega,
      valor: valorCobrado,
      totalPago,
      saldo,
      pago: saldo <= 0.005,
    };
  });
}

export interface RecebimentoParams {
  osId: string;
  valor: number;
  formaPagamento?: string;
  equipamento?: string;
  condicoesPagamento?: string;
  vencimento?: string | null;
  observacoes?: string;
  chaveIdempotencia?: string;
}

export interface RecebimentoResult {
  os_id: string;
  total: number;
  pago: number;
  saldo: number;
  conta_id: string | null;
  status_pagamento?: string;
}

export async function registrarRecebimentoOS(p: RecebimentoParams): Promise<RecebimentoResult> {
  const { data, error } = await supabase.rpc("registrar_recebimento_os" as any, {
    p_os_id: p.osId,
    p_valor: p.valor,
    p_forma: p.formaPagamento ?? null,
    p_data: p.vencimento ?? null,
    p_chave_idempotencia: p.chaveIdempotencia ?? `${p.osId}-${p.valor}-${p.formaPagamento ?? ''}-${p.vencimento ?? ''}`,
  });
  if (error) throw error;
  return data as unknown as RecebimentoResult;
}

export interface PagamentoConfig {
  gateway: string;
  pix_key_type?: string;
  pix_key_value?: string;
  pix_receiver_name?: string;
}

export async function fetchPagamentoConfig(orgId: string): Promise<PagamentoConfig> {
  if (!orgId) return { gateway: "none" };
  const { data } = await supabase
    .from("empresa_config as any")
    .select("gateway_clientes, gateway_clientes_credentials")
    .eq("organization_id", orgId)
    .maybeSingle();
  const d = data as any;
  if (!d) return { gateway: "none" };
  const creds = typeof d.gateway_clientes_credentials === "string"
    ? (() => {
        try { return JSON.parse(d.gateway_clientes_credentials); } catch { return {}; }
      })()
    : (d.gateway_clientes_credentials || {});
  return {
    gateway: d.gateway_clientes || "none",
    pix_key_type: creds.pix_key_type,
    pix_key_value: creds.pix_key_value,
    pix_receiver_name: creds.pix_receiver_name,
  };
}