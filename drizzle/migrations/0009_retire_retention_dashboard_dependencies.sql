CREATE OR REPLACE FUNCTION public.get_technician_financial_dashboard(_tecnico_id uuid DEFAULT NULL::uuid, _period_start date DEFAULT date_trunc('month', now()), _period_end date DEFAULT (date_trunc('month', now()) + interval '1 month - 1 day'))
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_target uuid := COALESCE(_tecnico_id, auth.uid()); v_org uuid; v_result jsonb;
BEGIN
  SELECT organization_id INTO v_org FROM public.profiles WHERE id = v_target;
  IF auth.uid() IS NULL OR v_org IS NULL OR v_org IS DISTINCT FROM public.get_user_org_id(auth.uid()) OR (v_target IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT jsonb_build_object('comissoes_realizadas_periodo', COALESCE(SUM(commission_total),0), 'valor_bruto_periodo', COALESCE(SUM(commission_total),0), 'os_count', COUNT(*)) INTO v_result
  FROM public.ordens_servico WHERE organization_id=v_org AND tecnico_id=v_target AND status::text IN ('entregue','finalizada','concluida') AND data_conclusao >= _period_start AND data_conclusao < _period_end + 1;
  SELECT v_result || jsonb_build_object('despesas_periodo', COALESCE(SUM(amount),0), 'despesas_count', COUNT(*)) INTO v_result
  FROM public.technician_expenses WHERE organization_id=v_org AND technician_id=v_target AND expense_date >= _period_start AND expense_date <= _period_end;
  RETURN v_result;
END;
$$;
CREATE OR REPLACE FUNCTION public.get_technician_os_statement(_tecnico_id uuid, _period_start date, _period_end date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_target uuid := COALESCE(_tecnico_id, auth.uid()); v_org uuid; v_result jsonb;
BEGIN
  SELECT organization_id INTO v_org FROM public.profiles WHERE id=v_target;
  IF auth.uid() IS NULL OR v_org IS NULL OR v_org IS DISTINCT FROM public.get_user_org_id(auth.uid()) OR (v_target IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT jsonb_agg(jsonb_build_object('os_numero', numero, 'os_id', id, 'role', 'PRINCIPAL', 'data_conclusao', data_conclusao, 'valor_bruto', COALESCE(commission_total,0), 'imposto_descontado', 0, 'comissao_liquida', COALESCE(commission_total,0), 'nfe_emitida', nfe_emitida) ORDER BY data_conclusao DESC) INTO v_result
  FROM public.ordens_servico WHERE organization_id=v_org AND tecnico_id=v_target AND status::text IN ('entregue','finalizada','concluida') AND data_conclusao >= _period_start AND data_conclusao < _period_end + 1;
  RETURN COALESCE(v_result,'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.get_technician_financial_dashboard(uuid,date,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_technician_os_statement(uuid,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_technician_financial_dashboard(uuid,date,date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_technician_os_statement(uuid,date,date) TO authenticated, service_role;
COMMENT ON TABLE public.tax_retention_ledger IS 'DEPRECATED: retired retention module; retained for historical accounting records. No new UI reads.';
COMMENT ON TABLE public.os_technicians IS 'DEPRECATED: retired assistant assignment editor; historical commission records retained. Principal assignment uses ordens_servico.tecnico_id.';
COMMENT ON TABLE public.os_tecnicos_ajudantes IS 'DEPRECATED: retired OS assistant editor; historical assignments retained and not replaced by OS edits.';