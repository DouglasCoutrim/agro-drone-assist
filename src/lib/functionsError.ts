/** Mensagem devolvida pela Edge Function (corpo JSON) ou a mensagem padrão do erro de chamada. */
export async function mensagemDoErroFuncao(error: any, fallback: string): Promise<string> {
  let corpo: any = null;
  if (error?.context instanceof Response) {
    try { corpo = await error.context.clone().json(); } catch { /* corpo sem JSON */ }
  }
  return (typeof corpo?.error === 'string' && corpo.error) || error?.message || fallback;
}
