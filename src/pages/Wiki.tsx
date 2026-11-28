import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronRight, Clock3, Filter,
  GraduationCap, ListChecks, Play, RotateCcw, Search, Sparkles, X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { queueHelpTour } from "@/components/help/HelpTourRunner";
import type { Step } from "react-joyride";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  sort_order: number;
};

type Article = {
  id: string;
  category_id: string | null;
  slug: string;
  title: string;
  summary: string | null;
  content: string;
  media: unknown[];
  tour_target_route: string | null;
  tour_steps: Step[];
  tags: string[];
  published: boolean;
  sort_order: number;
};

type ProgressMap = Record<string, "completed" | "skipped">;

function estimateMinutes(content: string) {
  return Math.max(2, Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 180));
}

function matchesArticle(article: Article, rawQuery: string) {
  const query = rawQuery.trim().toLocaleLowerCase("pt-BR");
  if (!query) return true;
  const haystack = [article.title, article.summary, article.content, ...(article.tags || [])]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pt-BR");
  return haystack.includes(query);
}

export default function Wiki() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [cats, setCats] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [trainingOnly, setTrainingOnly] = useState(false);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(false);
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      setUserId(user?.id || null);
      const [categoriesResult, articlesResult, progressResult] = await Promise.all([
        supabase.from("wiki_categories").select("*").order("sort_order"),
        supabase.from("wiki_articles").select("*").eq("published", true).order("sort_order"),
        user
          ? supabase.from("wiki_tour_progress").select("article_id,status").eq("user_id", user.id)
          : Promise.resolve({ data: [] as { article_id: string; status: "completed" | "skipped" }[] }),
      ]);
      if (cancelled) return;
      if (categoriesResult.error || articlesResult.error) {
        setError(true);
        toast.error("Não foi possível carregar a Central de Ajuda.");
      }
      setCats((categoriesResult.data || []) as Category[]);
      setArticles((articlesResult.data || []) as unknown as Article[]);
      const nextProgress: ProgressMap = {};
      (progressResult.data || []).forEach((item: { article_id: string; status: "completed" | "skipped" }) => {
        nextProgress[item.article_id] = item.status;
      });
      setProgress(nextProgress);
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const article = useMemo(() => articles.find((item) => item.slug === slug), [articles, slug]);
  const categoryById = useMemo(() => new Map(cats.map((category) => [category.id, category])), [cats]);
  const trainingArticles = useMemo(() => articles.filter((item) => item.tour_steps?.length > 0), [articles]);
  const completedTraining = trainingArticles.filter((item) => progress[item.id] === "completed").length;
  const trainingPercent = trainingArticles.length ? Math.round((completedTraining / trainingArticles.length) * 100) : 0;
  const filtered = useMemo(() => articles.filter((item) => {
    if (activeCat && item.category_id !== activeCat) return false;
    if (trainingOnly && !item.tour_steps?.length) return false;
    return matchesArticle(item, query);
  }), [articles, activeCat, query, trainingOnly]);

  const startTour = (item: Article) => {
    if (!item.tour_steps?.length) return;
    queueHelpTour({ articleId: item.id, steps: item.tour_steps, targetRoute: item.tour_target_route });
    if (item.tour_target_route && window.location.pathname !== item.tour_target_route) {
      navigate(item.tour_target_route);
    }
  };

  const resetProgress = async (articleId: string) => {
    if (!userId) return;
    const { error: deleteError } = await supabase.from("wiki_tour_progress").delete()
      .eq("user_id", userId).eq("article_id", articleId);
    if (deleteError) {
      toast.error("Não foi possível reiniciar o treinamento.");
      return;
    }
    setProgress((current) => {
      const next = { ...current };
      delete next[articleId];
      return next;
    });
    toast.success("Progresso reiniciado.");
  };

  if (article) {
    const status = progress[article.id];
    const categoryName = categoryById.get(article.category_id || "")?.name || "Geral";
    return (
      <MainLayout>
        <div className="mx-auto max-w-4xl space-y-5">
          <Button variant="ghost" size="sm" onClick={() => navigate("/wiki")}>
            <ArrowLeft className="mr-1 h-4 w-4" />Voltar para a Central de Ajuda
          </Button>
          <Card className="overflow-hidden">
            <div className="border-b border-border bg-muted/30 p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{categoryName}</Badge>
                <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{estimateMinutes(article.content)} min de leitura</span>
                {article.tour_steps?.length > 0 && <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />Treinamento guiado</span>}
              </div>
              <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">{article.title}</h1>
              {article.summary && <p className="mt-2 max-w-3xl text-muted-foreground">{article.summary}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {(article.tags || []).map((tag) => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}
                {article.tour_steps?.length > 0 && (
                  <>
                    <Button size="sm" onClick={() => startTour(article)}>
                      <Play className="mr-1.5 h-3.5 w-3.5" />{status ? "Refazer treinamento" : "Iniciar treinamento"}
                    </Button>
                    {status && <Button size="sm" variant="ghost" onClick={() => void resetProgress(article.id)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reiniciar</Button>}
                    {status === "completed" && <Badge className="border-primary/30 bg-primary/15 text-primary"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Concluído</Badge>}
                  </>
                )}
              </div>
            </div>
            <article className="prose prose-slate max-w-none p-5 dark:prose-invert sm:p-8 prose-headings:font-display prose-img:rounded-lg prose-img:border prose-img:border-border prose-a:text-primary">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  iframe: (props: React.ComponentProps<"iframe">) => <iframe {...props} title={props.title || "Conteúdo incorporado"} className="aspect-video w-full rounded-lg border border-border" />,
                }}
              >
                {article.content}
              </ReactMarkdown>
            </article>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="rounded-2xl bg-gradient-to-br from-primary/10 via-background to-accent/40 p-5 sm:p-8">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-3"><Sparkles className="mr-1.5 h-3.5 w-3.5" />Aprenda no seu ritmo</Badge>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Central de Ajuda</h1>
            <p className="mt-2 text-muted-foreground sm:text-base">Encontre o passo a passo de qualquer tarefa ou faça um treinamento guiado dentro do próprio LivreOS.</p>
            <div className="relative mt-5 max-w-2xl">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Buscar na Central de Ajuda" placeholder="O que você quer fazer? Ex.: cadastrar cliente, fechar caixa..." className="h-12 bg-background pl-10 pr-10" value={query} onChange={(event) => setQuery(event.target.value)} />
              {query && <button aria-label="Limpar busca" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
            </div>
          </div>
        </section>

        {trainingArticles.length > 0 && (
          <Card className="border-primary/20 bg-primary/[0.03] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><GraduationCap className="h-5 w-5" /></div>
                <div>
                  <h2 className="font-semibold">Seu treinamento</h2>
                  <p className="text-sm text-muted-foreground">{completedTraining} de {trainingArticles.length} treinamentos concluídos</p>
                </div>
              </div>
              <div className="flex min-w-[180px] items-center gap-3">
                <Progress value={trainingPercent} className="h-2" />
                <span className="text-sm font-semibold text-primary">{trainingPercent}%</span>
              </div>
              <Button variant={trainingOnly ? "default" : "outline"} size="sm" onClick={() => setTrainingOnly((value) => !value)}>
                <ListChecks className="mr-1.5 h-4 w-4" />{trainingOnly ? "Ver todos" : "Ver treinamentos"}
              </Button>
            </div>
          </Card>
        )}

        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="text-xl font-semibold">Encontre uma orientação</h2><p className="text-sm text-muted-foreground">Busque por tela, tarefa, módulo ou palavra do conteúdo.</p></div>
            {(activeCat || trainingOnly || query) && <Button variant="ghost" size="sm" onClick={() => { setActiveCat(null); setTrainingOnly(false); setQuery(""); }}>Limpar filtros</Button>}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <Button size="sm" variant={!activeCat ? "default" : "outline"} onClick={() => setActiveCat(null)}>Todos</Button>
            {cats.map((category) => <Button key={category.id} size="sm" variant={activeCat === category.id ? "default" : "outline"} onClick={() => setActiveCat(category.id)}>{category.name}</Button>)}
            <span className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><Filter className="h-3.5 w-3.5" />{filtered.length} resultado(s)</span>
          </div>
        </section>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <Card key={item} className="p-5"><Skeleton className="h-4 w-24" /><Skeleton className="mt-4 h-6 w-4/5" /><Skeleton className="mt-3 h-10 w-full" /></Card>)}</div>
        ) : error ? (
          <Card className="p-10 text-center"><BookOpen className="mx-auto h-10 w-10 text-muted-foreground/40" /><h2 className="mt-3 font-semibold">Central temporariamente indisponível</h2><p className="mt-1 text-sm text-muted-foreground">Tente atualizar a página ou procure o suporte.</p></Card>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center"><Search className="mx-auto h-10 w-10 text-muted-foreground/40" /><h2 className="mt-3 font-semibold">Não encontramos essa orientação</h2><p className="mt-1 text-sm text-muted-foreground">Tente outro termo ou peça ao administrador para publicar um novo tutorial.</p><Button className="mt-4" variant="outline" onClick={() => navigate("/suporte")}>Falar com o suporte<ArrowRight className="ml-2 h-4 w-4" /></Button></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => {
              const categoryName = categoryById.get(item.category_id || "")?.name || "Geral";
              const status = progress[item.id];
              return (
                <Card key={item.id} className="group flex cursor-pointer flex-col p-4 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md" onClick={() => navigate(`/wiki/${item.slug}`)}>
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-primary">{categoryName}</p><h3 className="mt-1 line-clamp-2 font-semibold">{item.title}</h3></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" /></div>
                  {item.summary && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>}
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4"><span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="h-3 w-3" />{estimateMinutes(item.content)} min</span>{item.tour_steps?.length > 0 && <Badge variant="outline" className="text-[10px]"><Play className="mr-1 h-3 w-3" />Treinamento</Badge>}{status === "completed" && <Badge className="bg-primary/15 text-primary"><CheckCircle2 className="mr-1 h-3 w-3" />Visto</Badge>}</div>
                </Card>
              );
            })}
          </div>
        )}

        {!query && !trainingOnly && !activeCat && cats.length > 0 && (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cats.slice(0, 4).map((category) => {
              const count = articles.filter((item) => item.category_id === category.id).length;
              return <button key={category.id} onClick={() => setActiveCat(category.id)} className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-sm"><p className="font-medium">{category.name}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{category.description || "Guias e orientações do módulo."}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">{count} guia(s)<ArrowRight className="h-3 w-3" /></span></button>;
            })}
          </section>
        )}
      </div>
    </MainLayout>
  );
}
