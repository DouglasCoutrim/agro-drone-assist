import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";

export interface Venda {
  id: string;
  organization_id: string;
  numero: string;
  data_venda: string;
  cliente_id: string | null;
  cliente_nome: string;
  cliente_cpf_cnpj: string | null;
  cliente_email: string | null;
  valor_produtos: number;
  valor_desconto: number;
  valor_impostos: number;
  valor_total: number;
  forma_pagamento: string | null;
  status_pagamento: string;
  obs: string | null;
  nf_numero: string | null;
  nf_chave: string | null;
  nf_emitida_em: string | null;
  nf_provider: string | null;
  vendido_por: string | null;
  criado_em: string;
  atualizado_em: string;
  itens?: VendaItem[];
  cliente_nome_completo?: string; // Para joins
}

export interface VendaItem {
  id: string;
  venda_id: string;
  produto_id: string | null;
  nome_produto: string;
  ncm: string | null;
  cfop: string | null;
  quantidade: number;
  preco_unitario: number;
  valor_total: number;
  desconto_percentual: number;
  desconto_valor: number;
  icms_percentual: number | null;
  icms_valor: number | null;
  pis_cofins_valor: number | null;
  ipi_valor: number | null;
  created_at: string;
  produto_nome?: string;
}

export interface TecnicoGanhoVenda {
  id: string;
  organization_id: string;
  venda_id: string;
  tecnico_id: string;
  comissao_percentual: number | null;
  valor_venda: number | null;
  valor_comissao: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  tecnico_nome?: string;
}

export interface NotaFiscalEmitida {
  id: string;
  organization_id: string;
  tipo: string;
  numero: string | null;
  serie: string | null;
  chave_acesso: string | null;
  xml_url: string | null;
  pdf_url: string | null;
  xml_conteudo: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  cliente_cpf_cnpj: string | null;
  cliente_email: string | null;
  valor_total: number | null;
  valor_impostos: number | null;
  valor_liquido: number | null;
  status: string | null;
  motivo_rejeicao: string | null;
  os_id: string | null;
  venda_id: string | null;
  provider: string | null;
  provider_id: string | null;
  emitida_por: string | null;
  emitida_em: string;
  cancelada_em: string | null;
  cancelada_por: string | null;
  created_at: string;
  updated_at: string;
  itens?: NotaFiscalItem[];
}

export interface NotaFiscalItem {
  id: string;
  nf_id: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  ncm: string | null;
  cfop: string | null;
  created_at: string;
}

export function useVendasData() {
  const { organization } = useOrganization();
  const { user } = useAuth();
  
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [ganhosTecnico, setGanhosTecnico] = useState<TecnicoGanhoVenda[]>([]);
  const [notasFiscais, setNotasFiscais] = useState<NotaFiscalEmitida[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!organization?.id || !user) {
      setVendas([]);
      setGanhosTecnico([]);
      setNotasFiscais([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Buscar vendas
      const { data: vendasData, error: vendasErr } = await supabase
        .from("vendas")
        .select(`
          *,
          venda_itens (*),
          clientes!vendas_cliente_id_fkey (nome)
        `)
        .eq("organization_id", organization.id)
        .order("data_venda", { ascending: false })
        .order("criado_em", { ascending: false });

      if (vendasErr) throw vendasErr;

      const vendasComItens = (vendasData || []).map((v: any) => ({
        ...v,
        itens: v.venda_itens || [],
        cliente_nome_completo: v.clientes?.nome || v.cliente_nome,
      }));
      setVendas(vendasComItens);

      setGanhosTecnico([]);

      // Buscar notas fiscais
      const { data: nfData, error: nfErr } = await supabase
        .from("nota_fiscal_emitida")
        .select(`
          *,
          nota_fiscal_itens (*)
        `)
        .eq("organization_id", organization.id)
        .order("emitida_em", { ascending: false });

      if (nfErr) throw nfErr;

      const nfComItens = (nfData || []).map((n: any) => ({
        ...n,
        itens: n.nota_fiscal_itens || [],
      }));
      setNotasFiscais(nfComItens);
    } catch (e: any) {
      console.error("useVendasData error:", e);
      setError(e.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [organization?.id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ==================== VENDAS ====================
  const createVenda = async (
    venda: Omit<Venda, "id" | "criado_em" | "atualizado_em" | "itens" | "cliente_nome_completo">,
    itens: Omit<VendaItem, "id" | "venda_id" | "created_at">[]
  ) => {
    if (!organization?.id || !user) throw new Error("Sem permissão");

    // Gerar número sequencial
    const { data: lastVenda } = await supabase
      .from("vendas")
      .select("numero")
      .eq("organization_id", organization.id)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextNum = 1;
    if (lastVenda?.numero) {
      const match = lastVenda.numero.match(/(\d+)$/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    const numero = `VND-${String(nextNum).padStart(5, "0")}`;

    // Calcular totais
    const valor_produtos = itens.reduce((sum, i) => sum + i.valor_total, 0);
    const valor_desconto = itens.reduce((sum, i) => sum + i.desconto_valor, 0);
    const valor_impostos = itens.reduce((sum, i) => sum + (i.icms_valor || 0) + (i.pis_cofins_valor || 0) + (i.ipi_valor || 0), 0);
    const valor_total = valor_produtos - valor_desconto + valor_impostos;

    // Criar venda
    const { data: vendaData, error: vendaErr } = await supabase
      .from("vendas")
      .insert({
        ...venda,
        organization_id: organization.id,
        numero,
        valor_produtos,
        valor_desconto,
        valor_impostos,
        valor_total,
        vendido_por: user.id,
      })
      .select()
      .single();

    if (vendaErr) throw vendaErr;

    // Criar itens
    const itensComVendaId = itens.map((item) => ({ ...item, venda_id: vendaData.id }));
    const { data: itensData, error: itensErr } = await supabase
      .from("venda_itens")
      .insert(itensComVendaId)
      .select();

    if (itensErr) throw itensErr;

    for (const item of itens) {
      if (!item.produto_id) continue;
      const { data: est } = await supabase.from("itens_estoque").select("quantidade").eq("id", item.produto_id).maybeSingle();
      if (!est) continue;
      await supabase.from("itens_estoque").update({ quantidade: est.quantidade - Number(item.quantidade) }).eq("id", item.produto_id);
      await supabase.from("movimentacoes_estoque").insert({
        organization_id: organization!.id, item_id: item.produto_id, tipo: "saida",
        quantidade: Number(item.quantidade), motivo: `Venda ${numero}`, usuario_id: user!.id,
      } as any);
    }

    const novaVenda = { ...vendaData, itens: itensData || [] };
    setVendas((prev) => [novaVenda, ...prev]);
    return novaVenda;
  };

  const updateVenda = async (id: string, updates: Partial<Venda>) => {
    const { data, error } = await supabase
      .from("vendas")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setVendas((prev) => prev.map((v) => (v.id === id ? { ...v, ...data } : v)));
    return data;
  };

  const cancelarVenda = async (id: string) => {
    const venda = vendas.find((v) => v.id === id);
    if (!venda) throw new Error("Venda não encontrada");

    for (const item of venda.itens || []) {
      if (!item.produto_id) continue;
      const { data: est } = await supabase.from("itens_estoque").select("quantidade").eq("id", item.produto_id).maybeSingle();
      if (!est) continue;
      await supabase.from("itens_estoque").update({ quantidade: est.quantidade + Number(item.quantidade) }).eq("id", item.produto_id);
      await supabase.from("movimentacoes_estoque").insert({
        organization_id: organization!.id, item_id: item.produto_id, tipo: "entrada",
        quantidade: Number(item.quantidade), motivo: `Cancelamento da venda ${venda.numero}`, usuario_id: user!.id,
      } as any);
    }

    const { error } = await supabase
      .from("vendas")
      .update({ status_pagamento: "cancelado" })
      .eq("id", id);
    if (error) throw error;

    setVendas((prev) => prev.map((v) => (v.id === id ? { ...v, status_pagamento: "cancelado" } : v)));
  };

  // ==================== NOTA FISCAL ====================
  const emitirNFeVenda = async (vendaId: string, provider: "focusnfe" | "notagateway" = "focusnfe") => {
    if (!organization?.id || !user) throw new Error("Sem permissão");

    const venda = vendas.find((v) => v.id === vendaId);
    if (!venda) throw new Error("Venda não encontrada");

    // Chamar Edge Function
    const { data, error } = await supabase.functions.invoke("emitir-nfe-venda", {
      body: { action: "emitir", venda_id: vendaId },
    });

    if (error) throw error;

    // Recarregar notas
    await fetchData();
    return data;
  };

  const emitirNFSeOS = async (osId: string, provider: "focusnfe" | "notagateway" = "focusnfe") => {
    if (!organization?.id || !user) throw new Error("Sem permissão");

    const { data, error } = await supabase.functions.invoke("emitir-nfse-os", {
      body: { os_id: osId, provider },
    });

    if (error) throw error;
    await fetchData();
    return data;
  };

  const cancelarNotaFiscal = async (nfId: string, motivo: string) => {
    if (!organization?.id || !user) throw new Error("Sem permissão");

    const { error } = await supabase.functions.invoke("cancelar-nota-fiscal", {
      body: { nf_id: nfId, motivo },
    });

    if (error) throw error;

    setNotasFiscais((prev) =>
      prev.map((n) => (n.id === nfId ? { ...n, status: "cancelado", cancelada_em: new Date().toISOString() } : n))
    );
  };

  return {
    // Estado
    vendas,
    ganhosTecnico,
    notasFiscais,
    loading,
    error,
    // Ações
    fetchData,
    createVenda,
    updateVenda,
    cancelarVenda,
    emitirNFeVenda,
    emitirNFSeOS,
    cancelarNotaFiscal,
  };
}