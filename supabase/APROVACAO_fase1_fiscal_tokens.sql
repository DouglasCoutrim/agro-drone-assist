-- ============================================================================
-- LivreOS - Fase 1: os tokens da Focus NFe nunca voltam ao navegador
--
-- STATUS: APLICADO em 2026-11-22 (view public.nfe_config_publica e funcao
-- public.salvar_focus_token criadas; ACL conferida: so service_role executa a
-- funcao e so SELECT em authenticated na view). O mesmo SQL esta em
-- drizzle/migrations/0027_nfe_config_publica_e_token_no_vault.sql. Os passos
-- futuros listados no fim deste arquivo continuam NAO executados.
--
-- O que este arquivo faz:
--   1. Cria a view public.nfe_config_publica = nfe_config SEM as quatro colunas
--      de segredo (focus_token_homologacao, focus_token_producao,
--      focus_token_hom_secret_id, focus_token_prod_secret_id), e com duas
--      colunas derivadas que apenas dizem se ha token cadastrado.
--   2. Cria public.salvar_focus_token(), que grava o token no Vault e atualiza
--      os ponteiros em nfe_config. So o service_role pode executar.
--
-- O que este arquivo NAO faz (decisao sua, ficou para depois):
--   - nao limpa as colunas de texto puro dos tokens (fica para 7 dias depois);
--   - nao mexe na tabela nfe_config_backup_20261111.
--
-- FEITO depois, em commits separados:
--   - src/pages/NovaNfse.tsx migrado para ler da view (era o unico ponto do
--     navegador que fazia select("*") em nfe_config e trazia os tokens);
--   - EXECUTE de os_commission_calc/os_commission_core revogado de PUBLIC/anon
--     (ver APROVACAO_revogar_execute_comissao_anon.sql).
-- Obs.: as Edge Functions leem o token pelo Vault (RPC get_focus_token) e so caem
-- na coluna legada como fallback, entao nada mais no navegador toca os tokens.
--
-- Depois de aplicar, conferir:
--   select * from public.nfe_config_publica;
--   select public.salvar_focus_token('<org>', 'homologacao', 'token-de-teste');
--     (rodar como service_role, nunca no SQL editor com role de usuario comum)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) View publica (somente leitura)
-- ----------------------------------------------------------------------------
-- security_invoker = true: a view roda com os privilegios de quem consulta, logo
-- a RLS de nfe_config continua valendo (admin le a propria organizacao). Sem
-- isso, a view rodaria como o dono e ignoraria a RLS.
create or replace view public.nfe_config_publica
with (security_invoker = true)
as
select
  c.id,
  c.organization_id,
  c.habilitado,
  c.ambiente,
  c.razao_social,
  c.nome_fantasia,
  c.cnpj,
  c.inscricao_estadual,
  c.inscricao_municipal,
  c.regime_tributario,
  c.logradouro,
  c.numero,
  c.complemento,
  c.bairro,
  c.municipio,
  c.codigo_municipio,
  c.uf,
  c.cep,
  c.telefone,
  c.serie,
  c.proximo_numero,
  c.natureza_operacao,
  c.informacoes_complementares,
  c.nfse_habilitado,
  c.nfse_item_lista_servico,
  c.nfse_codigo_tributario_municipio,
  c.nfse_codigo_cnae,
  c.nfse_aliquota,
  c.nfse_iss_retido,
  c.nfse_natureza_operacao,
  c.nfse_discriminacao_padrao,
  c.nfse_codigo_nbs,
  c.nfse_codigo_indop,
  c.nfse_ibs_cbs_class_trib,
  c.nfse_ibs_cbs_cst,
  c.mei,
  c.nfse_padrao,
  c.token_ultimos4_hom,
  c.token_ultimos4_prod,
  (c.focus_token_hom_secret_id is not null) as token_hom_configurado,
  (c.focus_token_prod_secret_id is not null) as token_prod_configurado,
  c.created_at,
  c.updated_at
from public.nfe_config c;

comment on view public.nfe_config_publica is
  'Configuracao fiscal da organizacao sem os tokens da Focus NFe (esses ficam no Vault e so o service_role le). Somente leitura, para as telas.';

revoke all on public.nfe_config_publica from public;
revoke all on public.nfe_config_publica from anon;
grant select on public.nfe_config_publica to authenticated;
grant select on public.nfe_config_publica to service_role;

-- ----------------------------------------------------------------------------
-- 2) Gravacao do token no Vault
-- ----------------------------------------------------------------------------
-- Chamada apenas pela Edge Function nfe-token, que roda com o service_role e
-- valida o token na Focus antes de gravar. Nunca devolve o token.
create or replace function public.salvar_focus_token(
  _org uuid,
  _ambiente text,
  _token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  _token_limpo text := btrim(coalesce(_token, ''));
  _nome text;
  _descricao text;
  _secret_id uuid;
  _ultimos4 text;
begin
  if _org is null then
    raise exception 'Organizacao obrigatoria.';
  end if;
  if _ambiente not in ('homologacao', 'producao') then
    raise exception 'Ambiente invalido: %', coalesce(_ambiente, '(nulo)');
  end if;
  if length(_token_limpo) < 8 or length(_token_limpo) > 400 then
    raise exception 'Token com tamanho invalido.';
  end if;

  -- Linha de configuracao precisa existir antes de apontar o secret.
  insert into public.nfe_config (organization_id, ambiente)
  values (_org, _ambiente)
  on conflict (organization_id) do nothing;

  -- Mesmo padrao dos secrets que ja existem no Vault (criados em 2026-11-11).
  _nome := 'focus_nfe_token_'
        || case when _ambiente = 'producao' then 'prod' else 'hom' end
        || '_' || _org::text;
  _descricao := 'Token Focus NFe (' || _ambiente || ') da organizacao ' || _org::text;
  _ultimos4 := right(_token_limpo, 4);

  if _ambiente = 'producao' then
    select c.focus_token_prod_secret_id into _secret_id
      from public.nfe_config c where c.organization_id = _org;
  else
    select c.focus_token_hom_secret_id into _secret_id
      from public.nfe_config c where c.organization_id = _org;
  end if;

  if _secret_id is null then
    _secret_id := vault.create_secret(_token_limpo, _nome, _descricao);
  else
    perform vault.update_secret(_secret_id, _token_limpo, _nome, _descricao);
  end if;

  if _ambiente = 'producao' then
    update public.nfe_config
       set focus_token_prod_secret_id = _secret_id,
           token_ultimos4_prod = _ultimos4
     where organization_id = _org;
  else
    update public.nfe_config
       set focus_token_hom_secret_id = _secret_id,
           token_ultimos4_hom = _ultimos4
     where organization_id = _org;
  end if;

  return jsonb_build_object(
    'organization_id', _org,
    'ambiente', _ambiente,
    'secret_id', _secret_id,
    'ultimos4', _ultimos4);
end
$function$;

comment on function public.salvar_focus_token(uuid, text, text) is
  'Grava o token da Focus NFe no Vault e atualiza os ponteiros em nfe_config. Chamada apenas pela Edge Function nfe-token (service_role). Nunca devolve o token.';

revoke all on function public.salvar_focus_token(uuid, text, text) from public;
revoke all on function public.salvar_focus_token(uuid, text, text) from anon;
revoke all on function public.salvar_focus_token(uuid, text, text) from authenticated;
grant execute on function public.salvar_focus_token(uuid, text, text) to service_role;

-- ============================================================================
-- PASSOS FUTUROS (NAO EXECUTAR AGORA) - so depois de 7 dias sem uso do caminho
-- antigo (colunas de texto puro), conforme combinado.
-- ============================================================================
-- a) Limpar as copias em texto puro dos tokens:
--      update public.nfe_config
--         set focus_token_homologacao = null,
--             focus_token_producao = null;
--    (exige sua aprovacao: e UPDATE em tabela fiscal)
--    ATENCAO: nfe_config tem o trigger trg_audit (audit_row). Esse UPDATE grava os
--    valores antigos - ou seja, o token em texto puro - na tabela audit_trail, na
--    coluna jsonb "antes". Antes de rodar, decidir: rodar com o trigger desligado
--    ou apagar/anonimizar a linha resultante. Nao executar sem essa decisao.
--
-- b) Remover as colunas antigas:
--      alter table public.nfe_config
--        drop column focus_token_homologacao,
--        drop column focus_token_producao;
--    (exige sua aprovacao: ALTER que remove coluna)
--    Antes disso, tirar o fallback legado de supabase/functions/_shared/focus-nfe.ts
--    e migrar src/pages/NovaNfse.tsx para a view, senao o select("*") daquela tela
--    quebra.
--
-- c) Avaliar a tabela nfe_config_backup_20261111 (copia de 2026-11-11, RLS sem
--    policy, provavelmente com os tokens em texto).
--
-- d) Revogar EXECUTE de public.os_commission_calc(uuid) e
--    public.os_commission_core(uuid, boolean) de PUBLIC e anon.
-- ============================================================================
