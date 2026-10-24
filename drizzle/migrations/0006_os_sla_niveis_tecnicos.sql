ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nivel_tecnico smallint;
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS nivel_minimo smallint NOT NULL DEFAULT 1;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS atribuida_em timestamptz,
  ADD COLUMN IF NOT EXISTS recebida_em timestamptz,
  ADD COLUMN IF NOT EXISTS repasses_automaticos integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.os_assignment_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.tecnico_id IS DISTINCT FROM OLD.tecnico_id THEN
    IF NEW.tecnico_id IS NOT NULL THEN
      NEW.atribuida_em := now();
      NEW.recebida_em := NULL;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status::text = 'finalizada' AND OLD.status::text <> 'finalizada'
     AND auth.role() = 'authenticated' AND auth.uid() IS DISTINCT FROM NEW.tecnico_id THEN
    RAISE EXCEPTION 'Somente o técnico responsável pode finalizar esta OS.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_os_assignment_rules ON public.ordens_servico;
CREATE TRIGGER trg_os_assignment_rules BEFORE INSERT OR UPDATE ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.os_assignment_rules();

CREATE OR REPLACE FUNCTION public.confirmar_recebimento_os(_os_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.ordens_servico SET recebida_em = now()
  WHERE id = _os_id AND tecnico_id = auth.uid() AND recebida_em IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Apenas o técnico designado pode confirmar o recebimento.'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.confirmar_recebimento_os(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.repassar_os_sem_recebimento()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; v_novo uuid; v_n int := 0; v_nivel int;
BEGIN
  FOR r IN SELECT os.id, os.organization_id, os.tecnico_id, os.numero FROM public.ordens_servico os
    WHERE os.recebida_em IS NULL AND os.atribuida_em < now() - interval '1 hour'
      AND os.status::text NOT IN ('concluida','entregue','cancelada','finalizada','pronto_retirada')
  LOOP
    SELECT GREATEST(2, COALESCE(MAX(s.nivel_minimo),1)) INTO v_nivel
      FROM public.itens_os i JOIN public.servicos s ON s.id = i.servico_id WHERE i.ordem_servico_id = r.id;
    SELECT p.id INTO v_novo FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'tecnico'
      WHERE p.organization_id = r.organization_id AND p.id <> r.tecnico_id
        AND COALESCE(p.nivel_tecnico,0) >= v_nivel
      ORDER BY (SELECT count(*) FROM public.ordens_servico o2 WHERE o2.tecnico_id = p.id
        AND o2.status::text NOT IN ('concluida','entregue','cancelada','finalizada')), random()
      LIMIT 1;
    IF v_novo IS NOT NULL THEN
      UPDATE public.ordens_servico SET tecnico_id = v_novo, repasses_automaticos = repasses_automaticos + 1 WHERE id = r.id;
      v_n := v_n + 1;
    ELSE
      UPDATE public.ordens_servico SET atribuida_em = now() WHERE id = r.id;
      PERFORM public.notify_org_role(r.organization_id, 'admin'::app_role, 'os',
        'OS ' || r.numero || ' sem recebimento', 'Nenhum técnico nível 2 ou 3 disponível para repasse.', '/ordens-servico?os=' || r.id::text);
    END IF;
  END LOOP;
  RETURN v_n;
END $$;
REVOKE EXECUTE ON FUNCTION public.repassar_os_sem_recebimento() FROM PUBLIC, anon, authenticated;