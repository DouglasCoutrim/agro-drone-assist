# Concluir a correção de ferramentas e equipamentos

## Situação
As três primeiras ocorrências foram corrigidas e encerradas: acesso aos menus, rascunhos de pedidos e mensagens das notas recebidas. Foram executados 19 testes com sucesso; a compilação automática terminou sem erros.

A quarta ocorrência está confirmada no código e nas migrações: os estados oferecidos pela tela não correspondem aos permitidos no banco, e devoluções usam um tipo de histórico inválido. Não foi alterada a tela de patrimônio nem aplicado SQL. O banco está indisponível para leitura e criação da sessão de teste; suas restrições atuais ainda precisam ser verificadas.

## Correção proposta
- Aceitar Danificado, Extraviado e Baixado sem remover registros históricos nem o estado legado `extraviada`.
- Gravar entrega, transferência, devolução ou extravio como tipos de movimentação; registrar a situação resultante na observação.
- Salvar a mudança de responsável e seu histórico juntos: qualquer erro desfaz ambos e aparece ao usuário.
- Permitir movimentação somente a administradores da empresa; validar também a empresa do funcionário escolhido.
- Impedir confirmação repetida enquanto o salvamento estiver em andamento.

## Detalhes técnicos e SQL para aprovação
Antes de aplicar, consultar `pg_constraint` e confirmar a restrição de status. Se a estrutura real divergir, revisar este SQL antes da execução. Criar uma nova migração; não editar migrações existentes. A substituição abaixo amplia valores aceitos e preserva dados.

```sql
ALTER TABLE public.patrimonio_ferramentas
  DROP CONSTRAINT IF EXISTS patrimonio_ferramentas_status_check;
ALTER TABLE public.patrimonio_ferramentas
  ADD CONSTRAINT patrimonio_ferramentas_status_check
  CHECK (status IN ('disponivel','em_uso','manutencao','extraviada',
                    'extraviado','danificado','baixado')) NOT VALID;
ALTER TABLE public.patrimonio_ferramentas
  VALIDATE CONSTRAINT patrimonio_ferramentas_status_check;

CREATE OR REPLACE FUNCTION public.movimentar_patrimonio(
  p_item_id uuid, p_tecnico_id uuid, p_status text,
  p_tecnico_anterior_id uuid, p_observacao text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_item public.patrimonio_ferramentas%ROWTYPE;
  v_status text;
  v_tipo text;
BEGIN
  v_org := public.get_user_org_id(auth.uid());
  IF auth.uid() IS NULL OR v_org IS NULL
     OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Somente administradores da empresa podem movimentar ferramentas.';
  END IF;

  SELECT * INTO v_item FROM public.patrimonio_ferramentas
    WHERE id = p_item_id AND organization_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ferramenta não encontrada na sua empresa.';
  END IF;
  IF v_item.tecnico_atual_id IS DISTINCT FROM p_tecnico_anterior_id THEN
    RAISE EXCEPTION 'O responsável mudou. Atualize a tela antes de confirmar.';
  END IF;
  IF p_tecnico_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles
      WHERE id = p_tecnico_id AND organization_id = v_org
  ) THEN
    RAISE EXCEPTION 'Selecione um funcionário da sua empresa.';
  END IF;

  v_status := CASE WHEN p_tecnico_id IS NOT NULL THEN 'em_uso'
                   ELSE coalesce(p_status, 'disponivel') END;
  IF v_status NOT IN ('disponivel','em_uso','manutencao','danificado',
                     'extraviado','extraviada','baixado') THEN
    RAISE EXCEPTION 'Situação da ferramenta inválida.';
  END IF;
  v_tipo := CASE
    WHEN p_tecnico_id IS NOT NULL AND v_item.tecnico_atual_id IS NOT NULL
      AND p_tecnico_id <> v_item.tecnico_atual_id THEN 'transferencia'
    WHEN p_tecnico_id IS NOT NULL THEN 'entrega'
    WHEN v_status IN ('extraviado','extraviada') THEN 'extravio'
    ELSE 'devolucao' END;

  UPDATE public.patrimonio_ferramentas
    SET tecnico_atual_id = p_tecnico_id, status = v_status,
        data_entrega = CASE WHEN p_tecnico_id IS NOT NULL THEN current_date ELSE NULL END,
        updated_at = now()
    WHERE id = v_item.id AND organization_id = v_org;
  INSERT INTO public.patrimonio_movimentacoes
    (patrimonio_id, tipo, tecnico_anterior_id, tecnico_novo_id,
     confirmado_por, observacao)
    VALUES (v_item.id, v_tipo, v_item.tecnico_atual_id, p_tecnico_id,
            auth.uid(), concat_ws(E'\n', nullif(p_observacao,''),
                                 'Situação após movimentação: ' || v_status));
END;
$$;
REVOKE ALL ON FUNCTION public.movimentar_patrimonio(uuid,uuid,text,uuid,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.movimentar_patrimonio(uuid,uuid,text,uuid,text)
  TO authenticated;
```

Atualizar somente `Patrimonio.tsx` para usar essa operação, tratar erros e reconhecer `extraviada` como estado legado. Manter isolamento e políticas existentes. Acrescentar testes de estados, tipos de movimentação e rejeição de usuários/funcionários de outra empresa.

## Validação e encerramento
Quando o banco voltar a responder, verificar a estrutura aplicada e testar entrega, devolução, dano, extravio e baixa em registros de teste autorizados. Confirmar o histórico e que falhas não alteram a ferramenta. Executar testes e conferir a compilação automática antes de encerrar a quarta ocorrência.

## Arquivos já criados/alterados nesta revisão
- `src/components/ProtectedRoute.tsx`
- `src/components/compras/PedidoCompraDialog.tsx`
- `src/pages/ImportarXmlNfe.tsx`
- `src/lib/pedido-compra-draft.ts` e seu teste
- `src/lib/function-error.ts` e seu teste
- `src/lib/permissionTree.test.ts`
- `src/lib/protected-route.test.jsx`
- `AGENTS.md` e `roadmap.md`

Não houve emissão fiscal, gravação de pedidos reais ou alteração de patrimônio nesta revisão. A navegação pública foi verificada sem erros; os fluxos autenticados permanecem pendentes pela indisponibilidade do banco.