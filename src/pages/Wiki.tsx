import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, ChevronRight, Play, ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Joyride, type Step } from "react-joyride";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

interface Category { id: string; slug: string; name: string; description: string | null; icon: string; sort_order: number; }
interface Article {
  id: string; category_id: string | null; slug: string; title: string; summary: string | null;
  content: string; media: any[]; tour_target_route: string | null; tour_steps: Step[];
  tags: string[]; published: boolean; sort_order: number;
}

export default function Wiki() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [cats, setCats] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [runTour, setRunTour] = useState(false);
  const [tourSteps, setTourSteps] = useState<Step[]>([]);
  const [activeTourArticleId, setActiveTourArticleId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, "completed" | "skipped">>({});
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      const [{ data: c }, { data: a }, prog] = await Promise.all([
        supabase.from("wiki_categories").select("*").order("sort_order"),
        supabase.from("wiki_articles").select("*").eq("published", true).order("sort_order"),
        user ? supabase.from("wiki_tour_progress").select("article_id,status").eq("user_id", user.id) : Promise.resolve({ data: [] as any[] }),
      ]);
      setCats((c || []) as Category[]);
      setArticles((a || []) as unknown as Article[]);
      const map: Record<string, "completed" | "skipped"> = {};
      (prog.data || []).forEach((p: any) => { map[p.article_id] = p.status; });
      setProgress(map);
    })();
  }, []);

  const article = useMemo(() => articles.find((a) => a.slug === slug), [articles, slug]);

  const filtered = useMemo(() => {
    let list = articles;
    if (activeCat) list = list.filter((a) => a.category_id === activeCat);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(q) || (a.summary || "").toLowerCase().includes(q));
    }
    return list;
  }, [articles, activeCat, query]);

  const startTour = (a: Article) => {
    if (!a.tour_steps?.length) return;
    setActiveTourArticleId(a.id);
    setTourSteps(a.tour_steps);
    if (a.tour_target_route && window.location.pathname !== a.tour_target_route) {
      navigate(a.tour_target_route);
      setTimeout(() => setRunTour(true), 600);
    } else {
      setRunTour(true);
    }
  };

  const saveProgress = async (articleId: string, status: "completed" | "skipped") => {
    setProgress((prev) => ({ ...prev, [articleId]: status }));
    if (!userId) return;
    const { error } = await supabase.from("wiki_tour_progress").upsert(
      { user_id: userId, article_id: articleId, status, completed_at: new Date().toISOString() },
      { onConflict: "user_id,article_id" }
    );
    if (!error && status === "completed") toast.success("Tour concluído! Marcado como visto.");
  };

  const handleJoyrideEvent = (e: any) => {
    const status = e?.status;
    const type = e?.type;
    if (status === "finished" || type === "tour:end") {
      if (activeTourArticleId) saveProgress(activeTourArticleId, "completed");
      setRunTour(false); setActiveTourArticleId(null);
    } else if (status === "skipped") {
      if (activeTourArticleId) saveProgress(activeTourArticleId, "skipped");
      setRunTour(false); setActiveTourArticleId(null);
    }
  };

  const resetProgress = async (articleId: string) => {
    if (!userId) return;
    await supabase.from("wiki_tour_progress").delete().eq("user_id", userId).eq("article_id", articleId);
    setProgress((prev) => { const n = { ...prev }; delete n[articleId]; return n; });
    toast.success("Progresso reiniciado.");
  };

  // ----- Article view -----
  if (article) {
    const status = progress[article.id];
    return (
      <MainLayout>
        {runTour && tourSteps.length > 0 && (
          <Joyride 
            steps={tourSteps} 
            continuous 
            showProgress 
            showSkipButton 
            onEvent={handleJoyrideEvent} 
            styles={{
              options: {
                primaryColor: 'hsl(var(--primary))',
                backgroundColor: 'hsl(var(--background))',
                textColor: 'hsl(var(--foreground))',
                arrowColor: 'hsl(var(--background))',
              }
            }}
            locale={{
              back: 'Voltar',
              close: 'Fechar',
              last: 'Finalizar',
              next: 'Próximo',
              skip: 'Pular'
            }}
          />
        )}
        <div className="max-w-3xl mx-auto space-y-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/wiki")}>
            <ArrowLeft className="h-4 w-4 mr-1" />Voltar
          </Button>
          <header>
            <h1 className="font-display text-3xl font-bold">{article.title}</h1>
            {article.summary && <p className="text-muted-foreground mt-1">{article.summary}</p>}
            <div className="flex flex-wrap gap-2 mt-3 items-center">
              {article.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
              {article.tour_steps?.length > 0 && (
                <>
                  {status === "completed" && (
                    <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-1" />Tour concluído
                    </Badge>
                  )}
                  {status === "skipped" && (
                    <Badge variant="outline" className="text-[10px]">Tour pulado</Badge>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => startTour(article)}>
                    <Play className="h-3.5 w-3.5 mr-1" />
                    {status ? "Refazer tour" : "Iniciar tour guiado"}
                  </Button>
                  {status && (
                    <Button size="sm" variant="ghost" onClick={() => resetProgress(article.id)}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />Reiniciar progresso
                    </Button>
                  )}
                </>
              )}
            </div>
          </header>
          <article className="prose prose-invert max-w-none prose-img:rounded-lg prose-img:border prose-img:border-border">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                iframe: (props: any) => <iframe {...props} className="w-full aspect-video rounded-lg border border-border" />,
              }}
            >
              {article.content}
            </ReactMarkdown>
          </article>
        </div>
      </MainLayout>
    );
  }

  // ----- List view -----
  const tourArticles = articles.filter((a) => a.tour_steps?.length > 0);
  const completedCount = tourArticles.filter((a) => progress[a.id] === "completed").length;

  return (
    <MainLayout>
      {runTour && tourSteps.length > 0 && (
        <Joyride 
          steps={tourSteps} 
          continuous 
          showProgress 
          showSkipButton 
          onEvent={handleJoyrideEvent}
          styles={{
            options: {
              primaryColor: 'hsl(var(--primary))',
              backgroundColor: 'hsl(var(--background))',
              textColor: 'hsl(var(--foreground))',
              arrowColor: 'hsl(var(--background))',
            }
          }}
          locale={{
            back: 'Voltar',
            close: 'Fechar',
            last: 'Finalizar',
            next: 'Próximo',
            skip: 'Pular'
          }}
        />
      )}
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />Central de Ajuda
          </h1>
          <p className="text-sm text-muted-foreground">Tutoriais, guias e tours interativos para dominar o LivreOS.</p>
          {tourArticles.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Progresso de tours: <span className="font-semibold text-primary">{completedCount}/{tourArticles.length}</span> concluídos
            </p>
          )}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar artigos…" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={!activeCat ? "default" : "outline"} onClick={() => setActiveCat(null)}>Todos</Button>
          {cats.map((c) => (
            <Button key={c.id} size="sm" variant={activeCat === c.id ? "default" : "outline"} onClick={() => setActiveCat(c.id)}>
              {c.name}
            </Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">Nenhum artigo encontrado.</Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((a) => {
              const status = progress[a.id];
              return (
                <Card
                  key={a.id}
                  className="p-4 cursor-pointer hover:border-primary transition group"
                  onClick={() => navigate(`/wiki/${a.slug}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {cats.find((c) => c.id === a.category_id)?.name || "Geral"}
                      </p>
                      <h3 className="font-semibold mt-1 line-clamp-2">{a.title}</h3>
                      {a.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.summary}</p>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {a.tour_steps?.length > 0 && (
                      <Badge variant="outline" className="text-[10px]"><Play className="h-3 w-3 mr-1" />Tour interativo</Badge>
                    )}
                    {status === "completed" && (
                      <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" />Concluído
                      </Badge>
                    )}
                    {status === "skipped" && (
                      <Badge variant="outline" className="text-[10px]">Pulado</Badge>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
