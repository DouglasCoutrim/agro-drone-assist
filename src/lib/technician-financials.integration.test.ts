import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { createClient } from '@supabase/supabase-js';

// Authenticated regression check; mint the requesting user's session before running.
const sessionPath = `${homedir()}/.cache/lovable-auth/session.json`;
const available = existsSync(sessionPath) && Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

test('principal commissions remain readable without retired assignment records', { skip: !available }, async () => {
  const minted = JSON.parse(readFileSync(sessionPath, 'utf8'));
  const client = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${minted.session.access_token}` } },
  });
  const userId = minted.session.user.id;
  const { data: profile, error: profileError } = await client.from('profiles').select('organization_id').eq('id', userId).single();
  assert.equal(profileError, null);
  assert.ok(profile?.organization_id);
  const { data: orders, error: ordersError } = await client.from('ordens_servico').select('commission_total')
    .eq('organization_id', profile.organization_id).eq('tecnico_id', userId)
    .in('status', ['entregue', 'finalizada', 'concluida'])
    .gte('data_conclusao', '2026-08-01').lt('data_conclusao', '2026-09-01');
  assert.equal(ordersError, null);
  assert.ok(orders && orders.length > 0, 'Use a session with completed August orders for this regression');
  const { data, error } = await client.rpc('get_technician_financial_dashboard', {
    _tecnico_id: userId, _period_start: '2026-08-01', _period_end: '2026-08-31',
  });
  assert.equal(error, null);
  // Payload novo: comissao_periodo é a soma de commission_total (já líquida) das OS concluídas no período.
  assert.equal(data.comissao_periodo_count, orders.length);
  assert.equal(Number(data.comissao_periodo), orders.reduce((sum, os) => sum + Number(os.commission_total || 0), 0));
  assert.equal(Object.prototype.hasOwnProperty.call(data, 'retencoes_pendentes'), false);
  // As quatro situações substituíram o antigo resumo.
  for (const chave of ['a_receber', 'aguardando_cliente', 'recebido', 'divergencia']) {
    assert.equal(Object.prototype.hasOwnProperty.call(data, chave), true, `faltou ${chave}`);
  }
});

test('financial summary denies a target outside the caller organization', { skip: !available }, async () => {
  const minted = JSON.parse(readFileSync(sessionPath, 'utf8'));
  const client = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${minted.session.access_token}` } },
  });
  const { error } = await client.rpc('get_technician_financial_dashboard', {
    _tecnico_id: '00000000-0000-0000-0000-000000000000', _period_start: '2026-08-01', _period_end: '2026-08-31',
  });
  assert.equal(error?.message, 'Acesso negado');
});