-- =============================================================================
-- MODULO DO TECNICO - COMISSAO NA OS + RPCS DE DASHBOARD (B)
--   * colunas de comissao calculada em ordens_servico
--   * RPC calculate_os_commission: calcula a comissao servidor-side usando o
--     perfil de comissao do tecnico vinculado + itens da OS (servico x produto)
--   * RPC get_technician_dashboard: dados do dashboard do tecnico (somente o
--     proprio tecnico ou admin da mesma org; NUNCA outro tecnico)
--   * RPC get_workshop_board: painel TV da oficina (org do chamador)
-- SECURITY DEFINER + validacao de org para nao vazar comissao entre tenentes.
-- Idempotente.
-- =============================================================================

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS commission_services numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_products numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_total numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_computed_at timestamptz;

-- ---------------------------------------------------------------------------
-- 1. Calculo automatico de comissao
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_os_commission(_os_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_tecnico uuid;
  v_status text;
  v_prof record;
  v_sum_servicos numeric := 0;
  v_count_servicos numeric := 0;
  v_sum_produtos numeric := 0;
  v_count_produtos numeric := 0;
  v_comm_serv numeric := 0;
  v_comm_prod numeric := 0;
  v_total numeric := 0;
BEGIN
  SELECT organization_id, tecnico_id, status::text
    INTO v_org, v_tecnico, v_status
  FROM public.ordens_servico WHERE id = _os_id;

  IF v_org IS NULL THEN
    RETURN 0;
  END IF;

  -- RBAC: chamador deve ser da mesma org; e admin OU o proprio tecnico da OS.
  IF public.get_user_org_id(auth.uid()) IS DISTINCT FROM v_org
     AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado a comissao desta OS';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND auth.uid() IS DISTINCT FROM v_tecnico THEN
    RAISE EXCEPTION 'Acesso negado a comissao desta OS';
  END IF;

  IF v_tecnico IS NULL THEN
    UPDATE public.ordens_servico
       SET commission_services = 0, commission_products = 0,
           commission_total = 0, commission_computed_at = NULL
     WHERE id = _os_id;
    RETURN 0;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN tipo = 'servico' THEN valor_total ELSE 0 END), 0),
    COALESCE(COUNT(CASE WHEN tipo = 'servico' THEN 1 END), 0),
    COALESCE(SUM(CASE WHEN tipo = 'produto' THEN valor_total ELSE 0 END), 0),
    COALESCE(COUNT(CASE WHEN tipo = 'produto' THEN 1 END), 0)
    INTO v_sum_servicos, v_count_servicos, v_sum_produtos, v_count_produtos
  FROM public.itens_os WHERE ordem_servico_id = _os_id;

  SELECT commission_on_services, service_commission_type, service_commission_value,
         commission_on_products, product_commission_type, product_commission_value
    INTO v_prof
  FROM public.profiles WHERE id = v_tecnico;

  IF v_prof IS NOT NULL AND v_prof.commission_on_services THEN
    IF v_prof.service_commission_type = 'percentage' THEN
      v_comm_serv := round(v_sum_servicos * v_prof.service_commission_value / 100, 2);
    ELSE
      v_comm_serv := round(v_prof.service_commission_value * v_count_servicos, 2);
    END IF;
  END IF;

  IF v_prof IS NOT NULL AND v_prof.commission_on_products THEN
    IF v_prof.product_commission_type = 'percentage' THEN
      v_comm_prod := round(v_sum_produtos * v_prof.product_commission_value / 100, 2);
    ELSE
      v_comm_prod := round(v_prof.product_commission_value * v_count_produtos, 2);
    END IF;
  END IF;

  v_total := round(v_comm_serv + v_comm_prod, 2);

  UPDATE public.ordens_servico
     SET commission_services = v_comm_serv,
         commission_products = v_comm_prod,
         commission_total = v_total,
         commission_computed_at = now()
   WHERE id = _os_id;

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_os_commission(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Dashboard do tecnico (apenas o proprio tecnico ou admin da mesma org)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_technician_dashboard(_tecnico_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tecnico uuid := COALESCE(_tecnico_id, auth.uid());
  v_org uuid;
  v_caller_org uuid;
  v_mes_inicio timestamptz;
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND auth.uid() IS DISTINCT FROM v_tecnico THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT organization_id INTO v_org FROM public.profiles WHERE id = v_tecnico;
  v_caller_org := public.get_user_org_id(auth.uid());

  IF v_org IS DISTINCT FROM v_caller_org
     AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_mes_inicio := date_trunc('month', now());

  SELECT jsonb_build_object(
    'realized_month', COALESCE((
      SELECT SUM(commission_total) FROM public.ordens_servico
      WHERE tecnico_id = v_tecnico AND organization_id = v_caller_org
        AND status::text IN ('concluida','pronto_retirada','entregue')
        AND COALESCE(data_conclusao, updated_at) >= v_mes_inicio
    ), 0),
    'estimated_month', COALESCE((
      SELECT SUM(commission_total) FROM public.ordens_servico
      WHERE tecnico_id = v_tecnico AND organization_id = v_caller_org
        AND status::text NOT IN ('concluida','pronto_retirada','entregue','cancelada')
    ), 0),
    'services_done_month', (
      SELECT COUNT(*) FROM public.ordens_servico
      WHERE tecnico_id = v_tecnico AND organization_id = v_caller_org
        AND status::text IN ('concluida','pronto_retirada','entregue')
        AND COALESCE(data_conclusao, updated_at) >= v_mes_inicio
    ),
    'kanban', (
      SELECT COALESCE(jsonb_object_agg(k.col, k.os_list), '{}'::jsonb) FROM (
        SELECT k.col, COALESCE(jsonb_agg(k.os_row ORDER BY k.os_row->>'data_entrada' DESC), '[]'::jsonb) AS os_list
        FROM (
          SELECT
            CASE
              WHEN os.status::text IN ('recebido','aberta','aguardando_diagnostico') THEN 'aguardando_avaliacao'
              WHEN os.status::text IN ('aguardando_aprovacao','aprovado') THEN 'em_analise'
              WHEN os.status::text = 'aguardando_peca' THEN 'aguardando_peca'
              WHEN os.status::text IN ('em_reparo','em_andamento','em_testes') THEN 'em_execucao'
              WHEN os.status::text IN ('concluida','pronto_retirada','entregue') THEN 'concluido'
              ELSE 'aguardando_avaliacao'
            END AS col,
            jsonb_build_object(
              'id', os.id, 'numero', os.numero, 'cliente', c.nome,
              'equipamento', os.modelo_equipamento,
              'tipo_equipamento', os.tipo_equipamento::text,
              'prioridade', os.prioridade, 'status', os.status::text,
              'data_entrada', os.data_entrada,
              'data_previsao', os.data_previsao,
              'tempo_em_bancada_min', GREATEST(0, round(extract(epoch FROM (now() - os.data_entrada))/60)::int),
              'commission_total', os.commission_total,
              'valor_final', os.valor_final
            ) AS os_row
          FROM public.ordens_servico os
          LEFT JOIN public.clientes c ON c.id = os.cliente_id
          WHERE os.tecnico_id = v_tecnico AND os.organization_id = v_caller_org
            AND os.status::text <> 'cancelada'
        ) k
        GROUP BY k.col
      ) k
    ),
    'next_os', (
      SELECT jsonb_build_object(
        'id', os.id, 'numero', os.numero, 'cliente', c.nome,
        'equipamento', os.modelo_equipamento, 'prioridade', os.prioridade,
        'status', os.status::text, 'data_previsao', os.data_previsao
      )
      FROM public.ordens_servico os
      LEFT JOIN public.clientes c ON c.id = os.cliente_id
      WHERE os.tecnico_id = v_tecnico AND os.organization_id = v_caller_org
        AND os.status::text NOT IN ('concluida','pronto_retirada','entregue','cancelada')
      ORDER BY
        CASE os.prioridade WHEN 'alta' THEN 0 WHEN 'urgente' THEN 0 WHEN 'media' THEN 1 ELSE 2 END,
        os.data_previsao ASC NULLS LAST,
        os.data_entrada ASC
      LIMIT 1
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_technician_dashboard(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Painel TV / Modo oficina (org do chamador)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_workshop_board()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_result jsonb;
BEGIN
  v_org := public.get_user_org_id(auth.uid());
  IF v_org IS NULL AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_org IS NULL THEN
    -- platform admin sem org: sem dados de oficina
    RETURN '{"entradas_hoje":0,"finalizadas_hoje":0,"em_bancada":0,"aguardando_aprovacao":0,"feed":[]}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'entradas_hoje', (
      SELECT COUNT(*) FROM public.ordens_servico
      WHERE organization_id = v_org AND created_at::date = current_date
    ),
    'finalizadas_hoje', (
      SELECT COUNT(*) FROM public.ordens_servico
      WHERE organization_id = v_org
        AND status::text IN ('concluida','pronto_retirada','entregue')
        AND COALESCE(data_conclusao, updated_at)::date = current_date
    ),
    'em_bancada', (
      SELECT COUNT(*) FROM public.ordens_servico
      WHERE organization_id = v_org
        AND status::text IN ('recebido','aberta','aguardando_diagnostico','aguardando_aprovacao','aprovado','aguardando_peca','em_reparo','em_andamento','em_testes')
    ),
    'aguardando_aprovacao', (
      SELECT COUNT(*) FROM public.ordens_servico
      WHERE organization_id = v_org AND status::text = 'aguardando_aprovacao'
    ),
    'feed', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'updated_at' DESC), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'id', os.id, 'numero', os.numero, 'cliente', c.nome,
          'equipamento', os.modelo_equipamento, 'status', os.status::text,
          'prioridade', os.prioridade,
          'tecnico', COALESCE(tp.nome, 'Não atribuída'),
          'evento', CASE
                      WHEN os.status::text IN ('concluida','pronto_retirada','entregue') AND os.updated_at >= now() - interval '6 hours' THEN 'finalizada'
                      WHEN os.created_at >= now() - interval '6 hours' THEN 'entrada'
                      ELSE 'atualizacao'
                    END,
          'data_entrada', os.data_entrada,
          'updated_at', os.updated_at
        ) AS row_data
        FROM public.ordens_servico os
        LEFT JOIN public.clientes c ON c.id = os.cliente_id
        LEFT JOIN public.profiles tp ON tp.id = os.tecnico_id
        WHERE os.organization_id = v_org
          AND os.updated_at >= now() - interval '6 hours'
        LIMIT 30
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workshop_board() TO authenticated;