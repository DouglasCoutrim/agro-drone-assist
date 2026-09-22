import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "./useOrganization";

export interface TeamMember {
  id: string;
  nome: string;
  email: string;
  role: string;
  roles: string[];
}

export function useTeamMembers() {
  const { organization, isPlatformAdmin, loading: orgLoading } = useOrganization();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Aguarda organização carregar e bloqueia se não houver org (evita vazamento entre tenants)
    if (orgLoading) return;
    if (!organization?.id && !isPlatformAdmin) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const fetchMembers = async () => {
      setLoading(true);
      try {
        let profilesQuery = supabase.from("profiles").select("id, nome, email, organization_id");
        if (organization?.id) {
          profilesQuery = profilesQuery.eq("organization_id", organization.id);
        }
        const profilesRes = await profilesQuery;
        const profiles = profilesRes.data || [];
        const ids = profiles.map((p) => p.id);
        if (ids.length === 0) {
          setMembers([]);
          return;
        }
        const rolesRes = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", ids);
        const roles = rolesRes.data || [];
        setMembers(
          profiles.map((p) => {
            const assignedRoles = roles.filter((r) => r.user_id === p.id).map((r) => r.role);
            const effectiveRole = ["admin", "tecnico", "consulta"].find((candidate) => assignedRoles.includes(candidate as typeof assignedRoles[number])) || "consulta";
            return { id: p.id, nome: p.nome, email: p.email, role: effectiveRole, roles: assignedRoles.length ? assignedRoles : ["consulta"] };
          })
        );
      } catch {
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [organization?.id, isPlatformAdmin, orgLoading]);

  const tecnicos = members.filter((m) => m.roles.includes("tecnico") || m.roles.includes("admin"));
  const vendedores = members.filter((m) => m.roles.includes("admin") || m.roles.includes("tecnico"));

  return { members, tecnicos, vendedores, loading: loading || orgLoading };
}
