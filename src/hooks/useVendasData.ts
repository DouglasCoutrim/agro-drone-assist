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
  servico_id?: string | null;
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
  // A venda inteira é gravada pela RPC criar_venda: numeração sequencial da
  // organização, preços vindos do catálogo, teto de desconto por item, totais e
  // baixa de estoque — tudo na mesma transação. O navegador só envia as
  // escolhas do operador (cliente, itens, quantidades e desconto percentual);
  // preço enviado pelo navegador é ignorado para itens de catálogo.
  const createVenda = async (
    venda: Omit<Venda, "id" | "criado_em" | "atualizado_em" | "itens" | "cliente_nome_completo"> & {
      ambiente?: string | null;
      nfe_dados?: Record<string, any> | null;
    },
    itens: (Omit<VendaItem, "id" | "venda_id" | "created_at"> & { servico_id?: string | null })[]
  ) => {
    if (!organization?.id || !user) throw new Error("Sem permissão");

    const payload = {
      cliente_id: venda.cliente_id || null,
      cliente_nome: venda.cliente_nome || null,
      cliente_cpf_cnpj: venda.cliente_cpf_cnpj || null,
      cliente_email: venda.cliente_email || null,
      data_venda: venda.data_venda || null,
      forma_pagamento: venda.forma_pagamento || null,
      status_pagamento: venda.status_pagamento || null,
      obs: venda.obs || null,
      ambiente: venda.ambiente || null,
      nfe_dados: venda.nfe_dados || {},
      itens: itens.map((item) => ({
        // "manual" é o marcador de item livre na tela de Vendas.
        produto_id: item.produto_id && item.produto_id !== "manual" ? item.produto_id : null,
        servico_id: item.servico_id || null,
        nome_produto: item.nome_produto || null,
        ncm: item.ncm || null,
        cfop: item.cfop || null,
        quantidade: Number(item.quantidade) || 0,
        preco_unitario: Number(item.preco_unitario) || 0,
        desconto_percentual: Number(item.desconto_percentual) || 0,
      })),
    };

    const { data: vendaId, error: vendaErr } = await supabase.rpc("criar_venda" as any, { _payload: payload });
    if (vendaErr) throw vendaErr;

    // Recarrega a venda gravada para devolver os valores calculados no servidor.
    const { data: vendaData, error: loadErr } = await supabase
      .from("vendas")
      .select(`
        *,
        venda_itens (*)
      `)
      .eq("id", vendaId as unknown as string)
      .single();

    if (loadErr) throw loadErr;

    const novaVenda = { ...(vendaData as any), itens: (vendaData as any)?.venda_itens || [] } as Venda;
    setVendas((prev) => [novaVenda, ...prev]);
    return novaVenda;
  };

  const updateVenda = async (
    id: string,
    updates: Partial<Venda> & Record<string, any>,
    itens?: (Omit<VendaItem, "id" | "venda_id" | "created_at"> & { id?: string })[],
  ) => {
    // A edição também roda no servidor (editar_venda): preço do catálogo, teto de
    // desconto, totais e reconciliação de estoque pelas mesmas regras da criação.
    // Campo ausente no payload fica como estava.
    const payload: Record<string, any> = {
      cliente_id: updates.cliente_id ?? null,
      cliente_nome: updates.cliente_nome ?? null,
      cliente_cpf_cnpj: updates.cliente_cpf_cnpj ?? null,
      cliente_email: updates.cliente_email ?? null,
      data_venda: updates.data_venda ?? null,
      forma_pagamento: updates.forma_pagamento ?? null,
      status_pagamento: updates.status_pagamento ?? null,
      obs: updates.obs ?? null,
      ambiente: updates.ambiente ?? null,
      nfe_dados: updates.nfe_dados ?? {},
    };

    if (itens) {
      payload.itens = itens.map((item) => ({
        // "manual" é o marcador de item livre na tela e não é um uuid válido.
        produto_id: item.produto_id && item.produto_id !== "manual" ? item.produto_id : null,
        servico_id: (item as any).servico_id || null,
        nome_produto: item.nome_produto || null,
        ncm: item.ncm || null,
        cfop: item.cfop || null,
        quantidade: Number(item.quantidade) || 0,
        preco_unitario: Number(item.preco_unitario) || 0,
        desconto_percentual: Number(item.desconto_percentual) || 0,
      }));
    }

    const { error: rpcErr } = await supabase.rpc("editar_venda" as any, { _venda_id: id, _payload: payload });
    if (rpcErr) throw rpcErr;

    // Recarrega a venda gravada para devolver os valores calculados no servidor.
    const { data, error: loadErr } = await supabase
      .from("vendas")
      .select(`
        *,
        venda_itens (*)
      `)
      .eq("id", id)
      .single();
    if (loadErr) throw loadErr;

    const vendaAtualizada = { ...(data as any), itens: (data as any)?.venda_itens || [] } as Venda;
    // Mescla com a linha atual da lista para preservar o nome do cliente vindo do join.
    setVendas((prev) => prev.map((v) => (v.id === id ? { ...v, ...vendaAtualizada } : v)));
    return vendaAtualizada;
  };

  // Estorno no servidor (cancelar_venda): devolve o estoque dos itens de catálogo
  // e marca a venda como cancelada na mesma transação. Cancelar de novo falha em
  // vez de devolver o estoque outra vez.
  const cancelarVenda = async (id: string) => {
    const { error } = await supabase.rpc("cancelar_venda" as any, { _venda_id: id });
    if (error) throw error;
    // O estoque e as movimentações mudaram: recarrega para refletir o saldo.
    await fetchData();
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
      body: { action: "emitir", os_id: osId },
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
