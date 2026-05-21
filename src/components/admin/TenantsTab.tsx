import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Crown, Loader2, MoreHorizontal, Search, Ban, CheckCircle2, Package, User, Key, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface Org {
  id: string; name: string; status: string; plan: string; plan_id: string | null;
  monthly_fee: number; next_due_date: string | null; is_vip: boolean; subscription_status: string;
}
interface Plan { id: string; name: string; monthly_price: number; }
interface UserProfile { id: string; email: string; nome: string; role: string; organization_id: string; }

type Filter = 'all' | 'active' | 'overdue' | 'vip' | 'canceled';
const PAGE_SIZE = 10;

export default function TenantsTab() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [planDialog, setPlanDialog] = useState<{ org: Org | null; planId: string }>({ org: null, planId: '' });
  
  // Cliente Detail state
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null);
  const [orgUsers, setOrgUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState<{ userId: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const fetchData = async () => {
    const [o, p] = await Promise.all([
      supabase.from('organizations' as any).select('id,name,status,plan,plan_id,monthly_fee,next_due_date,is_vip,subscription_status').order('created_at', { ascending: false }),
      supabase.from('subscription_plans' as any).select('id,name,monthly_price').eq('active', true),
    ]);
    setOrgs((o.data as any) || []);
    setPlans((p.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const fetchOrgUsers = async (orgId: string) => {
    setUsersLoading(true);
    const { data, error } = await supabase
      .from('profiles' as any)
      .select('id, email, nome, role, organization_id')
      .eq('organization_id', orgId);
    
    if (error) {
      toast.error('Erro ao buscar usuários: ' + error.message);
    } else {
      setOrgUsers((data as any) || []);
    }
    setUsersLoading(false);
  };

  const update = async (org: Org, patch: Record<string, unknown>, msg: string) => {
    setBusy(org.id);
    const { error } = await supabase.from('organizations' as any).update(patch).eq('id', org.id);
    setBusy(null);
    if (error) { toast.error(error.message); return false; }
    toast.success(msg);
    fetchData();
    return true;
  };

  const handleOrgClick = (org: Org) => {
    setSelectedOrg(org);
    fetchOrgUsers(org.id);
  };

  const handleResetPassword = async () => {
    if (!passwordDialog || !newPassword) return;
    
    // In a real app with Supabase Admin Auth, we'd use a service role in an edge function.
    // Since we are in the client, we'll suggest using the built-in Supabase reset if available 
    // or simulate/point out this needs administrative privileges.
    toast.info("A funcionalidade de reset de senha administrativa requer integração com Edge Functions.");
    setPasswordDialog(null);
    setNewPassword('');
  };

  const toggleVip = (org: Org) =>
    update(org, { is_vip: !org.is_vip }, !org.is_vip ? 'Liberação VIP ativada' : 'Liberação VIP removida');

  const toggleBlock = (org: Org) => {
    const block = org.status !== 'blocked';
    return update(
      org,
      {
        status: block ? 'blocked' : 'active',
        subscription_status: block ? 'canceled' : 'active',
        blocked_at: block ? new Date().toISOString() : null,
        blocked_reason: block ? 'Bloqueado manualmente pelo Super Admin' : null,
      },
      block ? 'Empresa bloqueada' : 'Empresa desbloqueada'
    );
  };

  const applyPlanChange = async () => {
    if (!planDialog.org || !planDialog.planId) return;
    const plan = plans.find((p) => p.id === planDialog.planId);
    if (!plan) return;
    const ok = await update(
      planDialog.org,
      { plan_id: plan.id, plan: plan.name, monthly_fee: plan.monthly_price },
      'Plano atualizado'
    );
    if (ok) setPlanDialog({ org: null, planId: '' });
  };

  const filtered = orgs.filter((o) => {
    if (search && !o.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'active') return (o.status === 'active' || o.subscription_status === 'active') && !o.is_vip;
    if (filter === 'overdue') return ['past_due', 'overdue'].includes(o.subscription_status) || ['overdue', 'past_due'].includes(o.status);
    if (filter === 'vip') return o.is_vip;
    if (filter === 'canceled') return o.subscription_status === 'canceled' || ['blocked', 'canceled'].includes(o.status);
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statusBadge = (o: Org) => {
    if (o.is_vip) return <Badge className="bg-vc-amber-light text-vc-amber-text border-vc-amber/20"><Crown className="h-3 w-3 mr-1" />VIP</Badge>;
    if (o.status === 'blocked') return <Badge variant="destructive">Bloqueado</Badge>;
    const map: Record<string, string> = {
      active: 'bg-vc-green-light text-vc-green-text border-vc-green/20',
      trial: 'bg-vc-blue-light text-vc-blue-text border-vc-blue/20',
      overdue: 'bg-vc-amber-light text-vc-amber-text border-vc-amber/20',
      past_due: 'bg-vc-amber-light text-vc-amber-text border-vc-amber/20',
      canceled: 'bg-muted text-muted-foreground border-border',
    };
    const s = o.subscription_status || o.status;
    return <Badge className={map[s] || ''}>{s}</Badge>;
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Gerenciamento de Clientes</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-3 text-muted-foreground" />
              <Input className="pl-8 sm:w-56" placeholder="Buscar oficina..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <Select value={filter} onValueChange={(v) => { setFilter(v as Filter); setPage(1); }}>
              <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="overdue">Inadimplentes</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
                <SelectItem value="canceled">Cancelados/Bloqueados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Oficina</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mensalidade</TableHead>
                  <TableHead>Próx. venc.</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma oficina encontrada</TableCell></TableRow>
                )}
                {pageItems.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50 group" onClick={() => handleOrgClick(o)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {o.name}
                        <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                      </div>
                    </TableCell>
                    <TableCell>{o.plan || '—'}</TableCell>
                    <TableCell>{statusBadge(o)}</TableCell>
                    <TableCell className={o.is_vip ? 'line-through text-muted-foreground' : ''}>
                      R$ {Number(o.monthly_fee || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>{o.next_due_date ? new Date(o.next_due_date).toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={o.is_vip}
                            disabled={busy === o.id}
                            onCheckedChange={() => toggleVip(o)}
                            aria-label="VIP"
                          />
                          <Label className="text-xs text-muted-foreground hidden sm:inline">VIP</Label>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={busy === o.id}>
                              {busy === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setPlanDialog({ org: o, planId: o.plan_id || '' })}>
                              <Package className="h-4 w-4 mr-2" />Alterar plano
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {o.status === 'blocked' ? (
                              <DropdownMenuItem onClick={() => toggleBlock(o)}>
                                <CheckCircle2 className="h-4 w-4 mr-2" />Desbloquear acesso
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem className="text-destructive" onClick={() => toggleBlock(o)}>
                                <Ban className="h-4 w-4 mr-2" />Suspender/Bloquear
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">{filtered.length} resultado(s)</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <span className="text-sm">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Org Detail Dialog */}
      <Dialog open={!!selectedOrg} onOpenChange={(o) => !o && setSelectedOrg(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Empresa: {selectedOrg?.name}</DialogTitle>
            <DialogDescription>
              Visualize informações e gerencie usuários vinculados a esta conta.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-muted-foreground mb-1 text-xs">Status Financeiro</p>
                <div className="font-medium flex items-center gap-2">
                  {selectedOrg && statusBadge(selectedOrg)}
                  {selectedOrg?.is_vip && <span className="text-[10px] text-amber-500 font-bold uppercase">(VIP ATIVO)</span>}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-muted-foreground mb-1 text-xs">Plano Atual</p>
                <div className="font-medium">{selectedOrg?.plan || 'Não definido'}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" /> Usuários Vinculados
                </h3>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersLoading ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-4"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></TableCell></TableRow>
                    ) : orgUsers.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Nenhum usuário encontrado</TableCell></TableRow>
                    ) : orgUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="text-xs font-medium">{u.nome || '—'}</TableCell>
                        <TableCell className="text-xs">{u.email}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] uppercase">{u.role}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setPasswordDialog({ userId: u.id, email: u.email })}>
                            <Key className="h-3 w-3 mr-1" /> Reset
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrg(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={!!passwordDialog} onOpenChange={(o) => !o && setPasswordDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetar Senha Administrativa</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para o usuário <strong>{passwordDialog?.email}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Label htmlFor="new-password">Nova Senha</Label>
            <Input 
              id="new-password" 
              type="password" 
              placeholder="Digite a nova senha" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialog(null)}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={!newPassword}>Confirmar Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!planDialog.org} onOpenChange={(o) => !o && setPlanDialog({ org: null, planId: '' })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar plano — {planDialog.org?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Novo plano</Label>
            <Select value={planDialog.planId} onValueChange={(v) => setPlanDialog((s) => ({ ...s, planId: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — R$ {Number(p.monthly_price).toFixed(2)}/mês</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialog({ org: null, planId: '' })}>Cancelar</Button>
            <Button onClick={applyPlanChange} disabled={!planDialog.planId || busy === planDialog.org?.id}>
              {busy === planDialog.org?.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}