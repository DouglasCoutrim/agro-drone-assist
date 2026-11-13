-- =====================================================================
-- RELATORIO GENERICO FASE 1: catalogo de fontes de relatorio
-- Arquivo: supabase/migrations/20261003170000_relatorio_fontes.sql
-- Estado: APLICADA no projeto Supabase.
--
-- Por que esta migration existe:
-- Um relatorio personalizado precisa deixar o usuario escolher tabela,
-- colunas, filtros, periodo e limite. Se esses nomes viessem do navegador,
-- a montagem do SQL no servidor passaria a aceitar identificador vindo do
-- cliente, que e exatamente o que nao pode acontecer.
--
-- Solucao: a tabela abaixo e a unica fonte de nomes aceitos. O navegador
-- manda apenas o "id" da fonte e as chaves de coluna/filtro; a funcao
-- gerar_relatorio() confere cada chave contra este catalogo e descarta o
-- que nao estiver aqui. Nome de tabela e de coluna nunca chegam do cliente.
--
-- Conteudo do catalogo (8 fontes):
--   colunas -> jsonb [{nome, rotulo, tipo}] onde tipo e
--              texto | numero | data | booleano
--   filtros -> jsonb [nome] com as colunas oferecidas para filtro
--              (invariante: todo nome em filtros existe em colunas)
--   perfis  -> perfis (app_role) que enxergam a fonte
--
-- Exclusoes deliberadas (dado sensivel de terceiro, credencial ou custo):
--   clientes.cpf_cnpj                e vendas.cliente_cpf_cnpj
--   fornecedores.cpf_cnpj            e nota_fiscal_emitida.cliente_cpf_cnpj
--   clientes.asaas_id                (id de gateway de pagamento)
--   itens_estoque.custo_unitario     (custo de compra)
--   ordens_servico.custo_pecas, custo_mao_obra e commission_*
--   nota_fiscal_emitida.xml_conteudo, payload_envio, payload_retorno
--   colunas de usuario_id / tecnico_id / vendido_por / emitida_por
--
-- Leitura: qualquer usuario autenticado le o catalogo.
-- Escrita: apenas platform admin.
-- =====================================================================

create table public.relatorio_fontes (
  id text primary key,
  rotulo text not null,
  tabela text not null,
  filtro_org text not null default 'organization_id',
  coluna_data text,
  colunas jsonb not null,
  filtros jsonb not null,
  perfis text[] not null
);

grant select on public.relatorio_fontes to authenticated;
grant select, insert, update, delete on public.relatorio_fontes to service_role;

alter table public.relatorio_fontes enable row level security;

create policy "Fontes de relatorio: leitura autenticada"
  on public.relatorio_fontes for select to authenticated using (true);

create policy "Fontes de relatorio: platform admin insere"
  on public.relatorio_fontes for insert to authenticated
  with check (public.is_platform_admin(auth.uid()));

create policy "Fontes de relatorio: platform admin atualiza"
  on public.relatorio_fontes for update to authenticated
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create policy "Fontes de relatorio: platform admin remove"
  on public.relatorio_fontes for delete to authenticated
  using (public.is_platform_admin(auth.uid()));

insert into public.relatorio_fontes (id, rotulo, tabela, filtro_org, coluna_data, colunas, filtros, perfis) values
('ordens_servico', 'Ordens de serviço', 'ordens_servico', 'organization_id', 'data_entrada',
 '[{"nome":"numero","rotulo":"Número","tipo":"texto"},{"nome":"tipo_equipamento","rotulo":"Tipo de equipamento","tipo":"texto"},{"nome":"modelo_equipamento","rotulo":"Modelo","tipo":"texto"},{"nome":"numero_serie","rotulo":"Número de série","tipo":"texto"},{"nome":"marca","rotulo":"Marca","tipo":"texto"},{"nome":"status","rotulo":"Situação","tipo":"texto"},{"nome":"prioridade","rotulo":"Prioridade","tipo":"texto"},{"nome":"descricao_problema","rotulo":"Problema relatado","tipo":"texto"},{"nome":"diagnostico","rotulo":"Diagnóstico","tipo":"texto"},{"nome":"solucao","rotulo":"Solução","tipo":"texto"},{"nome":"observacoes","rotulo":"Observações","tipo":"texto"},{"nome":"valor_orcamento","rotulo":"Orçamento","tipo":"numero"},{"nome":"valor_final","rotulo":"Valor final","tipo":"numero"},{"nome":"desconto","rotulo":"Desconto","tipo":"numero"},{"nome":"nfe_emitida","rotulo":"NF-e emitida","tipo":"booleano"},{"nome":"nfse_numero","rotulo":"NFS-e","tipo":"texto"},{"nome":"data_entrada","rotulo":"Entrada","tipo":"data"},{"nome":"data_previsao","rotulo":"Previsão","tipo":"data"},{"nome":"data_conclusao","rotulo":"Conclusão","tipo":"data"},{"nome":"data_entrega","rotulo":"Entrega","tipo":"data"},{"nome":"created_at","rotulo":"Criado em","tipo":"data"}]'::jsonb,
 '["numero","status","prioridade","tipo_equipamento","marca","nfe_emitida","valor_final","data_entrada","data_conclusao"]'::jsonb,
 array['admin','tecnico']),

('vendas', 'Vendas', 'vendas', 'organization_id', 'data_venda',
 '[{"nome":"numero","rotulo":"Número","tipo":"texto"},{"nome":"data_venda","rotulo":"Data","tipo":"data"},{"nome":"cliente_nome","rotulo":"Cliente","tipo":"texto"},{"nome":"valor_produtos","rotulo":"Produtos","tipo":"numero"},{"nome":"valor_desconto","rotulo":"Desconto","tipo":"numero"},{"nome":"valor_impostos","rotulo":"Impostos","tipo":"numero"},{"nome":"valor_total","rotulo":"Total","tipo":"numero"},{"nome":"forma_pagamento","rotulo":"Forma de pagamento","tipo":"texto"},{"nome":"status_pagamento","rotulo":"Situação do pagamento","tipo":"texto"},{"nome":"ambiente","rotulo":"Ambiente","tipo":"texto"},{"nome":"obs","rotulo":"Observações","tipo":"texto"},{"nome":"nf_numero","rotulo":"NF-e","tipo":"texto"},{"nome":"nf_emitida_em","rotulo":"NF-e emitida em","tipo":"data"},{"nome":"criado_em","rotulo":"Criado em","tipo":"data"}]'::jsonb,
 '["numero","status_pagamento","forma_pagamento","data_venda","cliente_nome","valor_total"]'::jsonb,
 array['admin','tecnico']),

('clientes', 'Clientes', 'clientes', 'organization_id', 'created_at',
 '[{"nome":"nome","rotulo":"Nome","tipo":"texto"},{"nome":"email","rotulo":"E-mail","tipo":"texto"},{"nome":"telefone","rotulo":"Telefone","tipo":"texto"},{"nome":"endereco","rotulo":"Endereço","tipo":"texto"},{"nome":"numero","rotulo":"Número","tipo":"texto"},{"nome":"complemento","rotulo":"Complemento","tipo":"texto"},{"nome":"bairro","rotulo":"Bairro","tipo":"texto"},{"nome":"cidade","rotulo":"Cidade","tipo":"texto"},{"nome":"estado","rotulo":"Estado","tipo":"texto"},{"nome":"cep","rotulo":"CEP","tipo":"texto"},{"nome":"observacoes","rotulo":"Observações","tipo":"texto"},{"nome":"created_at","rotulo":"Cadastrado em","tipo":"data"},{"nome":"updated_at","rotulo":"Atualizado em","tipo":"data"}]'::jsonb,
 '["nome","email","cidade","estado","created_at"]'::jsonb,
 array['admin','tecnico','consulta']),

('itens_estoque', 'Estoque', 'itens_estoque', 'organization_id', 'created_at',
 '[{"nome":"codigo","rotulo":"Código","tipo":"texto"},{"nome":"descricao","rotulo":"Descrição","tipo":"texto"},{"nome":"categoria","rotulo":"Categoria","tipo":"texto"},{"nome":"finalidade","rotulo":"Finalidade","tipo":"texto"},{"nome":"unidade","rotulo":"Unidade","tipo":"texto"},{"nome":"quantidade","rotulo":"Quantidade","tipo":"numero"},{"nome":"estoque_minimo","rotulo":"Estoque mínimo","tipo":"numero"},{"nome":"preco_venda","rotulo":"Preço de venda","tipo":"numero"},{"nome":"fornecedor","rotulo":"Fornecedor","tipo":"texto"},{"nome":"localizacao","rotulo":"Localização","tipo":"texto"},{"nome":"ncm","rotulo":"NCM","tipo":"texto"},{"nome":"cfop","rotulo":"CFOP","tipo":"texto"},{"nome":"emite_nfe","rotulo":"Emite NF-e","tipo":"booleano"},{"nome":"created_at","rotulo":"Cadastrado em","tipo":"data"},{"nome":"updated_at","rotulo":"Atualizado em","tipo":"data"}]'::jsonb,
 '["codigo","descricao","categoria","finalidade","quantidade","preco_venda","created_at"]'::jsonb,
 array['admin']),

('movimentacoes_estoque', 'Movimentações de estoque', 'movimentacoes_estoque', 'organization_id', 'created_at',
 '[{"nome":"item_id","rotulo":"Produto (id)","tipo":"texto"},{"nome":"tipo","rotulo":"Tipo","tipo":"texto"},{"nome":"quantidade","rotulo":"Quantidade","tipo":"numero"},{"nome":"motivo","rotulo":"Motivo","tipo":"texto"},{"nome":"created_at","rotulo":"Data","tipo":"data"}]'::jsonb,
 '["item_id","tipo","motivo","created_at"]'::jsonb,
 array['admin','tecnico']),

('financeiro', 'Lançamentos manuais e recebimento de OS', 'financeiro', 'organization_id', 'data_transacao',
 '[{"nome":"tipo","rotulo":"Tipo","tipo":"texto"},{"nome":"descricao","rotulo":"Descrição","tipo":"texto"},{"nome":"valor","rotulo":"Valor","tipo":"numero"},{"nome":"categoria","rotulo":"Categoria","tipo":"texto"},{"nome":"data_transacao","rotulo":"Data","tipo":"data"},{"nome":"observacoes","rotulo":"Observações","tipo":"texto"},{"nome":"created_at","rotulo":"Criado em","tipo":"data"}]'::jsonb,
 '["tipo","categoria","descricao","valor","data_transacao"]'::jsonb,
 array['admin']),

('nota_fiscal_emitida', 'Notas fiscais', 'nota_fiscal_emitida', 'organization_id', 'emitida_em',
 '[{"nome":"numero","rotulo":"Número","tipo":"texto"},{"nome":"serie","rotulo":"Série","tipo":"texto"},{"nome":"tipo","rotulo":"Tipo","tipo":"texto"},{"nome":"tipo_operacao","rotulo":"Tipo de operação","tipo":"texto"},{"nome":"ambiente","rotulo":"Ambiente","tipo":"texto"},{"nome":"status","rotulo":"Situação","tipo":"texto"},{"nome":"referencia","rotulo":"Referência","tipo":"texto"},{"nome":"cliente_nome","rotulo":"Cliente","tipo":"texto"},{"nome":"valor_total","rotulo":"Total","tipo":"numero"},{"nome":"valor_impostos","rotulo":"Impostos","tipo":"numero"},{"nome":"valor_liquido","rotulo":"Líquido","tipo":"numero"},{"nome":"chave_acesso","rotulo":"Chave de acesso","tipo":"texto"},{"nome":"motivo_rejeicao","rotulo":"Motivo da rejeição","tipo":"texto"},{"nome":"emitida_em","rotulo":"Emitida em","tipo":"data"},{"nome":"cancelada_em","rotulo":"Cancelada em","tipo":"data"},{"nome":"created_at","rotulo":"Criado em","tipo":"data"}]'::jsonb,
 '["numero","status","tipo","ambiente","cliente_nome","emitida_em","valor_total"]'::jsonb,
 array['admin']),

('fornecedores', 'Fornecedores', 'fornecedores', 'organization_id', 'created_at',
 '[{"nome":"nome","rotulo":"Razão social","tipo":"texto"},{"nome":"nome_fantasia","rotulo":"Nome fantasia","tipo":"texto"},{"nome":"contato","rotulo":"Contato","tipo":"texto"},{"nome":"telefone","rotulo":"Telefone","tipo":"texto"},{"nome":"email","rotulo":"E-mail","tipo":"texto"},{"nome":"endereco","rotulo":"Endereço","tipo":"texto"},{"nome":"numero","rotulo":"Número","tipo":"texto"},{"nome":"complemento","rotulo":"Complemento","tipo":"texto"},{"nome":"bairro","rotulo":"Bairro","tipo":"texto"},{"nome":"cidade","rotulo":"Cidade","tipo":"texto"},{"nome":"estado","rotulo":"Estado","tipo":"texto"},{"nome":"cep","rotulo":"CEP","tipo":"texto"},{"nome":"observacoes","rotulo":"Observações","tipo":"texto"},{"nome":"ativo","rotulo":"Ativo","tipo":"booleano"},{"nome":"created_at","rotulo":"Cadastrado em","tipo":"data"}]'::jsonb,
 '["nome","nome_fantasia","cidade","estado","ativo","created_at"]'::jsonb,
 array['admin','tecnico']);
