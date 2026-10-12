import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { useProdutosData } from "@/hooks/useProdutosData";

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
  const { produtos } = useProdutosData();
  
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

      // Buscar ganhos do técnico logado
      const { data: ganhosData, error: ganhosErr } = await supabase
        .from("tecnico_ganhos_venda")
        .select(`
          *,
          profiles!tecnico_ganhos_venda_tecnico_id_fkey (nome)
        `)
        .eq("organization_id", organization.id)
        .eq("tecnico_id", user.id)
        .order("created_at", { ascending: false });

      if (ganhosErr) throw ganhosErr;

      const ganhosComNome = (ganhosData || []).map((g: any) => ({
        ...g,
        tecnico_nome: g.profiles?.nome || "Você",
      }));
      setGanhosTecnico(ganhosComNome);

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
  }, [organization?.id, user, produtos]);

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

    // Atualizar estoque dos produtos vendidos
    for (const item of itens) {
      if (item.produto_id) {
        const produto = produtos.find((p) => p.id === item.produto_id);
        if (produto) {
          await supabase
            .from("produtos")
            .update({ estoque_atual: produto.estoque_atual - item.quantidade })
            .eq("id", item.produto_id);

          await supabase
            .from("estoque_movimentacao")
            .insert({
              organization_id: organization.id,
              produto_id: item.produto_id,
              tipo: "saida",
              motivo: "venda",
              quantidade_anterior: produto.estoque_atual,
              quantidade_movimento: -item.quantidade,
              quantidade_final: produto.estoque_atual - item.quantidade,
              documento_referencia: numero,
              documento_tipo: "venda",
              registrado_por: user.id,
            });
        }
      }
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

    // Estornar estoque
    for (const item of venda.itens || []) {
      if (item.produto_id) {
        const produto = produtos.find((p) => p.id === item.produto_id);
        if (produto) {
          await supabase
            .from("produtos")
            .update({ estoque_atual: produto.estoque_atual + item.quantidade })
            .eq("id", item.produto_id);

          await supabase
            .from("estoque_movimentacao")
            .insert({
              organization_id: organization!.id,
              produto_id: item.produto_id,
              tipo: "entrada",
              motivo: "cancelamento_venda",
              quantidade_anterior: produto.estoque_atual,
              quantidade_movimento: item.quantidade,
              quantidade_final: produto.estoque_atual + item.quantidade,
              documento_referencia: venda.numero,
              documento_tipo: "cancelamento",
              registrado_por: user!.id,
            });
        }
      }
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
      body: { venda_id: vendaId, provider },
    });

    if (error) throw error;

    // Atualizar venda com dados da NF
    if (data?.nf) {
      await supabase
        .from("vendas")
        .update({
          nf_numero: data.nf.numero,
          nf_chave: data.nf.chave_acesso,
          nf_emitida_em: data.nf.emitida_em,
          nf_provider: provider,
        })
        .eq("id", vendaId);

      setVendas((prev) =>
        prev.map((v) =>
          v.id === vendaId
            ? {
                ...v,
                nf_numero: data.nf.numero,
                nf_chave: data.nf.chave_acesso,
                nf_emitida_em: data.nf.emitida_em,
                nf_provider: provider,
              }
            : v
        )
      );
    }

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