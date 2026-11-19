import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

/**
 * Alíquota do ISS da organização (`nfe_config.nfse_aliquota`) — a fonte única do imposto da
 * comissão. Lê pelo RPC `get_nfse_aliquota`, porque a tabela `nfe_config` é restrita a admin
 * (guarda os tokens da Focus NFe) e o técnico também precisa conferir o rateio da OS.
 * `null` enquanto carrega; depois disso, `0` quando não há configuração.
 */
export function useNfseAliquota(): number | null {
  const { organization } = useOrganization();
  const [aliquota, setAliquota] = useState<number | null>(null);

  useEffect(() => {
    if (!organization?.id) {
      setAliquota(null);
      return;
    }
    let ativo = true;
    supabase.rpc("get_nfse_aliquota").then(({ data }) => {
      if (ativo) setAliquota(Number(data) || 0);
    });
    return () => {
      ativo = false;
    };
  }, [organization?.id]);

  return aliquota;
}
