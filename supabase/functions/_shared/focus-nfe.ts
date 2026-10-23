// Cliente da API Focus NFe v2 (https://doc.focusnfe.com.br/reference/introducao)
export type Ambiente = 'homologacao' | 'producao';

export function focusBaseUrl(ambiente: Ambiente) {
  return ambiente === 'producao' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
}

export function focusToken(config: any): string | null {
  const ambiente: Ambiente = config?.ambiente === 'producao' ? 'producao' : 'homologacao';
  const fromConfig = ambiente === 'producao' ? config?.focus_token_producao : config?.focus_token_homologacao;
  return fromConfig || Deno.env.get(ambiente === 'producao' ? 'FOCUS_NFE_TOKEN_PRODUCAO' : 'FOCUS_NFE_TOKEN_HOMOLOGACAO') || null;
}

export async function focusRequest(config: any, method: string, path: string, body?: unknown) {
  const token = focusToken(config);
  if (!token) throw new Error('Token da Focus NFe não configurado para o ambiente selecionado.');
  const res = await fetch(`${focusBaseUrl(config.ambiente)}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${btoa(`${token}:`)}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { mensagem: text }; }
  return { ok: res.ok, status: res.status, data };
}

/** Converte o retorno da Focus em uma mensagem legível. */
export function focusErrorMessage(data: any): string {
  if (!data) return 'Resposta vazia da Focus NFe';
  if (Array.isArray(data.erros) && data.erros.length) {
    return data.erros.map((e: any) => `${e.campo ? e.campo + ': ' : ''}${e.mensagem}`).join(' | ');
  }
  return data.mensagem_sefaz || data.mensagem || data.codigo || 'Erro desconhecido na Focus NFe';
}

export function onlyDigits(v?: string | null) {
  return (v || '').replace(/\D/g, '');
}

export function absoluteUrl(config: any, path?: string | null) {
  if (!path) return null;
  return path.startsWith('http') ? path : `${focusBaseUrl(config.ambiente)}${path}`;
}

/** Mapeia status Focus → status interno */
export function mapStatus(focusStatus?: string): string {
  switch (focusStatus) {
    case 'autorizado': return 'autorizado';
    case 'cancelado': return 'cancelado';
    case 'erro_autorizacao': return 'rejeitado';
    case 'denegado': return 'denegado';
    default: return 'processando';
  }
}
