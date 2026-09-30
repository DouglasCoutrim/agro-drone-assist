import { useState } from "react";

interface ViaCepResult {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export function useViaCep() {
  const [loading, setLoading] = useState(false);

  const fetchCep = async (cep: string): Promise<ViaCepResult | null> => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return null;
    
    setLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data: ViaCepResult = await res.json();
      if (data.erro) return null;
      return data;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { fetchCep, loading };
}
