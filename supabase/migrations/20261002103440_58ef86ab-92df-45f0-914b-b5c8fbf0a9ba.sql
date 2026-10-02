CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_commission_changed boolean;
  v_can_manage_commission boolean;
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'Nao e permitido alterar o organization_id atraves da API/Interface. Apenas administradores de plataforma podem fazer esta mudanca.';
    END IF;

    v_commission_changed :=
      NEW.commission_on_services IS DISTINCT FROM OLD.commission_on_services OR
      NEW.service_commission_type IS DISTINCT FROM OLD.service_commission_type OR
      NEW.service_commission_value IS DISTINCT FROM OLD.service_commission_value OR
      NEW.commission_on_products IS DISTINCT FROM OLD.commission_on_products OR
      NEW.product_commission_type IS DISTINCT FROM OLD.product_commission_type OR
      NEW.product_commission_value IS DISTINCT FROM OLD.product_commission_value;

    IF v_commission_changed THEN
      v_can_manage_commission :=
        public.has_role(auth.uid(), 'admin'::public.app_role)
        AND public.has_role(OLD.id, 'tecnico'::public.app_role)
        AND OLD.organization_id IS NOT NULL
        AND OLD.organization_id = public.get_user_org_id(auth.uid());

      IF NOT COALESCE(v_can_manage_commission, false) THEN
        RAISE EXCEPTION 'Somente administradores da empresa podem alterar a comissao de tecnicos.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;