import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  next_due_date: string | null;
  monthly_fee: number;
  blocked_at: string | null;
  blocked_reason: string | null;
  max_users: number;
  max_os_per_month: number;
}

export function useOrganization() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setOrganization(null);
      setIsPlatformAdmin(false);
      setLoading(false);
      return;
    }

    (async () => {
      // platform admin?
      const { data: pa } = await supabase
        .from('platform_admins' as any)
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      const isPA = !!pa;
      setIsPlatformAdmin(isPA);

      // only fetch organization if NOT platform admin
      if (!isPA) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.organization_id) {
          const { data: org } = await supabase
            .from('organizations' as any)
            .select('*')
            .eq('id', profile.organization_id)
            .maybeSingle();
          setOrganization(org as any);
        }
      } else {
        // platform admin - no organization
        setOrganization(null);
      }
      setLoading(false);
    })();
  }, [user]);

  return { organization, isPlatformAdmin, loading };
}
