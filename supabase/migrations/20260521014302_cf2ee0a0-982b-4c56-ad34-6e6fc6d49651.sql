
CREATE TABLE public.wiki_tour_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  article_id UUID NOT NULL REFERENCES public.wiki_articles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','skipped')),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, article_id)
);

ALTER TABLE public.wiki_tour_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tour progress"
  ON public.wiki_tour_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own tour progress"
  ON public.wiki_tour_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own tour progress"
  ON public.wiki_tour_progress FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own tour progress"
  ON public.wiki_tour_progress FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_wiki_tour_progress_updated
  BEFORE UPDATE ON public.wiki_tour_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_wiki_tour_progress_user ON public.wiki_tour_progress(user_id);
