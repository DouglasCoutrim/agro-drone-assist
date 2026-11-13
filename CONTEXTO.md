# CONTEXTO / RELATÓRIO DE TRABALHO — agro-drone-assist

> Documento de referência para retomar o trabalho. Atualizado ao fim de cada sessão.
> Ao reiniciar, leia este arquivo e confirme em qual etapa paramos.

## Status atual (última atualização: 2026-11-13 — ver seção 6)

**Em andamento — "Módulo do Técnico / Comissionamento / Oficina ao Vivo".**
Código **completo e compilando** (`npx tsc --noEmit` sem erros). Faltam **somente** etapas de deploy/dados (abaixo).

---

## 1. O que foi feito nesta sessão

### Módulo de Comissionamento Configurável (admin configura o perfil do técnico)
- `supabase/migrations/20260803140000_tecnico_comissao_profile.sql`
  - Colunas em `profiles`: `commission_on_services`, `service_commission_type`, `service_commission_value`, `commission_on_products`, `product_commission_type`, `product_commission_value`.
  - Policy RLS aditiva `Org admins update profiles` (admin da mesma org).
  - Trigger `protect_profile_commission` — impede que o próprio técnico altere a própria comissão.
- `src/components/commission/CommissionEditor.tsx` — UI de admin para parametrizar % ou R$ fixo por serviço/peça.
- Integrado em `src/pages/Equipe.tsx` (admin vê o editor nos perfis de técnico; `fetchUsers` usa `select('*')`).
- Tipos atualizados em `src/integrations/supabase/types.ts`.

### Cálculo automático de comissão na OS
- `supabase/migrations/20260803150000_comissao_os_dashboards.sql` — colunas `commission_services`, `commission_products`, `commission_total`, `commission_computed_at` em `ordens_servico`.
- RPC `calculate_os_commission(_os_id)` — SECURITY DEFINER, soma separada serviços (mão de obra) e produtos e grava o total.
- Disparado em `OrdensServico.tsx`: ao **salvar/editar** (`handleSave`) e ao **mudar status** (`applyStatusUpdate`).

### Dashboard do Técnico (`/technician/dashboard`)
- `src/pages/TechnicianDashboard.tsx` — KPIs (Realizadas mês / Estimadas mês / Serviços Concluídos), Kanban de 5 colunas, Fila Prioritária.
- RPC `get_technician_dashboard(_tecnico_id)` — somente o próprio técnico ou admin da mesma org (RBAC).

### Oficina ao Vivo / Modo TV (`/workshop/live`)
- `src/pages/WorkshopLive.tsx` — Dark mode, KPIs globais, feed da oficina, polling 12s, efeito sonoro em entrada/finalização.
- RPC `get_workshop_board()` — org do chamador (SECURITY DEFINER).

### Apoio / routing
- Rotas em `src/App.tsx`; itens da `Sidebar`.
- Migration `20260803130000_segmentos_org_rls_policy.sql` — libera UPDATE de `organizations.settings` (segmentos).
- Correção de bug em `src/hooks/useOrgSegments.tsx` (salvar sem vazar dados antigos + `reload()` após salvar).
- `src/lib/equipment-segments.ts` — novos tipos/segmentos (sensores RTK, hélices/motores, fontes/placa-mãe, freios hidráulicos, etc.).

---

## 2. PENDENTE — ainda NÃO feito

1. **Aplicar as 3 migrations no Supabase hospedado** (projeto `iynljexyjhbkfxsurddn`):
   - `20260803130000` → `20260803140000` → `20260803150000` (nesta ordem; são idempotentes).
   - **Forma**: SQL Editor no painel do Supabase, OU via CLI (`supabase db push` após `supabase login` + `supabase link`).
   - **Credenciais necessárias (CLI)**: access token (supabase.com -> Account -> Access Tokens) como `SUPABASE_ACCESS_TOKEN` + senha do banco do projeto. Alternativa mais simples: colar o SQL no dashboard.
   - **Sem as migrations, os campos de comissão e as RPCs não existem no banco** — as telas novas vão falhar em execução.

2. **Build de produção local quebra por problema pré-existente de ambiente** (NÃO causado pelo módulo; confirmado com `git stash`):
   - `node_modules/@supabase/supabase-js` incompleto (faltam `dist/esm`), o PWA plugin não resolve o entry ESM.
   - Causa provável: conflito de lockfiles (`bun.lock` + `package-lock.json`).
   - Para resolver: reinstalar deps com um só gerenciador (ex.: `bun install`). **O usuário pediu para NÃO fazer build local** — apenas commitar/push. O build do deploy (Vercel/Netlify, via Cloud) fará a instalação limpa.

---

## 3. Decisão do usuário (importante)

- **NÃO rodar build local.** Sempre **commit + push** no final da sessão.
- **Sempre atualizar este `CONTEXTO.md`** ao final, para retomar de onde paramos.
- Branch atual: `main`. Remote: `https://github.com/DouglasCoutrim/agro-drone-assist.git`.

---

## 4. Próximos passos sugeridos (amanhã)

1. Aplicar as 3 migrations no Supabase (ver item PENDENTE acima).
2. Testar manualmente: configurar comissão num técnico (página Equipe), criar/editar a invocar a OS, conferir `commission_total`, abrir `/technician/dashboard` e `/workshop/live`.
3. (Opcional) garantir deploy com deps limpas se o build da nuvem falhar por conta do `@supabase/supabase-js`.

---

## 5. Segurança / RBAC verificado

- RPCs são SECURITY DEFINER e validam org do chamador + RBAC (próprio técnico ou admin da mesma org).
- Policy de auto-update do perfil (`Users can update their own profile`) **preservada**; nova policy de admin é aditiva; trigger protege comissão de edição não-admin.
- `itens_os.tipo` usa valores `'servico'`/`'produto'` — coincide com o CASE do RPC.

---

## 6. Sessão 2026-11-13 — P0: venda e estoque escritos no banco

**Feito e verificado**

- RPCs aplicadas no Supabase: `public.ajustar_estoque(_item_id,_delta,_motivo,_origem_tipo,_origem_id)` e `public.criar_venda(_payload jsonb)` — plpgsql, SECURITY INVOKER, `search_path=public`. Migrations em `supabase/migrations/20261003130000_p0_estoque_venda_rpc.sql` e `20261003140000_p0_criar_venda_linhas_catalogo.sql`.
- `criar_venda` cobre três tipos de linha: produto (`itens_estoque` — preço, teto de desconto, NCM, CFOP e nome do catálogo, com baixa de estoque), serviço (`servicos` — preço = GREATEST(preco, valor_fixo, valor_hora), sem estoque) e item livre (nome e preço digitados, sem estoque). Também grava `nfe_dados` e `ambiente`, senão a emissão de NF-e perde a configuração da venda.
- `src/hooks/useVendasData.ts` migrado: `createVenda` chama a RPC e recarrega a venda gravada (mesmo retorno de antes), `ajustarEstoque` (usado por `updateVenda` e `cancelarVenda`) chama a RPC. O PDV envia `servico_id` e mostra o preço do cadastro como somente leitura; em Vendas o preço só é editável na linha livre.
- Verificação executada: bloco `DO` assumindo um usuário real via `request.jwt.claims` criou uma venda de produto, uma de serviço e uma com item livre e abortou no fim (rollback, nada ficou gravado). Resultado: preço do catálogo venceu o valor enviado pelo navegador (2 x 1100 = 2200), desconto de 5% = 110, estoque 5 -> 3 com 1 movimentação, serviço e item livre sem estoque, item livre totalizando 15, desconto de 150% rejeitado. `tsc` sem erros nos arquivos alterados.

**Pendente (próxima fatia)**

- `updateVenda` ainda reescreve `venda_itens` no navegador, com preços vindos da tela: precisa de uma RPC `editar_venda` para valer a mesma regra aplicada na criação.
- Outros escritores de estoque ainda não passam por `ajustar_estoque`: a tela Estoque (grava valor absoluto), `ImportarXmlNfe` e as RPCs `transferir_estoque_tecnico`, `devolver_estoque_central`, `criar_saida_demonstracao`, `concluir_saida_demonstracao`.
- `CHECK (quantidade >= 0)` segue comentado até todos os escritores passarem pela RPC (pré-condição conferida: nenhum item com saldo negativo hoje).
- Sem cobertura e2e: `@playwright/test` não está instalado (dependência recusada anteriormente).
