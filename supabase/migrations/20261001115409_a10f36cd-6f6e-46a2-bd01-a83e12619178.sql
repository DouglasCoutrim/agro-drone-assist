CREATE OR REPLACE FUNCTION public.snapshot_item_cobranca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_servico record;
  v_valor_hora_eff numeric(12,2);
BEGIN
  NEW.snapshot_tipo_cobranca := 'fixo';
  NEW.snapshot_valor_hora_efetivo := 0;

  IF NEW.servico_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tipo_cobranca, valor_hora
    INTO v_servico
    FROM public.servicos
   WHERE id = NEW.servico_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.snapshot_tipo_cobranca := COALESCE(v_servico.tipo_cobranca, 'fixo');
  IF v_servico.tipo_cobranca = 'hora_tecnica' THEN
    SELECT COALESCE(p.valor_hora_tecnica, v_servico.valor_hora, ec.valor_hora_padrao, 0)
      INTO v_valor_hora_eff
      FROM public.ordens_servico os
      LEFT JOIN public.profiles p ON p.id = os.tecnico_id
      LEFT JOIN public.empresa_config ec ON ec.organization_id = os.organization_id
     WHERE os.id = NEW.ordem_servico_id
     LIMIT 1;
    NEW.snapshot_valor_hora_efetivo := COALESCE(v_valor_hora_eff, 0);
  END IF;
  RETURN NEW;
END;
$$;