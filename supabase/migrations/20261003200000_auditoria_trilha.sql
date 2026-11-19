-- =====================================================================
-- AUDITORIA: trilha de quem fez o que na organizacao
-- Arquivo: supabase/migrations/20261003200000_auditoria_trilha.sql
-- Estado: APLICADA no projeto Supabase.
--
-- Por que esta migration existe:
-- O sistema nao tinha como responder "quem alterou este registro". O que
-- existia: admin_audit_log (so bloqueio de empresa, nada lia), os_historico
-- (historico de uma OS) e colunas de autoria espalhadas (vendas.vendido_por,
-- financeiro.usuario_id, created_by), que dizem quem CRIOU -- nunca o que
-- mudou depois, nem quem apagou.
--
-- Desenho decidido com o usuario:
--   escopo   -> alteracoes de dados (insert/update/delete). Login e troca de
--               senha nao entram nesta fase.
--   detalhe  -> somente os campos que mudaram, com valor antes e depois.
--   leitura  -> apenas admin da propria organizacao (platform admin ve todas).
--   sensivel -> CPF/CNPJ mascarados; credencial, token, chave, certificado,
--               XML e payload nem o valor mascarado entra.
--
-- Garantias:
--   - A trilha e append-only: nao existe policy de UPDATE nem de DELETE para
--     authenticated, entao nem o admin apaga ou reescreve o que foi gravado.
--     A gravacao e feita por trigger SECURITY DEFINER (o usuario nao tem
--     permissao de INSERT na tabela).
--   - organization_id vem sempre da propria linha alterada (a unica excecao e
--     venda_itens, que herda a organizacao da venda dona da linha).
--   - UPDATE que nao muda nada de fato (so updated_at) nao gera linha.
--   - Texto acima de 300 caracteres e cortado; updated_at nao entra no diff.
--   - Tabelas de ruido ficam de fora: notifications (alto volume e dado de
--     interface), os_historico (ja e um log), sincronizacao_nfe_recebidas,
--     admin_audit_log, nfe_config_backup_20261111, support_tickets e
--     tenant_invoices (assunto da plataforma, nao da organizacao).
-- =====================================================================

create table public.audit_trail (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  tabela text not null,
  registro_id uuid,
  acao text not null check (acao in ('INSERT','UPDATE','DELETE')),
  campos text[] not null default '{}',
  antes jsonb,
  depois jsonb,
  usuario_id uuid,
  usuario_nome text,
  usuario_email text,
  created_at timestamp with time zone not null default now(),
  descricao text
);

create index audit_trail_org_data_idx on public.audit_trail (organization_id, created_at desc);
create index audit_trail_registro_idx on public.audit_trail (tabela, registro_id);
create index audit_trail_usuario_idx on public.audit_trail (usuario_id);
create index audit_trail_campos_idx on public.audit_trail using gin (campos);

grant select on public.audit_trail to authenticated;
grant select, insert, update, delete on public.audit_trail to service_role;

alter table public.audit_trail enable row level security;

create policy "Trilha: admin da organizacao le"
  on public.audit_trail for select to authenticated
  using (organization_id = public.get_user_org_id(auth.uid()) and public.has_role(auth.uid(), 'admin'));

create policy "Trilha: platform admin le"
  on public.audit_trail for select to authenticated
  using (public.is_platform_admin(auth.uid()));

-- Valor de um campo como ele vai para a trilha. Campo sensivel nunca guarda o
-- conteudo; documento sai mascarado (mostra o comeco e o fim, o suficiente para
-- reconhecer o registro sem expor o dado inteiro).
create or replace function public.audit_valor(_campo text, _valor jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when _valor is null or _valor = 'null'::jsonb then null
    when _campo ~* '(senha|password|token|secret|api_key|chave|credencial|certificate|certificado|authorization|asaas|xml|payload)' then to_jsonb('***'::text)
    when _campo ~* '(cpf|cnpj)' then to_jsonb(
      left(coalesce(_valor #>> '{}', ''), 3) || '***' || right(coalesce(_valor #>> '{}', ''), 2)
    )
    when jsonb_typeof(_valor) = 'string' and length(_valor #>> '{}') > 300 then to_jsonb(left(_valor #>> '{}', 300) || '...')
    else _valor
  end
$$;

-- Gatilho unico de auditoria, aplicado por tabela. SECURITY DEFINER porque quem
-- altera a linha nao tem (nem deve ter) permissao de escrever na trilha.
create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _org uuid;
  _rec uuid;
  _antes jsonb := '{}'::jsonb;
  _depois jsonb := '{}'::jsonb;
  _campos text[] := '{}';
  _chave text;
  _novo jsonb;
  _velho jsonb;
  _uid uuid := auth.uid();
  _nome text;
  _email text;
  _descricao text;
begin
  if TG_OP = 'DELETE' then
    _velho := to_jsonb(OLD);
  elsif TG_OP = 'INSERT' then
    _novo := to_jsonb(NEW);
  else
    _velho := to_jsonb(OLD);
    _novo := to_jsonb(NEW);
  end if;

  _org := coalesce((_novo->>'organization_id')::uuid, (_velho->>'organization_id')::uuid);
  _rec := coalesce((_novo->>'id')::uuid, (_velho->>'id')::uuid);

  -- venda_itens nao tem organization_id: herda da venda dona da linha.
  if _org is null and TG_TABLE_NAME = 'venda_itens' then
    select v.organization_id into _org from public.vendas v
     where v.id = coalesce((_novo->>'venda_id')::uuid, (_velho->>'venda_id')::uuid);
  end if;
  if _org is null then
    if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
  end if;

  if TG_OP = 'INSERT' then
    for _chave in select jsonb_object_keys(_novo) loop
      if _novo->_chave <> 'null'::jsonb then
        _campos := _campos || _chave;
        _depois := _depois || jsonb_build_object(_chave, public.audit_valor(_chave, _novo->_chave));
      end if;
    end loop;
  elsif TG_OP = 'DELETE' then
    for _chave in select jsonb_object_keys(_velho) loop
      _campos := _campos || _chave;
      _antes := _antes || jsonb_build_object(_chave, public.audit_valor(_chave, _velho->_chave));
    end loop;
  else
    for _chave in select jsonb_object_keys(_novo) loop
      continue when _chave = 'updated_at';
      if _velho->_chave is distinct from _novo->_chave then
        _campos := _campos || _chave;
        _antes := _antes || jsonb_build_object(_chave, public.audit_valor(_chave, _velho->_chave));
        _depois := _depois || jsonb_build_object(_chave, public.audit_valor(_chave, _novo->_chave));
      end if;
    end loop;
    -- UPDATE sem mudanca real (ex.: so o updated_at) nao vira linha na trilha.
    if coalesce(array_length(_campos, 1), 0) = 0 then
      return NEW;
    end if;
  end if;

  if _uid is not null then
    select p.nome, p.email into _nome, _email from public.profiles p where p.id = _uid;
  end if;

  _descricao := public.audit_descricao(TG_TABLE_NAME, TG_OP, _antes, _depois);

  insert into public.audit_trail
    (organization_id, tabela, registro_id, acao, campos, antes, depois, usuario_id, usuario_nome, usuario_email, descricao)
  values
    (_org, TG_TABLE_NAME, _rec, TG_OP, _campos,
     nullif(_antes, '{}'::jsonb), nullif(_depois, '{}'::jsonb),
     _uid, coalesce(_nome, 'Sistema'), _email, _descricao);

  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end $$;

-- Tabelas auditadas: todas as de negocio com id e organization_id, mais
-- venda_itens (linha de venda, que herda a organizacao da venda).
do $$
declare _t text;
begin
  foreach _t in array array[
    'checklist_equipamento_itens','checklist_tipos_equipamento','clientes','contas_pagar','cotacoes_compra',
    'devolucoes_compra','devolucoes_venda','empresa_config','empresa_gateway_credenciais','estoque_tecnico',
    'fechamentos_dia','financeiro','fiscal_company_config','fiscal_documents','fiscal_regras','fornecedores',
    'itens_estoque','itens_os','movimentacoes_estoque','nfe_config','nota_fiscal_emitida','notas_compra',
    'notas_compra_itens','notas_recebidas','orcamentos','ordens_servico','os_anexos','os_checklist_itens',
    'patrimonio_ferramentas','pedidos_compra','produtos','profiles','rotas','saidas_demonstracao','servicos',
    'solicitacoes_compra','tax_retention_ledger','technician_expenses','transferencias_estoque','transportadoras',
    'vendas','venda_itens'
  ] loop
    execute format('drop trigger if exists trg_audit on public.%I', _t);
    execute format(
      'create trigger trg_audit after insert or update or delete on public.%I for each row execute function public.audit_row()',
      _t
    );
  end loop;
end $$;

-- Gera a descricao legivel do que foi feito (ex.: "Venda cancelada").
create or replace function public.audit_descricao(_tabela text, _acao text, _antes jsonb, _depois jsonb)
returns text
language plpgsql
immutable
as $$
declare
  _rotulo text;
begin
  _rotulo := case _tabela
    when 'checklist_equipamento_itens' then 'Item de checklist de equipamento'
    when 'checklist_tipos_equipamento' then 'Tipo de equipamento de checklist'
    when 'clientes' then 'Cliente'
    when 'contas_pagar' then 'Conta a pagar'
    when 'cotacoes_compra' then 'Cotação de compra'
    when 'devolucoes_compra' then 'Devolução de compra'
    when 'devolucoes_venda' then 'Devolução de venda'
    when 'empresa_config' then 'Configuração da empresa'
    when 'empresa_gateway_credenciais' then 'Credencial de pagamento'
    when 'estoque_tecnico' then 'Estoque do técnico'
    when 'fechamentos_dia' then 'Fechamento do dia'
    when 'financeiro' then 'Lançamento financeiro'
    when 'fiscal_company_config' then 'Configuração fiscal'
    when 'fiscal_documents' then 'Documento fiscal'
    when 'fiscal_regras' then 'Regra fiscal'
    when 'fornecedores' then 'Fornecedor'
    when 'itens_estoque' then 'Item de estoque'
    when 'itens_os' then 'Item da OS'
    when 'movimentacoes_estoque' then 'Movimentação de estoque'
    when 'nfe_config' then 'Configuração de NF-e'
    when 'nota_fiscal_emitida' then 'Nota fiscal emitida'
    when 'notas_compra' then 'Nota de compra'
    when 'notas_compra_itens' then 'Item da nota de compra'
    when 'notas_recebidas' then 'Nota recebida'
    when 'orcamentos' then 'Orçamento'
    when 'ordens_servico' then 'OS'
    when 'os_anexos' then 'Anexo da OS'
    when 'os_checklist_itens' then 'Item de checklist da OS'
    when 'patrimonio_ferramentas' then 'Ferramenta/equipamento'
    when 'pedidos_compra' then 'Pedido de compra'
    when 'produtos' then 'Produto'
    when 'profiles' then 'Usuário'
    when 'rotas' then 'Rota'
    when 'saidas_demonstracao' then 'Item para demonstração'
    when 'servicos' then 'Serviço'
    when 'solicitacoes_compra' then 'Solicitação de compra'
    when 'tax_retention_ledger' then 'Retenção de imposto'
    when 'technician_expenses' then 'Despesa de técnico'
    when 'transferencias_estoque' then 'Transferência de estoque'
    when 'transportadoras' then 'Transportadora'
    when 'vendas' then 'Venda'
    when 'venda_itens' then 'Item da venda'
    else initcap(replace(_tabela, '_', ' '))
  end;

  if _acao = 'INSERT' then
    return _rotulo || ' criado';
  elsif _acao = 'DELETE' then
    return _rotulo || ' excluído';
  end if;

  -- UPDATE: verifica mudanças de status específicas
  if _tabela = 'vendas' then
    if _depois->>'status' = 'cancelada' and _antes->>'status' is distinct from 'cancelada' then
      return 'Venda cancelada';
    elsif _depois->>'status' = 'concluida' and _antes->>'status' is distinct from 'concluida' then
      return 'Venda concluída';
    elsif _depois->>'status' = 'pendente' and _antes->>'status' is distinct from 'pendente' then
      return 'Venda reaberta';
    end if;
  elsif _tabela = 'ordens_servico' then
    if _depois->>'status' = 'concluida' and _antes->>'status' is distinct from 'concluida' then
      return 'OS concluída';
    elsif _depois->>'status' = 'cancelada' and _antes->>'status' is distinct from 'cancelada' then
      return 'OS cancelada';
    elsif _depois->>'status' = 'aberta' and _antes->>'status' is distinct from 'aberta' then
      return 'OS reaberta';
    end if;
  elsif _tabela = 'financeiro' then
    if _depois->>'status' = 'pago' and _antes->>'status' is distinct from 'pago' then
      return 'Lançamento marcado como pago';
    elsif _depois->>'status' = 'pendente' and _antes->>'status' is distinct from 'pendente' then
      return 'Lançamento reaberto';
    end if;
  elsif _tabela = 'contas_pagar' then
    if _depois->>'status' = 'pago' and _antes->>'status' is distinct from 'pago' then
      return 'Conta a pagar marcada como paga';
    elsif _depois->>'status' = 'pendente' and _antes->>'status' is distinct from 'pendente' then
      return 'Conta a pagar reaberta';
    end if;
  elsif _tabela = 'orcamentos' then
    if _depois->>'status' = 'aprovado' and _antes->>'status' is distinct from 'aprovado' then
      return 'Orçamento aprovado';
    elsif _depois->>'status' = 'rejeitado' and _antes->>'status' is distinct from 'rejeitado' then
      return 'Orçamento rejeitado';
    end if;
  elsif _tabela = 'pedidos_compra' then
    if _depois->>'status' = 'aprovado' and _antes->>'status' is distinct from 'aprovado' then
      return 'Pedido de compra aprovado';
    elsif _depois->>'status' = 'cancelado' and _antes->>'status' is distinct from 'cancelado' then
      return 'Pedido de compra cancelado';
    end if;
  elsif _tabela = 'solicitacoes_compra' then
    if _depois->>'status' = 'aprovada' and _antes->>'status' is distinct from 'aprovada' then
      return 'Solicitação de compra aprovada';
    elsif _depois->>'status' = 'rejeitada' and _antes->>'status' is distinct from 'rejeitada' then
      return 'Solicitação de compra rejeitada';
    end if;
  elsif _tabela = 'devolucoes_venda' then
    if _depois->>'status' = 'concluida' and _antes->>'status' is distinct from 'concluida' then
      return 'Devolução de venda concluída';
    end if;
  elsif _tabela = 'devolucoes_compra' then
    if _depois->>'status' = 'concluida' and _antes->>'status' is distinct from 'concluida' then
      return 'Devolução de compra concluída';
    end if;
  end if;

  return _rotulo || ' alterado';
end;
$$;

-- Função para reverter uma alteração registrada na auditoria.
create or replace function public.reverter_alteracao(_audit_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _linha audit_trail%rowtype;
  _acao text;
  _tabela text;
  _registro_id uuid;
  _descricao text;
  _novo jsonb;
  _antes jsonb;
  _uid uuid := auth.uid();
  _nome text;
  _email text;
  _org uuid;
  _sql text;
  _colunas text;
  _valores text;
begin
  -- Verifica se o usuário é admin da organização ou admin platform
  if not (public.has_role(_uid, 'admin') or public.is_platform_admin(_uid)) then
    raise exception 'Acesso negado: apenas administradores podem reverter alterações';
  end if;

  select * into _linha from public.audit_trail where id = _audit_id;

  if _linha.id is null then
    raise exception 'Registro de auditoria não encontrado';
  end if;

  _tabela := _linha.tabela;
  _acao := _linha.acao;
  _registro_id := _linha.registro_id;
  _descricao := _linha.descricao;
  _org := _linha.organization_id;

  -- Busca dados atuais da tabela original
  execute format('select * from %I where id = %L', _tabela, _registro_id) into _novo;

  -- Atualiza o perfil do usuário
  if _uid is not null then
    select p.nome, p.email into _nome, _email from public.profiles p where p.id = _uid;
  end if;

  -- Executa a reversão baseada no tipo de ação
  if _acao = 'INSERT' then
    -- Remove o registro que foi criado (INSERT original)
    execute format('delete from %I where id = %L', _tabela, _registro_id);
    _descricao := 'Reversão de inclusão: ' || _descricao;
  elsif _acao = 'DELETE' then
    -- Re-insere o registro com os valores anteriores
    select array_to_string(array_agg(key), ', ') into _colunas
    from jsonb_each(_linha.antes);
    select array_to_string(array_agg(value::text), ', ') into _valores
    from jsonb_each(_linha.antes);
    _sql := format('insert into %I (%s) values (%s)',
      _tabela,
      _colunas,
      _valores
    );
    execute _sql;
    _descricao := 'Reversão de exclusão: ' || _descricao;
  else
    -- UPDATE: restaura os valores anteriores
    select array_to_string(array_agg(key || ' = ' || value::text), ', ') into _colunas
    from jsonb_each(_linha.antes);
    _sql := format('update %I set %s where id = %L',
      _tabela,
      _colunas,
      _registro_id
    );
    execute _sql;
    _descricao := 'Reversão de alteração: ' || _descricao;
  end if;

  -- Insere nova entrada de auditoria registrando a reversão
  insert into public.audit_trail
    (organization_id, tabela, registro_id, acao, campos, antes, depois, usuario_id, usuario_nome, usuario_email, descricao)
  values
    (_org, 'audit_trail', gen_random_uuid(), 'UPDATE', '{}'::text[],
     nullif(_novo, '{}'::jsonb), nullif(_linha.antes, '{}'::jsonb),
     _uid, coalesce(_nome, 'Sistema'), _email, _descricao);

  return _audit_id;
end;
$$;

grant execute on function public.reverter_alteracao(uuid) to authenticated;
grant execute on function public.audit_descricao(text, text, jsonb, jsonb) to authenticated;
grant execute on function public.audit_valor(text, jsonb) to authenticated;
grant execute on function public.audit_row() to authenticated;