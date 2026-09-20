-- =============================================================================
-- FIX: Trigger to prevent unauthorized profile field modifications
-- Impede que usuários comuns alterem organization_id e configurações de comissão
-- Apenas funcoes com SECURITY DEFINER ou service_role podem modificar estes campos
-- =============================================================================

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se a chamada nao vier de service_role, bloqueia mudancas em campos sensiveis
  -- auth.role() returns 'authenticated' para usuarios normais, 'service_role' para service key
  IF auth.role() = 'authenticated' THEN
    -- Bloqueia alteracao de organization_id
    IF NEW.organization_id != OLD.organization_id THEN
      RAISE EXCEPTION 'Nao e permitido alterar o organization_id atraves da API/Interface. Apenas administradores de plataforma podem fazer esta mudanca.';
    END IF;

    -- Bloqueia alteracao de configuracoes de comissao de produtos
    IF NEW.commission_on_products != OLD.commission_on_products THEN
      RAISE EXCEPTION 'Nao e permitido alterar commission_on_products atraves da API/Interface.';
    END IF;

    IF NEW.product_commission_type != OLD.product_commission_type THEN
      RAISE EXCEPTION 'Nao e permitido alterar product_commission_type atraves da API/Interface.';
    END IF;

    IF NEW.product_commission_value != OLD.product_commission_value THEN
      RAISE EXCEPTION 'Nao e permitido alterar product_commission_value atraves da API/Interface.';
    END IF;

    -- Bloqueia alteracao de configuracoes de comissao de servicos
    IF NEW.commission_on_services != OLD.commission_on_services THEN
      RAISE EXCEPTION 'Nao e permitido alterar commission_on_services atraves da API/Interface.';
    END IF;

    IF NEW.service_commission_type != OLD.service_commission_type THEN
      RAISE EXCEPTION 'Nao e permitido alterar service_commission_type atraves da API/Interface.';
    END IF;

    IF NEW.service_commission_value != OLD.service_commission_value THEN
      RAISE EXCEPTION 'Nao e permitido alterar service_commission_value atraves da API/Interface.';
    END IF;

    -- Bloqueia alteracao de outros campos sensiveis do perfil
    IF NEW.commission_on_products IS DISTINCT FROM OLD.commission_on_products THEN
      RAISE EXCEPTION 'Nao e permitido alterar configuracoes de comissao.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Remove trigger antiga se existir e cria a nova
DROP TRIGGER IF EXISTS protect_profile_commission ON public.profiles;
CREATE TRIGGER protect_profile_commission
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_fields();