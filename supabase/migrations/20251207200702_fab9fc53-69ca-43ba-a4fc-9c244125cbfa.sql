-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'tecnico', 'consulta');

-- Create enum for equipment types
CREATE TYPE public.tipo_equipamento AS ENUM ('drone_agricola', 'drone_convencional', 'controle', 'bateria', 'outro');

-- Create enum for service order status
CREATE TYPE public.status_os AS ENUM ('aberta', 'em_andamento', 'aguardando_peca', 'concluida', 'entregue', 'cancelada');

-- Create enum for financial transaction types
CREATE TYPE public.tipo_transacao AS ENUM ('receita', 'despesa', 'salario', 'comissao');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome TEXT NOT NULL,
  telefone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'consulta',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create clientes table
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT NOT NULL,
  cpf_cnpj TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create itens_estoque table
CREATE TABLE public.itens_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  fornecedor TEXT,
  custo_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  preco_venda DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantidade INTEGER NOT NULL DEFAULT 0,
  estoque_minimo INTEGER NOT NULL DEFAULT 5,
  localizacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ordens_servico table
CREATE TABLE public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  tipo_equipamento tipo_equipamento NOT NULL,
  modelo_equipamento TEXT,
  numero_serie TEXT,
  descricao_problema TEXT NOT NULL,
  diagnostico TEXT,
  solucao TEXT,
  tecnico_id UUID REFERENCES auth.users(id),
  status status_os NOT NULL DEFAULT 'aberta',
  prioridade TEXT NOT NULL DEFAULT 'normal',
  valor_orcamento DECIMAL(10,2),
  valor_final DECIMAL(10,2),
  data_entrada TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_previsao TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  data_entrega TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create movimentacoes_estoque table
CREATE TABLE public.movimentacoes_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.itens_estoque(id) ON DELETE RESTRICT,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  quantidade INTEGER NOT NULL,
  motivo TEXT,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create financeiro table
CREATE TABLE public.financeiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo tipo_transacao NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES auth.users(id),
  data_transacao DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create os_anexos table for attachments
CREATE TABLE public.os_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  url TEXT NOT NULL,
  tipo TEXT,
  tamanho INTEGER,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create os_historico table for audit trail
CREATE TABLE public.os_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  acao TEXT NOT NULL,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_historico ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Create function to check if user is admin or tecnico
CREATE OR REPLACE FUNCTION public.is_admin_or_tecnico(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'tecnico')
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for clientes
CREATE POLICY "Authenticated users can view clientes"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and tecnico can insert clientes"
  ON public.clientes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_tecnico(auth.uid()));

CREATE POLICY "Admin and tecnico can update clientes"
  ON public.clientes FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_tecnico(auth.uid()));

CREATE POLICY "Admin can delete clientes"
  ON public.clientes FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for itens_estoque
CREATE POLICY "Authenticated users can view estoque"
  ON public.itens_estoque FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and tecnico can manage estoque"
  ON public.itens_estoque FOR ALL
  TO authenticated
  USING (public.is_admin_or_tecnico(auth.uid()));

-- RLS Policies for ordens_servico
CREATE POLICY "Authenticated users can view OS"
  ON public.ordens_servico FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and tecnico can insert OS"
  ON public.ordens_servico FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_tecnico(auth.uid()));

CREATE POLICY "Admin and tecnico can update OS"
  ON public.ordens_servico FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_tecnico(auth.uid()));

CREATE POLICY "Admin can delete OS"
  ON public.ordens_servico FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for movimentacoes_estoque
CREATE POLICY "Authenticated users can view movimentacoes"
  ON public.movimentacoes_estoque FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and tecnico can insert movimentacoes"
  ON public.movimentacoes_estoque FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_tecnico(auth.uid()));

-- RLS Policies for financeiro
CREATE POLICY "Admin can manage financeiro"
  ON public.financeiro FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Tecnico can view financeiro"
  ON public.financeiro FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'tecnico'));

-- RLS Policies for os_anexos
CREATE POLICY "Authenticated users can view anexos"
  ON public.os_anexos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and tecnico can manage anexos"
  ON public.os_anexos FOR ALL
  TO authenticated
  USING (public.is_admin_or_tecnico(auth.uid()));

-- RLS Policies for os_historico
CREATE POLICY "Authenticated users can view historico"
  ON public.os_historico FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and tecnico can insert historico"
  ON public.os_historico FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_tecnico(auth.uid()));

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email)
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'consulta');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_itens_estoque_updated_at
  BEFORE UPDATE ON public.itens_estoque
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ordens_servico_updated_at
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to generate OS number
CREATE OR REPLACE FUNCTION public.generate_os_number()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- Create trigger for OS number generation
CREATE TRIGGER generate_os_number_trigger
  BEFORE INSERT ON public.ordens_servico
  FOR EACH ROW
  WHEN (NEW.numero IS NULL OR NEW.numero = '')
  EXECUTE FUNCTION public.generate_os_number();

-- Create storage bucket for OS attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('os-anexos', 'os-anexos', false);

-- Storage policies for os-anexos bucket
CREATE POLICY "Authenticated users can view os-anexos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'os-anexos');

CREATE POLICY "Admin and tecnico can upload os-anexos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'os-anexos' AND public.is_admin_or_tecnico(auth.uid()));

CREATE POLICY "Admin and tecnico can update os-anexos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'os-anexos' AND public.is_admin_or_tecnico(auth.uid()));

CREATE POLICY "Admin can delete os-anexos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'os-anexos' AND public.has_role(auth.uid(), 'admin'));