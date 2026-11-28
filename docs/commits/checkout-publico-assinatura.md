# Checkout público de assinatura (link de pagamento)

Data: 2026-11-28
Pedido: "criar a função `public-checkout` (aproveitando a tabela `checkout_sessions`)".

A tabela `checkout_sessions` existia no banco sem nenhum uso no código, junto com as colunas
`tenant_invoices.checkout_session_id`, `billing_cycle`, `asaas_environment`, `bank_slip_url`,
`barcode` e `last_webhook_event`. Esta rodada implementa o fluxo completo que essas colunas
preveem: um **link de pagamento** que o administrador da conta gera e envia para quem vai pagar a
mensalidade — sem precisar de login do lado de quem paga.

## Fluxo

1. **Gerar o link** (autenticado, admin da organização) — em `/assinatura`, o botão
   *Gerar link de pagamento* de cada plano chama a função com `action: 'create'`. A função grava a
   sessão em `checkout_sessions` (organização, plano, ciclo, validade de 7 dias) e devolve a URL
   `/checkout/<token>`.
2. **Abrir o link** (público) — a página mostra empresa, plano, ciclo, valor, vencimento e até
   quando o link vale. O token é a única credencial.
3. **Gerar a cobrança** (público) — o pagador confirma nome, CPF/CNPJ, e-mail e telefone; a função
   cria (ou reaproveita, buscando por CPF/CNPJ) o cliente no Asaas, cria a cobrança com
   `billingType: UNDEFINED` e devolve PIX (QR + copia e cola), boleto (linha digitável + link) e o
   link da fatura Asaas (cartão).
4. **Confirmar o pagamento** — o webhook `asaas-platform-webhook` marca a fatura como paga,
   desbloqueia a organização e, quando o pagamento veio de um link, marca a sessão como `paid` e
   **ativa o plano escolhido** (plano, limite de usuários, limite de OS, ciclo e desconto). A
   página pública faz polling a cada 5 s e mostra a confirmação.

## Arquivos

- `supabase/functions/public-checkout/index.ts` (novo) — ações `create`, `info`, `charge` e
  `status`. Usa a service role apenas no servidor.
- `supabase/functions/asaas-platform-webhook/index.ts` — passou a registrar `last_webhook_event`
  na fatura e a fechar a sessão de checkout (status `paid`, `completed_at`) aplicando o plano.
- `src/pages/CheckoutPublico.tsx` (novo) — página pública, sem layout autenticado.
- `src/App.tsx` — rota pública `/checkout/:token` (carregada junto das entradas, como
  `/cadastro-empresa`).
- `src/pages/Assinatura.tsx` — botão *Gerar link de pagamento* por plano e cartão com o link
  pronto (copiar).
- `src/lib/functionsError.ts` (novo) — lê a mensagem de erro devolvida pela Edge Function, para o
  usuário ver o texto em português em vez de "non-2xx status code".

## Segurança

- **Token de 256 bits** gerado com `crypto.getRandomValues`; o banco guarda apenas o SHA-256
  (`checkout_sessions.token_hash`, índice único). O link não pode ser adivinhado nem reconstruído
  a partir do banco.
- **Validade de 7 dias**; link vencido é marcado como `expired` e devolve 410 com orientação.
- **Valor sempre calculado no servidor** a partir de `subscription_plans.monthly_price` × meses ×
  desconto do ciclo. O cliente não envia valor.
- **Gerar link exige JWT de administrador** da própria organização (mesmo critério da tela
  Assinatura). As ações públicas exigem o token e passam por rate limit por IP (30/min).
- **Nada de DDL**: foram usadas apenas colunas já existentes. `checkout_sessions` segue sem grants
  para `anon`/`authenticated` — todo acesso passa pela função com service role.
- `supabase/config.toml` **não** foi alterado: a página chama a função por `functions.invoke`, que
  já envia a chave anônima como `Authorization` (atende `verify_jwt`), e a autorização real é o
  token.

## Configuração necessária

A função usa a chave da plataforma: `PLATFORM_ASAAS_API_KEY` (ou `ASAAS_API_KEY`). **Ela não está
configurada no projeto conectado** — sem ela o link responde "Pagamento indisponível no momento.
Fale com o suporte." (503) e o log registra `[public-checkout] PLATFORM_ASAAS_API_KEY ausente`.
O ambiente é deduzido pela chave: `$aact_hmlg...` usa sandbox, o restante usa produção.

## Como testar

1. Entre como administrador e abra `/assinatura`.
2. Em um plano, clique em *Gerar link de pagamento* e copie a URL.
3. Abra a URL em uma janela anônima (sem sessão): a página mostra o resumo da assinatura.
4. Preencha os dados do pagador e clique em *Gerar cobrança*: aparecem PIX, boleto e o link da
   fatura Asaas.
5. Pague em sandbox (ou simule `PAYMENT_RECEIVED` no webhook): a página troca para "Pagamento
   confirmado" e o plano da organização é atualizado.
