-- =====================================================================
-- 0027 — Configuração fiscal sem tokens: view pública + token no Vault
--
-- Contexto: as telas liam `public.nfe_config` direto, incluindo as colunas de
-- token da Focus NFe em texto puro (`focus_token_homologacao`,
-- `focus_token_producao`) e os ponteiros dos secrets. O front passou a ler a
-- view `nfe_config_publica` e a gravar token pela Edge Function `nfe-token`,
-- que valida na Focus antes de gravar no Vault.
--
-- A view:
--   * expõe todas as colunas fiscais MENOS as quatro de segredo;
--   * acrescenta `token_ultimos4_hom`, `token_ultimos4_prod` (só os 4 últimos
--     dígitos, para a tela confirmar qual token está ativo) e os booleanos
--     `token_hom_configurado` / `token_prod_configurado`;
--   * usa `security_invoker = true`, então roda com os privilégios de quem
--     consulta e a RLS de `nfe_config` continua valendo. Sem isso a view rodaria
--     como o dono e ignoraria a RLS;
--   * é somente leitura na prática: as duas colunas derivadas tornam a view não
--     atualizável, mas mesmo assim o GRANT é só de SELECT.
--
-- A função `salvar_focus_token`:
--   * `SECURITY DEFINER`, com `search_path = ''`;
--   * grava o token no Vault (`vault.create_secret` / `vault.update_secret`),
--     no mesmo padrão de nome dos secrets criados em 2026-11-11;
--   * devolve apenas organização, ambiente, id do secret e os 4 últimos dígitos
--     — nunca o token;
--   * tem EXECUTE só para `service_role`. A Edge Function `nfe-token` é quem a
--     chama, depois de conferir o JWT e exigir papel `admin`.
--
-- Aplicado em produção em 2026-11-22. Nada aqui apaga dado: as colunas de token
-- em texto puro continuam na tabela e serão limpas em passo separado.
-- =====================================================================

CREATE OR REPLACE VIEW public.nfe_config_publica
WITH (security_invoker = true)
AS
SELECT
  c.id, c.organization_id, c.habilitado, c.ambiente, c.razao_social, c.nome_fantasia,
  c.cnpj, c.inscricao_estadual, c.inscricao_municipal, c.regime_tributario,
  c.logradouro, c.numero, c.complemento, c.bairro, c.municipio, c.codigo_municipio,
  c.uf, c.cep, c.telefone, c.serie, c.proximo_numero, c.natureza_operacao,
  c.informacoes_complementares, c.nfse_habilitado, c.nfse_item_lista_servico,
  c.nfse_codigo_tributario_municipio, c.nfse_codigo_cnae, c.nfse_aliquota,
  c.nfse_iss_retido, c.nfse_natureza_operacao, c.nfse_discriminacao_padrao,
  c.nfse_codigo_nbs, c.nfse_codigo_indop, c.nfse_ibs_cbs_class_trib,
  c.nfse_ibs_cbs_cst, c.mei, c.nfse_padrao, c.token_ultimos4_hom,
  c.token_ultimos4_prod,
  (c.focus_token_hom_secret_id IS NOT NULL) AS token_hom_configurado,
  (c.focus_token_prod_secret_id IS NOT NULL) AS token_prod_configurado,
  c.created_at, c.updated_at
FROM public.nfe_config c;

COMMENT ON VIEW public.nfe_config_publica IS
  'Configuracao fiscal da organizacao sem os tokens da Focus NFe (esses ficam no Vault e so o service_role le). Somente leitura, para as telas.';

REVOKE ALL ON public.nfe_config_publica FROM public;
REVOKE ALL ON public.nfe_config_publica FROM anon;
GRANT SELECT ON public.nfe_config_publica TO authenticated;
GRANT SELECT ON public.nfe_config_publica TO service_role;

CREATE OR REPLACE FUNCTION public.salvar_focus_token(
  _org uuid,
  _ambiente text,
  _token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  _token_limpo text := btrim(coalesce(_token, ''));
  _nome text;
  _descricao text;
  _secret_id uuid;
  _ultimos4 text;
BEGIN
  IF _org IS NULL THEN
    RAISE EXCEPTION 'Organizacao obrigatoria.';
  END IF;
  IF _ambiente NOT IN ('homologacao', 'producao') THEN
    RAISE EXCEPTION 'Ambiente invalido: %', coalesce(_ambiente, '(nulo)');
  END IF;
  IF length(_token_limpo) < 8 OR length(_token_limpo) > 400 THEN
    RAISE EXCEPTION 'Token com tamanho invalido.';
  END IF;

  -- Linha de configuracao precisa existir antes de apontar o secret.
  INSERT INTO public.nfe_config (organization_id, ambiente)
  VALUES (_org, _ambiente)
  ON CONFLICT (organization_id) DO NOTHING;

  _nome := 'focus_nfe_token_'
        || CASE WHEN _ambiente = 'producao' THEN 'prod' ELSE 'hom' END
        || '_' || _org::text;
  _descricao := 'Token Focus NFe (' || _ambiente || ') da organizacao ' || _org::text;
  _ultimos4 := right(_token_limpo, 4);

  IF _ambiente = 'producao' THEN
    SELECT c.focus_token_prod_secret_id INTO _secret_id
      FROM public.nfe_config c WHERE c.organization_id = _org;
  ELSE
    SELECT c.focus_token_hom_secret_id INTO _secret_id
      FROM public.nfe_config c WHERE c.organization_id = _org;
  END IF;

  IF _secret_id IS NULL THEN
    _secret_id := vault.create_secret(_token_limpo, _nome, _descricao);
  ELSE
    PERFORM vault.update_secret(_secret_id, _token_limpo, _nome, _descricao);
  END IF;

  IF _ambiente = 'producao' THEN
    UPDATE public.nfe_config
       SET focus_token_prod_secret_id = _secret_id,
           token_ultimos4_prod = _ultimos4
     WHERE organization_id = _org;
  ELSE
    UPDATE public.nfe_config
       SET focus_token_hom_secret_id = _secret_id,
           token_ultimos4_hom = _ultimos4
     WHERE organization_id = _org;
  END IF;

  RETURN jsonb_build_object(
    'organization_id', _org,
    'ambiente', _ambiente,
    'secret_id', _secret_id,
    'ultimos4', _ultimos4);
END
$function$;

COMMENT ON FUNCTION public.salvar_focus_token(uuid, text, text) IS
  'Grava o token da Focus NFe no Vault e atualiza os ponteiros em nfe_config. Chamada apenas pela Edge Function nfe-token (service_role). Nunca devolve o token.';

REVOKE ALL ON FUNCTION public.salvar_focus_token(uuid, text, text) FROM public;
REVOKE ALL ON FUNCTION public.salvar_focus_token(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.salvar_focus_token(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_focus_token(uuid, text, text) TO service_role;
