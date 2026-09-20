# Relatório de Análise Completa do Sistema LivreOS

## Gerado para revisão por IA - O que melhorar, implementar ou remover

### Data: 2026-09-19
### Stack: Vite + React 18 + TypeScript + Tailwind + shadcn-ui + Supabase

---

## 1. RESUMO EXECUTIVO

O **LivreOS** é um sistema SaaS completo de gestão de ordens de serviço para empresas de drones e equipamentos agrícolas. O códigobase demonstra **engenharia de produto sólida** com pipeline completo de OS, cobranças, estoque, notificações e painel de tenants/multi-tenant.

No entanto, a **auditoria técnica** (AUDITORIA.md) identificou **falhas críticas de segurança e uma base de dados não reproduzível** que exigem atenção imediata. O sistema tem 39 migrations SQL, 16 edge functions Deno e ~200 componentes React.

---

## 2. FUNCIONALIDADES IMPLEMENTADAS

### 2.1 Módulo de Ordens de Serviço (OS)
- ✅ Criação wizard (Cliente → Equipamento → Problema → Revisão)
- ✅ Tipos de equipamento: drones (agricola, imagem, controle, bateria), mobilidade (patinete, bicicleta, moto elétrica), informática, bicicletaria
- ✅ Status pipeline com validações de checklist obrigatório
- ✅ Atribuição de técnicos e gestão de equipe
- ✅ Geração de PDF client-side (OSPDFGenerator)
- ✅ Integração WhatsApp com templates personalizados
- ✅ Cálculo e pagamento de comissões via RPC `calculate_os_commission`
- ✅ Delete OS com confirmação destrutiva
- ✅ Itens de OS (serviços e produtos) com controle de estoque

### 2.2 Módulo de Financeiro
- ✅ Registro de transações (receitas, despesas, salários, comissões)
- ✅ Contas a receber (OS sem pagamento) com cobrança via Asaas (PIX, boleto, cartão)
- ✅ Estatísticas mensais: receita, despesa, lucro líquido, comissões
- ✅ Busca e filtro de transações
- ✅ Diálogo de confirmação de pagamento

### 2.3 Dashboard/Index
- ✅ KPI cards em grid responsivo: OS abertas, concluídas, estoque baixo, faturamento, a receber
- ✅ Lista de OS recentes com status badges
- ✅ Alertas: OS em atraso, pagamentos vencidos, estoque baixo
- ✅ FAB flutuante para criação rápida de OS

### 2.4 Módulo de Relatórios
- ✅ Filtros por período (semana, mês, trimestre, ano)
- ✅ Gráfico de pizza: OS por status
- ✅ Gráfico de barras: OS por tipo de equipamento
- ✅ Gráfico de barras: financeiro por categoria
- ✅ Tabela: itens com estoque baixo
- ✅ Tabela: top 5 clientes por número de OS
- ✅ Exportar para PDF/impressão

### 2.5 Módulo de Clientes
- ✅ Cadastro e listagem de clientes
- ✅ Busca autocomplete (CatalogAutocomplete)
- ✅ Integração com IDs Asaas para cobrança

### 2.6 Configurações e Gestão
- ✅ Configuração de empresa (nome, planos, taxas)
- ✅ Configuração de checklist de OS (itens obrigatórios por tipo de equipamento)
- ✅ Gestão de equipe (membros, roles)
- ✅ Limites de uso por plano (OS por mês)
- ✅ Configurações de Orcamentos e Rotas

### 2.7 Painel Admin Master (Plataforma)
- ✅ Visão geral do sistema
- ✅ Gerenciamento de tenants/clients
- ✅ Gestão de planos e preços
- ✅ Comunicados/suporte global
- ✅ Wiki administrativa
- ✅ Configurações do site

### 2.8 Layout e Navegação
- ✅ Desktop: Sidebar fixa com navegação por sections (Principal, Gestão, Sistema)
- ✅ Mobile: Header com tema/notificações + Bottom Nav com navegação principal
- ✅ Global Search (componente GlobalSearch)
- ✅ Toggle de tema (light/dark)

### 2.9 Integrações Externas
- ✅ Asaas: Criação de pagamentos, listagem de pagamentos
- ✅ WhatsApp API: Templates de mensagem automática
- ✅ CSV Import/Export: Via papaparse
- ✅ Supabase Storage: Para anexos de OS

### 2.10 Autenticação e Controle de Acesso
- ✅ Login/registro via Supabase Auth
- ✅ Roles: admin, técnico, consulta
- ✅ Proteção de rotas por role e permission
- ✅ Inatividade logout (useInactivityLogout)
- ✅ Configuração de empresa por usuário

---

## 3. PROBLEMAS CRÍTICOS IDENTIFICADOS (AUDITORIA.md)

### 🔴 CRÍTICO - Corrigir Imediatamente

| Código | Problema | Evidência | Prioridade |
|--------|----------|-----------|------------|
| **C1** | **Isolamento multi-tenant quebrado** - Policies RLS baseadas apenas em role, sem org scoping. Qualquer admin/técnico lê/altera dados de todas as orgs. | Tabelas: `clientes`, `ordens_servico`, `itens_estoque`, `financeiro`, `orcamentos`, `rotas`, `movimentacoes_estoque`, `os_anexos`, `os_historico` com policies role-only | **P0 - Imediato** |
| **C2** | **`empresa_config` SELECT USING(true)** + credenciais de gateway em jsonb claro. Qualquer usuário autenticado lê chaves de pagamento de todas as orgs. | Migrations: `20260305130706`, `20260516205740` | **P0 - Imediato** |
| **C3** | **Backdoor de administração**: senha hardcoded no bundle (`douglas`/`#Va_Ds12`) + bypass via `localStorage`. | `AdminAuth.tsx:15-18,53`, `ProtectedRoute.tsx:23-26`, `useOrganization.tsx:27-32` | **P0 - Imediato** |
| **C4** | **`seed-platform-admin` público e destrutivo**: credenciais hardcoded, reseta senha a cada chamada, devolve senha na resposta. | `seed-platform-admin/index.ts:12-13,34,50` | **P0 - Imediato** |
| **C5** | **Webhooks sem assinatura e `verify_jwt=false`**: qualquer pessoa pode forjar pagamentos/desbloqueio de tenants. | `config.toml:3-10`, webhooks Asaacard/MP/ML | **P0 - Imediato** |
| **C6** | **Service role sem escopo de org**: `api/index.ts` CRUD total cross-tenant, proxy `asaas` opera conta da plataforma de qualquer org. | `api/index.ts:50`, `asaas/index.ts:40-53,142,186-192` | **P0 - Imediato** |
| **C7** | **`check-overdue-tenants` sem autenticação**: qualquer chamador bloqueia tenants em massa. | `check-overdue-tenants/index.ts:6-10` | **P0 - Imediato** |
| **C8** | **Banco não reproduzível**: `organizations`, `organization_id` e `get_user_org_id()` existem só no banco vivo. `supabase db reset` falha. | FASE-3 D1-D3, FASE-6 §6.4 | **P1 - Alta** |
| **C9** | **RPCs SECURITY DEFINER sem REVOKE**: `count_os_current_month`, `count_active_users` chamadas com `_org` arbitrário expõem métricas de qualquer org. | `20260516205740:26-36`, `useUsageLimits.tsx:36-37` | **P1 - Alta** |
| **C10** | **Migration destrutiva** `20260618123536`: TRUNCATE de 23 tabelas + `DELETE FROM auth.users` no histórico. | `20260618123536:2-28` | **P1 - Alta** |

### 🟠 ALTO - Priority Fixes

| Código | Problema | Evidência |
|--------|----------|-----------|
| **A1** | Trigger `handle_new_user_permissions` **nunca criada** → usuários novos sem linha → `usePermissions.tsx:37,40` fail-open concede OS/Estoque por default | `20260305123058:27-39`, `App.tsx:103-119` |
| **A2** | `signup-tenant` usa plano `'basic'` inexistente (fee 0), auto-confirma email, sem rate-limit/captcha | `signup-tenant/index.ts:38-47`, `CadastroEmpresa.tsx:26` |
| **A3** | `create-customer-charge` sem role check (consulta gera cobrança/PIX) e `cliente_id` não validado por org | `create-customer-charge/index.ts:24,40-51,55` |
| **A4** | `asaas-customer-sync` sem role/org check, usa chave da plataforma | `asaas-customer-sync/index.ts:29,37` |
| **A5** | `organizations` **sem policy SELECT p/ membros** no repo → `useOrganization:64-68` quebra se RLS for aplicada de fato | `20260516203159:68-74` |
| **A6** | `rotas.organization_id` existe só no vivo (drift) | `Rotas.tsx:62`, `types.ts:922` |
| **A7** | Webhooks do Asaacard/MP: `externalReference` do PayButton usa `numero` mas webhooks buscam por `id` → retorno não localiza a OS | `OrdensServico.tsx:770-776`, `asaas-tenant-webhook:25` |
| **A8** | `Deslocamentos.tsx` 100% mock; `EmpresaConfig.tsx:70` descarta campos; `Orcamentos.tsx:153-163` insere OS sem org | FASE-1 C7 |
| **A9** | `user_permissions` admin role-only (cross-tenant) | `20260305123058:22-24` |
| **A10** | `.env` versionado com credenciais; senhas hardcoded em múltiplos pontos | `.gitignore`, `AdminAuth.tsx:17`, `seed-platform-admin:13` |

### 🟡 MÉDIO / PROCESSO

- ✅ Sem testes, sem CI, typecheck só via build; 3 lockfiles (npm + bun) conflitantes
- ✅ SQL manual fora de migrations (`supabase/fix-missing-org-id.sql`, `add-platform-admin.sql`, `reset-platform-admin.sql`)
- ✅ CORS `*` em todas as edge functions
- ✅ Storage `os-anexos` role-only sem org
- ✅ Senha mínima 6 chars; sem MFA/lockout; `signup-tenant` e `create-user` auto-confirmam email
- ✅ Logout por inatividade não desloga (`useInactivityLogout.ts:40-45`)
- ✅ Dois toasters montados; planos vazios na landing anônima

---

## 4. PRIORIDADE DE CORREÇÃO SUGERIDA

### Fase 1 - Crítico (1-2 semanas)
1. **Sangramento de dados / RLS** (C1, C2, C9, A5) - policies org-scoped em todas as tabelas + `empresa_config`; REVOKE/restrição das RPCs
2. **Portas de entrada** (C3, C4, C6, C7, C5) - remover backdoor e credenciais hardcoded; auth real de platform admin; validar org nas edge functions; assinar/validar webhooks; remover endpoints públicos sem auth
3. **Reprodução** (C8, C10) - criar `organizations`, colunas `organization_id` e `get_user_org_id()` via migrations; remover/mover scripts manuais; revisar a migration destrutiva

### Fase 2 - Alta (2-3 semanas)
4. **Gates de acesso** (A1, A2, A3, A4) - trigger de permissões, plano válido no signup, role/org checks nas functions
5. **Qualidade** (FASE-6) - testes de migrations, CI, lockfile único, documentação

### Fase 3 - Media (1 mês)
6. **UX e rotas** - bugs funcionais por página, proteção de rotas, experiência do usuário

---

## 5. RECOMENDAÇÕES POR ÁREA

### 5.1 Segurança e Multi-Tenant
- [ ] **RLS Policies**: Substituir todas as policies `USING((role = 'admin' ...))` por policies org-scoped usando `get_user_org_id()` e `is_admin_or_tecnico()`
- [ ] **empresa_config**: Mudar `SELECT USING(true)` por `USING((organization_id = current_setting('app.organization_id')::uuid))` ou política similar; migrar credenciais para tabela separada com RLS por org
- [ ] **Remover backdoor**: Substituir `AdminAuth.tsx` por login real via Supabase Auth; remover `localStorage.admin_bypass` flag
- [ ] **Edge functions**: Adicionar validação de `organization_id` em `api/index.ts` e `asaas/index.ts`; remover service role sem escopo

### 5.2 Autenticação
- [ ] **Admin login**: Substituir credenciais hardcoded por fluxo normal do Supabase Auth; se precisar de admin master, usar convite/convite de onboarding
- [ ] **Signup tenant**: Validar plano existente (`bronze`, `prata`, `ouro`); adicionar rate-limit e CAPTCHA; remover auto-confirmation sem verificação

### 5.3 Webhooks e Pagamentos
- [ ] **Assinatura de webhooks**: Implementar HMAC verification no `config.toml` (`verify_jwt=true`) e validar payloads nos handlers
- [ ] **`check-overdue-tenants`**: Adicionar auth/rate-limit; remover ou proteger endpoint
- [ ] **`test-tenant-gateway`**: Remover ou proteger endpoint

### 5.4 Banco de Dados
- [ ] **Migration reproduzível**: Criar função `get_user_org_id()` via migration; criar table `organizations` via migration; remover scripts manuais
- [ ] **Migration destrutiva**: Revisar `20260618123536` - fazer backup, testar em ambiente isolado, considerar remoção ou versionamento adequado

### 5.5 Funcionalidades e UX
- [ ] **Trigger `handle_new_user_permissions`**: Criar trigger SQL que popula `user_permissions` automaticamente ao criar novo usuário
- [ ] **Permissões user**: Corrigir `usePermissions.tsx` fail-open para não conceder acesso por default
- [ ] **Rotas mock**: `Deslocamentos.tsx` implementar conexão real com API
- [ ] **PDF share**: Validar e corrigir import `@/lib/os-pdf-share` e `html2canvas` CORS issues

### 5.6 Qualidade
- [ ] **CI/CD**: Configurar pipeline único (remover conflitos npm/bun); adicionar testes de unit/integration
- [ ] **Lockfiles**: Consolidar para um único format (npm ou bun, não os dois)
- [ ] **Documentação**: Atualizar README, API docs, diagrama de arquitetura
- [ ] **Testes**: Criar testes críticos para RLS policies, auth flows, e cálculos de comissão

---

## 6. ARQUITETURA E FLUXO DE DADOS

### 6.1 Fluxo de Criação de OS
```
Usuário → Formulário Wizard (Index/OrdensServico) → 
Supabase Tables: profiles → ordens_servico → itens_os → os_checklist_itens →
RPCs: calculate_os_commission → Dashboard/KPI update
```

### 6.2 Fluxo de Pagamento
```
Usuário → Cobrança (Financeiro/Cobrancas) → 
Supabase Functions: asaas (create_payment) → 
Supabase Tables: financeiro → ordens_servico (valor_final, status) →
Webhooks Asaacard/MP → atualização automática de status →
```

### 6.3 Fluxo de Dashboard Data
```
useOrganization → supabase queries (com RLS) → 
KPI calculations → formatters → MainLayout render
```

---

## 7. CONCLUSÃO

O sistema **LivreOS** tem uma base funcional sólida com todas as features esperadas para um SaaS de gestão de OS. O códigobase é bem estruturado com componentes reutilizáveis (shadcn/ui), hooks personalizados e integrações externas.

No entanto, as **falhas de segurança críticas** (C1-C10) representam riscos significativos:
- Vazamento de dados entre clientes (multi-tenant broken)
- Credenciais de pagamento expostas
- Acesso não autorizado ao admin master
- Falsificação de pagamentos
- Banco não reproduzível ambientes novos

**Recomendação**: Iniciar correções pela Fase 1 (CRITICAL) imediatamente, priorizando:
1. RLS policies org-scoped
2. Remoção de backdoors e credenciais hardcoded
3. Assinatura de webhooks
4. Reprodução do banco de dados

Após as correções críticas, prosseguir para Fase 2 (ALTAS) e Fase 3 (MÉDIAS) conforme plano definido.

---
*Relatório gerado baseado em análise estática do repositório e cruzamento com AUDITORIA.md (FASE 0-6). Nenhum código foi modificado durante esta análise.*