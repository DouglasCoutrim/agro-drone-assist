import { Navigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { Loader2, Menu, Building2 } from 'lucide-react';
import OverviewTab from '@/components/admin/OverviewTab';
import TenantsTab from '@/components/admin/TenantsTab';
import PlansTab from '@/components/admin/PlansTab';
import SupportTab from '@/components/admin/SupportTab';
import BroadcastTab from '@/components/admin/BroadcastTab';
import WikiTab from '@/components/admin/WikiTab';
import ConfigTab from '@/components/admin/ConfigTab';
import SiteTab from '@/components/admin/SiteTab';
import { PlatformSidebar } from '@/components/layout/PlatformSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from 'react';
import { Button } from "@/components/ui/button";

export default function AdminMaster() {
  const { loading: authLoading } = useAuth();
  const { isPlatformAdmin, organization, loading } = useOrganization();
  const [searchParams] = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const activeTab = searchParams.get('tab') || 'overview';

  if (loading || authLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />;

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab />;
      case 'tenants': return <TenantsTab />;
      case 'plans': return <PlansTab />;
      case 'support': return <SupportTab />;
      case 'broadcast': return <BroadcastTab />;
      case 'wiki': return <WikiTab />;
      case 'config': return <ConfigTab />;
      case 'site': return <SiteTab />;
      default: return <OverviewTab />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-background text-foreground selection:bg-primary/20 pb-[env(safe-area-inset-bottom)]">
      <div className="hidden md:block border-r border-border">
        <PlatformSidebar />
      </div>
      
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header contextual */}
        <header className="h-16 border-b border-border bg-card/30 flex items-center px-4 md:px-8 justify-between shrink-0 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[280px]">
                <PlatformSidebar onNavigate={() => setIsSidebarOpen(false)} />
              </SheetContent>
            </Sheet>
            <h1 className="text-[clamp(0.9rem,4vw,1.125rem)] font-semibold text-foreground truncate max-w-[200px] md:max-w-none">
              {activeTab === 'config' ? 'Configurações da Plataforma' : 
               activeTab === 'tenants' ? 'Gerenciamento de Clientes' : 
               activeTab === 'support' ? 'Suporte Global' : 
               activeTab === 'broadcast' ? 'Comunicados do Sistema' : 
               activeTab === 'plans' ? 'Planos e Assinaturas' : 
               activeTab === 'site' ? 'Administração do Site' : 
               activeTab === 'wiki' ? 'Wiki Administrativa' : 'Visão Geral'}
            </h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {organization && (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link to="/dashboard">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Minha Empresa</span>
                </Link>
              </Button>
            )}
            <ThemeToggle />
            <div className="hidden md:block px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              <span className="text-[11px] text-primary font-medium">Ambiente Seguro</span>
            </div>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 p-4 md:p-8 pb-24 md:pb-12">
          <div className="max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}
