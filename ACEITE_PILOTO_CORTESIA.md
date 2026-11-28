# Aceite — cortesia de piloto controlada pela plataforma

Branch de implementação: `piloto/cortesia-interna`

Commit previsto: `feat(billing): cortesia de piloto controlada pela plataforma`

## Resultado dos critérios

| Critério | Resultado | Como foi verificado |
|---|---|---|
| O plano piloto não aparece para empresas comuns | Implementado no SQL e no cadastro/assinatura | `visivel_publicamente = false`; RLS de planos, `Assinatura.tsx` e `signup-tenant` filtram planos públicos. Administradores da plataforma recebem exceção para administração. |
| Conceder e revogar só funcionam para administradores da plataforma | Implementado no SQL | As funções `conceder_cortesia` e `revogar_cortesia` validam `is_platform_admin(auth.uid())` e lançam `Acesso negado` antes de qualquer alteração. Ambas gravam `admin_audit_log`. |
| Faturas não são geradas para cortesia ativa | Implementado no código e SQL | `generate-monthly-invoices` carrega os planos com `cobravel = false` e os exclui antes de verificar/criar invoices. O plano piloto também tem mensalidade zero. |
| Inadimplente com cortesia ativa não é bloqueado | Implementado no código | `check-overdue-tenants` ignora `cortesia_ate >= hoje` tanto no fluxo de faturas vencidas quanto no trial expirado. Após a data, a próxima execução segue o fluxo normal. |
| Organizações pagantes não mudam de comportamento | Preservado por condição explícita | Somente organizações cujo `plan_id` aponta para plano `cobravel = false`, ou cuja cortesia ainda esteja ativa, são desviadas; as demais seguem os blocos existentes. |
| Comissão, imposto e recebimento não foram alterados | Aprovado por escopo | Nenhum arquivo de comissão, imposto ou recebimento foi modificado. Checkout continua usando Asaas para planos cobráveis. |
| `npx tsc --noEmit -p tsconfig.app.json` mantém os erros preexistentes | Parcialmente verificado | O comando retorna o erro preexistente em `src/components/help/HelpTourRunner.tsx:226` (`buttonNext` incompatível com `react-joyride`). Nenhum erro novo apareceu nos arquivos alterados. |

## Validações executadas

- `npm run build`: aprovado.
- `git diff --check`: aprovado.
- `npx vitest run supabase/functions/check-overdue-tenants/index.test.ts`: não executou testes porque a suíte importa `bun:test`, indisponível no Vitest/Node deste repositório. Nenhum ajuste fora do escopo foi feito.
- SQL não foi executado em qualquer banco. O arquivo `supabase/APROVACAO_piloto_cortesia.sql` contém blocos separados de verificação e atualização e aguarda aprovação.

## Pendências antes da execução do SQL

1. Confirmar os limites do plano piloto. O arquivo usa provisoriamente os limites atuais do Ouro (`10` usuários e `-1` OS/mês) e marca a decisão para substituição antes da execução.
2. Executar primeiro o bloco de verificação em ambiente de teste.
3. Confirmar que o plano comercial padrão para revogação deve ser o Bronze. Essa é a escolha implementada.
4. Fazer teste manual autenticado com administrador da plataforma, administrador comum, organização em cortesia e organização pagante após o SQL ser aprovado e aplicado.

## O que não foi feito

- Nenhum SQL foi aplicado em produção.
- Não foi criada relação entre empresas titular/matriz e empresas filhas.
- Não foram alterados cálculo de comissão, impostos, recebimento ou tarifas de gateways.
- Não foi apagado o plano legado `Isento`; ele apenas fica invisível ao público no SQL aprovado.
- Não foi criada concessão automática ou por usuário comum.
- Não foi feita cobrança real nem teste contra o Asaas.
- Não foi corrigida a falha preexistente de `HelpTourRunner.tsx` nem a incompatibilidade de `bun:test` com Vitest.
