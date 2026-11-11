// Cliente da API Focus NFe v2 (https://doc.focusnfe.com.br/reference/introducao)
export type Ambiente = 'homologacao' | 'producao';

export function focusBaseUrl(ambiente: Ambiente) {
  return ambiente === 'producao' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
}

/** Coluna do token no formato legado e coluna que guarda o id do secret no Vault. */
const COLUNA_TOKEN: Record<Ambiente, string> = {
  homologacao: 'focus_token_homologacao',
  producao: 'focus_token_producao',
};
const COLUNA_SECRET: Record<Ambiente, string> = {
  homologacao: 'focus_token_hom_secret_id',
  producao: 'focus_token_prod_secret_id',
};

export function ambienteFocus(config: any): Ambiente {
  return config?.ambiente === 'producao' ? 'producao' : 'homologacao';
}

export function focusToken(config: any): string | null {
  const ambiente = ambienteFocus(config);
  const fromConfig = config?.[COLUNA_TOKEN[ambiente]];
  return fromConfig || Deno.env.get(ambiente === 'producao' ? 'FOCUS_NFE_TOKEN_PRODUCAO' : 'FOCUS_NFE_TOKEN_HOMOLOGACAO') || null;
}

/**
 * Carrega o token do ambiente no Vault (RPC get_focus_token, liberada só para o service_role) e
 * devolve a configuração com o token preenchido, para o restante do código continuar usando
 * focusToken(config). Enquanto a migração não termina, organização sem secret cadastrado ainda é
 * atendida pela coluna legada, com aviso no log — nunca registrando o valor do token.
 */
export async function withFocusToken(admin: any, config: any): Promise<any> {
  if (!config?.organization_id) return config;
  const ambiente = ambienteFocus(config);
  const secretId = config[COLUNA_SECRET[ambiente]];

  if (secretId) {
    const { data, error } = await admin.rpc('get_focus_token', { _org: config.organization_id, _ambiente: ambiente });
    if (error) {
      console.error('[focus-nfe] Falha ao ler o token no Vault; usando a coluna legada', { organization_id: config.organization_id, ambiente, erro: error.message });
    } else if (typeof data === 'string' && data.trim()) {
      return { ...config, [COLUNA_TOKEN[ambiente]]: data.trim() };
    } else {
      console.error('[focus-nfe] Vault não devolveu o token do ambiente; usando a coluna legada', { organization_id: config.organization_id, ambiente });
    }
  }

  if (config[COLUNA_TOKEN[ambiente]]) {
    console.warn('[focus-nfe] Token lido da coluna legada; cadastre o token no Vault', { organization_id: config.organization_id, ambiente });
  }
  return config;
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

/** Data de emissão no fuso de Brasília (-03:00), com 2 min de margem para evitar rejeição 703. */
export function dataEmissaoBrasil(): string {
  const d = new Date(Date.now() - 2 * 60 * 1000 - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 19) + '-03:00';
}
