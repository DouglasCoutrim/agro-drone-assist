import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ExternalLink, RefreshCw, Search, Receipt, CircleDollarSign, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/formatters';

interface Invoice {
  id: string;
  organization_id: string;
  competencia: string;
  valor: number;
  vencimento: string;
  status: string;
  payment_url: string | null;
  asaas_charge_id: string | null;
  pago_em: string | null;
}

interface Organization {
  id: string;
  name: string;
  plan: string | null;
  status: string;
}

type InvoiceFilter = 'all' | 'pendente' | 'vencido' | 'pago';

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function RecebimentosTab() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [invoiceResult, orgResult] = await Promise.all([
      supabase.from('tenant_invoices')
        .select('id,organization_id,competencia,valor,vencimento,status,payment_url,asaas_charge_id,pago_em')
        .order('vencimento', { ascending: false }),
      supabase.from('organizations').select('id,name,plan,status').order('name'),
    ]);
    if (invoiceResult.error || orgResult.error) {
      toast.error(invoiceResult.error?.message || orgResult.error?.message || 'Não foi possível carregar os recebimentos.');
    }
    setInvoices((invoiceResult.data as Invoice[]) || []);
    setOrganizations((orgResult.data as Organization[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const orgById = useMemo(() => new Map(organizations.map((org) => [org.id, org])), [organizations]);
  const filtered = invoices.filter((invoice) => {
    const org = orgById.get(invoice.organization_id);
    const normalizedSearch = search.trim().toLowerCase();
    const matchesSearch = !normalizedSearch
      || org?.name.toLowerCase().includes(normalizedSearch)
      || invoice.competencia.toLowerCase().includes(normalizedSearch);
    return matchesSearch && (filter === 'all' || invoice.status === filter);
  });

  const totals = invoices.reduce((acc, invoice) => {
    if (invoice.status === 'pago') acc.paid += Number(invoice.valor || 0);
    if (invoice.status === 'pendente') acc.pending += Number(invoice.valor || 0);
    if (invoice.status === 'vencido') acc.overdue += Number(invoice.valor || 0);
    return acc;
  }, { paid: 0, pending: 0, overdue: 0 });

  const statusBadge = (status: string) => {
    if (status === 'pago') return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20">Pago</Badge>;
    if (status === 'vencido') return <Badge variant="destructive">Vencido</Badge>;
    return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/20">Pendente</Badge>;
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase">Recebido</p><p className="text-2xl font-bold mt-1">{money(totals.paid)}</p></div><CircleDollarSign className="h-5 w-5 text-emerald-500" /></div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase">A receber</p><p className="text-2xl font-bold mt-1">{money(totals.pending)}</p></div><Receipt className="h-5 w-5 text-primary" /></div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase">Em atraso</p><p className="text-2xl font-bold mt-1">{money(totals.overdue)}</p></div><AlertTriangle className="h-5 w-5 text-destructive" /></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>Recebimentos dos tenants</CardTitle><p className="text-sm text-muted-foreground mt-1">Acompanhe faturas, vencimentos e cobranças geradas no Asaas.</p></div>
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1"><Search className="h-4 w-4 absolute left-2.5 top-3 text-muted-foreground" /><Input className="pl-8" placeholder="Buscar tenant ou competência" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            <Select value={filter} onValueChange={(value) => setFilter(value as InvoiceFilter)}><SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="pendente">Pendentes</SelectItem><SelectItem value="vencido">Vencidas</SelectItem><SelectItem value="pago">Pagas</SelectItem></SelectContent></Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-3 pr-3">Tenant</th><th className="py-3 pr-3">Competência</th><th className="py-3 pr-3">Vencimento</th><th className="py-3 pr-3">Valor</th><th className="py-3 pr-3">Status</th><th className="py-3 text-right">Ação</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Nenhuma cobrança encontrada.</td></tr> : filtered.map((invoice) => {
                  const org = orgById.get(invoice.organization_id);
                  return <tr key={invoice.id} className="border-b last:border-0">
                    <td className="py-3 pr-3"><div className="font-medium">{org?.name || 'Tenant não encontrado'}</div><div className="text-xs text-muted-foreground">{org?.plan || 'Sem plano'}</div></td>
                    <td className="py-3 pr-3">{invoice.competencia}</td><td className="py-3 pr-3">{formatDate(invoice.vencimento)}</td><td className="py-3 pr-3 font-medium">{money(Number(invoice.valor || 0))}</td><td className="py-3 pr-3">{statusBadge(invoice.status)}</td>
                    <td className="py-3 text-right">{invoice.payment_url ? <Button asChild size="sm" variant="outline"><a href={invoice.payment_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1" />Cobrança</a></Button> : <span className="text-xs text-muted-foreground">Sem link</span>}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
