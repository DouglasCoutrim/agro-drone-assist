# CONTEXTO / RELATÓRIO DE TRABALHO — agro-drone-assist

> Documento de referência para retomar o trabalho. Atualizado ao fim de cada sessão.
> Ao reiniciar, leia este arquivo e confirme em qual etapa paramos.

## Status atual (última atualização: 2026-11-13 — ver seções 6, 7 e 8)

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

## 6. Sessão 2026-11-12/13 — P0: venda e estoque escritos no banco

**Entregue**

- RPCs no Supabase (plpgsql, SECURITY INVOKER, `search_path=public`): `ajustar_estoque`, `criar_venda`, `venda_linha_calcular`, `editar_venda`, `cancelar_venda`. Migrations em `supabase/migrations/20261003130000_*`, `20261003140000_*`, `20261003150000_*` (teto de desconto zero) e `20261003160000_*` (edição/cancelamento).
- `criar_venda` e `editar_venda` compartilham `venda_linha_calcular`: produto de estoque (preço, teto, NCM, CFOP e nome do catálogo, quantidade inteira, movimenta estoque), serviço (`GREATEST(preco, valor_fixo, valor_hora)`, sem estoque) e item livre (nome/preço digitados, sem estoque). Totais, `nfe_dados` e `ambiente` ficam no servidor.
- Front migrado (`src/hooks/useVendasData.ts`, `PDV.tsx`, `Vendas.tsx`): a tela só envia as escolhas do operador, preço de catálogo é somente leitura e a quantidade de item de estoque é inteira.
- `updateVenda`/`cancelarVenda` agora chamam `editar_venda`/`cancelar_venda`; o cancelamento é idempotente e recarrega o saldo.

**Decisões tomadas nesta sessão**

- Teto de desconto: 0 = sem teto (até 100) nos dois caminhos. O trigger `enforce_itens_os_price` zerava o desconto quando o teto era 0, então nenhum usuário não-admin conseguia dar desconto em OS; como nenhum item tem teto configurado, a correção não afrouxa limite configurado nenhum.
- Estoque não aceita fração: `ajustar_estoque` recusa delta fracionado e a venda recusa quantidade fracionada em item de catálogo (era arredondamento silencioso). Não havia linha de venda fracionada no banco (0 de 28).
- `vendas.numero` segue sequencial por organização (`VND-#####`), com trava `pg_advisory_xact_lock`.

**Verificado (com rollback, sem gravar nada)**

- Criação: preço do catálogo vence o do navegador (2 x 1100 = 2200, total 1980 com 10%); edição: preço de 99999 enviado pela tela ignorado, total 2970 para 3 unidades.
- Estoque 5 -> 3 (venda) -> 2 (edição de 2 para 3) -> 5 (cancelamento), com 1 movimento por alteração.
- Recusas confirmadas: quantidade fracionada, ajuste fracionado, cancelar duas vezes, editar venda cancelada, desconto acima do teto.
- Trigger da OS com teto 0 e usuário não-admin mantendo o desconto de 220,00.
- `tsc` sem erros no projeto.

**Pendente / próximo**

1. Teste manual com as três contas (admin, técnico, consulta) no PDV e em Vendas — inclusive o perfil `consulta`, que precisa ser recusado pelo RLS. O teste de SQL rodou com papel privilegiado e não exerceu RLS.
2. Migrar a tela de Estoque e `ImportarXmlNfe` para `ajustar_estoque` (hoje gravam saldo absoluto) junto das RPCs `transferir_estoque_tecnico`, `devolver_estoque_central`, `criar_saida_demonstracao` e `concluir_saida_demonstracao`.
3. Ligar o `CHECK (quantidade >= 0)` só depois de (2); pré-condição conferida: nenhum saldo negativo hoje.
4. Decidir se administrador continua podendo gravar preço/desconto livres em item de OS (o trigger libera admin sem travas).
5. Sem cobertura e2e: `@playwright/test` não está instalado (dependência recusada antes).

---

## 7. Sessão 2026-11-13 — Relatório genérico (Fase 1)

**Entregue**

- Catálogo `public.relatorio_fontes` (8 fontes: ordens_servico, vendas, clientes, itens_estoque, movimentacoes_estoque, financeiro, nota_fiscal_emitida, fornecedores) com `colunas` (nome/rótulo/tipo), `filtros`, `coluna_data` e `perfis`. Leitura liberada a `authenticated`; escrita só para platform admin.
- `public.gerar_relatorio(_fonte, _colunas, _filtros, _data_inicio, _data_fim, _limite)` — SECURITY INVOKER, `search_path = public`, retorna `{fonte, rotulo, colunas, linhas, total_linhas, limitado}`.
- Migrations `supabase/migrations/20261003170000_relatorio_fontes.sql` e `20261003180000_gerar_relatorio.sql` (ambas já aplicadas no Supabase).
- Tela: nova seção "Relatório personalizado" em `src/components/relatorios/RelatorioPersonalizado.tsx`, montada em `Relatorios.tsx` abaixo do conteúdo que já existia (nada foi removido), com fonte, período, limite, colunas, filtros, tabela de resultado, "Exportar CSV" (papaparse, cabeçalho com os rótulos em português) e "Gerar PDF".
- PDF do relatório pelo gerador padrão do sistema (`gerarDocumentoPadrao`, cabeçalho da empresa, tabela paginada e rodapé "Página X de Y"), em **paisagem**, com largura de coluna proporcional ao conteúdo real e valores numéricos alinhados à direita. O PDF descreve os critérios usados (período e filtros) e avisa quando o resultado está limitado. `pdf-padrao` ganhou o campo opcional `orientacao`; sem ele nada muda nos PDFs já existentes (recibo, orçamento, OS).
- Valores financeiros com R$: as colunas de dinheiro do catálogo passaram de `numero` para `moeda` (migration `20261003190000_relatorio_moeda.sql`), separando valor de quantidade. Tela, CSV e PDF usam `formatCurrency` para `moeda`; `quantidade`/`estoque_minimo` continuam número puro. O filtro em coluna de dinheiro passou a comparar como número — medido em Vendas: 20 registros com comparação numérica contra 17 se fosse comparação de texto.
- Legibilidade do PDF corrigida (mesma sessão): a primeira versão distribuía a largura das colunas por quantidade de caracteres, o que dava peso de texto às colunas estreitas e partia `R$ 3.049,44` e `VND-00026` no meio. Agora `pdf-padrao` mede o texto com `getTextWidth` (`tabela.ajustarLargura`): o mínimo de cada coluna é o maior pedaço que não pode ser quebrado — valor inteiro nas colunas alinhadas à direita —, a sobra vai para as colunas de texto longo e o corpo cai de 8,5 até 6 quando não cabe. O relatório também passou a abrir com os campos principais da fonte (6 colunas em Vendas) em vez de todas as 14.

**Decisões tomadas nesta sessão**

- Nome de tabela e de coluna **nunca** vêm do navegador: a tela envia só o `id` da fonte e as chaves de coluna/filtro, e a função confere cada chave contra o catálogo antes de montar o SQL (`format('%I')` para identificador, `format('%L')` para valor).
- Organização sempre por `public.get_user_org_id(auth.uid())`, nunca por parâmetro. Como a função é SECURITY INVOKER, o RLS das tabelas de origem soma-se a esse filtro.
- Perfil sem acesso e fonte inexistente devolvem a **mesma** mensagem ("Acesso negado a esta fonte"), para não revelar o catálogo. Papéis definidos: `admin` e `tecnico` nas fontes operacionais, `consulta` **apenas** em Clientes, `admin` em Estoque/Financeiro/Notas fiscais.
- Dados fora do catálogo por decisão: CPF/CNPJ, `asaas_id`, `custo_unitario`, `custo_pecas`/`custo_mao_obra`, `commission_*`, XML/payloads de NF-e e colunas de usuário responsável.
- Período em coluna com hora (`timestamptz`) é convertido pelo fuso da empresa (`business_tz()`, America/Sao_Paulo); colunas `date` comparam direto.
- Total contado com `count(*) over()` antes do limite, para `limitado` informar que a tela mostra só parte dos registros. Limite aceito entre 1 e 10000.
- Fase 1 não faz join: `item_id`, `ordem_servico_id` etc. aparecem como id, sem descrição (fase 2).

**Verificado (blocos `DO` somente leitura, sem gravar nada)**

- Coluna fora do catálogo -> `Coluna inválida`; usuário `consulta` em `financeiro` -> `Acesso negado a esta fonte`; filtro em coluna não permitida -> `Filtro inválido`; operador `drop table` -> `Operador inválido`.
- Fonte válida: 19 linhas da própria organização contra 25 no total, provando que o filtro de organização é efetivo.
- Todos os caminhos de SQL exercitados nas 8 fontes: texto (`ilike`, `in`, `not_null`), numérico (`gt`/`gte`/`lte`), data, booleano (`eq`/`neq`), `is_null` e período em `timestamptz`. Em movimentações, 134 registros com limite 100 confirmam o total preservado antes do limite.
- `tsc` sem erros no projeto.

**Pendente / próximo**

1. Teste manual da tela com as três contas (admin, técnico, consulta) — os testes de SQL rodaram com papel privilegiado e não exercitaram o RLS das tabelas de origem.
2. Fase 2 do relatório: joins para trazer descrição no lugar de id, agrupamentos e totais por coluna.
3. Sem cobertura e2e: `@playwright/test` não está instalado (dependência recusada antes).

---

## 8. Sessão 2026-11-13 — Auditoria: quem fez o quê

**Entregue**

- Tabela `public.audit_trail` (organização, tabela, registro, ação INSERT/UPDATE/DELETE, campos alterados, `antes`/`depois` em jsonb, usuário + nome/e-mail, data) com 4 índices e RLS.
- Gatilho `public.audit_row()` (SECURITY DEFINER) instalado como `trg_audit` em **42 tabelas** de negócio, e a função de mascaramento `public.audit_valor()`.
- Tela `/auditoria` (`src/pages/Auditoria.tsx`), restrita ao papel `admin`, no menu Configurações: filtros (período, usuário, ação, tela, busca por id do registro ou por nome do campo alterado), paginação no servidor, detalhe campo a campo em diálogo e exportação CSV. Rota em `App.tsx` e item em `navConfig.ts`.
- Migration `supabase/migrations/20261003200000_auditoria_trilha.sql` (aplicada).

**Decisões tomadas nesta sessão (definidas pelo usuário nas 5 perguntas)**

- Escopo: só alterações de dados. Login, logout, troca de senha e eventos de acesso ficaram de fora desta fase.
- Detalhe: somente os campos que mudaram, com valor antes e depois.
- Leitura: apenas admin da própria organização (policy de platform admin criada, mas a rota exige papel `admin` na organização).
- Sensível: CPF/CNPJ mascarados (3 primeiros + 2 últimos); credencial, token, chave, certificado, XML e payload entram como `***` sem o valor real.
- A trilha é **append-only**: não existe policy de UPDATE nem DELETE, então nem o admin apaga ou reescreve o registrado; a escrita vem só do gatilho.

**Verificado (bloco `DO` com rollback, nada ficou gravado)**

- UPDATE em `clientes` gerou linha com `campos=[nome, cpf_cnpj]`, `antes`/`depois` só com esses dois campos e o documento mascarado (`123***01`); o nome do usuário foi resolvido (`Kamilly Côrtes`).
- UPDATE em `venda_itens` (tabela sem `organization_id`) herdou a organização da venda.
- UPDATE que só mexe em `updated_at` não gerou linha.
- RLS: admin da organização viu 1 das 2 linhas de prova (a de fora ficou invisível) e técnico viu 0.
- `count(*)` da trilha depois do teste: 0.

**Pendente / próximo**

1. A trilha começa agora: não existe histórico do que foi feito antes desta data.
2. Tabelas sem `organization_id` ficaram fora: `user_roles`, `user_permissions`, `os_apontamentos_horas`, `patrimonio_movimentacoes`, `nota_fiscal_itens`, `segmentos` e `wiki_*`. Auditar papéis e permissões exige derivação de organização (como foi feito com `venda_itens`).
3. Eventos de acesso (login, logout, troca de senha) precisam de instrumentação no app ou em edge function, não de gatilho de tabela.
4. Sem cobertura e2e para a tela, pelo mesmo motivo das demais.
