import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Users, FileText, Power } from 'lucide-react';
import { toast } from 'sonner';

interface Plan {
  id: string; name: string; slug: string;
  monthly_price: number; yearly_price: number; billing_cycle: string;
  max_users: number; max_os_per_month: number;
  features: unknown; active: boolean;
}
const empty: Partial<Plan> = {
  name: '', slug: '', monthly_price: 0, yearly_price: 0, billing_cycle: 'monthly',
  max_users: 3, max_os_per_month: 100, features: [], active: true,
};

export default function PlansTab() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Plan>>(empty);

  const fetchData = async () => {
    const { data } = await supabase.from('subscription_plans' as any).select('*').order('monthly_price', { ascending: true });
    setPlans((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (p: Plan) => { setForm(p); setOpen(true); };

  const save = async () => {
    if (!form.name?.trim()) return toast.error('Informe o nome do plano');
    if (!form.slug?.trim()) return toast.error('Informe o slug');
    if (Number(form.monthly_price) < 0) return toast.error('Valor mensal inválido');

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      monthly_price: Number(form.monthly_price || 0),
      yearly_price: Number(form.yearly_price || 0),
      billing_cycle: form.billing_cycle || 'monthly',
      max_users: Number(form.max_users || 0),
      max_os_per_month: Number(form.max_os_per_month || 0),
      active: form.active ?? true,
    };
    const q = form.id
      ? supabase.from('subscription_plans' as any).update(payload).eq('id', form.id)
      : supabase.from('subscription_plans' as any).insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Plano salvo');
    setOpen(false);
    fetchData();
  };

  const toggleActive = async (p: Plan) => {
    const { error } = await supabase.from('subscription_plans' as any).update({ active: !p.active }).eq('id', p.id);
    if (error) toast.error(error.message);
    else { toast.success(p.active ? 'Plano desativado' : 'Plano ativado'); fetchData(); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Planos e Preços</h2>
          <p className="text-sm text-muted-foreground">Configure os planos disponíveis para suas oficinas</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo plano</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((p) => (
          <Card key={p.id} className={p.active ? '' : 'opacity-60'}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{p.name}</CardTitle>
                {p.active ? <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{p.slug}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-3xl font-bold">R$ {Number(p.monthly_price).toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/mês</span></div>
                {Number(p.yearly_price) > 0 && (
                  <div className="text-sm text-muted-foreground">R$ {Number(p.yearly_price).toFixed(2)}/ano</div>
                )}
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-muted-foreground" />{p.max_users} usuários</div>
                <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground" />{p.max_os_per_month} OS/mês</div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5 mr-1" />Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(p)}><Power className="h-3.5 w-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? 'Editar plano' : 'Novo plano'}</DialogTitle><DialogDescription className="sr-only">Formulário de plano</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Slug *</Label>
              <Input value={form.slug || ''} onChange={(e) => setForm({ ...form, slug: e.target.value })} maxLength={40} placeholder="ex: pro" />
            </div>
            <div className="space-y-1.5">
              <Label>Valor mensal (R$)</Label>
              <Input type="number" step="0.01" min="0" value={form.monthly_price ?? 0} onChange={(e) => setForm({ ...form, monthly_price: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor anual (R$)</Label>
              <Input type="number" step="0.01" min="0" value={form.yearly_price ?? 0} onChange={(e) => setForm({ ...form, yearly_price: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Máx. usuários</Label>
              <Input type="number" min="1" value={form.max_users ?? 0} onChange={(e) => setForm({ ...form, max_users: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Máx. OS/mês</Label>
              <Input type="number" min="0" value={form.max_os_per_month ?? 0} onChange={(e) => setForm({ ...form, max_os_per_month: Number(e.target.value) })} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch checked={form.active ?? true} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label>Plano ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
