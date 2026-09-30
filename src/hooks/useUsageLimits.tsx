import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from './useOrganization';

interface UsageLimits {
  loading: boolean;
  plan: string;
  osUsed: number;
  osLimit: number; // -1 = unlimited
  usersUsed: number;
  usersLimit: number;
  canCreateOS: boolean;
  canInviteUser: boolean;
  refetch: () => Promise<void>;
}

export function useUsageLimits(): UsageLimits {
  const { organization, isPlatformAdmin } = useOrganization();
  const [state, setState] = useState({
    loading: true,
    osUsed: 0,
    osLimit: 30,
    usersUsed: 0,
    usersLimit: 2,
  });

  const fetchUsage = useCallback(async () => {
    if (!organization) {
      setState(s => ({ ...s, loading: false }));
      return;
    }

    const slug = organization.plan === 'trial' ? 'bronze' : organization.plan;
    const [planRes, osRes, usersRes] = await Promise.all([
      supabase.from('subscription_plans' as any).select('max_users,max_os_per_month').eq('slug', slug).maybeSingle(),
      supabase.rpc('count_os_current_month' as any, { _org: organization.id }),
      supabase.rpc('count_active_users' as any, { _org: organization.id }),
    ]);

    const plan = (planRes.data as any) || { max_users: 2, max_os_per_month: 30 };
    setState({
      loading: false,
      osUsed: (osRes.data as any) ?? 0,
      osLimit: plan.max_os_per_month,
      usersUsed: (usersRes.data as any) ?? 0,
      usersLimit: plan.max_users,
    });
  }, [organization]);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const canCreateOS = isPlatformAdmin || state.osLimit === -1 || state.osUsed < state.osLimit;
  const canInviteUser = isPlatformAdmin || state.usersLimit === -1 || state.usersUsed < state.usersLimit;

  return {
    loading: state.loading,
    plan: organization?.plan ?? 'bronze',
    osUsed: state.osUsed,
    osLimit: state.osLimit,
    usersUsed: state.usersUsed,
    usersLimit: state.usersLimit,
    canCreateOS,
    canInviteUser,
    refetch: fetchUsage,
  };
}
