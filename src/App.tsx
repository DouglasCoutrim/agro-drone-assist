import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { EmpresaConfigProvider } from "@/hooks/useEmpresaConfig";
import { ConfirmProvider } from "@/hooks/useConfirm";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useState, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Eager: critical entry pages
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import AdminAuth from "./pages/AdminAuth";
import NotFound from "./pages/NotFound";

// Lazy: heavy authenticated pages
const Index = lazy(() => import("./pages/Index"));
const OrdensServico = lazy(() => import("./pages/OrdensServico"));
const Estoque = lazy(() => import("./pages/Estoque"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Cobrancas = lazy(() => import("./pages/Cobrancas"));
const Deslocamentos = lazy(() => import("./pages/Deslocamentos"));
const Equipe = lazy(() => import("./pages/Equipe"));
const EmpresaConfig = lazy(() => import("./pages/EmpresaConfig"));
const Orcamentos = lazy(() => import("./pages/Orcamentos"));
const Rotas = lazy(() => import("./pages/Rotas"));
const AdminMaster = lazy(() => import("./pages/AdminMaster"));
const CadastroEmpresa = lazy(() => import("./pages/CadastroEmpresa"));
const MensalidadeAtraso = lazy(() => import("./pages/MensalidadeAtraso"));
const Assinatura = lazy(() => import("./pages/Assinatura"));
const Suporte = lazy(() => import("./pages/Suporte"));
const Notificacoes = lazy(() => import("./pages/Notificacoes"));
const Wiki = lazy(() => import("./pages/Wiki"));

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient();

const App = () => {
  const [isPWA, setIsPWA] = useState(() => {
    if (typeof window === 'undefined') return false;
    const fromQuery = new URLSearchParams(window.location.search).get('pwa') === '1';
    if (fromQuery) {
      try { sessionStorage.setItem('isPWA', '1'); } catch {}
      return true;
    }
    if (sessionStorage.getItem('isPWA') === '1') return true;
    return window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true
      || document.referrer.includes('android-app://');
  });

  useEffect(() => {
    const check = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as any).standalone === true;
      if (standalone) {
        try { sessionStorage.setItem('isPWA', '1'); } catch {}
        setIsPWA(true);
      }
    };
    check();
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener?.('change', check);
    return () => mq.removeEventListener?.('change', check);
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <EmpresaConfigProvider>
              <ConfirmProvider>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/admin/auth" element={<AdminAuth />} />
                  <Route path="/cadastro-empresa" element={<CadastroEmpresa />} />
                  <Route path="/mensalidade-em-atraso" element={<ProtectedRoute allowBlocked><MensalidadeAtraso /></ProtectedRoute>} />
                  <Route path="/admin-master" element={<ProtectedRoute requiredPlatformAdmin><AdminMaster /></ProtectedRoute>} />
                  <Route path="/admin" element={<Navigate to="/admin-master" replace />} />
                  <Route path="/" element={isPWA ? (window.location.pathname.startsWith('/admin') ? <AdminAuth /> : <Auth />) : <Landing />} />
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
              </Suspense>
              </ConfirmProvider>
            </EmpresaConfigProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);
};

export default App;
