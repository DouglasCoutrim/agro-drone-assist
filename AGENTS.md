# Decisões técnicas

- Use one shared partner form for organization-scoped suppliers and carriers, with counted server pagination and role-protected writes, to keep both registers consistent and isolated.
- PremiumTable paginates record lists by default; external pagination supplies server totals and nested item editors may disable it, so records remain reachable without rendering every row.
- Desktop and mobile navigation share NavModules and navConfig, so module grouping and destination availability stay synchronized.
- Load external fonts through a document-head link rather than CSS imports, so CSS compilation never resolves remote font URLs as local files.
- Sale creation follows router navigation and resets the form on every navigation entry; closing returns to the sale list so repeated menu clicks cannot reuse an edited sale.
- Guard quote-to-OS conversion with the shared canConvertOrcamento predicate in both the action and UI, because combined quotes already represent existing service orders.
- Shared dialogs provide mobile padding and vertical scrolling by default; callers with dedicated scroll bodies may override these defaults explicitly.

- Logos das empresas ficam no bucket público `logos`, em pastas identificadas pela organização; leitura pública serve telas e PDFs, enquanto gravação é restrita ao administrador da própria organização.
- No estoque, `custo_unitario` e `preco_venda` são entradas independentes; importações não devem calcular margem automaticamente para preservar o preço escolhido pelo usuário.
- A instalação na tela inicial usa somente manifestos e ícones; não gerar nem registrar Service Worker de cache, e manter `/sw.js` temporariamente apenas como encerramento do Workbox antigo.
- Build da aplicação deve preferir variáveis públicas gerenciadas de conexão e fornecer fallback público específico do projeto via configuração do Vite, porque a publicação pode omitir `.env` e deixar a tela vazia.
- Keep assistant assignments, commissions, and internal OS notes in staff-only views; customer-facing PDF and messages must use explicit customer-facing fields, because internal compensation must not leak to clients.
- Ao editar uma OS, preservar o orçamento sem lançamentos detalhados e atualizar os itens por identidade, confirmando exclusões antes de salvar; substituir toda a lista apaga lançamentos quando uma leitura falha.
- Autorizar edição de comissões pelo papel `admin` somente para perfis com papel `tecnico` da mesma organização, mesmo quando um usuário acumula os dois papéis; a verificação deve ficar no banco para impedir contorno pela interface.- Peças lançadas em OS/orçamento vêm de `itens_estoque` (gravadas em `itens_os.item_estoque_id`); `produto_id` fica só para lançamentos legados, porque o catálogo `produtos` não reflete o estoque.

- Retired assistant and tax-retention screens must not perform background reads or replace historical assignments during OS edits; retain stored historical tables and commission RPCs until a separate data-aware retirement is approved.
- Team management belongs to Equipe; Configuracoes keeps personal profile, password and organization segments without duplicate member queries or non-persistent notification controls.
- Keep redirects for retired product and retention pages so existing bookmarks resolve to supported screens.

- Technician financial summary and statement read principal commission_total from ordens_servico, not retired os_technicians/retention ledgers, so new OS commissions remain visible without assistant assignments.
- Tailwind configuration must use global CSS theme tokens and native scales, never import the retired design-system module, so stylesheet compilation remains independent of removed application files.

- Web push uses a dedicated /push-sw.js worker scoped to /push/ (no caching) and a notifications INSERT trigger that calls send-web-push, which re-reads the notification server-side and only sends recent ones, so the public trigger call cannot be abused to spoof messages.
- Purchase orders (pedidos_compra) group solicitacoes_compra items by sector; items remain the unit for supplier quotations, so only pending items are editable.
- Purchase-order drafts store a base revision and restore only against fresh matching server data; saves recheck that revision and scope item mutations to pending rows, so stale drafts cannot replace current quotations or new items.
- Received-invoice actions decode handled HTTP error response bodies before showing a fallback, so configuration and provider guidance reach the user.
- Stock product photos store only an external URL (itens_estoque.imagem_url) found via the buscar-imagem-produto function (Firecrawl image search), so images are not kept in Storage.
- Tool depreciation is computed client-side from purchase value, purchase date, useful life and residual percentage (src/lib/depreciacao.ts), so the reimbursement value is always current without scheduled jobs; non-admins only read tools assigned to themselves via RLS.
- User access is a list of blocked menu hrefs (user_permissions.rotas_bloqueadas) checked against navConfig by menu and ProtectedRoute, so new menu items are allowed by default and the permission screen always mirrors the menu; acesso_* columns are legacy.
- Per-item discount: the admin sets `desconto_maximo_percentual` on itens_estoque/servicos; the buyer enters a percentage that is converted to R$ and clamped to that cap (src/lib/desconto.ts) in orçamentos/OS (OSItemsSection) and vendas. OS items snapshot the cap in itens_os so the limit survives reloads.
- Fechamento do dia: `resumo_vendas_dia(date)` (SECURITY INVOKER, org-scoped) returns the day's totals and `por_forma`; `fechamentos_dia` stores one row per (organization_id, data) with the summary plus optional `dinheiro_contado`/`observacao`, written by any authenticated member of the org (no admin-only restriction). UI lives in `src/components/relatorios/FechamentoDia.tsx`, rendered inside Relatórios and independent of its `periodo`/`loading` gate.
- RLS helpers live in the `private` schema (`private.get_user_org_id`/`has_role`/`is_admin_or_tecnico`/`is_platform_admin`/`get_user_role`/`set_user_roles`), with SECURITY INVOKER wrappers in `public`. If `private` is missing, every org-scoped policy fails with `schema "private" does not exist`; restore it from `supabase/migrations/20260921160017_*` + `20260922131115_*` + `20260922131134_*`.
- Fiscal operations live in separate /fiscal/* screens sharing src/components/fiscal/fiscalShared.tsx; sale-return notes keep venda_id empty and link via nota_origem_id, because the Focus webhook writes the note number onto the sale whenever venda_id is set.
- Sales may mix services and parts; service lines use produto_id null + ncm '00' (src/lib/venda-servico.ts), and NF-e is blocked for them in PDV, NfeVenda and emitir-nfe-venda, because SEFAZ NF-e only accepts goods.
