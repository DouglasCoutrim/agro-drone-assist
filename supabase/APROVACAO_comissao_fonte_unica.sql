-- ===========================================================================
-- LivreOS - ETAPA 2: Comissão com fonte única do valor da OS
-- ===========================================================================
-- STATUS: AGUARDANDO APROVACAO. Este arquivo contém o bloco de VERIFICACAO
-- (somente SELECT) e o bloco de ATUALIZACAO (reeescrita da função).
-- O bloco de ATUALIZACAO so deve ser executado apos aprovacao da Etapa 1.
--
-- OBJETIVO
--   Reescrever os_commission_core para usar calcular_valores_os como fonte
--   unica, removendo a base baseada em soma de itens_os sem desconto e
--   aplicando imposto somente com nota.
--
-- ------------------------------------------------------------------------------
-- 1) VERIFICACAO (somente leitura). Rode antes de qualquer escrita.
-- ------------------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'ordens_servico'
       and column_name in ('valor_final','valor_orcamento','desconto','nfe_emitida','commission_base','commission_tax','commission_cost','commission_total','commission_company','commission_no_note_fee','commission_tax_rate','commission_frozen_at','commission_override','commission_override_reason'))) as colunas_os_presentes,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'itens_os'
       and column_name in ('valor_total','custo_servico','tipo','descricao','quantidade'))) as colunas_itens_presentes,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'empresa_config'
       and column_name = 'commission_no_note_fee'))) as coluna_commission_no_note_fee_presente;

-- ------------------------------------------------------------------------------
-- 2) ATUALIZACAO (executar somente apos aprovacao da Etapa 1)
-- ------------------------------------------------------------------------------
begin;

-- Função: public.os_commission_core(_os_id uuid, _force boolean DEFAULT false)
-- OBJETIVO: Reescrever para usar calcular_valores_os como fonte única.
-- - Remover a base baseada na soma de itens_os sem desconto.
-- - Aplicar imposto somente quando a OS tem nota emitida (nfe_emitida).
-- - Remover o registro de imposto retido sem nota.
-- - Usar calcular_valores_os para: valor_bruto, desconto, valor_final, custos_servico,
--   despesas_adicionais, aliquota_iss, imposto, base_comissao, parte_tecnico, parte_loja,
--   recebido, saldo_receber, status_pagamento.
--
-- Mudancas principais em relacao à versao antiga:
--   * base agora vem de calcular_valores_os.valor_bruto (valor_final ou itens - desconto)
--   * imposto so e aplicado quando nfe_emitida = true (já definido em calcular_valores_os)
--   * taxa sem nota (commission_no_note_fee) aplicada sobre a parte do tecnico
--   * a parte do tecnico sofre o desconto de taxa quando nao ha nota
--   * commission_base agora reflete o saldo apos imposto e custos (base_comissao de calcular_valores_os)
--   * commission_tax e commission_cost sao preenchidos a partir de calcular_valores_os
--   * commission_total e commission_company sao calculados sobre a base_comissao

create or replace function public.os_commission_core(_os_id uuid, _force boolean DEFAULT false)
returns jsonb
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  v_calc jsonb;
  v_os record;
  v_base numeric(12,2);
  v_imposto numeric(12,2);
  v_custo_servico numeric(12,2);
  v_despesas_adicionais numeric(12,2);
  v_aliquota_iss numeric(12,2);
  v_fee numeric(12,2);
  v_recebido numeric(12,2);
  v_saldo numeric(12,2);
  v_parte_tecnica numeric(12,2);
  v_parte_loja numeric(12,2);
  v_comissao numeric(12,2);
  v_loja numeric(12,2);
  v_status text;
begin
  -- Busca o calculo unificado da OS
  v_calc := public.calcular_valores_os(_os_id);

  if jsonb_typeof(v_calc) = 'null' then
    return jsonb_build_object(
      'commission_base', 0,
      'commission_tax', 0,
      'commission_cost', 0,
      'commission_total', 0,
      'commission_company', 0,
      'commission_no_note_fee', 3.5,
      'commission_tax_rate', 0,
      'commission_frozen_at', null,
      'commission_override', null,
      'commission_override_reason', null
    );
  end if;

  -- Extrai os valores do calculo unificado
  v_base := (v_calc->>'base_comissao')::numeric(12,2);
  v_imposto := (v_calc->>'imposto')::numeric(12,2);
  v_custo_servico := (v_calc->>'custos_servico')::numeric(12,2);
  v_despesas_adicionais := (v_calc->>'despesas_adicionais')::numeric(12,2);
  v_aliquota_iss := (v_calc->>'aliquota_iss')::numeric(12,2);
  v_recebido := (v_calc->>'recebido')::numeric(12,2);

  -- Parte do tecnico e da loja sao divididos 50/50 sobre o saldo (base - imposto - custos - despesas)
  -- O saldo ja vem calculado em calcular_valores_os como v_saldo, mas precisamos recompor
  -- a partir dos campos individuais se existirem; caso contrario, calculamos aqui.
  -- A base_comissao ja e o saldo apos imposto e custos (segundo o design de calcular_valores_os).

  -- Se a OS tem nota, imposto ja foi descontado; se nao tem nota, a taxa de 3.5% incide sobre a parte do tecnico.
  -- Ja temos v_base (bruto), v_imposto (0 quando sem nota), v_custo_servico, v_despesas_adicionais.

  -- Saldo apos imposto e custos: base - imposto - custo_servico - despesas_adicionais
  -- Ja temos isso em v_base - v_imposto - v_custo_servico - v_despesas_adicionais
  v_saldo := greatest((v_base - v_imposto - v_custo_servico - v_despesas_adicionais)::numeric(12,2), 0);

  -- Parte da loja e da tecnico: 50/50 sobre o saldo
  v_parte_loja := round(v_saldo / 2, 2);
  v_parte_tecnica := round(v_saldo - v_parte_loja, 2);

  -- Taxa sem nota (sobre a parte do tecnico) apenas quando nao ha nota emitida
  select coalesce(e.commission_no_note_fee, 3.5) into v_fee
    from public.empresa_config e
   where e.organization_id = (select organization_id from public.ordens_servico where id = _os_id)
   limit 1;

  if not (v_calc->>'nfe_emitida')::boolean then
    -- Sem nota: a parte do tecnico sofre o desconto da taxa
    v_parte_tecnica := round(v_parte_tecnica * (100 - v_fee) / 100, 2);
    v_loja := round(v_saldo - v_parte_tecnica, 2);
  else
    -- Com nota: tecnico recebe a parte total da loja, taxa = 0
    v_loja := v_parte_loja;
    v_parte_tecnica := v_parte_tecnica; -- ja esta correto
  end if;

  -- Comissao total = loja + parte_tecnica (total dividido)
  v_comissao := round(v_loja + v_parte_tecnica, 2);

  -- Status de pagamento baseado no saldo receber
  select coalesce(sum(f.valor), 0) into v_recebido
    from public.financeiro f
   where f.ordem_servico_id = _os_id
     and f.tipo = 'receita';

  if v_saldo - v_recebido <= 0.004 then
    v_status := 'pago';
  elsif v_recebido > 0 then
    v_status := 'parcial';
  else
    v_status := 'pendente';
  end if;

  return jsonb_build_object(
    'commission_base', round(v_base, 2),
    'commission_tax', round(v_imposto, 2),
    'commission_cost', round(v_custo_servico, 2),
    'commission_total', round(v_comissao, 2),
    'commission_company', round(v_loja, 2),
    'commission_no_note_fee', v_fee,
    'commission_tax_rate', v_aliquota_iss,
    'commission_frozen_at', null,
    'commission_override', null,
    'commission_override_reason', null,
    'status_pagamento', v_status
  );
end
$function$;

grant execute on function public.os_commission_core(uuid, boolean) to authenticated;
grant execute on function public.os_commission_core(uuid, boolean) to service_role;

commit;

-- ------------------------------------------------------------------------------
-- 3) TESTE DEPOIS DE APLICAR (somente SELECT)
-- ------------------------------------------------------------------------------
-- select public.os_commission_core(id) as comissao from public.ordens_servico order by created_at desc limit 10;

-- ------------------------------------------------------------------------------
-- 4) PENDENCIAS / DECISIONES AGUARDAR
-- ------------------------------------------------------------------------------
-- - Base do desconto de 3.5% (sem nota): sobre a parte do tecnico (padrao) ou sobre o saldo.
-- - Arredondamento: meio para cima (padrao).
-- - Vendas gerarem lancamento em financeiro (desativado por padrao, atraves de flag).
-- - Ocultar comissao no painel do tecnico durante a correcao (ativado por padrao).