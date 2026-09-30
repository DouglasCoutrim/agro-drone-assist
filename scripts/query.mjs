#!/usr/bin/env node
// Consulta de leitura ao backend (Lovable Cloud / Supabase) a partir do Cursor.
//
// Uso:
//   TEST_EMAIL=... TEST_PASSWORD=... node scripts/query.mjs <tabela> [colunas] [flags]
//
// Flags:
//   --limit N            limita o número de linhas (default 20)
//   --eq col=valor       filtro de igualdade (pode repetir)
//   --order col[:desc]   ordenação
//   --count              retorna apenas a contagem
//
// Exemplos:
//   node scripts/query.mjs clientes "nome,telefone" --limit 20
//   node scripts/query.mjs ordens_servico "numero,status,valor_final" --eq status=entregue
//
// A chave usada é a publicável (pública por design). A RLS continua ativa:
// o agente vê exatamente o que o usuário autenticado vê.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(path = '.env') {
  try {
    for (const raw of readFileSync(path, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // .env ausente: seguimos com as variáveis já no ambiente
  }
}

function parseArgs(argv) {
  const positional = [];
  const eq = [];
  let limit = 20;
  let order = null;
  let count = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') limit = Number(argv[++i]);
    else if (a === '--eq') eq.push(argv[++i]);
    else if (a === '--order') order = argv[++i];
    else if (a === '--count') count = true;
    else positional.push(a);
  }
  return { table: positional[0], columns: positional[1] || '*', eq, limit, order, count };
}

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
if (!args.table) {
  fail('Informe a tabela. Ex: node scripts/query.mjs clientes "nome,telefone" --limit 10');
}

loadEnvFile();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

if (!url || !key) fail('VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY não encontrados no .env.');
if (!email || !password) {
  fail(
    'Defina TEST_EMAIL e TEST_PASSWORD no ambiente (um usuário real do app).\n' +
      '  export TEST_EMAIL="voce@empresa.com"\n' +
      '  export TEST_PASSWORD="..."'
  );
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) fail(`Falha no login: ${authError.message}`);
console.error(`✓ autenticado como ${auth.user?.email} (${auth.user?.id})`);

let q = supabase.from(args.table).select(args.columns, args.count ? { count: 'exact', head: true } : undefined);

for (const pair of args.eq) {
  const idx = pair.indexOf('=');
  if (idx === -1) fail(`Filtro inválido: "${pair}". Use --eq coluna=valor`);
  q = q.eq(pair.slice(0, idx), pair.slice(idx + 1));
}

if (args.order) {
  const [col, dir] = args.order.split(':');
  q = q.order(col, { ascending: dir !== 'desc' });
}

if (!args.count) q = q.limit(args.limit);

const { data, error, count } = await q;

if (error) {
  const rls = /row-level security|permission denied/i.test(error.message || '');
  console.error(`\n✖ Erro na consulta: ${error.message}`);
  if (error.hint) console.error(`  hint: ${error.hint}`);
  if (rls) {
    console.error(
      '  → A RLS bloqueou o acesso. Isso é esperado se o usuário não pertence à organização dona desses dados.'
    );
  }
  await supabase.auth.signOut();
  process.exit(1);
}

if (args.count) {
  console.log(JSON.stringify({ table: args.table, count }, null, 2));
} else {
  console.log(JSON.stringify(data, null, 2));
  console.error(`\n✓ ${data?.length ?? 0} linha(s)`);
}

await supabase.auth.signOut();
