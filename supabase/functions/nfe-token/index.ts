import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { focusErrorMessage, focusRequest } from '../_shared/focus-nfe.ts';

/**
 * Troca do token da Focus NFe.
 *
 * O token nunca chega ao navegador: a tela manda o token novo para cá, o valor é
 * validado direto na Focus e só então gravado no Vault pela função
 * public.salvar_focus_token (service_role). A resposta nunca devolve o token,
 * apenas os quatro últimos dígitos.
 *
 * Autenticação: a função é publicada com verify_jwt = false, então o JWT é
 * conferido aqui, e depois o papel (admin) e a organização do usuário.
 */

const ACOES = ['salvar'] as const;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autenticado' }, 401);

    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) {
      console.error('[nfe-token] Variáveis de ambiente do Supabase ausentes');
      return json({ error: 'Configuração indisponível' }, 500);
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    const userId = claims?.claims?.sub as string | undefined;
    if (claimsErr || !userId) return json({ error: 'Não autenticado' }, 401);

    const admin = createClient(url, serviceKey);

    const { data: roles, error: rolesErr } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin');
    if (rolesErr) {
      console.error('[nfe-token] Falha ao ler o papel do usuário', { erro: rolesErr.message });
      return json({ error: 'Não foi possível verificar a permissão' }, 500);
    }
    if (!roles?.length) {
      return json({ error: 'Apenas administradores da empresa podem trocar o token da Focus NFe.' }, 403);
    }

    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .maybeSingle();
    if (profileErr) {
      console.error('[nfe-token] Falha ao ler o perfil', { erro: profileErr.message });
      return json({ error: 'Não foi possível verificar a empresa do usuário' }, 500);
    }
    const orgId = profile?.organization_id as string | undefined;
    if (!orgId) return json({ error: 'Usuário sem empresa vinculada' }, 400);

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;
    if (!action || !ACOES.includes(action as (typeof ACOES)[number])) {
      return json({ error: 'Ação inválida' }, 400);
    }

    const ambiente = body?.ambiente as string | undefined;
    if (ambiente !== 'homologacao' && ambiente !== 'producao') {
      return json({ error: 'Ambiente inválido' }, 400);
    }

    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    if (token.length < 8 || token.length > 400) {
      return json({ error: 'Informe um token válido da Focus NFe.' }, 400);
    }

    // Valida antes de gravar. Referência inexistente devolve 404 com token válido
    // e 401/403 com token inválido (mesmo critério usado em "Testar conexão").
    const teste = await focusRequest(
      { ambiente, focus_token_homologacao: token, focus_token_producao: token },
      'GET',
      '/v2/nfe/teste-conexao-livreos',
    );
    if (!(teste.status === 404 || teste.ok)) {
      console.error('[nfe-token] Focus recusou o token', { organization_id: orgId, ambiente, status: teste.status });
      return json(
        { error: `A Focus NFe recusou o token (${focusErrorMessage(teste.data)}).` },
        422,
      );
    }

    const { data, error } = await admin.rpc('salvar_focus_token', {
      _org: orgId,
      _ambiente: ambiente,
      _token: token,
    });
    if (error) {
      console.error('[nfe-token] Falha ao gravar o token no Vault', {
        organization_id: orgId,
        ambiente,
        erro: error.message,
      });
      return json({ error: 'Não foi possível gravar o token.' }, 500);
    }

    console.log('[nfe-token] Token gravado no Vault', { organization_id: orgId, ambiente });

    return json({
      success: true,
      ambiente,
      ultimos4: (data as { ultimos4?: string } | null)?.ultimos4 ?? token.slice(-4),
      configurado: true,
    });
  } catch (e) {
    console.error('[nfe-token] Erro inesperado', { erro: e instanceof Error ? e.message : String(e) });
    return json({ error: 'Erro inesperado ao salvar o token.' }, 500);
  }
});
