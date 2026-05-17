
-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, read_at, created_at DESC);
CREATE INDEX idx_notifications_org ON public.notifications (organization_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Platform admins manage notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid, _org_id uuid, _type text, _title text, _body text, _link text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications(user_id, organization_id, type, title, body, link)
  VALUES (_user_id, _org_id, _type, _title, _body, _link);
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_org_role(
  _org_id uuid, _role app_role, _type text, _title text, _body text, _link text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications(user_id, organization_id, type, title, body, link)
  SELECT p.id, _org_id, _type, _title, _body, _link
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = _role
  WHERE p.organization_id = _org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_org_all(
  _org_id uuid, _type text, _title text, _body text, _link text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications(user_id, organization_id, type, title, body, link)
  SELECT p.id, _org_id, _type, _title, _body, _link
  FROM public.profiles p
  WHERE p.organization_id = _org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_broadcast_global(
  _type text, _title text, _body text, _link text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only platform admins can broadcast globally';
  END IF;
  INSERT INTO public.notifications(user_id, organization_id, type, title, body, link)
  SELECT p.id, p.organization_id, _type, _title, _body, _link
  FROM public.profiles p
  WHERE p.organization_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_broadcast_org(
  _org_id uuid, _type text, _title text, _body text, _link text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only platform admins can broadcast';
  END IF;
  PERFORM public.notify_org_all(_org_id, _type, _title, _body, _link);
END;
$$;

-- =====================================================
-- TRIGGERS: OS
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_notify_os_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_title text;
  v_body text;
  v_link text;
BEGIN
  v_link := '/ordens-servico?os=' || NEW.id::text;

  IF TG_OP = 'INSERT' THEN
    IF NEW.tecnico_id IS NOT NULL THEN
      PERFORM public.notify_user(
        NEW.tecnico_id, NEW.organization_id, 'os',
        'Nova OS atribuída: ' || NEW.numero,
        'Você foi designado para a OS ' || NEW.numero,
        v_link
      );
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_title := 'OS ' || NEW.numero || ': ' || NEW.status::text;
    v_body  := 'Status alterado de ' || OLD.status::text || ' para ' || NEW.status::text;
    IF NEW.tecnico_id IS NOT NULL THEN
      PERFORM public.notify_user(NEW.tecnico_id, NEW.organization_id, 'os', v_title, v_body, v_link);
    END IF;
    PERFORM public.notify_org_role(NEW.organization_id, 'admin'::app_role, 'os', v_title, v_body, v_link);
  END IF;

  IF NEW.tecnico_id IS DISTINCT FROM OLD.tecnico_id AND NEW.tecnico_id IS NOT NULL THEN
    PERFORM public.notify_user(
      NEW.tecnico_id, NEW.organization_id, 'os',
      'OS atribuída a você: ' || NEW.numero,
      'Você foi designado para a OS ' || NEW.numero,
      v_link
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_os_changes
AFTER INSERT OR UPDATE ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_os_changes();

-- =====================================================
-- TRIGGERS: Estoque baixo
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_notify_estoque_baixo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.quantidade <= NEW.estoque_minimo
     AND (TG_OP = 'INSERT' OR OLD.quantidade > OLD.estoque_minimo) THEN
    PERFORM public.notify_org_role(
      NEW.organization_id, 'admin'::app_role, 'estoque',
      'Estoque baixo: ' || NEW.descricao,
      'Item ' || NEW.codigo || ' está com ' || NEW.quantidade || ' un. (mínimo ' || NEW.estoque_minimo || ').',
      '/estoque?item=' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_estoque_baixo
AFTER INSERT OR UPDATE OF quantidade, estoque_minimo ON public.itens_estoque
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_estoque_baixo();

-- =====================================================
-- TRIGGERS: Suporte (resposta do admin)
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_notify_support_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
BEGIN
  IF NEW.is_admin_reply = false THEN RETURN NEW; END IF;
  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = NEW.ticket_id;
  IF v_ticket.user_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.notify_user(
    v_ticket.user_id, v_ticket.organization_id, 'suporte',
    'Resposta no ticket: ' || v_ticket.subject,
    LEFT(NEW.message, 140),
    '/suporte?ticket=' || v_ticket.id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_support_reply
AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_support_reply();

-- =====================================================
-- TRIGGERS: tenant_invoices
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_notify_tenant_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_org_role(
      NEW.organization_id, 'admin'::app_role, 'financeiro',
      'Nova mensalidade emitida',
      'Valor R$ ' || NEW.valor || ' com vencimento em ' || to_char(NEW.vencimento, 'DD/MM/YYYY') || '.',
      '/configuracoes?tab=plano'
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'pago' THEN
      PERFORM public.notify_org_role(
        NEW.organization_id, 'admin'::app_role, 'financeiro',
        'Pagamento confirmado',
        'Mensalidade de R$ ' || NEW.valor || ' foi paga. Obrigado!',
        '/configuracoes?tab=plano'
      );
    ELSIF NEW.status = 'vencido' THEN
      PERFORM public.notify_org_role(
        NEW.organization_id, 'admin'::app_role, 'financeiro',
        'Mensalidade vencida',
        'A mensalidade venceu. Regularize para evitar bloqueio.',
        '/configuracoes?tab=plano'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_tenant_invoice
AFTER INSERT OR UPDATE ON public.tenant_invoices
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_tenant_invoice();

-- =====================================================
-- WIKI
-- =====================================================
CREATE TABLE public.wiki_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text DEFAULT 'BookOpen',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.wiki_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.wiki_categories(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  content text NOT NULL DEFAULT '',
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  tour_target_route text,
  tour_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  published boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wiki_articles_category ON public.wiki_articles(category_id);
CREATE INDEX idx_wiki_articles_published ON public.wiki_articles(published);

ALTER TABLE public.wiki_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read wiki categories"
  ON public.wiki_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Platform admins manage wiki categories"
  ON public.wiki_categories FOR ALL TO authenticated
  USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Authenticated read published wiki articles"
  ON public.wiki_articles FOR SELECT TO authenticated
  USING (published = true OR is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins manage wiki articles"
  ON public.wiki_articles FOR ALL TO authenticated
  USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

CREATE TRIGGER set_wiki_articles_updated_at
BEFORE UPDATE ON public.wiki_articles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for wiki media
INSERT INTO storage.buckets (id, name, public) VALUES ('wiki-media', 'wiki-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read wiki-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wiki-media');

CREATE POLICY "Platform admins upload wiki-media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wiki-media' AND is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins update wiki-media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'wiki-media' AND is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins delete wiki-media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'wiki-media' AND is_platform_admin(auth.uid()));
