import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, ShieldCheck, Ban, CheckCircle2, LogOut, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminMaster() {
  const { signOut, loading: authLoading } = useAuth();
  const { isPlatformAdmin, loading } = useOrganization();
  const [orgs, setOrgs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchData = async () => {
    const [{ data: o }, { data: inv }] = await Promise.all([
      supabase.from('organizations' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('tenant_invoices' as any).select('*').order('vencimento', { ascending: false }).limit(50),
    ]);
    setOrgs(o || []);
    setInvoices(inv || []);
  };

  useEffect(() => { if (isPlatformAdmin) fetchData(); }, [isPlatformAdmin]);

  if (loading || authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!isPlatformAdmin) return <Navigate to="/" replace />;

  const toggleBlock = async (org: any) => {
    setBusy(true);
    const block = org.status !== 'blocked';
    const { error } = await supabase.from('organizations' as any).update({
      status: block ? 'blocked' : 'active',
      blocked_at: block ? new Date().toISOString() : null,
      blocked_reason: block ? 'Bloqueado manualmente pelo Super Admin' : null,
    }).eq('id', org.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(block ? 'Empresa bloqueada' : 'Empresa desbloqueada'); fetchData(); }
  };

  const generateMonthly = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('generate-monthly-invoices');
    setBusy(false);
    if (error || !(data as any)?.ok) toast.error((data as any)?.error || error?.message || 'Erro');
    else { toast.success(`${(data as any).created} faturas criadas (${(data as any).skipped} já existiam)`); fetchData(); }
  };

  const checkOverdue = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('check-overdue-tenants');
    setBusy(false);
    if (error || !(data as any)?.ok) toast.error((data as any)?.error || error?.message || 'Erro');
    else { toast.success(`${(data as any).blocked} tenants bloqueados`); fetchData(); }
  };

  const stats = {
    total: orgs.length,
    active: orgs.filter((o) => o.status === 'active').length,
    trial: orgs.filter((o) => o.status === 'trial').length,
    blocked: orgs.filter((o) => o.status === 'blocked').length,
    mrr: orgs.filter((o) => o.status === 'active').reduce((s, o) => s + Number(o.monthly_fee || 0), 0),
  };

  const filtered = orgs.filter((o) => !search || o.name.toLowerCase().includes(search.toLowerCase()));

  const statusColor: Record<string, string> = {
    active: 'bg-green-500/20 text-green-500', trial: 'bg-blue-500/20 text-blue-500',
    overdue: 'bg-amber-500/20 text-amber-500', blocked: 'bg-destructive/20 text-destructive',
    canceled: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Super Admin</h1>
              <p className="text-sm text-muted-foreground">Painel da plataforma</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-2" />Sair</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'MRR', value: `R$ ${stats.mrr.toFixed(0)}` },
            { label: 'Total', value: stats.total },
            { label: 'Ativos', value: stats.active },
            { label: 'Trial', value: stats.trial },
            { label: 'Bloqueados', value: stats.blocked },
          ].map((s) => (
            <Card key={s.label}><CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent></Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Empresas Clientes</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input className="pl-8 w-48" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Button size="sm" onClick={generateMonthly} disabled={busy}>Gerar mensalidades</Button>
              <Button size="sm" variant="outline" onClick={checkOverdue} disabled={busy}>Verificar atrasos</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Empresa</TableHead><TableHead>Plano</TableHead><TableHead>Status</TableHead>
                  <TableHead>Mensalidade</TableHead><TableHead>Próx. venc.</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.name}</TableCell>
                      <TableCell>{o.plan}</TableCell>
                      <TableCell><Badge className={statusColor[o.status] || ''}>{o.status}</Badge></TableCell>
                      <TableCell>R$ {Number(o.monthly_fee).toFixed(2)}</TableCell>
                      <TableCell>{o.next_due_date ? new Date(o.next_due_date).toLocaleDateString('pt-BR') : '—'}</TableCell>
                      <TableCell>
                        <Button size="sm" variant={o.status === 'blocked' ? 'default' : 'destructive'}
                          onClick={() => toggleBlock(o)} disabled={busy}>
                          {o.status === 'blocked' ? <><CheckCircle2 className="h-3 w-3 mr-1" />Desbloquear</> : <><Ban className="h-3 w-3 mr-1" />Bloquear</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Faturas recentes</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Empresa</TableHead><TableHead>Competência</TableHead>
                <TableHead>Valor</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {invoices.map((i) => {
                  const org = orgs.find((o) => o.id === i.organization_id);
                  return (
                    <TableRow key={i.id}>
                      <TableCell>{org?.name || '—'}</TableCell>
                      <TableCell>{i.competencia}</TableCell>
                      <TableCell>R$ {Number(i.valor).toFixed(2)}</TableCell>
                      <TableCell>{new Date(i.vencimento).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell><Badge variant={i.status === 'pago' ? 'default' : 'secondary'}>{i.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
