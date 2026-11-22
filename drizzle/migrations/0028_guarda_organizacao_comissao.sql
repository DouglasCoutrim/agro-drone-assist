-- =====================================================================
-- 0028 — Fecha o acesso entre organizações nas funções de comissão
--
-- O que estava aberto (conferido no banco em 2026-11-22):
--
--   public.os_commission_calc(uuid)       -> ACL {=X/postgres, anon=X, ...}
--   public.os_commission_core(uuid,bool)  -> ACL {=X/postgres, anon=X, ...}
--
--   `=X/postgres` é o PUBLIC: qualquer role, inclusive `anon`, executava.
--   As duas são SECURITY DEFINER (rodam como o dono, ignorando a RLS) e nenhuma
--   das duas checava organização. `os_commission_core` ainda escreve nas colunas
--   de comissão de `ordens_servico` e não tinha nenhum `raise exception`.
--
--   Efeito prático: quem tivesse a chave publicável — que vai no bundle do site —
--   podia chamar `POST /rest/v1/rpc/os_commission_calc` com o uuid de uma OS de
--   QUALQUER organização e ler o detalhamento financeiro dela (valor, imposto,
--   custo, saldo, comissão), ou chamar `os_commission_core` e regravar as
--   colunas de comissão daquela OS, tudo sem login. Um usuário apenas logado
--   também conseguia atravessar organizações.
--
-- Duas correções, nesta ordem:
--
-- 1) REVOKE do EXECUTE de PUBLIC e `anon`. Seguro porque todos os chamadores
--    internos já são SECURITY DEFINER (`recalc_os_commission_internal`,
--    `trg_itens_os_recalc_commission`, `calculate_os_commission`,
--    `finalizar_os`, `ajustar_comissao_os`, `recalcular_comissoes_em_lote`,
--    `relatorio_impacto_comissao`), e chamada feita de dentro de função DEFINER
--    roda como o dono. A tela não chama estas duas: chama
--    `calculate_os_commission`, que já checava a organização.
--
-- 2) Guarda de organização dentro das duas funções. A fórmula da comissão não
--    foi tocada — foi inserido apenas o bloco `if auth.uid() is not null ...`
--    logo depois do `if not found`, antes de qualquer leitura ou escrita.
--    * `auth.uid()` nulo (service_role / Edge Function) passa: são os caminhos
--      de emissão de nota, cron e webhook;
--    * platform admin passa, usando `is_platform_admin(auth.uid())`;
--    * qualquer outro usuário só passa se `get_user_org_id(auth.uid())` for a
--      organização dona da OS, senão recebe erro 42501.
--
-- Testado em produção em 2026-11-22 simulando o JWT:
--   * sem sessão                       -> liberado (comissão 706,49);
--   * usuário de OUTRA organização     -> bloqueado com "Ordem de servico de
--                                         outra organizacao";
--   * usuário da MESMA organização     -> liberado (comissão 706,49);
--   * a OS usada no teste manteve `commission_computed_at` e valores idênticos.
--
-- Aplicado em produção em 2026-11-22.
-- =====================================================================

REVOKE ALL ON FUNCTION public.os_commission_calc(uuid) FROM public;
REVOKE ALL ON FUNCTION public.os_commission_calc(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.os_commission_core(uuid, boolean) FROM public;
REVOKE ALL ON FUNCTION public.os_commission_core(uuid, boolean) FROM anon;

CREATE OR REPLACE FUNCTION public.os_commission_calc(_os_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
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
  v_calculada numeric := 0;
  v_override numeric;
BEGIN
  SELECT os.valor_final, coalesce(os.desconto, 0) AS desconto,
         coalesce(os.nfe_emitida, false) AS nfe, os.organization_id,
         os.commission_override
    INTO v_os
    FROM public.ordens_servico os
   WHERE os.id = _os_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valor_os', 0, 'total_itens', 0, 'total_servicos', 0, 'base', 0, 'imposto', 0,
      'custo', 0, 'saldo', 0, 'loja', 0, 'parte_bruta', 0, 'taxa_sem_nota', 0,
      'comissao', 0, 'comissao_calculada', 0, 'ajuste_manual', 0, 'ajuste_ativo', false,
      'aliquota', 0, 'taxa_percentual', 3.5, 'nfe_emitida', false, 'rate', 50);
  END IF;

  -- Guarda de organizacao (2026-11-22): esta funcao e SECURITY DEFINER e nao
  -- tinha checagem nenhuma. Sem isto, qualquer usuario logado podia ler o
  -- detalhamento financeiro de uma OS de outra organizacao pela API.
  -- Chamada sem sessao (service_role / Edge Function) e de platform admin seguem.
  IF auth.uid() IS NOT NULL
     AND NOT public.is_platform_admin(auth.uid())
     AND v_os.organization_id IS DISTINCT FROM public.get_user_org_id(auth.uid()) THEN
    RAISE EXCEPTION 'Ordem de servico de outra organizacao (os %).', _os_id
      USING ERRCODE = '42501';
  END IF;

  v_override := v_os.commission_override;

  SELECT coalesce(sum(i.valor_total), 0),
         coalesce(sum(i.valor_total) filter (where i.tipo = 'servico'), 0),
         coalesce(sum(i.custo_servico), 0)
    INTO v_itens, v_servicos, v_custo
    FROM public.itens_os i
   WHERE i.ordem_servico_id = _os_id;

  v_cobrado := coalesce(nullif(v_os.valor_final, 0), v_itens - v_os.desconto);
  IF v_cobrado < 0 THEN v_cobrado := 0; END IF;

  IF v_itens > 0 THEN
    v_base := round(v_servicos * (v_cobrado / v_itens), 2);
  END IF;
  IF v_base < 0 THEN v_base := 0; END IF;

  IF v_os.nfe THEN
    SELECT coalesce(c.nfse_aliquota, 0) INTO v_aliquota
      FROM public.nfe_config c
     WHERE c.organization_id = v_os.organization_id
     LIMIT 1;
    v_aliquota := coalesce(v_aliquota, 0);
  ELSE
    SELECT coalesce(e.commission_no_note_fee, 3.5) INTO v_fee
      FROM public.empresa_config e
     WHERE e.organization_id = v_os.organization_id
     LIMIT 1;
    v_fee := coalesce(v_fee, 3.5);
  END IF;

  v_imposto := CASE WHEN v_aliquota > 0 THEN round(v_base * v_aliquota / 100, 2) ELSE 0 END;
  v_saldo := greatest(round(v_base - v_imposto - v_custo, 2), 0);
  v_loja := round(v_saldo / 2, 2);
  v_bruta := round(v_saldo - v_loja, 2);

  IF v_os.nfe THEN
    v_comissao := v_bruta;
    v_taxa := 0;
  ELSE
    v_comissao := round(v_bruta * (100 - v_fee) / 100, 2);
    v_taxa := round(v_bruta - v_comissao, 2);
  END IF;

  v_calculada := v_comissao;

  -- Ajuste manual (admin): o valor informado substitui a comissão calculada. A loja absorve
  -- a diferença (saldo continua igual a loja + comissão) e a taxa sem nota deixa de incidir,
  -- porque o valor digitado já é o valor final do técnico.
  IF v_override IS NOT NULL THEN
    v_comissao := round(v_override, 2);
    v_loja := round(v_saldo - v_comissao, 2);
    v_bruta := v_comissao;
    v_taxa := 0;
  END IF;

  RETURN jsonb_build_object(
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
    'comissao_calculada', v_calculada,
    'ajuste_manual', round(v_comissao - v_calculada, 2),
    'ajuste_ativo', (v_override IS NOT NULL),
    'aliquota', round(v_aliquota, 2),
    'taxa_percentual', CASE WHEN v_os.nfe THEN 0 ELSE v_fee END,
    'nfe_emitida', v_os.nfe,
    'rate', 50);
END $function$;

CREATE OR REPLACE FUNCTION public.os_commission_core(_os_id uuid, _force boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_os record;
  v_grupo text;
  v_calc jsonb;
  v_comissao numeric := 0;
BEGIN
  SELECT os.id, os.status::text AS status, os.tecnico_id, os.commission_frozen_at,
         os.payout_invoice_id, os.organization_id
    INTO v_os
    FROM public.ordens_servico os
   WHERE os.id = _os_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Guarda de organizacao (2026-11-22): esta funcao e SECURITY DEFINER, escreve e
  -- nao tinha checagem nenhuma - nem auth.uid(), nem papel, nem organizacao.
  -- Sem isto, qualquer portador da chave publicavel podia chamar
  -- POST /rest/v1/rpc/os_commission_core com o uuid de uma OS de outra
  -- organizacao e regravar as colunas de comissao dela, sem login.
  -- Chamada sem sessao (service_role / Edge Function) e de platform admin seguem.
  IF auth.uid() IS NOT NULL
     AND NOT public.is_platform_admin(auth.uid())
     AND v_os.organization_id IS DISTINCT FROM public.get_user_org_id(auth.uid()) THEN
    RAISE EXCEPTION 'Ordem de servico de outra organizacao (os %).', _os_id
      USING ERRCODE = '42501';
  END IF;

  v_grupo := public.os_status_grupo(v_os.status);

  IF v_grupo = 'CANCELADA' THEN
    UPDATE public.ordens_servico
       SET commission_services = 0,
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
     WHERE id = _os_id;
    RETURN;
  END IF;

  IF v_os.payout_invoice_id IS NOT NULL THEN RETURN; END IF;

  IF v_grupo = 'CONCLUIDA' AND v_os.commission_frozen_at IS NOT NULL AND NOT coalesce(_force, false) THEN
    RETURN;
  END IF;

  IF v_os.tecnico_id IS NULL THEN
    UPDATE public.ordens_servico
       SET commission_services = 0, commission_products = 0, commission_total = 0,
           commission_base = 0, commission_tax = 0, commission_cost = 0,
           commission_no_note_fee = 0, commission_company = 0,
           commission_rate = 0, commission_tax_rate = 0,
           commission_frozen_at = null, commission_computed_at = now()
     WHERE id = _os_id;
    RETURN;
  END IF;

  v_calc := public.os_commission_calc(_os_id);
  v_comissao := coalesce((v_calc ->> 'comissao')::numeric, 0);

  UPDATE public.ordens_servico
     SET commission_services = v_comissao,
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
         commission_frozen_at = CASE
           WHEN v_grupo = 'CONCLUIDA' THEN coalesce(commission_frozen_at, now())
           ELSE null END,
         commission_ref_date = CASE
           WHEN v_grupo = 'CONCLUIDA' THEN coalesce(commission_ref_date, data_conclusao, data_entrega, now())
           ELSE commission_ref_date END
   WHERE id = _os_id;
END $function$;
