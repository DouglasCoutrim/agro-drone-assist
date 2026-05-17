import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ShieldCheck, LogOut, LayoutDashboard, Building2, Package, LifeBuoy, Megaphone, BookOpen } from 'lucide-react';
import OverviewTab from '@/components/admin/OverviewTab';
import TenantsTab from '@/components/admin/TenantsTab';
import PlansTab from '@/components/admin/PlansTab';
import SupportTab from '@/components/admin/SupportTab';
import BroadcastTab from '@/components/admin/BroadcastTab';
import WikiTab from '@/components/admin/WikiTab';

export default function AdminMaster() {
  const { signOut, loading: authLoading } = useAuth();
  const { isPlatformAdmin, loading } = useOrganization();

  if (loading || authLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Super Admin</h1>
              <p className="text-xs text-muted-foreground">Painel global da plataforma</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />Sair
          </Button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto p-4 lg:p-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto">
            <TabsTrigger value="overview" className="gap-2 py-2.5">
              <LayoutDashboard className="h-4 w-4" /> Visão Geral
            </TabsTrigger>
            <TabsTrigger value="tenants" className="gap-2 py-2.5">
              <Building2 className="h-4 w-4" /> Clientes
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-2 py-2.5">
              <Package className="h-4 w-4" /> Planos
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-2 py-2.5">
              <LifeBuoy className="h-4 w-4" /> Suporte
            </TabsTrigger>
            <TabsTrigger value="broadcast" className="gap-2 py-2.5">
              <Megaphone className="h-4 w-4" /> Avisos
            </TabsTrigger>
            <TabsTrigger value="wiki" className="gap-2 py-2.5">
              <BookOpen className="h-4 w-4" /> Wiki
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="tenants"><TenantsTab /></TabsContent>
          <TabsContent value="plans"><PlansTab /></TabsContent>
          <TabsContent value="support"><SupportTab /></TabsContent>
          <TabsContent value="broadcast"><BroadcastTab /></TabsContent>
          <TabsContent value="wiki"><WikiTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
