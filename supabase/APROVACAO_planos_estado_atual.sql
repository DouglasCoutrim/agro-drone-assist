-- ============================================================================
-- Fixa o estado atual dos planos de assinatura (bronze, prata, ouro, Isento).
--
-- STATUS: APLICADO em 2026-11-21 (upsert dos 4 planos por slug). Este arquivo
-- fica como registro.
--
-- Por que este arquivo existe:
--   Os quatro planos foram ajustados direto no banco (SQL editor), fora do
--   historico de migrations. As migrations antigas ainda criam os planos COM a
--   chave 'mercado_livre' e nao conhecem 'bronze' nem 'Isento':
--     - supabase/migrations/20260516203757_b4496417-...sql (linhas 10 e 16)
--     - supabase/migrations/20260516205740_b14373ea-...sql (linhas 7 e 8)
--   Reaplicar as migrations do zero REINTRODUZ a chave 'mercado_livre'.
--
--   Nao foi gravado em supabase/migrations/: aquela pasta e gerada por sistema
--   externo. Este arquivo e a proposta, para rodar aqui ou portar para la.
--
-- 1) Rode o bloco de VERIFICACAO e confira os valores abaixo.
-- 2) So depois rode o bloco de ATUALIZACAO, primeiro no projeto de teste.
--
-- Valores lidos de producao (leitura, sem alteracao):
--   slug    | name   | mensal | anual | usuarios | OS/mes | recursos
--   Isento  | Isento |  0,00  |  0,00 |   100    |  1000  | nenhum
--   bronze  | Bronze | 39,90  |  0,00 |     2    |    30  | os, clientes, estoque, orcamentos
--   prata   | Prata  | 59,90  |  0,00 |     4    |    60  | + financeiro, cobrancas_asaas, whatsapp_templates
--   ouro    | Ouro   | 69,90  |  0,00 |    10    |    -1  | + rotas, whitelabel, api_rest, suporte_prioritario
--
-- ATENCAO / conferir antes de aprovar:
--   - 'yearly_price' esta 0,00 nos quatro planos e 'billing_cycle' e 'monthly'
--     em todos. A tela de assinatura (src/pages/Assinatura.tsx) oferece
--     semestral (-10%) e anual (-20%) calculando o desconto apenas no front,
--     sem preco anual no banco.
--   - O plano 'Isento' NAO e ilimitado: max_users 100 e max_os_per_month 1000
--     (somente o Ouro tem -1). Se a intencao era ilimitado, ajuste aqui antes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- VERIFICACAO (somente leitura)
-- ----------------------------------------------------------------------------
select slug, name, monthly_price, yearly_price, billing_cycle,
       max_users, max_os_per_month, active, features
from public.subscription_plans
order by monthly_price;

-- Deve retornar zero linhas
select slug from public.subscription_plans where features::text like '%mercado_livre%';

-- ----------------------------------------------------------------------------
-- ATUALIZACAO (executar somente apos aprovacao)
-- ----------------------------------------------------------------------------
begin;

-- Fixa os quatro planos pelo slug (idempotente: rodar duas vezes nao duplica).
insert into public.subscription_plans
  (slug, name, monthly_price, yearly_price, billing_cycle,
   max_users, max_os_per_month, features, active)
values
  ('Isento', 'Isento', 0.00, 0.00, 'monthly', 100, 1000,
   '[]'::jsonb, true),
  ('bronze', 'Bronze', 39.90, 0.00, 'monthly', 2, 30,
   '["os","clientes","estoque","orcamentos"]'::jsonb, true),
  ('prata', 'Prata', 59.90, 0.00, 'monthly', 4, 60,
   '["os","clientes","estoque","orcamentos","financeiro","cobrancas_asaas","whatsapp_templates"]'::jsonb, true),
  ('ouro', 'Ouro', 69.90, 0.00, 'monthly', 10, -1,
   '["os","clientes","estoque","orcamentos","financeiro","cobrancas_asaas","whatsapp_templates","rotas","whitelabel","api_rest","suporte_prioritario"]'::jsonb, true)
on conflict (slug) do update set
  name             = excluded.name,
  monthly_price    = excluded.monthly_price,
  yearly_price     = excluded.yearly_price,
  billing_cycle    = excluded.billing_cycle,
  max_users        = excluded.max_users,
  max_os_per_month = excluded.max_os_per_month,
  features         = excluded.features,
  active           = excluded.active;

-- Rede de seguranca: se algum plano fora dos quatro listados tiver a chave,
-- remove. Como 'features' e um array jsonb de strings, '-' remove o elemento.
-- Se nao houver nenhum plano com a chave, nao afeta linha alguma.
update public.subscription_plans
set features = features - 'mercado_livre'
where features::text like '%mercado_livre%';

-- Conferencias dentro da transacao
select slug, name, monthly_price, max_users, max_os_per_month, features
from public.subscription_plans
order by monthly_price;

select slug from public.subscription_plans where features::text like '%mercado_livre%';

-- Recarregar o cache de schema do PostgREST (a tabela nao mudou de forma, mas
-- e barato e evita leitura com cache antigo logo apos o apply).
notify pgrst, 'reload schema';

commit;
