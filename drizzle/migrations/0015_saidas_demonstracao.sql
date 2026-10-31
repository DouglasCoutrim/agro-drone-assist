CREATE TABLE public.saidas_demonstracao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  numero serial,
  funcionario_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.itens_estoque(id),
  descricao text NOT NULL,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  valor_unitario numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_posse' CHECK (status IN ('em_posse','vendido','devolvido','cobrado','quitado')),
  prazo_ate timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  valor_cobrado numeric,
  observacao text,
  observacao_conclusao text,
  concluido_em timestamptz,
  concluido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.saidas_demonstracao TO authenticated;
GRANT ALL ON public.saidas_demonstracao TO service_role;
GRANT USAGE ON SEQUENCE public.saidas_demonstracao_numero_seq TO service_role;
ALTER TABLE public.saidas_demonstracao ENABLE ROW LEVEL SECURITY;
CREATE POLICY saidas_demo_leitura ON public.saidas_demonstracao FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()) AND (funcionario_id = auth.uid() OR public.has_role(auth.uid(),'admin')));

CREATE OR REPLACE FUNCTION public.criar_saida_demonstracao(_item uuid, _qtd numeric, _obs text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_org_id(auth.uid()); _it record; _id uuid;
BEGIN
  IF auth.uid() IS NULL OR _org IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _qtd IS NULL OR _qtd <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  SELECT * INTO _it FROM itens_estoque WHERE id = _item AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF _it.quantidade < _qtd THEN RAISE EXCEPTION 'Estoque insuficiente (disponível: %)', _it.quantidade; END IF;
  UPDATE itens_estoque SET quantidade = quantidade - _qtd WHERE id = _item;
  INSERT INTO saidas_demonstracao (organization_id, funcionario_id, item_id, descricao, quantidade, valor_unitario, observacao)
  VALUES (_org, auth.uid(), _item, _it.descricao, _qtd, _it.preco_venda, _obs) RETURNING id INTO _id;
  INSERT INTO movimentacoes_estoque (item_id, organization_id, quantidade, tipo, motivo, usuario_id)
  VALUES (_item, _org, _qtd, 'saida', 'Saída para demonstração (nota interna)', auth.uid());
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.concluir_saida_demonstracao(_id uuid, _acao text, _obs text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s record; _admin boolean := public.has_role(auth.uid(),'admin');
BEGIN
  SELECT * INTO _s FROM saidas_demonstracao WHERE id = _id AND organization_id = public.get_user_org_id(auth.uid()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro não encontrado'; END IF;
  IF NOT (_admin OR _s.funcionario_id = auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _acao = 'quitado' THEN
    IF NOT _admin OR _s.status <> 'cobrado' THEN RAISE EXCEPTION 'Somente administrador quita cobranças'; END IF;
  ELSIF _acao IN ('vendido','devolvido') THEN
    IF _s.status <> 'em_posse' AND NOT (_admin AND _s.status = 'cobrado') THEN RAISE EXCEPTION 'Este item já foi concluído'; END IF;
    IF _acao = 'devolvido' THEN
      UPDATE itens_estoque SET quantidade = quantidade + _s.quantidade WHERE id = _s.item_id;
      INSERT INTO movimentacoes_estoque (item_id, organization_id, quantidade, tipo, motivo, usuario_id)
      VALUES (_s.item_id, _s.organization_id, _s.quantidade, 'entrada', 'Devolução de demonstração', auth.uid());
    END IF;
  ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
  UPDATE saidas_demonstracao SET status = _acao, concluido_em = now(), concluido_por = auth.uid(),
    observacao_conclusao = COALESCE(_obs, observacao_conclusao),
    valor_cobrado = CASE WHEN _acao = 'quitado' THEN valor_cobrado ELSE NULL END
  WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.processar_demonstracoes_vencidas()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.get_user_org_id(auth.uid()); _r record; _n integer := 0;
BEGIN
  IF _org IS NULL THEN RETURN 0; END IF;
  FOR _r IN UPDATE saidas_demonstracao SET status = 'cobrado', valor_cobrado = quantidade * valor_unitario, concluido_em = now()
    WHERE organization_id = _org AND status = 'em_posse' AND prazo_ate < now() RETURNING * LOOP
    _n := _n + 1;
    PERFORM public.notify_user(_r.funcionario_id, _org, 'warning', 'Item de demonstração cobrado',
      'O prazo de 7 dias de "' || _r.descricao || '" venceu. Valor cobrado: R$ ' || to_char(_r.valor_cobrado, 'FM999G990D00'), '/demonstracoes');
    PERFORM public.notify_org_role(_org, 'admin', 'warning', 'Demonstração vencida',
      '"' || _r.descricao || '" não foi vendido nem devolvido no prazo e foi cobrado do funcionário.', '/demonstracoes');
  END LOOP;
  RETURN _n;
END $$;

REVOKE ALL ON FUNCTION public.criar_saida_demonstracao(uuid,numeric,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.concluir_saida_demonstracao(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.processar_demonstracoes_vencidas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_saida_demonstracao(uuid,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.concluir_saida_demonstracao(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.processar_demonstracoes_vencidas() TO authenticated;