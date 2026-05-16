import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Loader2, Rocket } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  slug: string;
  monthly_price: number;
  max_users: number;
  features: any;
}

export default function CadastroEmpresa() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState({
    empresa: '', cnpj: '', nome: '', email: '', telefone: '', password: '', plan_slug: 'basic',
  });

  useEffect(() => {
    supabase.from('subscription_plans' as any).select('*').eq('active', true).order('monthly_price')
      .then(({ data }) => setPlans((data as any) || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error('Senha deve ter ao menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('signup-tenant', { body: form });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message);

      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: form.email, password: form.password,
      });
      if (signErr) throw signErr;

      toast.success('Empresa cadastrada! Configure os dados da sua empresa para começar.');
      navigate('/empresa');
    } catch (err: any) {
      toast.error(err.message || 'Erro no cadastro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid lg:grid-cols-[1fr_1.2fr] gap-6">
        <div className="hidden lg:flex flex-col justify-center space-y-4 p-6">
          <Rocket className="h-12 w-12 text-primary" />
          <h1 className="text-4xl font-bold">Comece em 1 minuto</h1>
          <p className="text-muted-foreground">
            Cadastre sua empresa, escolha um plano e tenha 7 dias grátis para testar tudo.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>✓ Sem cartão de crédito</li>
            <li>✓ Cancele quando quiser</li>
            <li>✓ Suporte humanizado</li>
          </ul>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cadastre sua empresa</CardTitle>
            <CardDescription>Preencha os dados abaixo para começar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label>Nome da empresa *</Label>
                  <Input required value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
                </div>
                <div>
                  <Label>Seu nome *</Label>
                  <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                </div>
                <div>
                  <Label>E-mail *</Label>
                  <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Senha *</Label>
                  <Input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>Escolha o plano</Label>
                <RadioGroup value={form.plan_slug} onValueChange={(v) => setForm({ ...form, plan_slug: v })} className="grid sm:grid-cols-3 gap-2 mt-2">
                  {plans.map((p) => (
                    <label key={p.id} className={`border rounded-lg p-3 cursor-pointer ${form.plan_slug === p.slug ? 'border-primary bg-primary/5' : ''}`}>
                      <RadioGroupItem value={p.slug} className="sr-only" />
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-2xl font-bold text-primary">R$ {Number(p.monthly_price).toFixed(0)}<span className="text-xs text-muted-foreground">/mês</span></div>
                      <div className="text-xs text-muted-foreground">{p.max_users} usuários</div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Começar teste grátis (7 dias)'}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Já tem conta? <Link to="/auth" className="text-primary underline">Entrar</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
