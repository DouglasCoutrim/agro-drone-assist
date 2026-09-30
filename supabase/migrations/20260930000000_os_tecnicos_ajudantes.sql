-- =============================================================================
-- TECNICOS AJUDANTES NA ORDEM DE SERVICO
-- Permite que o tecnico principal adicione outros tecnicos como ajudantes
-- Cada ajudante pode receber comissao fixa ou porcentagem do lucro dos servicos
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.os_tecnicos_ajudantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  tecnico_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  tipo_comissao text NOT NULL CHECK (tipo_comissao IN ('fixo', 'porcentagem')),
  valor_comissao numeric(12,2) DEFAULT 0,
  porcentagem_comissao numeric(5,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ordem_servico_id, tecnico_id)
);

-- RLS
ALTER TABLE public.os_tecnicos_ajudantes ENABLE ROW LEVEL SECURITY;

-- Admins da org veem tudo
CREATE POLICY "Admins veem ajudantes da org"
  ON public.os_tecnicos_ajudantes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = os_tecnicos_ajudantes.ordem_servico_id
        AND os.organization_id = public.get_user_org_id(auth.uid())
        AND public.has_role(auth.uid(), 'admin')
    )
  );

-- Tecnico principal da OS ve os ajudantes
CREATE POLICY "Tecnico principal ve ajudantes da OS"
  ON public.os_tecnicos_ajudantes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = os_tecnicos_ajudantes.ordem_servico_id
        AND os.tecnico_id = auth.uid()
    )
  );

-- Tecnico ajudante ve sua propria participacao
CREATE POLICY "Tecnico ajudante ve sua participacao"
  ON public.os_tecnicos_ajudantes FOR SELECT TO authenticated
  USING (tecnico_id = auth.uid());

-- Apenas tecnico principal ou admin pode adicionar/remover ajudantes
CREATE POLICY "Tecnico principal gerencia ajudantes"
  ON public.os_tecnicos_ajudantes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = os_tecnicos_ajudantes.ordem_servico_id
        AND (os.tecnico_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
        AND os.organization_id = public.get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "Tecnico principal atualiza ajudantes"
  ON public.os_tecnicos_ajudantes FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = os_tecnicos_ajudantes.ordem_servico_id
        AND (os.tecnico_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
        AND os.organization_id = public.get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "Tecnico principal remove ajudantes"
  ON public.os_tecnicos_ajudantes FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = os_tecnicos_ajudantes.ordem_servico_id
        AND (os.tecnico_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
        AND os.organization_id = public.get_user_org_id(auth.uid())
    )
  );

-- Trigger para updated_at
DROP TRIGGER IF EXISTS set_os_tecnicos_ajudantes_updated_at ON public.os_tecnicos_ajudantes;
CREATE TRIGGER set_os_tecnicos_ajudantes_updated_at
  BEFORE UPDATE ON public.os_tecnicos_ajudantes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indices
CREATE INDEX IF NOT EXISTS idx_os_tecnicos_ajudantes_os_id ON public.os_tecnicos_ajudantes(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_os_tecnicos_ajudantes_tecnico_id ON public.os_tecnicos_ajudantes(tecnico_id);

-- Grant
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_tecnicos_ajudantes TO authenticated;