# TODO — Painel Master e vendas autônomas do LivreOS

## Entrega 1 — Normalização comercial

- [x] Usar os planos Bronze, Prata e Ouro, com slugs `bronze`, `prata` e `ouro`, na landing, cadastro e fluxo de cadastro/checkout revisado.
- [x] Manter trial de 7 dias sem cartão; tenant permanece em trial até contratação e é bloqueado quando o trial expirar.
- [x] Impedir que o cadastro use slugs inexistentes ou divergentes do banco.
- [ ] Centralizar a leitura dos planos ativos e seus limites/preços nas telas comerciais.

## Entrega 2 — Recebíveis no painel Master

- [x] Permitir visualizar faturas de tenants por status, competência, vencimento e organização.
- [x] Exibir totais de pendentes, vencidas e pagas e permitir abrir a cobrança no Asaas.
- [ ] Mostrar no detalhe do tenant a situação financeira e o histórico de cobranças.
- [ ] Usar Edge Functions para operações financeiras administrativas; não expor credenciais nem decidir transições financeiras apenas no React.

## Entrega 3 — Bloqueio e desbloqueio seguro

- [x] Bloqueio manual deve exigir confirmação e registrar motivo, autor e data na trilha administrativa.
- [ ] Diferenciar bloqueio manual, inadimplência, trial expirado e cancelamento.
- [ ] Desbloqueio manual deve exigir confirmação e motivo, com exceção explícita do Master quando houver fatura vencida.
- [x] Confirmação de pagamento deve desbloquear automaticamente o tenant de forma idempotente.
- [x] Manter carência de 5 dias após o vencimento antes do bloqueio automático.

## Entrega 4 — Checkout e ativação automática

- [x] Manter Asaas com Pix, boleto e cartão conforme disponibilidade do provedor.
- [x] Corrigir o ciclo semestral/anual no webhook para atualizar a próxima cobrança pelo período correto.
- [x] Garantir que confirmação repetida de webhook não duplique ativações.
- [ ] Validar primeiro em sandbox, sem cobrança real.

## Entrega 5 — Site público de conversão

- [x] Posicionar o LivreOS como ERP modular e genérico para múltiplos nichos.
- [ ] Reescrever a landing com benefícios, módulos por plano, FAQ, confiança e CTA de trial.
- [ ] Manter `/landing` como página comercial e avaliar redirecionamento de `/` após validação.
- [ ] Garantir que landing e cadastro exibam os mesmos planos, preços e slugs do Master.

## Entrega 6 — Validação e entrega

- [ ] Executar testes existentes, lint e build após cada frente.
- [ ] Revisar mudanças com foco em RLS, Edge Functions, idempotência e regressões.
- [ ] Criar commits separados por domínio financeiro, painel Master e site público.
- [ ] Fazer push para `origin/main` somente após validação final.
