import { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

type AppRole = 'admin' | 'tecnico' | 'consulta';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isTecnico: boolean;
  canEdit: boolean;
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const assignedRoles = (data || []).map((item) => item.role as AppRole);
    const effectiveRole = (['admin', 'tecnico', 'consulta'] as AppRole[]).find((candidate) => assignedRoles.includes(candidate)) ?? null;
    setRoles(assignedRoles);
    setRole(effectiveRole);
  };

  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const newUserId = session?.user?.id ?? null;
        setSession(session);
        // Evita trocar a referência de `user` em eventos como TOKEN_REFRESHED
        // quando o usuário continua o mesmo — isso causava re-renders em cascata
        // e desmontava formulários/modais abertos.
        if (newUserId !== lastUserIdRef.current) {
          lastUserIdRef.current = newUserId;
          setUser(session?.user ?? null);
          if (session?.user) {
            setTimeout(() => { fetchUserRole(session.user.id); }, 0);
          } else {
            setRole(null);
            setRoles([]);
          }
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      const newUserId = session?.user?.id ?? null;
      setSession(session);
      if (newUserId !== lastUserIdRef.current) {
        lastUserIdRef.current = newUserId;
        setUser(session?.user ?? null);
        if (session?.user) fetchUserRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, nome: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: { nome } },
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setRoles([]);
    lastUserIdRef.current = null;
  }, []);

  const hasRole = useCallback((candidate: AppRole) => roles.includes(candidate), [roles]);
  const isAdmin = hasRole('admin');
  const isTecnico = hasRole('tecnico');
  const canEdit = isAdmin || isTecnico;

  const value = useMemo(
    () => ({ user, session, role, roles, loading, signIn, signUp, signOut, isAdmin, isTecnico, canEdit, hasRole }),
    [user, session, role, roles, loading, signIn, signUp, signOut, isAdmin, isTecnico, canEdit, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
