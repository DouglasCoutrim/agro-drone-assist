import { supabase } from "@/integrations/supabase/client";
import { getStatusLabel } from "@/components/os/StatusPipeline";

/**
 * Regras de mudança de status da OS, compartilhadas pela tela de Ordens de Serviço e pelo
 * painel do técnico. Extraído de `src/pages/OrdensServico.tsx` sem alterar o comportamento:
 * o objetivo é que os dois lugares apliquem exatamente as mesmas validações.
 */

/** Status que fecham a OS. Mesma lista usada pela tela de OS e pela RPC `finalizar_os`. */
export const LOCK_CLOSED_STATUSES = new Set(["pronto_retirada", "concluida", "entregue", "finalizada"]);

/** Perfil de consulta: não pode criar nem alterar OS. */
export const MENSAGEM_OS_SEM_EDICAO =
  "Seu perfil tem acesso de consulta ao módulo de OS, mas não pode criar ou alterar ordens de serviço.";

/** Quem tem apenas a permissão "Pode finalizar OS" só fecha a OS, não reabre. */
export const MENSAGEM_OS_SO_FECHAR = "Sua permissão permite apenas finalizar (fechar) a OS.";

/** Itens obrigatórios do checklist de revisão que ainda não foram marcados. */
export async function listarChecklistObrigatorioPendente(
  osId: string,
  organizationId?: string | null,
  isPlatformAdmin = false,
): Promise<string[]> {
  const checklistClient = supabase as any;
  let query = checklistClient
    .from("os_checklist_itens")
    .select("marcado, item:checklist_equipamento_itens(label, obrigatorio)")
    .eq("ordem_servico_id", osId);
  if (organizationId && !isPlatformAdmin) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) return [];
  return ((data as any[]) || [])
    .filter((r) => r?.item?.obrigatorio && !r.marcado)
    .map((r) => r.item.label as string);
}

export interface AplicarStatusOsParams {
  osId: string;
  novoStatus: string;
  organizationId?: string | null;
  isPlatformAdmin?: boolean;
  userId?: string;
  /** Tem acesso de edição à OS (admin ou técnico responsável). */
  podeEditar: boolean;
  /** Tem a permissão "Pode finalizar OS" (Equipe → Papéis e permissões). */
  podeFinalizarOs: boolean;
}

/**
 * Aplica a mudança de status de uma OS.
 *
 * - Sem acesso de edição: fecha pelo RPC `finalizar_os`, que valida a permissão, grava
 *   status/datas, congela a comissão e escreve o histórico. Só aceita status de fechamento.
 * - Com acesso de edição: grava direto, exige o checklist obrigatório quando o status fecha
 *   a OS, recalcula a comissão e registra o histórico.
 */
export async function aplicarStatusOs({
  osId,
  novoStatus,
  organizationId,
  isPlatformAdmin = false,
  userId,
  podeEditar,
  podeFinalizarOs,
}: AplicarStatusOsParams): Promise<void> {
  if (!podeEditar) {
    if (!podeFinalizarOs) throw new Error(MENSAGEM_OS_SEM_EDICAO);
    if (!LOCK_CLOSED_STATUSES.has(novoStatus)) throw new Error(MENSAGEM_OS_SO_FECHAR);
    const { error } = await supabase.rpc("finalizar_os", { _os_id: osId, _status: novoStatus });
    if (error) throw error;
    return;
  }

  if (LOCK_CLOSED_STATUSES.has(novoStatus)) {
    const pendentes = await listarChecklistObrigatorioPendente(osId, organizationId, isPlatformAdmin);
    if (pendentes.length > 0) {
      throw new Error(
        `Itens obrigatórios pendentes no checklist de revisão: ${pendentes.slice(0, 3).join("; ")}${pendentes.length > 3 ? "…" : ""}.`,
      );
    }
  }

  const updateData: Record<string, unknown> = { status: novoStatus };
  if (novoStatus === "pronto_retirada" || novoStatus === "concluida" || novoStatus === "finalizada") {
    updateData.data_conclusao = new Date().toISOString();
  }
  if (novoStatus === "entregue") updateData.data_entrega = new Date().toISOString();

  const { error } = await supabase.from("ordens_servico").update(updateData as any).eq("id", osId);
  if (error) throw error;

  try {
    await supabase.rpc("calculate_os_commission" as any, { _os_id: osId });
  } catch (err) {
    console.error("Erro ao recalcular comissão na mudança de status:", err);
  }

  if (userId) {
    await supabase
      .from("os_historico")
      .insert({
        ordem_servico_id: osId,
        usuario_id: userId,
        acao: `Status alterado para ${getStatusLabel(novoStatus)}`,
      })
      .then(() => {});
  }
}
