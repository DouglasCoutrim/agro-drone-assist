import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import type { CustomType } from '@/lib/equipment-segments';

export interface OrgSegmentSettings {
  segmentos: string[];
  tipos_custom: CustomType[];
}

const DEFAULTS: OrgSegmentSettings = { segmentos: [], tipos_custom: [] };

export function useOrgSegments() {
  const { organization } = useOrganization();
  const [data, setData] = useState<OrgSegmentSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organization) { setLoading(false); return; }
    setLoading(true);
    const { data: row } = await supabase
      .from('organizations' as any)
      .select('settings')
      .eq('id', organization.id)
      .maybeSingle();
    const s = ((row as any)?.settings || {}) as any;
    setData({
      segmentos: Array.isArray(s.segmentos) ? s.segmentos : [],
      tipos_custom: Array.isArray(s.tipos_custom) ? s.tipos_custom : [],
    });
    setLoading(false);
  }, [organization]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (patch: Partial<OrgSegmentSettings>) => {
    if (!organization) return;
    const { data: row } = await supabase
      .from('organizations' as any)
      .select('settings')
      .eq('id', organization.id)
      .maybeSingle();
    const current = ((row as any)?.settings || {}) as any;
    const next = { ...current, ...patch };
    const { error } = await supabase
      .from('organizations' as any)
      .update({ settings: next })
      .eq('id', organization.id);
    if (error) throw error;
    setData(prev => ({ ...prev, ...patch }));
    await load();
  }, [organization, load]);

  return { ...data, loading, save, reload: load };
}
