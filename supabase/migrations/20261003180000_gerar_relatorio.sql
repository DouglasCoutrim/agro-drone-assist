-- =====================================================================
-- RELATORIO GENERICO FASE 1: funcao gerar_relatorio
-- Arquivo: supabase/migrations/20261003180000_gerar_relatorio.sql
-- Estado: APLICADA no projeto Supabase.
--
-- Por que esta migration existe:
-- A tela precisa de um relatorio montado sob demanda. Toda a decisao de
-- quais tabelas, colunas e filtros existem fica no catalogo
-- public.relatorio_fontes; o navegador envia apenas:
--   _fonte       -> id da fonte no catalogo
--   _colunas     -> chaves de coluna (conferidas contra o catalogo)
--   _filtros     -> jsonb [{campo, operador, valor}] (tambem conferidos)
--   _data_inicio / _data_fim -> periodo (opcional)
--   _limite      -> linhas desejadas
-- Nome de tabela e de coluna NUNCA vem do navegador: sao lidos do catalogo
-- e interpolados com format('%I'), e os valores com format('%L').
--
-- Garantias da funcao:
--   - SECURITY INVOKER: quem chama continua sujeito a RLS das tabelas de
--     origem, somando-se ao filtro de organizacao abaixo.
--   - filtro_org sempre por public.get_user_org_id(auth.uid()): a
--     organizacao nunca e parametro.
--   - perfil: a fonte so responde se o usuario tiver um dos app_role em
--     relatorio_fontes.perfis; caso contrario 'Acesso negado a esta fonte'
--     (mesma mensagem de fonte inexistente, para nao revelar o catalogo).
--   - coluna fora do catalogo          -> 'Coluna inválida'
--   - filtro em coluna nao permitida   -> 'Filtro inválido'
--   - operador fora da lista permitida  -> 'Operador inválido'
--     (lista: eq, neq, gt, gte, lt, lte, in, ilike, is_null, not_null)
--   - limite: 1 a 10000; o total e contado com count(*) over() antes do
--     limite, entao 'limitado' informa se a tela esta vendo so uma parte.
--   - periodo: coluna date compara direto; coluna com hora (timestamptz)
--     e convertida para o dia no fuso da empresa com public.business_tz(),
--     para um registro das 21h de Brasilia nao cair no dia seguinte.
--   - retorno: {fonte, rotulo, colunas, linhas, total_linhas, limitado},
--     com as linhas ja nomeadas pelas colunas pedidas.
--
-- Fase 1 nao faz join: colunas de id aparecem como id (ex.: item_id).
-- =====================================================================

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
    elsif _tipo = 'numero' then
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
