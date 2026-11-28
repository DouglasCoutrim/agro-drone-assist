# Plano LivreOS — Painel Master e vendas autônomas

## Objetivo

Evoluir o LivreOS como um sistema ERP modular e genérico para lojas, empresas agropecuárias, prestadores de serviços, oficinas e assistências técnicas. Os módulos específicos, como Ordens de Serviço, drones e assistência técnica, devem ser tratados como composição de plano e não como a identidade única do produto.

Este plano separa duas frentes:

1. **Operação comercial no painel Master**: tenants, planos, recebíveis, conciliação, bloqueio e desbloqueio.
2. **Aquisição e venda autônoma no site público**: posicionamento genérico, planos, cadastro, trial, checkout e ativação automática.

Nenhuma cobrança real, alteração de credencial ou mudança irreversível de regra comercial deve ser feita sem a definição das decisões comerciais abaixo.

## Diagnóstico da implementação atual

### O que já existe

- `/admin/dashboard` com abas de visão geral, tenants, planos, configurações, suporte, broadcast, Wiki e site.
- `TenantsTab.tsx` com busca, filtros, alteração de plano, status VIP, bloqueio/desbloqueio e visualização de usuários.
- `OverviewTab.tsx` com MRR estimado, total de clientes, inadimplência/churn, tickets e gráficos de receita/cadastros.
- Tabelas `organizations`, `subscription_plans` e `tenant_invoices` com RLS para administradores da plataforma.
- Edge Functions para cadastro (`signup-tenant`), checkout pós-login (`create-subscription-checkout`), geração de faturas (`generate-monthly-invoices`), bloqueio por atraso/trial (`check-overdue-tenants`) e webhook de pagamentos (`asaas-platform-webhook`).
- Trial de 7 dias no cadastro.
- Asaas já usado como gateway da mensalidade da plataforma.
- Rotas `/assinatura` e `/mensalidade-em-atraso`.

### Lacunas e riscos encontrados

1. **A operação de recebíveis não está completa no painel**: o Master mostra métricas, mas não há uma tela operacional para listar faturas por status, abrir o link de pagamento, reenviar cobrança, marcar exceção, reconciliar webhook e visualizar histórico por tenant.
2. **Bloqueio manual é destrutivo e pouco auditável**: `TenantsTab.tsx` altera diretamente `status`, `subscription_status`, `blocked_at` e `blocked_reason`, sem confirmação explícita, motivo editável, trilha completa ou diferenciação entre bloqueio manual, inadimplência, trial expirado e cancelamento.
3. **Desbloqueio manual pode mascarar inadimplência**: o desbloqueio não valida faturas vencidas nem exige motivo/condição de reativação.
4. **Reset de senha é apenas um placeholder**: a UI informa que é necessária uma Edge Function, mas não executa a operação.
5. **Checkout não é iniciado no site público**: o usuário escolhe um plano no cadastro, mas o cadastro cria o tenant e o trial; o pagamento só pode ser iniciado depois, em `/assinatura`, com usuário autenticado.
6. **Ativação do plano escolhido no cadastro não está alinhada ao fluxo de cobrança**: `signup-tenant` cria plano pago com status de trial e mensalidade preenchida, enquanto o pagamento só ocorre posteriormente.
7. **Inconsistência de planos**: há referências antigas a `basic/pro/enterprise` e referências atuais a `bronze/prata/ouro`. A função de signup aceita apenas `bronze/prata/ouro`, mas o formulário inicia com `basic`. Isso pode deixar o usuário em trial sem o plano selecionado.
8. **Rota pública principal não é a landing**: `/` direciona para `/auth`; a página comercial está em `/landing`. Para venda autônoma, deve ser decidido se `/` vira a landing e como preservar o acesso existente.
9. **Webhook de confirmação precisa de regra de ciclo**: o checkout permite mensal, semestral e anual, mas o webhook avança `next_due_date` sempre em um mês.
10. **Proteção operacional do Asaas precisa ser consolidada**: o checkout usa URL de produção e credencial de ambiente, enquanto o painel possui configuração sandbox/produção. É necessário definir uma única fonte de verdade e separar sandbox de produção.
11. **Bloqueio automático depende de execução agendada confiável**: as funções existem, mas ainda é necessário confirmar o agendamento, segredo, observabilidade e idempotência em produção.
12. **Cadastro público tem risco operacional**: cria usuário, organização, perfil, role, permissões e configuração em várias escritas. Em caso de falha parcial, pode deixar registros órfãos; também não há confirmação de e-mail efetivamente conciliada com o login automático.

## Arquitetura proposta

### Frente 1 — Painel Master operacional

Adicionar uma área de recebíveis vinculada a `tenant_invoices`, com:

- filtros por competência, tenant, status, plano e período;
- totais de pendentes, vencidas, pagas e em disputa;
- visualização do detalhe da cobrança e link Asaas;
- reemissão/reenvio apenas por Edge Function idempotente;
- reconciliação por webhook e atualização segura da assinatura;
- histórico de eventos de cobrança;
- ações de bloqueio/desbloqueio com confirmação, motivo obrigatório e trilha em `admin_audit_log`;
- indicação clara de bloqueio manual, inadimplência, trial expirado e cancelamento;
- prevenção de desbloqueio quando houver fatura vencida, salvo exceção explícita de administrador;
- melhoria de `TenantsTab.tsx` para abrir uma ficha operacional do tenant;
- reset de senha somente via Edge Function administrativa, usando fluxo de recuperação seguro.

As regras de negócio devem ficar no backend/Edge Functions ou em funções SQL protegidas; o cliente não deve decidir sozinho transições financeiras e de bloqueio.

### Frente 2 — Site e venda autônoma

Evoluir a landing para:

- posicionamento: “ERP modular para organizar operação, vendas, estoque, financeiro e serviços”; 
- exemplos de nichos sem limitar o produto a drones;
- benefícios antes de funcionalidades;
- planos vindos de uma fonte única no banco;
- comparação de módulos por plano;
- prova de confiança, FAQ, cancelamento e política do trial;
- CTA principal único e repetido de forma consistente;
- SEO básico: título, descrição, H1, headings, links internos e rota pública principal;
- formulário curto de cadastro com seleção de plano coerente com os slugs do banco;
- fluxo escolhido entre:
  - cadastro + trial sem cartão;
  - cadastro + checkout imediato;
  - checkout antes da criação do tenant;
  - criação do tenant após pagamento;
  - ou modelo híbrido.

A ativação automática deve ser idempotente: uma confirmação do gateway não pode duplicar invoice, assinatura ou mudança de plano.

## Sequência de implementação após aprovação

### Entrega 1 — Normalização comercial

Unificar slugs, nomes, preços, benefícios, limites, ciclo de cobrança e regra de trial. Corrigir o formulário para não enviar plano inexistente. Criar uma única camada de leitura de planos para landing, cadastro, assinatura e Master.

### Entrega 2 — Segurança e domínio financeiro

Criar funções protegidas para transição de assinatura, emissão/reemissão de cobrança, desbloqueio com regra, bloqueio manual e reset de senha. Completar auditoria e idempotência. Não fazer chamadas Asaas diretamente pelo React para operações administrativas.

### Entrega 3 — Recebíveis no Master

Criar aba operacional de recebimentos e melhorar a ficha do tenant. Adicionar filtros, estados vazios, loading, confirmações, motivos, links e indicadores de conciliação.

### Entrega 4 — Trial, checkout e webhook

Implementar o fluxo comercial aprovado, com ambiente sandbox primeiro, webhooks autenticados, ciclo correto, próxima cobrança correta e tratamento de falhas. Validar com dados de teste antes de produção.

### Entrega 5 — Site público de conversão

Atualizar copy, estrutura, nichos, planos, prova de confiança, FAQ, SEO e CTAs. Definir se `/` passa a ser a landing ou se `/landing` será o endereço comercial oficial.

### Entrega 6 — Métricas e operação

Adicionar métricas de funil: visitas, cadastros, trials, conversões, churn, inadimplência, MRR e recuperação. Deixar o Master preparado para acompanhar vendas sem planilhas externas.

## Decisões comerciais necessárias

Responder antes da implementação do checkout definitivo:

1. **Gateway**: manter Asaas como provedor da assinatura LivreOS ou trocar para Stripe/Mercado Pago? A implementação atual está preparada para Asaas.
2. **Planos e preços**: confirmar nomes, preços, usuários, limites de OS e módulos de cada plano. Deseja manter Bronze, Prata e Ouro?
3. **Trial**: manter 7 dias sem cartão? O tenant deve continuar ativo em modo limitado após o trial ou ser bloqueado?
4. **Momento de cobrança**: cobrar no cadastro, ao fim do trial ou permitir que o cliente escolha e pague depois?
5. **Criação da conta**: criar tenant antes do pagamento, depois do pagamento ou manter o modelo híbrido de trial?
6. **Meios de pagamento**: Pix, boleto, cartão ou todos os meios que o Asaas oferecer?
7. **Grace period**: manter 5 dias após o vencimento antes do bloqueio? O desbloqueio deve ser automático após confirmação?
8. **Cancelamento**: imediato, ao fim do ciclo pago ou com retenção de acesso até o vencimento?
9. **Aprovação manual**: alguma venda deve exigir aprovação do Master ou tudo deve ser automático?
10. **Rota comercial**: tornar `/` a landing pública ou manter `/landing`?

## Critérios de entrega

- Não haverá credencial de pagamento exposta no frontend.
- Não haverá cobrança real durante os testes; primeiro usar sandbox ou fixtures controladas.
- Transições financeiras e bloqueios serão idempotentes, auditáveis e protegidos no backend.
- Landing, cadastro, assinatura e Master usarão os mesmos planos e slugs.
- Typecheck/build/testes existentes serão executados antes de cada commit.
- Alterações serão separadas em commits por frente: domínio financeiro, painel Master, checkout/webhooks e site público.
