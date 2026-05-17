import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { EmpresaConfigProvider } from "@/hooks/useEmpresaConfig";
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
import AdminMaster from "./pages/AdminMaster";
import CadastroEmpresa from "./pages/CadastroEmpresa";
import MensalidadeAtraso from "./pages/MensalidadeAtraso";
import Assinatura from "./pages/Assinatura";
import Landing from "./pages/Landing";
import Suporte from "./pages/Suporte";
import Notificacoes from "./pages/Notificacoes";
import Wiki from "./pages/Wiki";
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
            <EmpresaConfigProvider>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/cadastro-empresa" element={<CadastroEmpresa />} />
                <Route path="/mensalidade-em-atraso" element={<ProtectedRoute allowBlocked><MensalidadeAtraso /></ProtectedRoute>} />
                <Route path="/admin-master" element={<AdminMaster />} />
                <Route path="/" element={<Landing />} />
                <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
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
                <Route path="/assinatura" element={<ProtectedRoute allowBlocked requiredRole="admin"><Assinatura /></ProtectedRoute>} />
                <Route path="/suporte" element={<ProtectedRoute><Suporte /></ProtectedRoute>} />
                <Route path="/notificacoes" element={<ProtectedRoute><Notificacoes /></ProtectedRoute>} />
                <Route path="/wiki" element={<ProtectedRoute><Wiki /></ProtectedRoute>} />
                <Route path="/wiki/:slug" element={<ProtectedRoute><Wiki /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </EmpresaConfigProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
