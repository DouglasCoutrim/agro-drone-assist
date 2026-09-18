import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import type { Tables } from "@/integrations/supabase/types";

export type ChecklistItem = Tables<"checklist_equipamento_itens">;
export type ChecklistTipo = Tables<"checklist_tipos_equipamento"> & { itens?: ChecklistItem[] };

export const DB_ENUM_OPCOES = ["drone_agricola", "drone_convencional", "controle", "bateria", "outro"] as const;

export function slugifyLabel(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return base || "tipo";
}

export function useChecklistConfig() {
  const { organization } = useOrganization();
  const [tipos, setTipos] = useState<ChecklistTipo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organization) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("checklist_tipos_equipamento")
        .select("*, itens:checklist_equipamento_itens(order(ordem))")
        .eq("organization_id", organization.id)
        .order("label");
      if (error) throw error;
      setTipos((data || []) as ChecklistTipo[]);
    } catch (err: any) {
      console.error("Erro ao carregar configuração de checklist:", err);
    } finally {
      setLoading(false);
    }
  }, [organization]);

  useEffect(() => { load(); }, [load]);

  const ensureOrg = () => {
    if (!organization?.id) throw new Error("Organização não identificada.");
    return organization.id;
  };

  const createTipo = async (payload: { label: string; descricao?: string; db_enum?: string; ativo?: boolean }) => {
    const orgId = ensureOrg();
    const label = payload.label.trim();
    if (!label) throw new Error("Informe o nome do tipo de equipamento.");
    const used = new Set((tipos || []).map(t => t.value));
    const baseValue = slugifyLabel(label);
    let value = baseValue;
    let n = 1;
    while (used.has(value)) value = `${baseValue}_${n++}`;
    const dbEnum = DB_ENUM_OPCOES.includes(payload.db_enum as (typeof DB_ENUM_OPCOES)[number])
      ? payload.db_enum
      : "outro";
    const { data, error } = await supabase
      .from("checklist_tipos_equipamento")
      .insert({
        organization_id: orgId,
        label,
        value,
        descricao: payload.descricao || null,
        db_enum: dbEnum,
        ativo: payload.ativo ?? true,
      })
      .select("*")
      .single();
    if (error) throw error;
    await load();
    return data;
  };

  const updateTipo = async (id: string, payload: Partial<{ label: string; descricao: string | null; db_enum: string; ativo: boolean }>) => {
    const orgId = ensureOrg();
    const { error } = await supabase
      .from("checklist_tipos_equipamento")
      .update({ ...payload, organization_id: orgId })
      .eq("id", id)
      .eq("organization_id", orgId);
    if (error) throw error;
    await load();
  };

  const deleteTipo = async (id: string) => {
    const orgId = ensureOrg();
    const { error } = await supabase
      .from("checklist_tipos_equipamento")
      .delete()
      .eq("id", id)
      .eq("organization_id", orgId);
    if (error) throw error;
    await load();
  };

  const addItem = async (tipoId: string, payload: { label: string; obrigatorio: boolean }) => {
    const orgId = ensureOrg();
    const label = payload.label.trim();
    if (!label) throw new Error("Informe a descrição do item de verificação.");
    const tipo = (tipos || []).find(t => t.id === tipoId);
    const ordem = (tipo?.itens || []).reduce((max, i) => Math.max(max, (i.ordem || 0) + 1), 0);
    const { error } = await supabase
      .from("checklist_equipamento_itens")
      .insert({ organization_id: orgId, tipo_equipamento_id: tipoId, label, obrigatorio: payload.obrigatorio, ordem });
    if (error) throw error;
    await load();
  };

  const updateItem = async (id: string, payload: Partial<{ label: string; obrigatorio: boolean; ordem: number }>) => {
    const { error } = await supabase
      .from("checklist_equipamento_itens")
      .update(payload)
      .eq("id", id);
    if (error) throw error;
    await load();
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase
      .from("checklist_equipamento_itens")
      .delete()
      .eq("id", id);
    if (error) throw error;
    await load();
  };

  const moveItem = async (tipoId: string, itemId: string, direction: "up" | "down") => {
    const tipo = (tipos || []).find(t => t.id === tipoId);
    const itens = [...(tipo?.itens || [])];
    const idx = itens.findIndex(i => i.id === itemId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= itens.length) return;
    const a = itens[idx];
    const b = itens[swapIdx];
    try {
      await supabase.from("checklist_equipamento_itens").update({ ordem: b.ordem }).eq("id", a.id);
      await supabase.from("checklist_equipamento_itens").update({ ordem: a.ordem }).eq("id", b.id);
    } catch (err: any) {
      console.error("Erro ao reordenar itens:", err);
      throw err;
    }
    await load();
  };

  return {
    tipos,
    loading,
    reload: load,
    createTipo,
    updateTipo,
    deleteTipo,
    addItem,
    updateItem,
    deleteItem,
    moveItem,
  };
}