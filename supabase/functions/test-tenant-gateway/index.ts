import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { gateway, credential } = await req.json();
    if (!credential) return json({ ok: false, message: 'Credencial vazia' }, 400);

    if (gateway === 'asaas') {
      const r = await fetch('https://api.asaas.com/v3/myAccount', {
        headers: { 'access_token': credential },
      });
      if (r.ok) return json({ ok: true });
      return json({ ok: false, message: 'API Key inválida ou bloqueada' });
    }

    if (gateway === 'mercadopago') {
      const r = await fetch('https://api.mercadopago.com/users/me', {
        headers: { 'Authorization': `Bearer ${credential}` },
      });
      if (r.ok) return json({ ok: true });
      return json({ ok: false, message: 'Access Token inválido' });
    }

    return json({ ok: false, message: 'Gateway desconhecido' }, 400);
  } catch (e: any) {
    return json({ ok: false, message: e?.message ?? 'Erro' }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
