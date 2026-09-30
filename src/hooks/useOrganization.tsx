import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

    let cancelled = false;
    (async () => {
      setLoading(true);
      let org: Organization | null = null;
      let isPA = false;
      try {
        const { data: pa, error: paErr } = await supabase
          .from("platform_admins" as any)
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (paErr) throw paErr;
        isPA = !!pa;

        if (!isPA) {
          const { data: profile, error: profileErr } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .maybeSingle();
          if (profileErr) throw profileErr;

          if (profile?.organization_id) {
            const { data: orgData, error: orgErr } = await supabase
              .from("organizations" as any)
              .select("*")
              .eq("id", profile.organization_id)
              .maybeSingle();
            if (orgErr) throw orgErr;
            org = (orgData as any) ?? null;
          }
        }
      } catch (e) {
        console.error("useOrganization error:", e);
      } finally {
        if (!cancelled) {
          setIsPlatformAdmin(isPA);
          setOrganization(org);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  return { organization, isPlatformAdmin, loading };
}
