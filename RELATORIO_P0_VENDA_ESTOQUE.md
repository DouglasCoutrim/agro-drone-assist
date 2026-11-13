# Relatório — P0: venda e estoque gravados no servidor

**Data:** 12/11/2026
**Escopo:** P0 de estoque/venda — RPCs no banco + migração do front de vendas
**Status:** entregue e verificado no banco; validação manual das telas pendente (seção 8)

---

## 1. Problema que motivou o P0

O navegador era a fonte da verdade da venda e do estoque:

- PDV e Vendas enviavam `preco_unitario` direto para o banco, então qualquer preço podia ser gravado, mesmo diferente do preço do cadastro.
- O teto de desconto (`desconto_maximo_percentual`) existia apenas na tela (`src/lib/desconto.ts`); o banco aceitava qualquer percentual.
- O estoque era lido no navegador e regravado como valor absoluto (`saldo - quantidade`), então duas vendas simultâneas do mesmo item se sobrescrevem.
- A numeração da venda era calculada na tela (`VND-#####`) e podia duplicar.
- Totais (`valor_produtos`, `valor_desconto`, `valor_total`) eram calculados na tela e gravados como vieram.

## 2. O que foi entregue

| Área | Antes | Depois |
| --- | --- | --- |
| Criar venda | INSERT de `vendas` + `venda_itens` + estoque pelo navegador | RPC `criar_venda`, tudo em uma transação |
| Preço do item | enviado pela tela | lido do catálogo (`itens_estoque.preco_venda` / `servicos`), valor do navegador é ignorado |
| Teto de desconto | só na tela | validado no banco, desconto acima do teto é rejeitado |
| Baixa de estoque | leitura + gravação do saldo absoluto | RPC `ajustar_estoque` soma o delta e registra a movimentação |
| Numeração | calculada na tela | sequencial por organização, com trava (`pg_advisory_xact_lock`) |
| Totais | calculados na tela | calculados no banco a partir do catálogo |

## 3. Banco

Migrations em `supabase/migrations/`:

- `20261003130000_p0_estoque_venda_rpc.sql` — `public.ajustar_estoque` e a primeira versão de `public.criar_venda`.
- `20261003140000_p0_criar_venda_linhas_catalogo.sql` — amplia `criar_venda` para linhas de serviço e item livre, e grava `nfe_dados` e `ambiente`.

Assinaturas aplicadas e conferidas no banco (`pg_proc`):

```
public.ajustar_estoque(_item_id uuid, _delta numeric, _motivo text, _origem_tipo text, _origem_id uuid) -> numeric
public.criar_venda(_payload jsonb) -> uuid
```

Ambas são `plpgsql`, **SECURITY INVOKER** (as políticas de RLS continuam valendo para quem chama) e com `search_path=public`.

### 3.1 `ajustar_estoque`

- Soma o delta no item com um único `UPDATE ... RETURNING` — o saldo nunca é lido antes pelo cliente, então vendas simultâneas não se perdem.
- Grava a movimentação em `movimentacoes_estoque` na mesma transação, com `organization_id` vindo do próprio item, `usuario_id = auth.uid()` e motivo recebido.
- Retorna o saldo atualizado.

### 3.2 `criar_venda`

- Organização sempre de `get_user_org_id(auth.uid())`, **nunca** do payload.
- Numeração `VND-#####` sequencial por organização; `vendas` já tem `UNIQUE (organization_id, numero)`.
- Preço, teto de desconto, NCM, CFOP e nome vêm do catálogo; o `preco_unitario` enviado pelo navegador é ignorado em itens de catálogo.
- Desconto é convertido em valor no servidor e rejeitado quando passa do teto: `Desconto acima do máximo permitido para o item.`
- Grava `nfe_dados` e `ambiente` (a emissão de NF-e lê `nfe_dados.emitir_nota`; `ambiente` tem default `producao`).
- A baixa de estoque usa `ajustar_estoque` internamente, na mesma transação da venda.
- Precedência dos tipos de linha:

| Linha | Referência | Preço gravado | Estoque | NCM / CFOP |
| --- | --- | --- | --- | --- |
| Produto | `produto_id` -> `itens_estoque` | do cadastro (`preco_venda`) | baixa na mesma transação | do cadastro |
| Serviço | `servico_id` -> `servicos` | `GREATEST(preco, valor_fixo, valor_hora)` | não movimenta | vêm da tela (não é mercadoria) |
| Item livre | nenhum | digitado na tela | não movimenta | vêm da tela |

### 3.3 Regras de negócio consolidadas

- Numeração: `VND-00001`, `VND-00002`, ... única por organização.
- **`desconto_maximo_percentual = 0` significa sem teto (até 100%)**, espelhando `src/lib/desconto.ts`. Se a intenção for que 0 bloqueie desconto, é preciso mudar o banco **e** a tela juntos.
- Serviço e item livre nunca movimentam estoque.
- O `CHECK (quantidade >= 0)` em `itens_estoque` continua **comentado**: ligá-lo antes de migrar os outros escritores de estoque (seção 7) faria telas existentes falharem. Pré-condição conferida: não existe item com saldo negativo hoje.

## 4. Front-end

### `src/hooks/useVendasData.ts`
- `createVenda` chama a RPC `criar_venda` e recarrega a venda gravada, devolvendo o mesmo formato de antes (`id`, `numero`, `itens`, totais do servidor), então PDV e Vendas não mudaram de contrato.
- `ajustarEstoque` chama a RPC `ajustar_estoque`; é usado pela edição e pelo cancelamento de venda.
- O marcador de item livre `"manual"` (que não é um uuid) passou a ser convertido para `null` também na edição — antes isso gerava erro de cast ao salvar venda com item livre.
- `VendaItem` ganhou `servico_id?`.

### `src/pages/PDV.tsx`
- Busca de serviços passou a trazer `valor_fixo` e `valor_hora` e usa o maior valor como preço, igual ao servidor.
- A venda envia `servico_id` para linhas de serviço.
- O preço do item virou texto somente leitura: como o preço gravado é o do cadastro, um campo editável mostraria total diferente do que é salvo. O desconto continua sendo informado em percentual, como antes.

### `src/pages/Vendas.tsx`
- O preço só é editável em item livre; em item de catálogo é exibido como somente leitura pelo mesmo motivo.

## 5. Documentação

- `AGENTS.md`: registra a decisão (RPCs como caminho de escrita, preço do catálogo vencendo o do navegador, `0 = sem teto`, serviço/item livre sem estoque).
- `CONTEXTO.md`: seção 6 com o que foi feito, o que foi verificado e as pendências.

## 6. Verificação executada

1. **Assinaturas e colunas:** conferidas no banco (`pg_proc`) e no schema de `vendas` / `venda_itens` — todas as colunas escritas por `criar_venda` existem.
2. **Execução real com rollback:** um bloco `DO` assumindo um usuário real (`request.jwt.claims`) criou uma venda de produto, uma de serviço e uma com item livre, e abortou no fim de propósito. **Nada ficou gravado no banco.** Resultado observado:

| Verificação | Resultado |
| --- | --- |
| Preço do catálogo vence o valor do navegador (enviei `0.01`) | `2 x 1100,00 = 2200,00` |
| Desconto de 5% calculado no servidor | `110,00` (total `2090,00`) |
| `nfe_dados` / `ambiente` persistidos | `emitir_nota=true`, `ambiente=homologacao` |
| Item de catálogo | preço `1100,00`, nome e NCM do cadastro, `produto_id` preenchido |
| Linha de serviço | preço `2600,00`, `produto_id` nulo, sem estoque |
| Item livre | total `15,00` (30,00 menos 50%), nome sem espaços nas pontas |
| Estoque | `5 -> 3` com **exatamente 1** movimentação (só o item de catálogo) |
| Desconto de 150% | rejeitado: `Desconto acima do máximo permitido para o item.` |
| Numeração | `VND-00027`, `VND-00028`, `VND-00029` (sequência da organização) |

3. **Type check:** `tsc` sem erros no projeto inteiro.

**Limite da verificação:** o teste acima rodou com um papel privilegiado, então as políticas de RLS não foram exercidas nessa execução. Elas foram conferidas por leitura (`Equipe cria vendas`, `Itens seguem a venda`, inclusive o `WITH CHECK` que exige `is_admin_or_tecnico`) e dependem do teste manual da seção 8 para validação de ponta a ponta com sessão real.

## 7. Pendências (próxima fatia)

1. **Edição de venda ainda escreve itens no navegador.** `updateVenda` reescreve `venda_itens` com preços vindos da tela, então a brecha de preço/desconto continua aberta no caminho de edição. Correção: RPC `editar_venda` com as mesmas regras da criação.
2. **Outros escritores de estoque não passam por `ajustar_estoque`:** tela Estoque (grava valor absoluto), `ImportarXmlNfe` e as RPCs `transferir_estoque_tecnico`, `devolver_estoque_central`, `criar_saida_demonstracao`, `concluir_saida_demonstracao`. Enquanto isso, o `CHECK (quantidade >= 0)` fica comentado.
3. **Quantidade fracionária em item de estoque:** `itens_estoque.quantidade` é `integer` e `ajustar_estoque` recebe `numeric`, então a baixa é arredondada na gravação (comportamento herdado do código antigo). Vale decidir se itens de estoque devem aceitar quantidade quebrada na tela de Vendas.
4. **Sem teste automatizado e2e:** `@playwright/test` não está instalado (dependência recusada antes). O fluxo "registrar venda no PDV" é o candidato natural ao primeiro teste.

## 8. Como testar manualmente

1. **PDV, venda de produto:** adicione um item do catálogo, aplique um desconto dentro do teto e finalize com recibo. Confira em Vendas: número `VND-#####`, desconto em R$ e total iguais aos da tela, e o saldo do item baixado.
2. **PDV, venda de serviço:** venda um serviço. Confira que a NF-e continua bloqueada para serviço (regra que já existia) e que o item ficou com `produto_id` nulo, sem mexer no estoque.
3. **Vendas, item livre:** lance uma linha digitando descrição e preço. Confira que o preço continua editável nessa linha e travado nas linhas de catálogo.
4. **Desconto acima do teto:** tente um percentual acima do máximo do item. A tela deve avisar e o banco deve recusar.
5. **Cancelar venda:** cancele uma venda de produto e confira o estoque devolvido e a movimentação de entrada registrada.
6. **Perfil sem permissão:** entre com usuário `consulta` e confirme que a venda é recusada (RLS).

## 9. Rastreabilidade

Commits da sessão (12/11/2026, branch `main`):

- `521b6113` — RPC de estoque/venda
- `c86a9653` — ajustes das migrations
- `bc8aeadc` — `criar_venda` com linhas de catálogo
- `4754b5dd` — migração do front (hook, PDV, Vendas) e documentação

O rascunho `RASCUNHO_p0_estoque_venda.sql` foi criado durante a sessão e removido ao ser promovido para a migration numerada.
