CREATE OR REPLACE FUNCTION public.recalc_os_commission_internal(_os_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tec uuid; v_prof record; ss numeric:=0; cs numeric:=0; sp numeric:=0; cp numeric:=0; c1 numeric:=0; c2 numeric:=0;
BEGIN
  SELECT tecnico_id INTO v_tec FROM public.ordens_servico WHERE id=_os_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_tec IS NOT NULL THEN
    SELECT COALESCE(SUM(valor_total) FILTER (WHERE tipo='servico'),0), COUNT(*) FILTER (WHERE tipo='servico'),
           COALESCE(SUM(valor_total) FILTER (WHERE tipo='produto'),0), COUNT(*) FILTER (WHERE tipo='produto')
      INTO ss, cs, sp, cp FROM public.itens_os WHERE ordem_servico_id=_os_id;
    SELECT * INTO v_prof FROM public.profiles WHERE id=v_tec;
    IF v_prof.commission_on_services THEN
      c1 := CASE WHEN v_prof.service_commission_type='percentage' THEN round(ss*COALESCE(v_prof.service_commission_value,0)/100,2) ELSE round(COALESCE(v_prof.service_commission_value,0)*cs,2) END;
    END IF;
    IF v_prof.commission_on_products THEN
      c2 := CASE WHEN v_prof.product_commission_type='percentage' THEN round(sp*COALESCE(v_prof.product_commission_value,0)/100,2) ELSE round(COALESCE(v_prof.product_commission_value,0)*cp,2) END;
    END IF;
  END IF;
  UPDATE public.ordens_servico SET commission_services=c1, commission_products=c2, commission_total=c1+c2, commission_computed_at=now() WHERE id=_os_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.recalc_os_commission_internal(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_itens_os_recalc_commission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.recalc_os_commission_internal(COALESCE(NEW.ordem_servico_id, OLD.ordem_servico_id));
  IF TG_OP='UPDATE' AND NEW.ordem_servico_id IS DISTINCT FROM OLD.ordem_servico_id THEN
    PERFORM public.recalc_os_commission_internal(OLD.ordem_servico_id);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS itens_os_recalc_commission ON public.itens_os;
CREATE TRIGGER itens_os_recalc_commission AFTER INSERT OR UPDATE OR DELETE ON public.itens_os
FOR EACH ROW EXECUTE FUNCTION public.trg_itens_os_recalc_commission();

CREATE OR REPLACE FUNCTION public.trg_os_recalc_commission_on_tech()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.tecnico_id IS DISTINCT FROM OLD.tecnico_id THEN PERFORM public.recalc_os_commission_internal(NEW.id); END IF;
  IF NEW.status::text IN ('pronto_retirada','entregue','finalizada','concluida') AND NEW.data_conclusao IS NULL THEN
    UPDATE public.ordens_servico SET data_conclusao = now() WHERE id = NEW.id AND data_conclusao IS NULL;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS os_recalc_commission_on_tech ON public.ordens_servico;
CREATE TRIGGER os_recalc_commission_on_tech AFTER UPDATE OF tecnico_id, status ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.trg_os_recalc_commission_on_tech();

CREATE OR REPLACE FUNCTION public.trg_notify_os_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_title text; v_body text; v_link text; v_nome text;
BEGIN
  v_link := '/ordens-servico?os=' || NEW.id::text;
  IF TG_OP = 'INSERT' THEN
    IF NEW.tecnico_id IS NOT NULL THEN
      PERFORM public.notify_user(NEW.tecnico_id, NEW.organization_id, 'os', 'Nova OS atribuída: ' || NEW.numero, 'Você foi designado para a OS ' || NEW.numero, v_link);
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_title := 'OS ' || NEW.numero || ': ' || NEW.status::text;
    v_body  := 'Status alterado de ' || OLD.status::text || ' para ' || NEW.status::text;
    IF NEW.tecnico_id IS NOT NULL THEN
      PERFORM public.notify_user(NEW.tecnico_id, NEW.organization_id, 'os', v_title, v_body, v_link);
    END IF;
    PERFORM public.notify_org_role(NEW.organization_id, 'admin'::app_role, 'os', v_title, v_body, v_link);
  END IF;
  IF OLD.recebida_em IS NULL AND NEW.recebida_em IS NOT NULL THEN
    SELECT nome INTO v_nome FROM public.profiles WHERE id = NEW.tecnico_id;
    PERFORM public.notify_org_role(NEW.organization_id, 'admin'::app_role, 'os',
      'OS ' || NEW.numero || ' aceita', COALESCE(v_nome,'Técnico') || ' aceitou a OS ' || NEW.numero, v_link);
  END IF;
  IF NEW.tecnico_id IS DISTINCT FROM OLD.tecnico_id AND NEW.tecnico_id IS NOT NULL THEN
    PERFORM public.notify_user(NEW.tecnico_id, NEW.organization_id, 'os', 'OS atribuída a você: ' || NEW.numero, 'Você foi designado para a OS ' || NEW.numero, v_link);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tech_sale_commission(_tec uuid, _valor numeric, _qtd_itens bigint)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN p.commission_on_products THEN
    CASE WHEN p.product_commission_type='percentage' THEN round(COALESCE(_valor,0)*COALESCE(p.product_commission_value,0)/100,2)
    ELSE round(COALESCE(p.product_commission_value,0)*COALESCE(_qtd_itens,0),2) END ELSE 0 END
  FROM public.profiles p WHERE p.id=_tec
$$;
REVOKE EXECUTE ON FUNCTION public.tech_sale_commission(uuid, numeric, bigint) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_technician_financial_dashboard(_tecnico_id uuid DEFAULT NULL::uuid, _period_start date DEFAULT date_trunc('month'::text, now()), _period_end date DEFAULT (date_trunc('month'::text, now()) + '1 mon -1 days'::interval))
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_target uuid := COALESCE(_tecnico_id, auth.uid()); v_org uuid; v_os numeric; v_cnt int; v_vendas numeric; v_vcnt int; v_result jsonb;
BEGIN
  SELECT organization_id INTO v_org FROM public.profiles WHERE id = v_target;
  IF auth.uid() IS NULL OR v_org IS NULL OR v_org IS DISTINCT FROM public.get_user_org_id(auth.uid()) OR (v_target IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT COALESCE(SUM(commission_total),0), COUNT(*) INTO v_os, v_cnt FROM public.ordens_servico
  WHERE organization_id=v_org AND tecnico_id=v_target AND status::text IN ('pronto_retirada','entregue','finalizada','concluida')
    AND COALESCE(data_conclusao, updated_at) >= _period_start AND COALESCE(data_conclusao, updated_at) < _period_end + 1;
  SELECT COALESCE(SUM(public.tech_sale_commission(v_target, v.valor_total, (SELECT COUNT(*) FROM public.venda_itens vi WHERE vi.venda_id=v.id))),0), COUNT(*)
    INTO v_vendas, v_vcnt FROM public.vendas v
  WHERE v.organization_id=v_org AND v.vendido_por=v_target AND COALESCE(v.status_pagamento,'') NOT IN ('cancelado','cancelada')
    AND v.data_venda >= _period_start AND v.data_venda <= _period_end;
  v_result := jsonb_build_object('comissoes_realizadas_periodo', v_os + v_vendas, 'valor_bruto_periodo', v_os + v_vendas,
    'comissoes_os', v_os, 'comissoes_vendas', v_vendas, 'os_count', v_cnt, 'vendas_count', v_vcnt, 'impostos_retidos_periodo', 0);
  SELECT v_result || jsonb_build_object('despesas_periodo', COALESCE(SUM(amount),0), 'despesas_count', COUNT(*)) INTO v_result
  FROM public.technician_expenses WHERE organization_id=v_org AND technician_id=v_target AND expense_date >= _period_start AND expense_date <= _period_end;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.get_technician_os_statement(_tecnico_id uuid, _period_start date, _period_end date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_target uuid := COALESCE(_tecnico_id, auth.uid()); v_org uuid; v_result jsonb;
BEGIN
  SELECT organization_id INTO v_org FROM public.profiles WHERE id=v_target;
  IF auth.uid() IS NULL OR v_org IS NULL OR v_org IS DISTINCT FROM public.get_user_org_id(auth.uid()) OR (v_target IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT jsonb_agg(r ORDER BY r->>'data_conclusao' DESC) INTO v_result FROM (
    SELECT jsonb_build_object('os_numero', numero, 'os_id', id, 'role', 'PRINCIPAL', 'data_conclusao', COALESCE(data_conclusao, updated_at),
      'valor_bruto', COALESCE(commission_total,0), 'comissao_servicos', COALESCE(commission_services,0), 'comissao_pecas', COALESCE(commission_products,0),
      'imposto_descontado', 0, 'comissao_liquida', COALESCE(commission_total,0), 'nfe_emitida', nfe_emitida) r
    FROM public.ordens_servico WHERE organization_id=v_org AND tecnico_id=v_target AND status::text IN ('pronto_retirada','entregue','finalizada','concluida')
      AND COALESCE(data_conclusao, updated_at) >= _period_start AND COALESCE(data_conclusao, updated_at) < _period_end + 1
    UNION ALL
    SELECT jsonb_build_object('os_numero', 'Venda ' || COALESCE(v.numero,''), 'os_id', v.id, 'role', 'VENDA', 'data_conclusao', v.data_venda,
      'valor_bruto', c, 'comissao_servicos', 0, 'comissao_pecas', c, 'imposto_descontado', 0, 'comissao_liquida', c, 'nfe_emitida', v.nf_numero IS NOT NULL)
    FROM public.vendas v, LATERAL (SELECT public.tech_sale_commission(v_target, v.valor_total, (SELECT COUNT(*) FROM public.venda_itens vi WHERE vi.venda_id=v.id)) c) x
    WHERE v.organization_id=v_org AND v.vendido_por=v_target AND COALESCE(v.status_pagamento,'') NOT IN ('cancelado','cancelada')
      AND v.data_venda >= _period_start AND v.data_venda <= _period_end
  ) s;
  RETURN COALESCE(v_result,'[]'::jsonb);
END $$;