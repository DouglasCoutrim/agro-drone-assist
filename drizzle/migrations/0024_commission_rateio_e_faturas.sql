-- 0024 — Comissão correta (rateio congelado) + faturas de saque do técnico
--
-- =====================================================================
-- BASELINE capturado no banco antes desta migration (referência)
-- =====================================================================
--
-- pg_get_viewdef('public.vw_comissoes_tecnico'):
--   WITH ret AS (
--     SELECT trl.os_id, trl.technician_id, sum(trl.amount) AS imposto
--       FROM tax_retention_ledger trl GROUP BY trl.os_id, trl.technician_id)
--   SELECT os.organization_id, os.tecnico_id, 'OS', 'PRINCIPAL', os.id, os.numero,
--          os.commission_services, os.commission_products, os.commission_total,
--          coalesce(r.imposto, 0) AS imposto_retido,
--          os.commission_total - coalesce(r.imposto,0) AS comissao_liquida,
--          os_status_grupo(os.status::text), os.commission_ref_date, os.status::text, os.nfe_emitida
--     FROM ordens_servico os LEFT JOIN ret r ON r.os_id = os.id AND r.technician_id = os.tecnico_id
--    WHERE os.tecnico_id IS NOT NULL
--   UNION ALL
--   SELECT v.organization_id, v.vendido_por, 'VENDA', 'VENDA', v.id, coalesce(v.numero,''),
--          0, tech_sale_commission(...), tech_sale_commission(...), 0, tech_sale_commission(...),
--          CASE WHEN coalesce(v.status_pagamento,'') IN ('cancelado','cancelada') THEN 'CANCELADA' ELSE 'CONCLUIDA' END,
--          (v.data_venda::timestamp AT TIME ZONE business_tz()), NULL, v.nf_numero IS NOT NULL
--     FROM vendas v WHERE v.vendido_por IS NOT NULL;
--
--   => A view NÃO recalculava a partir de itens_os: ela lia as colunas da OS.
--      Só o imposto vinha de tax_retention_ledger, que esta migration abandona.
--
-- os_commission_core(_os_id) (versão anterior):
--   base = commission_on_services ? SUM(itens_os.valor_total WHERE tipo='servico') * pct
--                                : valor_fixo * qtd_servicos   (ignorava desconto e valor_final)
--   commission_total = comissao_servicos + comissao_pecas
--   imposto = empresa_config.tax_percentage_nfe * commission_total
--   gravava em tax_retention_ledger ('PAID_TO_GOV' com nota, 'RETAINED' sem nota)
--
-- =====================================================================
-- REGRA NOVA (uma fórmula, um lugar: public.os_commission_calc / os_commission_core)
-- =====================================================================
--   total_itens    = SUM(itens_os.valor_total)
--   total_servicos = SUM(itens_os.valor_total WHERE tipo = 'servico')
--   valor_cobrado  = COALESCE(NULLIF(valor_final,0), total_itens - desconto)
--   base           = ROUND(total_servicos * valor_cobrado / total_itens, 2)
--   custo          = SUM(itens_os.custo_servico)
--   imposto        = nfe_emitida ? ROUND(base * nfe_config.nfse_aliquota/100, 2) : 0
--   saldo          = GREATEST(base - imposto - custo, 0)
--   loja           = ROUND(saldo/2, 2)      parte_bruta = saldo - loja
--   comissao       = nfe_emitida ? parte_bruta
--                                : ROUND(parte_bruta * (100 - commission_no_note_fee)/100, 2)
--   taxa_sem_nota  = parte_bruta - comissao
--
--   Arredondamento em centavos (meio para cima) nos dois lados, SQL e TS
--   (src/lib/commission.ts). Sem nota, arredondar a comissão direto — e não a taxa —
--   é o que reproduz os números combinados (900 + 150 de custo, sem nota => 361,88).
--
--   Congelamento: ao entrar em CONCLUIDA o rateio é gravado e travado
--   (commission_frozen_at). Reabrir a OS antes de existir fatura limpa o congelamento.
--   Depois de existir fatura (payout_invoice_id) nunca recalcula sozinho — só ajuste.
--   A retenção de 6 meses (tax_retention_ledger) deixa de ser escrita; fica histórico.
-- =====================================================================

-- 1. Custo por linha de serviço (peças/insumos repassados pelo técnico)
ALTER TABLE public.itens_os
  ADD COLUMN IF NOT EXISTS custo_servico numeric(12,2) NOT NULL DEFAULT 0 CHECK (custo_servico >= 0);

-- 2. Rateio congelado na OS (commission_total continua sendo a comissão do técnico)
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS commission_base        numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_tax         numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_cost        numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_no_note_fee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_company     numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_rate        numeric(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_tax_rate    numeric(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_frozen_at   timestamptz,
  ADD COLUMN IF NOT EXISTS commission_paid_at     timestamptz,
  ADD COLUMN IF NOT EXISTS payout_invoice_id      uuid;

-- 3. Taxa sem nota configurável (padrão 3,5%)
ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS commission_no_note_fee numeric(5,2) NOT NULL DEFAULT 3.5;

-- 4. PIX do técnico
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_key_type text;

-- 5. Faturas de saque do técnico
CREATE TABLE IF NOT EXISTS public.technician_payout_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  technician_id uuid NOT NULL REFERENCES public.profiles(id),
  numero text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',   -- rascunho|enviada|paga|recusada|cancelada
  period_start date,
  period_end date,
  total numeric(12,2) NOT NULL DEFAULT 0,
  pix_key text,
  pix_key_type text,
  notes text,
  sent_at timestamptz,
  paid_at timestamptz,
  paid_by uuid,
  rejected_reason text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, numero)
);

CREATE TABLE IF NOT EXISTS public.technician_payout_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.technician_payout_invoices(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'os',            -- os|ajuste
  os_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  adjustment_id uuid,
  description text NOT NULL,
  reference_date date,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  amount numeric(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.commission_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  technician_id uuid NOT NULL,
  os_id uuid,
  amount numeric(12,2) NOT NULL,
  reason text NOT NULL,
  description text,
  previous_amount numeric(12,2),
  new_amount numeric(12,2),
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  settled_at timestamptz,
  invoice_id uuid REFERENCES public.technician_payout_invoices(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ordens_servico_payout_invoice_uq
  ON public.ordens_servico (payout_invoice_id) WHERE payout_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS technician_payout_invoice_items_invoice_idx
  ON public.technician_payout_invoice_items (invoice_id);

CREATE INDEX IF NOT EXISTS commission_adjustments_tech_idx
  ON public.commission_adjustments (organization_id, technician_id);

COMMENT ON COLUMN public.empresa_config.tax_percentage_nfe IS
  'Histórico. Não é mais lido pelo cálculo de comissão: a alíquota vem de nfe_config.nfse_aliquota.';

-- 6. Grants + RLS
GRANT SELECT ON TABLE public.technician_payout_invoices TO authenticated;
GRANT SELECT ON TABLE public.technician_payout_invoice_items TO authenticated;
GRANT SELECT ON TABLE public.commission_adjustments TO authenticated;

-- Os privilégios padrão do banco concedem ALL a anon em tabelas novas; estas são dados
-- financeiros de tenant, então nenhum acesso anônimo.
REVOKE ALL ON TABLE public.technician_payout_invoices FROM anon;
REVOKE ALL ON TABLE public.technician_payout_invoice_items FROM anon;
REVOKE ALL ON TABLE public.commission_adjustments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.technician_payout_invoices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.technician_payout_invoice_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.commission_adjustments TO service_role;

ALTER TABLE public.technician_payout_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_payout_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payout_invoice_select" ON public.technician_payout_invoices
FOR SELECT TO authenticated USING (
  technician_id = auth.uid()
  OR (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::public.app_role))
  OR public.is_platform_admin(auth.uid())
);

CREATE POLICY "payout_invoice_item_select" ON public.technician_payout_invoice_items
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.technician_payout_invoices i
     WHERE i.id = invoice_id
       AND (i.technician_id = auth.uid()
            OR (i.organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::public.app_role))
            OR public.is_platform_admin(auth.uid()))
  )
);

CREATE POLICY "commission_adjustment_select" ON public.commission_adjustments
FOR SELECT TO authenticated USING (
  technician_id = auth.uid()
  OR (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::public.app_role))
  OR public.is_platform_admin(auth.uid())
);

-- =====================================================================
-- 7. Fórmula única
-- =====================================================================
CREATE OR REPLACE FUNCTION public.os_commission_calc(_os_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_os record;
  v_itens numeric := 0;
  v_servicos numeric := 0;
  v_custo numeric := 0;
  v_cobrado numeric := 0;
  v_base numeric := 0;
  v_aliquota numeric := 0;
  v_fee numeric := 3.5;
  v_imposto numeric := 0;
  v_saldo numeric := 0;
  v_loja numeric := 0;
  v_bruta numeric := 0;
  v_taxa numeric := 0;
  v_comissao numeric := 0;
begin
  select os.valor_final, coalesce(os.desconto, 0) as desconto,
         coalesce(os.nfe_emitida, false) as nfe, os.organization_id
    into v_os
    from public.ordens_servico os
   where os.id = _os_id;

  if not found then
    return jsonb_build_object(
      'valor_os', 0, 'total_itens', 0, 'total_servicos', 0, 'base', 0, 'imposto', 0,
      'custo', 0, 'saldo', 0, 'loja', 0, 'parte_bruta', 0, 'taxa_sem_nota', 0,
      'comissao', 0, 'aliquota', 0, 'taxa_percentual', 3.5, 'nfe_emitida', false, 'rate', 50);
  end if;

  select coalesce(sum(i.valor_total), 0),
         coalesce(sum(i.valor_total) filter (where i.tipo = 'servico'), 0),
         coalesce(sum(i.custo_servico), 0)
    into v_itens, v_servicos, v_custo
    from public.itens_os i
   where i.ordem_servico_id = _os_id;

  v_cobrado := coalesce(nullif(v_os.valor_final, 0), v_itens - v_os.desconto);
  if v_cobrado < 0 then v_cobrado := 0; end if;

  if v_itens > 0 then
    v_base := round(v_servicos * (v_cobrado / v_itens), 2);
  end if;
  if v_base < 0 then v_base := 0; end if;

  if v_os.nfe then
    select coalesce(c.nfse_aliquota, 0) into v_aliquota
      from public.nfe_config c
     where c.organization_id = v_os.organization_id
     limit 1;
    v_aliquota := coalesce(v_aliquota, 0);
  else
    select coalesce(e.commission_no_note_fee, 3.5) into v_fee
      from public.empresa_config e
     where e.organization_id = v_os.organization_id
     limit 1;
    v_fee := coalesce(v_fee, 3.5);
  end if;

  v_imposto := case when v_aliquota > 0 then round(v_base * v_aliquota / 100, 2) else 0 end;
  v_saldo := greatest(round(v_base - v_imposto - v_custo, 2), 0);
  v_loja := round(v_saldo / 2, 2);
  v_bruta := round(v_saldo - v_loja, 2);

  if v_os.nfe then
    v_comissao := v_bruta;
    v_taxa := 0;
  else
    v_comissao := round(v_bruta * (100 - v_fee) / 100, 2);
    v_taxa := round(v_bruta - v_comissao, 2);
  end if;

  return jsonb_build_object(
    'valor_os', round(v_cobrado, 2),
    'total_itens', round(v_itens, 2),
    'total_servicos', round(v_servicos, 2),
    'base', v_base,
    'imposto', v_imposto,
    'custo', round(v_custo, 2),
    'saldo', v_saldo,
    'loja', v_loja,
    'parte_bruta', v_bruta,
    'taxa_sem_nota', v_taxa,
    'comissao', v_comissao,
    'aliquota', round(v_aliquota, 2),
    'taxa_percentual', case when v_os.nfe then 0 else v_fee end,
    'nfe_emitida', v_os.nfe,
    'rate', 50);
end $function$;

DROP FUNCTION IF EXISTS public.os_commission_core(uuid);

CREATE OR REPLACE FUNCTION public.os_commission_core(_os_id uuid, _force boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_os record;
  v_grupo text;
  v_calc jsonb;
  v_comissao numeric := 0;
begin
  select os.id, os.status::text as status, os.tecnico_id, os.commission_frozen_at, os.payout_invoice_id
    into v_os
    from public.ordens_servico os
   where os.id = _os_id;

  if not found then return; end if;

  v_grupo := public.os_status_grupo(v_os.status);

  -- OS cancelada: comissão zerada e OS liberada de fatura.
  if v_grupo = 'CANCELADA' then
    update public.ordens_servico
       set commission_services = 0,
           commission_products = 0,
           commission_total = 0,
           commission_base = 0,
           commission_tax = 0,
           commission_cost = 0,
           commission_no_note_fee = 0,
           commission_company = 0,
           commission_rate = 0,
           commission_tax_rate = 0,
           commission_frozen_at = null,
           commission_computed_at = now(),
           payout_invoice_id = null
     where id = _os_id;
    return;
  end if;

  -- Congelado por fatura: nunca recalcula sozinho (só ajuste).
  if v_os.payout_invoice_id is not null then return; end if;

  -- Congelado por conclusão: só chamada administrativa (_force) recalcula.
  if v_grupo = 'CONCLUIDA' and v_os.commission_frozen_at is not null and not coalesce(_force, false) then
    return;
  end if;

  if v_os.tecnico_id is null then
    update public.ordens_servico
       set commission_services = 0, commission_products = 0, commission_total = 0,
           commission_base = 0, commission_tax = 0, commission_cost = 0,
           commission_no_note_fee = 0, commission_company = 0,
           commission_rate = 0, commission_tax_rate = 0,
           commission_frozen_at = null, commission_computed_at = now()
     where id = _os_id;
    return;
  end if;

  v_calc := public.os_commission_calc(_os_id);
  v_comissao := coalesce((v_calc ->> 'comissao')::numeric, 0);

  update public.ordens_servico
     set commission_services = v_comissao,
         commission_products = 0,
         commission_total = v_comissao,
         commission_base = coalesce((v_calc ->> 'base')::numeric, 0),
         commission_tax = coalesce((v_calc ->> 'imposto')::numeric, 0),
         commission_cost = coalesce((v_calc ->> 'custo')::numeric, 0),
         commission_no_note_fee = coalesce((v_calc ->> 'taxa_sem_nota')::numeric, 0),
         commission_company = coalesce((v_calc ->> 'loja')::numeric, 0),
         commission_rate = 50,
         commission_tax_rate = coalesce((v_calc ->> 'aliquota')::numeric, 0),
         commission_computed_at = now(),
         commission_frozen_at = case
           when v_grupo = 'CONCLUIDA' then coalesce(commission_frozen_at, now())
           else null end,
         commission_ref_date = case
           when v_grupo = 'CONCLUIDA' then coalesce(commission_ref_date, data_conclusao, data_entrega, now())
           else commission_ref_date end
   where id = _os_id;
end $function$;

-- Mantido para os triggers já existentes.
CREATE OR REPLACE FUNCTION public.recalc_os_commission_internal(_os_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  perform public.os_commission_core(_os_id, false);
end $function$;

-- Chamado pela tela ao salvar a OS / mudar status. Respeita o congelamento.
CREATE OR REPLACE FUNCTION public.calculate_os_commission(_os_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_org uuid;
  v_tec uuid;
  v_total numeric := 0;
begin
  select os.organization_id, os.tecnico_id into v_org, v_tec
    from public.ordens_servico os where os.id = _os_id;
  if v_org is null then return 0; end if;
  if public.get_user_org_id(auth.uid()) is distinct from v_org and not public.is_platform_admin(auth.uid()) then
    raise exception 'Acesso negado';
  end if;
  if not public.has_role(auth.uid(), 'admin'::public.app_role) and auth.uid() is distinct from v_tec then
    raise exception 'Acesso negado';
  end if;

  perform public.os_commission_core(_os_id, false);

  select coalesce(os.commission_total, 0) into v_total from public.ordens_servico os where os.id = _os_id;
  return v_total;
end $function$;

-- Custo do serviço: técnico edita até concluir; depois só admin (fica na trilha de auditoria).
CREATE OR REPLACE FUNCTION public.protect_itens_os_custo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_grupo text;
begin
  if new.custo_servico is not distinct from old.custo_servico then return new; end if;
  if auth.uid() is null or public.has_role(auth.uid(), 'admin'::public.app_role) then return new; end if;

  select public.os_status_grupo(os.status::text) into v_grupo
    from public.ordens_servico os where os.id = new.ordem_servico_id;

  if v_grupo = 'CONCLUIDA' then
    raise exception 'O custo do serviço não pode ser alterado depois de concluir a OS. Peça ao administrador.';
  end if;
  return new;
end $function$;

DROP TRIGGER IF EXISTS trg_protect_itens_os_custo ON public.itens_os;
CREATE TRIGGER trg_protect_itens_os_custo
  BEFORE UPDATE ON public.itens_os
  FOR EACH ROW EXECUTE FUNCTION public.protect_itens_os_custo();

-- =====================================================================
-- 8. View paralela: passa a ler as colunas da OS (imposto deixa de vir do ledger)
-- =====================================================================
CREATE OR REPLACE VIEW public.vw_comissoes_tecnico AS
 SELECT os.organization_id,
    os.tecnico_id AS technician_id,
    'OS'::text AS origem,
    'PRINCIPAL'::text AS papel,
    os.id AS documento_id,
    os.numero AS documento_numero,
    COALESCE(os.commission_services, 0::numeric) AS comissao_servicos,
    COALESCE(os.commission_products, 0::numeric) AS comissao_pecas,
    COALESCE(os.commission_total, 0::numeric) AS comissao_bruta,
    COALESCE(os.commission_tax, 0::numeric) AS imposto_retido,
    COALESCE(os.commission_total, 0::numeric) AS comissao_liquida,
    public.os_status_grupo(os.status::text) AS situacao,
    os.commission_ref_date AS data_referencia,
    os.status::text AS os_status,
    COALESCE(os.nfe_emitida, false) AS nfe_emitida
   FROM public.ordens_servico os
  WHERE os.tecnico_id IS NOT NULL
UNION ALL
 SELECT v.organization_id,
    v.vendido_por AS technician_id,
    'VENDA'::text AS origem,
    'VENDA'::text AS papel,
    v.id AS documento_id,
    COALESCE(v.numero, ''::text) AS documento_numero,
    0 AS comissao_servicos,
    public.tech_sale_commission(v.vendido_por, v.valor_total, ( SELECT count(*) AS count FROM public.venda_itens vi WHERE vi.venda_id = v.id)) AS comissao_pecas,
    public.tech_sale_commission(v.vendido_por, v.valor_total, ( SELECT count(*) AS count FROM public.venda_itens vi WHERE vi.venda_id = v.id)) AS comissao_bruta,
    0 AS imposto_retido,
    public.tech_sale_commission(v.vendido_por, v.valor_total, ( SELECT count(*) AS count FROM public.venda_itens vi WHERE vi.venda_id = v.id)) AS comissao_liquida,
        CASE
            WHEN COALESCE(v.status_pagamento, ''::text) = ANY (ARRAY['cancelado'::text, 'cancelada'::text]) THEN 'CANCELADA'::text
            ELSE 'CONCLUIDA'::text
        END AS situacao,
    (v.data_venda::timestamp without time zone AT TIME ZONE public.business_tz()) AS data_referencia,
    NULL::text AS os_status,
    v.nf_numero IS NOT NULL AS nfe_emitida
   FROM public.vendas v
  WHERE v.vendido_por IS NOT NULL;

-- =====================================================================
-- 9. Leitura: painel financeiro e extrato do técnico
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_technician_financial_dashboard(
  _tecnico_id uuid DEFAULT NULL::uuid,
  _period_start date DEFAULT (date_trunc('month'::text, (now() AT TIME ZONE public.business_tz())))::date,
  _period_end date DEFAULT ((date_trunc('month'::text, (now() AT TIME ZONE public.business_tz())) + '1 mon -1 days'::interval))::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_target uuid := coalesce(_tecnico_id, auth.uid());
  v_org uuid;
  v_pix text;
  v_pix_tipo text;
  v_from timestamptz;
  v_to timestamptz;
  v_a_receber numeric := 0; v_a_receber_ct int := 0;
  v_aguardando numeric := 0; v_aguardando_ct int := 0;
  v_recebido numeric := 0; v_recebido_ct int := 0;
  v_divergencia numeric := 0; v_divergencia_ct int := 0;
  v_periodo numeric := 0; v_periodo_ct int := 0;
  v_recebido_periodo numeric := 0; v_recebido_periodo_ct int := 0;
  v_pendente numeric := 0; v_pendente_ct int := 0;
  v_despesas numeric := 0; v_despesas_ct int := 0;
  v_serie jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Acesso negado'; end if;

  select p.organization_id, p.pix_key, p.pix_key_type
    into v_org, v_pix, v_pix_tipo
    from public.profiles p where p.id = v_target;

  if v_org is null
     or v_org is distinct from public.get_user_org_id(auth.uid())
     or (v_target is distinct from auth.uid() and not public.has_role(auth.uid(), 'admin'::public.app_role)) then
    raise exception 'Acesso negado';
  end if;

  v_from := (_period_start::timestamp at time zone public.business_tz());
  v_to := ((_period_end + 1)::timestamp at time zone public.business_tz());

  -- As quatro situações (histórico completo, é o retrato do que está em aberto)
  select
    coalesce(sum(os.commission_total) filter (where os.commission_paid_at is null and f.pago), 0),
    count(*) filter (where os.commission_paid_at is null and f.pago),
    coalesce(sum(os.commission_total) filter (where os.commission_paid_at is null and not f.pago), 0),
    count(*) filter (where os.commission_paid_at is null and not f.pago),
    coalesce(sum(os.commission_total) filter (where os.commission_paid_at is not null and f.pago), 0),
    count(*) filter (where os.commission_paid_at is not null and f.pago),
    coalesce(sum(os.commission_total) filter (where os.commission_paid_at is not null and not f.pago), 0),
    count(*) filter (where os.commission_paid_at is not null and not f.pago)
  into v_a_receber, v_a_receber_ct, v_aguardando, v_aguardando_ct,
       v_recebido, v_recebido_ct, v_divergencia, v_divergencia_ct
  from public.ordens_servico os
  cross join lateral (
    select exists (
      select 1 from public.financeiro fi
       where fi.ordem_servico_id = os.id and fi.tipo = 'receita'
    ) as pago
  ) f
  where os.organization_id = v_org
    and os.tecnico_id = v_target
    and public.os_status_grupo(os.status::text) = 'CONCLUIDA'
    and os.commission_total > 0;

  -- Comissão produzida no período
  select coalesce(sum(os.commission_total), 0), count(*)
    into v_periodo, v_periodo_ct
    from public.ordens_servico os
   where os.organization_id = v_org
     and os.tecnico_id = v_target
     and public.os_status_grupo(os.status::text) = 'CONCLUIDA'
     and coalesce(os.commission_ref_date, os.data_conclusao, os.updated_at) >= v_from
     and coalesce(os.commission_ref_date, os.data_conclusao, os.updated_at) < v_to;

  -- Recebido no período (data de pagamento)
  select coalesce(sum(os.commission_total), 0), count(*)
    into v_recebido_periodo, v_recebido_periodo_ct
    from public.ordens_servico os
   where os.organization_id = v_org
     and os.tecnico_id = v_target
     and os.commission_paid_at >= v_from
     and os.commission_paid_at < v_to;

  -- Pendente (OS ainda em andamento)
  select coalesce(sum(os.commission_total), 0), count(*)
    into v_pendente, v_pendente_ct
    from public.ordens_servico os
   where os.organization_id = v_org
     and os.tecnico_id = v_target
     and public.os_status_grupo(os.status::text) = 'ABERTA';

  select coalesce(sum(e.amount), 0), count(*)
    into v_despesas, v_despesas_ct
    from public.technician_expenses e
   where e.organization_id = v_org
     and e.technician_id = v_target
     and e.expense_date >= _period_start
     and e.expense_date <= _period_end;

  select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'total', d.total) order by d.dia), '[]'::jsonb)
    into v_serie
    from (
      select to_char(((coalesce(os.commission_ref_date, os.data_conclusao, os.updated_at)) at time zone public.business_tz())::date, 'YYYY-MM-DD') as dia,
             round(sum(os.commission_total), 2) as total
        from public.ordens_servico os
       where os.organization_id = v_org
         and os.tecnico_id = v_target
         and public.os_status_grupo(os.status::text) = 'CONCLUIDA'
         and coalesce(os.commission_ref_date, os.data_conclusao, os.updated_at) >= v_from
         and coalesce(os.commission_ref_date, os.data_conclusao, os.updated_at) < v_to
       group by 1
    ) d;

  return jsonb_build_object(
    'tecnico_id', v_target,
    'organization_id', v_org,
    'periodo_inicio', _period_start,
    'periodo_fim', _period_end,
    'pix_key', v_pix,
    'pix_key_type', v_pix_tipo,
    'a_receber', v_a_receber,
    'a_receber_count', v_a_receber_ct,
    'aguardando_cliente', v_aguardando,
    'aguardando_cliente_count', v_aguardando_ct,
    'recebido', v_recebido,
    'recebido_count', v_recebido_ct,
    'divergencia', v_divergencia,
    'divergencia_count', v_divergencia_ct,
    'comissao_periodo', v_periodo,
    'comissao_periodo_count', v_periodo_ct,
    'recebido_periodo', v_recebido_periodo,
    'recebido_periodo_count', v_recebido_periodo_ct,
    'comissao_pendente', v_pendente,
    'os_pendentes_count', v_pendente_ct,
    'despesas_periodo', v_despesas,
    'despesas_count', v_despesas_ct,
    'saldo_liquido', v_recebido_periodo - v_despesas,
    'serie_diaria', v_serie
  );
end $function$;

-- Alíquota do ISS para quem não é admin: `nfe_config` guarda os tokens da Focus NFe e é
-- restrita a admin, então o técnico lê só o número, pelo RPC.
CREATE OR REPLACE FUNCTION public.get_nfse_aliquota()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $function$
  select coalesce(
    (select c.nfse_aliquota
       from public.nfe_config c
      where c.organization_id = public.get_user_org_id(auth.uid())
      limit 1), 0);
$function$;

REVOKE EXECUTE ON FUNCTION public.get_nfse_aliquota() FROM public;
GRANT EXECUTE ON FUNCTION public.get_nfse_aliquota() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nfse_aliquota() TO service_role;

CREATE OR REPLACE FUNCTION public.get_technician_os_statement(_tecnico_id uuid, _period_start date, _period_end date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_target uuid := coalesce(_tecnico_id, auth.uid());
  v_org uuid;
  v_from timestamptz;
  v_to timestamptz;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Acesso negado'; end if;

  select p.organization_id into v_org from public.profiles p where p.id = v_target;

  if v_org is null
     or v_org is distinct from public.get_user_org_id(auth.uid())
     or (v_target is distinct from auth.uid() and not public.has_role(auth.uid(), 'admin'::public.app_role)) then
    raise exception 'Acesso negado';
  end if;

  v_from := (_period_start::timestamp at time zone public.business_tz());
  v_to := ((_period_end + 1)::timestamp at time zone public.business_tz());

  select jsonb_agg(r order by r ->> 'data_conclusao' desc) into v_result
  from (
    select jsonb_build_object(
      'os_id', os.id,
      'os_numero', os.numero,
      'data_conclusao', coalesce(os.commission_ref_date, os.data_conclusao, os.updated_at),
      'valor_os', round(coalesce(nullif(os.valor_final, 0),
        (select coalesce(sum(i.valor_total), 0) from public.itens_os i where i.ordem_servico_id = os.id)
        - coalesce(os.desconto, 0)), 2),
      'commission_base', os.commission_base,
      'imposto', os.commission_tax,
      'custo', os.commission_cost,
      'taxa_sem_nota', os.commission_no_note_fee,
      'loja', os.commission_company,
      'comissao', os.commission_total,
      'commission_rate', os.commission_rate,
      'commission_tax_rate', os.commission_tax_rate,
      'nfe_emitida', coalesce(os.nfe_emitida, false),
      'status_os', os.status::text,
      'congelado_em', os.commission_frozen_at,
      'pago_em', os.commission_paid_at,
      'fatura_id', os.payout_invoice_id,
      'fatura_numero', inv.numero,
      'fatura_status', inv.status,
      'cliente_pagou', f.pago,
      -- Sem congelamento = rateio ainda não gravado pela regra nova (OS antiga ou em aberto).
      -- A tela mostra "—" nas colunas de rateio em vez de zeros que não somam.
      'sem_rateio', (os.commission_frozen_at is null),
      'situacao', case
        when os.commission_paid_at is not null and f.pago then 'RECEBIDO'
        when os.commission_paid_at is not null then 'DIVERGENCIA'
        when f.pago then 'A_RECEBER'
        else 'AGUARDANDO_CLIENTE'
      end
    ) as r
    from public.ordens_servico os
    left join public.technician_payout_invoices inv on inv.id = os.payout_invoice_id
    cross join lateral (
      select exists (
        select 1 from public.financeiro fi
         where fi.ordem_servico_id = os.id and fi.tipo = 'receita'
      ) as pago
    ) f
    where os.organization_id = v_org
      and os.tecnico_id = v_target
      and public.os_status_grupo(os.status::text) = 'CONCLUIDA'
      and coalesce(os.commission_ref_date, os.data_conclusao, os.updated_at) >= v_from
      and coalesce(os.commission_ref_date, os.data_conclusao, os.updated_at) < v_to
  ) s;

  return coalesce(v_result, '[]'::jsonb);
end $function$;

-- =====================================================================
-- 10. Faturas de saque
-- =====================================================================
CREATE OR REPLACE FUNCTION public.create_technician_payout_invoice(
  _os_ids uuid[],
  _notes text DEFAULT NULL,
  _adjustment_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_pix text;
  v_pix_tipo text;
  v_nome text;
  v_total numeric := 0;
  v_numero text;
  v_invoice uuid;
  v_ini date;
  v_fim date;
  v_cnt int;
  v_ajustes int := 0;
begin
  if v_uid is null then raise exception 'Acesso negado'; end if;
  if _os_ids is null or array_length(_os_ids, 1) is null then
    raise exception 'Selecione ao menos uma OS para faturar.';
  end if;

  select p.organization_id, p.pix_key, p.pix_key_type, p.nome
    into v_org, v_pix, v_pix_tipo, v_nome
    from public.profiles p where p.id = v_uid;

  if v_org is null then raise exception 'Perfil sem empresa vinculada.'; end if;
  if v_pix is null or btrim(v_pix) = '' then
    raise exception 'Cadastre sua chave PIX antes de gerar a fatura de saque.';
  end if;

  select count(*) into v_cnt
    from public.ordens_servico os
   where os.id = any(_os_ids)
     and os.organization_id = v_org
     and os.tecnico_id = v_uid
     and public.os_status_grupo(os.status::text) = 'CONCLUIDA'
     and os.payout_invoice_id is null;

  if v_cnt <> array_length(_os_ids, 1) then
    raise exception 'Selecione apenas OS concluídas, suas e que ainda não estejam em outra fatura.';
  end if;

  perform pg_advisory_xact_lock(hashtext('payout_invoice:' || v_org::text));

  select 'FAT-' || lpad((coalesce(max(nullif(regexp_replace(numero, '\D', '', 'g'), '')), '0')::int + 1)::text, 4, '0')
    into v_numero
    from public.technician_payout_invoices
   where organization_id = v_org;

  select min(coalesce(os.commission_ref_date, os.data_conclusao, os.updated_at))::date,
         max(coalesce(os.commission_ref_date, os.data_conclusao, os.updated_at))::date
    into v_ini, v_fim
    from public.ordens_servico os
   where os.id = any(_os_ids);

  insert into public.technician_payout_invoices
    (organization_id, technician_id, numero, status, period_start, period_end, total,
     pix_key, pix_key_type, notes, created_by)
  values
    (v_org, v_uid, v_numero, 'rascunho', v_ini, v_fim, 0,
     v_pix, v_pix_tipo, _notes, v_uid)
  returning id into v_invoice;

  insert into public.technician_payout_invoice_items
    (invoice_id, kind, os_id, description, reference_date, snapshot, amount)
  select v_invoice, 'os', os.id,
         'OS ' || os.numero || ' — ' || coalesce(cl.nome, 'Cliente'),
         coalesce(os.commission_ref_date, os.data_conclusao, os.updated_at)::date,
         jsonb_build_object(
           'valor_os', coalesce(nullif(os.valor_final, 0),
             (select coalesce(sum(i.valor_total), 0) from public.itens_os i where i.ordem_servico_id = os.id)
             - coalesce(os.desconto, 0)),
           'base', os.commission_base,
           'imposto', os.commission_tax,
           'custo', os.commission_cost,
           'taxa_sem_nota', os.commission_no_note_fee,
           'loja', os.commission_company,
           'comissao', os.commission_total,
           'nfe_emitida', coalesce(os.nfe_emitida, false),
           'status_os', os.status::text),
         os.commission_total
    from public.ordens_servico os
    left join public.clientes cl on cl.id = os.cliente_id
   where os.id = any(_os_ids);

  update public.ordens_servico
     set payout_invoice_id = v_invoice
   where id = any(_os_ids);

  if _adjustment_ids is not null and array_length(_adjustment_ids, 1) is not null then
    insert into public.technician_payout_invoice_items
      (invoice_id, kind, adjustment_id, description, reference_date, snapshot, amount)
    select v_invoice, 'ajuste', a.id,
           coalesce(a.description, a.reason),
           a.created_at::date,
           jsonb_build_object('motivo', a.reason, 'os_id', a.os_id, 'anterior', a.previous_amount, 'novo', a.new_amount),
           a.amount
      from public.commission_adjustments a
     where a.id = any(_adjustment_ids)
       and a.organization_id = v_org
       and a.technician_id = v_uid
       and a.invoice_id is null;
    get diagnostics v_ajustes = row_count;

    update public.commission_adjustments
       set invoice_id = v_invoice, settled_at = now()
     where id = any(_adjustment_ids) and organization_id = v_org and technician_id = v_uid and invoice_id is null;
  end if;

  select coalesce(sum(i.amount), 0) into v_total
    from public.technician_payout_invoice_items i where i.invoice_id = v_invoice;

  update public.technician_payout_invoices set total = v_total, updated_at = now() where id = v_invoice;

  return jsonb_build_object('id', v_invoice, 'numero', v_numero, 'total', v_total, 'ajustes', v_ajustes);
end $function$;

CREATE OR REPLACE FUNCTION public.send_technician_payout_invoice(_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_inv record;
  v_nome text;
begin
  select * into v_inv from public.technician_payout_invoices where id = _invoice_id;
  if not found then raise exception 'Fatura não encontrada.'; end if;

  if not (v_inv.technician_id = auth.uid()
          or (v_inv.organization_id = public.get_user_org_id(auth.uid())
              and public.has_role(auth.uid(), 'admin'::public.app_role))) then
    raise exception 'Acesso negado';
  end if;

  if v_inv.status <> 'rascunho' then
    raise exception 'Só é possível enviar uma fatura em rascunho.';
  end if;

  update public.technician_payout_invoices
     set status = 'enviada', sent_at = now(), updated_at = now()
   where id = _invoice_id;

  select p.nome into v_nome from public.profiles p where p.id = v_inv.technician_id;

  perform public.notify_org_role(
    v_inv.organization_id, 'admin'::public.app_role, 'payout_invoice',
    'Fatura de saque ' || v_inv.numero,
    coalesce(v_nome, 'Técnico') || ' enviou a fatura de saque ' || v_inv.numero || '.',
    '/comissoes');

  return jsonb_build_object('id', _invoice_id, 'numero', v_inv.numero, 'status', 'enviada');
end $function$;

CREATE OR REPLACE FUNCTION public.settle_technician_payout_invoice(_invoice_id uuid, _paid boolean, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_inv record;
  v_nome text;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Acesso negado';
  end if;

  select * into v_inv from public.technician_payout_invoices where id = _invoice_id;
  if not found then raise exception 'Fatura não encontrada.'; end if;

  if v_inv.organization_id is distinct from public.get_user_org_id(auth.uid())
     and not public.is_platform_admin(auth.uid()) then
    raise exception 'Acesso negado';
  end if;

  if v_inv.status not in ('rascunho', 'enviada') then
    raise exception 'Esta fatura já foi encerrada.';
  end if;

  select p.nome into v_nome from public.profiles p where p.id = v_inv.technician_id;

  if coalesce(_paid, false) then
    update public.technician_payout_invoices
       set status = 'paga', paid_at = now(), paid_by = auth.uid(), updated_at = now()
     where id = _invoice_id;

    update public.ordens_servico
       set commission_paid_at = now()
     where payout_invoice_id = _invoice_id;

    insert into public.financeiro
      (organization_id, usuario_id, tipo, categoria, descricao, valor, data_transacao, observacoes)
    values
      (v_inv.organization_id, v_inv.technician_id, 'comissao'::public.tipo_transacao, 'Comissão',
       'Comissão fatura ' || v_inv.numero || ' — ' || coalesce(v_nome, 'Técnico'),
       v_inv.total, current_date,
       'Fatura de saque ' || v_inv.numero || ' paga');

    return jsonb_build_object('id', _invoice_id, 'status', 'paga');
  end if;

  update public.technician_payout_invoices
     set status = 'recusada', rejected_reason = _reason, updated_at = now()
   where id = _invoice_id;

  perform public.notify_org_role(
    v_inv.organization_id, 'admin'::public.app_role, 'payout_invoice',
    'Fatura de saque ' || v_inv.numero || ' recusada',
    coalesce(_reason, 'Sem motivo informado.'),
    '/technician/financeiro');

  return jsonb_build_object('id', _invoice_id, 'status', 'recusada');
end $function$;

CREATE OR REPLACE FUNCTION public.cancel_technician_payout_invoice(_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_inv record;
begin
  select * into v_inv from public.technician_payout_invoices where id = _invoice_id;
  if not found then raise exception 'Fatura não encontrada.'; end if;

  if not (v_inv.technician_id = auth.uid()
          or (v_inv.organization_id = public.get_user_org_id(auth.uid())
              and public.has_role(auth.uid(), 'admin'::public.app_role))) then
    raise exception 'Acesso negado';
  end if;

  if v_inv.status not in ('rascunho', 'enviada') then
    raise exception 'Só é possível cancelar fatura em rascunho ou enviada.';
  end if;

  update public.ordens_servico set payout_invoice_id = null where payout_invoice_id = _invoice_id;
  update public.commission_adjustments set invoice_id = null, settled_at = null where invoice_id = _invoice_id;
  update public.technician_payout_invoices
     set status = 'cancelada', updated_at = now()
   where id = _invoice_id;

  return jsonb_build_object('id', _invoice_id, 'status', 'cancelada');
end $function$;

-- =====================================================================
-- 11. Conferência da comissão (admin)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.relatorio_impacto_comissao(_period_start date, _period_end date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_org uuid;
  v_from timestamptz;
  v_to timestamptz;
  v_result jsonb;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Acesso negado';
  end if;
  v_org := public.get_user_org_id(auth.uid());
  if v_org is null then raise exception 'Acesso negado'; end if;

  v_from := (_period_start::timestamp at time zone public.business_tz());
  v_to := ((_period_end + 1)::timestamp at time zone public.business_tz());

  select jsonb_agg(r order by r ->> 'data' desc) into v_result
  from (
    select jsonb_build_object(
      'os_id', os.id,
      'numero', os.numero,
      'tecnico_id', os.tecnico_id,
      'tecnico', p.nome,
      'data', coalesce(os.commission_ref_date, os.data_conclusao, os.updated_at),
      'valor_os', (c.v ->> 'valor_os')::numeric,
      'comissao_antiga', os.commission_total,
      'comissao_nova', (c.v ->> 'comissao')::numeric,
      'diferenca', round((c.v ->> 'comissao')::numeric - os.commission_total, 2),
      'paga', os.commission_paid_at is not null,
      'fatura_numero', inv.numero,
      'fatura_status', inv.status
    ) as r
    from public.ordens_servico os
    join public.profiles p on p.id = os.tecnico_id
    left join public.technician_payout_invoices inv on inv.id = os.payout_invoice_id
    cross join lateral (select public.os_commission_calc(os.id) as v) c
    where os.organization_id = v_org
      and os.tecnico_id is not null
      and public.os_status_grupo(os.status::text) = 'CONCLUIDA'
      and coalesce(os.commission_ref_date, os.data_conclusao, os.updated_at) >= v_from
      and coalesce(os.commission_ref_date, os.data_conclusao, os.updated_at) < v_to
  ) s;

  return coalesce(v_result, '[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public.recalcular_comissoes_em_lote(_somente_nao_pagas boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_org uuid;
  v_os record;
  v_calc jsonb;
  v_nova numeric;
  v_atualizadas int := 0;
  v_ajustes int := 0;
  v_total_ajustes numeric := 0;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Acesso negado';
  end if;
  v_org := public.get_user_org_id(auth.uid());
  if v_org is null then raise exception 'Acesso negado'; end if;

  for v_os in
    select os.id, os.commission_total, os.commission_paid_at, os.payout_invoice_id, os.tecnico_id
      from public.ordens_servico os
     where os.organization_id = v_org
       and os.tecnico_id is not null
       and public.os_status_grupo(os.status::text) = 'CONCLUIDA'
       and os.payout_invoice_id is null
  loop
    if v_os.commission_paid_at is not null then
      if coalesce(_somente_nao_pagas, true) then continue; end if;

      v_calc := public.os_commission_calc(v_os.id);
      v_nova := coalesce((v_calc ->> 'comissao')::numeric, 0);

      if v_nova <> v_os.commission_total then
        insert into public.commission_adjustments
          (organization_id, technician_id, os_id, amount, reason, description,
           previous_amount, new_amount, created_by)
        values
          (v_org, v_os.tecnico_id, v_os.id, round(v_nova - v_os.commission_total, 2),
           'Recálculo da regra de comissão',
           'OS já paga: diferença lançada como ajuste no extrato do técnico.',
           v_os.commission_total, v_nova, auth.uid());

        v_ajustes := v_ajustes + 1;
        v_total_ajustes := v_total_ajustes + round(v_nova - v_os.commission_total, 2);
      end if;

      perform public.os_commission_core(v_os.id, true);
      v_atualizadas := v_atualizadas + 1;
    else
      perform public.os_commission_core(v_os.id, true);
      v_atualizadas := v_atualizadas + 1;
    end if;
  end loop;

  return jsonb_build_object('atualizadas', v_atualizadas, 'ajustes', v_ajustes, 'total_ajustes', v_total_ajustes);
end $function$;

-- =====================================================================
-- 12. Limpeza: sobrecarga antiga do dashboard do técnico
-- =====================================================================
DROP FUNCTION IF EXISTS public.get_technician_dashboard(uuid);

-- O total de comissão já vem líquido do imposto: não descontar de novo.
CREATE OR REPLACE FUNCTION public.get_technician_commission_summary(
  _tecnico_id uuid,
  _period_start date DEFAULT (date_trunc('month'::text, (now() AT TIME ZONE public.business_tz())))::date,
  _period_end date DEFAULT ((date_trunc('month'::text, (now() AT TIME ZONE public.business_tz())) + '1 mon -1 days'::interval))::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_target uuid := coalesce(_tecnico_id, auth.uid());
  v_org uuid;
  v_from timestamptz;
  v_to timestamptz;
  v_os numeric := 0;
  v_vendas numeric := 0;
  v_impostos numeric := 0;
  v_os_count int := 0;
  v_vendas_count int := 0;
  v_pendente numeric := 0;
  v_pendentes_count int := 0;
  v_despesas numeric := 0;
  v_despesas_count int := 0;
begin
  if auth.uid() is null then
    raise exception 'Acesso negado';
  end if;

  select p.organization_id into v_org from public.profiles p where p.id = v_target;

  if v_org is null
     or v_org is distinct from public.get_user_org_id(auth.uid())
     or (v_target is distinct from auth.uid() and not public.has_role(auth.uid(), 'admin'::public.app_role)) then
    raise exception 'Acesso negado';
  end if;

  v_from := (_period_start::timestamp at time zone public.business_tz());
  v_to := ((_period_end + 1)::timestamp at time zone public.business_tz());

  select
    coalesce(sum(c.comissao_bruta) filter (where c.situacao = 'CONCLUIDA' and c.origem = 'OS'), 0),
    coalesce(sum(c.comissao_bruta) filter (where c.situacao = 'CONCLUIDA' and c.origem = 'VENDA'), 0),
    coalesce(sum(c.imposto_retido) filter (where c.situacao = 'CONCLUIDA'), 0),
    count(*) filter (where c.situacao = 'CONCLUIDA' and c.origem = 'OS'),
    count(*) filter (where c.situacao = 'CONCLUIDA' and c.origem = 'VENDA'),
    coalesce(sum(c.comissao_bruta) filter (where c.situacao = 'ABERTA'), 0),
    count(*) filter (where c.situacao = 'ABERTA' and c.origem = 'OS')
  into v_os, v_vendas, v_impostos, v_os_count, v_vendas_count, v_pendente, v_pendentes_count
  from public.vw_comissoes_tecnico c
  where c.organization_id = v_org
    and c.technician_id = v_target
    and c.situacao <> 'CANCELADA'
    and (
      (c.situacao = 'CONCLUIDA' and c.data_referencia >= v_from and c.data_referencia < v_to)
      or c.situacao = 'ABERTA'
    );

  select coalesce(sum(e.amount), 0), count(*)
    into v_despesas, v_despesas_count
  from public.technician_expenses e
  where e.organization_id = v_org
    and e.technician_id = v_target
    and e.expense_date >= _period_start
    and e.expense_date <= _period_end;

  return jsonb_build_object(
    'tecnico_id', v_target,
    'organization_id', v_org,
    'periodo_inicio', _period_start,
    'periodo_fim', _period_end,
    'periodo_inicio_ts', v_from,
    'periodo_fim_exclusivo_ts', v_to,
    'comissao_os', v_os,
    'comissao_vendas', v_vendas,
    'comissao_bruta', v_os + v_vendas,
    'impostos_retidos', v_impostos,
    'comissao_liquida', v_os + v_vendas,
    'os_count', v_os_count,
    'vendas_count', v_vendas_count,
    'comissao_pendente', v_pendente,
    'os_pendentes_count', v_pendentes_count,
    'despesas', v_despesas,
    'despesas_count', v_despesas_count,
    'saldo_liquido', v_os + v_vendas - v_despesas
  );
end $function$;

-- Backfill: congela o rateio das OS concluídas que ainda não têm rateio.
DO $backfill$
declare
  v_os record;
begin
  for v_os in
    select os.id
      from public.ordens_servico os
     where os.tecnico_id is not null
       and public.os_status_grupo(os.status::text) = 'CONCLUIDA'
       and os.commission_frozen_at is null
       and os.payout_invoice_id is null
       and os.commission_computed_at is null
  loop
    perform public.os_commission_core(v_os.id, false);
  end loop;
end $backfill$;
