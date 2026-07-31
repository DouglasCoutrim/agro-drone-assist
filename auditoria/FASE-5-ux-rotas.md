# FASE 5 — Experiência/UX e Bugs Funcionais de Rotas

Data: 2026-07-31 · Escopo: rotas/proteção, comportamento por página, UX geral. Bugs já listados nas fases anteriores são consolidados aqui sem duplicar profundidade.

---

## 5.1 — Rotas e proteção de acesso (`src/App.tsx:92-122`)

| Rota | Proteção | Observação |
|------|----------|-----------|
| `/auth`, `/landing`, `/cadastro-empresa`, `/reset-password`, `/admin/login` | pública | — |
| `/admin/dashboard` | `requiredPlatformAdmin` | na prática liberado por `admin_bypass` (FASE-4 S1) |
| `/ordens-servico`, `/deslocamentos`, `/orcamentos`, `/rotas` | `acesso_os` | gate por permissão |
| `/estoque` | `acesso_estoque` | gate por permissão |
| `/financeiro`, `/cobrancas` | `acesso_financeiro` | gate por permissão |
| `/configuracoes`, `/equipe`, `/empresa`, `/assinatura` | `requiredRole="admin"` | — |
| `/servicos`, `/relatorios`, `/clientes`, `/suporte`, `/notificacoes`, `/wiki` | **só autenticado** | sem role/permission |

### 🟠 R1 — Rotas de negócio sem gate de papel/permissão

- `/relatorios` liberada para qualquer autenticado — papel `consulta` acessa KPIs agregados de faturamento/OS/estoque (`Relatorios.tsx:49-53,98`) e, por falta de filtro de org, de **todas as orgs** (FASE-1 C1).
- `/clientes` sem `requiredPermission` — papel `consulta` pode ler a base de clientes (RLS permite qualquer autenticado). Pode ser intencional, mas não está documentado.

### 🟠 R2 — Gate de permissão falha aberto (fail-open)

`usePermissions.tsx:37` devolve `{ acesso_os: true, acesso_estoque: true, acesso_financeiro: false }` quando não há linha (trigger órfão — FASE-3 D7) e `:40` o mesmo no erro. Como `ProtectedRoute.tsx:79-98` só bloqueia quando a permissão **existe e é false**, usuários novos (e qualquer `consulta`) têm **OS, Estoque, Orçamentos, Rotas e Deslocamentos abertos** por default.

### 🟢 R5 — Pontos que funcionam

- Orgs bloqueadas redirecionam para `/mensalidade-em-atraso` (com `allowBlocked`) e `/assinatura` permite pagar (`App.tsx:97,116`; `ProtectedRoute.tsx:48-50`).
- Página de OS bem scoped à org (17 de 17 queries com `organization_id`).
- Dashboard (`Index.tsx`) 100% scoped (`:74-80`).
- `Financeiro.tsx` insere com org e lê com org (`:48,65`).

---

## 5.2 — Bugs funcionais por página

| Página | Bug | Evidência |
|--------|-----|-----------|
| `Deslocamentos.tsx` | **100% mock** — zero queries; nada é persistido | `:25-28`, `:103-121` |
| `EmpresaConfig.tsx` | `taxa_bancada`/`prazo_diagnostico`/`garantia` **nunca persistidos** | `:70` descarta; `:54-56`/`:100-102` resetam p/ `""` |
| `Orcamentos.tsx` | lista de orçamentos e dropdown de clientes **sem filtro de org** (`:90-91`); conversão→OS insere sem org (`:153-163`); `orgId` carregado em `:82-83` e nunca usado nas listagens | `:90-91,153-163` |
| `Relatorios.tsx` | 5 queries sem org — exibe KPIs/financeiro/estoque de **todos os tenants** | `:49-53,98` |
| `Clientes.tsx` | verificação de CPF/CNPJ duplicado sem filtro de org → falso positivo entre tenants | `:66` |
| `Cobrancas.tsx` | dropdown de clientes sem filtro de org (cross-tenant) | `:42` |
| `Rotas.tsx` | filtra por `organization_id` mas a coluna **não existe nas migrations** | `:62` + FASE-1 C5 |
| `Configuracoes.tsx` | deletar usuário remove `profiles`/`user_roles` mas **não remove `auth.users`** → usuário continua existindo e pode logar | `:121-122` |
| `Equipe.tsx` | idem delete; senha do novo usuário trafega em texto claro no body (`create-user:55`) | `:98-100`, `:121` |
| `Equipe.tsx` | leitura de `user_permissions` sem filtro de org (RLS role-only) — admin vê permissões de todas as orgs | `:52` |
| `Assinatura.tsx` | poll de status de invoice por `id` — ok, mas depende de `create-subscription-checkout` que usa `getClaims` (FASE-1 C7) | `:59` |
| `Landing.tsx` | planos vazios para visitantes (policy `TO authenticated`) | `:58-60` |
| `Notificacoes.tsx` | zero queries — depende de Realtime/estado local | — |
| `Servicos.tsx` | scoped (2 refs org em 4 queries) — ok | `:49-53` |

---

## 5.3 — UX e estado de bloqueio

- **Logout por inatividade não dispara**: `useInactivityLogout.ts:40-45` chama `reset()` (renova o timer) em vez de `signOut()`; `:94` `visibilitychange` também reseta em vez de logar. A sessão fica ativa indefinidamente em dispositivos compartilhados.
- **Portal admin enganoso**: `PlatformSidebar.tsx:106` rotula qualquer usuário com bypass como "Super Administrator".
- **PWA**: flags de `isPWA` por query/sessionStorage/media query (`App.tsx:53-79`) — razoável, mas fragmentado.
- **Notificação visual inconsistente**: dois Toasters montados (`Toaster` + `Sonner`, `App.tsx:85-86`).
- **PDF client-side** (html2canvas + jsPDF): commit recente corrigiu PDF em branco (`f3d6cf4`), mas geração local depende de renderização do DOM — frágil para OS longas.

---

## 5.4 — Sugestões de baixa prioridade (sem implementar agora)

1. Mover `/clientes` e `/relatorios` para gates explícitos (papel/permissão) e documentar a intenção.
2. Persistir os campos de `EmpresaConfig` ou removê-los da UI.
3. Implementar o trigger `handle_new_user_permissions` (resolve o fail-open na origem, FASE-3 D7).
4. Fazer o logout por inatividade deslogar de fato.
5. Unificar o sistema de toasts.
