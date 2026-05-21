import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import {
  Zap, ClipboardList, Package, DollarSign, Users, MapPin,
  Smartphone, ShieldCheck, Sparkles, Check, ArrowRight, BarChart3, Wrench,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';

interface Plan {
  id: string;
  name: string;
  slug: string;
  monthly_price: number;
  max_users: number;
  features: any;
}

const FEATURES = [
  { icon: ClipboardList, title: 'Ordens de Serviço', desc: 'Pipeline visual, status automáticos, fotos, assinatura digital e PDF white-label.' },
  { icon: Package, title: 'Estoque Inteligente', desc: 'Controle de peças, código sequencial, importação Mercado Livre e precificação por margem.' },
  { icon: DollarSign, title: 'Financeiro & Cobranças', desc: 'Integração com Asaas e Mercado Pago. Gere PIX e Boleto direto da OS.' },
  { icon: Users, title: 'CRM de Clientes', desc: 'Cadastro completo, histórico de atendimentos e infraestrutura técnica do cliente.' },
  { icon: MapPin, title: 'Rotas & Deslocamentos', desc: 'Cálculo de rota OSRM, pedágios, combustível e compartilhamento via WhatsApp.' },
  { icon: BarChart3, title: 'Relatórios em Tempo Real', desc: 'KPIs de faturamento, OS, técnicos e estoque. Tudo num único painel.' },
];

const BENEFITS = [
  'Mobile-first, funciona em qualquer celular',
  'White-label: sua logo nas OS e cobranças',
  '7 dias grátis sem cartão de crédito',
  'Cancele quando quiser, sem multa',
  'Suporte humanizado por WhatsApp',
  'Integração com WhatsApp e PIX nativos',
];

export default function Landing() {
  const { user } = useAuth();
  const { isPlatformAdmin, loading: orgLoading } = useOrganization();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [hero, setHero] = useState<any>(null);
  const [contact, setContact] = useState<any>(null);

  useEffect(() => {
    supabase.from('site_config').select('*')
      .then(({ data }) => {
        if (data) {
          setHero(data.find(c => c.key === 'landing_hero')?.value);
          setContact(data.find(c => c.key === 'site_contact')?.value);
        }
      });

    supabase.from('subscription_plans' as any)
      .select('*').eq('active', true).order('monthly_price')
      .then(({ data }) => setPlans((data as any) || []));
  }, []);

  const dashboardPath = isPlatformAdmin ? "/admin-master" : "/dashboard";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="LivreOS" className="h-9 w-auto" />
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="hover:text-primary">Recursos</a>
            <a href="#planos" className="hover:text-primary">Planos</a>
            <a href="#contato" className="hover:text-primary">Contato</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild size="sm"><Link to={dashboardPath}>Acessar Painel</Link></Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm"><Link to="/auth">Entrar</Link></Button>
                <Button asChild size="sm"><Link to="/cadastro-empresa">Teste grátis</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        <div className="container mx-auto px-4 py-20 lg:py-28 relative">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" /> {hero?.badge || 'Novo: cobranças PIX em 1 clique'}
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              {hero?.title?.split(hero?.highlight || '')[0]}
              <span className="text-primary">{hero?.highlight || 'assistência técnica'}</span>
              {hero?.title?.split(hero?.highlight || '')[1]}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              {hero?.description || 'Pare de perder tempo com papel ou sistemas antigos. O LivreOS foi pensado para a nova geração de assistências — perfeito para oficinas de eletrônica, drones, mobilidade urbana e prestadores de serviços que buscam faturamento, estoque e OS organizados em poucos cliques.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button asChild size="lg" className="gap-2">
                <Link to="/cadastro-empresa">{hero?.cta_primary || 'Começar 7 dias grátis'} <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#planos">{hero?.cta_secondary || 'Ver planos'}</a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Sem cartão de crédito • Configure em 1 minuto</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 border-t">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 space-y-3">
            <Badge variant="outline">Recursos</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Tudo que sua oficina precisa</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Substitua planilhas, cadernos e mensagens soltas por um sistema profissional.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <Card key={f.title} className="border-border/50 hover:border-primary/50 transition-colors">
                <CardContent className="pt-6 space-y-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-muted/30 border-t">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              <Badge variant="outline">Por que LivreOS?</Badge>
              <h2 className="text-3xl md:text-4xl font-bold">Feito para quem coloca a mão na massa</h2>
              <p className="text-muted-foreground">
                Não é mais um ERP genérico. Cada tela foi pensada para o dia a dia de uma assistência técnica real.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 pt-4">
                {BENEFITS.map((b) => (
                  <div key={b} className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center mt-0.5">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm">{b}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Smartphone, label: 'Mobile First' },
                { icon: ShieldCheck, label: 'Dados Seguros' },
                { icon: Wrench, label: 'Pronto p/ Oficina' },
                { icon: Zap, label: 'Rápido & Leve' },
              ].map((i) => (
                <Card key={i.label} className="aspect-square flex items-center justify-center">
                  <CardContent className="pt-6 text-center space-y-2">
                    <i.icon className="h-10 w-10 text-primary mx-auto" />
                    <p className="font-semibold">{i.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="planos" className="py-20 border-t">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 space-y-3">
            <Badge variant="outline">Planos</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Escolha o plano ideal</h2>
            <p className="text-muted-foreground">Comece grátis por 7 dias. Sem cartão de crédito.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((p, idx) => {
              const featured = idx === 1;
              const featureList = Array.isArray(p.features) ? p.features : Object.keys(p.features || {});
              return (
                <Card key={p.id} className={featured ? 'border-primary shadow-lg relative' : ''}>
                  {featured && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Mais popular</Badge>
                  )}
                  <CardContent className="pt-6 space-y-4">
                    <div>
                      <h3 className="font-bold text-xl">{p.name}</h3>
                      <div className="mt-2">
                        <span className="text-4xl font-bold">R$ {Number(p.monthly_price).toFixed(2).replace('.', ',')}</span>
                        <span className="text-muted-foreground">/mês</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Até {p.max_users === -1 ? 'ilimitados' : p.max_users} usuários
                      </p>
                    </div>
                    <Button asChild className="w-full" variant={featured ? 'default' : 'outline'}>
                      <Link to="/cadastro-empresa">Começar agora</Link>
                    </Button>
                    <ul className="space-y-2 text-sm pt-2">
                      {featureList.slice(0, 8).map((f: string) => (
                        <li key={f} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{String(f).replace(/_/g, ' ')}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contato" className="py-20 border-t">
        <div className="container mx-auto px-4">
          <Card className="max-w-3xl mx-auto bg-primary text-primary-foreground">
            <CardContent className="pt-10 pb-10 text-center space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold">Pronto para profissionalizar sua oficina?</h2>
              <p className="opacity-90">Cadastre sua empresa agora e teste todos os recursos por 7 dias grátis.</p>
              <Button asChild size="lg" variant="secondary" className="mt-2">
                <Link to="/cadastro-empresa">Criar conta grátis <ArrowRight className="h-4 w-4 ml-2" /></Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logo} alt="LivreOS" className="h-6 w-auto" />
            <span>© {new Date().getFullYear()} LivreOS. Todos os direitos reservados.</span>
          </div>
          <div className="flex gap-4">
            <Link to="/auth" className="hover:text-primary">Entrar</Link>
            <Link to="/cadastro-empresa" className="hover:text-primary">Criar conta</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
