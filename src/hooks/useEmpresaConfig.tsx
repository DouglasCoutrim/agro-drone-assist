import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export interface EmpresaConfig {
  id: string;
  nome_empresa: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  responsavel: string;
  logo_url: string;
  termos_servico: string;
}

const emptyConfig: EmpresaConfig = {
  id: "",
  nome_empresa: "",
  cnpj: "",
  endereco: "",
  telefone: "",
  responsavel: "",
  logo_url: "",
  termos_servico: "",
};

const EmpresaConfigContext = createContext<{
  config: EmpresaConfig;
  loading: boolean;
  refetch: () => Promise<void>;
}>({ config: emptyConfig, loading: true, refetch: async () => {} });

export function EmpresaConfigProvider({ children }: { children: ReactNode }) {
  const { organization, loading: orgLoading } = useOrganization();
  const [config, setConfig] = useState<EmpresaConfig>(emptyConfig);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    if (!organization?.id) {
      setConfig(emptyConfig);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("empresa_config" as any)
        .select("*")
        .eq("organization_id", organization.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const d = data as any;
        setConfig({
          id: d.id ?? "",
          nome_empresa: d.nome_empresa ?? "",
          cnpj: d.cnpj ?? "",
          endereco: d.endereco ?? "",
          telefone: d.telefone ?? "",
          responsavel: d.responsavel ?? "",
          logo_url: d.logo_url ?? "",
          termos_servico: d.termos_servico ?? "",
        });
      } else {
        setConfig(emptyConfig);
      }
    } catch {
      setConfig(emptyConfig);
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    if (orgLoading) return;
    fetchConfig();
  }, [orgLoading, fetchConfig]);

  return (
    <EmpresaConfigContext.Provider value={{ config, loading: loading || orgLoading, refetch: fetchConfig }}>
      {children}
    </EmpresaConfigContext.Provider>
  );
}

export function useEmpresaConfig() {
  return useContext(EmpresaConfigContext);
}
