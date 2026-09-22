// Webhook do Asaas para cobranças emitidas pelas oficinas (tenants).
// Escuta PAYMENT_RECEIVED / PAYMENT_CONFIRMED e marca a fatura local como paga.
// verify_jwt=true no config.toml - requer autenticação JWT.

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://iynljexyjhbkfxsurddn.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Verificar JWT (verify_jwt=true) e webhook secret
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const secret = Deno.env.get('WEBHOOK_SECRET');
  const provided = req.headers.get('x-webhook-secret') || '';
  if (secret && provided !== secret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await req.json();
    const event = body?.event;
    const payment = body?.payment;
    if (!event || !payment) return json({ ok: true });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const ref = payment.externalReference;
      if (ref) {
        // Só busca por id se `ref` for um UUID válido; um número de OS legado
        // (ex.: "OS-0001") aqui faria o .eq('id', ref) estourar erro de tipo.
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
        const { data: os } = isUuid
          ? await admin.from('ordens_servico').select('id').eq('id', ref).maybeSingle()
          : { data: null };
        if (os) {
          // "finalizada" não existe no enum status_os (aberta, em_andamento,
          // aguardando_peca, concluida, entregue, cancelada, recebido,
          // aguardando_diagnostico, aguardando_aprovacao, aprovado, em_reparo,
          // em_testes, pronto_retirada, ...) — esse update sempre falhava.
          // Ajustado para "entregue", que é o status terminal mais próximo
          // do que a migration original pretendia. Confirme se é o status
          // certo para o seu fluxo de negócio.
          await admin.from('ordens_servico').update({ status: 'entregue' }).eq('id', ref);
        } else if (isUuid) {
          await admin.from('orcamentos').update({ status: 'aprovado' }).eq('id', ref);
        }
      }
      console.log(`[asaas-tenant-webhook] ${event}`, payment.id, ref);
    }

    return json({ received: true });
  } catch (e: any) {
    console.error('asaas-tenant-webhook error', e);
    return json({ error: e?.message ?? 'erro' }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
