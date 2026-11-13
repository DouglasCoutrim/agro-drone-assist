-- =====================================================================
-- P0 ESTOQUE E VENDA: teto de desconto zero significa "sem teto configurado"
-- Arquivo: supabase/migrations/20261003150000_p0_desconto_zero_sem_teto.sql
-- Estado: APLICADA no projeto Supabase.
--
-- Problema corrigido (regra divergente entre dois caminhos do sistema):
-- enforce_itens_os_price fazia LEAST(desconto, bruto * cap / 100). Com cap = 0
-- -- que e o valor padrao de todo item e o unico valor em uso no sistema -- o
-- desconto virava zero, em silencio, mesmo quando a tela permitia informar um
-- percentual (src/lib/desconto.ts, tetoDesconto: 0 => liberado ate 100).
-- Resultado: o mesmo item aceitava desconto de ate 100 na venda e 0 na OS,
-- e o usuario digitava 10% na OS e gravava 0.
--
-- Decisao (uma so, valendo nos dois caminhos):
--   0 (nao configurado) => vai ate o teto absoluto de 100, igual a
--                           src/lib/desconto.ts.
--   > 0 (configurado)   => limita naquele percentual.
-- Nao existe hoje nenhum item ou servico com teto maior que zero, entao esta
-- mudanca nao afrouxa nenhum limite realmente configurado: ela para de zerar
-- o desconto que a propria interface oferece.
--
-- Nao foi alterado o desvio para administradores (auth.uid() nulo ou papel
-- admin retorna NEW sem passar pelas travas) nem o snapshot de
-- NEW.desconto_maximo_percentual: fora do escopo desta correcao.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.enforce_itens_os_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _max numeric; _cap numeric; _teto numeric; _bruto numeric; _desc numeric;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.servico_id IS NOT NULL THEN
    SELECT GREATEST(COALESCE(preco,0), COALESCE(valor_fixo,0), COALESCE(valor_hora,0)), COALESCE(desconto_maximo_percentual,0)
      INTO _max, _cap FROM servicos WHERE id = NEW.servico_id AND organization_id = NEW.organization_id;
  ELSIF NEW.item_estoque_id IS NOT NULL THEN
    SELECT COALESCE(preco_venda,0), COALESCE(desconto_maximo_percentual,0)
      INTO _max, _cap FROM itens_estoque WHERE id = NEW.item_estoque_id AND organization_id = NEW.organization_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- itens livres/legados: tecnico nao pode alterar valores
    NEW.valor_unitario := OLD.valor_unitario; NEW.quantidade := OLD.quantidade;
    NEW.desconto_valor := OLD.desconto_valor; NEW.desconto_percentual := OLD.desconto_percentual;
    NEW.valor_total := OLD.valor_total;
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Selecione o item no catálogo (estoque ou serviços).';
  END IF;
  IF _max IS NULL THEN RAISE EXCEPTION 'Item do catálogo não encontrado nesta organização.'; END IF;
  IF _max > 0 THEN NEW.valor_unitario := LEAST(COALESCE(NEW.valor_unitario,0), _max); END IF;
  NEW.valor_unitario := GREATEST(COALESCE(NEW.valor_unitario,0), 0);
  NEW.quantidade := GREATEST(COALESCE(NEW.quantidade,0), 0);
  _bruto := NEW.valor_unitario * NEW.quantidade;
  -- Teto efetivo: 0 significa "sem teto configurado" (vai ate o teto absoluto).
  _teto := CASE WHEN COALESCE(_cap, 0) <= 0 THEN 100 ELSE LEAST(_cap, 100) END;
  _desc := LEAST(GREATEST(COALESCE(NEW.desconto_valor,0),0), round(_bruto * _teto / 100, 2));
  NEW.desconto_valor := _desc;
  NEW.desconto_maximo_percentual := _cap;
  NEW.valor_total := _bruto - _desc;
  RETURN NEW;
END $$;
