import { supabase } from "@/integrations/supabase/client";
import { valorCobradoOS } from "@/lib/os-valor";

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
  /** Soma dos pagamentos de receita lançados para a OS. */
  totalPago: number;
  /** valor − totalPago (nunca negativo). */
  saldo: number;
  pago: boolean;
}

const STATUS_IGNORADOS = ["cancelada"];

/**
 * Busca as OS da organização com o valor consolidado (valor_final > orçamento > soma dos itens - desconto)
 * e marca quais já possuem lançamento de recebimento no Financeiro.
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

  const ordens = (osData || []).filter((o: any) => !STATUS_IGNORADOS.includes(o.status));
  if (ordens.length === 0) return [];

  const ids = ordens.map((o: any) => o.id);

  const [{ data: finData }, { data: itensData }] = await Promise.all([
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
    const valor = valorCobradoOS(o, totalItens.get(o.id) || 0);
    const totalPago = pagoPorOS.get(o.id) || 0;
    const saldo = Math.max(0, Math.round((valor - totalPago) * 100) / 100);
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
      valor,
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
}

export interface RecebimentoResult {
  os_id: string;
  total: number;
  pago: number;
  saldo: number;
  conta_id: string | null;
}

/**
 * Registra um recebimento (parcial ou total) de uma OS. O RPC
 * `registrar_recebimento_os` lança a receita no Financeiro e cria/atualiza a
 * conta a receber do saldo. A guarda de organização fica dentro do RPC.
 */
export async function registrarRecebimentoOS(p: RecebimentoParams): Promise<RecebimentoResult> {
  const { data, error } = await supabase.rpc("registrar_recebimento_os" as any, {
    p_os_id: p.osId,
    p_valor: p.valor,
    p_forma: p.formaPagamento ?? null,
    p_equipamento: p.equipamento ?? null,
    p_condicoes: p.condicoesPagamento ?? null,
    p_vencimento: p.vencimento ?? null,
    p_obs: p.observacoes ?? null,
  });
  if (error) throw error;
  return data as RecebimentoResult;
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
    .from("empresa_config" as any)
    .select("gateway_clientes, gateway_clientes_credentials")
    .eq("organization_id", orgId)
    .maybeSingle();
  const d = data as any;
  if (!d) return { gateway: "none" };
  const creds = typeof d.gateway_clientes_credentials === "string"
    ? (() => { try { return JSON.parse(d.gateway_clientes_credentials); } catch { return {}; } })()
    : (d.gateway_clientes_credentials || {});
  return {
    gateway: d.gateway_clientes || "none",
    pix_key_type: creds.pix_key_type,
    pix_key_value: creds.pix_key_value,
    pix_receiver_name: creds.pix_receiver_name,
  };
}
