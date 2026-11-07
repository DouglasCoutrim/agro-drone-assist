DROP FUNCTION IF EXISTS public.criar_saida_demonstracao(uuid, numeric, text);
CREATE FUNCTION public.criar_saida_demonstracao(_item uuid, _qtd numeric, _obs text, _funcionario uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_org_id(auth.uid()); _it record; _id uuid;
BEGIN
  IF auth.uid() IS NULL OR _org IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Somente administradores podem lançar retiradas para demonstração'; END IF;
  IF _funcionario IS NULL OR public.get_user_org_id(_funcionario) IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Funcionário inválido'; END IF;
  IF _qtd IS NULL OR _qtd <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  SELECT * INTO _it FROM itens_estoque WHERE id = _item AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF _it.quantidade < _qtd THEN RAISE EXCEPTION 'Estoque insuficiente (disponível: %)', _it.quantidade; END IF;
  UPDATE itens_estoque SET quantidade = quantidade - _qtd WHERE id = _item;
  INSERT INTO saidas_demonstracao (organization_id, funcionario_id, item_id, descricao, quantidade, valor_unitario, observacao)
  VALUES (_org, _funcionario, _item, _it.descricao, _qtd, _it.preco_venda, _obs) RETURNING id INTO _id;
  INSERT INTO movimentacoes_estoque (item_id, organization_id, quantidade, tipo, motivo, usuario_id)
  VALUES (_item, _org, _qtd, 'saida', 'Saída para demonstração (nota interna)', auth.uid());
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.criar_saida_demonstracao(uuid, numeric, text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.criar_saida_demonstracao(uuid, numeric, text, uuid) TO authenticated;