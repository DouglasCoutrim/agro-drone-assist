-- Create site_config table
CREATE TABLE IF NOT EXISTS public.site_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public read access for site_config"
ON public.site_config
FOR SELECT
USING (true);

-- Allow platform admins to manage site_config
CREATE POLICY "Platform admins can manage site_config"
ON public.site_config
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  )
);

-- Insert initial landing page data
INSERT INTO public.site_config (key, value, description) VALUES
('landing_hero', '{
  "title": "A gestão completa da sua assistência técnica",
  "highlight": "assistência técnica",
  "description": "Pare de perder tempo com papel ou sistemas antigos. O LivreOS foi pensado para a nova geração de assistências — perfeito para oficinas de eletrônica, drones, mobilidade urbana e prestadores de serviços que buscam faturamento, estoque e OS organizados em poucos cliques.",
  "cta_primary": "Começar 7 dias grátis",
  "cta_secondary": "Ver planos",
  "badge": "Novo: cobranças PIX em 1 clique"
}', 'Conteúdo da seção Hero da Landing Page'),
('site_contact', '{
  "whatsapp": "5500000000000",
  "email": "contato@livreos.com.br",
  "instagram": "@livreos",
  "address": "São Paulo, SP"
}', 'Informações de contato globais do site'),
('landing_features', '[
  {"title": "Ordens de Serviço", "desc": "Pipeline visual, status automáticos, fotos, assinatura digital e PDF white-label.", "icon": "ClipboardList"},
  {"title": "Estoque Inteligente", "desc": "Controle de peças, código sequencial, importação Mercado Livre e precificação por margem.", "icon": "Package"},
  {"title": "Financeiro & Cobranças", "desc": "Integração com Asaas e Mercado Pago. Gere PIX e Boleto direto da OS.", "icon": "DollarSign"},
  {"title": "CRM de Clientes", "desc": "Cadastro completo, histórico de atendimentos e infraestrutura técnica do cliente.", "icon": "Users"},
  {"title": "Rotas & Deslocamentos", "desc": "Cálculo de rota OSRM, pedágios, combustível e compartilhamento via WhatsApp.", "icon": "MapPin"},
  {"title": "Relatórios em Tempo Real", "desc": "KPIs de faturamento, OS, técnicos e estoque. Tudo num único painel.", "icon": "BarChart3"}
]', 'Lista de funcionalidades exibidas na landing page')
ON CONFLICT (key) DO NOTHING;