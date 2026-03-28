import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  settings: Record<string, any>;
}

interface OrganizationContextType {
  organization: Organization | null;
  organizationId: string | null;
  loading: boolean;
  needsOnboarding: boolean;
  createOrganization: (name: string, segmento: string, telefone?: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organization: null,
  organizationId: null,
  loading: true,
  needsOnboarding: false,
  createOrganization: async () => {},
  refetch: async () => {},
});

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const fetchOrganization = async () => {
    if (!user) {
      setOrganization(null);
      setNeedsOnboarding(false);
      setLoading(false);
      return;
    }

    try {
      // Get org_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.organization_id) {
        setNeedsOnboarding(true);
        setOrganization(null);
        setLoading(false);
        return;
      }

      // Fetch organization
      const { data: org } = await supabase
        .from("organizations" as any)
        .select("*")
        .eq("id", profile.organization_id)
        .maybeSingle();

      if (org) {
        setOrganization(org as any);
        setNeedsOnboarding(false);
      } else {
        setNeedsOnboarding(true);
      }
    } catch {
      setNeedsOnboarding(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchOrganization();
    }
  }, [user, authLoading]);

  const createOrganization = async (name: string, segmento: string, telefone?: string) => {
    if (!user) throw new Error("Usuário não autenticado");

    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      + "-" + Date.now().toString(36);

    const { data, error } = await (supabase as any)
      .from("organizations")
      .insert({
        name,
        slug,
        owner_id: user.id,
        settings: { segmento },
        telefone: telefone || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    // Update profile with organization_id
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ organization_id: data.id } as any)
      .eq("id", user.id);

    if (profileError) throw profileError;

    await fetchOrganization();
  };

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        organizationId: organization?.id || null,
        loading,
        needsOnboarding,
        createOrganization,
        refetch: fetchOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  return useContext(OrganizationContext);
}
