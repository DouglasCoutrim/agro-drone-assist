
CREATE TABLE public.empresa_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_empresa text NOT NULL DEFAULT 'Ares Agrotec',
  cnpj text DEFAULT '',
  endereco text DEFAULT '',
  telefone text DEFAULT '61 9 91147599',
  responsavel text DEFAULT 'Douglas',
  logo_url text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.empresa_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view empresa_config"
  ON public.empresa_config FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage empresa_config"
  ON public.empresa_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default row
INSERT INTO public.empresa_config (nome_empresa, responsavel, telefone) VALUES ('Ares Agrotec', 'Douglas', '61 9 91147599');
