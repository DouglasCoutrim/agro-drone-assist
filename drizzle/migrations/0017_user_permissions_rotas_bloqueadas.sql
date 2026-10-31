ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS rotas_bloqueadas text[] NOT NULL DEFAULT '{}';
UPDATE public.user_permissions SET rotas_bloqueadas = array_remove(ARRAY[
  CASE WHEN NOT acesso_dashboard THEN '/dashboard' END,
  CASE WHEN NOT acesso_os THEN '/ordens-servico' END,
  CASE WHEN NOT acesso_meu_painel THEN '/technician/dashboard' END,
  CASE WHEN NOT acesso_meu_painel THEN '/technician/financeiro' END,
  CASE WHEN NOT acesso_oficina_vivo THEN '/workshop/live' END,
  CASE WHEN NOT acesso_clientes THEN '/clientes' END,
  CASE WHEN NOT acesso_estoque THEN '/estoque' END,
  CASE WHEN NOT acesso_estoque THEN '/estoque/importar-xml' END,
  CASE WHEN NOT acesso_servicos THEN '/servicos' END,
  CASE WHEN NOT acesso_financeiro THEN '/financeiro' END,
  CASE WHEN NOT acesso_cobrancas THEN '/cobrancas' END,
  CASE WHEN NOT acesso_orcamentos THEN '/orcamentos' END,
  CASE WHEN NOT acesso_relatorios THEN '/relatorios' END,
  CASE WHEN NOT acesso_equipe THEN '/equipe' END,
  CASE WHEN NOT acesso_empresa THEN '/empresa' END,
  CASE WHEN NOT acesso_configuracoes THEN '/configuracoes' END,
  CASE WHEN NOT acesso_checklist THEN '/admin/configuracao-os' END,
  CASE WHEN NOT acesso_notificacoes THEN '/notificacoes' END,
  CASE WHEN NOT acesso_wiki THEN '/wiki' END,
  CASE WHEN NOT acesso_suporte THEN '/suporte' END
]::text[], NULL);
COMMENT ON COLUMN public.user_permissions.rotas_bloqueadas IS 'Menu hrefs the user cannot access; replaces acesso_* columns';