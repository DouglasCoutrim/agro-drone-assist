/**
 * Regra de atraso de uma OS.
 *
 * Antes, qualquer OS com `data_previsao` no passado aparecia como atrasada — inclusive
 * uma OS recém-recebida que ainda nem tinha sido diagnosticada. A regra agora segue o
 * ciclo real do serviço:
 *
 * - **Diagnóstico** (`recebido`, `aberta`, `aguardando_diagnostico`): o prazo é
 *   `data_entrada + prazo_diagnostico_horas` (padrão 48h, ajustável por OS). Enquanto o
 *   técnico não mexe no status dentro desse prazo, a OS não está atrasada.
 * - **Aguardando aprovação** (`aguardando_aprovacao`): o relógio para. Esperar o cliente
 *   decidir não é atraso do técnico.
 * - **Após o aceite** (`aprovado`, `em_reparo`, `em_testes`, `aguardando_peca`, ...): o
 *   prazo passa a ser a `data_previsao` (previsão de entrega).
 * - **Encerradas** (`concluida`, `pronto_retirada`, `entregue`, `finalizada`, `cancelada`):
 *   nunca atrasadas.
 */

export const PRAZO_DIAGNOSTICO_PADRAO_HORAS = 48;

const ENCERRADAS = new Set(["concluida", "pronto_retirada", "entregue", "finalizada", "cancelada"]);
const EM_DIAGNOSTICO = new Set(["recebido", "aberta", "aguardando_diagnostico"]);
const AGUARDANDO_APROVACAO = new Set(["aguardando_aprovacao"]);

const HORA_MS = 60 * 60 * 1000;

export type FasePrazo = "diagnostico" | "aprovacao" | "entrega" | "encerrada";

export interface DadosPrazoOS {
  status: string;
  data_entrada?: string | null;
  data_previsao?: string | null;
  prazo_diagnostico_horas?: number | null;
}

export interface PrazoOS {
  fase: FasePrazo;
  /** true somente quando o prazo da fase já venceu. */
  emAtraso: boolean;
  /** Quando o prazo vence; null quando a fase não tem prazo (aprovação ou encerrada). */
  venceEm: Date | null;
  /** Horas até o vencimento (negativo quando já passou); null quando não há prazo. */
  horasRestantes: number | null;
}

function prazoDaFase(
  fase: FasePrazo,
  venceEm: Date | null,
  agora: Date,
): PrazoOS {
  if (!venceEm) return { fase, emAtraso: false, venceEm: null, horasRestantes: null };
  return {
    fase,
    emAtraso: agora.getTime() > venceEm.getTime(),
    venceEm,
    horasRestantes: (venceEm.getTime() - agora.getTime()) / HORA_MS,
  };
}

export function calcularPrazoOS(os: DadosPrazoOS, agora: Date = new Date()): PrazoOS {
  const status = String(os.status ?? "").toLowerCase();

  if (ENCERRADAS.has(status)) return prazoDaFase("encerrada", null, agora);
  if (AGUARDANDO_APROVACAO.has(status)) return prazoDaFase("aprovacao", null, agora);

  if (EM_DIAGNOSTICO.has(status)) {
    const informado = Number(os.prazo_diagnostico_horas);
    const horas = informado > 0 ? informado : PRAZO_DIAGNOSTICO_PADRAO_HORAS;
    const entrada = os.data_entrada ? new Date(os.data_entrada) : null;
    if (!entrada || Number.isNaN(entrada.getTime())) return prazoDaFase("diagnostico", null, agora);
    return prazoDaFase("diagnostico", new Date(entrada.getTime() + horas * HORA_MS), agora);
  }

  // Demais status: já houve aceite do cliente, então vale a previsão de entrega.
  const previsao = os.data_previsao ? new Date(os.data_previsao) : null;
  if (!previsao || Number.isNaN(previsao.getTime())) return prazoDaFase("entrega", null, agora);
  return prazoDaFase("entrega", previsao, agora);
}

/** true quando a OS está atrasada pela regra acima. */
export function osEmAtraso(os: DadosPrazoOS, agora: Date = new Date()): boolean {
  return calcularPrazoOS(os, agora).emAtraso;
}

/** Duração curta para a tela: "45min", "6h", "3d". */
export function formatarDuracao(horas: number): string {
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))}min`;
  if (horas < 48) return `${Math.floor(horas)}h`;
  return `${Math.floor(horas / 24)}d`;
}

/** Frase de apoio exibida ao lado do prazo: quando vence e quanto falta. */
export function rotuloPrazo(prazo: PrazoOS): string {
  if (prazo.fase === "encerrada") return "OS encerrada — sem prazo correndo.";
  if (prazo.fase === "aprovacao") return "Pausado: aguardando aprovação do cliente.";
  if (!prazo.venceEm || prazo.horasRestantes === null) return "Sem prazo definido para esta fase.";
  const quando = prazo.venceEm.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  return prazo.emAtraso
    ? `Venceu em ${quando} (atrasada há ${formatarDuracao(Math.abs(prazo.horasRestantes))}).`
    : `Vence em ${quando} (faltam ${formatarDuracao(prazo.horasRestantes)}).`;
}
