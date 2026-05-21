import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { Loader2 } from 'lucide-react';
import OverviewTab from '@/components/admin/OverviewTab';
import TenantsTab from '@/components/admin/TenantsTab';
import PlansTab from '@/components/admin/PlansTab';
import SupportTab from '@/components/admin/SupportTab';
import BroadcastTab from '@/components/admin/BroadcastTab';
import WikiTab from '@/components/admin/WikiTab';
import ConfigTab from '@/components/admin/ConfigTab';
import { PlatformSidebar } from '@/components/layout/PlatformSidebar';

export default function AdminMaster() {
  const { loading: authLoading } = useAuth();
  const { isPlatformAdmin, loading } = useOrganization();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  if (loading || authLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="animate-spin text-indigo-500" />
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
      default: return <OverviewTab />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-200">
      <PlatformSidebar />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header contextual */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center px-8 justify-between shrink-0">
          <div>
            <h1 className="text-lg font-semibold text-white capitalize">
              {activeTab === 'config' ? 'Configurações da Plataforma' : 
               activeTab === 'tenants' ? 'Gerenciamento de Clientes' : 
               activeTab === 'support' ? 'Suporte Global' : 
               activeTab === 'broadcast' ? 'Comunicados do Sistema' : 
               activeTab === 'plans' ? 'Planos e Assinaturas' : 
               activeTab === 'wiki' ? 'Wiki Administrativa' : 'Visão Geral'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              <span className="text-[11px] text-indigo-400 font-medium">Ambiente Seguro</span>
            </div>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          <div className="max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}
