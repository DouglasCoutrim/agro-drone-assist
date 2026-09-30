-- Fix search_path for update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix search_path for generate_os_number function
CREATE OR REPLACE FUNCTION public.generate_os_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  year_prefix TEXT;
  next_number INTEGER;
BEGIN
  year_prefix := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM 6) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.ordens_servico
  WHERE numero LIKE year_prefix || '-%';
  
  NEW.numero := year_prefix || '-' || LPAD(next_number::TEXT, 5, '0');
  RETURN NEW;
END;
$$;