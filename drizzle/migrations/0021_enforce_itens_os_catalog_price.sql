CREATE OR REPLACE FUNCTION public.enforce_itens_os_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _max numeric; _cap numeric; _bruto numeric; _desc numeric;
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
    -- itens livres/legados: técnico não pode alterar valores
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
  _desc := LEAST(GREATEST(COALESCE(NEW.desconto_valor,0),0), _bruto * _cap / 100);
  NEW.desconto_valor := _desc;
  NEW.desconto_maximo_percentual := _cap;
  NEW.valor_total := _bruto - _desc;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_itens_os_price() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS trg_enforce_itens_os_price ON public.itens_os;
CREATE TRIGGER trg_enforce_itens_os_price BEFORE INSERT OR UPDATE ON public.itens_os
FOR EACH ROW EXECUTE FUNCTION public.enforce_itens_os_price();