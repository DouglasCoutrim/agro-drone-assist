import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UserPermissions {
  acesso_dashboard: boolean;
  acesso_os: boolean;
  acesso_meu_painel: boolean;
  acesso_oficina_vivo: boolean;
  acesso_clientes: boolean;
  acesso_estoque: boolean;
  acesso_servicos: boolean;
  acesso_financeiro: boolean;
  acesso_cobrancas: boolean;
  acesso_orcamentos: boolean;
  acesso_rotas: boolean;
  acesso_relatorios: boolean;
  acesso_equipe: boolean;
  acesso_empresa: boolean;
  acesso_configuracoes: boolean;
  acesso_checklist: boolean;
  acesso_notificacoes: boolean;
  acesso_wiki: boolean;
  acesso_suporte: boolean;
}

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        const { data, error } = await supabase
          .from('user_permissions')
          .select('acesso_dashboard, acesso_os, acesso_meu_painel, acesso_oficina_vivo, acesso_clientes, acesso_estoque, acesso_servicos, acesso_financeiro, acesso_cobrancas, acesso_orcamentos, acesso_rotas, acesso_relatorios, acesso_equipe, acesso_empresa, acesso_configuracoes, acesso_checklist, acesso_notificacoes, acesso_wiki, acesso_suporte')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        const defaultPerms: UserPermissions = {
          acesso_dashboard: true, acesso_os: true, acesso_meu_painel: true, acesso_oficina_vivo: true,
          acesso_clientes: true, acesso_estoque: true, acesso_servicos: true, acesso_financeiro: false,
          acesso_cobrancas: false, acesso_orcamentos: true, acesso_rotas: true, acesso_relatorios: true,
          acesso_equipe: true, acesso_empresa: true, acesso_configuracoes: true, acesso_checklist: true,
          acesso_notificacoes: true, acesso_wiki: true, acesso_suporte: true,
        };

        if (data) {
          setPermissions({ ...defaultPerms, ...data });
        } else {
          setPermissions(defaultPerms);
        }
      } catch (err) {
        console.error('Error fetching permissions:', err);
        setPermissions({
          acesso_dashboard: false, acesso_os: false, acesso_meu_painel: false, acesso_oficina_vivo: false,
          acesso_clientes: false, acesso_estoque: false, acesso_servicos: false, acesso_financeiro: false,
          acesso_cobrancas: false, acesso_orcamentos: false, acesso_rotas: false, acesso_relatorios: false,
          acesso_equipe: false, acesso_empresa: false, acesso_configuracoes: false, acesso_checklist: false,
          acesso_notificacoes: false, acesso_wiki: false, acesso_suporte: false,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user]);

  return { permissions, loading };
}