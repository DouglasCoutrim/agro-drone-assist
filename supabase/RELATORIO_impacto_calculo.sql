-- ===========================================================================
-- LivreOS - ETAPA 6: Relatório de impacto do cálculo (SELECT apenas)
-- ===========================================================================
-- STATUS: AGUARDANDO APROVACAO. Este arquivo contém apenas consultas SELECT
-- para listar OS com possíveis inconsistências no cálculo. NÃO faz alterações.
--
-- OBJETIVO
--   Listar OS com possíveis problemas de cálculo para revisão do gestor.
--
-- ------------------------------------------------------------------------------
-- 1) VERIFICACAO (somente leitura). Rode antes de qualquer escrita.
-- ------------------------------------------------------------------------------
-- OS cujo valor de comissão gravado difere do recalculado
select
  o.id,
  o.numero,
  o.valor_final,
  o.valor_orcamento,
  o.desconto,
  os_commission_calc.commission_total as comissao_gravada,
  public.calcular_valores_os(o.id)->>'comissao' as comissao_calculada,
  (os_commission_calc.commission_total::numeric - (public.calcular_valores_os(o.id)->>'comissao')::numeric) as diferenca
from public.ordens_servico o
cross join lateral public.os_commission_calc(o.id) as os_commission_calc
where
  (os_commission_calc.commission_total::numeric - (public.calcular_valores_os(o.id)->>'comissao')::numeric) != 0
  and o.status not in ('cancelada')
order by o.id;

-- OS com recebimento maior que o saldo
select
  o.id,
  o.numero,
  o.valor_final,
  o.valor_orcamento,
  coalesce(sum(f.valor), 0) as total_recebido,
  public.calcular_valores_os(o.id)->>'valor_final' as valor_calc,
  case when coalesce(sum(f.valor), 0) > (public.calcular_valores_os(o.id)->>'valor_final')::numeric then 'SIM' else 'NAO' end as recebimento_maior_que_saldo
from public.ordens_servico o
left join public.financeiro f on f.ordem_servico_id = o.id and f.tipo = 'receita'
group by o.id, o.numero, o.valor_final, o.valor_orcamento
having coalesce(sum(f.valor), 0) > (public.calcular_valores_os(o.id)->>'valor_final')::numeric
   or coalesce(sum(f.valor), 0) > (coalesce(o.valor_orcamento, 0)::numeric)
order by o.id;

-- OS com possível recebimento duplicado (mesmo valor, mesma OS, mesmo dia)
select
  f1.ordem_servico_id as os_id,
  o.numero,
  f1.data_transacao as data_lancamento,
  f1.valor as valor1,
  f2.valor as valor2,
  f1.id as lancamento1_id,
  f2.id as lancamento2_id
from public.financeiro f1
join public.financeiro f2 on f1.ordem_servico_id = f2.ordem_servico_id
  and f1.id < f2.id
  and f1.data_transacao = f2.data_transacao
  and f1.valor = f2.valor
  and f1.tipo = 'receita'
join public.ordens_servico o on o.id = f1.ordem_servico_id
order by o.numero, f1.data_transacao;

-- OS com valor_final alterado por recebimento
select
  o.id,
  o.numero,
  o.valor_final,
  case when o.valor_final != coalesce(o.valor_orcamento, 0) then 'ALTERADO' else 'ORIGINAL' end as status_valor_final
from public.ordens_servico o
where o.valor_final is not null
  and o.valor_final != coalesce(o.valor_orcamento, 0)
  and o.status not in ('cancelada')
order by o.id;