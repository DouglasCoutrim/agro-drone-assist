# Restaurar os dados da Volt Master

## Diagnóstico confirmado
- A conta `douglascoutrim@gmail.com` continua vinculada à empresa **VOLT MASTER**, com papel de administrador e foto cadastrada.
- Os dados não foram apagados: existem 5 clientes, 17 produtos, 2 itens em estoque, 11 ordens de serviço, 26 serviços e 7 lançamentos financeiros nessa empresa.
- O problema é um ciclo nas regras de segurança do banco: ao consultar perfil e papel, as próprias regras chamam funções que voltam a consultar essas tabelas. O banco encerra a operação com “stack depth limit exceeded”, e o aplicativo recebe listas vazias e não carrega a foto.

## Correção
1. Criar uma migração que execute com segurança as funções auxiliares de identificação de empresa, papel e administrador de plataforma, sem reavaliar recursivamente as mesmas regras.
2. Manter essas funções disponíveis apenas para usuários autenticados e processos internos; visitantes continuarão sem acesso.
3. Testar com a sessão real de `douglascoutrim@gmail.com` no celular e no painel, verificando empresa, papel, foto, produtos, ordens e indicadores.
4. Confirmar que a aplicação continua compilando sem erros.

## Detalhes técnicos
- Ajustar `get_user_org_id`, `get_user_role`, `has_role`, `is_admin_or_tecnico` e `is_platform_admin` para `SECURITY DEFINER`, com `search_path` fixo e privilégios mínimos.
- Não alterar vínculos, registros empresariais ou políticas de isolamento por `organization_id`.
