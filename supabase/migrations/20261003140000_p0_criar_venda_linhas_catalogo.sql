-- =====================================================================
-- P0 ESTOQUE E VENDA: criar_venda cobre servicos e itens livres
-- Arquivo: supabase/migrations/20261003140000_p0_criar_venda_linhas_catalogo.sql
-- Estado: APLICADA no projeto Supabase.
--
-- Por que esta migration existe:
-- A primeira versao de criar_venda (20261003130000) aceitava apenas item de
-- itens_estoque. Mas o PDV vende tambem SERVICOS (linha com produto_id nulo,
-- preco vindo de servicos) e o formulario de Vendas permite item LIVRE
-- (nome e preco digitados). Ligar o front naquela versao quebraria os dois
-- fluxos com 'Item do catálogo não encontrado nesta organização.'.
--
-- Tipos de linha aceitos agora, nesta ordem de precedencia:
--   1. produto_id -> itens_estoque: preco, desconto maximo, NCM, CFOP e nome
--      vem do catalogo. Baixa estoque via ajustar_estoque.
--   2. servico_id -> servicos: preco = GREATEST(preco, valor_fixo, valor_hora)
--      e desconto maximo vem do catalogo (mesma regra que o gatilho
--      enforce_itens_os_price ja aplica em itens de OS). Nao mexe em estoque.
--   3. nenhum dos dois -> linha livre: aceita nome e preco digitados e nao
--      mexe em estoque (nao existe preco de catalogo para conferir).
--
-- Tambem passaram a ser gravados na venda, porque o caminho antigo do
-- navegador gravava e ha leitura a jusante:
--   nfe_dados -> lido pela tela de Vendas para habilitar a emissao de NF-e
--   ambiente  -> 'producao' por padrao (coluna NOT NULL DEFAULT 'producao')
--
-- Regra de desconto: espelha src/lib/desconto.ts. desconto_maximo_percentual
-- igual a 0 significa "sem teto configurado" (vai ate 100), e nao teto zero;
-- se fosse tratado como teto zero, qualquer desconto passaria a falhar para
-- os itens que hoje aceitam desconto.
-- =====================================================================

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
  _servico_id uuid;
  _quantidade numeric;
  _desconto_percentual numeric;
  _teto_desconto numeric;
  _preco_catalogo numeric;
  _desconto_maximo numeric;
  _nome_item text;
  _ncm text;
  _cfop text;
  _valor_bruto numeric;
  _desconto_valor numeric;
  _valor_item numeric;
  _total_produtos numeric := 0;
  _total_descontos numeric := 0;
  _ultimo_numero text;
  _sequencia integer;
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
    _produto_id := NULLIF(_item->>'produto_id', '')::uuid;
    _servico_id := NULLIF(_item->>'servico_id', '')::uuid;

    _quantidade := COALESCE((_item->>'quantidade')::numeric, 0);
    IF _quantidade <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida.';
    END IF;

    _desconto_percentual := COALESCE((_item->>'desconto_percentual')::numeric, 0);
    IF _desconto_percentual < 0 THEN
      RAISE EXCEPTION 'Desconto inválido.';
    END IF;

    IF _produto_id IS NOT NULL THEN
      -- 1) Item de estoque: tudo vem do catalogo.
      SELECT preco_venda, desconto_maximo_percentual, descricao, ncm, cfop
        INTO _preco_catalogo, _desconto_maximo, _nome_item, _ncm, _cfop
        FROM itens_estoque
       WHERE id = _produto_id
         AND organization_id = _org;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Item do catálogo não encontrado nesta organização.';
      END IF;

      _teto_desconto := LEAST(100, CASE WHEN COALESCE(_desconto_maximo, 0) <= 0 THEN 100 ELSE _desconto_maximo END);
      IF _desconto_percentual > _teto_desconto THEN
        RAISE EXCEPTION 'Desconto acima do máximo permitido para o item.';
      END IF;

      _valor_bruto := _preco_catalogo * _quantidade;
      _desconto_valor := round(_valor_bruto * _desconto_percentual / 100, 2);
      _valor_item := _valor_bruto - _desconto_valor;

      INSERT INTO venda_itens (
        venda_id, produto_id, nome_produto, ncm, cfop, quantidade,
        preco_unitario, desconto_percentual, desconto_valor,
        desconto_maximo_percentual, valor_total, quantidade_devolvida
      )
      VALUES (
        _venda_id, _produto_id, _nome_item, _ncm, _cfop, _quantidade,
        _preco_catalogo, _desconto_percentual, _desconto_valor,
        COALESCE(_desconto_maximo, 0), _valor_item, 0
      );

      PERFORM public.ajustar_estoque(_produto_id, -_quantidade, 'venda', 'venda', _venda_id);

    ELSIF _servico_id IS NOT NULL THEN
      -- 2) Servico: preco efetivo e teto de desconto vem do catalogo.
      SELECT GREATEST(COALESCE(preco, 0), COALESCE(valor_fixo, 0), COALESCE(valor_hora, 0)),
             COALESCE(desconto_maximo_percentual, 0),
             descricao
        INTO _preco_catalogo, _desconto_maximo, _nome_item
        FROM servicos
       WHERE id = _servico_id
         AND organization_id = _org;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Item do catálogo não encontrado nesta organização.';
      END IF;

      _teto_desconto := LEAST(100, CASE WHEN COALESCE(_desconto_maximo, 0) <= 0 THEN 100 ELSE _desconto_maximo END);
      IF _desconto_percentual > _teto_desconto THEN
        RAISE EXCEPTION 'Desconto acima do máximo permitido para o item.';
      END IF;

      -- Servico nao tem coluna fiscal propria: NCM/CFOP vem do payload.
      _ncm := NULLIF(_item->>'ncm', '');
      _cfop := NULLIF(_item->>'cfop', '');

      _valor_bruto := _preco_catalogo * _quantidade;
      _desconto_valor := round(_valor_bruto * _desconto_percentual / 100, 2);
      _valor_item := _valor_bruto - _desconto_valor;

      INSERT INTO venda_itens (
        venda_id, produto_id, nome_produto, ncm, cfop, quantidade,
        preco_unitario, desconto_percentual, desconto_valor,
        desconto_maximo_percentual, valor_total, quantidade_devolvida
      )
      VALUES (
        _venda_id, NULL, _nome_item, _ncm, _cfop, _quantidade,
        _preco_catalogo, _desconto_percentual, _desconto_valor,
        COALESCE(_desconto_maximo, 0), _valor_item, 0
      );

    ELSE
      -- 3) Linha livre: sem catalogo, aceita o digitado e nao movimenta estoque.
      _nome_item := NULLIF(btrim(COALESCE(_item->>'nome_produto', '')), '');
      IF _nome_item IS NULL THEN
        RAISE EXCEPTION 'Informe o nome do item.';
      END IF;

      _preco_catalogo := COALESCE((_item->>'preco_unitario')::numeric, 0);
      IF _preco_catalogo < 0 THEN
        RAISE EXCEPTION 'Preço inválido.';
      END IF;

      IF _desconto_percentual > 100 THEN
        RAISE EXCEPTION 'Desconto inválido.';
      END IF;

      _ncm := NULLIF(_item->>'ncm', '');
      _cfop := NULLIF(_item->>'cfop', '');

      _valor_bruto := _preco_catalogo * _quantidade;
      _desconto_valor := round(_valor_bruto * _desconto_percentual / 100, 2);
      _valor_item := _valor_bruto - _desconto_valor;

      INSERT INTO venda_itens (
        venda_id, produto_id, nome_produto, ncm, cfop, quantidade,
        preco_unitario, desconto_percentual, desconto_valor,
        desconto_maximo_percentual, valor_total, quantidade_devolvida
      )
      VALUES (
        _venda_id, NULL, _nome_item, _ncm, _cfop, _quantidade,
        _preco_catalogo, _desconto_percentual, _desconto_valor,
        0, _valor_item, 0
      );
    END IF;

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
