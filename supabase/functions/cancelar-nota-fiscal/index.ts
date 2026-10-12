import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const corsHeadersRestricted = {
  'Access-Control-Allow-Origin': 'https://iynljexyjhbkfxsurddn.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Role check - apenas admin
    const { data: roleRows } = await admin
      .from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin');
    if (!roleRows?.length) {
      return json({ error: 'Forbidden: apenas administradores podem cancelar NF' }, 403);
    }

    const { data: profile } = await admin.from('profiles').select('organization_id').eq('id', userId).maybeSingle();
    if (!profile?.organization_id) return json({ error: 'Sem organização' }, 400);

    const { nf_id, motivo } = await req.json();
    if (!nf_id || !motivo) return json({ error: 'nf_id e motivo são obrigatórios' }, 400);

    // Buscar NF
    const { data: nf, error: nfErr } = await admin
      .from('nota_fiscal_emitida')
      .select('*')
      .eq('id', nf_id)
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (nfErr) throw nfErr;
    if (!nf) return json({ error: 'Nota fiscal não encontrada' }, 404);

    if (nf.status === 'cancelado') {
      return json({ error: 'Nota fiscal já cancelada' }, 400);
    }

    if (nf.status !== 'autorizado') {
      return json({ error: 'Apenas notas autorizadas podem ser canceladas' }, 400);
    }

    // Buscar configuração da empresa
    const { data: empresa } = await admin
      .from('empresa_config')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (!empresa) return json({ error: 'Configuração da empresa não encontrada' }, 400);

    // Cancelar na Focus NFe
    if (nf.provider === 'focusnfe' && nf.provider_id) {
      const focusApiKey = empresa.focus_nfe_api_key || Deno.env.get('FOCUS_NFE_API_KEY');
      const focusEnvironment = empresa.focus_nfe_environment || 'homologacao';
      
      if (focusApiKey) {
        const baseUrl = focusEnvironment === 'producao'
          ? 'https://api.focusnfe.com.br/v2'
          : 'https://homologacao.focusnfe.com.br/v2';

        const endpoint = nf.tipo === 'nfse' ? 'nfse' : 'nfe';
        
        const cancelResp = await fetch(`${baseUrl}/${endpoint}/${nf.provider_id}/cancelar`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${focusApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ justificativa: motivo }),
        });

        const cancelResult = await cancelResp.json();
        
        if (!cancelResp.ok) {
          console.warn('Erro ao cancelar na Focus NFe:', cancelResult);
          // Continua mesmo com erro na API externa para marcar como cancelado localmente
        }
      }
    }

    // Atualizar NF local
    await admin.from('nota_fiscal_emitida').update({
      status: 'cancelado',
      cancelada_em: new Date().toISOString(),
      cancelada_por: userId,
      motivo_rejeicao: motivo,
    }).eq('id', nf_id);

    // Registrar evento
    await admin.from('nota_fiscal_eventos').insert({
      nf_id,
      tipo_evento: 'cancelamento',
      descricao: 'Nota fiscal cancelada',
      dados_evento: { motivo },
    });

    // Se era NF de venda, limpar referência
    if (nf.venda_id) {
      await admin.from('vendas').update({
        nf_numero: null,
        nf_chave: null,
        nf_emitida_em: null,
        nf_provider: null,
      }).eq('id', nf.venda_id);
    }

    // Se era NF de OS, limpar referência
    if (nf.os_id) {
      await admin.from('ordens_servico').update({
        nf_numero: null,
        nf_chave: null,
        nf_emitida_em: null,
        nf_provider: null,
      }).eq('id', nf.os_id);
    }

    return json({ success: true, message: 'Nota fiscal cancelada com sucesso' });

  } catch (e: any) {
    console.error('cancelar-nota-fiscal error:', e);
    return json({ error: e?.message || 'Erro interno' }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
    status,
  });
}