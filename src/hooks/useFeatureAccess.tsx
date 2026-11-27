import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrganization } from './useOrganization';

export type FeatureKey =
  | 'os' | 'clientes' | 'estoque'
  | 'orcamentos' | 'financeiro' | 'cobrancas_asaas'
  | 'whatsapp_templates'
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
        'whatsapp_templates','whitelabel','api_rest','suporte_prioritario'
      ]);
      setLoading(false);
      return;
    }
    if (!organization) { setFeatures([]); setLoading(false); return; }

    (async () => {
      const planSlug = ['bronze','prata','ouro'].includes(organization.plan)
        ? organization.plan
        : 'bronze';
      const { data, error } = await supabase
        .from('subscription_plans' as any)
        .select('features')
        .eq('slug', planSlug)
        .maybeSingle();
      if (error) {
        console.error('Erro ao carregar recursos do plano:', error);
        toast.error("Não foi possível verificar os recursos do seu plano. Tente novamente.");
        // Em falha não libera nada: mantém o bloqueio atual.
        setFeatures([]);
        setLoading(false);
        return;
      }
      setFeatures(((data as any)?.features as FeatureKey[]) || []);
      setLoading(false);
    })();
  }, [organization, isPlatformAdmin, orgLoading]);

  const has = (key: FeatureKey) => features.includes(key);
  return { features, has, loading };
}
