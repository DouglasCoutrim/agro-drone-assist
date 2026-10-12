-- ============================================================================
-- MIGRAÇÃO INCREMENTAL - FASE 3/4 (Painel Financeiro Técnico + Caixa Retenção Admin)
-- Apenas as alterações dos últimos 2 prompts (Phase 3 + Phase 4)
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. COLUNA nfe_emitida NA ORDEM DE SERVIÇO (já existe na Fase 1, mas garantindo)
-- -----------------------------------------------------------------------------
ALTER TABLE ordens_servico
ADD COLUMN IF NOT EXISTS nfe_emitida BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN ordens_servico.nfe_emitida IS 
'Indica se a NFe/NFS-e foi emitida para esta OS. 
Se TRUE: imposto é responsabilidade da empresa pagar ao governo (PAID_TO_GOV). 
Se FALSE: imposto fica retido no fundo de retenção para liberação em 6 meses (RETAINED).';

-- -----------------------------------------------------------------------------
-- 2. RPC ATUALIZADA: calculate_os_technician_commission (considera nfe_emitida)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_os_technician_commission(_os_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_os RECORD;
    v_org_id UUID;
    v_caller_id UUID := auth.uid();
    v_is_admin BOOLEAN;
    v_result JSONB := '{}';
    v_total_commission NUMERIC(12,2) := 0;
    v_total_tax_retained NUMERIC(12,2) := 0;
    v_total_tax_paid_gov NUMERIC(12,2) := 0;
    v_service_value NUMERIC(12,2) := 0;
    v_product_value NUMERIC(12,2) := 0;
    v_tax_pct NUMERIC(5,2) := 0;
    v_nfe_emitida BOOLEAN := FALSE;
    r_tech RECORD;
BEGIN
    -- Verifica permissão e busca dados da OS incluindo nfe_emitida
    SELECT organization_id, tecnico_id, valor_final, data_conclusao, nfe_emitida
    INTO v_os
    FROM ordens_servico
    WHERE id = _os_id;
    
    IF v_os IS NULL THEN
        RAISE EXCEPTION 'OS não encontrada';
    END IF;
    
    v_org_id := v_os.organization_id;
    v_nfe_emitida := COALESCE(v_os.nfe_emitida, FALSE);
    
    -- Verifica se é admin da org ou técnico da OS
    SELECT has_role(v_caller_id, 'admin'::app_role) INTO v_is_admin;
    
    IF NOT v_is_admin AND v_os.tecnico_id != v_caller_id THEN
        -- Verifica se é auxiliar na OS
        SELECT EXISTS(SELECT 1 FROM os_technicians WHERE ordem_servico_id = _os_id AND technician_id = v_caller_id) INTO v_is_admin;
        IF NOT v_is_admin THEN
            RAISE EXCEPTION 'Sem permissão para calcular comissão desta OS';
        END IF;
    END IF;
    
    -- Busca % imposto da empresa
    SELECT COALESCE(tax_percentage_nfe, 0) INTO v_tax_pct
    FROM empresa_config
    WHERE organization_id = v_org_id;
    
    -- Calcula valores de serviços e produtos da OS
    SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'servico' THEN valor_total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo = 'produto' THEN valor_total ELSE 0 END), 0)
    INTO v_service_value, v_product_value
    FROM itens_os
    WHERE ordem_servico_id = _os_id;
    
    -- Para cada técnico na OS (principal + auxiliares)
    FOR r_tech IN
        SELECT ot.*, p.service_commission_type, p.service_commission_value, 
               p.product_commission_type, p.product_commission_value
        FROM os_technicians ot
        JOIN profiles p ON p.id = ot.technician_id
        WHERE ot.ordem_servico_id = _os_id
    LOOP
        DECLARE
            v_comm_services NUMERIC(12,2) := 0;
            v_comm_products NUMERIC(12,2) := 0;
            v_comm_total NUMERIC(12,2) := 0;
            v_tax_retained NUMERIC(12,2) := 0;
            v_net_received NUMERIC(12,2) := 0;
        BEGIN
            -- Comissão sobre serviços
            IF r_tech.commission_type = 'percentage' THEN
                v_comm_services := v_service_value * (r_tech.commission_value / 100);
            ELSE
                v_comm_services := r_tech.commission_value;
            END IF;
            
            -- Comissão sobre produtos (usa config do profile do técnico)
            IF p.product_commission_type = 'percentage' THEN
                v_comm_products := v_product_value * (p.product_commission_value / 100);
            ELSE
                v_comm_products := p.product_commission_value;
            END IF;
            
            v_comm_total := v_comm_services + v_comm_products;
            
            -- Imposto retido (aplica % da empresa)
            v_tax_retained := v_comm_total * (v_tax_pct / 100);
            v_net_received := v_comm_total - v_tax_retained;
            
            -- Atualiza registro do técnico na OS
            UPDATE os_technicians
            SET 
                commission_value = CASE 
                    WHEN r_tech.commission_type = 'percentage' THEN r_tech.commission_value
                    ELSE v_comm_total
                END,
                net_value_received = v_net_received,
                tax_retained_amount = v_tax_retained,
                updated_at = NOW()
            WHERE id = r_tech.id;
            
            -- Regra NFe: Se emitiu NFe -> imposto vai para empresa pagar gov (PAID_TO_GOV)
            -- Se NÃO emitiu NFe -> imposto fica retido no fundo (RETAINED) para liberação em 6 meses
            IF v_tax_retained > 0 THEN
                IF v_nfe_emitida THEN
                    -- NFe emitida: empresa assume o imposto (responsabilidade fiscal)
                    INSERT INTO tax_retention_ledger (os_id, technician_id, organization_id, amount, status)
                    VALUES (_os_id, r_tech.technician_id, v_org_id, v_tax_retained, 'PAID_TO_GOV')
                    ON CONFLICT DO NOTHING;
                    v_total_tax_paid_gov := v_total_tax_paid_gov + v_tax_retained;
                ELSE
                    -- NFe NÃO emitida: imposto retido no fundo de retenção
                    INSERT INTO tax_retention_ledger (os_id, technician_id, organization_id, amount, status)
                    VALUES (_os_id, r_tech.technician_id, v_org_id, v_tax_retained, 'RETAINED')
                    ON CONFLICT DO NOTHING;
                    v_total_tax_retained := v_total_tax_retained + v_tax_retained;
                END IF;
            END IF;
            
            v_total_commission := v_total_commission + v_comm_total;
        END;
    END LOOP;
    
    -- Atualiza totais na OS (compatibilidade com campos existentes)
    UPDATE ordens_servico
    SET 
        commission_total = v_total_commission,
        commission_computed_at = NOW()
    WHERE id = _os_id;
    
    RETURN jsonb_build_object(
        'total_commission', v_total_commission,
        'total_tax_retained', v_total_tax_retained,
        'total_tax_paid_gov', v_total_tax_paid_gov,
        'nfe_emitida', v_nfe_emitida,
        'technicians_processed', (SELECT COUNT(*) FROM os_technicians WHERE ordem_servico_id = _os_id)
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. RPC ATUALIZADA: get_technician_financial_dashboard (com parâmetros de período)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_technician_financial_dashboard(
    _tecnico_id UUID DEFAULT NULL,
    _period_start DATE DEFAULT DATE_TRUNC('month', NOW()),
    _period_end DATE DEFAULT (DATE_TRUNC('month', NOW()) + INTERVAL '1 month - 1 day')
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_target_id UUID := COALESCE(_tecnico_id, v_caller_id);
    v_role app_role;
    v_org_id UUID;
    v_result JSONB;
BEGIN
    -- Verifica permissão: próprio técnico ou admin da mesma org
    SELECT role INTO v_role FROM user_roles WHERE user_id = v_caller_id LIMIT 1;
    
    IF v_target_id != v_caller_id THEN
        IF NOT has_role(v_caller_id, 'admin'::app_role) THEN
            RAISE EXCEPTION 'Acesso negado: só pode ver seu próprio painel financeiro';
        END IF;
        -- Admin deve ser da mesma org do técnico alvo
        SELECT organization_id INTO v_org_id FROM profiles WHERE id = v_target_id;
        IF v_org_id != get_user_org_id(v_caller_id) THEN
            RAISE EXCEPTION 'Técnico não pertence à sua organização';
        END IF;
    ELSE
        SELECT organization_id INTO v_org_id FROM profiles WHERE id = v_caller_id;
    END IF;
    
    -- Comissões realizadas (OSs finalizadas/entregues no período)
    SELECT jsonb_build_object(
        'comissoes_realizadas_periodo', COALESCE(SUM(ot.net_value_received), 0),
        'impostos_retidos_periodo', COALESCE(SUM(ot.tax_retained_amount), 0),
        'valor_bruto_periodo', COALESCE(SUM(ot.net_value_received + ot.tax_retained_amount), 0),
        'os_count', COUNT(DISTINCT ot.ordem_servico_id)
    ) INTO v_result
    FROM os_technicians ot
    JOIN ordens_servico os ON os.id = ot.ordem_servico_id
    WHERE ot.technician_id = v_target_id
    AND os.organization_id = v_org_id
    AND os.status IN ('entregue', 'finalizada', 'concluida')
    AND os.data_conclusao >= _period_start
    AND os.data_conclusao <= _period_end;
    
    -- Despesas do período
    SELECT jsonb_build_object(
        'despesas_periodo', COALESCE(SUM(amount), 0),
        'despesas_count', COUNT(*)
    ) INTO v_result
    FROM technician_expenses
    WHERE technician_id = v_target_id
    AND organization_id = v_org_id
    AND expense_date >= _period_start
    AND expense_date <= _period_end;
    
    -- Retenções pendentes de liberação (todas, não só do período)
    SELECT jsonb_build_object(
        'retencoes_pendentes', COALESCE(SUM(amount), 0),
        'retencoes_count', COUNT(*)
    ) INTO v_result
    FROM tax_retention_ledger
    WHERE technician_id = v_target_id
    AND organization_id = v_org_id
    AND status = 'RETAINED';
    
    -- Retenções liberadas no período
    SELECT jsonb_build_object(
        'retencoes_liberadas_periodo', COALESCE(SUM(amount), 0)
    ) INTO v_result
    FROM tax_retention_ledger
    WHERE technician_id = v_target_id
    AND organization_id = v_org_id
    AND status = 'RELEASED_TO_TECH'
    AND released_at >= _period_start
    AND released_at <= _period_end;
    
    RETURN v_result;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. NOVA RPC: get_technician_os_statement (Extrato de Serviços por Período)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_technician_os_statement(
    _tecnico_id UUID,
    _period_start DATE,
    _period_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_target_id UUID := COALESCE(_tecnico_id, v_caller_id);
    v_org_id UUID;
    v_result JSONB;
BEGIN
    -- Verifica permissão: próprio técnico ou admin da mesma org
    IF _tecnico_id IS NOT NULL AND _tecnico_id != v_caller_id THEN
        IF NOT has_role(v_caller_id, 'admin'::app_role) THEN
            RAISE EXCEPTION 'Acesso negado: só pode ver seu próprio extrato';
        END IF;
        SELECT organization_id INTO v_org_id FROM profiles WHERE id = _tecnico_id;
        IF v_org_id != get_user_org_id(v_caller_id) THEN
            RAISE EXCEPTION 'Técnico não pertence à sua organização';
        END IF;
    ELSE
        SELECT organization_id INTO v_org_id FROM profiles WHERE id = v_caller_id;
    END IF;
    
    -- Busca OSs do técnico no período (principal ou auxiliar)
    SELECT jsonb_agg(jsonb_build_object(
        'os_numero', os.numero,
        'os_id', os.id,
        'role', ot.role,
        'data_conclusao', os.data_conclusao,
        'valor_bruto', (ot.net_value_received + ot.tax_retained_amount),
        'imposto_descontado', ot.tax_retained_amount,
        'comissao_liquida', ot.net_value_received,
        'nfe_emitida', os.nfe_emitida
    ) ORDER BY os.data_conclusao DESC)
    INTO v_result
    FROM os_technicians ot
    JOIN ordens_servico os ON os.id = ot.ordem_servico_id
    WHERE ot.technician_id = v_target_id
    AND os.organization_id = v_org_id
    AND os.status IN ('entregue', 'finalizada', 'concluida')
    AND os.data_conclusao >= _period_start
    AND os.data_conclusao <= _period_end;
    
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. NOVA RPC: get_technician_retention_summary (Resumo Agrupado por Técnico - Admin)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_technician_retention_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_org_id UUID;
    v_result JSONB;
BEGIN
    -- Apenas admins
    IF NOT has_role(v_caller_id, 'admin'::app_role) THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores';
    END IF;
    
    SELECT organization_id INTO v_org_id FROM profiles WHERE id = v_caller_id;
    
    -- Agrupa por técnico: saldo bloqueado (< 6 meses) vs liberado (>= 6 meses)
    SELECT jsonb_agg(jsonb_build_object(
        'technician_id', t.technician_id,
        'technician_nome', t.technician_nome,
        'saldo_bloqueado', COALESCE(t.saldo_bloqueado, 0),
        'saldo_liberado', COALESCE(t.saldo_liberado, 0),
        'total_retido', COALESCE(t.saldo_bloqueado, 0) + COALESCE(t.saldo_liberado, 0),
        'count_bloqueado', COALESCE(t.count_bloqueado, 0),
        'count_liberado', COALESCE(t.count_liberado, 0)
    ) ORDER BY t.technician_nome)
    INTO v_result
    FROM (
        SELECT 
            trl.technician_id,
            p.nome as technician_nome,
            SUM(CASE WHEN trl.release_date > NOW()::date AND trl.status = 'RETAINED' THEN trl.amount ELSE 0 END) as saldo_bloqueado,
            SUM(CASE WHEN trl.release_date <= NOW()::date AND trl.status = 'RETAINED' THEN trl.amount ELSE 0 END) as saldo_liberado,
            COUNT(CASE WHEN trl.release_date > NOW()::date AND trl.status = 'RETAINED' THEN 1 END) as count_bloqueado,
            COUNT(CASE WHEN trl.release_date <= NOW()::date AND trl.status = 'RETAINED' THEN 1 END) as count_liberado
        FROM tax_retention_ledger trl
        JOIN profiles p ON p.id = trl.technician_id
        WHERE trl.organization_id = v_org_id
        AND trl.status IN ('RETAINED', 'RELEASED_TO_TECH')
        GROUP BY trl.technician_id, p.nome
    ) t;
    
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. NOVA RPC: batch_release_technician_retentions (Liberação em Lote - Admin)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION batch_release_technician_retentions(_technician_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_org_id UUID;
    v_target_org_id UUID;
    v_updated_count INT;
    v_total_amount NUMERIC(12,2);
BEGIN
    -- Apenas admins
    IF NOT has_role(v_caller_id, 'admin'::app_role) THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores';
    END IF;
    
    SELECT organization_id INTO v_org_id FROM profiles WHERE id = v_caller_id;
    SELECT organization_id INTO v_target_org_id FROM profiles WHERE id = _technician_id;
    
    IF v_org_id != v_target_org_id THEN
        RAISE EXCEPTION 'Técnico não pertence à sua organização';
    END IF;
    
    -- Atualiza apenas retenções RETAINED com release_date vencida (>= 6 meses)
    UPDATE tax_retention_ledger
    SET status = 'RELEASED_TO_TECH',
        released_at = NOW(),
        released_by = v_caller_id
    WHERE technician_id = _technician_id
    AND organization_id = v_org_id
    AND status = 'RETAINED'
    AND release_date <= NOW()::date;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    SELECT COALESCE(SUM(amount), 0) INTO v_total_amount
    FROM tax_retention_ledger
    WHERE technician_id = _technician_id
    AND organization_id = v_org_id
    AND status = 'RELEASED_TO_TECH'
    AND released_at >= NOW() - INTERVAL '1 second';
    
    RETURN jsonb_build_object(
        'success', true,
        'updated_count', v_updated_count,
        'total_amount', v_total_amount,
        'message', CASE 
            WHEN v_updated_count > 0 THEN format('Repasse realizado: %s retenção(ões) liberadas, total R$ %s', v_updated_count, v_total_amount)
            ELSE 'Nenhuma retenção vencida encontrada para este técnico'
        END
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. NOVA RPC: get_technician_retention_details (Detalhamento por Técnico - Admin)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_technician_retention_details(_technician_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_org_id UUID;
    v_target_org_id UUID;
    v_result JSONB;
BEGIN
    -- Apenas admins
    IF NOT has_role(v_caller_id, 'admin'::app_role) THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores';
    END IF;
    
    SELECT organization_id INTO v_org_id FROM profiles WHERE id = v_caller_id;
    SELECT organization_id INTO v_target_org_id FROM profiles WHERE id = _technician_id;
    
    IF v_org_id != v_target_org_id THEN
        RAISE EXCEPTION 'Técnico não pertence à sua organização';
    END IF;
    
    SELECT jsonb_agg(jsonb_build_object(
        'id', trl.id,
        'os_numero', os.numero,
        'os_id', os.id,
        'amount', trl.amount,
        'status', trl.status,
        'retained_at', trl.retained_at,
        'release_date', trl.release_date,
        'released_at', trl.released_at,
        'is_overdue', trl.release_date <= NOW()::date AND trl.status = 'RETAINED'
    ) ORDER BY trl.retained_at DESC)
    INTO v_result
    FROM tax_retention_ledger trl
    JOIN ordens_servico os ON os.id = trl.os_id
    WHERE trl.technician_id = _technician_id
    AND trl.organization_id = v_org_id
    AND trl.status IN ('RETAINED', 'RELEASED_TO_TECH');
    
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. GRANTS PARA AS NOVAS FUNCTIONS
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION get_technician_os_statement(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_technician_retention_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION batch_release_technician_retentions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_technician_retention_details(UUID) TO authenticated;

-- Note: calculate_os_technician_commission e get_technician_financial_dashboard
-- já têm GRANT na migração base (Fase 1), mas garantindo:
GRANT EXECUTE ON FUNCTION calculate_os_technician_commission(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_technician_financial_dashboard(UUID, DATE, DATE) TO authenticated;