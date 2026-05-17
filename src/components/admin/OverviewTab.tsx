import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, DollarSign, Users, AlertTriangle, LifeBuoy, TrendingUp } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Org { id: string; name: string; status: string; monthly_fee: number; is_vip: boolean; subscription_status: string; created_at: string; }
interface Invoice { valor: number; status: string; pago_em: string | null; vencimento: string; }

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (k: string) => {
  const [y, m] = k.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' });
};

export default function OverviewTab() {
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [openTickets, setOpenTickets] = useState(0);

  useEffect(() => {
    (async () => {
      const [o, i, t] = await Promise.all([
        supabase.from('organizations' as any).select('id,name,status,monthly_fee,is_vip,subscription_status,created_at'),
        supabase.from('tenant_invoices' as any).select('valor,status,pago_em,vencimento'),
        supabase.from('support_tickets' as any).select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
      ]);
      setOrgs((o.data as any) || []);
      setInvoices((i.data as any) || []);
      setOpenTickets(t.count || 0);
      setLoading(false);
    })();
  }, []);

  if (loading)
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  const mrr = orgs
    .filter((o) => (o.subscription_status === 'active' || o.status === 'active') && !o.is_vip)
    .reduce((s, o) => s + Number(o.monthly_fee || 0), 0);

  const total = orgs.length;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const newLast30 = orgs.filter((o) => new Date(o.created_at).getTime() >= thirtyDaysAgo).length;
  const churn = orgs.filter((o) =>
    ['past_due', 'canceled'].includes(o.subscription_status) || ['overdue', 'blocked', 'canceled'].includes(o.status)
  ).length;

  // Revenue trend (last 6 months) using paid invoices
  const months: string[] = [];
  const now = new Date();
  for (let k = 5; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    months.push(monthKey(d));
  }
  const revenueByMonth: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]));
  invoices.forEach((inv) => {
    if (inv.status !== 'pago' || !inv.pago_em) return;
    const k = monthKey(new Date(inv.pago_em));
    if (k in revenueByMonth) revenueByMonth[k] += Number(inv.valor || 0);
  });
  const revenueData = months.map((m) => ({ mes: monthLabel(m), valor: Number(revenueByMonth[m].toFixed(2)) }));

  const signupsByMonth: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]));
  orgs.forEach((o) => {
    const k = monthKey(new Date(o.created_at));
    if (k in signupsByMonth) signupsByMonth[k] += 1;
  });
  const signupsData = months.map((m) => ({ mes: monthLabel(m), novos: signupsByMonth[m] }));

  const kpis = [
    { label: 'MRR', value: `R$ ${mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, hint: 'Receita mensal recorrente' },
    { label: 'Total de Clientes', value: total, icon: Users, hint: `+${newLast30} nos últimos 30d` },
    { label: 'Inadimplência / Churn', value: churn, icon: AlertTriangle, hint: 'past_due ou cancelados' },
    { label: 'Tickets Abertos', value: openTickets, icon: LifeBuoy, hint: 'Pendentes de resposta' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{k.label}</p>
                  <p className="text-2xl font-bold mt-1">{k.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{k.hint}</p>
                </div>
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <k.icon className="h-4 w-4 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Receita (últimos 6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Novos cadastros por mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={signupsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="novos" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
