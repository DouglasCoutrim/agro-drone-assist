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

const orgCache = new Map<string, { organization: Organization | null; isPlatformAdmin: boolean }>();
const orgInflight = new Map<string, Promise<{ organization: Organization | null; isPlatformAdmin: boolean }>>();

export function useOrganization() {
  const { user } = useAuth();
  const cached = user ? orgCache.get(user.id) : undefined;
  const [organization, setOrganization] = useState<Organization | null>(cached?.organization ?? null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(cached?.isPlatformAdmin ?? false);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (!user) {
      orgCache.clear();
      setOrganization(null);
      setIsPlatformAdmin(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const hit = orgCache.get(user.id);
    if (hit) {
      setOrganization(hit.organization);
      setIsPlatformAdmin(hit.isPlatformAdmin);
      setLoading(false);
      return;
    }
    let p = orgInflight.get(user.id);
    if (!p) {
      p = (async () => {
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
        return { organization: org, isPlatformAdmin: isPA, failed: true } as any;
      }
      return { organization: org, isPlatformAdmin: isPA };
      })();
      orgInflight.set(user.id, p);
    }
    p.then((r: any) => {
      orgInflight.delete(user.id);
      if (!r.failed) orgCache.set(user.id, { organization: r.organization, isPlatformAdmin: r.isPlatformAdmin });
      if (!cancelled) {
        setIsPlatformAdmin(r.isPlatformAdmin);
        setOrganization(r.organization);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [user]);

  return { organization, isPlatformAdmin, loading };
}
