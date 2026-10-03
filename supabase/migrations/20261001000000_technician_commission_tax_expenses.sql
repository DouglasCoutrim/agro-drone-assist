-- Fase 1: Sistema avançado de comissionamento, retenção de impostos e gestão financeira individual de técnicos
-- Aproveita estruturas existentes: profiles (comissão), ordens_servico (tecnico_id), os_tecnicos_ajudantes, empresa_config
-- Multi-tenant estrito via organization_id + RLS

-- ============================================================================
-- 1. ENUMS NOVOS
-- ============================================================================

CREATE TYPE os_technician_role AS ENUM ('PRINCIPAL', 'AUXILIARY');
CREATE TYPE os_technician_payer AS ENUM ('COMPANY', 'PRINCIPAL', 'SHARED');
CREATE TYPE tax_retention_status AS ENUM ('RETAINED', 'RELEASED_TO_TECH', 'PAID_TO_GOV');

-- ============================================================================
-- 2. CONFIGURAÇÃO DA EMPRESA - Adicionar % imposto NFS-e
-- ============================================================================

ALTER TABLE empresa_config
ADD COLUMN IF NOT EXISTS tax_percentage_nfe NUMERIC(5,2) DEFAULT 0 CHECK (tax_percentage_nfe >= 0 AND tax_percentage_nfe <= 100);

COMMENT ON COLUMN empresa_config.tax_percentage_nfe IS 'Percentual de imposto retido na emissão de NFS-e (ex: 5% para ISS)';

-- ============================================================================
-- 2b. ORDENS DE SERVIÇO - Campo para controle de emissão de NFe
-- ============================================================================

ALTER TABLE ordens_servico
ADD COLUMN IF NOT EXISTS nfe_emitida BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN ordens_servico.nfe_emitida IS 'Indica se a NFe/NFS-e foi emitida para esta OS. Se TRUE, o imposto é responsabilidade da empresa pagar ao governo. Se FALSE, o imposto fica retido no fundo de retenção para liberação em 6 meses.';

-- ============================================================================
-- 3. TABELA UNIFICADA DE TÉCNICOS NA OS (substitui/estende os_tecnicos_ajudantes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS os_technicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ordem_servico_id UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    role os_technician_role NOT NULL DEFAULT 'AUXILIARY',
    commission_type TEXT NOT NULL CHECK (commission_type IN ('percentage', 'fixed')),
    commission_value NUMERIC(12,2) NOT NULL DEFAULT 0, -- % ou valor fixo
    payer_type os_technician_payer NOT NULL DEFAULT 'COMPANY', -- quem paga a comissão do auxiliar
    net_value_received NUMERIC(12,2) DEFAULT 0, -- valor líquido recebido pelo técnico
    tax_retained_amount NUMERIC(12,2) DEFAULT 0, -- imposto retido que vai para fundo se não houver NFe
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Garante 1 principal por OS e 1 registro por técnico por OS
    CONSTRAINT unique_principal_per_os UNIQUE (ordem_servico_id, role) DEFERRABLE INITIALLY DEFERRED
);

-- Constraint parcial para garantir apenas 1 PRINCIPAL por OS
CREATE UNIQUE INDEX IF NOT EXISTS idx_os_technicians_one_principal 
ON os_technicians (ordem_servico_id) 
WHERE role = 'PRINCIPAL';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_os_technicians_os_id ON os_technicians (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_os_technicians_tech_id ON os_technicians (technician_id);
CREATE INDEX IF NOT EXISTS idx_os_technicians_org_id ON os_technicians (ordem_servico_id) 
    INCLUDE (technician_id); -- Para joins com ordens_servico filtrando por org

COMMENT ON TABLE os_technicians IS 'Técnicos (principal + auxiliares) alocados na OS com regras de comissão e retenção';
COMMENT ON COLUMN os_technicians.role IS 'PRINCIPAL = técnico responsável; AUXILIARY = ajudante';
COMMENT ON COLUMN os_technicians.payer_type IS 'COMPANY = empresa paga; PRINCIPAL = principal paga; SHARED = rateio';
COMMENT ON COLUMN os_technicians.tax_retained_amount IS 'Imposto retido (ex: ISS) que vai para fundo de retenção se não emitir NFS-e';

-- ============================================================================
-- 4. FUNDO DE RETENÇÃO DE IMPOSTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tax_retention_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    os_id UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    status tax_retention_status NOT NULL DEFAULT 'RETAINED',
    retained_at TIMESTAMPTZ DEFAULT NOW(),
    release_date DATE GENERATED ALWAYS AS ( (os.data_conclusao + INTERVAL '6 months')::DATE ) STORED,
    released_at TIMESTAMPTZ,
    released_by UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tax_retention_ledger_os ON tax_retention_ledger (os_id);
CREATE INDEX IF NOT EXISTS idx_tax_retention_ledger_tech ON tax_retention_ledger (technician_id);
CREATE INDEX IF NOT EXISTS idx_tax_retention_ledger_org ON tax_retention_ledger (organization_id);
CREATE INDEX IF NOT EXISTS idx_tax_retention_ledger_status ON tax_retention_ledger (status);
CREATE INDEX IF NOT EXISTS idx_tax_retention_ledger_release_date ON tax_retention_ledger (release_date);

COMMENT ON TABLE tax_retention_ledger IS 'Lançamentos do fundo de retenção de impostos (ex: ISS retido sem NFe). Liberação automática após 6 meses.';

-- ============================================================================
-- 5. CONTROLE FINANCEIRO INDIVIDUAL DO TÉCNICO
-- ============================================================================

CREATE TABLE IF NOT EXISTS technician_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    expense_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category TEXT NOT NULL, -- ex: 'ferramenta', 'epi', 'treinamento', 'deslocamento', 'outros'
    reference_type TEXT, -- 'os', 'manual', 'estoque', etc
    reference_id UUID, -- ID da OS, transferência, etc
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_technician_expenses_tech ON technician_expenses (technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_expenses_org ON technician_expenses (organization_id);
CREATE INDEX IF NOT EXISTS idx_technician_expenses_date ON technician_expenses (expense_date);
CREATE INDEX IF NOT EXISTS idx_technician_expenses_category ON technician_expenses (category);

COMMENT ON TABLE technician_expenses IS 'Despesas individuais do técnico (ferramentas, EPIs, treinamentos, etc) para controle financeiro pessoal';

-- ============================================================================
-- 6. TRIGGERS DE UPDATED_AT
-- ============================================================================

-- Reutiliza função existente update_updated_at_column() se existir, senão cria
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_os_technicians_updated_at
    BEFORE UPDATE ON os_technicians
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tax_retention_ledger_updated_at
    BEFORE UPDATE ON tax_retention_ledger
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_technician_expenses_updated_at
    BEFORE UPDATE ON technician_expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) - MULTI-TENANT ESTREITO
-- ============================================================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE os_technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_retention_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE technician_expenses ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- os_technicians RLS
-- --------------------------------------------------------------------------
-- Admin da org: CRUD total
-- Técnico principal da OS: pode ver/editar auxiliares da sua OS
-- Técnico auxiliar: pode ver apenas seu próprio registro
-- Consulta: apenas leitura se tiver permissão

-- Helper: organization_id da OS (via join)
-- Política: SELECT
CREATE POLICY "os_technicians_select_org_members" ON os_technicians
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM ordens_servico os
            WHERE os.id = os_technicians.ordem_servico_id
            AND os.organization_id = get_user_org_id(auth.uid())
        )
        AND (
            -- Admin da org vê tudo
            has_role(auth.uid(), 'admin'::app_role)
            OR
            -- Técnico vê seus próprios registros (seja principal ou auxiliar)
            os_technicians.technician_id = auth.uid()
            OR
            -- Técnico principal da OS vê auxiliares
            EXISTS (
                SELECT 1 FROM ordens_servico os2
                WHERE os2.id = os_technicians.ordem_servico_id
                AND os2.tecnico_id = auth.uid()
                AND has_role(auth.uid(), 'tecnico'::app_role)
            )
        )
    );

-- Política: INSERT (apenas admin ou técnico principal criando auxiliares)
CREATE POLICY "os_technicians_insert_admin_or_principal" ON os_technicians
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM ordens_servico os
            WHERE os.id = os_technicians.ordem_servico_id
            AND os.organization_id = get_user_org_id(auth.uid())
        )
        AND (
            has_role(auth.uid(), 'admin'::app_role)
            OR
            (
                has_role(auth.uid(), 'tecnico'::app_role)
                AND EXISTS (
                    SELECT 1 FROM ordens_servico os2
                    WHERE os2.id = os_technicians.ordem_servico_id
                    AND os2.tecnico_id = auth.uid()
                )
                AND os_technicians.role = 'AUXILIARY' -- Técnico principal só adiciona auxiliares
            )
        )
    );

-- Política: UPDATE (admin ou técnico principal para auxiliares; admin para principal)
CREATE POLICY "os_technicians_update_admin_or_principal" ON os_technicians
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM ordens_servico os
            WHERE os.id = os_technicians.ordem_servico_id
            AND os.organization_id = get_user_org_id(auth.uid())
        )
        AND (
            has_role(auth.uid(), 'admin'::app_role)
            OR
            (
                has_role(auth.uid(), 'tecnico'::app_role)
                AND EXISTS (
                    SELECT 1 FROM ordens_servico os2
                    WHERE os2.id = os_technicians.ordem_servico_id
                    AND os2.tecnico_id = auth.uid()
                )
                AND os_technicians.role = 'AUXILIARY'
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM ordens_servico os
            WHERE os.id = os_technicians.ordem_servico_id
            AND os.organization_id = get_user_org_id(auth.uid())
        )
        AND (
            has_role(auth.uid(), 'admin'::app_role)
            OR
            (
                has_role(auth.uid(), 'tecnico'::app_role)
                AND EXISTS (
                    SELECT 1 FROM ordens_servico os2
                    WHERE os2.id = os_technicians.ordem_servico_id
                    AND os2.tecnico_id = auth.uid()
                )
                AND os_technicians.role = 'AUXILIARY'
            )
        )
    );

-- Política: DELETE (apenas admin)
CREATE POLICY "os_technicians_delete_admin" ON os_technicians
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM ordens_servico os
            WHERE os.id = os_technicians.ordem_servico_id
            AND os.organization_id = get_user_org_id(auth.uid())
        )
        AND has_role(auth.uid(), 'admin'::app_role)
    );

-- --------------------------------------------------------------------------
-- tax_retention_ledger RLS
-- --------------------------------------------------------------------------
-- Admin da org: CRUD total
-- Técnico: vê apenas suas próprias retenções
-- Consulta: apenas leitura se admin da org

CREATE POLICY "tax_retention_select_own_or_admin" ON tax_retention_ledger
    FOR SELECT
    USING (
        organization_id = get_user_org_id(auth.uid())
        AND (
            has_role(auth.uid(), 'admin'::app_role)
            OR technician_id = auth.uid()
        )
    );

CREATE POLICY "tax_retention_insert_admin" ON tax_retention_ledger
    FOR INSERT
    WITH CHECK (
        organization_id = get_user_org_id(auth.uid())
        AND has_role(auth.uid(), 'admin'::app_role)
    );

CREATE POLICY "tax_retention_update_admin" ON tax_retention_ledger
    FOR UPDATE
    USING (
        organization_id = get_user_org_id(auth.uid())
        AND has_role(auth.uid(), 'admin'::app_role)
    )
    WITH CHECK (
        organization_id = get_user_org_id(auth.uid())
        AND has_role(auth.uid(), 'admin'::app_role)
    );

CREATE POLICY "tax_retention_delete_admin" ON tax_retention_ledger
    FOR DELETE
    USING (
        organization_id = get_user_org_id(auth.uid())
        AND has_role(auth.uid(), 'admin'::app_role)
    );

-- --------------------------------------------------------------------------
-- technician_expenses RLS
-- --------------------------------------------------------------------------
-- Admin da org: CRUD total
-- Técnico: CRUD apenas suas próprias despesas
-- Consulta: apenas leitura se admin da org

CREATE POLICY "technician_expenses_select_own_or_admin" ON technician_expenses
    FOR SELECT
    USING (
        organization_id = get_user_org_id(auth.uid())
        AND (
            has_role(auth.uid(), 'admin'::app_role)
            OR technician_id = auth.uid()
        )
    );

CREATE POLICY "technician_expenses_insert_own_or_admin" ON technician_expenses
    FOR INSERT
    WITH CHECK (
        organization_id = get_user_org_id(auth.uid())
        AND (
            has_role(auth.uid(), 'admin'::app_role)
            OR technician_id = auth.uid()
        )
    );

CREATE POLICY "technician_expenses_update_own_or_admin" ON technician_expenses
    FOR UPDATE
    USING (
        organization_id = get_user_org_id(auth.uid())
        AND (
            has_role(auth.uid(), 'admin'::app_role)
            OR technician_id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id = get_user_org_id(auth.uid())
        AND (
            has_role(auth.uid(), 'admin'::app_role)
            OR technician_id = auth.uid()
        )
    );

CREATE POLICY "technician_expenses_delete_own_or_admin" ON technician_expenses
    FOR DELETE
    USING (
        organization_id = get_user_org_id(auth.uid())
        AND (
            has_role(auth.uid(), 'admin'::app_role)
            OR technician_id = auth.uid()
        )
    );

-- ============================================================================
-- 8. MIGRAÇÃO DE DADOS EXISTENTES (os_tecnicos_ajudantes -> os_technicians)
-- ============================================================================

-- Insere técnicos principais das OS existentes na nova tabela
INSERT INTO os_technicians (ordem_servico_id, technician_id, role, commission_type, commission_value, payer_type)
SELECT 
    os.id,
    os.tecnico_id,
    'PRINCIPAL'::os_technician_role,
    'percentage'::TEXT,
    COALESCE(p.service_commission_value, 0),
    'COMPANY'::os_technician_payer
FROM ordens_servico os
JOIN profiles p ON p.id = os.tecnico_id
WHERE os.tecnico_id IS NOT NULL
ON CONFLICT (ordem_servico_id, role) DO NOTHING;

-- Migra ajudantes existentes
INSERT INTO os_technicians (ordem_servico_id, technician_id, role, commission_type, commission_value, payer_type)
SELECT 
    ota.ordem_servico_id,
    ota.tecnico_id,
    'AUXILIARY'::os_technician_role,
    ota.tipo_comissao,
    COALESCE(ota.valor_comissao, ota.porcentagem_comissao, 0),
    'COMPANY'::os_technician_payer
FROM os_tecnicos_ajudantes ota
ON CONFLICT (ordem_servico_id, technician_id) DO NOTHING;

-- ============================================================================
-- 9. FUNÇÃO RPC PARA CALCULAR COMISSÃO COM NOVA ESTRUTURA
-- ============================================================================

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
    v_tech_ids UUID[];
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

-- ============================================================================
-- 10. FUNÇÃO RPC PARA LIBERAR RETENÇÕES VENCIDAS (+6 meses)
-- ============================================================================

CREATE OR REPLACE FUNCTION release_expired_tax_retentions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_released_count INT := 0;
    v_released_amount NUMERIC(12,2) := 0;
    r_record RECORD;
BEGIN
    -- Apenas platform_admin ou admin da org pode executar
    IF NOT is_platform_admin(v_caller_id) AND NOT has_role(v_caller_id, 'admin'::app_role) THEN
        RAISE EXCEPTION 'Apenas administradores podem liberar retenções';
    END IF;
    
    -- Busca retenções vencidas (release_date <= hoje e status = RETAINED)
    FOR r_record IN
        SELECT id, technician_id, amount, organization_id
        FROM tax_retention_ledger
        WHERE status = 'RETAINED'
        AND release_date <= CURRENT_DATE
        AND (is_platform_admin(v_caller_id) OR organization_id = get_user_org_id(v_caller_id))
    LOOP
        UPDATE tax_retention_ledger
        SET 
            status = 'RELEASED_TO_TECH',
            released_at = NOW(),
            released_by = v_caller_id,
            updated_at = NOW()
        WHERE id = r_record.id;
        
        v_released_count := v_released_count + 1;
        v_released_amount := v_released_amount + r_record.amount;
    END LOOP;
    
    RETURN jsonb_build_object(
        'released_count', v_released_count,
        'released_amount', v_released_amount
    );
END;
$$;

-- ============================================================================
-- 11. FUNÇÃO RPC PARA DASHBOARD FINANCEIRO DO TÉCNICO (com parâmetros de período)
-- ============================================================================

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

-- ============================================================================
-- 11b. FUNÇÃO RPC PARA EXTRATO DE SERVIÇOS DO TÉCNICO (por período)
-- ============================================================================

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

-- ============================================================================
-- 11c. FUNÇÃO RPC PARA RESUMO DE RETENÇÕES AGRUPADO POR TÉCNICO (Admin)
-- ============================================================================

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

-- ============================================================================
-- 11d. FUNÇÃO RPC PARA LIBERAR RETENÇÕES EM LOTE POR TÉCNICO (Admin)
-- ============================================================================

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

-- ============================================================================
-- 11e. FUNÇÃO RPC PARA DETALHAMENTO DE RETENÇÕES POR TÉCNICO (Admin)
-- ============================================================================

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

-- ============================================================================
-- 12. GRANTS PARA FUNCTIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION calculate_os_technician_commission(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION release_expired_tax_retentions() TO authenticated;
GRANT EXECUTE ON FUNCTION get_technician_financial_dashboard(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_technician_os_statement(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_technician_retention_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION batch_release_technician_retentions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_technician_retention_details(UUID) TO authenticated;

-- ============================================================================
-- 13. COMMENTS FINAIS
-- ============================================================================

COMMENT ON TABLE os_technicians IS 
'Tabela unificada de técnicos por OS. Substitui os_tecnicos_ajudantes.
Inclui: papel (PRINCIPAL/AUXILIARY), tipo comissão, pagador, valor líquido, imposto retido.';

COMMENT ON TABLE tax_retention_ledger IS 
'Fundo de retenção de impostos (ex: ISS retido quando não emite NFS-e).
Liberação automática após 6 meses via release_expired_tax_retentions().';

COMMENT ON TABLE technician_expenses IS 
'Despesas individuais do técnico (ferramentas, EPIs, treinamentos).
Visibilidade: técnico vê só suas; admin vê todos da org.';