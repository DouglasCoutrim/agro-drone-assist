import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
import { LivreOSLogo } from '@/components/brand/LivreOSLogo';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  ClipboardList,
  DollarSign,
  LayoutDashboard,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  slug: string;
  monthly_price: number;
  max_users: number;
}

const FALLBACK_PLANS: Plan[] = [
  { id: 'bronze', name: 'Bronze', slug: 'bronze', monthly_price: 39.9, max_users: 2 },
  { id: 'prata', name: 'Prata', slug: 'prata', monthly_price: 59.9, max_users: 4 },
  { id: 'ouro', name: 'Ouro', slug: 'ouro', monthly_price: 69.9, max_users: 10 },
];

const PLAN_DETAILS: Record<string, { description: string; features: string[] }> = {
  bronze: {
    description: 'A base para tirar a operação das planilhas e ganhar rotina.',
    features: ['Cadastro de clientes e produtos', 'Vendas e orçamentos', 'Controle de estoque', 'Acesso para até 2 usuários'],
  },
  prata: {
    description: 'Mais controle para equipes que já precisam acompanhar o caixa.',
    features: ['Tudo do Bronze', 'Financeiro e contas a receber', 'Cobranças por Pix e boleto', 'Modelos de WhatsApp', 'Acesso para até 4 usuários'],
  },
  ouro: {
    description: 'A visão completa para operações com mais volume e processos.',
    features: ['Tudo do Prata', 'Ordens de serviço e atendimento', 'Rotas e operações em campo', 'Relatórios para gestão', 'Acesso para até 10 usuários'],
  },
};

const FEATURES = [
  { icon: ShoppingBag, title: 'Venda e atendimento', desc: 'Registre vendas, pedidos, orçamentos e o histórico de cada cliente em um só fluxo.' },
  { icon: Package, title: 'Produtos e estoque', desc: 'Saiba o que entrou, saiu e precisa ser reposto sem depender de planilhas espalhadas.' },
  { icon: Receipt, title: 'Financeiro conectado', desc: 'Acompanhe recebimentos, contas e cobranças para entender o caixa da operação.' },
  { icon: ClipboardList, title: 'Serviços e OS', desc: 'Ative ordens de serviço, tarefas e acompanhamento quando o seu negócio precisar.' },
  { icon: BarChart3, title: 'Gestão em uma tela', desc: 'Transforme a rotina em indicadores simples para decidir com mais segurança.' },
  { icon: Users, title: 'Equipe alinhada', desc: 'Distribua acessos e deixe cada pessoa enxergar o que precisa fazer.' },
];

const SEGMENTS = [
  { title: 'Lojas e comércio', text: 'Venda, estoque, clientes e caixa com menos retrabalho.', icon: ShoppingBag },
  { title: 'Empresas agropecuárias', text: 'Organize produtos, pedidos e relacionamento com seus clientes.', icon: Package },
  { title: 'Prestadores de serviço', text: 'Centralize propostas, agenda, atendimento e financeiro.', icon: Wrench },
  { title: 'Assistências técnicas', text: 'Use OS, tarefas e módulos especializados quando fizer sentido.', icon: ClipboardList },
];

const FAQ = [
  { question: 'Preciso cadastrar cartão para testar?', answer: 'Não. O teste dura 7 dias e começa sem cartão de crédito. Você decide se quer continuar depois desse período.' },
  { question: 'O LivreOS é só para assistência técnica?', answer: 'Não. A base é um ERP modular para lojas, empresas agropecuárias, prestadores de serviço e assistências técnicas. OS e recursos especializados são módulos opcionais.' },
  { question: 'Posso mudar de plano depois?', answer: 'Sim. Você pode escolher outro plano conforme a equipe, o volume e os módulos necessários para a operação.' },
  { question: 'O que acontece depois do cadastro?', answer: 'Você cria a empresa, acessa o painel e pode começar a configurar clientes, produtos e os módulos da sua rotina.' },
  { question: 'Como funciona o pagamento?', answer: 'Depois do teste, o pagamento pode ser feito pelos meios disponíveis no checkout, como Pix, boleto ou cartão.' },
];

function formatPrice(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -inset-6 rounded-[2rem] bg-primary/10 blur-3xl" />
      <Card className="relative overflow-hidden rounded-2xl border-primary/15 bg-background/95 shadow-2xl shadow-primary/10">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /></div>
          <span className="text-[11px] font-medium text-muted-foreground">Painel LivreOS</span>
          <div className="h-6 w-6 rounded-full bg-primary/10" />
        </div>
        <CardContent className="p-0">
          <div className="grid grid-cols-[116px_1fr] min-h-[300px]">
            <aside className="hidden border-r bg-muted/15 p-3 sm:block">
              <div className="mb-7 flex items-center gap-2"><div className="h-6 w-6 rounded-md bg-primary" /><span className="text-xs font-bold">LivreOS</span></div>
              <div className="space-y-2 text-[10px] text-muted-foreground"><div className="rounded-md bg-primary/10 px-2 py-2 font-semibold text-primary">Visão geral</div><div className="px-2 py-1.5">Vendas</div><div className="px-2 py-1.5">Estoque</div><div className="px-2 py-1.5">Clientes</div><div className="px-2 py-1.5">Financeiro</div></div>
            </aside>
            <div className="space-y-4 p-4 sm:p-5">
              <div><p className="text-[11px] text-muted-foreground">Visão geral</p><h3 className="text-lg font-bold tracking-tight">Bom dia, sua operação está em ordem.</h3></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[['Vendas', 'R$ 12,8k'], ['Pedidos', '128'], ['Estoque', '94%'], ['A receber', 'R$ 4,2k']].map(([label, value]) => <div key={label} className="rounded-xl border bg-card p-2.5"><p className="text-[9px] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-bold">{value}</p><div className="mt-2 h-1 rounded-full bg-primary/15"><div className="h-1 w-2/3 rounded-full bg-primary" /></div></div>)}
              </div>
              <div className="grid gap-3 sm:grid-cols-[1.35fr_1fr]">
                <div className="rounded-xl border p-3"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold">Movimentação</span><span className="text-[10px] text-primary">Este mês</span></div><div className="flex h-24 items-end gap-2">{[38, 56, 44, 72, 61, 86, 68, 94, 78, 88, 70, 100].map((height, index) => <div key={index} className="flex-1 rounded-t bg-primary/20" style={{ height: `${height}%` }}><div className="h-1/2 w-full rounded-t bg-primary/70" /></div>)}</div></div>
                <div className="rounded-xl border p-3"><span className="text-xs font-semibold">Atalhos</span><div className="mt-3 space-y-2">{[['Nova venda', ShoppingBag], ['Novo cliente', Users], ['Ordem de serviço', ClipboardList]].map(([label, Icon]) => { const ActionIcon = Icon as typeof ShoppingBag; return <div key={String(label)} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-2 text-[10px] font-medium"><ActionIcon className="h-3.5 w-3.5 text-primary" />{String(label)}<ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" /></div>; })}</div></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="absolute -bottom-5 -left-4 hidden items-center gap-3 rounded-xl border bg-background p-3 shadow-xl sm:flex"><div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600"><Check className="h-4 w-4" /></div><div><p className="text-[10px] text-muted-foreground">Status da operação</p><p className="text-xs font-semibold">Tudo atualizado</p></div></div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const { isPlatformAdmin } = useOrganization();
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);

  useEffect(() => {
    const title = 'LivreOS | ERP modular para o seu negócio';
    const description = 'Organize vendas, clientes, estoque, serviços e financeiro em um ERP modular para lojas, agro, serviços e assistências técnicas.';
    document.title = title;
    const setMeta = (selector: string, attribute: string, value: string) => {
      let element = document.querySelector(selector);
      if (!element) { element = document.createElement('meta'); document.head.appendChild(element); }
      element.setAttribute(attribute, value);
    };
    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', 'https://livreos.net/landing');
    setMeta('meta[property="og:type"]', 'content', 'website');
    setMeta('meta[property="og:site_name"]', 'content', 'LivreOS');
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', description);
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = 'https://livreos.net/landing';

    supabase.from('subscription_plans').select('id,name,slug,monthly_price,max_users').eq('active', true).then(({ data }) => {
      const validPlans = ((data as Plan[]) || []).filter((plan) => ['bronze', 'prata', 'ouro'].includes(String(plan.slug).toLowerCase()));
      setPlans(FALLBACK_PLANS.map((fallback) => validPlans.find((plan) => String(plan.slug).toLowerCase() === fallback.slug) || fallback));
    });
  }, []);

  const dashboardPath = isPlatformAdmin ? '/admin/dashboard' : '/dashboard';

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:h-[72px]">
          <Link to="/landing" aria-label="LivreOS - início"><LivreOSLogo size="sm" tone="onLight" /></Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex"><a href="#recursos" className="transition-colors hover:text-foreground">Recursos</a><a href="#segmentos" className="transition-colors hover:text-foreground">Para quem é</a><a href="#planos" className="transition-colors hover:text-foreground">Planos</a><a href="#faq" className="transition-colors hover:text-foreground">Dúvidas</a></nav>
          <div className="flex items-center gap-2">{user ? <Button asChild size="sm"><Link to={dashboardPath}>Acessar painel</Link></Button> : <><Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/auth">Entrar</Link></Button><Button asChild size="sm"><Link to="/cadastro-empresa">Testar grátis <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button></>}</div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b bg-[radial-gradient(circle_at_15%_10%,hsl(var(--primary)/.14),transparent_35%),radial-gradient(circle_at_90%_20%,hsl(var(--primary)/.08),transparent_30%)]">
          <div className="container mx-auto grid items-center gap-14 px-4 py-16 lg:grid-cols-[.92fr_1.08fr] lg:gap-10 lg:py-24">
            <div className="max-w-xl"><Badge variant="outline" className="mb-6 gap-1.5 rounded-full border-primary/25 bg-primary/5 px-3 py-1 text-primary"><Sparkles className="h-3.5 w-3.5" /> Gestão que acompanha o seu negócio</Badge><h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-[4.25rem]">Menos planilhas.<br /><span className="text-primary">Mais negócio.</span></h1><p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">O LivreOS reúne vendas, clientes, estoque, serviços e financeiro em um ERP modular, feito para a rotina real da sua empresa.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="h-12 gap-2 px-6"><Link to="/cadastro-empresa">Começar 7 dias grátis <ArrowRight className="h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline" className="h-12 px-6"><a href="#planos">Conhecer os planos</a></Button></div><div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Sem cartão de crédito</span><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Cancele quando quiser</span></div></div>
            <ProductPreview />
          </div>
        </section>

        <section id="segmentos" className="border-b py-16 lg:py-20"><div className="container mx-auto px-4"><div className="mb-10 max-w-2xl"><p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-primary">Um sistema, vários cenários</p><h2 className="text-3xl font-bold tracking-tight sm:text-4xl">A base é genérica. A operação é do seu jeito.</h2><p className="mt-4 text-muted-foreground">Comece com o essencial e ative módulos conforme o seu processo amadurecer. Você não precisa trocar de sistema para crescer.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{SEGMENTS.map(({ title, text, icon: Icon }) => <Card key={title} className="group border-border/70 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"><CardContent className="p-5"><div className="mb-8 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></CardContent></Card>)}</div></div></section>

        <section id="recursos" className="border-b bg-muted/20 py-16 lg:py-20"><div className="container mx-auto px-4"><div className="mx-auto mb-12 max-w-2xl text-center"><Badge variant="outline" className="mb-4">Módulos que trabalham juntos</Badge><h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Tudo o que você precisa para operar melhor</h2><p className="mt-4 text-muted-foreground">Informação centralizada para sua equipe vender, atender e acompanhar o negócio com mais clareza.</p></div><div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">{FEATURES.map(({ icon: Icon, title, desc }) => <div key={title} className="flex gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm ring-1 ring-border/70"><Icon className="h-5 w-5" /></div><div><h3 className="font-semibold">{title}</h3><p className="mt-1.5 text-sm leading-6 text-muted-foreground">{desc}</p></div></div>)}</div><div className="mx-auto mt-14 flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl border bg-background px-6 py-5 text-sm text-muted-foreground shadow-sm"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Acesso por usuário</span><span className="flex items-center gap-2"><LayoutDashboard className="h-4 w-4 text-primary" /> Painel web responsivo</span><span className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> Cobranças integradas</span></div></div></section>

        <section id="planos" className="border-b py-16 lg:py-20"><div className="container mx-auto px-4"><div className="mx-auto mb-12 max-w-2xl text-center"><p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-primary">Planos simples</p><h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Comece pequeno. Evolua sem complicar.</h2><p className="mt-4 text-muted-foreground">Todos os planos começam com 7 dias grátis. Escolha a combinação de recursos que faz sentido agora.</p></div><div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-3">{plans.map((plan) => { const details = PLAN_DETAILS[plan.slug] || PLAN_DETAILS.bronze; const featured = plan.slug === 'prata'; return <Card key={plan.id} className={`relative flex flex-col ${featured ? 'border-primary shadow-xl shadow-primary/10 lg:-translate-y-2' : 'border-border/70'}`}>{featured && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4">Mais escolhido</Badge>}<CardContent className="flex h-full flex-col p-6 sm:p-7"><div><h3 className="text-xl font-bold">{plan.name}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{details.description}</p><div className="mt-5 flex items-baseline gap-1"><span className="text-4xl font-bold tracking-tight">R$ {formatPrice(Number(plan.monthly_price))}</span><span className="text-sm text-muted-foreground">/mês</span></div><p className="mt-1 text-xs text-muted-foreground">Até {plan.max_users === -1 ? 'usuários ilimitados' : `${plan.max_users} usuários`}</p></div><Button asChild className="mt-6 w-full" variant={featured ? 'default' : 'outline'}><Link to={`/cadastro-empresa?plan=${encodeURIComponent(plan.slug)}`}>Escolher {plan.name}</Link></Button><div className="my-6 h-px bg-border" /><ul className="space-y-3 text-sm">{details.features.map((feature) => <li key={feature} className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{feature}</span></li>)}</ul></CardContent></Card>; })}</div></div></section>

        <section id="faq" className="bg-muted/20 py-16 lg:py-20"><div className="container mx-auto grid max-w-5xl gap-12 px-4 lg:grid-cols-[.72fr_1.28fr] lg:gap-20"><div><p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-primary">Dúvidas frequentes</p><h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Tudo claro antes de começar.</h2><p className="mt-4 text-muted-foreground">Ainda ficou alguma dúvida? Comece o teste e conheça o painel sem compromisso.</p><Button asChild variant="outline" className="mt-6"><Link to="/cadastro-empresa">Criar minha conta <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div><div className="space-y-3">{FAQ.map(({ question, answer }) => <details key={question} className="group rounded-xl border bg-background px-5 py-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-medium">{question}<ChevronDown className="h-4 w-4 shrink-0 text-primary transition-transform group-open:rotate-180" /></summary><p className="pr-8 pt-3 text-sm leading-6 text-muted-foreground">{answer}</p></details>)}</div></div></section>

        <section className="px-4 py-16 lg:py-20"><div className="container mx-auto overflow-hidden rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground shadow-2xl shadow-primary/20 sm:px-12"><div className="mx-auto max-w-2xl"><p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-primary-foreground/70">Sua próxima etapa</p><h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Coloque sua operação em ordem.</h2><p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">Teste o LivreOS por 7 dias e veja como uma gestão modular pode simplificar o dia a dia da sua empresa.</p><Button asChild size="lg" variant="secondary" className="mt-8 h-12 gap-2 px-7"><Link to="/cadastro-empresa">Começar agora, sem cartão <ArrowRight className="h-4 w-4" /></Link></Button></div></div></section>
      </main>

      <footer className="border-t py-8"><div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row"><div className="flex items-center gap-3"><LivreOSLogo size="xs" tone="onLight" /><span>© {new Date().getFullYear()} LivreOS</span></div><div className="flex gap-5"><Link to="/auth" className="hover:text-foreground">Entrar</Link><Link to="/cadastro-empresa" className="hover:text-foreground">Criar conta</Link></div></div></footer>
    </div>
  );
}
