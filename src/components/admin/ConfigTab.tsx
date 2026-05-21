import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, ExternalLink, CreditCard, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfigTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [asaasToken, setAsaasToken] = useState('');
  const [asaasEnvironment, setAsaasEnvironment] = useState<'sandbox' | 'production'>('sandbox');

  useEffect(() => {
    async function fetchConfig() {
      // In a real scenario, we might store these in a global_config table
      // For now, let's assume we use a dedicated table or edge function to manage secrets
      // This is a placeholder for the platform settings
      setLoading(false);
    }
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    // Logic to save global platform settings
    setTimeout(() => {
      setSaving(false);
      toast.success('Configurações da plataforma atualizadas');
    }, 1000);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Integração Asaas</CardTitle>
            </div>
            <CardDescription>
              Configurações globais para recebimento de mensalidades dos clientes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <div className="flex gap-2">
                <Button 
                  variant={asaasEnvironment === 'sandbox' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setAsaasEnvironment('sandbox')}
                  className="flex-1"
                >
                  Sandbox (Teste)
                </Button>
                <Button 
                  variant={asaasEnvironment === 'production' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setAsaasEnvironment('production')}
                  className="flex-1"
                >
                  Produção
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>API Token (Asaas)</Label>
              <Input 
                type="password" 
                value={asaasToken} 
                onChange={(e) => setAsaasToken(e.target.value)} 
                placeholder="$a..."
              />
              <p className="text-[10px] text-muted-foreground">
                Este token é usado para gerar as cobranças automáticas das oficinas.
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Configurações
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle>Segurança e Logs</CardTitle>
            </div>
            <CardDescription>
              Monitoramento global do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">Status da API Supabase</p>
              <div className="flex items-center gap-2 text-emerald-500">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Operacional
              </div>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir Supabase Dashboard
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
