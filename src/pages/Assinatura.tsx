import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Sparkles, Zap, Copy, Link2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import { mensagemDoErroFuncao } from '@/lib/functionsError';

type Cycle = 'mensal' | 'semestral' | 'anual';

type Plan = {
  id: string;
  slug: string;
  name: string;
  monthly_price: number;
  max_users: number;
  max_os_per_month: number;
  features: unknown;
  active: boolean;
  visivel_publicamente: boolean;
  cobravel: boolean;
};

const PLAN_PRESENTATION: Record<string, { icon: typeof Zap; recommended?: boolean; highlights: string[] }> = {
  bronze: { icon: Zap, highlights: ['Clientes, Estoque e Orçamentos'] },
  prata: { icon: Sparkles, recommended: true, highlights: ['Financeiro e Cobranças PIX/Boleto', 'Modelos de WhatsApp'] },
  ouro: { icon: Crown, highlights: ['Rotas, API REST e Suporte prioritário'] },
};

const CYCLES: { value: Cycle; label: string; months: number; discount: number; badge?: string }[] = [
  { value: 'mensal', label: 'Mensal', months: 1, discount: 0 },
  { value: 'semestral', label: 'Semestral', months: 6, discount: 0.10, badge: '-10%' },
  { value: 'anual', label: 'Anual', months: 12, discount: 0.20, badge: '-20%' },
];

export default function Assinatura() {
  const { organization, isPlatformAdmin } = useOrganization();
  const [cycle, setCycle] = useState<Cycle>('mensal');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [checkout, setCheckout] = useState<any>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [link, setLink] = useState<any>(null);
  const [gerandoLink, setGerandoLink] = useState<string | null>(null);

  const cycleCfg = CYCLES.find(c => c.value === cycle)!;

  useEffect(() => {
    let cancelled = false;
    const loadPlans = async () => {
      setPlansLoading(true);
      let query = supabase
        .from('subscription_plans' as any)
        .select('id,slug,name,monthly_price,max_users,max_os_per_month,features,active,visivel_publicamente,cobravel')
        .eq('active', true)
        .order('monthly_price', { ascending: true });
      if (!isPlatformAdmin) query = query.eq('visivel_publicamente', true);
      const { data, error } = await query;
      if (!cancelled) {
        if (error) toast.error('Não foi possível carregar os planos.');
        setPlans((data as Plan[]) || []);
        setPlansLoading(false);
      }
    };
    loadPlans();
    return () => { cancelled = true; };
  }, [isPlatformAdmin]);

  const calcPrice = (monthly: number) => monthly * cycleCfg.months * (1 - cycleCfg.discount);

  const handleSubscribe = async (slug: string) => {
    setLoadingPlan(slug);
    setCheckout(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: { plan_slug: slug, cycle },
      });
      if (error) throw error;
      setCheckout(data);
      setPolling(true);
      toast.success('Cobrança gerada! Pague para ativar.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao gerar cobrança');
    } finally {
      setLoadingPlan(null);
    }
  };

  const gerarLink = async (slug: string) => {
    setGerandoLink(slug);
    setLink(null);
    try {
      const { data, error } = await supabase.functions.invoke('public-checkout', {
        body: { action: 'create', plan_slug: slug, cycle },
      });
      if (error) throw new Error(await mensagemDoErroFuncao(error, 'Falha ao gerar o link de pagamento'));
      if (data?.error) throw new Error(data.error);
      setLink(data);
      toast.success('Link de pagamento gerado.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao gerar o link de pagamento');
    } finally {
      setGerandoLink(null);
    }
  };

  // Polling do status da invoice
  useEffect(() => {
    if (!polling || !checkout?.invoice_id) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.from('tenant_invoices' as any).select('status').eq('id', checkout.invoice_id).maybeSingle();
      if ((data as any)?.status === 'pago') {
        setPolling(false);
        toast.success('Pagamento confirmado! Plano ativado.');
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [polling, checkout]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 data-tour="assinatura-page" className="text-3xl font-bold">Assinatura</h1>
          <p className="text-muted-foreground">
            Plano atual: <Badge variant="outline" className="ml-1 uppercase">{organization?.plan ?? '-'}</Badge>
          </p>
        </div>

        <div className="flex justify-center">
          <Tabs value={cycle} onValueChange={(v) => setCycle(v as Cycle)}>
            <TabsList>
              {CYCLES.map(c => (
                <TabsTrigger key={c.value} value={c.value} className="gap-2">
                  {c.label}
                  {c.badge && <Badge variant="secondary" className="text-xs">{c.badge}</Badge>}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {plansLoading ? <div className="text-center text-muted-foreground py-10">Carregando planos...</div> : <div className="grid md:grid-cols-3 gap-5">
          {plans.map(p => {
            const presentation = PLAN_PRESENTATION[p.slug] ?? { icon: Zap, highlights: [] };
            const Icon = presentation.icon;
            const total = calcPrice(Number(p.monthly_price));
            const isCurrent = organization?.plan === p.slug;
            const canCheckout = p.cobravel && p.visivel_publicamente;
            return (
              <Card key={p.id} className={`p-6 relative ${presentation.recommended ? 'border-primary ring-2 ring-primary/30' : ''}`}>
                {presentation.recommended && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full font-medium">
                    Recomendado
                  </span>
                )}
                <Icon className="h-8 w-8 text-primary mb-2" />
                <h3 className="text-2xl font-bold">{p.name}</h3>
                <div className="mt-3">
                  <div className="text-4xl font-black">
                    R$ {total.toFixed(2).replace('.', ',')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {cycle === 'mensal' ? 'por mês' : cycle === 'semestral' ? 'a cada 6 meses' : 'por ano'}
                    {cycle !== 'mensal' && ` · equivale a R$ ${(total / cycleCfg.months).toFixed(2).replace('.', ',')}/mês`}
                  </div>
                </div>
                <ul className="mt-5 space-y-2 text-sm">
                  <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /><span>Até {p.max_users === -1 ? 'usuários ilimitados' : `${p.max_users} usuários`}</span></li>
                  <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /><span>{p.max_os_per_month === -1 ? 'OS ilimitadas' : `${p.max_os_per_month} OS / mês`}</span></li>
                  {presentation.highlights.map(h => (
                    <li key={h} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full mt-6"
                  variant={presentation.recommended ? 'default' : 'outline'}
                  disabled={isCurrent || !canCheckout || loadingPlan === p.slug}
                  onClick={() => handleSubscribe(p.slug)}
                >
                  {loadingPlan === p.slug && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isCurrent ? 'Plano atual' : canCheckout ? 'Assinar agora' : 'Cortesia interna'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2"
                  disabled={!canCheckout || gerandoLink === p.slug}
                  onClick={() => gerarLink(p.slug)}
                >
                  {gerandoLink === p.slug
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Link2 className="h-4 w-4 mr-2" />}
                  Gerar link de pagamento
                </Button>
              </Card>
            );
          })}
        </div>}

        {link && (
          <Card className="p-6 space-y-3">
            <h3 className="text-xl font-bold">Link de pagamento pronto</h3>
            <p className="text-sm text-muted-foreground">
              Envie este link para quem vai pagar a assinatura {link.plano?.nome} ({link.ciclo}). Ao confirmar o
              pagamento, o plano é ativado automaticamente. O link vale até{' '}
              {new Date(link.expires_at).toLocaleDateString('pt-BR')}.
            </p>
            <div className="flex gap-2">
              <code className="text-xs bg-muted p-2 rounded flex-1 break-all">{link.url}</code>
              <Button
                size="icon"
                variant="outline"
                onClick={() => { navigator.clipboard.writeText(link.url); toast.success('Link copiado'); }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {checkout && (
          <Card className="p-6">
            <h3 className="text-xl font-bold mb-1">Aguardando pagamento</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {polling && <Loader2 className="h-4 w-4 inline mr-2 animate-spin" />}
              Assim que o pagamento for confirmado seu plano será ativado automaticamente.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              {checkout.pix_qr_image && (
                <div>
                  <h4 className="font-semibold mb-2">PIX</h4>
                  <img src={`data:image/png;base64,${checkout.pix_qr_image}`} alt="QR Code PIX" className="w-48 h-48 border rounded" />
                  {checkout.pix_payload && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground mb-1">PIX copia e cola:</p>
                      <div className="flex gap-2">
                        <code className="text-xs bg-muted p-2 rounded flex-1 break-all">{checkout.pix_payload}</code>
                        <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(checkout.pix_payload); toast.success('Copiado'); }}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {checkout.bank_slip_url && (
                <div>
                  <h4 className="font-semibold mb-2">Boleto</h4>
                  {checkout.barcode && (
                    <code className="text-xs bg-muted p-2 rounded block break-all mb-3">{checkout.barcode}</code>
                  )}
                  <Button asChild variant="outline">
                    <a href={checkout.bank_slip_url} target="_blank" rel="noreferrer">Abrir boleto</a>
                  </Button>
                </div>
              )}
              {checkout.invoice_url && (
                <Button asChild variant="link" className="md:col-span-2 justify-start">
                  <a href={checkout.invoice_url} target="_blank" rel="noreferrer">Abrir página de pagamento Asaas →</a>
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
