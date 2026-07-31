import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, ExternalLink, CreditCard, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface PlatformConfig {
  asaas_api_key?: string;
  asaas_environment?: 'sandbox' | 'production';
}

const DEFAULT_CONFIG: PlatformConfig = { asaas_environment: 'production' };

const normalizeConfig = (value: unknown): PlatformConfig => {
  if (!value) return { ...DEFAULT_CONFIG };
  if (typeof value === 'string') {
    try {
      return normalizeConfig(JSON.parse(value));
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }
  if (typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_CONFIG };
  return { ...DEFAULT_CONFIG, ...(value as Record<string, string>) };
};

export default function ConfigTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const { data, error } = await supabase
          .from('platform_config' as any)
          .select('value')
          .eq('key', 'asaas')
          .maybeSingle();
        if (error) throw error;
        if (data) setConfig(normalizeConfig((data as any).value));
      } catch (e: any) {
        toast.error(e.message ?? 'Falha ao carregar configurações');
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('platform_config' as any)
        .upsert({
          key: 'asaas',
          value: {
            asaas_api_key: config.asaas_api_key?.trim() || '',
            asaas_environment: config.asaas_environment,
          },
          description: 'Credenciais Asaas da plataforma (mensalidades dos clientes)',
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      toast.success('Configurações da plataforma atualizadas');
    } catch (e: any) {
      toast.error(e.message ?? 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
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
                  variant={config.asaas_environment === 'sandbox' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setConfig({ ...config, asaas_environment: 'sandbox' })}
                  className="flex-1"
                >
                  Sandbox (Teste)
                </Button>
                <Button 
                  variant={config.asaas_environment === 'production' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setConfig({ ...config, asaas_environment: 'production' })}
                  className="flex-1"
                >
                  Produção
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>API Token (Asaas)</Label>
              <div className="relative">
                <Input 
                  type={showToken ? 'text' : 'password'} 
                  value={config.asaas_api_key || ''} 
                  onChange={(e) => setConfig({ ...config, asaas_api_key: e.target.value })} 
                  placeholder="$a..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
