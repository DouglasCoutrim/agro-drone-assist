-- 1. Add battery cycle fields to ordens_servico
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS ciclos_carga_entrada integer;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS ciclos_carga_saida integer;

-- 2. Create orcamentos table
CREATE TABLE IF NOT EXISTS public.orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  equipamento text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  validade date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  status text NOT NULL DEFAULT 'pendente',
  ordem_servico_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and tecnico can manage orcamentos"
ON public.orcamentos FOR ALL TO authenticated
USING (public.is_admin_or_tecnico(auth.uid()))
WITH CHECK (public.is_admin_or_tecnico(auth.uid()));

CREATE POLICY "Admin and tecnico can view orcamentos"
ON public.orcamentos FOR SELECT TO authenticated
USING (public.is_admin_or_tecnico(auth.uid()));

-- 3. Create rotas table
CREATE TABLE IF NOT EXISTS public.rotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  origem text NOT NULL DEFAULT '',
  destino text NOT NULL DEFAULT '',
  distancia_km numeric NOT NULL DEFAULT 0,
  custo_rota numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and tecnico can manage rotas"
ON public.rotas FOR ALL TO authenticated
USING (public.is_admin_or_tecnico(auth.uid()))
WITH CHECK (public.is_admin_or_tecnico(auth.uid()));

CREATE POLICY "Admin and tecnico can view rotas"
ON public.rotas FOR SELECT TO authenticated
USING (public.is_admin_or_tecnico(auth.uid()));