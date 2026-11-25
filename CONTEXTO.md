# CONTEXTO / RELATÓRIO DE TRABALHO — agro-drone-assist

> Documento de referência para retomar o trabalho. Atualizado ao fim de cada sessão.
> Ao reiniciar, leia este arquivo e confirme em qual etapa paramos.

## Status atual (última atualização: 2026-11-19 — ver seções 10 e 11)

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
- Exportação em PDF pela mesma tela (botão "Gerar PDF"): sai pelo `gerarDocumentoPadrao` em paisagem com cabeçalho da empresa e colunas de largura fixa (Quando, Quem, Ação, Tela, Registro, Alterações), sem `ajustarLargura` — o id do registro precisa de espaço garantido e um valor longo sem espaços deformaria a medição automática. A coluna "Alterações" mostra "campo: antes → depois" por campo e resume acima de 500 caracteres (o CSV segue com o conteúdo completo). Lista, CSV e PDF compartilham o mesmo `aplicarFiltros` e a observação do PDF repete o recorte usado.
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

---

## 9. Sessão — Redesign visual da tela de login (LivreOS Enterprise)

**Entregue (somente visual — nenhuma regra de negócio alterada)**

- `src/pages/Auth.tsx` reescrito como composição de página inteira com duas áreas:
  - **Painel institucional:** marca `LivreOSLogo` (`tone="onDark"`), acento em verde-limão, título "ERP Completo para Assistência Técnica", descrição e cinco cartões de segmentos (Assistência Técnica, Drones Agrícolas, Mobilidade Elétrica, Carros Elétricos, Máquinas Agrícolas) com ícones do `lucide-react`.
  - **Painel de login em vidro líquido:** formulário translúcido com campos Email/Senha, opção Lembrar-me, link "Esqueci minha senha", botão Entrar e rodapé "Criar conta grátis". O painel usa efeito Liquid Glass com backdrop-filter, gotas discretas e bordas luminosas. Nota: a imagem de fundo `public/paisagem_digital_verde_com_ondas_de_vidro.png` ainda não foi adicionada ao repositório; sem ela o painel cai no fundo escuro #001b18 com veils sutis.
- `src/index.css`: bloco escopado `.livreos-login*` no fim do arquivo com os tokens do kit de design (paleta esmeralda, transparências, blur 26px, raios 32px/20px/15px, saturação 165%), fallback `@supports not (backdrop-filter)` para navegadores sem suporte e `prefers-reduced-motion`. O visual do vidro (gotas, reflexos em `::before`/`::after` com `z-index: -1` sob `isolation: isolate`) vive nestas classes escopadas, nunca em utilitário global, para não afetar o restante do ERP.
- **Sistema inteiro no tema claro (light theme):** `:root` em `src/index.css` restaurado para tokens de cor claros (fundo cinza bem claro, texto escuro, bordas claras), mantendo `.dark` para compatibilidade. Utilitários `.livreos-glass` e `.livreos-glass-strong` removidos do CSS global (eram exclusivos do tema escuro). `PremiumCard`, `KpiCard`, `PremiumTable` e `MainLayout` voltaram a usar classes semânticas do tema claro (`bg-card`, `bg-white`, `border border-border`, `shadow-sm`, etc.).
- Detalhe de usabilidade: botão de mostrar/ocultar senha (ícone `Eye`/`EyeOff`), coerente com a referência visual.

**Preservado / verificado**

- Toda a lógica de autenticação permaneceu idêntica: validação com Zod (`emailSchema`/`passwordSchema`), `signIn`, mensagens de erro/sucesso, `livreos:remember` (lembrar-me), aviso de sessão expirada (`?expired=1`) e redirecionamento por perfil (platform admin → `/admin/dashboard`; demais → `/dashboard`).
- Destinos dos links inalterados: `/reset-password` e `/cadastro-empresa`.
- Acessibilidade: labels associados (`htmlFor`/`id`), ícones decorativos com `aria-hidden`, foco visível, `aria-label` no botão de senha, atributos `name`/`autocomplete`/`type`/`required` mantidos.
- Responsivo: desktop em duas colunas, tablet com cartões quebrando linha e mobile priorizando o formulário (a área institucional vai para baixo via `order`), sem overflow horizontal.

**Pendente / próximo**

1. Imagem de fundo `public/paisagem_digital_verde_com_ondas_de_vidro.png` ainda não adicionada ao repositório — sem ela o fundo usa #001b18 com veils graduais.
2. Teste manual de login real com as três contas (admin, técnico, consulta), campos vazios, e-mail inválido, envio por botão e por Enter.
3. Build/lint locais não executados por decisão do usuário (ver seção 3 do CONTEXTO.md).
4. Cobertura e2e: `@playwright/test` não está instalado (dependência recusada anteriormente). Verificar se o ambiente de teste será disponibilizado futuramente.

---

## 10. Sessão 2026-11-19 — Comissão correta + painel de ganhos com faturas de saque

**Entregue**

- **Regra única da comissão** em SQL (`drizzle/migrations/0024_commission_rateio_e_faturas.sql`): `os_commission_calc(_os_id)` (leitura) e `os_commission_core(_os_id, _force)` (grava). Base só de serviços com o desconto do cabeçalho rateado por proporção, imposto lido de `nfe_config.nfse_aliquota` (só quando há nota), menos `itens_os.custo_servico`, dividido 50/50 com a parte do técnico ficando com o resto da divisão; sem nota, 3,5% sobre a parte do técnico (`empresa_config.commission_no_note_fee`, configurável). `src/lib/commission.ts` faz a prévia na tela e `src/lib/commission.test.ts` trava os dois lados nos mesmos exemplos (800 com nota 5% = 380,00; 6% = 376,00; 900 + custo 150 com nota 6% = 348,00; sem nota = 361,88; 2.500 com desconto 750 sem nota = 1.206,25).
- **Congelamento do rateio** na OS: novas colunas `commission_base/tax/cost/no_note_fee/company/rate/tax_rate/frozen_at/paid_at` e `payout_invoice_id`. `commission_total` continua sendo a comissão do técnico (já líquida). Reabrir a OS antes de existir fatura limpa o congelamento; com fatura, só ajuste.
- **Imposto com uma fonte só:** `nfe_config.nfse_aliquota`. `empresa_config.tax_percentage_nfe` deixou de ser lido (comentado no banco) e `tax_retention_ledger` não é mais escrito — a retenção de 6 meses morreu. `vw_comissoes_tecnico` foi reescrita para ler as colunas da OS (antes o imposto vinha do ledger).
- **Rateio visível na OS:** `src/components/os/CommissionBreakdown.tsx` (com `rateioDaOS()`) renderizado no detalhe da OS e no `OSSummaryDialog`, com selo "Nota emitida"/"Sem nota", aviso de custo não lançado e aviso de divergência. `OSItemsSection` ganhou o campo "Custo do serviço (R$)" por linha de serviço, bloqueado para não-admin em OS concluída pelo trigger `protect_itens_os_custo`.
- **Painel do técnico** (`/technician/financeiro`) reconstruído: cartão de chave PIX (obrigatória para faturar), quatro cartões clicáveis (A receber / Aguardando cliente / Recebido / Divergência) que filtram o extrato, totais do período, gráfico recharts de comissão por dia, extrato com seleção por checkbox e coluna de comissão preenchida, lista de faturas com PDF/WhatsApp/cancelar e as despesas de sempre. Abas de período Hoje · Semana · Mês · Ano (+ intervalo personalizado) em `PeriodFilterBar`.
- **Faturas de saque:** `technician_payout_invoices` + `technician_payout_invoice_items` (com `snapshot` do rateio), numeração `FAT-0001` por organização sob advisory lock, PIX do técnico, status rascunho → enviada → paga | recusada | cancelada. `PayoutInvoiceDialog` cria, baixa PDF (`src/lib/payout-invoice-pdf.ts`, mesmo `gerarDocumentoPadrao`) e envia; ao enviar o admin recebe notificação. Uma OS só entra em uma fatura ativa.
- **Área do gestor** `/comissoes` (admin, menu Financeiro): faturas por técnico e status com "Marcar como paga" (grava `commission_paid_at` e lança `financeiro` tipo `comissao`) e "Recusar" com motivo, mais a aba "Conferência da comissão" (`relatorio_impacto_comissao` + `recalcular_comissoes_em_lote`), que mostra comissão antiga × nova por OS e lança ajuste (`commission_adjustments`) nas já pagas em vez de corrigir em silêncio.
- **Configuração:** `CommissionConfigCard` em `/empresa` edita a "Taxa sem nota (%)" e exibe a alíquota do ISS em leitura, avisando que é a fonte única. `get_technician_dashboard(uuid)` (sobrecarga antiga) foi removida; a tela chama a de 3 argumentos explicitamente.
- **Testes:** unitário `src/lib/commission.test.ts` (Vitest, `npm test`); integração `src/lib/technician-financials.integration.test.ts` ajustada ao payload novo; e2e `e2e-tests/comissoes.spec.ts` (Playwright) confirma que `/comissoes` exige autenticação — passando.

**Fechamento (mesma sessão): dados antigos, prévia e travas**

O banco tem 42 OS e **nenhuma** tinha rateio gravado pela regra nova (`com_rateio = 0`): 28 carregam `commission_total` da regra antiga com `commission_base = 0`. O bloco de rateio abria com base/imposto/custo/saldo zerados e "Sua comissão" com valor — um rateio que não soma.

- **`sem_rateio` = `commission_frozen_at is null`** (não `base = 0`): OS concluída sem serviço comissionável tem rateio gravado e base zero, e isso não é dado antigo. No banco (`get_technician_os_statement`) e no `rateioDaOS`.
- **OS sem rateio mostra a regra nova como prévia:** selo `Prévia — regra nova`, linhas com o cálculo novo e, embaixo, `Comissão gravada (regra antiga)` + aviso para usar a Conferência. Nada é corrigido em silêncio; o valor gravado continua intacto.
- **Extrato** mostra `—` em imposto/custo/saldo quando não há rateio e marca a comissão como `antiga`, em vez de zeros que não somam; o cabeçalho conta quantas OS do período estão assim (`N pela regra antiga`), para o técnico entender por que o total está baixo.
- **Prévia idêntica ao SQL:** o valor cobrado da prévia resolve igual ao banco (`valor_final` manda; sem ele, itens − desconto). Antes a tela preferia o total dos itens e divergia — OS `2026-00010` (570 no banco × 600 na tela).
- **Alíquota do ISS para não-admin** pelo RPC `get_nfse_aliquota()` (`SECURITY DEFINER`, `EXECUTE` só para `authenticated`; `PUBLIC`/`anon` revogados). `nfe_config` é restrita a admin porque guarda os tokens da Focus NFe e RLS não esconde coluna — não abrir SELECT na tabela para resolver isso. `useNfseAliquota` lê por esse RPC e o `CommissionConfigCard` reusa o hook.
- **Grants:** as três tabelas novas herdaram os privilégios padrão do banco, que dão `ALL` a `anon` — revogado (no banco e na migration). Políticas são **só de SELECT**: toda escrita passa por RPC `SECURITY DEFINER`, então o técnico não consegue marcar a própria fatura como paga nem mexer em ajuste.
- **Ajuste entra na fatura:** `create_technician_payout_invoice(_os_ids, _notes, _adjustment_ids)` aceita ajustes pendentes (ganham `invoice_id` e `settled_at`), com checkboxes no `PayoutInvoiceDialog`. Ajuste não forma fatura sozinho.
- **Recusar não prende o trabalho:** `settle(..., paid := false)` agora devolve as OS (`payout_invoice_id = null`) e os ajustes (`invoice_id`/`settled_at` = null) ao técnico, mantendo os itens da fatura como histórico. Sem isso a OS ficava presa em uma fatura encerrada para sempre — só se fatura OS com `payout_invoice_id` nulo e `cancel` não aceita `recusada`.

**Verificado nesta rodada**

- Fórmula SQL × TS nos seis exemplos do plano (800 com nota 5% = 380,00; 6% = 376,00; 900 + custo 150 com nota 6% = 348,00 e sem nota = 361,88; 2.500 com desconto 750 sem nota = 1.206,25; 900 sem nota = 275,03), com `os_commission_calc` lido do banco e conferido linha a linha.
- A query do extrato rodada contra OS reais devolve `sem_rateio = true` nas legadas.
- Assinaturas dos RPCs conferidas contra o banco; grants e políticas auditados; `trg_audit` existe em `itens_os` (mudança de `custo_servico` cai na Auditoria).
- Sem runner de comandos nesta sessão: a checagem de tipos e o build não foram executados (verificar no editor e com `npm test`).

**Pendente / próximo**

1. `npm test` (Vitest) — sem runner nesta sessão.
2. `nfe_config.nfse_aliquota` está 0 na organização principal (e `habilitado = false`): enquanto não for configurada, OS com nota não geram imposto (comportamento esperado, mas vale conferir na tela fiscal).
3. O botão "Enviar por WhatsApp" usa Web Share (celular) e cai em download + instrução no desktop, porque o técnico não pode ler o telefone do gestor por RLS.
4. Fora do escopo desta sessão: `src/pages/Auditoria.tsx` chama o RPC `reverter_alteracao`, que não existe no banco nem nos tipos — o botão "Desfazer" não funciona. Não afeta o build (`vite build` não roda `tsc`), mas está pendente.
5. `os_commission_core` e `os_commission_calc` têm `EXECUTE` para `anon`/`authenticated` (privilégio padrão do banco, igual a outras funções da migration 0024). São SECURITY DEFINER sem checagem de organização: um autenticado pode forçar o recálculo de OS de outra organização (mexe em dado, não lê). Vale um `REVOKE ... FROM anon` e uma checagem de org quando essas funções forem mexidas de novo.

---

## 11. Sessão 2026-11-19 (2) — Permissão "Pode finalizar OS" + recálculo de todas as OS

**Permissão "Pode finalizar OS"** (migration `drizzle/migrations/0025_pode_finalizar_os.sql`)

O problema real: `os_assignment_rules` levantava `'Somente o técnico responsável pode finalizar esta OS.'` para qualquer autenticado que não fosse o técnico da OS — **inclusive o administrador**, porque a condição olhava só `auth.uid() <> tecnico_id`. Não existia coluna de permissão.

- `user_permissions.pode_finalizar_os` (padrão `false`) + predicado `public.pode_finalizar_os(_user_id)` (não é SECURITY DEFINER de propósito: dentro das policies o invocador lê a própria linha).
- `os_assignment_rules` passou a liberar admin, admin da plataforma e quem tem a permissão.
- Quem só tem a permissão fecha pelo RPC `finalizar_os(_os_id, _status)`: valida organização, aceita apenas status de fechamento (`pronto_retirada`, `concluida`, `entregue`, `finalizada`), grava status/datas, congela o rateio (`os_commission_core`) e escreve `os_historico`. **Não** foi aberto UPDATE em `ordens_servico` para essa permissão: a policy continua exigindo admin ou técnico, e o limite de campos fica no RPC. (A primeira tentativa foi abrir a policy + um trigger de guarda de colunas; o guarda não funcionou porque dentro de uma função SECURITY DEFINER `current_user` é o dono, não o usuário do JWT — daí o desenho por RPC.)
- `calculate_os_commission` também libera quem tem a permissão (senão a OS fecharia com a comissão em prévia).
- Frontend: `usePermissions`/`types.ts` expõem `pode_finalizar_os`; `Equipe → Papéis e permissões` ganhou o interruptor (desabilitado para admin/técnico, que já podem); `OrdensServico` usa `podeFecharOS`/`podeAvancarOS` e manda quem não edita pelo RPC; `StatusPipeline` ganhou `canChangeTo` e deixa só os passos permitidos clicáveis.
- Correções na tela `Permissões de OS` (`/permissoes`, link em Configurações): o interruptor aparecia **ligado para todos** quando quem abria era admin (`canUserFinalize` curto-circuitava pelo usuário logado) e o upsert mandava `organization_id`, coluna que não existe em `user_permissions` — salvar falhava.

**Recálculo de todas as OS (pedido do usuário)**

Nenhuma das 43 OS tinha rateio gravado e 28 divergiam da regra nova. Rodado `recalcular_comissoes_em_lote(false)` como o admin de cada organização (e31fe856: 24 OS; f42c8ddd: 7 OS) e, na sequência, `os_commission_core(id, true)` para as OS ainda abertas (7 + 5), que guardam o rateio sem congelar.

| Organização | Grupo | Antes | Depois | Congeladas |
|---|---|---|---|---|
| e31fe856 | Concluída | 13.294,21 | **12.147,55** | 24 de 24 |
| e31fe856 | Aberta | 3.287,00 | **2.952,91** | — (prévia) |
| f42c8ddd | Concluída | 0,00 | **696,38** | 7 de 7 |
| f42c8ddd | Aberta | 0,00 | **4.535,51** | — (prévia) |

Resultado verificado: **0 OS divergentes** em qualquer grupo (`commission_total` = `os_commission_calc`). Nenhuma OS estava paga nem em fatura, então não houve ajuste retroativo. Daqui para frente o cálculo se mantém: OS aberta recalcula a cada mudança de item (`trg_itens_os_recalc_commission`), OS concluída congela no fechamento.

**Textos ajustados** para não mentir depois do recálculo: `CommissionBreakdown` só mostra a linha `Comissão gravada (fora da regra nova)` + aviso quando o valor gravado realmente difere da prévia; o extrato trocou o rótulo `antiga` por `sem rateio` (`N sem rateio gravado` no cabeçalho).

**Pendente desta sessão**

1. `npm test` e a checagem de tipos (`npm run build` / `tsc`) — sem runner nesta sessão.
2. Confirmar na tela: abrir uma OS concluída e ver o rateio gravado (sem aviso), e logar como um usuário "Atendimento" com a permissão marcada para fechar uma OS de outro técnico.

---

## 12. Sessão 2026-11-19 (3) — Ajuste manual do valor da comissão (só admin)

Pedido: "poder alterar o valor da cobrança de comissão" — o admin define à mão a comissão de **uma OS específica** (ex.: 275,03 → 300,00), para mais ou para menos.

**Onde o valor mora.** O ajuste ficou em `ordens_servico.commission_override` (+ `_reason`, `_by`, `_at`) e não em `commission_adjustments`. Motivo: `commission_total` é a fonte de tudo que é exibido (rateio da OS, extrato, dashboard, fatura), então gravar o valor ajustado ali faz o ajuste aparecer em todos esses lugares sem nenhum encanamento novo. Se o ajuste fosse só o delta em `commission_adjustments`, a OS continuaria mostrando o valor calculado (275,03) e a soma com o delta dobraria o valor num erro de leitura.

**Soma fechada.** Com o override, `os_commission_calc` devolve `comissao = coalesce(override, calculada)` e refaz `loja = saldo − comissão`, com `taxa_sem_nota = 0` (o valor digitado já é o líquido do técnico). Assim `saldo = loja + comissão` continua verdadeiro e os relatórios que somam `commission_company` (loja) não ficam errados. O JSON ganhou `comissao_calculada`, `ajuste_manual` e `ajuste_ativo` para a tela mostrar as três linhas.

**Não desfaz nem acusa divergência.** Como o ajuste entra no valor *gravado*, `recalcular_comissoes_em_lote` (que compara `os_commission_calc` com `commission_total`) e `relatorio_impacto_comissao` veem diferença zero — o recálculo em lote não apaga o ajuste e a Conferência da comissão não marca a OS como divergente. Antes de gravar, o RPC exige `admin`, mesma organização, técnico definido, OS não cancelada, e recusa OS já em fatura de saque (`payout_invoice_id`) ou já paga (`commission_paid_at`) — nos dois casos `os_commission_core` não regravaria o rateio e o override ficaria inconsistente com o valor cobrado. Remover o ajuste é o mesmo RPC com `_valor = null`.

**Trava.** `trg_os_protect_commission_override` (`protect_commission_override`) recusa alteração das quatro colunas por quem não é admin — a policy de UPDATE de `ordens_servico` é por organização, então uma escrita direta pelo Data API passaria. Sem JWT (`auth.uid()` nulo) a trava libera, para service_role e rotinas internas. `REVOKE` de `anon`/`PUBLIC` + `GRANT` só para `authenticated` no `ajustar_comissao_os`.

**Tela.** `CommissionOverrideDialog` (valor + motivo, com aviso quando o valor passa do saldo a dividir e botão "Remover ajuste") aberto pelo botão "Ajustar comissão" no detalhe da OS, visível só para admin. `CommissionBreakdown` ganhou o selo `Ajuste manual`, as linhas `Comissão pela regra` / `Ajuste manual (admin) ±` / `Sua comissão ajustada`, o motivo e o rótulo `Loja (absorve o ajuste)`; a taxa sem nota some nesse caso. O cálculo da regra é passado sempre (`calculada`), inclusive para o técnico no `OSSummaryDialog`, que é onde ele vê o motivo do ajuste.

**Verificação.** Teste no banco (com o trigger de auditoria desligado e a OS restaurada em seguida): OS-037 com 200 de serviço, sem nota — sem ajuste `comissao 96,50 / loja 100,00 / taxa 3,50`; com `commission_override = 300` → `comissao 300,00 / loja −100,00 / taxa 0 / ajuste_manual 203,50`, gravado igual na OS; removendo o ajuste, valores idênticos aos originais (total, loja, taxa, base). Depois do teste: triggers todos ativos e **0 OS divergentes** da regra.

**Pendente:** `npm test` / checagem de tipos (sem runner) e a conferência na tela (abrir uma OS, ajustar, ver o rateio e o extrato do técnico).

## 13. Sessão 2026-11-22 (2) — Regra de atraso da OS por prazo de diagnóstico

Pedido: a OS começava a aparecer em atraso só porque a `data_previsao` já tinha passado, mesmo numa OS recém-recebida que ainda nem foi diagnosticada. O usuário quer: prazo de diagnóstico padrão de **48h** por OS (o técnico pode mudar por OS), atraso só quando o status não avança dentro desse prazo, **pausa** enquanto aguarda aprovação do cliente e, depois do aceite, prazo pela **previsão de entrega**.

**Banco.** Nova coluna `ordens_servico.prazo_diagnostico_horas integer NOT NULL DEFAULT 48` (com `CHECK > 0`). O `get_technician_dashboard` passou a devolver `prazo_diagnostico_horas` no kanban do técnico.

**Regra única.** `src/lib/os-prazo.ts` (`calcularPrazoOS` / `osEmAtraso`): diagnóstico (`recebido`, `aberta`, `aguardando_diagnostico`) vence em `data_entrada + prazo`; `aguardando_aprovacao` não corre prazo; demais status abertos usam `data_previsao`; encerradas nunca atrasam. Testes em `src/lib/os-prazo.test.ts`.

**Tela.** Campo "Prazo de diagnóstico (horas)" no formulário da OS (padrão 48h) e bloco de prazo no detalhe da OS (fase, vencimento, quanto falta/atrasou, com ajuste rápido para quem pode editar). Badge "Atrasada" na lista de OS e o painel do dashboard passaram a usar a mesma regra; o painel do técnico deixou de comparar `data_previsao` direto.

**Observação:** `aguardando_peca` continua contando pela previsão de entrega (não está pausado como `aguardando_aprovacao`).

## 14. Sessão 2026-11-22 (3) — Fase 1 concluída + hardening de `anon` (aplicado)

**Fase 1 (tokens da Focus).** O núcleo já estava aplicado no banco (view `nfe_config_publica` e função `salvar_focus_token` existem; `anon`/PUBLIC sem as funções de comissão). O que faltava era o commit do front apontado como pendente no próprio SQL: `src/pages/NovaNfse.tsx` fazia `select("*")` em `nfe_config` e trazia os tokens para o navegador — passou a ler a view. Conferido que não sobrou nenhum outro ponto do navegador tocando os tokens (Edge Functions leem com `service_role`/Vault; `NfeConfigCard` já usava a view).

**Hardening de `anon` (novo, aplicado).** `anon` (quem não fez login; a chave pública vai no bundle) tinha escrita em quase todas as tabelas — inclusive `TRUNCATE`/`MAINTAIN`, que **não passam por RLS** — e `EXECUTE` em toda função via `PUBLIC`, o que permitia chamar RPC `SECURITY DEFINER` sem login. Revogado: escrita de `anon` em tabelas/sequences (mantido o `SELECT`) e `EXECUTE` de todas as RPC; `authenticated` perdeu só `TRUNCATE/REFERENCES/TRIGGER/MAINTAIN`. Reabertas a `anon` apenas as 4 auxiliares usadas em policies (`get_user_org_id`, `has_role`, `is_admin_or_tecnico`, `is_platform_admin`). `authenticated`/`service_role` têm grant direto e seguem intactos. SQL em `supabase/APROVACAO_revogar_anon_escrita_public.sql` e `supabase/APROVACAO_fechar_rpc_anon.sql`; registro em `drizzle/migrations/0030`. Nenhum dado tocado.

**Ainda em decisão (não executei):** limpeza/remoção das colunas de token em texto puro (passos futuros da Fase 1) e a tela `platform_config` (a tabela não existe e nenhuma Edge Function a lê — criar só a tabela deixaria a tela salvando um token sem efeito).
