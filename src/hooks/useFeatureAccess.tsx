import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from './useOrganization';

export type FeatureKey =
  | 'os' | 'clientes' | 'estoque'
  | 'orcamentos' | 'financeiro' | 'cobrancas_asaas'
  | 'rotas' | 'mercado_livre' | 'whatsapp_templates'
  | 'whitelabel' | 'api_rest' | 'suporte_prioritario';

export function useFeatureAccess() {
  const { organization, isPlatformAdmin, loading: orgLoading } = useOrganization();
  const [features, setFeatures] = useState<FeatureKey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orgLoading) return;
    if (isPlatformAdmin) {
      // Super Admin tem tudo
      setFeatures([
        'os','clientes','estoque','orcamentos','financeiro','cobrancas_asaas',
        'rotas','mercado_livre','whatsapp_templates','whitelabel','api_rest','suporte_prioritario'
      ]);
      setLoading(false);
      return;
    }
    if (!organization) { setFeatures([]); setLoading(false); return; }

    (async () => {
      const planSlug = ['bronze','prata','ouro'].includes(organization.plan)
        ? organization.plan
        : 'bronze';
      const { data } = await supabase
        .from('subscription_plans' as any)
        .select('features')
        .eq('slug', planSlug)
        .maybeSingle();
      setFeatures(((data as any)?.features as FeatureKey[]) || []);
      setLoading(false);
    })();
  }, [organization, isPlatformAdmin, orgLoading]);

  const has = (key: FeatureKey) => features.includes(key);
  return { features, has, loading };
}
