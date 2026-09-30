-- =============================================================================
-- MODULO DO TECNICO - PERFIL DE COMISSIONAMENTO (A)
-- Adiciona os campos de comissao no perfil do tecnico (editaveis apenas por
-- ADMIN), libera UPDATE de profiles para admins da MESMA org e protege os
-- campos de comissao contra edicao pelo proprio tecnico.
-- Idempotente.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commission_on_services boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_commission_type text NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS service_commission_value numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_on_products boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS product_commission_type text NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS product_commission_value numeric(12,2) NOT NULL DEFAULT 0;

-- Admin da mesma organizacao pode ATAUALIZAR perfis (nome + comissao).
-- Antes nao havia policy FOR UPDATE para admin (apenas o proprio usuario),
-- o que tambem quebrava a edicao de nome na pagina Equipe.
DROP POLICY IF EXISTS "Org admins update profiles" ON public.profiles;
CREATE POLICY "Org admins update profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND organization_id = public.get_user_org_id(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND organization_id = public.get_user_org_id(auth.uid())
  );

-- Impede que o proprio tecnico altere a propria config de comissao.
CREATE OR REPLACE FUNCTION public.protect_profile_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    NEW.commission_on_services := OLD.commission_on_services;
    NEW.service_commission_type := OLD.service_commission_type;
    NEW.service_commission_value := OLD.service_commission_value;
    NEW.commission_on_products := OLD.commission_on_products;
    NEW.product_commission_type := OLD.product_commission_type;
    NEW.product_commission_value := OLD.product_commission_value;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_commission ON public.profiles;
CREATE TRIGGER protect_profile_commission
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_commission();