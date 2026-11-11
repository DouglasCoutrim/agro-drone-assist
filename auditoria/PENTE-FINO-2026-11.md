# Pente-fino de catálogos, despesas e técnicos — novembro/2026

Escopo: separação entre **produto vendável**, **consumo interno**, **ferramenta (patrimônio)** e **serviço**,
além de quem pode ser designado como técnico em uma OS.

Fontes: leitura do código em `src/` + consultas agregadas ao banco (`public`).
Nada foi alterado no banco nem no código durante a auditoria.

---

## 1. Resumo executivo

Os quatro sintomas relatados têm **quatro causas-raiz distintas**, todas confirmadas com dados reais:

| # | Sintoma relatado | Causa raiz confirmada |
|---|---|---|
| 1 | Despesas internas e ferramentas da loja aparecem no estoque de produtos | `itens_estoque` não distingue **revenda** de **consumo interno**, e a importação de NF-e grava **toda** linha da nota como produto, categoria fixa `"Peças"`, com preço de venda |
| 2 | Ferramentas aparecem entre produtos | Existem **três catálogos paralelos** (`itens_estoque`, `produtos` legado, `patrimonio_ferramentas`) e a tela de Orçamentos ainda busca no catálogo legado `produtos`, que está poluído com despesas e ferramentas |
| 3 | Despesas cadastradas entram nos serviços | `servicos` não tem nenhuma barreira de tipo: o "criar serviço" rápido da OS/Orçamento aceita qualquer texto, e o autocomplete de catálogo mistura produtos + serviços na mesma lista (`source: "all"`) |
| 4 | Pessoas sem função de técnico aparecem no campo "adicionar técnico" | `useTeamMembers.tecnicos` inclui **admin**; a criação de OS usa o usuário logado como técnico por padrão; a conversão de orçamento em OS grava `tecnico_id = user.id`; e `nivel_tecnico` nem é carregado pela hook |

---

## 2. Evidências coletadas no banco

```text
produtos (catálogo legado, 34 linhas, 3 organizações)
  "Compra de Lanche" · "Gastos pessoais" · "Gast" · "Power Citros 1L" · "Power Citros 5L"
  "Curso Manutenção de Baterias DJI Agras" · "Gerador Toyama TG15000CXE 17KVA"
  "Porta escovas da parafusadeira EINHELL" · "Bike Souza" · "Motor t100" (3 duplicatas)
```

```text
itens_estoque — itens de consumo interno convivendo com peças de revenda
  POWER CITROS ULTRALIMPADOR 5LT   categoria "Peças"  custo 96,00  venda 170,00
  POWER CITROS ULTRALIMPADOR BB20LT categoria "Peças" custo 384,00 venda 600,00
  POWER CITROS ULTRALIMPADOR Cx12   categoria "Peças" custo 38,45  venda 50,00
```

```text
servicos — peça cadastrada como serviço
  "Placa BMS Bateria DJI T50"  3600,00  ← idêntico ao produto homônimo em itens_estoque
```

```text
profiles × user_roles
  DOUGLAS C SILVA ......... admin
  Douglas Coutrim ......... admin          ← é o técnico da OS-001
  Jeferson Alves .......... admin
  Kamilly Côrtes .......... admin
  Kauê Gomes .............. admin
  Luiz Miguel Pires ....... admin
  Marcos Marques .......... admin
  Guilherme Ferreira ...... tecnico (nível 2)
  Vinicius Borges ......... tecnico (nível 1)
```

Todos os 7 usuários **só-admin** aparecem hoje no seletor de técnico da OS.

```text
ordens_servico por organização
  org A: 12 OS  (OS-001 ... "2026-00001")
  org B: 26 OS  (OS-002 ... OS-030)
```

A numeração é **global** (índice único em `numero`), mas o gerador calcula o próximo número **por organização**.
A próxima OS da org A será `OS-002` → **colisão garantida** com a OS-002 da org B (erro `23505`).

```text
solicitacoes_compra: 48 pendentes geradas automaticamente (origem "estoque_baixo")
patrimonio_ferramentas: 3 linhas, todas "em_uso"; movimentações: 3 "entrega", 0 devoluções
financeiro: categorias "Serviços", "Combustível", "geral", e 2 lançamentos sem categoria
```

---

## 3. Achados detalhados

### P0 — quebra funcional ou mistura de dados

#### A1. Numeração de OS colide entre organizações
- **Arquivo/objeto:** índice `ordens_servico_numero_key` (UNIQUE `numero`) + `public.generate_os_number()`.
- **Causa:** gerador faz `MAX(...) WHERE organization_id = NEW.organization_id`, mas o índice único é global.
- **Efeito:** a próxima OS da organização A falha com `duplicate key value violates unique constraint`.
- **Correção:** `UNIQUE (organization_id, numero)` + geração por organização com `LPAD` e retry em `23505`
  (ideal: tabela de contador por org ou `SEQUENCE` por tenant).

#### A2. Catálogo legado `produtos` poluído e ainda usado na UI
- **Arquivos:** `src/components/ui/catalog-autocomplete.tsx` (linhas 88–104 buscam `produtos`/`servicos`; 149 grava em `produtos`),
  `src/pages/Orcamentos.tsx` (linha ~307 usa `CatalogAutocomplete source="produtos"` no campo "Equipamento / Objeto").
- **Causa:** `produtos` é a tabela antiga, paralela a `itens_estoque`, nunca foi desativada. Nela convivem peças,
  despesas ("Compra de Lanche", "Gastos pessoais"), ferramentas ("Gerador Toyama", "Porta escovas EINHELL") e duplicatas.
- **Efeitos:**
  - O campo "Equipamento / Objeto" do orçamento sugere despesas e ferramentas de outras finalidades;
  - O caminho de criação grava em `produtos` → o item **não entra no estoque** e passa a existir só no catálogo fantasma;
  - `itens_os.produto_id` aponta para essa tabela (lançamentos legados), `venda_itens.produto_id` aponta para `itens_estoque` → dois significados para "produto_id".
- **Correção:** migrar as linhas úteis de `produtos` para `itens_estoque`, repontar o autocomplete e remover a tabela da UI (mantendo-a somente leitura até a migração de `itens_os.produto_id`).

#### A3. `itens_estoque` não separa revenda de consumo interno/ferramenta
- **Arquivos:** `src/pages/ImportarXmlNfe.tsx` (linha ~159: `categoria: "Peças"` fixo),
  `src/components/os/OSItemsSection.tsx` (busca produtos sem filtro de finalidade),
  `src/pages/PDV.tsx` e `src/pages/Vendas.tsx` (mesma busca sem filtro),
  `src/pages/Estoque.tsx` (lista tudo).
- **Causa:** não existe coluna que diga "isso é para vender" vs "isso é para uso da empresa".
- **Efeito:** compras de limpeza, copa, EPI e ferramentas ficam disponíveis como peça na OS, no orçamento e no PDV,
  e entram no valor de estoque (KPI "Valor Total (Custo)") como se fossem mercadoria.
- **Correção:** `itens_estoque.finalidade` (`revenda` | `consumo_interno` | `ferramenta`, default `revenda`),
  filtro `finalidade = 'revenda'` em todas as buscas de venda/OS/orçamento, e classificação por linha na importação de NF-e
  (usando o setor do Pedido de Compra como sugestão). Itens `ferramenta` passam a alimentar `patrimonio_ferramentas`.

#### A4. Não-técnicos no seletor de técnico (e default indevido)
- **Arquivos:**
  - `src/hooks/useTeamMembers.tsx:62` → `tecnicos = members.filter(m => m.roles.includes("tecnico") || m.roles.includes("admin"))`;
  - `src/hooks/useTeamMembers.tsx:30` → `select("id, nome, email, organization_id")` **sem `nivel_tecnico`**,
    enquanto `src/pages/OrdensServico.tsx:1552` renderiza `t.nivel_tecnico` (sempre `undefined` → o "· Nível X" nunca aparece);
  - `src/pages/OrdensServico.tsx` (`handleSubmit`) → `tecnico_id: formData.tecnico_id || (editingOS ? ... : user.id)`;
  - `src/pages/Orcamentos.tsx` (`handleConvertToOS`) → `tecnico_id: user.id` fixo;
  - `src/pages/Patrimonio.tsx` → usa `members` (todos os usuários) para "Funcionário / responsável".
- **Efeito:** qualquer administrador (inclusive quem nunca executa serviço) aparece como técnico, é atribuído
  automaticamente ao criar/editar OS e recebe comissão; ferramentas podem ser entregues a perfis `consulta`.
  Confirmado: OS-001 está atribuída a um usuário só-admin.
- **Correção:** RPC `get_org_technicians()` (SECURITY DEFINER, filtra `user_roles.role = 'tecnico'`, devolve `nivel_tecnico`),
  hook dedicado para técnicos, remoção do default `user.id` e validação no banco (trigger em `ordens_servico` rejeitando
  `tecnico_id` sem papel `tecnico`).

#### A5. Técnico não consegue lançar despesa pessoal (RLS)
- **Arquivos:** `src/pages/TechnicianFinancialDashboard.tsx:140` (`insert` em `technician_expenses`),
  políticas de `technician_expenses` (`Org admins manage expenses` = ALL só admin; `View own or org admin expenses` = SELECT).
- **Efeito:** o botão "Nova Despesa" do painel do técnico falha com `new row violates row-level security policy`.
- **Correção:** policy de `INSERT/UPDATE/DELETE` para `technician_id = auth.uid()` dentro da própria organização,
  mantendo a de admin.

### P1 — inconsistências e perda de dados

#### B1. Peças dentro do catálogo de serviços
- **Arquivos:** `src/components/os/QuickCatalogDialogs.tsx` (`ServicoDialog`), `src/components/os/OSItemsSection.tsx`
  (cada seção oferece "Cadastrar serviço: <texto>"), `src/components/ui/catalog-autocomplete.tsx` (`source: "all"`).
- **Efeito:** "Placa BMS Bateria DJI T50" (R$ 3.600) existe como produto **e** como serviço e foi lançada como serviço em 1 OS;
  o operador também cria despesa como serviço digitando no campo errado.
- **Correção:** bloqueio por similaridade (descrição já existe em `itens_estoque` → sugerir a seção "Peças"),
  remover o `source: "all"` (nunca misturar), rótulo explícito no diálogo de criação e rotina de deduplicação.

#### B2. Importação de NF-e: data, vínculo e reimportação
- **Arquivo:** `src/pages/ImportarXmlNfe.tsx`.
- **Problemas:**
  1. `notas_compra.data_emissao: new Date().toISOString()` → ignora a data real da nota (`nota.data_emissao`);
  2. `.from("notas_recebidas").update({ importada: true, nota_compra_id }).eq("chave_acesso", nota.chave)` →
     `notas_recebidas` **não possui** as colunas `importada` nem `chave_acesso` (a coluna é `chave`);
     o erro é descartado → o selo "Importada" nunca persiste e a nota pode ser reimportada;
  3. não há checagem de "já importada" antes de inserir (duplica `notas_compra`, itens e movimentações);
  4. toda linha vira produto `"Peças"` com preço de venda 0 por padrão (liga com A3).
- **Correção:** gravar a data da nota, corrigir o `update` para `chave`/`nota_compra_id`, checar duplicidade por `chave`,
  e classificar a finalidade por linha.

#### B3. Enxurrada de solicitações automáticas de compra
- **Objeto:** `trg_estoque_baixo_solicitacao()`.
- **Causa:** dispara em `INSERT` e em qualquer `UPDATE OF quantidade, estoque_minimo` quando `quantidade <= estoque_minimo`,
  sem comparar com o estado anterior e sem deduplicar pedidos já resolvidos.
- **Efeito:** 48 solicitações `pendente` acumuladas, misturadas com pedidos reais e com as despesas internas.
- **Correção:** disparar só na transição `anterior > mínimo` → `atual <= mínimo`, com deduplicação por
  (`item_estoque_id`, status em `pendente/em_cotacao/comprado` recente) e sem bloquear itens zerados recém-cadastrados.

#### B4. Patrimônio: status e histórico inválidos
- **Arquivo:** `src/pages/Patrimonio.tsx` (`movimentar`).
- **Causa:** grava `tipo: novo ? "entrega" : novoStatus`, mas o CHECK de `patrimonio_movimentacoes.tipo` aceita apenas
  `entrega, devolucao, transferencia, extravio`; e o CHECK de `patrimonio_ferramentas.status` aceita
  `disponivel, em_uso, manutencao, extraviada` (feminino), enquanto a tela oferece `danificado`, `baixado` e `extraviado`.
- **Efeito:** devolver uma ferramenta como "Danificado", "Extraviado" ou "Baixado" grava o status **e falha** na movimentação
  (histórico inconsistente). Evidência: 3 ferramentas `em_uso`, 3 movimentações `entrega`, **zero devoluções**.
- **Correção:** alinhar enums (banco e tela) e mapear `tipo` para `entrega`/`devolucao` com o motivo em `observacao`.

#### B5. Filtro de organização ausente em consultas (defesa em profundidade)
Dependem 100% de RLS hoje. Continuam corretas para usuários de organização, mas quebram para *platform admin*
(que enxerga todas as organizações) e escondem regressões futuras.
- `src/pages/Financeiro.tsx` → `fetchCategorias()` (`select('categoria')` em todo o `financeiro`);
- `src/pages/Orcamentos.tsx` → `fetchData()` (`orcamentos` e `clientes` sem `.eq("organization_id")`);
- `src/components/ui/catalog-autocomplete.tsx` → `produtos` e `servicos` sem filtro;
- `src/hooks/useTeamMembers.tsx` → sem filtro quando `isPlatformAdmin` (todos os perfis de todos os tenants na lista de técnicos).
- **Correção:** adicionar `.eq("organization_id", organization.id)` em todas e tratar o caso platform admin explicitamente.

#### B6. Conversão de orçamento em OS perde desconto e ignora regras
- **Arquivo:** `src/pages/Orcamentos.tsx` (`handleConvertToOS`).
- **Problemas:** copia itens sem `desconto_percentual/desconto_valor/desconto_maximo_percentual`; força
  `tecnico_id = user.id`; grava `status: "aprovado"` e `valor_orcamento = orc.valor` sem recalcular com os itens.
- **Correção:** reaproveitar o payload do `OSItemsSection` (com descontos) e deixar `tecnico_id` vazio/validado.

#### B7. Funções quebradas no banco
- `confirmar_transferencia_estoque()`: usa `NEW.origem_id` como item **e** como técnico
  (`WHERE item_estoque_id = NEW.origem_id AND tecnico_id = NEW.origem_id`), insere `tipo = 'transferencia_tecnico'`
  (fora do CHECK, que só aceita `entrada/saida/devolucao_compra`) e não grava `organization_id` → qualquer confirmação falha.
  Não há UI usando `estoque_tecnico`/`transferencias_estoque` → recurso incompleto.
- `get_fluxo_caixa_projetado()`: referencia `ordens_servico.valor` e `ordens_servico.data_vencimento`, que não existem → erro em execução.
- `get_dre_simplificada()`: soma custo de peças **sem** filtro de organização (`movimentacoes_estoque`/`itens_estoque`).
- `handle_new_notification_push()`: usa `NEW.titulo`/`NEW.mensagem` (as colunas são `title`/`body`) e duplica
  `trg_send_web_push()` → código morto que engole exceção.
- **Correção:** corrigir ou remover (funções sem uso devem sair do banco, não ficar gerando falso-positivo em auditoria).

#### B8. `catalog-autocomplete` (detalhes)
- `handleAddNew` grava `codigo: ""` em todos os itens (sem unicidade, sem padrão `P-#####`);
- `useCallback` não inclui `currentCategory` nas dependências → categoria do produto pode ficar desatualizada;
- botão "Adicionar ao catálogo" aparece mesmo com `mode="text"` (campo "Equipamento/Objeto").

### P2 — higiene de dados
- 26 categorias de estoque em texto livre com maiúsculas/minúsculas inconsistentes (`"bomba"`, `"anel"`, `"JUNTA"`, `"Peças"`).
- `itens_estoque`: `Motor t100` duplicado; `preco_venda = 0` em itens ativos (Trava do Braço) → risco de venda a zero.
- `servicos` sem nenhuma categoria/tipo → impossível relatar "serviços por família".
- `financeiro`: 2 lançamentos sem categoria; `financeiro.categoria` é texto livre.
- Um usuário sem organização (`douglascoutrim@outlook.com`) visível para platform admin na lista de técnicos.

---

## 4. Plano de correção (ordem sugerida)

### Fase 0 — Correções cirúrgicas de UI (baixo risco, sem migração)
1. `useTeamMembers`: `tecnicos` = somente `roles.includes("tecnico")`; incluir `nivel_tecnico` no `select`;
   filtrar por organização também para platform admin. → resolve o sintoma 4 na tela.
2. `OrdensServico`: remover o default `user.id` em `tecnico_id`; exigir seleção (ou manter o técnico atual ao editar).
3. `Orcamentos.handleConvertToOS`: `tecnico_id: null`.
4. `Patrimonio`: usar somente técnicos no seletor de responsável.
5. `Financeiro.fetchCategorias`, `Orcamentos.fetchData`, `catalog-autocomplete`: adicionar filtro de organização.
6. `ImportarXmlNfe`: gravar `data_emissao` da nota; corrigir o `update` em `notas_recebidas` (`chave`), checar duplicidade.
7. `catalog-autocomplete`: apontar `produtos` para `itens_estoque` e desabilitar criação no campo "Equipamento/Objeto".

**Aceite:** seletor de técnico lista apenas os 2 técnicos reais; criar OS sem técnico não grava admin; importação de NF-e
não mostra mais "Importada" falso nem duplica nota.

### Fase 1 — Numeração de OS por organização (banco)
- `DROP CONSTRAINT ordens_servico_numero_key` → `UNIQUE (organization_id, numero)`.
- Reescrever `generate_os_number()` por organização, com retry.
- Corrigir as OS fora do padrão (`2026-00001`) na organização A.

**Aceite:** criar OS nas duas organizações em sequência sem colisão.

### Fase 2 — Separar revenda / consumo interno / ferramenta
1. `ALTER TABLE itens_estoque ADD COLUMN finalidade text NOT NULL DEFAULT 'revenda' CHECK (finalidade IN ('revenda','consumo_interno','ferramenta'))`.
2. Classificar os itens existentes (limpeza, copa, EPI, ferramentas) por categoria/descrição — script revisado com você.
3. `Estoque`: filtro por finalidade + badge; busca de peças na OS/orçamento/PDV com `finalidade = 'revenda'`.
4. `ImportarXmlNfe`: escolher finalidade por linha (default pela `setor` do pedido de compra vinculado) e **não** sugerir preço de venda para consumo interno.
5. Itens `finalidade = 'ferramenta'` geram/atualizam registro em `patrimonio_ferramentas` (fim da duplicidade ferramenta ↔ produto).

**Aceite:** "POWER CITROS" some da busca de peças da OS e do PDV, aparece em Estoque com selo "Consumo interno" e não soma no valor de revenda.

### Fase 3 — Desativar o catálogo legado `produtos`
1. Migrar linhas úteis de `produtos` → `itens_estoque` (com `finalidade` correta) e descartar despesas/duplicatas.
2. Repontar `itens_os.produto_id` → `item_estoque_id` e ajustar `OSItemsSection`.
3. Remover `CatalogAutocomplete` da UI (ou reescrevê-lo sobre `itens_estoque`), mantendo `produtos` somente leitura por um ciclo.

**Aceite:** nenhuma tela lê `produtos`; "Compra de Lanche"/"Gastos pessoais" não aparecem em nenhum seletor.

### Fase 4 — Higiene do catálogo de serviços
1. Rotina de deduplicação: serviço cuja descrição existe em `itens_estoque` → mover uso para peça e remover o serviço
   (caso "Placa BMS Bateria DJI T50").
2. `ServicoDialog`/`EstoqueItemDialog`: aviso quando a descrição já existe no outro catálogo.
3. Remover `source: "all"` do autocomplete.
4. Adicionar `categoria` em `servicos` (opcional, para relatórios).

**Aceite:** nenhuma peça no catálogo de serviços; criação cruzada bloqueada com mensagem clara.

### Fase 5 — Técnicos no banco (garantia, não só UI)
1. RPC `get_org_technicians()` (SECURITY DEFINER) com `id, nome, nivel_tecnico`.
2. Policy de `SELECT` em `user_roles` para membros da mesma organização (hoje só admin lê papéis → lista quebra para técnicos).
3. Trigger `os_technician_role_check`: rejeitar `tecnico_id` cujo usuário não tenha papel `tecnico` na mesma organização.
4. Revisar OS antigas atribuídas a não-técnicos (OS-001) e decidir: atribuir a um técnico real ou marcar como "não atribuída".
5. Policy de `technician_expenses` para o próprio técnico (A5).

**Aceite:** tentativa de gravar não-técnico como técnico falha no banco com mensagem clara; técnico consegue lançar despesa pessoal.

### Fase 6 — Correções P1 restantes
- B3 (trigger de estoque baixo) + limpeza das 48 solicitações automáticas pendentes.
- B4 (enums de patrimônio + mapeamento de `tipo`) e correção das devoluções.
- B7 (funções de transferência/DRE/fluxo de caixa/push): corrigir ou remover.
- B6 (conversão de orçamento com descontos).

### Fase 7 — Verificação
- Testes Vitest para as regras puras: filtro de técnicos, mapeamento de finalidade, deduplicação de notificação de estoque baixo.
- Roteiro manual: criar OS em duas organizações, importar NF-e com item de limpeza, criar orçamento com peça + serviço,
  devolver ferramenta como "danificado", lançar despesa como técnico.
- Atualizar `AGENTS.md` com a convenção "catálogo vendável = `itens_estoque` com `finalidade='revenda'`".

---

## 5. Decisões tomadas (nov/2026)

1. **Admin pode ser técnico** → seletores usam papéis `tecnico` **ou** `admin`; perfis só-`consulta` nunca são atribuídos.
2. **Consumo interno não é vendido** → buscas de OS/orçamento/PDV/vendas filtram `finalidade = 'revenda'`.
3. **Limpeza aprovada** → despesas e duplicatas removidas do catálogo legado.
4. **Estoque do técnico: corrigir** → fluxo loja → técnico → loja implementado via RPC.

---

## 6. Execução (aplicado)

### Banco
- `itens_estoque.finalidade` (`revenda` | `uso_interno` | `ferramenta`) com CHECK, e classificação dos itens de limpeza existentes.
- `UNIQUE (organization_id, numero)` em `ordens_servico` (era global) + `generate_os_number()` isolado por organização.
- `technician_expenses`: políticas de INSERT/UPDATE/DELETE para o próprio técnico.
- `user_roles`: membros passam a ler os papéis da própria organização (lista de técnicos funciona para não-admin).
- `patrimonio_ferramentas.status`: CHECK aceita `danificado`, `extraviado`, `extraviada`, `baixado` (a tela já oferecia).
- RPCs `transferir_estoque_tecnico` (loja → técnico) e `devolver_estoque_central` (técnico → loja), registrando transferência e movimentação.
- Trigger `confirmar_transferencia_estoque` (quebrado, usava o mesmo id para item e técnico e gravava `tipo` fora do CHECK) removido.
- Triggers de estoque baixo (solicitação e notificação) só disparam na transição acima→abaixo do mínimo.
- `get_fluxo_caixa_projetado` corrigido (colunas inexistentes) e `get_dre_simplificada` com filtro de organização no custo de peças.
- Função morta `handle_new_notification_push` removida.
- `produtos`: 8 linhas removidas (5 despesas/teste + 3 duplicatas) → 26 linhas; `itens_os.produto_id` migrado para `item_estoque_id`;
  serviço duplicado "Placa BMS Bateria DJI T50" removido e o lançamento da OS reapontado para o produto (total preservado).

### Aplicação
- `useTeamMembers`: carrega `nivel_tecnico`; responsáveis = `tecnico` ou `admin`.
- `OrdensServico`: não grava mais o usuário logado como técnico quando ele é só `consulta`.
- `Orcamentos`: conversão em OS grava técnico só se o usuário executa serviço, preserva descontos dos itens, consultas com filtro de organização.
- `catalog-autocomplete`: consulta `itens_estoque` (revenda, filtrada por organização); nunca mais lê nem grava em `produtos`.
- `OSItemsSection`, `PDV`, `Vendas`: busca de produtos restrita a `finalidade = 'revenda'`.
- `Estoque`: campo, selo e filtro de finalidade + ação **Entregar ao técnico** com quantidade.
- `Meu Estoque` (`/meu-estoque`): lista os itens recebidos da loja e permite **Devolver à loja**.
- `ImportarXmlNfe`: grava a data real da nota, permite classificar cada linha, bloqueia reimportação da mesma chave e
  corrige o vínculo em `notas_recebidas` (coluna `chave`, antes `chave_acesso`/`importada` inexistentes).
- `Patrimonio`: responsável escolhido entre técnicos; histórico grava `entrega`/`devolucao`/`extravio` sem violar o CHECK.
- `Servicos` e `ServicoDialog`: bloqueiam serviço cuja descrição já exista no estoque.
- `Financeiro`: categorias filtradas por organização.

### Pendências conhecidas
- As 48 solicitações de compra automáticas já existentes continuam abertas (são itens realmente abaixo do mínimo); nenhuma nova é criada no cadastro de produto. Limpar é decisão de negócio.
- Não existe tela administrativa consolidada de "estoque por técnico" (hoje o técnico vê o próprio em **Meu Estoque**).
- Itens `ferramenta`/`uso_interno` ainda aparecem em telas de conferência (Estoque, Demonstrações), nunca em venda.

---

## 7. Observação de método

As evidências vieram de consultas agregadas (`GROUP BY`, `count`) e de leitura de código. As correções foram aplicadas em nov/2026
e verificadas com novas consultas (`servicos_que_sao_peca = 0`, `finalidade` distribuída, RPCs presentes).
