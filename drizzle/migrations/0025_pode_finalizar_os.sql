-- =====================================================================
-- 0025 — Permissão "Pode finalizar OS"
--
-- Antes desta migration só o técnico responsável conseguia finalizar uma OS: o trigger
-- `os_assignment_rules` levantava 'Somente o técnico responsável pode finalizar esta OS.'
-- para QUALQUER outro usuário autenticado — inclusive o administrador, porque a condição
-- olhava apenas `auth.uid() <> tecnico_id`. Não existia coluna de permissão para isso.
--
-- Agora finalizam a OS:
--   1. administrador da organização (ou admin da plataforma);
--   2. o técnico responsável (regra por linha, como antes);
--   3. quem tem `user_permissions.pode_finalizar_os` — o atendente do balcão, por exemplo.
--
-- Quem entra pela regra 3 não ganha direito de UPDATE em `ordens_servico` (a policy segue
-- exigindo admin ou técnico): ele fecha a OS pelo RPC `finalizar_os`, que grava apenas
-- status, data_conclusao e data_entrega, congela o rateio da comissão e escreve o histórico.
-- Limitar a permissão no RPC é mais seguro do que abrir o UPDATE da tabela e tentar conter
-- por trigger: dentro de um trigger SECURITY DEFINER não dá para distinguir com segurança a
-- alteração feita pelo cliente da feita pelo próprio sistema (current_user é o dono da
-- função, não o usuário do JWT).
-- =====================================================================

-- 1. Coluna -------------------------------------------------------------------
ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS pode_finalizar_os boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_permissions.pode_finalizar_os IS
  'Permite finalizar (fechar) OS de qualquer técnico da organização. Admin e técnico já podem; só faz diferença para os demais papéis.';

-- 2. Predicado ----------------------------------------------------------------
-- Não é SECURITY DEFINER de propósito: dentro das policies o invocador é o próprio usuário,
-- e a policy "Users can view own permissions" deixa ele ler a própria linha.
CREATE OR REPLACE FUNCTION public.pode_finalizar_os(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  select coalesce(
    (select up.pode_finalizar_os from public.user_permissions up where up.user_id = _user_id),
    false);
$function$;

-- 3. Quem pode finalizar (regra por linha) ------------------------------------
CREATE OR REPLACE FUNCTION public.os_assignment_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.tecnico_id IS DISTINCT FROM OLD.tecnico_id THEN
    IF NEW.tecnico_id IS NOT NULL THEN
      NEW.atribuida_em := now();
      NEW.recebida_em := NULL;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status::text = 'finalizada' AND OLD.status::text <> 'finalizada'
     AND auth.role() = 'authenticated'
     AND auth.uid() IS DISTINCT FROM NEW.tecnico_id
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND NOT public.is_platform_admin(auth.uid())
     AND NOT public.pode_finalizar_os(auth.uid()) THEN
    RAISE EXCEPTION 'Somente o técnico responsável, um administrador ou um usuário com a permissão "Pode finalizar OS" pode finalizar esta OS.';
  END IF;

  RETURN NEW;
END $function$;

-- 4. Fechar a OS pelo RPC (caminho de quem só tem a permissão) ----------------
CREATE OR REPLACE FUNCTION public.finalizar_os(_os_id uuid, _status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_os record;
  v_label text;
begin
  if v_uid is null then raise exception 'Acesso negado'; end if;

  select os.id, os.organization_id, os.tecnico_id, os.status::text as status, os.data_conclusao
    into v_os
    from public.ordens_servico os
   where os.id = _os_id;
  if not found then raise exception 'OS não encontrada.'; end if;

  if v_os.organization_id is distinct from public.get_user_org_id(v_uid)
     and not public.is_platform_admin(v_uid) then
    raise exception 'Acesso negado';
  end if;

  -- Só fecha: quem tem apenas a permissão não reabre nem cancela a OS.
  if _status not in ('pronto_retirada', 'concluida', 'entregue', 'finalizada') then
    raise exception 'Só é possível finalizar (fechar) a OS.';
  end if;

  if not public.has_role(v_uid, 'admin'::public.app_role)
     and not public.is_platform_admin(v_uid)
     and v_os.tecnico_id is distinct from v_uid
     and not public.pode_finalizar_os(v_uid) then
    raise exception 'Você não tem permissão para finalizar esta OS.';
  end if;

  update public.ordens_servico
     set status = _status::public.status_os,
         data_conclusao = case when _status in ('pronto_retirada', 'concluida', 'finalizada')
                               then now() else data_conclusao end,
         data_entrega = case when _status = 'entregue' then now() else data_entrega end
   where id = _os_id;

  -- Congela o rateio da comissão, igual ao caminho do admin/técnico.
  perform public.os_commission_core(_os_id, false);

  v_label := case _status
               when 'entregue' then 'Entregue'
               when 'finalizada' then 'Finalizada'
               else 'Pronto'
             end;

  insert into public.os_historico (ordem_servico_id, usuario_id, acao, organization_id)
  values (_os_id, v_uid, 'Status alterado para ' || v_label, v_os.organization_id);

  return jsonb_build_object('id', _os_id, 'status', _status);
end $function$;

-- Os privilégios padrão do banco concedem EXECUTE a `anon` em funções novas; estas são de
-- uso interno do app, então nada de anônimo.
REVOKE EXECUTE ON FUNCTION public.finalizar_os(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_os(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.pode_finalizar_os(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pode_finalizar_os(uuid) TO authenticated;

-- 5. Congelar a comissão também vale para quem só tem a permissão -------------
CREATE OR REPLACE FUNCTION public.calculate_os_commission(_os_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_org uuid;
  v_tec uuid;
  v_total numeric := 0;
begin
  select os.organization_id, os.tecnico_id into v_org, v_tec
    from public.ordens_servico os where os.id = _os_id;
  if v_org is null then return 0; end if;
  if public.get_user_org_id(auth.uid()) is distinct from v_org and not public.is_platform_admin(auth.uid()) then
    raise exception 'Acesso negado';
  end if;
  -- Quem pode fechar a OS (admin, o técnico responsável ou quem tem "Pode finalizar OS")
  -- também precisa congelar o rateio: senão a OS fecha com a comissão em prévia.
  if not public.has_role(auth.uid(), 'admin'::public.app_role)
     and auth.uid() is distinct from v_tec
     and not public.pode_finalizar_os(auth.uid()) then
    raise exception 'Acesso negado';
  end if;

  perform public.os_commission_core(_os_id, false);

  select coalesce(os.commission_total, 0) into v_total from public.ordens_servico os where os.id = _os_id;
  return v_total;
end $function$;
