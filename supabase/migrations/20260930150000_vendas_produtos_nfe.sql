-- MÓDULO VENDAS: Produtos, Categorias, Vendas, Estoque, NFe/NFSe
-- Execute no SQL Editor do Supabase

-- ============================================
-- CATEGORIAS DE PRODUTOS
-- ============================================
CREATE TABLE categoria_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_categoria_org ON categoria_produtos(organization_id);
CREATE INDEX idx_categoria_nome ON categoria_produtos(nome);

-- Trigger updated_at
CREATE TRIGGER update_categoria_produtos_updated_at
  BEFORE UPDATE ON categoria_produtos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE categoria_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar categorias" ON categoria_produtos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = categoria_produtos.organization_id
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Usuários veem categorias da sua org" ON categoria_produtos
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- PRODUTOS
-- ============================================
CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES categoria_produtos(id) ON DELETE SET NULL,
  
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  
  -- Códigos fiscais
  ncm VARCHAR(10), -- Ex: 3926109000
  cfop VARCHAR(4), -- Ex: 5102
  
  -- Preços
  preco_custo DECIMAL(12, 2) DEFAULT 0,
  preco_venda DECIMAL(12, 2) DEFAULT 0,
  margem_lucro DECIMAL(5, 2) DEFAULT 0, -- percentual
  
  -- Estoque
  estoque_minimo INT DEFAULT 10,
  estoque_atual INT DEFAULT 0,
  
  -- Fiscais
  aplica_icms BOOLEAN DEFAULT true,
  aplica_ipi BOOLEAN DEFAULT false,
  aplica_pis_cofins BOOLEAN DEFAULT true,
  
  ativo BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_prod_org ON produtos(organization_id);
CREATE INDEX idx_prod_categoria ON produtos(categoria_id);
CREATE INDEX idx_prod_ncm ON produtos(ncm);
CREATE INDEX idx_prod_ativo ON produtos(ativo);

-- Trigger updated_at
CREATE TRIGGER update_produtos_updated_at
  BEFORE UPDATE ON produtos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam produtos" ON produtos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = produtos.organization_id
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Usuários veem produtos da sua org" ON produtos
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- MOVIMENTAÇÃO DE ESTOQUE
-- ============================================
CREATE TABLE estoque_movimentacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id) ON DELETE CASCADE,
  
  tipo VARCHAR(50) NOT NULL, -- entrada, saida, ajuste, devolucao
  motivo VARCHAR(100), -- compra, venda, perda, ajuste, etc
  
  quantidade_anterior INT NOT NULL,
  quantidade_movimento INT NOT NULL,
  quantidade_final INT NOT NULL,
  
  documento_referencia VARCHAR(100), -- número venda/OS/compra
  documento_tipo VARCHAR(50), -- venda, os, compra, ajuste
  
  registrado_por UUID REFERENCES profiles(id),
  registrado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_est_mov_org ON estoque_movimentacao(organization_id);
CREATE INDEX idx_est_mov_produto ON estoque_movimentacao(produto_id);
CREATE INDEX idx_est_mov_data ON estoque_movimentacao(registrado_em);

-- RLS
ALTER TABLE estoque_movimentacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam movimentações" ON estoque_movimentacao
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = estoque_movimentacao.organization_id
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Usuários veem movimentações da sua org" ON estoque_movimentacao
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- VENDAS
-- ============================================
CREATE TABLE vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  numero VARCHAR(20) UNIQUE NOT NULL,
  data_venda DATE DEFAULT CURRENT_DATE,
  
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nome VARCHAR(255) NOT NULL,
  cliente_cpf_cnpj VARCHAR(20),
  cliente_email VARCHAR(255),
  
  -- Valores
  valor_produtos DECIMAL(12, 2) DEFAULT 0,
  valor_desconto DECIMAL(12, 2) DEFAULT 0,
  valor_impostos DECIMAL(12, 2) DEFAULT 0,
  valor_total DECIMAL(12, 2) DEFAULT 0,
  
  -- Pagamento
  forma_pagamento VARCHAR(50), -- dinheiro, debito, credito, pix, cheque
  status_pagamento VARCHAR(50) DEFAULT 'pendente', -- pendente, pago, parcial
  
  -- Observações
  obs TEXT,
  
  -- Nota Fiscal
  nf_numero VARCHAR(20),
  nf_chave VARCHAR(50),
  nf_emitida_em TIMESTAMP WITH TIME ZONE,
  nf_provider VARCHAR(50),
  
  -- Auditoria
  vendido_por UUID REFERENCES profiles(id),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_venda_org ON vendas(organization_id);
CREATE INDEX idx_venda_cliente ON vendas(cliente_id);
CREATE INDEX idx_venda_data ON vendas(data_venda);
CREATE INDEX idx_venda_numero ON vendas(numero);
CREATE INDEX idx_venda_nf ON vendas(nf_numero);
CREATE INDEX idx_venda_status ON vendas(status_pagamento);

-- Trigger updated_at
CREATE TRIGGER update_vendas_updated_at
  BEFORE UPDATE ON vendas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam vendas" ON vendas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = vendas.organization_id
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Usuários veem vendas da sua org" ON vendas
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Técnicos criam vendas" ON vendas
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- ITENS DA VENDA
-- ============================================
CREATE TABLE venda_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id) ON DELETE SET NULL,
  
  nome_produto VARCHAR(255) NOT NULL,
  ncm VARCHAR(10),
  cfop VARCHAR(4),
  
  quantidade DECIMAL(12, 4) NOT NULL DEFAULT 1,
  preco_unitario DECIMAL(12, 2) NOT NULL DEFAULT 0,
  valor_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  desconto_percentual DECIMAL(5, 2) DEFAULT 0,
  desconto_valor DECIMAL(12, 2) DEFAULT 0,
  
  -- Impostos (calculados)
  icms_percentual DECIMAL(5, 2),
  icms_valor DECIMAL(12, 2),
  pis_cofins_valor DECIMAL(12, 2),
  ipi_valor DECIMAL(12, 2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_venda_itens_venda ON venda_itens(venda_id);
CREATE INDEX idx_venda_itens_produto ON venda_itens(produto_id);

-- RLS
ALTER TABLE venda_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam itens de venda" ON venda_itens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM vendas v
      JOIN profiles p ON p.organization_id = v.organization_id
      WHERE v.id = venda_itens.venda_id
      AND p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Usuários veem itens de vendas da sua org" ON venda_itens
  FOR SELECT USING (
    venda_id IN (
      SELECT id FROM vendas WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ============================================
-- GANHOS DO TÉCNICO (comissão sobre vendas)
-- ============================================
CREATE TABLE tecnico_ganhos_venda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  venda_id UUID REFERENCES vendas(id) ON DELETE CASCADE,
  tecnico_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  comissao_percentual DECIMAL(5, 2), -- 5%, 10%, etc
  valor_venda DECIMAL(12, 2),
  valor_comissao DECIMAL(12, 2),
  
  status VARCHAR(50) DEFAULT 'pendente', -- pendente, pago, cancelado
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_ganhos_org ON tecnico_ganhos_venda(organization_id);
CREATE INDEX idx_ganhos_venda ON tecnico_ganhos_venda(venda_id);
CREATE INDEX idx_ganhos_tecnico ON tecnico_ganhos_venda(tecnico_id);

-- Trigger updated_at
CREATE TRIGGER update_tecnico_ganhos_venda_updated_at
  BEFORE UPDATE ON tecnico_ganhos_venda
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE tecnico_ganhos_venda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam ganhos" ON tecnico_ganhos_venda
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = tecnico_ganhos_venda.organization_id
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Técnico vê seus próprios ganhos" ON tecnico_ganhos_venda
  FOR SELECT USING (
    tecnico_id = auth.uid()
  );

-- ============================================
-- NOTAS FISCAIS EMITIDAS (NFSe + NFe)
-- ============================================
CREATE TABLE nota_fiscal_emitida (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Tipo de nota
  tipo VARCHAR(20) NOT NULL, -- nfse, nfe, nfce
  
  -- Dados básicos
  numero VARCHAR(20),
  serie VARCHAR(5),
  chave_acesso VARCHAR(50), -- 44 dígitos para NFe
  
  -- Documento
  xml_url VARCHAR(500),
  pdf_url VARCHAR(500),
  xml_conteudo TEXT,
  
  -- Cliente
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nome VARCHAR(255),
  cliente_cpf_cnpj VARCHAR(20),
  cliente_email VARCHAR(255),
  
  -- Valores
  valor_total DECIMAL(12, 2),
  valor_impostos DECIMAL(12, 2),
  valor_liquido DECIMAL(12, 2),
  
  -- Status
  status VARCHAR(50), -- autorizado, rejeitado, cancelado, pendente
  motivo_rejeicao TEXT,
  
  -- Referência interna
  os_id UUID REFERENCES ordens_servico(id) ON DELETE SET NULL,
  venda_id UUID REFERENCES vendas(id) ON DELETE SET NULL,
  
  -- Provider
  provider VARCHAR(50), -- focusnfe, notagateway, sefaz_direto
  provider_id VARCHAR(100),
  
  -- Auditoria
  emitida_por UUID REFERENCES profiles(id),
  emitida_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  cancelada_em TIMESTAMP WITH TIME ZONE,
  cancelada_por UUID REFERENCES profiles(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_nf_org ON nota_fiscal_emitida(organization_id);
CREATE INDEX idx_nf_numero ON nota_fiscal_emitida(numero);
CREATE INDEX idx_nf_chave ON nota_fiscal_emitida(chave_acesso);
CREATE INDEX idx_nf_cliente ON nota_fiscal_emitida(cliente_id);
CREATE INDEX idx_nf_os ON nota_fiscal_emitida(os_id);
CREATE INDEX idx_nf_venda ON nota_fiscal_emitida(venda_id);
CREATE INDEX idx_nf_status ON nota_fiscal_emitida(status);
CREATE INDEX idx_nf_tipo ON nota_fiscal_emitida(tipo);

-- Trigger updated_at
CREATE TRIGGER update_nota_fiscal_emitida_updated_at
  BEFORE UPDATE ON nota_fiscal_emitida
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE nota_fiscal_emitida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam notas fiscais" ON nota_fiscal_emitida
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = nota_fiscal_emitida.organization_id
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Usuários veem notas da sua org" ON nota_fiscal_emitida
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- ITENS DA NOTA FISCAL
-- ============================================
CREATE TABLE nota_fiscal_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nf_id UUID REFERENCES nota_fiscal_emitida(id) ON DELETE CASCADE,
  
  descricao VARCHAR(255) NOT NULL,
  quantidade DECIMAL(12, 4) NOT NULL,
  valor_unitario DECIMAL(12, 2) NOT NULL,
  valor_total DECIMAL(12, 2) NOT NULL,
  
  -- Para NFe de produtos
  ncm VARCHAR(10),
  cfop VARCHAR(4),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_nf_itens_nf ON nota_fiscal_itens(nf_id);

-- RLS
ALTER TABLE nota_fiscal_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam itens de NF" ON nota_fiscal_itens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM nota_fiscal_emitida nf
      JOIN profiles p ON p.organization_id = nf.organization_id
      WHERE nf.id = nota_fiscal_itens.nf_id
      AND p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Usuários veem itens de NF da sua org" ON nota_fiscal_itens
  FOR SELECT USING (
    nf_id IN (
      SELECT id FROM nota_fiscal_emitida WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ============================================
-- EVENTOS DA NOTA FISCAL (log)
-- ============================================
CREATE TABLE nota_fiscal_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nf_id UUID REFERENCES nota_fiscal_emitida(id) ON DELETE CASCADE,
  
  tipo_evento VARCHAR(50), -- autorizacao, cancelamento, rejeicao, consulta
  descricao TEXT,
  dados_evento JSONB,
  
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_nf_eventos_nf ON nota_fiscal_eventos(nf_id);

-- RLS
ALTER TABLE nota_fiscal_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam eventos de NF" ON nota_fiscal_eventos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM nota_fiscal_emitida nf
      JOIN profiles p ON p.organization_id = nf.organization_id
      WHERE nf.id = nota_fiscal_eventos.nf_id
      AND p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Usuários veem eventos de NF da sua org" ON nota_fiscal_eventos
  FOR SELECT USING (
    nf_id IN (
      SELECT id FROM nota_fiscal_emitida WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );