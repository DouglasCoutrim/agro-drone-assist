import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Sparkles, Zap, Copy, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

type Cycle = 'mensal' | 'semestral' | 'anual';

const PLANS = [
  { slug: 'bronze', name: 'Bronze', price: 39.90, icon: Zap, highlights: ['2 usuários', '30 OS / mês', 'Clientes, Estoque, Orçamentos'] },
  { slug: 'prata', name: 'Prata', price: 59.90, icon: Sparkles, recommended: true, highlights: ['4 usuários', '60 OS / mês', 'Financeiro + Cobrança PIX/Boleto', 'WhatsApp & Mercado Livre'] },
  { slug: 'ouro', name: 'Ouro', price: 69.90, icon: Crown, highlights: ['10 usuários', 'OS ilimitadas', 'White-label completo', 'Rotas, API REST, Suporte prioritário'] },
];

const CYCLES: { value: Cycle; label: string; months: number; discount: number; badge?: string }[] = [
  { value: 'mensal', label: 'Mensal', months: 1, discount: 0 },
  { value: 'semestral', label: 'Semestral', months: 6, discount: 0.10, badge: '-10%' },
  { value: 'anual', label: 'Anual', months: 12, discount: 0.20, badge: '-20%' },
];

export default function Assinatura() {
  const { organization } = useOrganization();
  const [cycle, setCycle] = useState<Cycle>('mensal');
  const [checkout, setCheckout] = useState<any>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const cycleCfg = CYCLES.find(c => c.value === cycle)!;

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
          <h1 className="text-3xl font-bold">Assinatura</h1>
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

        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map(p => {
            const Icon = p.icon;
            const total = calcPrice(p.price);
            const isCurrent = organization?.plan === p.slug;
            return (
              <Card key={p.slug} className={`p-6 relative ${p.recommended ? 'border-primary ring-2 ring-primary/30' : ''}`}>
                {p.recommended && (
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
                  {p.highlights.map(h => (
                    <li key={h} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full mt-6"
                  variant={p.recommended ? 'default' : 'outline'}
                  disabled={isCurrent || loadingPlan === p.slug}
                  onClick={() => handleSubscribe(p.slug)}
                >
                  {loadingPlan === p.slug && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isCurrent ? 'Plano atual' : 'Assinar agora'}
                </Button>
              </Card>
            );
          })}
        </div>

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
