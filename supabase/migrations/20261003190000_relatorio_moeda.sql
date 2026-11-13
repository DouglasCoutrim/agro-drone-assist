-- =====================================================================
-- RELATORIO GENERICO: coluna de dinheiro e tipo "moeda" (com R$)
-- Arquivo: supabase/migrations/20261003190000_relatorio_moeda.sql
-- Estado: APLICADA no projeto Supabase.
--
-- Problema corrigido:
-- O catalogo marcava como "numero" tanto valor financeiro quanto quantidade.
-- A tela nao tinha como saber a diferenca, entao Vendas saia com "3049.44" no
-- lugar de "R$ 3.049,44" -- e a regra do sistema e que todo campo de valor
-- financeiro aparece com R$ em tela, CSV e PDF.
--
-- Decisao (tipos do catalogo):
--   moeda  -> valor financeiro: formatado com R$ na tela, no CSV e no PDF
--   numero -> contagem/quantidade: continua numero puro
-- Ficaram como "numero" somente movimentacoes_estoque.quantidade,
-- itens_estoque.quantidade e itens_estoque.estoque_minimo.
--
-- O tipo tambem manda na comparacao do filtro: o ramo `_tipo in
-- ('numero','moeda')` de gerar_relatorio compara como numero. Sem ele, uma
-- coluna "moeda" cairia no ramo de texto e um filtro ">= 500" compararia
-- '1000' com '500' como palavra (17 registros em vez de 20, medido nas vendas
-- da organizacao de teste).
--
-- Nada mais foi alterado: a lista de colunas e de filtros de cada fonte segue
-- igual, apenas com o tipo corrigido.
-- =====================================================================

-- 1) Catalogo: colunas de dinheiro passam de 'numero' para 'moeda',
--    preservando a ordem original das colunas de cada fonte.
update public.relatorio_fontes f
   set colunas = sub.novo
  from (
    select ff.id,
           jsonb_agg(
             case when c->>'nome' = any(m.moedas)
                  then jsonb_set(c, '{tipo}', to_jsonb('moeda'::text))
                  else c
             end order by ord
           ) as novo
      from public.relatorio_fontes ff
      cross join lateral jsonb_array_elements(ff.colunas) with ordinality as t(c, ord)
      join (values
        ('ordens_servico',      array['valor_orcamento','valor_final','desconto']),
        ('vendas',              array['valor_produtos','valor_desconto','valor_impostos','valor_total']),
        ('itens_estoque',       array['preco_venda']),
        ('financeiro',          array['valor']),
        ('nota_fiscal_emitida', array['valor_total','valor_impostos','valor_liquido'])
      ) as m(id, moedas) on m.id = ff.id
     group by ff.id
  ) sub
 where f.id = sub.id;

-- 2) gerar_relatorio: unica diferenca em relacao a 20261003180000 e a linha
--    do ramo numerico, que passou a aceitar 'moeda' junto de 'numero'.
create or replace function public.gerar_relatorio(
  _fonte text,
  _colunas text[],
  _filtros jsonb default '[]'::jsonb,
  _data_inicio date default null,
  _data_fim date default null,
  _limite integer default 5000
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  _cfg public.relatorio_fontes%rowtype;
  _permitido boolean;
  _col jsonb;
  _meta jsonb := '[]'::jsonb;
  _selecionadas text[] := '{}';
  _select text;
  _where text;
  _order text;
  _filtro jsonb;
  _campo text;
  _operador text;
  _valor text;
  _tipo text;
  _tipo_data text;
  _lim integer;
  _linhas jsonb;
  _total integer;
  _sql text;
begin
  select * into _cfg from public.relatorio_fontes where id = _fonte;
  if not found then
    raise exception 'Acesso negado a esta fonte';
  end if;

  select exists (
    select 1 from unnest(_cfg.perfis) as perfil
    where public.has_role(auth.uid(), perfil::public.app_role)
  ) into _permitido;
  if not _permitido then
    raise exception 'Acesso negado a esta fonte';
  end if;

  if _colunas is null or coalesce(array_length(_colunas, 1), 0) = 0 then
    raise exception 'Selecione ao menos uma coluna';
  end if;

  -- Colunas: cada uma e validada contra o catalogo; nada vem do navegador sem conferencia.
  foreach _campo in array _colunas loop
    select item into _col
      from jsonb_array_elements(_cfg.colunas) as item
     where item->>'nome' = _campo;
    if _col is null then
      raise exception 'Coluna inválida';
    end if;
    _selecionadas := _selecionadas || _campo;
    _meta := _meta || jsonb_build_array(_col);
  end loop;

  select string_agg(format('%I', nome), ', ') into _select
    from unnest(_selecionadas) as nome;

  -- A organizacao vem sempre de get_user_org_id(), nunca do parametro.
  _where := format('%I = public.get_user_org_id(auth.uid())', _cfg.filtro_org);

  -- Periodo: coluna date compara direto; coluna com hora usa o dia no fuso da empresa.
  if _cfg.coluna_data is not null and (_data_inicio is not null or _data_fim is not null) then
    select c.data_type into _tipo_data
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = _cfg.tabela
       and c.column_name = _cfg.coluna_data;

    if _tipo_data = 'date' then
      if _data_inicio is not null then
        _where := _where || format(' and %I >= %L::date', _cfg.coluna_data, _data_inicio);
      end if;
      if _data_fim is not null then
        _where := _where || format(' and %I <= %L::date', _cfg.coluna_data, _data_fim);
      end if;
    else
      if _data_inicio is not null then
        _where := _where || format(' and (%I at time zone public.business_tz())::date >= %L::date', _cfg.coluna_data, _data_inicio);
      end if;
      if _data_fim is not null then
        _where := _where || format(' and (%I at time zone public.business_tz())::date <= %L::date', _cfg.coluna_data, _data_fim);
      end if;
    end if;
  end if;

  -- Filtros: campo tem de estar em filtros da fonte; operador tem de estar na lista.
  for _filtro in select value from jsonb_array_elements(coalesce(_filtros, '[]'::jsonb)) loop
    _campo := nullif(btrim(coalesce(_filtro->>'campo', '')), '');
    _operador := lower(btrim(coalesce(_filtro->>'operador', '')));
    _valor := _filtro->>'valor';

    if _campo is null or not exists (
      select 1 from jsonb_array_elements_text(_cfg.filtros) as f where f = _campo
    ) then
      raise exception 'Filtro inválido';
    end if;

    if _operador not in ('eq','neq','gt','gte','lt','lte','in','ilike','is_null','not_null') then
      raise exception 'Operador inválido';
    end if;

    select item->>'tipo' into _tipo
      from jsonb_array_elements(_cfg.colunas) as item
     where item->>'nome' = _campo;

    if _operador = 'is_null' then
      _where := _where || format(' and %I is null', _campo);
    elsif _operador = 'not_null' then
      _where := _where || format(' and %I is not null', _campo);
    elsif _operador = 'in' then
      -- valor unico separado por virgula, sempre como texto literal
      _where := _where || format(' and %I::text = any(string_to_array(%L, '',''))', _campo, coalesce(_valor, ''));
    elsif _operador = 'ilike' then
      _where := _where || format(' and %I::text ilike %L', _campo, '%' || coalesce(_valor, '') || '%');
    elsif _tipo in ('numero','moeda') then
      -- Dinheiro e quantidade comparam como numero: 'moeda' existe so para formatar com R$.
      _where := _where || format(' and %I %s %L::numeric', _campo,
        case _operador when 'eq' then '=' when 'neq' then '<>' when 'gt' then '>'
                       when 'gte' then '>=' when 'lt' then '<' else '<=' end,
        coalesce(_valor, '0'));
    elsif _tipo = 'data' then
      _where := _where || format(' and %I %s %L::date', _campo,
        case _operador when 'eq' then '=' when 'neq' then '<>' when 'gt' then '>'
                       when 'gte' then '>=' when 'lt' then '<' else '<=' end,
        coalesce(_valor, ''));
    elsif _tipo = 'booleano' then
      _where := _where || format(' and %I = %L::boolean', _campo, coalesce(_valor, 'false'));
    else
      _where := _where || format(' and %I::text %s %L', _campo,
        case _operador when 'eq' then '=' when 'neq' then '<>' when 'gt' then '>'
                       when 'gte' then '>=' when 'lt' then '<' else '<=' end,
        coalesce(_valor, ''));
    end if;
  end loop;

  _lim := least(greatest(coalesce(_limite, 5000), 1), 10000);
  _order := case when _cfg.coluna_data is not null
                 then format(' order by %I desc', _cfg.coluna_data)
                 else ' order by 1' end;

  -- count(*) over() da o total antes do limite, entao "limitado" tem base real.
  _sql := format(
    'select coalesce(jsonb_agg(to_jsonb(t) - ''_total''), ''[]''::jsonb) as linhas,
            coalesce(max(t._total), 0)::integer as total
       from (select %s, count(*) over() as _total from %I where %s%s limit %s) t',
    _select, _cfg.tabela, _where, _order, _lim);

  execute _sql into _linhas, _total;

  return jsonb_build_object(
    'fonte', _cfg.id,
    'rotulo', _cfg.rotulo,
    'colunas', _meta,
    'linhas', coalesce(_linhas, '[]'::jsonb),
    'total_linhas', coalesce(_total, 0),
    'limitado', coalesce(_total, 0) > _lim
  );
end $$;
