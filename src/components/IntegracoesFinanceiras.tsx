import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import { ExternalLink, Loader2, ShieldCheck } from 'lucide-react';

const ASAAS_AFFILIATE_URL = 'https://www.asaas.com/r/SEU_CODIGO_AFILIADO';
const MP_AFFILIATE_URL = 'https://www.mercadopago.com.br/?ref=SEU_CODIGO_AFILIADO';

export function IntegracoesFinanceiras() {
  const { organization } = useOrganization();
  const [gateway, setGateway] = useState<'none' | 'asaas' | 'mercadopago'>('none');
  const [credential, setCredential] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organization) return;
    (async () => {
      const { data } = await supabase
        .from('empresa_config' as any)
        .select('gateway_clientes, gateway_clientes_credentials')
        .eq('organization_id', organization.id)
        .maybeSingle();
      if (data) {
        setGateway(((data as any).gateway_clientes as any) || 'none');
        const creds = (data as any).gateway_clientes_credentials || {};
        setCredential(creds.token || creds.api_key || '');
      }
      setLoading(false);
    })();
  }, [organization]);

  const handleSave = async () => {
    if (!organization) return;
    setSaving(true);
    try {
      const credPayload = gateway === 'asaas' ? { api_key: credential } : gateway === 'mercadopago' ? { token: credential } : {};
      const { error } = await supabase
        .from('empresa_config' as any)
        .update({ gateway_clientes: gateway, gateway_clientes_credentials: credPayload })
        .eq('organization_id', organization.id);
      if (error) throw error;
      toast.success('Integração salva');
    } catch (e: any) {
      toast.error(e.message ?? 'Falha ao salvar');
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    if (!credential) { toast.error('Informe a credencial primeiro'); return; }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-tenant-gateway', {
        body: { gateway, credential },
      });
      if (error) throw error;
      if ((data as any)?.ok) toast.success('Credenciais válidas ✓');
      else toast.error((data as any)?.message ?? 'Credenciais inválidas');
    } catch (e: any) {
      toast.error(e.message ?? 'Falha no teste');
    } finally { setTesting(false); }
  };

  if (loading) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <Card className="p-6 space-y-5">
      <div>
        <h3 className="text-xl font-bold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Integrações Financeiras</h3>
        <p className="text-sm text-muted-foreground">
          Configure como você quer cobrar seus clientes. O dinheiro cai direto na sua conta.
        </p>
      </div>

      <RadioGroup value={gateway} onValueChange={(v) => setGateway(v as any)} className="grid md:grid-cols-3 gap-3">
        <label className={`border rounded-lg p-4 cursor-pointer ${gateway === 'asaas' ? 'border-primary ring-2 ring-primary/30' : ''}`}>
          <div className="flex items-center gap-2 mb-1">
            <RadioGroupItem value="asaas" id="asaas" />
            <span className="font-semibold">Asaas</span>
          </div>
          <p className="text-xs text-muted-foreground">PIX, Boleto e Cartão. Ideal para recorrência.</p>
        </label>
        <label className={`border rounded-lg p-4 cursor-pointer ${gateway === 'mercadopago' ? 'border-primary ring-2 ring-primary/30' : ''}`}>
          <div className="flex items-center gap-2 mb-1">
            <RadioGroupItem value="mercadopago" id="mp" />
            <span className="font-semibold">Mercado Pago</span>
          </div>
          <p className="text-xs text-muted-foreground">PIX, Boleto, Cartão e link de pagamento.</p>
        </label>
        <label className={`border rounded-lg p-4 cursor-pointer ${gateway === 'none' ? 'border-primary ring-2 ring-primary/30' : ''}`}>
          <div className="flex items-center gap-2 mb-1">
            <RadioGroupItem value="none" id="none" />
            <span className="font-semibold">Ainda não tenho conta</span>
          </div>
          <p className="text-xs text-muted-foreground">Crie uma agora pelos links abaixo.</p>
        </label>
      </RadioGroup>

      {gateway === 'asaas' && (
        <div className="space-y-2">
          <Label>API Key do Asaas</Label>
          <Input type="password" value={credential} onChange={e => setCredential(e.target.value)} placeholder="$aas_..." />
          <p className="text-xs text-muted-foreground">Encontre em: app.asaas.com → Configurações → Integrações → Gerar nova chave</p>
        </div>
      )}
      {gateway === 'mercadopago' && (
        <div className="space-y-2">
          <Label>Access Token do Mercado Pago</Label>
          <Input type="password" value={credential} onChange={e => setCredential(e.target.value)} placeholder="APP_USR-..." />
          <p className="text-xs text-muted-foreground">Encontre em: mercadopago.com → Seu negócio → Configurações → Credenciais de produção</p>
        </div>
      )}

      {gateway === 'none' && (
        <div className="grid md:grid-cols-2 gap-3">
          <a href={ASAAS_AFFILIATE_URL} target="_blank" rel="noreferrer">
            <Card className="p-4 hover:border-primary transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold">Criar conta no Asaas</h4>
                  <p className="text-xs text-muted-foreground">Grátis · Aprovação rápida</p>
                </div>
                <ExternalLink className="h-4 w-4" />
              </div>
            </Card>
          </a>
          <a href={MP_AFFILIATE_URL} target="_blank" rel="noreferrer">
            <Card className="p-4 hover:border-primary transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold">Criar conta no Mercado Pago</h4>
                  <p className="text-xs text-muted-foreground">Sem mensalidade</p>
                </div>
                <ExternalLink className="h-4 w-4" />
              </div>
            </Card>
          </a>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
        </Button>
        {gateway !== 'none' && (
          <Button variant="outline" onClick={handleTest} disabled={testing || !credential}>
            {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Testar credenciais
          </Button>
        )}
      </div>
    </Card>
  );
}
