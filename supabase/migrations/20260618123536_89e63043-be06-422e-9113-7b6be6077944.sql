
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
