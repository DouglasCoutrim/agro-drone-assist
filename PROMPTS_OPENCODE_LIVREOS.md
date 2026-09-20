# Prompts para o OpenCode — LivreOS

## Como usar este documento

- Execute **um prompt por vez**, na ordem. Não cole vários prompts juntos.
- Depois de cada prompt, revise o diff gerado, rode `npm run build` (ou o comando de typecheck do projeto) e faça commit antes de seguir para o próximo.
- Sempre que um prompt mexer em RLS/policies, teste com pelo menos 2 organizações diferentes (usuários de tenants distintos) antes de avançar.
- Os prompts da **Fase 1** corrigem falhas de segurança críticas (C1–C10 do AUDITORIA.md) e devem ser feitos **antes** de qualquer funcionalidade nova — construir estoque por técnico e financeiro novo sobre RLS quebrada só aumenta a superfície de risco.
- Onde aparecer `[REVISAR]`, é uma decisão de negócio que você precisa confirmar antes de rodar o prompt (ajuste o texto do prompt com a resposta).

---

## FASE 0 — Preparação

### Prompt 0.1 — Baseline e branch de trabalho

```
Antes de qualquer alteração, crie uma branch chamada `fix/seguranca-critica` a partir da main.
Rode `npm run build` (ou o comando equivalente do projeto) e me reporte se o build atual já falha,
e liste quais dos 3 lockfiles (package-lock.json, bun.lockb, yarn.lock ou similar) existem hoje no repositório.
Não faça nenhuma alteração de código ainda, só o diagnóstico.
```

---

## FASE 1 — Segurança Crítica (P0)

### Prompt 1.1 — RLS multi-tenant (C1)

```
Contexto: as policies RLS das tabelas `clientes`, `ordens_servico`, `itens_estoque`, `financeiro`,
`orcamentos`, `rotas`, `movimentacoes_estoque`, `os_anexos` e `os_historico` hoje verificam apenas
o role do usuário (admin/tecnico/consulta), sem verificar a organização (org). Isso significa que
qualquer usuário autenticado de uma organização consegue ler e alterar dados de outras organizações.

Tarefa:
1. Crie uma migration SQL nova (não edite migrations já aplicadas em produção) que:
   a. Garante que existe a função `get_user_org_id()` retornando o organization_id do usuário logado
      (via auth.uid() e a tabela de perfis/usuários).
   b. Faz DROP e recria todas as policies das tabelas listadas acima, adicionando SEMPRE a condição
      `organization_id = get_user_org_id()` em conjunto com a checagem de role existente (não remova
      a checagem de role, apenas adicione o escopo de org).
   c. Cubra os quatro tipos de operação: SELECT, INSERT, UPDATE, DELETE — hoje muitas tabelas podem
      ter só policy de SELECT/INSERT checada.
2. Depois de gerar a migration, escreva um script de teste (pode ser um arquivo .sql ou um teste
   com supabase-js) que cria dois usuários de organizações diferentes e confirma que um não consegue
   ler/alterar dados do outro em nenhuma das tabelas listadas.
3. Não altere lógica de frontend neste prompt, só banco de dados.
Me mostre a migration completa antes de aplicá-la.
```

### Prompt 1.2 — `empresa_config` e credenciais de gateway (C2)

```
Contexto: a tabela `empresa_config` tem uma policy `SELECT USING (true)`, ou seja, qualquer usuário
autenticado lê a configuração de todas as organizações, incluindo credenciais de gateway de pagamento
guardadas em uma coluna jsonb em texto claro (migrations 20260305130706 e 20260516205740).

Tarefa:
1. Crie uma migration que corrige a policy de `empresa_config` para `organization_id = get_user_org_id()`
   em todas as operações (SELECT/INSERT/UPDATE/DELETE).
2. Extraia as credenciais de gateway de pagamento (chaves Asaas e afins) da coluna jsonb da
   `empresa_config` para uma tabela nova `empresa_gateway_credenciais`, com:
   - RLS restrita a `organization_id = get_user_org_id()` E role = 'admin' (nem técnico nem consulta
     deve conseguir ler credenciais).
   - As credenciais NUNCA devem ser lidas diretamente pelo frontend: crie/ajuste as edge functions
     que hoje usam essas chaves para lerem da nova tabela, sempre no contexto de service role dentro
     da própria function, nunca expondo a chave para o client.
3. Escreva um script de migração de dados que copia as credenciais existentes de `empresa_config`
   para a nova tabela, e depois remova a coluna antiga.
Me mostre a migration e a lista de edge functions que precisam ser ajustadas antes de aplicar.
```

### Prompt 1.3 — Remover backdoor de administração (C3)

```
Contexto: existe uma senha hardcoded no bundle do frontend (usuário/senha fixos) em `AdminAuth.tsx`
(linhas ~15-18 e 53), além de um bypass via localStorage checado em `ProtectedRoute.tsx` (linhas
~23-26) e `useOrganization.tsx` (linhas ~27-32).

Tarefa:
1. Remova completamente a senha hardcoded de `AdminAuth.tsx`.
2. Remova o bypass de `localStorage` em `ProtectedRoute.tsx` e `useOrganization.tsx` — nenhuma
   checagem de autenticação ou de role de admin pode depender de um valor lido do localStorage.
3. Substitua o login de admin master por autenticação real via Supabase Auth, usando uma tabela
   `platform_admins` (ou equivalente) que marca quais usuários (por auth.uid()) têm acesso ao painel
   admin master, checada sempre a partir do backend/RLS, nunca só no frontend.
4. Faça uma varredura no repositório inteiro (grep) por outras strings de senha hardcoded ou
   comparações de senha em texto claro e me liste todas as ocorrências encontradas, mesmo que não
   as corrija automaticamente — quero revisar cada uma manualmente.
```

### Prompt 1.4 — `seed-platform-admin` pública e destrutiva (C4)

```
Contexto: a edge function `seed-platform-admin/index.ts` tem credenciais hardcoded (linhas ~12-13),
reseta a senha do admin master toda vez que é chamada (linha ~34) e devolve a senha em texto claro
na resposta HTTP (linha ~50). Essa function parece estar acessível publicamente.

Tarefa:
1. Adicione `verify_jwt = true` no config.toml para esta function (ou remova-a do config.toml e do
   deploy se ela só foi usada uma vez para setup inicial).
2. Remova as credenciais hardcoded do código.
3. Remova o comportamento de "resetar senha a cada chamada" e o retorno da senha na resposta.
4. Se a function ainda for necessária para operações de setup, reescreva-a para exigir que quem
   chama já seja um platform_admin autenticado, e para nunca devolver senha em texto claro — se
   precisar criar um admin, deve enviar um convite/link de definição de senha, não devolver a senha.
Me explique o que você decidiu fazer com a function (manter reescrita ou remover) antes de aplicar.
```

### Prompt 1.5 — Webhooks sem assinatura (C5)

```
Contexto: os webhooks do Asaas/Mercado Pago/Mercado Livre estão com `verify_jwt=false` no config.toml
e não validam nenhuma assinatura, então qualquer pessoa externa pode forjar uma requisição simulando
um pagamento confirmado ou um desbloqueio de tenant.

Tarefa:
1. Para cada webhook (Asaas, MP, ML), implemente a validação de assinatura/HMAC seguindo a
   documentação oficial de cada provedor (verifique o cabeçalho de assinatura que cada um envia).
2. Rejeite (HTTP 401) qualquer requisição cuja assinatura não bata, antes de processar qualquer
   lógica de negócio.
3. Adicione idempotência: se o mesmo evento de webhook (por ID do evento do provedor) já foi
   processado, não reprocessar, para evitar duplicidade de baixa de pagamento em reenvios.
4. Documente no próprio código, em comentário, o link da documentação oficial usada para validar
   cada assinatura.
Liste quais variáveis de ambiente/segredos novos precisam ser configurados (ex: webhook secret de
cada provedor) para eu configurar no Supabase antes do deploy.
```

### Prompt 1.6 — Service role sem escopo de org (C6)

```
Contexto: `api/index.ts` faz operações de CRUD usando a service role sem filtrar por organization_id
(linha ~50), e o proxy `asaas/index.ts` (linhas ~40-53, 142, 186-192) opera com a conta da plataforma
independente de qual organização está chamando.

Tarefa:
1. Em `api/index.ts`, adicione validação obrigatória: toda operação deve extrair o organization_id
   do usuário autenticado (via JWT) e filtrar/injetar esse organization_id em toda query — mesmo
   usando service role, a query deve ser explicitamente escopada por org no código, não confiar
   só na RLS.
2. Em `asaas/index.ts`, garanta que a operação usa as credenciais Asaas da organização do usuário
   chamador (lidas da tabela `empresa_gateway_credenciais` criada no Prompt 1.2), não uma chave
   fixa da plataforma — a menos que a operação seja explicitamente de plataforma (ex: cobrança do
   próprio SaaS ao tenant), caso em que isso deve estar claramente separado em outra function.
3. Adicione um teste que simula dois usuários de organizações diferentes chamando a mesma function
   e confirma que cada um só vê/altera dados da própria organização.
```

### Prompt 1.7 — `check-overdue-tenants` sem autenticação (C7)

```
Contexto: a edge function `check-overdue-tenants/index.ts` (linhas ~6-10) não exige autenticação,
então qualquer chamador externo pode disparar o bloqueio em massa de tenants.

Tarefa:
1. Restrinja essa function para só ser chamável por um cron job interno do Supabase (usando
   `verify_jwt=true` e checando um secret compartilhado ou role de service, nunca acessível
   publicamente).
2. Adicione um log de auditoria (tabela `admin_audit_log`) registrando toda vez que um tenant é
   bloqueado por essa function, com data/hora e motivo.
3. Faça o mesmo tratamento para a function `test-tenant-gateway` mencionada no relatório (A10/5.3):
   proteja ou remova se não for mais necessária.
```

### Prompt 1.8 — Banco de dados não reproduzível (C8)

```
Contexto: as entidades `organizations`, a coluna `organization_id` em várias tabelas, e a função
`get_user_org_id()` existem hoje só no banco de produção (vivo), sem migration correspondente no
repositório. Rodar `supabase db reset` falha porque o banco não consegue ser recriado do zero
só com as migrations versionadas.

Tarefa:
1. Rode `supabase db diff` (ou compare manualmente o schema de produção com as migrations) e me
   liste TODAS as diferenças encontradas: tabelas, colunas, funções, triggers e policies que existem
   no banco vivo mas não em nenhuma migration do repositório.
2. Para cada diferença, gere uma migration nova que a recria (usando `CREATE TABLE IF NOT EXISTS`,
   `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, para serem seguras de reaplicar).
3. Depois de gerar todas as migrations, rode `supabase db reset` localmente e confirme que o banco
   sobe do zero sem erros e com o schema idêntico ao de produção.
4. Documente em um arquivo `MIGRATIONS_NOTES.md` a ordem em que as migrations do prompt 1.1 a 1.8
   precisam ser aplicadas em produção, já que houve alterações incrementais.
```

### Prompt 1.9 — RPCs SECURITY DEFINER sem REVOKE (C9)

```
Contexto: as RPCs `count_os_current_month` e `count_active_users` (migration 20260516205740, linhas
26-36) são SECURITY DEFINER e podem ser chamadas passando um parâmetro `_org` arbitrário, sem checar
se quem chama pertence àquela org — expondo métricas de qualquer organização. O hook `useUsageLimits.tsx`
(linhas 36-37) hoje depende desse comportamento.

Tarefa:
1. Altere essas RPCs para ignorar qualquer parâmetro `_org` recebido do client e usar sempre
   `get_user_org_id()` internamente para determinar de qual organização calcular a métrica.
2. Adicione `REVOKE ALL ON FUNCTION count_os_current_month FROM public, anon;` e o mesmo para
   `count_active_users`, garantindo que só usuários autenticados (`authenticated`) possam chamá-las.
3. Ajuste `useUsageLimits.tsx` para não enviar mais o parâmetro `_org` nas chamadas.
4. Faça uma varredura em todas as outras funções SECURITY DEFINER do projeto e me liste quais delas
   também aceitam algum parâmetro de organização vindo do client, para eu avaliar se têm o mesmo problema.
```

### Prompt 1.10 — Revisão da migration destrutiva (C10)

```
Contexto: a migration `20260618123536` faz TRUNCATE de 23 tabelas e um DELETE FROM auth.users,
e está no histórico de migrations do projeto.

Tarefa:
1. NÃO remova essa migration do histórico se ela já foi aplicada em produção (isso quebraria o
   histórico do supabase). Em vez disso, me mostre o conteúdo completo dela e explique o que ela
   fez, para eu confirmar se foi intencional (ex: reset de ambiente de staging) ou um erro.
2. Se eu confirmar que foi um erro/teste que vazou para o histórico principal, crie uma migration
   nova de documentação (um comentário SQL, sem executar nada) registrando o que aconteceu, para
   qualquer pessoa que rodar `db reset` no futuro entender por que aquele TRUNCATE está lá.
3. Adicione uma proteção para o futuro: um pre-commit hook ou CI check que barra qualquer nova
   migration contendo `TRUNCATE` ou `DELETE FROM auth.users` sem uma flag explícita de confirmação
   no nome do arquivo (ex: sufixo `_DESTRUCTIVE_CONFIRMED`).
Não aplique nada neste prompt sem eu confirmar a intenção da migration original.
```

---

## FASE 2 — Prioridade Alta (A1–A10)

### Prompt 2.1 — Trigger de permissões ausente (A1)

```
Contexto: a trigger `handle_new_user_permissions` nunca foi criada (migration 20260305123058,
linhas 27-39), então usuários novos não têm linha em `user_permissions`. Por isso, `usePermissions.tsx`
(linhas 37 e 40) e `App.tsx` (linhas 103-119) fazem fail-open e concedem acesso a OS/Estoque por
padrão quando não encontram permissão cadastrada.

Tarefa:
1. Crie a migration com a trigger `handle_new_user_permissions` (AFTER INSERT em auth.users ou na
   tabela de perfis, o que for o padrão do projeto) que popula `user_permissions` com todas as
   permissões marcadas como `false` por padrão (fail-closed), exceto o mínimo necessário para o
   usuário conseguir logar e ver seu próprio perfil.
2. Corrija `usePermissions.tsx` para que, na ausência de uma linha de permissão, o comportamento
   seja negar acesso (fail-closed) e não conceder (fail-open).
3. Escreva um teste que cria um usuário novo e confirma que ele NÃO tem acesso a OS/Estoque até
   que um admin conceda explicitamente.
```

### Prompt 2.2 — Signup de tenant com plano inexistente (A2)

```
Contexto: `signup-tenant/index.ts` (linhas 38-47) usa o plano 'basic', que não existe na tabela de
planos (os planos válidos são bronze/prata/ouro), resultando em fee 0. Além disso, o cadastro
auto-confirma o email e não tem rate-limit nem CAPTCHA (`CadastroEmpresa.tsx` linha 26).

Tarefa:
1. Corrija `signup-tenant/index.ts` para usar um plano válido de fato (ex: o plano de trial oficial,
   ou o mais barato configurado na tabela de planos) — nunca um código de plano que não existe.
2. Remova o auto-confirm de email; envie o email de confirmação padrão do Supabase Auth e só libere
   o acesso completo após confirmação.
3. Adicione rate-limiting na function de signup (por IP e por email) e integre um CAPTCHA (ex:
   Cloudflare Turnstile ou hCaptcha) no formulário `CadastroEmpresa.tsx`.
```

### Prompt 2.3 — Falta de checagem de role/org em cobrança (A3, A4)

```
Contexto: `create-customer-charge/index.ts` (linhas 24, 40-51, 55) permite que qualquer role,
incluindo 'consulta', gere uma cobrança/PIX, e não valida se o `cliente_id` pertence à organização
de quem está chamando. `asaas-customer-sync/index.ts` (linhas 29, 37) tem o mesmo problema de falta
de checagem de role/org e usa a chave da plataforma em vez da chave da organização.

Tarefa:
1. Em `create-customer-charge/index.ts`, adicione checagem de role (apenas admin/técnico podem gerar
   cobrança, não 'consulta') e valide que o `cliente_id` recebido pertence à organização do usuário
   autenticado antes de prosseguir.
2. Em `asaas-customer-sync/index.ts`, adicione a mesma checagem de role/org, e troque o uso da chave
   da plataforma pela chave Asaas da própria organização (lida de `empresa_gateway_credenciais`).
3. Escreva testes cobrindo: usuário 'consulta' tentando gerar cobrança (deve falhar) e usuário
   tentando gerar cobrança para cliente de outra org (deve falhar).
```

### Prompt 2.4 — Funcionalidades incompletas e OS sem org (A5–A9)

```
Contexto: existem várias pendências menores de reprodutibilidade e funcionalidade:
- A5: a tabela `organizations` não tem policy de SELECT para membros no repositório (só existe no
  banco vivo), então `useOrganization.tsx` (linhas 64-68) quebraria se a RLS real fosse aplicada.
- A6: a coluna `rotas.organization_id` existe só no banco vivo (drift), usada em `Rotas.tsx:62` e
  `types.ts:922`.
- A7: o retorno de webhook do Asaacard/MP busca a OS pelo campo `id`, mas o botão de pagamento
  (`OrdensServico.tsx:770-776`) envia `numero` como `externalReference`, então o pagamento nunca
  encontra a OS certa.
- A8: `Deslocamentos.tsx` é 100% mockado; `EmpresaConfig.tsx:70` descarta campos preenchidos pelo
  usuário; `Orcamentos.tsx:153-163` insere OS sem organization_id.
- A9: a policy de `user_permissions` é role-only, sem escopo de org (mesmo problema do C1, aplicado
  a essa tabela específica).

Tarefa: resolva os cinco pontos, um de cada vez, nesta ordem, mostrando o diff de cada um antes de
seguir para o próximo:
1. Crie a policy de SELECT de `organizations` (via migration) permitindo que um usuário veja a
   organização à qual pertence.
2. Crie a migration para `rotas.organization_id` (coluna + policy escopada).
3. Corrija o `externalReference` do botão de pagamento para enviar o `id` da OS (mesmo campo que o
   webhook usa para buscar), garantindo consistência de ponta a ponta.
4. Implemente a integração real de `Deslocamentos.tsx` com as tabelas do banco (removendo o mock).
5. Corrija `EmpresaConfig.tsx` para persistir todos os campos preenchidos, e `Orcamentos.tsx` para
   sempre gravar `organization_id` ao inserir uma OS a partir de um orçamento aprovado.
6. Adicione a mesma correção de escopo de org do Prompt 1.1 na tabela `user_permissions` (A9).
```

### Prompt 2.5 — Credenciais versionadas e limpeza de scripts manuais

```
Contexto: existe um `.env` versionado com credenciais reais, senhas hardcoded remanescentes, e
scripts SQL soltos fora da pasta de migrations (`supabase/fix-missing-org-id.sql`,
`add-platform-admin.sql`, `reset-platform-admin.sql`), além de CORS `*` liberado em todas as edge
functions e a policy do storage bucket `os-anexos` sendo role-only, sem escopo de org.

Tarefa:
1. Remova o `.env` do controle de versão, adicione ao `.gitignore`, e me avise quais credenciais
   estavam nele para eu rotacionar manualmente (trocar as chaves, já que vazaram no histórico do git).
2. Converta os scripts SQL soltos (`fix-missing-org-id.sql`, `add-platform-admin.sql`,
   `reset-platform-admin.sql`) em migrations formais numeradas, ou delete-os se já não forem mais
   necessários (me avise qual dos dois caminhos você tomou para cada arquivo).
3. Restrinja o CORS de todas as edge functions para a(s) origem(ns) real(is) do frontend, em vez de `*`.
4. Corrija a policy de storage do bucket `os-anexos` para escopar por organization_id, não só por role.
```

---

## FASE 3 — Cobrança por hora técnica (nova funcionalidade)

### Prompt 3.1 — Modelo de dados de cobrança por hora

```
Contexto: hoje todo serviço da tabela de serviços/itens de OS tem um valor fixo único. Precisamos
suportar dois modos de cobrança: valor fixo OU hora técnica.

Tarefa:
1. Crie uma migration adicionando à tabela de serviços as colunas:
   - `tipo_cobranca` (enum: 'fixo' | 'hora_tecnica'), default 'fixo'
   - `valor_fixo` (decimal, nullable)
   - `valor_hora` (decimal, nullable)
   - `hora_minima` (decimal, nullable, default 0)
   - `fracionamento` (enum: 'exato' | '15min' | '30min' | '1h', default 'exato')
2. Adicione à tabela de técnicos a coluna opcional `valor_hora_tecnica` (decimal, nullable) — quando
   preenchida, tem prioridade sobre o valor_hora do serviço.
3. Adicione a `empresa_config` a coluna `valor_hora_padrao` (decimal, not null, default 0) como
   fallback final.
4. Crie a tabela `os_apontamentos_horas`:
   - id, os_id, item_os_id, tecnico_id, inicio (timestamptz), fim (timestamptz, nullable),
     horas_lancadas (decimal, nullable — preenchido quando for lançamento manual em vez de cronômetro),
     origem (enum: 'cronometro' | 'manual'), observacao (text, nullable), created_at.
   - RLS escopada por organization_id (via join com a OS) seguindo o mesmo padrão do Prompt 1.1.
5. Nos itens de OS, adicione uma coluna `snapshot_tipo_cobranca` e `snapshot_valor_hora_efetivo`
   que gravam, no momento em que o item é adicionado à OS, qual era a regra vigente — para que
   alterar a taxa hora depois não mude o valor de OS já fechadas.
Me mostre a migration completa antes de aplicar.
```

### Prompt 3.2 — Cronômetro e lançamento manual de horas na UI

```
Contexto: precisamos que o técnico consiga registrar tempo trabalhado em um item de OS do tipo
'hora_tecnica', seja via cronômetro (iniciar/pausar/finalizar) ou lançamento manual de horas.

Tarefa:
1. No componente da OS (tela de detalhe/execução), para cada item com `tipo_cobranca = 'hora_tecnica'`,
   adicione um bloco de "Apontamento de horas" com:
   - Botão "Iniciar" que cria um registro em `os_apontamentos_horas` com `inicio = now()`,
     `origem = 'cronometro'`.
   - Enquanto rodando, mostra o tempo decorrido ao vivo.
   - Botão "Finalizar" que grava `fim = now()` no registro aberto.
   - Um formulário alternativo "Lançar horas manualmente" (campo numérico de horas + observação)
     que cria um registro com `origem = 'manual'` e `horas_lancadas` preenchido direto.
   - Uma lista dos apontamentos já feitos naquele item, com opção de editar/excluir (só admin/técnico
     responsável, respeitando RLS).
2. Mostre, junto ao item, o valor calculado em tempo real: soma de todas as horas do item, aplicando
   `hora_minima` e o `fracionamento` configurado no serviço, multiplicado pela taxa efetiva
   (técnico > serviço > empresa, nessa ordem de prioridade).
3. Implemente a função de cálculo do valor do item como uma função pura reutilizável (não duplique
   a lógica entre frontend e backend) — se possível, calcule também via uma função SQL/RPC para
   que o valor final salvo na OS sempre bata com o exibido na tela, mesmo em race conditions.
```

### Prompt 3.3 — Orçamento estimado e ligação com comissão

```
Contexto: ao criar uma OS/orçamento antes de iniciar o trabalho, para itens do tipo 'hora_tecnica'
ainda não temos apontamento de horas real, então precisamos de uma estimativa. Além disso, a RPC de
comissão precisa considerar corretamente valores vindos de itens por hora.

Tarefa:
1. No wizard de criação de OS, para item do tipo 'hora_tecnica', adicione um campo opcional
   "Estimativa de horas", usado apenas para exibir um valor estimado ao cliente no orçamento —
   deixe explícito na UI (ex: badge "valor estimado, pode variar conforme horas trabalhadas").
2. Ajuste a RPC `calculate_os_commission` para usar sempre o `valor_item` já calculado (snapshot
   final), independente de ser fixo ou por hora — não precisa reimplementar o cálculo de horas
   dentro da RPC de comissão, só ler o valor final gravado no item.
3. Adicione, na tela de extrato de comissão do técnico, uma quebra mostrando quanto da comissão do
   período veio de "serviços fixos" vs "horas técnicas", para o técnico entender a composição do
   próprio ganho.
```

---

## FASE 4 — Estoque individual por técnico (nova funcionalidade)

### Prompt 4.1 — Modelo de dados: consumíveis vs. ferramentas/patrimônio

```
Contexto: hoje existe um único estoque central (`itens_estoque` / `movimentacoes_estoque`).
Precisamos que cada técnico tenha seu próprio sub-estoque de peças consumíveis, e um controle
separado de ferramentas (patrimônio) que ficam sob custódia do técnico sem serem "consumidas".

Tarefa:
1. Crie a tabela `estoque_tecnico` (organization_id, tecnico_id, item_estoque_id, quantidade,
   updated_at), com RLS: técnico só vê/altera o próprio; admin vê todos da própria org.
2. Crie a tabela `transferencias_estoque` (organization_id, item_estoque_id, quantidade,
   origem_tipo ('central'|'tecnico'), origem_id, destino_tipo ('central'|'tecnico'), destino_id,
   status ('pendente'|'confirmada'), solicitado_por, confirmado_por, created_at, confirmed_at) —
   toda transferência do estoque central para um técnico (ou entre técnicos) passa por aqui, e só
   afeta os saldos quando confirmada pelo técnico destinatário (ou por um admin, em nome dele).
3. Ao confirmar uma transferência, decrementar o saldo de origem e incrementar o saldo de destino
   dentro de uma transaction, e registrar em `movimentacoes_estoque` (reaproveite a tabela já
   existente) com o tipo 'transferencia_tecnico'.
4. Crie a tabela `patrimonio_ferramentas` (organization_id, nome, numero_serie, status:
   'disponivel'|'em_uso'|'manutencao'|'extraviada', tecnico_atual_id nullable, valor_referencia).
5. Crie a tabela `patrimonio_movimentacoes` (patrimonio_id, tecnico_anterior_id nullable,
   tecnico_novo_id nullable, tipo: 'entrega'|'devolucao'|'transferencia'|'extravio', observacao,
   confirmado_por, created_at) — todo histórico de quem esteve com cada ferramenta.
Me mostre a migration completa, incluindo todas as RLS policies, antes de aplicar.
```

### Prompt 4.2 — UI de gestão de estoque por técnico (visão do admin)

```
Contexto: o admin/gestor precisa enxergar, de forma consolidada, o que cada técnico tem em mãos.

Tarefa:
1. Crie uma nova tela "Estoque por Técnico" (acessível pelo menu de Estoque) mostrando, para cada
   técnico: lista de itens consumíveis com quantidade, e lista de ferramentas sob sua custódia com
   status.
2. Adicione um botão "Transferir para técnico" na tela de estoque central, que abre um formulário
   (item, quantidade, técnico destino) e cria um registro em `transferencias_estoque` com status
   'pendente'.
3. Adicione alertas de estoque baixo POR TÉCNICO (reaproveite a lógica já existente de estoque
   baixo geral, mas aplicada ao saldo em `estoque_tecnico`), exibidos tanto na tela de estoque
   quanto como um card no dashboard principal.
4. Para ferramentas: tela de listagem de patrimônio com filtro por status e por técnico atual, e
   botão de "Registrar entrega" / "Registrar devolução" que grava em `patrimonio_movimentacoes` e
   atualiza `patrimonio_ferramentas.tecnico_atual_id` e `status`.
```

### Prompt 4.3 — Confirmação de recebimento pelo técnico (mobile-first)

```
Contexto: quando o admin registra uma transferência de estoque ou entrega de ferramenta, o técnico
precisa confirmar o recebimento pelo próprio celular, para gerar rastreabilidade de responsabilidade.

Tarefa:
1. Na área do técnico (mobile), adicione uma seção "Recebimentos pendentes" listando transferências
   de estoque e entregas de ferramentas com status 'pendente' destinadas a ele.
2. Adicione um botão "Confirmar recebimento" que, ao ser clicado, atualiza o status para 'confirmada'
   e só nesse momento aplica a movimentação de saldo (conforme definido no Prompt 4.1).
3. Envie uma notificação (reaproveitando a infraestrutura de notificações já existente no sistema)
   ao técnico quando uma nova transferência/entrega pendente for criada para ele.
4. Adicione também, no fluxo de uso de peça em uma OS, a baixa automática do `estoque_tecnico` do
   técnico responsável pela OS (não mais do estoque central) quando ele adicionar um item de peça
   à OS — se o técnico não tiver saldo suficiente, bloqueie a ação e sugira solicitar transferência.
```

---

## FASE 5 — Dashboard financeiro do gestor (nova funcionalidade)

### Prompt 5.1 — Fluxo de caixa diário e comparativos

```
Contexto: o dashboard atual mostra KPIs agregados (OS abertas, faturamento, a receber) mas não dá
uma visão de fluxo de caixa do dia nem comparativos entre períodos.

Tarefa:
1. Adicione ao dashboard principal um card "Fluxo de caixa de hoje" mostrando: total de entradas
   confirmadas hoje, total de saídas confirmadas hoje, saldo do dia, e saldo acumulado do mês.
2. Adicione um comparativo "hoje vs. mesmo dia da semana passada" e "semana atual vs. semana
   anterior" para faturamento e para número de OS concluídas, usando os componentes de gráfico
   já existentes no projeto (reaproveite bibliotecas/estilo já usados nos relatórios atuais).
3. Adicione um card "Contas a receber vencendo" com abas: "vence hoje", "vence essa semana",
   "atrasadas", cada uma com contagem e valor total, e um link direto para a tela de cobranças
   filtrada.
4. Todas as queries devem respeitar a RLS já corrigida na Fase 1 (escopadas por organization_id).
```

### Prompt 5.2 — Painel de técnicos no dashboard

```
Contexto: hoje o relatório só tem "top 5 clientes por número de OS". Falta uma visão de
performance por técnico para o gestor acompanhar diariamente.

Tarefa:
1. Adicione ao módulo de Relatórios uma nova seção "Desempenho por técnico" com, por técnico e por
   período selecionado: número de OS concluídas, ticket médio, valor total de comissão gerada, e a
   quebra entre comissão de serviços fixos vs. horas técnicas (dado criado na Fase 3).
2. Adicione um card resumido dessa informação no dashboard principal (ex: ranking dos 3 técnicos
   com mais OS concluídas no mês).
3. Inclua também, nessa seção, um indicador de estoque: quantos itens/ferramentas cada técnico tem
   sob custódia atualmente, com link para a tela de "Estoque por Técnico" da Fase 4.
```

---

## FASE 6 — Paridade financeira com o Bling

### Prompt 6.1 — Contas a pagar

```
Contexto: hoje o sistema tem contas a receber ligadas a OS, mas não um módulo estruturado de
contas a pagar (fornecedores, despesas fixas, folha).

Tarefa:
1. Crie a tabela `contas_pagar` (organization_id, descricao, fornecedor_id nullable, categoria,
   valor, data_vencimento, data_pagamento nullable, status: 'pendente'|'pago'|'atrasado',
   recorrente: boolean, periodicidade nullable: 'mensal'|'semanal'|'anual', created_by).
2. Crie uma tela de gestão de contas a pagar com listagem, filtro por status/vencimento, criação
   manual e criação de conta recorrente (que gera automaticamente o próximo lançamento ao marcar
   o atual como pago, via trigger ou job agendado).
3. Adicione lembretes automáticos (reaproveitando a infraestrutura de notificações existente) para
   contas a pagar vencendo em 3 dias e para contas já vencidas.
4. Ligue esses valores ao card de "Fluxo de caixa de hoje" criado na Fase 5, somando as saídas
   previstas do dia.
```

### Prompt 6.2 — DRE simplificado e fluxo de caixa projetado

```
Contexto: o dashboard mostra "lucro líquido" mas não uma demonstração de resultado estruturada,
nem uma projeção de caixa futuro considerando contas a pagar/receber ainda não liquidadas.

Tarefa:
1. Crie um relatório "DRE simplificado" por período (mês/trimestre/ano) com a estrutura:
   Receita bruta (soma de OS + vendas) → (-) Comissões → (-) Custo de peças/estoque usado →
   (-) Despesas operacionais (por categoria de `contas_pagar`) → Resultado líquido.
2. Crie um relatório "Fluxo de caixa projetado" que soma, por data futura, todas as contas a
   receber pendentes e contas a pagar pendentes, mostrando o saldo projetado dia a dia pelos
   próximos 30/60/90 dias (parametrizável), para o gestor saber se vai faltar caixa.
3. Ambos os relatórios devem ter opção de exportar para PDF/impressão, reaproveitando o mecanismo
   de exportação já existente no módulo de Relatórios.
```

---

## FASE 7 — Nota fiscal eletrônica (bloqueador legal)

### Prompt 7.1 — Levantamento e integração

```
Contexto: o sistema hoje não emite nenhum tipo de nota fiscal (NF-e para produtos vendidos, NFS-e
para serviços prestados), o que é uma obrigação legal para uma loja que vende produtos e presta
serviço.

Tarefa (este prompt é de pesquisa/planejamento, não de implementação direta):
1. Pesquise e me apresente 2-3 opções de provedores de emissão de NF-e/NFS-e com API para
   integração (ex: Focus NFe, eNotas, PlugNotas, NFE.io ou similar), comparando: cobertura de
   município (para NFS-e, que é municipal), preço por nota, facilidade de integração via API REST,
   e se oferecem ambiente de homologação/teste.
2. Não implemente nada ainda — apenas me traga o comparativo para eu escolher o provedor antes de
   você desenhar a integração (a integração vai envolver dados fiscais da empresa, CNAE, regime
   tributário, etc., que precisam ser configurados corretamente).
```

---

## FASE 8 — Qualidade e processo

### Prompt 8.1 — Consolidar lockfiles e CI básico

```
Contexto: o projeto tem 3 lockfiles conflitantes (npm + bun), sem CI, e o typecheck só roda
implicitamente durante o build.

Tarefa:
1. Escolha um único gerenciador de pacotes (recomendo manter o que já está no CI/deploy atual, ou
   me pergunte se não estiver claro) e remova os lockfiles dos outros gerenciadores, adicionando-os
   ao .gitignore.
2. Configure um workflow de CI (GitHub Actions ou equivalente ao que o repositório já usa) que rode,
   em cada PR: install, typecheck (`tsc --noEmit`), lint, e build.
3. Adicione testes automatizados mínimos para os pontos mais críticos corrigidos na Fase 1: RLS
   multi-tenant (Prompt 1.1), cálculo de comissão (incluindo horas técnicas da Fase 3), e o fluxo
   de transferência/confirmação de estoque por técnico (Fase 4).
```

---

## Ordem recomendada de execução

1. Fase 0 → Fase 1 (todos os prompts, um de cada vez, com testes entre eles)
2. Fase 2 (A1 a A10)
3. Fase 3 (cobrança por hora) — pode ser feita em paralelo com a Fase 4, são independentes
4. Fase 4 (estoque por técnico)
5. Fase 5 (dashboard do gestor) — depende de dados já existirem das Fases 3 e 4 para ficar completo
6. Fase 6 (contas a pagar, DRE, projeção)
7. Fase 7 (nota fiscal) — pode ser priorizada mais cedo se já for bloqueador comercial hoje
8. Fase 8 (qualidade) — ideal rodar em paralelo desde o início, mas pode ficar por último se o tempo for curto
