import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, Copy, ExternalLink, ShieldCheck, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { LivreOSLogo } from '@/components/brand/LivreOSLogo';

type Cycle = 'mensal' | 'semestral' | 'anual';
interface CheckoutDetails {
  status: string;
  organization_name: string;
  plan: { name: string; slug: string; monthly_price: number; max_users: number; features: unknown };
  cycle: Cycle;
}
interface Payment {
  invoice_id: string;
  status: string;
  invoice_url: string | null;
  bank_slip_url: string | null;
  barcode: string | null;
  pix_payload: string | null;
  pix_qr_image: string | null;
}

const CYCLES: { value: Cycle; label: string; months: number; discount: number; note: string }[] = [
  { value: 'mensal', label: 'Mensal', months: 1, discount: 0, note: 'Cobrança mensal' },
  { value: 'semestral', label: 'Semestral', months: 6, discount: 0.10, note: 'Economize 10%' },
  { value: 'anual', label: 'Anual', months: 12, discount: 0.20, note: 'Economize 20%' },
];

export default function CheckoutPublico() {
  const { token } = useParams<{ token: string }>();
  const [details, setDetails] = useState<CheckoutDetails | null>(null);
  const [cycle, setCycle] = useState<Cycle>('mensal');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const loadDetails = useCallback(async () => {
    if (!token) return;
    const { data, error: invokeError } = await supabase.functions.invoke('public-checkout', { body: { token, action: 'details' } });
    if (invokeError || !data?.plan) {
      setError(data?.error || invokeError?.message || 'Este checkout não está disponível.');
      return;
    }
    setDetails(data as CheckoutDetails);
    setCycle((data.cycle as Cycle) || 'mensal');
  }, [token]);

  useEffect(() => {
    loadDetails().finally(() => setLoading(false));
  }, [loadDetails]);

  useEffect(() => {
    if (!token || !payment || details?.status === 'paid') return;
    const timer = window.setInterval(async () => {
      const { data } = await supabase.functions.invoke('public-checkout', { body: { token, action: 'details' } });
      if (data?.status === 'paid') {
        setDetails((current) => current ? { ...current, status: 'paid' } : current);
        toast.success('Pagamento confirmado!');
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [token, payment, details?.status]);

  const selectedCycle = useMemo(() => CYCLES.find((item) => item.value === cycle) || CYCLES[0], [cycle]);
  const total = details ? Number((details.plan.monthly_price * selectedCycle.months * (1 - selectedCycle.discount)).toFixed(2)) : 0;

  const createPayment = async () => {
    if (!token || creating) return;
    setCreating(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('public-checkout', { body: { token, action: 'create_payment', cycle } });
      if (invokeError || data?.error) throw new Error(data?.error || invokeError?.message || 'Falha ao gerar cobrança');
      setPayment(data.payment as Payment);
      toast.success('Cobrança gerada. Escolha uma forma de pagamento.');
    } catch (exception) {
      toast.error(exception instanceof Error ? exception.message : 'Falha ao gerar cobrança');
    } finally {
      setCreating(false);
    }
  };

  const copyPix = async () => {
    if (!payment?.pix_payload) return;
    await navigator.clipboard.writeText(payment.pix_payload);
    toast.success('Código Pix copiado.');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (error || !details) return <div className="min-h-screen flex items-center justify-center p-4"><Card className="max-w-md w-full"><CardContent className="p-8 text-center space-y-4"><h1 className="text-xl font-bold">Checkout indisponível</h1><p className="text-muted-foreground">{error || 'Não foi possível carregar este link.'}</p><Button asChild variant="outline"><Link to="/landing"><ArrowLeft className="h-4 w-4 mr-2" />Voltar para o LivreOS</Link></Button></CardContent></Card></div>;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between"><LivreOSLogo size="sm" tone="onLight" /><Link to="/landing" className="text-sm text-muted-foreground hover:text-primary">Conheça o LivreOS</Link></div>
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <Card>
            <CardHeader><CardTitle>Ative o LivreOS para {details.organization_name}</CardTitle><p className="text-sm text-muted-foreground">Você já tem 7 dias de teste. Gere a cobrança quando estiver pronto para continuar.</p></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-3"><Badge>{details.plan.name}</Badge><span className="text-sm text-muted-foreground">Plano escolhido</span></div>
              <div className="grid md:grid-cols-3 gap-3">
                {CYCLES.map((item) => <button key={item.value} type="button" onClick={() => setCycle(item.value)} className={`text-left rounded-lg border p-4 transition-colors ${cycle === item.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50'}`}><div className="font-semibold">{item.label}</div><div className="text-sm text-muted-foreground">{item.note}</div></button>)}
              </div>
              <div className="rounded-lg bg-muted/50 p-5 flex items-end justify-between"><div><p className="text-sm text-muted-foreground">Total do ciclo</p><p className="text-3xl font-bold">R$ {total.toFixed(2).replace('.', ',')}</p></div><p className="text-sm text-muted-foreground">{selectedCycle.months} {selectedCycle.months === 1 ? 'mês' : 'meses'} de acesso</p></div>
              {!payment && <Button size="lg" className="w-full" onClick={createPayment} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}{creating ? 'Gerando cobrança...' : 'Gerar cobrança segura'}</Button>}
              {payment && <div className="space-y-4 border-t pt-5"><h2 className="font-semibold">Pagamento</h2><div className="grid sm:grid-cols-2 gap-4"><div className="rounded-lg border p-4 space-y-3"><p className="font-medium">Pix</p>{payment.pix_qr_image && <img src={`data:image/png;base64,${payment.pix_qr_image}`} alt="QR Code Pix" className="w-44 h-44 mx-auto" />}{payment.pix_payload && <Button variant="outline" className="w-full" onClick={copyPix}><Copy className="h-4 w-4 mr-2" />Copiar Pix copia e cola</Button>}</div><div className="rounded-lg border p-4 space-y-3"><p className="font-medium">Boleto ou cartão</p><p className="text-sm text-muted-foreground">Abra a página segura do Asaas para escolher a forma disponível.</p>{payment.invoice_url && <Button asChild className="w-full"><a href={payment.invoice_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Abrir pagamento</a></Button>}{payment.bank_slip_url && <Button asChild variant="outline" className="w-full"><a href={payment.bank_slip_url} target="_blank" rel="noreferrer">Abrir boleto</a></Button>}</div></div><p className="text-sm text-muted-foreground text-center">Aguardando confirmação automática do pagamento...</p></div>}
            </CardContent>
          </Card>
          <Card className="h-fit"><CardContent className="p-6 space-y-5"><ShieldCheck className="h-8 w-8 text-primary" /><h2 className="text-xl font-bold">Compra segura</h2><ul className="space-y-3 text-sm text-muted-foreground">{['7 dias grátis sem cartão', 'Pix, boleto e cartão conforme disponibilidade', 'Acesso liberado automaticamente após confirmação', 'Cancelamento no fim do ciclo pago'].map((item) => <li key={item} className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0" />{item}</li>)}</ul><p className="text-xs text-muted-foreground">O pagamento é processado pelo Asaas. O LivreOS não armazena dados de cartão.</p></CardContent></Card>
        </div>
      </div>
    </div>
  );
}
