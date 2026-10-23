// Recebe avisos da Focus NFe (https://doc.focusnfe.com.br/reference/webhooks).
// O corpo do aviso não é confiável: usamos só a referência e reconsultamos a Focus com o token da empresa.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { absoluteUrl, focusErrorMessage, focusRequest, mapStatus } from '../_shared/focus-nfe.ts';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const ref = typeof body?.ref === 'string' ? body.ref.slice(0, 200) : '';
    if (!ref) return json({ ok: true, ignorado: 'sem referência' });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: nf } = await admin.from('nota_fiscal_emitida').select('*').eq('referencia', ref).maybeSingle();
    if (!nf) return json({ ok: true, ignorado: 'nota desconhecida' });
    const { data: config } = await admin.from('nfe_config').select('*').eq('organization_id', nf.organization_id).maybeSingle();
    if (!config) return json({ ok: true, ignorado: 'sem configuração' });

    const cfg = { ...config, ambiente: nf.ambiente };
    const tipo = nf.tipo === 'nfse' ? 'nfse' : 'nfe';
    const r = await focusRequest(cfg, 'GET', `/v2/${tipo}/${encodeURIComponent(ref)}`);
    if (!r.ok) return json({ ok: true, ignorado: 'consulta falhou' });
    const data = r.data;
    const status = mapStatus(data?.status);
    if (status === nf.status) return json({ ok: true, status });

    const patch: Record<string, unknown> = { status, payload_retorno: data };
    if (status === 'autorizado') {
      Object.assign(patch, tipo === 'nfe' ? {
        numero: data.numero ? String(data.numero) : nf.numero,
        serie: data.serie ? String(data.serie) : nf.serie,
        chave_acesso: data.chave_nfe ? String(data.chave_nfe).replace(/^NFe/, '') : nf.chave_acesso,
        protocolo: data.protocolo || null,
        xml_url: absoluteUrl(cfg, data.caminho_xml_nota_fiscal),
        pdf_url: absoluteUrl(cfg, data.caminho_danfe),
      } : {
        numero: data.numero ? String(data.numero) : nf.numero,
        chave_acesso: data.codigo_verificacao || nf.chave_acesso,
        xml_url: absoluteUrl(cfg, data.caminho_xml_nota_fiscal),
        pdf_url: data.url_danfse || data.url || absoluteUrl(cfg, data.caminho_pdf_nota_fiscal),
      }, { emitida_em: new Date().toISOString(), motivo_rejeicao: null });
    } else if (status === 'rejeitado' || status === 'denegado') {
      patch.motivo_rejeicao = focusErrorMessage(data);
    }
    await admin.from('nota_fiscal_emitida').update(patch).eq('id', nf.id);
    if (status !== 'processando') {
      await admin.from('nota_fiscal_eventos').insert({
        nf_id: nf.id, tipo_evento: status === 'autorizado' ? 'autorizacao' : status,
        descricao: status === 'autorizado' ? 'Autorizada (aviso automático da Focus)' : (patch.motivo_rejeicao as string) || status,
        dados_evento: data,
      });
    }
    if (status === 'autorizado' && nf.venda_id) {
      await admin.from('vendas').update({ nf_numero: patch.numero, nf_chave: patch.chave_acesso, nf_emitida_em: patch.emitida_em, nf_provider: 'focusnfe' }).eq('id', nf.venda_id);
    }
    if (status === 'autorizado' && nf.os_id) {
      await admin.from('ordens_servico').update({ nfe_emitida: true, nfse_numero: patch.numero }).eq('id', nf.os_id);
    }
    return json({ ok: true, status });
  } catch (e: any) {
    console.error('focus-webhook', e);
    return json({ error: 'Erro interno' }, 500);
  }
});
