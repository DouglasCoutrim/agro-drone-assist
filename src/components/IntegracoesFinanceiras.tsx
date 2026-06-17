import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import { ExternalLink, Eye, EyeOff, Loader2, ShieldCheck, KeyRound } from 'lucide-react';

type Gateway = 'none' | 'asaas' | 'mercadopago' | 'pix_manual';
type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

interface Credentials {
  api_key?: string;
  asaas_environment?: 'sandbox' | 'production';
  token?: string;
  mp_public_key?: string;
  pix_key_type?: PixKeyType;
  pix_key_value?: string;
  pix_receiver_name?: string;
}

const DEFAULT_CREDS: Credentials = { asaas_environment: 'production', pix_key_type: 'cpf' };

const normalizeStoredCredentials = (value: unknown): Credentials => {
  if (!value) return { ...DEFAULT_CREDS };

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normalizeStoredCredentials(parsed);
    } catch {
      return { ...DEFAULT_CREDS };
    }
  }

  if (typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_CREDS };

  return { ...DEFAULT_CREDS, ...(value as Record<string, string>) };
};

const buildJsonbCredentials = (gateway: Gateway, credentials: Credentials): Record<string, string> => {
  if (gateway === 'none') return {};

  return Object.entries(credentials).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) acc[key] = trimmed;
    }
    return acc;
  }, {});
};

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pr-10" />
      <button type="button" onClick={() => setShow(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function IntegracoesFinanceiras() {
  const { organization } = useOrganization();
  const [gateway, setGateway] = useState<Gateway>('none');
  const [creds, setCreds] = useState<Credentials>(DEFAULT_CREDS);
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
        setGateway(((data as any).gateway_clientes as Gateway) || 'none');
        setCreds(normalizeStoredCredentials((data as any).gateway_clientes_credentials));
      }
      setLoading(false);
    })();
  }, [organization]);

  const update = (patch: Partial<Credentials>) => setCreds(prev => ({ ...prev, ...patch }));

  const validate = (): string | null => {
    if (gateway === 'asaas' && !creds.api_key) return 'Informe a API Key do Asaas';
    if (gateway === 'mercadopago' && !creds.token) return 'Informe o Access Token do Mercado Pago';
    if (gateway === 'pix_manual') {
      if (!creds.pix_key_value?.trim()) return 'Informe a chave PIX';
      if (!creds.pix_receiver_name?.trim()) return 'Informe o nome do titular';
    }
    return null;
  };

  const handleSave = async () => {
    if (!organization) return;
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const cleanCreds = buildJsonbCredentials(gateway, creds);

      const payload = {
        gateway_clientes: gateway,
        gateway_clientes_credentials: cleanCreds,
        updated_at: new Date().toISOString(),
      };

      const { data: existing, error: lookupError } = await supabase
        .from('empresa_config' as any)
        .select('id')
        .eq('organization_id', organization.id)
        .maybeSingle();
      if (lookupError) throw lookupError;
      const existingConfig = existing as unknown as { id: string } | null;

      const query = existingConfig?.id
        ? supabase
            .from('empresa_config' as any)
            .update(payload)
            .eq('organization_id', organization.id)
        : supabase
            .from('empresa_config' as any)
            .insert({ ...payload, organization_id: organization.id });

      const { error } = await query;
      if (error) throw error;
      toast.success('Configurações de recebimento salvas com sucesso');
    } catch (e: any) {
      toast.error(e.message ?? 'Falha ao salvar');
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    const credential = gateway === 'asaas' ? creds.api_key : creds.token;
    if (!credential) { toast.error('Informe a credencial primeiro'); return; }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-tenant-gateway', {
        body: { gateway, credential, environment: creds.asaas_environment },
      });
      if (error) throw error;
      if ((data as any)?.ok) toast.success('Credenciais válidas ✓');
      else toast.error((data as any)?.message ?? 'Credenciais inválidas');
    } catch (e: any) {
      toast.error(e.message ?? 'Falha no teste');
    } finally { setTesting(false); }
  };

  if (loading) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const optionCard = (id: Gateway, title: string, desc: string) => (
    <label className={`border rounded-lg p-4 cursor-pointer transition ${gateway === id ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/50'}`}>
      <div className="flex items-center gap-2 mb-1">
        <RadioGroupItem value={id} id={id} />
        <span className="font-semibold">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </label>
  );

  return (
    <Card className="p-6 space-y-5">
      <div>
        <h3 className="text-xl font-bold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Configurações de Recebimento</h3>
        <p className="text-sm text-muted-foreground">Escolha como sua oficina vai receber os pagamentos dos clientes finais.</p>
      </div>

      <RadioGroup value={gateway} onValueChange={(v) => setGateway(v as Gateway)} className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
        {optionCard('asaas', 'Asaas', 'PIX, Boleto e Cartão automáticos')}
        {optionCard('mercadopago', 'Mercado Pago', 'Checkout com PIX e Boleto')}
        {optionCard('pix_manual', 'Apenas Chave PIX', 'Exibe sua chave para o cliente pagar')}
        {optionCard('none', 'Desativado', 'Sem cobrança automática')}
      </RadioGroup>

      {gateway === 'asaas' && (
        <div className="space-y-3 border-l-2 border-primary/30 pl-4">
          <div className="space-y-2">
            <Label>Ambiente</Label>
            <Select value={creds.asaas_environment ?? 'production'} onValueChange={(v) => update({ asaas_environment: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Homologação (Sandbox)</SelectItem>
                <SelectItem value="production">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Chave de API (Access Token)</Label>
            <SecretInput value={creds.api_key ?? ''} onChange={(v) => update({ api_key: v })} placeholder="$aas_..." />
            <a href="https://docs.asaas.com/" target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Onde encontrar minha chave (docs.asaas.com)
            </a>
          </div>
        </div>
      )}

      {gateway === 'mercadopago' && (
        <div className="space-y-3 border-l-2 border-primary/30 pl-4">
          <div className="space-y-2">
            <Label>Access Token</Label>
            <SecretInput value={creds.token ?? ''} onChange={(v) => update({ token: v })} placeholder="APP_USR-..." />
          </div>
          <div className="space-y-2">
            <Label>Public Key</Label>
            <SecretInput value={creds.mp_public_key ?? ''} onChange={(v) => update({ mp_public_key: v })} placeholder="APP_USR-..." />
            <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Painel de Desenvolvedor do Mercado Pago
            </a>
          </div>
        </div>
      )}

      {gateway === 'pix_manual' && (
        <div className="space-y-3 border-l-2 border-primary/30 pl-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo de Chave</Label>
              <Select value={creds.pix_key_type ?? 'cpf'} onValueChange={(v) => update({ pix_key_type: v as PixKeyType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="telefone">Celular</SelectItem>
                  <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor da Chave</Label>
              <Input value={creds.pix_key_value ?? ''} onChange={(e) => update({ pix_key_value: e.target.value })} placeholder="Sua chave PIX" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nome do Titular</Label>
            <Input value={creds.pix_receiver_name ?? ''} onChange={(e) => update({ pix_receiver_name: e.target.value })} placeholder="Nome que aparece no recibo do PIX" />
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <KeyRound className="h-3 w-3" /> O cliente verá esses dados e poderá copiar a chave para pagar.
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar Configurações
        </Button>
        {(gateway === 'asaas' || gateway === 'mercadopago') && (
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Testar credenciais
          </Button>
        )}
      </div>
    </Card>
  );
}
