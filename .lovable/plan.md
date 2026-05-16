# Plano: SaaS Multi-tenant — Planos, Paywall, Checkout e Gateway por Tenant

## Visão geral
Refatorar o ecossistema de planos com nova nomenclatura (Bronze/Prata/Ouro) e novos preços, implementar paywall por uso (OS/usuários), tela de assinatura com periodicidade e checkout Asaas (PIX/Boleto), e configuração de gateway de cobrança por tenant (Asaas ou Mercado Pago) para cobrar os clientes finais da oficina — com links de afiliado quando o tenant não tem conta.

---

## 1. Reestruturação de Planos (DB)

Atualizar `subscription_plans`:
- **Bronze** — R$ 39,90 — 2 usuários, 30 OS/mês — features: `os, clientes, estoque, orcamentos`
- **Prata** — R$ 59,90 — 4 usuários, 60 OS/mês — features: Bronze + `financeiro, cobrancas_asaas, mercado_livre, whatsapp_templates`
- **Ouro** — R$ 69,90 — 10 usuários, OS ilimitadas (`max_os_per_month = -1`) — features: Prata + `rotas, whitelabel, api_rest, suporte_prioritario`

Novas colunas em `organizations`:
- `billing_cycle` text default `'mensal'` (`mensal | semestral | anual`)
- `cycle_discount` numeric default 0 (10% semestral, 20% anual)

Nova coluna em `empresa_config`:
- `gateway_clientes` text (`asaas | mercadopago | none`)
- `gateway_clientes_credentials` jsonb (criptografar em edge function antes de salvar — armazenar como string base64 mínima por ora)

Função SQL `count_os_current_month(_org uuid)` e `count_active_users(_org uuid)` (SECURITY DEFINER) para o paywall consultar sem RLS recursion.

---

## 2. Paywall por uso

Novo hook `useUsageLimits()` que retorna:
```ts
{ osUsed, osLimit, usersUsed, usersLimit, canCreateOS, canInviteUser, plan }
```
- Consome RPC `count_os_current_month` + `count_active_users` + plano atual.
- `osLimit = -1` significa ilimitado.

Novo componente `<UpgradePlanModal />` (Dialog amigável):
- Mostra plano atual, limite atingido, comparativo dos 3 planos, CTA "Fazer upgrade" → `/configuracoes/assinatura`.

Integração:
- `OrdensServico.tsx` — antes de abrir o dialog "Nova OS", checar `canCreateOS`; se falso, abrir `<UpgradePlanModal reason="os" />`.
- `Equipe.tsx` (convite de usuário) — checar `canInviteUser` antes do submit.
- Badge de uso no topo do Dashboard: "OS este mês: 12/30".

---

## 3. Tela de Assinatura (`/configuracoes/assinatura`)

Nova página `src/pages/Assinatura.tsx`:
- Toggle de periodicidade: **Mensal | Semestral (-10%) | Anual (-20%)**
- 3 cards (Bronze/Prata/Ouro) com preço calculado em tempo real:
  - Semestral: `price * 6 * 0.9`
  - Anual: `price * 12 * 0.8`
- Botão "Assinar" → invoca edge function `create-subscription-checkout` que:
  1. Cria/atualiza `tenant_invoices` com valor calculado.
  2. Cria cobrança no Asaas (master account) com `billingType: 'UNDEFINED'` (PIX + Boleto).
  3. Retorna `pix.payload`, `pix.encodedImage` (QR), `bankSlipUrl`, `invoiceUrl`.
- UI exibe: QR Code PIX, copia-e-cola, linha digitável boleto, link "Abrir boleto", estado "Aguardando pagamento" com polling a cada 5s na `tenant_invoices.status`.
- Webhook `asaas-platform-webhook` (já existe) confirma → status muda para `pago` → modal "Pagamento confirmado" + reload.

---

## 4. Gateway por Tenant (`/configuracoes/integracoes`)

Nova aba "Integrações Financeiras" em `EmpresaConfig.tsx`:

**Seletor de gateway** (radio cards):
- **Asaas** → input "API Key"
- **Mercado Pago** → input "Access Token"
- **Não tenho conta ainda** → mostra 2 cards de afiliado:
  - "Criar conta no Asaas" → `https://www.asaas.com/r/SEU_CODIGO_AFILIADO` (placeholder `{{ASAAS_AFFILIATE_URL}}`)
  - "Criar conta no Mercado Pago" → `https://www.mercadopago.com.br/?ref=SEU_CODIGO` (placeholder)

Validação:
- Botão "Testar credenciais" → edge function `test-tenant-gateway` faz uma chamada ping (Asaas: GET `/myAccount`; MP: GET `/users/me`) e confirma sucesso.

**Botão "Pagar via PIX/Boleto" na OS/Vendas:**
- Em `OrdensServico` (detalhe) e `Orcamentos` aprovados: se `empresa_config.gateway_clientes` configurado, mostrar botão.
- Clique → edge function `create-customer-charge` usa as **credenciais do tenant** (não as do platform) para criar cobrança em nome da oficina → retorna URL → abre em nova aba ou modal com QR.
- Restrição: feature `cobrancas_asaas` (Prata+) — Bronze vê CTA de upgrade.

---

## 5. White-label (revisão)

Garantir que `empresa_config.logo_url`, `nome_empresa`, `cor_primaria` sejam usados em:
- PDF de OS (`orcamento-pdf.ts` e impressão da OS)
- Links públicos de cobrança (página de visualização cliente final)
- Email/WhatsApp templates

Provider `useEmpresaConfig` já existe — auditar uso nos pontos acima e completar onde faltar.

Restrição: customização de cor/favicon só liberada para plano **Ouro** (feature `whitelabel`); logo e nome funcionam em todos.

---

## 6. Estrutura técnica

### Migrations
1. Atualizar `subscription_plans` (3 planos novos) — substitui Basic/Pro/Enterprise.
2. Adicionar colunas a `organizations` e `empresa_config`.
3. Criar funções `count_os_current_month` e `count_active_users`.

### Edge Functions novas
- `create-subscription-checkout` — cria cobrança Asaas master para o tenant assinar.
- `create-customer-charge` — usa credenciais do tenant para cobrar cliente final.
- `test-tenant-gateway` — valida API key/token.

### Frontend novo/alterado
- **Novo:** `src/pages/Assinatura.tsx`, `src/components/UpgradePlanModal.tsx`, `src/hooks/useUsageLimits.tsx`, `src/components/IntegracoesFinanceiras.tsx`
- **Alterado:** `App.tsx` (rota), `OrdensServico.tsx` (paywall + botão pagar), `Orcamentos.tsx` (botão pagar), `Equipe.tsx` (paywall convite), `EmpresaConfig.tsx` (aba integrações), `useFeatureAccess.tsx` (mapear novos slugs bronze/prata/ouro).

### Compatibilidade
Migrar organizações existentes (`plan = 'basic' → 'bronze'`, `pro → prata`, `enterprise → ouro`) na mesma migration.

---

## Ordem de implementação
1. Migrations (planos + colunas + funções de contagem)
2. Hook `useUsageLimits` + `UpgradePlanModal` + paywall em OS/Equipe
3. Página `/configuracoes/assinatura` + edge function `create-subscription-checkout`
4. Aba Integrações Financeiras + edge functions `test-tenant-gateway` e `create-customer-charge`
5. Botão "Pagar via PIX/Boleto" em OS e Orçamentos
6. Auditoria white-label (PDF, links públicos)

---

## Perguntas antes de implementar
1. Confirma a substituição dos planos antigos (Basic/Pro/Enterprise R$ 49,90/69,90/89,90) pelos novos Bronze/Prata/Ouro (R$ 39,90/59,90/69,90)? As organizações em trial migram para Bronze por padrão?
2. Para o checkout do SaaS (suas mensalidades), uso o mesmo `ASAAS_API_KEY` já configurado, ou você quer separar em `PLATFORM_ASAAS_API_KEY`?
3. Os links de afiliado Asaas e Mercado Pago — quer que eu deixe placeholders `{{ASAAS_AFFILIATE_URL}}` em constants para você editar depois, ou já tem as URLs?
4. Implemento tudo em sequência (6 etapas) ou prefere validar etapa por etapa?
