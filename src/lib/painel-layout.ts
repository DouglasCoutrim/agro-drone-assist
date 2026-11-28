/**
 * Ordem personalizada dos blocos dos painéis (o usuário arrasta e o sistema lembra).
 *
 * No protótipo a ordem fica no próprio navegador, por usuário. Quando a estrutura no banco
 * for aprovada (ver `docs/commits/painel-personalizavel-por-usuario.md`), só as funções
 * `carregarOrdem`/`salvarOrdem`/`limparOrdem` deste arquivo precisam mudar: o componente
 * `PainelOrdenavel` usa apenas esta interface.
 */

const PREFIXO = "livreos:painel";

/** Chave de armazenamento por usuário e por tela (ex.: `livreos:painel:<uuid>:inicio`). */
export function chaveDoPainel(usuarioId: string | undefined, tela: string): string {
  return `${PREFIXO}:${usuarioId || "anon"}:${tela}`;
}

/**
 * Ajusta a ordem salva à realidade atual da tela: descarta ids que não existem mais e
 * acrescenta no fim os blocos novos, para nenhum bloco sumir depois de uma atualização.
 */
export function normalizarOrdem(salva: unknown, idsAtuais: string[]): string[] {
  const validos = new Set(idsAtuais);
  const conhecidos = Array.isArray(salva)
    ? salva.filter((id): id is string => typeof id === "string" && validos.has(id))
    : [];
  const semRepetir = conhecidos.filter((id, i) => conhecidos.indexOf(id) === i);
  const faltantes = idsAtuais.filter((id) => !semRepetir.includes(id));
  return [...semRepetir, ...faltantes];
}

/** Move um item de `de` para `para`, devolvendo uma nova lista (a mesma se nada mudar). */
export function moverItem(lista: string[], de: number, para: number): string[] {
  if (de === para) return lista;
  if (de < 0 || para < 0 || de >= lista.length || para >= lista.length) return lista;
  const copia = [...lista];
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia;
}

/** Lê a ordem salva para a chave informada, já normalizada contra os ids atuais. */
export function carregarOrdem(chave: string, idsAtuais: string[]): string[] {
  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return idsAtuais;
    return normalizarOrdem(JSON.parse(bruto), idsAtuais);
  } catch {
    return idsAtuais;
  }
}

export function salvarOrdem(chave: string, ordem: string[]): void {
  try {
    window.localStorage.setItem(chave, JSON.stringify(ordem));
  } catch {
    // Armazenamento indisponível (modo privado, cota cheia): a ordem só vale nesta sessão.
  }
}

export function limparOrdem(chave: string): void {
  try {
    window.localStorage.removeItem(chave);
  } catch {
    // Nada a fazer.
  }
}
