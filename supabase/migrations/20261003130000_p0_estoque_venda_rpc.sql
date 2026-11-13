-- =====================================================================
-- P0 ESTOQUE E VENDA: funcoes de servidor
-- Arquivo: supabase/migrations/20261003130000_p0_estoque_venda_rpc.sql
-- Objetivo: tirar do navegador o calculo de saldo e a gravacao de venda.
--           Passa a existir um unico caminho de escrita para estoque
--           (ajustar_estoque) e para venda (criar_venda), com saldo
--           recalculado dentro do UPDATE e preco vindo do catalogo.
--
-- Estado: APLICADA no projeto Supabase (funcoes criadas e conferidas em
--           pg_proc). Somente as secoes A e B estao ativas; B.1, C e D
--           continuam comentadas.
-- Impacto no app atual: nenhum. Sao funcoes novas, com nomes novos, e
--           nenhum codigo do app as chama ainda. O fluxo antigo
--           (src/hooks/useVendasData.ts) continua exatamente como esta
--           ate que o front seja migrado.
--
-- Fatos conferidos no banco vivo (nao apenas nas migrations):
--   vendas.numero                UNIQUE (organization_id, numero)
--   vendas.cliente_nome          text NOT NULL
--   vendas.data_venda            date NOT NULL DEFAULT CURRENT_DATE
--   vendas.valor_impostos        numeric NOT NULL DEFAULT 0  (nao entra no INSERT)
--   vendas.status_pagamento      text NOT NULL DEFAULT 'pendente'
--   vendas.ambiente              text NOT NULL DEFAULT 'producao' (nao entra no INSERT)
--   venda_itens.produto_id       FK -> itens_estoque(id) ON DELETE SET NULL
--   venda_itens.quantidade       numeric (aceita fracao)
--   venda_itens.quantidade_devolvida numeric NOT NULL DEFAULT 0
--   itens_estoque.quantidade     integer NOT NULL DEFAULT 0
--   movimentacoes_estoque.tipo   text NOT NULL CHECK (tipo IN ('entrada','saida','devolucao_compra'))
--   movimentacoes_estoque.quantidade integer NOT NULL
--   movimentacoes_estoque.usuario_id uuid NOT NULL (exige sessao autenticada)
--   funcao de organizacao        public.get_user_org_id(_user_id uuid)
--
-- Policies que sustentam o modo INVOKER (confirmadas no banco):
--   vendas               INSERT: org = get_user_org_id(auth.uid()) AND is_admin_or_tecnico
--   venda_itens          ALL: venda da mesma org AND (WITH CHECK) is_admin_or_tecnico
--   movimentacoes_estoque INSERT: org = get_user_org_id(auth.uid()) AND is_admin_or_tecnico
--   => admin e tecnico conseguem chamar as funcoes; o papel 'consulta' nao.
--
-- Consequencia do tipo integer em estoque: _delta numeric e convertido para
-- integer na gravacao, ou seja, fracao de unidade em estoque e arredondada.
-- venda_itens.quantidade guarda a fracao, mas itens_estoque.quantidade nao.
-- =====================================================================


-- ---------------------------------------------------------------------
-- A) ajustar_estoque
-- ---------------------------------------------------------------------
-- Ponto unico de alteracao de saldo. O saldo e recalculado dentro do
-- proprio UPDATE (quantidade = quantidade + _delta), sem leitura previa.
-- Retorna o saldo resultante. Saldo negativo aborta a transacao inteira.
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
  -- Organizacao do item lida no banco, nunca do payload.
  SELECT organization_id INTO _org_do_item
    FROM itens_estoque
   WHERE id = _item_id;

  IF _org_do_item IS DISTINCT FROM _org_do_usuario THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;

  -- Atualizacao atomica: sem leitura previa do saldo.
  UPDATE itens_estoque
     SET quantidade = quantidade + _delta
   WHERE id = _item_id
   RETURNING quantidade INTO _novo_saldo;

  IF _novo_saldo < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente';
  END IF;

  -- _delta = 0 nao gera movimentacao.
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


-- ---------------------------------------------------------------------
-- B) criar_venda
-- ---------------------------------------------------------------------
-- A regra de saldo vale para todos os usuarios, inclusive administradores:
-- nao existe excecao de admin nesta funcao.
-- Qualquer erro em qualquer item desfaz a venda inteira, os itens e as
-- movimentacoes, porque tudo roda na mesma transacao da funcao.
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
  _produto_id uuid;
  _quantidade numeric;
  _desconto_percentual numeric;
  _preco_catalogo numeric;
  _desconto_maximo numeric;
  _valor_bruto numeric;
  _desconto_valor numeric;
  _valor_item numeric;
  _total_produtos numeric := 0;
  _total_descontos numeric := 0;
  _ultimo_numero text;
  _sequencia integer;
BEGIN
  -- Organizacao sempre do usuario, nunca do payload.
  IF _org IS NULL THEN
    RAISE EXCEPTION 'Usuário sem organização';
  END IF;

  -- Serializa a geracao do numero por organizacao.
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

  -- valor_impostos nao entra: a coluna tem DEFAULT 0.
  -- Totais entram zerados e sao recalculados no servidor no fim.
  INSERT INTO vendas (
    numero, organization_id, cliente_id, cliente_nome, cliente_cpf_cnpj,
    cliente_email, data_venda, forma_pagamento, status_pagamento,
    valor_produtos, valor_desconto, valor_total, obs, vendido_por
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
    auth.uid()
  )
  RETURNING id INTO _venda_id;

  FOR _item IN
    SELECT value FROM jsonb_array_elements(COALESCE(_payload->'itens', '[]'::jsonb))
  LOOP
    _produto_id := NULLIF(_item->>'produto_id', '')::uuid;

    IF _produto_id IS NULL THEN
      RAISE EXCEPTION 'Item do catálogo não encontrado nesta organização.';
    END IF;

    -- Preco e desconto maximo vem do catalogo, filtrando pela organizacao.
    SELECT preco_venda, desconto_maximo_percentual
      INTO _preco_catalogo, _desconto_maximo
      FROM itens_estoque
     WHERE id = _produto_id
       AND organization_id = _org;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item do catálogo não encontrado nesta organização.';
    END IF;

    _quantidade := COALESCE((_item->>'quantidade')::numeric, 0);

    IF _quantidade <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida.';
    END IF;

    _desconto_percentual := COALESCE((_item->>'desconto_percentual')::numeric, 0);

    IF _desconto_percentual > COALESCE(_desconto_maximo, 0) THEN
      RAISE EXCEPTION 'Desconto acima do máximo permitido para o item.';
    END IF;

    -- preco_unitario enviado pelo navegador e ignorado.
    _valor_bruto := _preco_catalogo * _quantidade;
    _desconto_valor := round(_valor_bruto * _desconto_percentual / 100, 2);
    _valor_item := _valor_bruto - _desconto_valor;

    INSERT INTO venda_itens (
      venda_id, produto_id, nome_produto, quantidade, preco_unitario,
      desconto_percentual, desconto_valor, valor_total, quantidade_devolvida
    )
    VALUES (
      _venda_id,
      _produto_id,
      COALESCE(NULLIF(_item->>'nome_produto', ''), 'Produto'),
      _quantidade,
      _preco_catalogo,
      _desconto_percentual,
      _desconto_valor,
      _valor_item,
      0
    );

    PERFORM public.ajustar_estoque(_produto_id, -_quantidade, 'venda', 'venda', _venda_id);

    _total_produtos := _total_produtos + _valor_bruto;
    _total_descontos := _total_descontos + _desconto_valor;
  END LOOP;

  UPDATE vendas
     SET valor_produtos = _total_produtos,
         valor_desconto = _total_descontos,
         valor_total = _total_produtos - _total_descontos
   WHERE id = _venda_id;

  RETURN _venda_id;
END;
$$;


-- ---------------------------------------------------------------------
-- B.1) Bloco COMENTADO - NAO ATIVO
-- ---------------------------------------------------------------------
-- AGUARDA MIGRATION: ALTER TABLE financeiro ADD COLUMN venda_id uuid REFERENCES vendas(id);
-- e INSERT em financeiro com esse campo.
--
-- Quando a coluna existir, acrescentar dentro de criar_venda(), logo apos o
-- loop dos itens, algo equivalente a:
--   INSERT INTO financeiro (
--     organization_id, venda_id, usuario_id, tipo, categoria,
--     descricao, valor, data_transacao
--   )
--   VALUES (
--     _org, _venda_id, auth.uid(), 'receita', 'Vendas',
--     'Venda ' || _numero, _total_produtos - _total_descontos, CURRENT_DATE
--   );
-- Ate a coluna existir, a venda permanece sem vinculo financeiro.


-- ---------------------------------------------------------------------
-- C) TESTES - COMENTADOS
-- Executar apos o deploy das funcoes, com uuid real de produto da
-- organizacao de teste.
-- ---------------------------------------------------------------------
--
-- C1) Venda com quantidade maior que o saldo: deve falhar, sem venda e sem movimentacao.
-- SELECT public.criar_venda(jsonb_build_object(
--   'cliente_nome', 'Teste saldo insuficiente',
--   'itens', jsonb_build_array(jsonb_build_object(
--     'produto_id', '<uuid-do-produto>',
--     'nome_produto', 'Item de teste',
--     'quantidade', 999999,
--     'desconto_percentual', 0
--   ))
-- ));
-- -- Esperado: ERROR 'Estoque insuficiente'
-- SELECT count(*) FROM vendas WHERE cliente_nome = 'Teste saldo insuficiente';   -- esperado 0
-- SELECT count(*) FROM movimentacoes_estoque
--  WHERE motivo = 'venda' AND created_at > now() - interval '5 minutes';         -- esperado 0
--
-- C2) Venda normal: saldo diminui uma vez e uma movimentacao e criada.
-- -- Saldo antes:
-- SELECT quantidade FROM itens_estoque WHERE id = '<uuid-do-produto>';
-- SELECT public.criar_venda(jsonb_build_object(
--   'cliente_nome', 'Teste venda normal',
--   'itens', jsonb_build_array(jsonb_build_object(
--     'produto_id', '<uuid-do-produto>',
--     'nome_produto', 'Item de teste',
--     'quantidade', 2,
--     'desconto_percentual', 0
--   ))
-- ));
-- -- Saldo depois: deve ser exatamente o saldo anterior menos 2.
-- SELECT quantidade FROM itens_estoque WHERE id = '<uuid-do-produto>';
-- -- Deve existir exatamente 1 movimentacao recente deste item, tipo 'saida', quantidade 2.
-- SELECT tipo, quantidade, motivo, organization_id, usuario_id
--   FROM movimentacoes_estoque
--  WHERE item_id = '<uuid-do-produto>'
--  ORDER BY created_at DESC
--  LIMIT 1;
--
-- C3) Preco enviado diferente do catalogo: deve usar o preco do catalogo.
-- -- Preco do catalogo:
-- SELECT preco_venda FROM itens_estoque WHERE id = '<uuid-do-produto>';
-- SELECT public.criar_venda(jsonb_build_object(
--   'cliente_nome', 'Teste preco do catalogo',
--   'itens', jsonb_build_array(jsonb_build_object(
--     'produto_id', '<uuid-do-produto>',
--     'nome_produto', 'Item de teste',
--     'quantidade', 1,
--     'preco_unitario', 0.01,
--     'desconto_percentual', 0
--   ))
-- ));
-- -- O item gravado deve ter preco_unitario igual ao preco_venda do catalogo.
-- SELECT vi.preco_unitario, vi.valor_total, v.valor_produtos, v.valor_total
--   FROM venda_itens vi
--   JOIN vendas v ON v.id = vi.venda_id
--  WHERE v.cliente_nome = 'Teste preco do catalogo';
--
-- C4) Desconto acima do maximo: deve falhar.
-- SELECT public.criar_venda(jsonb_build_object(
--   'cliente_nome', 'Teste desconto invalido',
--   'itens', jsonb_build_array(jsonb_build_object(
--     'produto_id', '<uuid-do-produto>',
--     'nome_produto', 'Item de teste',
--     'quantidade', 1,
--     'desconto_percentual', 999
--   ))
-- ));
-- -- Esperado: ERROR 'Desconto acima do máximo permitido para o item.'
-- SELECT count(*) FROM vendas WHERE cliente_nome = 'Teste desconto invalido';    -- esperado 0
--
-- C5) Duas chamadas simultaneas do mesmo produto: o saldo final deve refletir as duas.
-- -- Abrir duas sessoes (dois clientes psql) e executar, na ordem:
-- --   Sessao 1: BEGIN; SELECT public.criar_venda(jsonb_build_object(
-- --     'cliente_nome', 'Teste concorrente A',
-- --     'itens', jsonb_build_array(jsonb_build_object(
-- --       'produto_id', '<uuid-do-produto>', 'nome_produto', 'Item de teste',
-- --       'quantidade', 1, 'desconto_percentual', 0)))); COMMIT;
-- --   Sessao 2: BEGIN; SELECT public.criar_venda(jsonb_build_object(
-- --     'cliente_nome', 'Teste concorrente B',
-- --     'itens', jsonb_build_array(jsonb_build_object(
-- --       'produto_id', '<uuid-do-produto>', 'nome_produto', 'Item de teste',
-- --       'quantidade', 1, 'desconto_percentual', 0)))); COMMIT;
-- -- Alternativa sem duas sessoes: disparar as duas chamadas em paralelo pelo
-- -- app e conferir depois.
-- -- Esperado: 2 vendas criadas, 2 movimentacoes tipo 'saida' e saldo final
-- -- igual ao saldo inicial menos 2 (nenhuma atualizacao perdida).
-- SELECT quantidade FROM itens_estoque WHERE id = '<uuid-do-produto>';
-- SELECT count(*) FROM vendas WHERE cliente_nome IN ('Teste concorrente A', 'Teste concorrente B');  -- esperado 2
--
-- C6) Numero sequencial: duas vendas seguidas nao podem repetir o numero
-- (ver pendencia 1 no cabecalho: vendas.numero e UNIQUE global).
-- SELECT numero, cliente_nome FROM vendas
--  WHERE organization_id = public.get_user_org_id(auth.uid())
--  ORDER BY numero DESC LIMIT 5;


-- ---------------------------------------------------------------------
-- D) CHECK de estoque - COMENTADO
-- Ja verificado no banco na aplicacao desta migration:
--   SELECT id, descricao, quantidade FROM itens_estoque WHERE quantidade < 0;
--   -> resultado vazio, nao existe saldo negativo pendente.
-- Falta apenas migrar o front para as funcoes acima. Enquanto o front
-- ainda usa o caminho antigo (sem validacao de saldo), ligar este CHECK
-- trocaria o erro amigavel 'Estoque insuficiente' por um erro cru de
-- constraint no meio da venda.
-- ---------------------------------------------------------------------
-- ALTER TABLE itens_estoque
--   ADD CONSTRAINT itens_estoque_quantidade_nao_negativa CHECK (quantidade >= 0);
