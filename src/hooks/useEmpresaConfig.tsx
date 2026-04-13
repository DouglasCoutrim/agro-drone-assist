import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const defaultConfig: EmpresaConfig = {
  id: "",
  nome_empresa: "Ares Agrotec",
  cnpj: "",
  endereco: "",
  telefone: "61 9 91147599",
  responsavel: "Douglas",
  logo_url: "",
  termos_servico: "",
};

const EmpresaConfigContext = createContext<{
  config: EmpresaConfig;
  loading: boolean;
  refetch: () => Promise<void>;
}>({ config: defaultConfig, loading: true, refetch: async () => {} });

export function EmpresaConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<EmpresaConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("empresa_config" as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) setConfig(data as any);
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  return (
    <EmpresaConfigContext.Provider value={{ config, loading, refetch: fetchConfig }}>
      {children}
    </EmpresaConfigContext.Provider>
  );
}

export function useEmpresaConfig() {
  return useContext(EmpresaConfigContext);
}
