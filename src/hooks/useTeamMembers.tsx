import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TeamMember {
  id: string;
  nome: string;
  email: string;
  role: string;
}

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [profilesRes, rolesRes] = await Promise.all([
          supabase.from("profiles").select("id, nome, email"),
          supabase.from("user_roles").select("user_id, role"),
        ]);
        const profiles = profilesRes.data || [];
        const roles = rolesRes.data || [];
        setMembers(profiles.map(p => {
          const r = roles.find(r => r.user_id === p.id);
          return { id: p.id, nome: p.nome, email: p.email, role: r?.role || "consulta" };
        }));
      } catch { }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const tecnicos = members.filter(m => m.role === "tecnico" || m.role === "admin");
  const vendedores = members.filter(m => m.role === "admin" || m.role === "tecnico");

  return { members, tecnicos, vendedores, loading };
}
