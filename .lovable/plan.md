# Restaurar notificações sem retirar a proteção

## Resultado da revisão dos dois alertas
- **Vendas: alerta desatualizado.** O serviço externo aceita `select=desconto_maximo_percentual` em `venda_itens` (HTTP 200). Uma coluna inexistente de controle retorna 400/42703. Não alterar vendas, descontos ou estoque. O achado foi encerrado como desatualizado; não foi feita uma venda real para testar o fluxo completo.
- **Notificações: incompatibilidade confirmada.** O código exige autorização de uso único; a tabela correspondente não existe no serviço externo (404/PGRST205). O banco Cloud acessível também não tem a tabela nem a função, e seu gatilho envia somente o identificador. A função publicada rejeitou a chamada sem autorização com HTTP 401. A definição do gatilho externo e a entrega real ainda precisam ser verificadas no destino externo.

## Correção proposta, somente para notificações
1. Conferir no serviço externo a definição atual de `trg_send_web_push`, o gatilho associado a `notifications` e a função publicada.
2. Após aprovação, aplicar somente o SQL abaixo no **serviço externo ativo**, por migração aditiva/idempotente conectada ao destino correto ou execução pelo proprietário. Não aplicar no Cloud antigo. Nenhum limite de plano ou outro achado será alterado.
3. Publicar/conferir `send-web-push` junto da mudança: manter a rejeição de chamadas sem autorização, expiradas ou repetidas. A aplicação do SQL vem antes da publicação da função que depende dele.
4. Conferir tabela, permissões, função e corpo enviado pelo gatilho; testar uma notificação para o próprio usuário com inscrição push ativa, confirmar entrega e rejeição do reuso do token. Não registrar tokens ou credenciais nos relatórios.
5. Encerrar o achado de notificações como corrigido somente após essas verificações.

## Limitações atuais
A sessão não fornece acesso de escrita/publicação ao serviço externo. Aprovar o plano não dá acesso automático: se continuar indisponível, será necessário executar o SQL nesse destino e confirmar o resultado. Nenhum código de aplicação foi alterado, nenhuma notificação real foi enviada e nenhum teste autenticado de vendas foi realizado. A compilação automática atual registra **build OK**.

## Arquivos
- Alterados nesta revisão: `roadmap.md` e o plano.
- Previsto após aprovação: uma nova migração de notificações no destino correto; ajustar código/publicação somente se a conferência mostrar necessidade.

## SQL para aprovação
O bloco preserva a URL e os cabeçalhos atuais do gatilho, sem copiá-los para arquivos, e aborta caso a definição não corresponda ao formato esperado. A tabela fica inacessível aos usuários comuns; a organização é copiada da notificação, inclusive quando vazia em avisos globais. Não executar parcialmente; usar uma única transação na aplicação da migração.

```sql
CREATE TABLE IF NOT EXISTS public.push_dispatch_authorizations (
  notification_id uuid PRIMARY KEY REFERENCES public.notifications(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 minutes'),
  used_at timestamptz
);
GRANT ALL ON public.push_dispatch_authorizations TO service_role;
REVOKE ALL ON public.push_dispatch_authorizations FROM PUBLIC, anon, authenticated;
ALTER TABLE public.push_dispatch_authorizations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_push_dispatch(_notification_id uuid, _token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE consumed uuid;
BEGIN
  UPDATE public.push_dispatch_authorizations SET used_at = now()
  WHERE notification_id = _notification_id AND token = _token
    AND used_at IS NULL AND expires_at > now()
  RETURNING notification_id INTO consumed;
  RETURN consumed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_push_dispatch(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_push_dispatch(uuid, uuid) TO service_role;

-- Preserve the active URL and headers without copying credentials.
DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.trg_send_web_push()'::regprocedure) INTO definition;
  IF position('dispatch_token' IN definition) = 0 THEN
    IF definition !~ 'AS \$function\$[[:space:]]*BEGIN' OR
       definition !~ 'jsonb_build_object\(''notification_id'',[[:space:]]*NEW.id\)' OR
       position('PERFORM net.http_post(' IN definition) = 0 THEN
      RAISE EXCEPTION 'Unexpected push trigger definition; review before applying';
    END IF;
    definition := regexp_replace(definition,
      'AS \$function\$[[:space:]]*BEGIN',
      'AS $function$ DECLARE dispatch_token uuid; BEGIN');
    definition := replace(definition, 'PERFORM net.http_post(',
      'INSERT INTO public.push_dispatch_authorizations(notification_id, organization_id) VALUES (NEW.id, NEW.organization_id) RETURNING token INTO dispatch_token; PERFORM net.http_post(');
    definition := regexp_replace(definition,
      'jsonb_build_object\(''notification_id'',[[:space:]]*NEW.id\)',
      'jsonb_build_object(''notification_id'', NEW.id, ''dispatch_token'', dispatch_token)');
    EXECUTE definition;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_send_web_push() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
```
