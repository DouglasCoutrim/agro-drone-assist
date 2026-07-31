import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useOrganization } from '@/hooks/useOrganization';
import { Loader2, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MainLayout } from '@/components/layout/MainLayout';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'tecnico' | 'consulta';
  requiredPermission?: 'acesso_os' | 'acesso_estoque' | 'acesso_financeiro';
  allowBlocked?: boolean;
  requiredPlatformAdmin?: boolean;
}

export default function ProtectedRoute({ children, requiredRole, requiredPermission, allowBlocked, requiredPlatformAdmin }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const { permissions, loading: permsLoading } = usePermissions();
  const { organization, isPlatformAdmin, loading: orgLoading } = useOrganization();

  if (loading || permsLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredPlatformAdmin && !isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Org blocked? (platform admin bypasses)
  if (!allowBlocked && !isPlatformAdmin && organization && organization.status === 'blocked') {
    return <Navigate to="/mensalidade-em-atraso" replace />;
  }

  // Role hierarchy check
  if (requiredRole) {
    const roleHierarchy = { admin: 3, tecnico: 2, consulta: 1 };
    const userRoleLevel = role ? roleHierarchy[role] : 0;
    const requiredRoleLevel = roleHierarchy[requiredRole];

    if (userRoleLevel < requiredRoleLevel) {
      return (
        <MainLayout>
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldX className="h-10 w-10 text-destructive" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Acesso Restrito</h2>
              <p className="text-muted-foreground max-w-md">
                Você não tem permissão para acessar esta página. Entre em contato com o administrador para solicitar acesso.
              </p>
            </div>
            <Button variant="outline" onClick={() => window.history.back()}>Voltar</Button>
          </div>
        </MainLayout>
      );
    }
  }

  // Module-level permission check (admins always pass)
  if (requiredPermission && role !== 'admin') {
    if (permissions && !permissions[requiredPermission]) {
      return (
        <MainLayout>
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldX className="h-10 w-10 text-destructive" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Acesso Restrito</h2>
              <p className="text-muted-foreground max-w-md">
                Seu perfil não possui acesso a este módulo. Peça ao administrador para habilitar esta permissão.
              </p>
            </div>
            <Button variant="outline" onClick={() => window.history.back()}>Voltar</Button>
          </div>
        </MainLayout>
      );
    }
  }

  return <>{children}</>;
}
