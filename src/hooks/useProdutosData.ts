import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";

export interface CategoriaProduto {
  id: string;
  organization_id: string;
  nome: string;
  descricao: string | null;
  created_at: string;
  updated_at: string;
}

export interface Produto {
  id: string;
  organization_id: string;
  categoria_id: string | null;
  nome: string;
  descricao: string | null;
  ncm: string | null;
  cfop: string | null;
  preco_custo: number;
  preco_venda: number;
  margem_lucro: number;
  estoque_minimo: number;
  estoque_atual: number;
  aplica_icms: boolean;
  aplica_ipi: boolean;
  aplica_pis_cofins: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  categoria_nome?: string; // Para joins
}

export interface EstoqueMovimentacao {
  id: string;
  organization_id: string;
  produto_id: string;
  tipo: string;
  motivo: string | null;
  quantidade_anterior: number;
  quantidade_movimento: number;
  quantidade_final: number;
  documento_referencia: string | null;
  documento_tipo: string | null;
  registrado_por: string | null;
  registrado_em: string;
  created_at: string;
  produto_nome?: string; // Para joins
}

export function useProdutosData() {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const [categorias, setCategorias] = useState<CategoriaProduto[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<EstoqueMovimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!organization?.id || !user) {
      setCategorias([]);
      setProdutos([]);
      setMovimentacoes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Buscar categorias
      const { data: catData, error: catErr } = await supabase
        .from("categoria_produtos")
        .select("*")
        .eq("organization_id", organization.id)
        .order("nome");

      if (catErr) throw catErr;
      setCategorias(catData || []);

      // Buscar produtos com join de categoria
      const { data: prodData, error: prodErr } = await supabase
        .from("produtos")
        .select(`
          *,
          categoria_produtos!produtos_categoria_id_fkey (nome)
        `)
        .eq("organization_id", organization.id)
        .order("nome");

      if (prodErr) throw prodErr;

      const produtosComCategoria = (prodData || []).map((p: any) => ({
        ...p,
        categoria_nome: p.categoria_produtos?.nome || null,
      }));
      setProdutos(produtosComCategoria);

      // Buscar movimentações recentes (últimas 100)
      const { data: movData, error: movErr } = await supabase
        .from("estoque_movimentacao")
        .select(`
          *,
          produtos!estoque_movimentacao_produto_id_fkey (nome)
        `)
        .eq("organization_id", organization.id)
        .order("registrado_em", { ascending: false })
        .limit(100);

      if (movErr) throw movErr;

      const movComProduto = (movData || []).map((m: any) => ({
        ...m,
        produto_nome: m.produtos?.nome || "Produto removido",
      }));
      setMovimentacoes(movComProduto);
    } catch (e: any) {
      console.error("useProdutosData error:", e);
      setError(e.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [organization?.id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ==================== CATEGORIAS ====================
  const createCategoria = async (nome: string, descricao?: string) => {
    if (!organization?.id) throw new Error("Sem organização");
    const { data, error } = await supabase
      .from("categoria_produtos")
      .insert({ organization_id: organization.id, nome, descricao })
      .select()
      .single();
    if (error) throw error;
    setCategorias((prev) => [...prev, data]);
    return data;
  };

  const updateCategoria = async (id: string, updates: Partial<CategoriaProduto>) => {
    const { data, error } = await supabase
      .from("categoria_produtos")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setCategorias((prev) => prev.map((c) => (c.id === id ? data : c)));
    return data;
  };

  const deleteCategoria = async (id: string) => {
    const { error } = await supabase.from("categoria_produtos").delete().eq("id", id);
    if (error) throw error;
    setCategorias((prev) => prev.filter((c) => c.id !== id));
  };

  // ==================== PRODUTOS ====================
  const createProduto = async (produto: Omit<Produto, "id" | "created_at" | "updated_at" | "categoria_nome">) => {
    if (!organization?.id) throw new Error("Sem organização");
    const { data, error } = await supabase
      .from("produtos")
      .insert({ ...produto, organization_id: organization.id })
      .select()
      .single();
    if (error) throw error;
    setProdutos((prev) => [...prev, { ...data, categoria_nome: null } as Produto]);
    return data;
  };

  const updateProduto = async (id: string, updates: Partial<Produto>) => {
    const { data, error } = await supabase
      .from("produtos")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setProdutos((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    return data;
  };

  const deleteProduto = async (id: string) => {
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) throw error;
    setProdutos((prev) => prev.filter((p) => p.id !== id));
  };

  const updateEstoque = async (produtoId: string, novaQuantidade: number, tipo: string, motivo: string, documentoRef?: string, documentoTipo?: string) => {
    if (!organization?.id || !user) throw new Error("Sem permissão");
    
    const produto = produtos.find((p) => p.id === produtoId);
    if (!produto) throw new Error("Produto não encontrado");

    const qtdAnterior = produto.estoque_atual;
    const qtdFinal = novaQuantidade;
    const qtdMovimento = qtdFinal - qtdAnterior;

    // Atualizar produto
    const { error: prodErr } = await supabase
      .from("produtos")
      .update({ estoque_atual: qtdFinal } as any)
      .eq("id", produtoId);
    if (prodErr) throw prodErr;

    // Registrar movimentação
    const { data: movData, error: movErr } = await supabase
      .from("estoque_movimentacao")
      .insert({
        organization_id: organization.id,
        produto_id: produtoId,
        tipo,
        motivo,
        quantidade_anterior: qtdAnterior,
        quantidade_movimento: qtdMovimento,
        quantidade_final: qtdFinal,
        documento_referencia: documentoRef,
        documento_tipo: documentoTipo,
        registrado_por: user.id,
      })
      .select()
      .single();
    if (movErr) throw movErr;

    // Atualizar estado local
    setProdutos((prev) => prev.map((p) => (p.id === produtoId ? { ...p, estoque_atual: qtdFinal } : p)));
    setMovimentacoes((prev) => [{ ...movData, produto_nome: produto.nome }, ...prev]);

    return movData;
  };

  return {
    // Estado
    categorias,
    produtos,
    movimentacoes,
    loading,
    error,
    // Ações
    fetchData,
    createCategoria,
    updateCategoria,
    deleteCategoria,
    createProduto,
    updateProduto,
    deleteProduto,
    updateEstoque,
  };
}