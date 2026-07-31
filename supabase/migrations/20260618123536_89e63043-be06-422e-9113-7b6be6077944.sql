-- Reset completo de dados NAO e mais automatico: exige opt-in explicito em
-- platform_config (key "allow_full_reset" = {"enabled": true}).
-- Em reset limpo (sem dados) e em ambientes sem platform_config, a migracao
-- apenas registra um NOTICE e nao apaga nada.

DO $$
DECLARE
  v_opt_in boolean := false;
BEGIN
  IF to_regclass('public.platform_config') IS NOT NULL THEN
    SELECT COALESCE((value->>'enabled')::boolean, false)
    INTO v_opt_in
    FROM public.platform_config
    WHERE key = 'allow_full_reset'
    LIMIT 1;
  END IF;

  IF v_opt_in THEN
    TRUNCATE TABLE
      public.itens_os,
      public.os_anexos,
      public.os_historico,
      public.ordens_servico,
      public.orcamentos,
      public.movimentacoes_estoque,
      public.itens_estoque,
      public.produtos,
      public.servicos,
      public.financeiro,
      public.tenant_invoices,
      public.rotas,
      public.clientes,
      public.notifications,
      public.support_messages,
      public.support_tickets,
      public.wiki_tour_progress,
      public.user_permissions,
      public.user_roles,
      public.platform_admins,
      public.empresa_config,
      public.profiles,
      public.organizations
    RESTART IDENTITY CASCADE;

    DELETE FROM auth.users;
    RAISE NOTICE 'Reset completo executado (opt-in ativo).';
  ELSE
    RAISE NOTICE 'Reset completo IGNORADO: defina platform_config key "allow_full_reset" = {"enabled": true} para executar.';
  END IF;
END $$;
