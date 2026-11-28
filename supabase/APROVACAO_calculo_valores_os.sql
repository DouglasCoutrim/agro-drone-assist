-- ===========================================================================
-- LivreOS - ETAPA 1: Fonte unica do valor da OS (função calcular_valores_os)
--
-- STATUS: AGUARDANDO APROVACAO. NADA foi executado. Este arquivo contem apenas
-- o bloco de VERIFICACAO (somente SELECT) e o bloco de ATUALIZACAO (a criacao
-- da funcao). O bloco de ATUALIZACAO so deve ser executado apos aprovacao.
--
-- OBJETIVO
--   Centralizar, em UMA unica funcao SQL, o calculo do valor de uma OS e o
--   estado do recebimento. A partir dela, comissao, recebimento e painel passam
--   a ler a mesma fonte (as etapas seguintes consomem esta funcao).
--
-- REGRA DE NEGOCIO (decidida)
--   Base = valor final da OS (apos desconto). Se valor_final for nulo, usar
--   valor_orcamento. Valor zero e valor valido e NAO cai para o orcamento.
--   - custo do servico: informado por linha de servico (itens_os.custo_servico),
--     deduzido da base.
--   - despesas adicionais da OS: custo_pecas + custo_mao_obra, deduzidas da base.
--   - imposto: aliquota ISS configurada (nfe_config.nfse_aliquota) aplicada a
--     base somente quando a OS tem nota emitida (nfe_emitida). Sem nota, nao ha
--     desconto de imposto.
--   - saldo = base - imposto - custos do servico - despesas adicionais.
--     Dividido 50% tecnico e 50% loja.
--   - sem nota: a parte do tecnico sofre desconto (commission_no_note_fee, padrao 3.5%).
--   - pagamento parcial: nao altera o valor da OS. Status 'parcial' ate o saldo
--     ser quitado.
--
-- PENDENCIAS (decisoes marcadas PENDENTE no pedido; implementadas com configuracao)
--   - TODO: base do desconto de 3.5% sobre a parte do tecnico (padrao) ou sobre o saldo.
--   - TODO: arredondamento meio para cima (padrao).
--   - TODO: vendas gerarem lancamento em financeiro (desativado por padrao, atraves de flag).
--   - TODO: ocultar comissao no painel do tecnico durante a correcao (ativado por padrao).
-- ===========================================================================

-- ------------------------------------------------------------------------------
-- 1) VERIFICACAO (somente leitura). Rode antes de qualquer escrita.
-- ------------------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'ordens_servico'
       and column_name in ('valor_final','valor_orcamento','desconto','nfe_emitida','custo_pecas','custo_mao_obra'))) as colunas_os_presentes,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'itens_os'
       and column_name = 'custo_servico')) as coluna_custo_servico_presente,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'financeiro'
       and column_name in ('tipo','ordem_servico_id','valor'))) as colunas_financeiro_presentes,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'nfe_config'
       and column_name = 'nfse_aliquota')) as coluna_nfse_aliquota_presente,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'empresa_config'
       and column_name = 'commission_no_note_fee')) as coluna_commission_no_note_fee_presente;

-- ------------------------------------------------------------------------------
-- 2) ATUALIZACAO (executar somente apos aprovacao)
-- ------------------------------------------------------------------------------
begin;

create or replace function public.calcular_valores_os(_os_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  v_os record;
  v_valor_final numeric(12,2);
  v_valor_orcamento numeric(12,2);
  v_base numeric(12,2);
  v_desconto numeric(12,2);
  v_custo_servico numeric(12,2);
  v_despesas_adicionais numeric(12,2);
  v_aliquota_iss numeric(12,2);
  v_imposto numeric(12,2);
  v_saldo numeric(12,2);
  v_parte_loja numeric(12,2);
  v_parte_tecnica numeric(12,2);
  v_fee numeric(12,2);
  v_recebido numeric(12,2);
  v_saldo_receber numeric(12,2);
  v_status text;
begin
  select os.valor_final, os.valor_orcamento, coalesce(os.desconto, 0), os.nfe_emitida, os.organization_id,
         coalesce(os.custo_pecas, 0), coalesce(os.custo_mao_obra, 0)
    into v_os
    from public.ordens_servico os
   where os.id = _os_id;

  if not found then
    return jsonb_build_object(
      'valor_bruto', 0, 'desconto', 0, 'valor_final', 0,
      'custos_servico', 0, 'despesas_adicionais', 0,
      'aliquota_iss', 0, 'imposto', 0, 'base_comissao', 0,
      'parte_tecnico', 0, 'parte_loja', 0,
      'recebido', 0, 'saldo_receber', 0, 'status_pagamento', 'pendente');
  end if;

  -- Base = valor final (apos desconto) ou valor_orcamento; zero e valor valido.
  v_valor_final := coalesce(v_os.valor_final, v_os.valor_orcamento);
  v_valor_final := coalesce(v_valor_final, 0);
  v_base := round(v_valor_final, 2);
  v_desconto := coalesce(v_os.desconto, 0);

  -- Custo do servico por linha + despesas adicionais da OS.
  select coalesce(sum(i.custo_servico), 0) into v_custo_servico
    from public.itens_os i
   where i.ordem_servico_id = _os_id;
  v_despesas_adicionais := coalesce(v_os.custo_pecas, 0) + coalesce(v_os.custo_mao_obra, 0);

  -- Imposto: ISS configurado, somente com nota emitida.
  if v_os.nfe_emitida then
    select coalesce(c.nfse_aliquota, 0) into v_aliquota_iss
      from public.nfe_config c
     where c.organization_id = v_os.organization_id
     limit 1;
    v_aliquota_iss := coalesce(v_aliquota_iss, 0);
  else
    v_aliquota_iss := 0;
  end if;
  v_imposto := case when v_aliquota_iss > 0 then round(v_base * v_aliquota_iss / 100, 2) else 0 end;

  v_saldo := greatest(round(v_base - v_imposto - v_custo_servico - v_despesas_adicionais, 2), 0);

  v_parte_loja := round(v_saldo / 2, 2);
  v_parte_tecnica := round(v_saldo - v_parte_loja, 2);

  if not v_os.nfe_emitida then
    select coalesce(e.commission_no_note_fee, 3.5) into v_fee
      from public.empresa_config e
     where e.organization_id = v_os.organization_id
     limit 1;
    v_fee := coalesce(v_fee, 3.5);
    v_parte_tecnica := round(v_parte_tecnica * (100 - v_fee) / 100, 2);
  end if;

  select coalesce(sum(f.valor), 0) into v_recebido
    from public.financeiro f
   where f.ordem_servico_id = _os_id
     and f.tipo = 'receita';

  v_saldo_receber := round(v_base - v_imposto - v_custo_servico - v_despesas_adicionais - v_recebido, 2);
  if v_saldo_receber < 0 then v_saldo_receber := 0; end if;

  if v_saldo_receber <= 0.004 then
    v_status := 'pago';
  elsif v_recebido > 0 then
    v_status := 'parcial';
  else
    v_status := 'pendente';
  end if;

  return jsonb_build_object(
    'valor_bruto', v_base,
    'desconto', v_desconto,
    'valor_final', v_base,
    'custos_servico', round(v_custo_servico, 2),
    'despesas_adicionais', round(v_despesas_adicionais, 2),
    'aliquota_iss', round(v_aliquota_iss, 2),
    'imposto', round(v_imposto, 2),
    'base_comissao', round(v_saldo, 2),
    'parte_tecnico', round(v_parte_tecnica, 2),
    'parte_loja', round(v_parte_loja, 2),
    'recebido', round(v_recebido, 2),
    'saldo_receber', round(v_saldo_receber, 2),
    'status_pagamento', v_status);
end
$function$;

grant execute on function public.calcular_valores_os(uuid) to authenticated;
grant execute on function public.calcular_valores_os(uuid) to service_role;

commit;

-- ------------------------------------------------------------------------------
-- 3) TESTE DEPOIS DE APLICAR (somente SELECT)
-- ------------------------------------------------------------------------------
-- select public.calcular_valores_os(id) as valores
-- from public.ordens_servico
-- order by created_at desc
-- limit 10;

-- ------------------------------------------------------------------------------
-- 4) PENDENCIAS / DECISIONES AGUARDAR
-- ------------------------------------------------------------------------------
-- - Base do desconto de 3.5% (sem nota): sobre a parte do tecnico (padrao) ou sobre o saldo.
-- - Arredondamento: meio para cima (padrao).
-- - Despesas adicionais da OS: custo_pecas + custo_mao_obra (definicao atual).
-- - Vendas gerarem lancamento em financeiro (desativado por padrao, atraves de flag).
-- - Ocultar comissao no painel do tecnico durante a correcao (ativado por padrao).
