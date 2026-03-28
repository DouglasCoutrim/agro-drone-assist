import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { EmpresaConfigProvider } from "@/hooks/useEmpresaConfig";
import { OrganizationProvider } from "@/hooks/useOrganization";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import OrdensServico from "./pages/OrdensServico";
import Estoque from "./pages/Estoque";
import Relatorios from "./pages/Relatorios";
import Financeiro from "./pages/Financeiro";
import Clientes from "./pages/Clientes";
import Configuracoes from "./pages/Configuracoes";
import Cobrancas from "./pages/Cobrancas";
import Deslocamentos from "./pages/Deslocamentos";
import Equipe from "./pages/Equipe";
import EmpresaConfig from "./pages/EmpresaConfig";
import Orcamentos from "./pages/Orcamentos";
import Rotas from "./pages/Rotas";
import Onboarding from "./pages/Onboarding";
import GodMode from "./pages/GodMode";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <OrganizationProvider>
              <EmpresaConfigProvider>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/onboarding" element={<ProtectedRoute skipOrgCheck><Onboarding /></ProtectedRoute>} />
                  <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                  <Route path="/ordens-servico" element={<ProtectedRoute requiredPermission="acesso_os"><OrdensServico /></ProtectedRoute>} />
                  <Route path="/estoque" element={<ProtectedRoute requiredPermission="acesso_estoque"><Estoque /></ProtectedRoute>} />
                  <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
                  <Route path="/financeiro" element={<ProtectedRoute requiredPermission="acesso_financeiro"><Financeiro /></ProtectedRoute>} />
                  <Route path="/cobrancas" element={<ProtectedRoute requiredPermission="acesso_financeiro"><Cobrancas /></ProtectedRoute>} />
                  <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
                  <Route path="/deslocamentos" element={<ProtectedRoute requiredPermission="acesso_os"><Deslocamentos /></ProtectedRoute>} />
                  <Route path="/orcamentos" element={<ProtectedRoute requiredPermission="acesso_os"><Orcamentos /></ProtectedRoute>} />
                  <Route path="/rotas" element={<ProtectedRoute requiredPermission="acesso_os"><Rotas /></ProtectedRoute>} />
                  <Route path="/configuracoes" element={<ProtectedRoute requiredRole="admin"><Configuracoes /></ProtectedRoute>} />
                  <Route path="/equipe" element={<ProtectedRoute requiredRole="admin"><Equipe /></ProtectedRoute>} />
                  <Route path="/empresa" element={<ProtectedRoute requiredRole="admin"><EmpresaConfig /></ProtectedRoute>} />
                  <Route path="/god-mode" element={<ProtectedRoute skipOrgCheck><GodMode /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </EmpresaConfigProvider>
            </OrganizationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
