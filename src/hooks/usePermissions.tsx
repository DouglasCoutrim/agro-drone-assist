import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UserPermissions {
  acesso_os: boolean;
  acesso_estoque: boolean;
  acesso_financeiro: boolean;
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
          .select('acesso_os, acesso_estoque, acesso_financeiro')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        
        setPermissions(data ? {
          acesso_os: data.acesso_os,
          acesso_estoque: data.acesso_estoque,
          acesso_financeiro: data.acesso_financeiro,
        } : { acesso_os: true, acesso_estoque: true, acesso_financeiro: false });
      } catch (err) {
        console.error('Error fetching permissions:', err);
        setPermissions({ acesso_os: true, acesso_estoque: true, acesso_financeiro: false });
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user]);

  return { permissions, loading };
}
