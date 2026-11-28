// Checkout público de assinatura (link compartilhável para pagar a mensalidade).
//
// Ações:
//  - create  → requer JWT de administrador da organização; cria a sessão de checkout e devolve o link.
//  - info    → público; autenticado pelo token do link; mostra plano, ciclo, valor e pagamento existente.
//  - charge  → público; cria (ou reaproveita) cliente e cobrança no Asaas e devolve PIX/boleto.
//  - status  → público; usado pelo polling da página até o pagamento ser confirmado.
//
// O token do link nunca é gravado em texto puro: a tabela guarda apenas o SHA-256.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { ALLOWED_ORIGIN } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PLANOS_VALIDOS = ['bronze', 'prata', 'ouro'];
const CICLOS: Record<string, { meses: number; desconto: number; rotulo: string }> = {
  mensal: { meses: 1, desconto: 0, rotulo: 'mensal' },
  semestral: { meses: 6, desconto: 0.10, rotulo: 'semestral' },
  anual: { meses: 12, desconto: 0.20, rotulo: 'anual' },
};
const DIAS_VALIDADE_LINK = 7;
const DIAS_VENCIMENTO = 3;

// Rate limit simples por isolate (protege o link público contra varredura de token).
const tentativas = new Map<string, { n: number; inicio: number }>();
function dentroDoLimite(chave: string, max = 30, janela = 60000): boolean {
  const agora = Date.now();
  const atual = tentativas.get(chave);
  if (!atual || agora - atual.inicio > janela) {
    tentativas.set(chave, { n: 1, inicio: agora });
    return true;
  }
  atual.n += 1;
  return atual.n <= max;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

function tokenAleatorio(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function calcularValor(monthlyPrice: number, ciclo: string): number {
  const cfg = CICLOS[ciclo] || CICLOS.mensal;
  return Number((Number(monthlyPrice) * cfg.meses * (1 - cfg.desconto)).toFixed(2));
}

function vencimentoPrevisto(): string {
  const d = new Date();
  d.setDate(d.getDate() + DIAS_VENCIMENTO);
  return d.toISOString().slice(0, 10);
}

function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function apenasDigitos(valor: unknown): string {
  return String(valor ?? '').replace(/\D/g, '');
}

type Pagador = { nome: string; cpfCnpj: string; email: string; telefone: string };

function normalizarPagador(body: any): Pagador {
  return {
    nome: String(body?.nome ?? '').trim(),
    cpfCnpj: apenasDigitos(body?.cpfCnpj),
    email: String(body?.email ?? '').trim().toLowerCase(),
    telefone: apenasDigitos(body?.telefone),
  };
}

function validarPagador(p: Pagador): string | null {
  if (p.nome.length < 3) return 'Informe o nome completo de quem está pagando.';
  if (![11, 14].includes(p.cpfCnpj.length)) return 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return 'Informe um e-mail válido para receber o comprovante.';
  if (p.telefone && p.telefone.length < 10) return 'Telefone incompleto: informe DDD + número.';
  return null;
}

function chaveAsaas(): { chave: string; base: string; ambiente: string } | null {
  const chave = Deno.env.get('PLATFORM_ASAAS_API_KEY') || Deno.env.get('ASAAS_API_KEY') || '';
  if (!chave) return null;
  const ambiente = chave.startsWith('$aact_hmlg') ? 'sandbox' : 'producao';
  const base = ambiente === 'sandbox' ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3';
  return { chave, base, ambiente };
}

async function buscarPlano(admin: any, slug: string) {
  const { data } = await admin
    .from('subscription_plans')
    .select('slug, name, monthly_price')
    .eq('slug', slug)
    .maybeSingle();
  return data;
}

async function garantirCliente(base: string, chave: string, pagador: Pagador, organizationId: string) {
  const headers = { 'access_token': chave, 'Content-Type': 'application/json' };
  const busca = await fetch(`${base}/customers?cpfCnpj=${pagador.cpfCnpj}`, { headers })
    .then((r) => r.json())
    .catch(() => null);
  const existente = busca?.data?.[0];
  if (existente?.id) return existente;

  return await fetch(`${base}/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: pagador.nome,
      email: pagador.email || undefined,
      mobilePhone: pagador.telefone || undefined,
      cpfCnpj: pagador.cpfCnpj,
      externalReference: `org:${organizationId}`,
    }),
  }).then((r) => r.json()).catch(() => null);
}

async function detalhesCobranca(base: string, chave: string, chargeId: string) {
  const headers = { 'access_token': chave };
  const [pgto, pix] = await Promise.all([
    fetch(`${base}/payments/${chargeId}`, { headers }).then((r) => r.json()).catch(() => null),
    fetch(`${base}/payments/${chargeId}/pixQrCode`, { headers }).then((r) => r.json()).catch(() => null),
  ]);
  if (!pgto?.id) return null;
  return {
    id: pgto.id,
    status: pgto.status ?? null,
    valor: pgto.value ?? null,
    vencimento: pgto.dueDate ?? null,
    invoice_url: pgto.invoiceUrl ?? null,
    bank_slip_url: pgto.bankSlipUrl ?? null,
    barcode: pgto.identificationField ?? null,
    pix_payload: pix?.payload ?? null,
    pix_qr_image: pix?.encodedImage ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json().catch(() => ({}));

    if (body?.action === 'create') return await criarSessao(req, admin, body);

    if (['info', 'charge', 'status'].includes(body?.action)) {
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'desconhecido';
      if (!dentroDoLimite(`checkout_${ip}`)) {
        return json({ error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' }, 429);
      }
      return await acoesPublicas(admin, body);
    }

    return json({ error: 'Ação inválida' }, 400);
  } catch (e: any) {
    console.error('[public-checkout] erro inesperado', e);
    return json({ error: 'Não foi possível processar a solicitação.' }, 500);
  }
});

async function criarSessao(req: Request, admin: any, body: any) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401);

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(authHeader.slice(7));
  const userId = claimsData?.claims?.sub as string | undefined;
  if (claimsError || !userId) return json({ error: 'Sessão inválida' }, 401);

  const { plan_slug, cycle } = body;
  if (!PLANOS_VALIDOS.includes(plan_slug)) return json({ error: 'Plano inválido' }, 400);
  if (!CICLOS[cycle]) return json({ error: 'Ciclo inválido' }, 400);

  const { data: profile } = await admin
    .from('profiles').select('organization_id').eq('id', userId).maybeSingle();
  if (!profile?.organization_id) return json({ error: 'Usuário sem organização' }, 400);

  const { data: papel } = await admin
    .from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (!papel) return json({ error: 'Apenas administradores podem gerar o link de pagamento' }, 403);

  const plano = await buscarPlano(admin, plan_slug);
  if (!plano) return json({ error: 'Plano não encontrado' }, 404);

  const token = tokenAleatorio();
  const expiresAt = new Date(Date.now() + DIAS_VALIDADE_LINK * 86400000).toISOString();

  const { error: insertError } = await admin.from('checkout_sessions').insert({
    organization_id: profile.organization_id,
    plan_slug,
    billing_cycle: cycle,
    token_hash: await hashToken(token),
    status: 'created',
    expires_at: expiresAt,
  });
  if (insertError) throw insertError;

  const origem = req.headers.get('origin') || Deno.env.get('APP_PUBLIC_URL') || 'https://livreos.net';

  return json({
    ok: true,
    token,
    url: new URL(`/checkout/${token}`, origem).href,
    expires_at: expiresAt,
    plano: { slug: plano.slug, nome: plano.name },
    ciclo: cycle,
    valor: calcularValor(plano.monthly_price, cycle),
  });
}

async function acoesPublicas(admin: any, body: any) {
  const token = body?.token;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return json({ error: 'Link de pagamento inválido' }, 400);
  }

  const { data: sessao } = await admin
    .from('checkout_sessions').select('*').eq('token_hash', await hashToken(token)).maybeSingle();
  if (!sessao) return json({ error: 'Link de pagamento inválido ou já removido' }, 404);

  if (sessao.status === 'cancelled') return json({ error: 'Este link de pagamento foi cancelado.' }, 410);

  if (sessao.status !== 'paid' && new Date(sessao.expires_at).getTime() < Date.now()) {
    if (sessao.status !== 'expired') {
      await admin.from('checkout_sessions').update({ status: 'expired' }).eq('id', sessao.id);
    }
    return json({ error: 'Este link expirou. Solicite um novo link para a sua empresa.' }, 410);
  }

  if (body.action === 'info') return await infoSessao(admin, sessao);
  if (body.action === 'charge') return await gerarCobranca(admin, sessao, body);
  return await statusSessao(admin, sessao);
}

async function infoSessao(admin: any, sessao: any) {
  const plano = await buscarPlano(admin, sessao.plan_slug);
  if (!plano) return json({ error: 'Plano indisponível. Fale com o suporte.' }, 409);

  const { data: org } = await admin
    .from('organizations').select('name, owner_id, telefone').eq('id', sessao.organization_id).maybeSingle();
  const { data: cfg } = await admin
    .from('empresa_config').select('cnpj, telefone').eq('organization_id', sessao.organization_id).maybeSingle();
  const { data: dono } = await admin
    .from('profiles').select('email, nome').eq('id', org?.owner_id).maybeSingle();

  const asaas = chaveAsaas();
  const pagamento = sessao.asaas_charge_id && asaas
    ? await detalhesCobranca(asaas.base, asaas.chave, sessao.asaas_charge_id)
    : null;

  return json({
    ok: true,
    status: sessao.status,
    empresa: org?.name ?? null,
    plano: { slug: plano.slug, nome: plano.name },
    ciclo: sessao.billing_cycle,
    valor: calcularValor(plano.monthly_price, sessao.billing_cycle),
    vencimento: vencimentoPrevisto(),
    expira_em: sessao.expires_at,
    sugestao: {
      nome: org?.name ?? dono?.nome ?? '',
      cpfCnpj: cfg?.cnpj ?? '',
      email: dono?.email ?? '',
      telefone: cfg?.telefone ?? org?.telefone ?? '',
    },
    pagamento,
  });
}

async function statusSessao(admin: any, sessao: any) {
  let faturaStatus: string | null = null;
  let pagoEm: string | null = null;
  if (sessao.invoice_id) {
    const { data: fatura } = await admin
      .from('tenant_invoices').select('status, pago_em').eq('id', sessao.invoice_id).maybeSingle();
    faturaStatus = fatura?.status ?? null;
    pagoEm = fatura?.pago_em ?? null;
  }
  return json({
    ok: true,
    status: sessao.status,
    pago_em: sessao.completed_at ?? pagoEm,
    fatura_status: faturaStatus,
  });
}

async function gerarCobranca(admin: any, sessao: any, body: any) {
  if (sessao.status === 'paid') return json({ ok: true, status: 'paid', pagamento: null });

  const asaas = chaveAsaas();
  if (!asaas) {
    console.error('[public-checkout] PLATFORM_ASAAS_API_KEY ausente');
    return json({ error: 'Pagamento indisponível no momento. Fale com o suporte.' }, 503);
  }

  if (sessao.asaas_charge_id) {
    const existente = await detalhesCobranca(asaas.base, asaas.chave, sessao.asaas_charge_id);
    if (existente && existente.status !== 'REFUNDED' && existente.status !== 'CHARGEBACK_REQUESTED') {
      return json({
        ok: true,
        status: sessao.status,
        valor: existente.valor,
        vencimento: existente.vencimento,
        pagamento: existente,
      });
    }
  }

  const pagador = normalizarPagador(body);
  const erroPagador = validarPagador(pagador);
  if (erroPagador) return json({ error: erroPagador }, 400);

  const plano = await buscarPlano(admin, sessao.plan_slug);
  if (!plano) return json({ error: 'Plano indisponível. Fale com o suporte.' }, 409);

  const valor = calcularValor(plano.monthly_price, sessao.billing_cycle);
  const vencimento = vencimentoPrevisto();
  const competencia = competenciaAtual();

  const cliente = await garantirCliente(asaas.base, asaas.chave, pagador, sessao.organization_id);
  if (!cliente?.id) {
    const detalhe = cliente?.errors?.[0]?.description;
    console.error('[public-checkout] falha ao criar cliente Asaas', detalhe);
    await admin.from('checkout_sessions').update({
      status: 'failed',
      last_error: detalhe || 'Falha ao criar o cliente de cobrança',
    }).eq('id', sessao.id);
    return json({ error: detalhe || 'Não foi possível gerar a cobrança. Confira os dados informados.' }, 400);
  }

  const cobranca = await fetch(`${asaas.base}/payments`, {
    method: 'POST',
    headers: { 'access_token': asaas.chave, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer: cliente.id,
      billingType: 'UNDEFINED',
      value: valor,
      dueDate: vencimento,
      description: `Assinatura ${plano.name} - plano ${sessao.billing_cycle}`,
      externalReference: `tenant:${sessao.organization_id}:${competencia}`,
    }),
  }).then((r) => r.json()).catch(() => null);

  if (!cobranca?.id) {
    const detalhe = cobranca?.errors?.[0]?.description;
    console.error('[public-checkout] falha ao criar cobrança Asaas', detalhe);
    await admin.from('checkout_sessions').update({
      status: 'failed',
      last_error: detalhe || 'Falha ao criar a cobrança',
    }).eq('id', sessao.id);
    return json({ error: detalhe || 'Não foi possível gerar a cobrança. Tente novamente.' }, 400);
  }

  const { data: fatura, error: faturaError } = await admin.from('tenant_invoices').insert({
    organization_id: sessao.organization_id,
    competencia,
    valor,
    vencimento,
    status: 'pendente',
    asaas_charge_id: cobranca.id,
    payment_url: cobranca.invoiceUrl ?? null,
    bank_slip_url: cobranca.bankSlipUrl ?? null,
    barcode: cobranca.identificationField ?? null,
    billing_cycle: sessao.billing_cycle,
    asaas_environment: asaas.ambiente,
    checkout_session_id: sessao.id,
  }).select('id').single();
  if (faturaError) throw faturaError;

  await admin.from('checkout_sessions').update({
    status: 'awaiting_payment',
    invoice_id: fatura.id,
    asaas_customer_id: cliente.id,
    asaas_charge_id: cobranca.id,
    last_error: null,
  }).eq('id', sessao.id);

  const pagamento = await detalhesCobranca(asaas.base, asaas.chave, cobranca.id);

  return json({
    ok: true,
    status: 'awaiting_payment',
    valor,
    vencimento,
    pagamento: pagamento ?? {
      id: cobranca.id,
      status: cobranca.status ?? null,
      valor,
      vencimento,
      invoice_url: cobranca.invoiceUrl ?? null,
      bank_slip_url: cobranca.bankSlipUrl ?? null,
      barcode: cobranca.identificationField ?? null,
      pix_payload: null,
      pix_qr_image: null,
    },
  });
}
