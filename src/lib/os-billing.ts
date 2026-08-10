import { supabase } from "@/integrations/supabase/client";

export interface OsCobranca {
  id: string;
  numero: string;
  status: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  equipamento: string;
  data_entrada: string | null;
  valor: number;
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
    .select("id, numero, status, cliente_id, data_entrada, valor_final, valor_orcamento, desconto, tipo_equipamento, modelo_equipamento, clientes(nome, telefone)")
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

  const pagos = new Set(
    (finData || [])
      .filter((f: any) => f.tipo === "receita" && f.ordem_servico_id)
      .map((f: any) => f.ordem_servico_id as string)
  );

  const totalItens = new Map<string, number>();
  (itensData || []).forEach((i: any) => {
    totalItens.set(i.ordem_servico_id, (totalItens.get(i.ordem_servico_id) || 0) + Number(i.valor_total || 0));
  });

  return ordens.map((o: any) => {
    let valor = Number(o.valor_final || 0);
    if (!valor) valor = Number(o.valor_orcamento || 0);
    if (!valor) valor = Math.max(0, (totalItens.get(o.id) || 0) - Number(o.desconto || 0));
    return {
      id: o.id,
      numero: o.numero,
      status: o.status,
      cliente_id: o.cliente_id,
      cliente_nome: o.clientes?.nome || "Cliente",
      cliente_telefone: o.clientes?.telefone || null,
      equipamento: o.modelo_equipamento || o.tipo_equipamento || "Equipamento",
      data_entrada: o.data_entrada,
      valor,
      pago: pagos.has(o.id),
    };
  });
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
