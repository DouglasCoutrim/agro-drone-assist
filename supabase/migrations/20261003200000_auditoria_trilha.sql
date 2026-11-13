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
  created_at timestamp with time zone not null default now()
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

  insert into public.audit_trail
    (organization_id, tabela, registro_id, acao, campos, antes, depois, usuario_id, usuario_nome, usuario_email)
  values
    (_org, TG_TABLE_NAME, _rec, TG_OP, _campos,
     nullif(_antes, '{}'::jsonb), nullif(_depois, '{}'::jsonb),
     _uid, coalesce(_nome, 'Sistema'), _email);

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
      _t);
  end loop;
end $$;
