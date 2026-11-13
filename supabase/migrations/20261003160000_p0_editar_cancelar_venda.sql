-- =====================================================================
-- P0 ESTOQUE E VENDA: editar_venda e cancelar_venda com regra unica de linha
-- Arquivo: supabase/migrations/20261003160000_p0_editar_cancelar_venda.sql
-- Estado: APLICADA no projeto Supabase.
--
-- Por que esta migration existe:
-- criar_venda fechou a brecha de preco na CRIACAO da venda, mas updateVenda
-- continuava regravando venda_itens pelo navegador, com preco vindo da tela:
-- quem editava uma venda conseguia exatamente o que a criacao ja bloqueava.
-- O cancelamento tambem era um laco no cliente, item por item; se um item
-- falhasse no meio, a venda ficava parcialmente estornada.
--
-- O que passa a existir:
--   venda_linha_calcular(_organization_id, _linha) -> regra unica de item
--   criar_venda(_payload)                          -> usa a regra unica
--   editar_venda(_venda_id, _payload)              -> mesma regra + estoque
--                                                     reconciliado por diferenca
--   cancelar_venda(_venda_id)                      -> estorno atomico e
--                                                     idempotente
--
-- Regra de linha (venda_linha_calcular), na ordem de precedencia:
--   produto_id  -> itens_estoque: preco, teto de desconto, NCM, CFOP e nome
--                  vem do catalogo; quantidade precisa ser inteira, porque
--                  itens_estoque.quantidade e integer; movimenta estoque.
--   servico_id  -> servicos: preco = GREATEST(preco, valor_fixo, valor_hora)
--                  e teto vem do catalogo; nao movimenta estoque; NCM/CFOP
--                  vem do payload.
--   nenhum dos dois -> linha livre: nome e preco digitados; nao movimenta
--                  estoque.
-- Teto de desconto: 0 (nao configurado) vai ate 100, igual a
-- src/lib/desconto.ts. Ver 20261003150000_p0_desconto_zero_sem_teto.sql.
--
-- Contrato de editar_venda: campo ausente no payload fica como estava
-- (o front sempre envia os campos que edita). `itens` so substitui os itens
-- quando vem como array; sem ele, a venda e atualizada sem tocar em itens nem
-- em totais. Numero, nf_* e vendido_por nunca sao alterados aqui.
--
-- ajustar_estoque passou a recusar delta fracionado em vez de arredondar em
-- silencio. Chamadores existentes: criar_venda, editar_venda e cancelar_venda
-- (todos com quantidade inteira validada) -- nao havia outro no banco.
-- =====================================================================


-- ---------------------------------------------------------------------
-- A) Regra unica de item de venda
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.venda_linha_calcular(_organization_id uuid, _linha jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _produto_id uuid := NULLIF(_linha->>'produto_id', '')::uuid;
  _servico_id uuid := NULLIF(_linha->>'servico_id', '')::uuid;
  _quantidade numeric := COALESCE((_linha->>'quantidade')::numeric, 0);
  _percentual numeric := COALESCE((_linha->>'desconto_percentual')::numeric, 0);
  _preco numeric;
  _cap numeric;
  _teto numeric;
  _nome text;
  _ncm text;
  _cfop text;
  _bruto numeric;
  _desconto numeric;
BEGIN
  IF _quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida.';
  END IF;
  IF _percentual < 0 THEN
    RAISE EXCEPTION 'Desconto inválido.';
  END IF;

  IF _produto_id IS NOT NULL THEN
    IF _quantidade <> trunc(_quantidade) THEN
      RAISE EXCEPTION 'Quantidade fracionada não é permitida para itens de estoque.';
    END IF;
    SELECT COALESCE(preco_venda, 0), COALESCE(desconto_maximo_percentual, 0), descricao, ncm, cfop
      INTO _preco, _cap, _nome, _ncm, _cfop
      FROM itens_estoque
     WHERE id = _produto_id
       AND organization_id = _organization_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item do catálogo não encontrado nesta organização.';
    END IF;
  ELSIF _servico_id IS NOT NULL THEN
    SELECT GREATEST(COALESCE(preco, 0), COALESCE(valor_fixo, 0), COALESCE(valor_hora, 0)),
           COALESCE(desconto_maximo_percentual, 0),
           descricao
      INTO _preco, _cap, _nome
      FROM servicos
     WHERE id = _servico_id
       AND organization_id = _organization_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item do catálogo não encontrado nesta organização.';
    END IF;
    _ncm := NULLIF(_linha->>'ncm', '');
    _cfop := NULLIF(_linha->>'cfop', '');
  ELSE
    _nome := NULLIF(btrim(COALESCE(_linha->>'nome_produto', '')), '');
    IF _nome IS NULL THEN
      RAISE EXCEPTION 'Informe o nome do item.';
    END IF;
    _preco := COALESCE((_linha->>'preco_unitario')::numeric, 0);
    IF _preco < 0 THEN
      RAISE EXCEPTION 'Preço inválido.';
    END IF;
    _cap := 0;
    _ncm := NULLIF(_linha->>'ncm', '');
    _cfop := NULLIF(_linha->>'cfop', '');
  END IF;

  _teto := CASE WHEN COALESCE(_cap, 0) <= 0 THEN 100 ELSE LEAST(_cap, 100) END;
  IF _percentual > _teto THEN
    RAISE EXCEPTION 'Desconto acima do máximo permitido para o item.';
  END IF;

  _bruto := _preco * _quantidade;
  _desconto := round(_bruto * _percentual / 100, 2);

  RETURN jsonb_build_object(
    'produto_id', _produto_id,
    'servico_id', _servico_id,
    'nome_produto', _nome,
    'ncm', _ncm,
    'cfop', _cfop,
    'quantidade', _quantidade,
    'preco_unitario', _preco,
    'desconto_percentual', _percentual,
    'desconto_valor', _desconto,
    'desconto_maximo_percentual', COALESCE(_cap, 0),
    'valor_bruto', _bruto,
    'valor_total', _bruto - _desconto,
    'movimenta_estoque', _produto_id IS NOT NULL
  );
END $$;


-- ---------------------------------------------------------------------
-- B) criar_venda sobre a regra unica (mesmo comportamento de antes)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_venda(_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _org uuid := public.get_user_org_id(auth.uid());
  _numero text;
  _venda_id uuid;
  _item jsonb;
  _linha jsonb;
  _produto_id uuid;
  _quantidade numeric;
  _ultimo_numero text;
  _sequencia integer;
  _total_produtos numeric := 0;
  _total_descontos numeric := 0;
BEGIN
  IF _org IS NULL THEN
    RAISE EXCEPTION 'Usuário sem organização';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(_org::text));

  SELECT numero INTO _ultimo_numero
    FROM vendas
   WHERE organization_id = _org
   ORDER BY numero DESC
   LIMIT 1;

  _sequencia := COALESCE(
    NULLIF(regexp_replace(COALESCE(_ultimo_numero, ''), '\D', '', 'g'), '')::integer,
    0
  ) + 1;
  _numero := 'VND-' || lpad(_sequencia::text, 5, '0');

  INSERT INTO vendas (
    numero, organization_id, cliente_id, cliente_nome, cliente_cpf_cnpj,
    cliente_email, data_venda, forma_pagamento, status_pagamento,
    valor_produtos, valor_desconto, valor_total, obs, ambiente, nfe_dados,
    vendido_por
  )
  VALUES (
    _numero,
    _org,
    NULLIF(_payload->>'cliente_id', '')::uuid,
    COALESCE(NULLIF(_payload->>'cliente_nome', ''), 'Consumidor'),
    NULLIF(_payload->>'cliente_cpf_cnpj', ''),
    NULLIF(_payload->>'cliente_email', ''),
    COALESCE(NULLIF(_payload->>'data_venda', '')::date, CURRENT_DATE),
    NULLIF(_payload->>'forma_pagamento', ''),
    COALESCE(NULLIF(_payload->>'status_pagamento', ''), 'pendente'),
    0,
    0,
    0,
    NULLIF(_payload->>'obs', ''),
    COALESCE(NULLIF(_payload->>'ambiente', ''), 'producao'),
    COALESCE(_payload->'nfe_dados', '{}'::jsonb),
    auth.uid()
  )
  RETURNING id INTO _venda_id;

  FOR _item IN
    SELECT value FROM jsonb_array_elements(COALESCE(_payload->'itens', '[]'::jsonb))
  LOOP
    _linha := public.venda_linha_calcular(_org, _item);
    _produto_id := (_linha->>'produto_id')::uuid;
    _quantidade := (_linha->>'quantidade')::numeric;

    INSERT INTO venda_itens (
      venda_id, produto_id, nome_produto, ncm, cfop, quantidade,
      preco_unitario, desconto_percentual, desconto_valor,
      desconto_maximo_percentual, valor_total, quantidade_devolvida
    )
    VALUES (
      _venda_id, _produto_id, _linha->>'nome_produto', _linha->>'ncm', _linha->>'cfop', _quantidade,
      (_linha->>'preco_unitario')::numeric, (_linha->>'desconto_percentual')::numeric,
      (_linha->>'desconto_valor')::numeric, (_linha->>'desconto_maximo_percentual')::numeric,
      (_linha->>'valor_total')::numeric, 0
    );

    IF (_linha->>'movimenta_estoque')::boolean THEN
      PERFORM public.ajustar_estoque(_produto_id, -_quantidade, 'venda', 'venda', _venda_id);
    END IF;

    _total_produtos := _total_produtos + (_linha->>'valor_bruto')::numeric;
    _total_descontos := _total_descontos + (_linha->>'desconto_valor')::numeric;
  END LOOP;

  UPDATE vendas
     SET valor_produtos = _total_produtos,
         valor_desconto = _total_descontos,
         valor_total = _total_produtos - _total_descontos
   WHERE id = _venda_id;

  RETURN _venda_id;
END $$;


-- ---------------------------------------------------------------------
-- C) editar_venda
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.editar_venda(_venda_id uuid, _payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _org uuid := public.get_user_org_id(auth.uid());
  _numero text;
  _status text;
  _tem_itens boolean;
  _item jsonb;
  _linha jsonb;
  _produto_id uuid;
  _quantidade numeric;
  _old record;
  _dif record;
  _mov jsonb;
  _total_produtos numeric := 0;
  _total_descontos numeric := 0;
BEGIN
  IF _org IS NULL THEN
    RAISE EXCEPTION 'Usuário sem organização';
  END IF;

  SELECT numero, status_pagamento INTO _numero, _status
    FROM vendas
   WHERE id = _venda_id
     AND organization_id = _org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada nesta organização.';
  END IF;
  IF _status = 'cancelado' THEN
    RAISE EXCEPTION 'Venda cancelada não pode ser editada.';
  END IF;

  UPDATE vendas SET
    cliente_id       = CASE WHEN _payload->'cliente_id' IS NOT NULL THEN NULLIF(_payload->>'cliente_id','')::uuid ELSE cliente_id END,
    cliente_nome     = CASE WHEN _payload->'cliente_nome' IS NOT NULL THEN COALESCE(NULLIF(_payload->>'cliente_nome',''),'Consumidor') ELSE cliente_nome END,
    cliente_cpf_cnpj = CASE WHEN _payload->'cliente_cpf_cnpj' IS NOT NULL THEN NULLIF(_payload->>'cliente_cpf_cnpj','') ELSE cliente_cpf_cnpj END,
    cliente_email    = CASE WHEN _payload->'cliente_email' IS NOT NULL THEN NULLIF(_payload->>'cliente_email','') ELSE cliente_email END,
    data_venda       = CASE WHEN _payload->'data_venda' IS NOT NULL THEN COALESCE(NULLIF(_payload->>'data_venda','')::date, CURRENT_DATE) ELSE data_venda END,
    forma_pagamento  = CASE WHEN _payload->'forma_pagamento' IS NOT NULL THEN NULLIF(_payload->>'forma_pagamento','') ELSE forma_pagamento END,
    status_pagamento = CASE WHEN _payload->'status_pagamento' IS NOT NULL THEN COALESCE(NULLIF(_payload->>'status_pagamento',''),'pendente') ELSE status_pagamento END,
    obs              = CASE WHEN _payload->'obs' IS NOT NULL THEN NULLIF(_payload->>'obs','') ELSE obs END,
    ambiente         = CASE WHEN _payload->'ambiente' IS NOT NULL THEN COALESCE(NULLIF(_payload->>'ambiente',''),'producao') ELSE ambiente END,
    nfe_dados        = CASE WHEN _payload->'nfe_dados' IS NOT NULL THEN COALESCE(_payload->'nfe_dados','{}'::jsonb) ELSE nfe_dados END,
    atualizado_em    = now()
  WHERE id = _venda_id;

  _tem_itens := jsonb_typeof(_payload->'itens') = 'array';

  IF _tem_itens THEN
    -- Quanto o estoque deve receber de volta pelos itens gravados agora.
    _mov := '{}'::jsonb;
    FOR _old IN SELECT produto_id, quantidade FROM venda_itens WHERE venda_id = _venda_id AND produto_id IS NOT NULL LOOP
      _mov := jsonb_set(
        _mov,
        ARRAY[_old.produto_id::text],
        to_jsonb(COALESCE((_mov->>_old.produto_id::text)::numeric, 0) + COALESCE(_old.quantidade, 0))
      );
    END LOOP;

    DELETE FROM venda_itens WHERE venda_id = _venda_id;

    FOR _item IN SELECT value FROM jsonb_array_elements(_payload->'itens') LOOP
      _linha := public.venda_linha_calcular(_org, _item);
      _produto_id := (_linha->>'produto_id')::uuid;
      _quantidade := (_linha->>'quantidade')::numeric;

      INSERT INTO venda_itens (
        venda_id, produto_id, nome_produto, ncm, cfop, quantidade,
        preco_unitario, desconto_percentual, desconto_valor,
        desconto_maximo_percentual, valor_total, quantidade_devolvida
      )
      VALUES (
        _venda_id, _produto_id, _linha->>'nome_produto', _linha->>'ncm', _linha->>'cfop', _quantidade,
        (_linha->>'preco_unitario')::numeric, (_linha->>'desconto_percentual')::numeric,
        (_linha->>'desconto_valor')::numeric, (_linha->>'desconto_maximo_percentual')::numeric,
        (_linha->>'valor_total')::numeric, 0
      );

      IF (_linha->>'movimenta_estoque')::boolean THEN
        _mov := jsonb_set(
          _mov,
          ARRAY[_produto_id::text],
          to_jsonb(COALESCE((_mov->>_produto_id::text)::numeric, 0) - _quantidade)
        );
      END IF;

      _total_produtos := _total_produtos + (_linha->>'valor_bruto')::numeric;
      _total_descontos := _total_descontos + (_linha->>'desconto_valor')::numeric;
    END LOOP;

    -- Aplica so a diferenca: um movimento por item cuja quantidade mudou.
    FOR _dif IN SELECT key AS pid, value::numeric AS delta FROM jsonb_each_text(_mov) LOOP
      IF _dif.delta <> 0 THEN
        PERFORM public.ajustar_estoque(_dif.pid::uuid, _dif.delta, 'Edição da venda ' || _numero, 'ajuste', _venda_id);
      END IF;
    END LOOP;

    UPDATE vendas
       SET valor_produtos = _total_produtos,
           valor_desconto = _total_descontos,
           valor_total = _total_produtos - _total_descontos
     WHERE id = _venda_id;
  END IF;

  RETURN _venda_id;
END $$;


-- ---------------------------------------------------------------------
-- D) cancelar_venda
-- ---------------------------------------------------------------------
-- Idempotente: a segunda chamada na mesma venda falha em vez de estornar o
-- estoque duas vezes.
CREATE OR REPLACE FUNCTION public.cancelar_venda(_venda_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _org uuid := public.get_user_org_id(auth.uid());
  _numero text;
  _status text;
  _it record;
BEGIN
  IF _org IS NULL THEN
    RAISE EXCEPTION 'Usuário sem organização';
  END IF;

  SELECT numero, status_pagamento INTO _numero, _status
    FROM vendas
   WHERE id = _venda_id
     AND organization_id = _org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada nesta organização.';
  END IF;
  IF _status = 'cancelado' THEN
    RAISE EXCEPTION 'Venda já cancelada.';
  END IF;

  FOR _it IN SELECT produto_id, quantidade FROM venda_itens WHERE venda_id = _venda_id AND produto_id IS NOT NULL LOOP
    IF COALESCE(_it.quantidade, 0) > 0 THEN
      PERFORM public.ajustar_estoque(
        _it.produto_id,
        _it.quantidade,
        'Cancelamento da venda ' || _numero,
        'cancelamento',
        _venda_id
      );
    END IF;
  END LOOP;

  UPDATE vendas
     SET status_pagamento = 'cancelado',
         atualizado_em = now()
   WHERE id = _venda_id;

  RETURN _venda_id;
END $$;


-- ---------------------------------------------------------------------
-- E) ajustar_estoque recusa fracao
-- ---------------------------------------------------------------------
-- Mesmo corpo de 20261003130000, com a trava de fracao. itens_estoque.quantidade
-- e integer: aceitar fracao significava arredondar em silencio.
CREATE OR REPLACE FUNCTION public.ajustar_estoque(
  _item_id uuid,
  _delta numeric,
  _motivo text,
  _origem_tipo text,
  _origem_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _org_do_usuario uuid := public.get_user_org_id(auth.uid());
  _org_do_item uuid;
  _novo_saldo numeric;
BEGIN
  SELECT organization_id INTO _org_do_item
    FROM itens_estoque
   WHERE id = _item_id;

  IF _org_do_item IS DISTINCT FROM _org_do_usuario THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;

  IF _delta <> trunc(_delta) THEN
    RAISE EXCEPTION 'Quantidade de estoque precisa ser um número inteiro.';
  END IF;

  UPDATE itens_estoque
     SET quantidade = quantidade + _delta
   WHERE id = _item_id
   RETURNING quantidade INTO _novo_saldo;

  IF _novo_saldo < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente';
  END IF;

  IF _delta <> 0 THEN
    INSERT INTO movimentacoes_estoque (
      item_id, organization_id, tipo, quantidade, motivo, usuario_id, ordem_servico_id
    )
    VALUES (
      _item_id,
      _org_do_item,
      CASE WHEN _delta < 0 THEN 'saida' ELSE 'entrada' END,
      abs(_delta),
      _motivo,
      auth.uid(),
      CASE WHEN _origem_tipo = 'ordem_servico' THEN _origem_id ELSE NULL END
    );
  END IF;

  RETURN _novo_saldo;
END;
$$;
