import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff, Satellite, Tractor, Laptop, Car, Cog, Shield, Zap, Headphones, ArrowRight } from "lucide-react";
import { z } from "zod";
import { LivreOSLogo } from "@/components/brand/LivreOSLogo";
import loginBg from "@/assets/login-bg.png";

const emailSchema = z.string().email("Email inválido");
const passwordSchema = z.string().min(6, "Senha deve ter no mínimo 6 caracteres");

const categorias = [
  { id: "drones", label: "Drones Agrícolas", icon: Satellite },
  { id: "maquinas", label: "Máquinas Agrícolas", icon: Tractor },
  { id: "informatica", label: "Informática e Conectividade", icon: Laptop },
  { id: "mobilidade", label: "Mobilidade Elétrica", icon: Car },
  { id: "solucoes", label: "Soluções Integradas", icon: Cog },
];

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, user } = useAuth();
  const { isPlatformAdmin, loading: orgLoading } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("livreos:remember");
      if (saved) {
        const { email, senha } = JSON.parse(saved);
        setLoginEmail(email || "");
        setLoginPassword(senha || "");
        setRememberMe(!!senha);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "1") {
      toast.error("Sua sessão expirou por inatividade. Por favor, faça login novamente.");
      const url = new URL(window.location.href);
      url.searchParams.delete("expired");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  useEffect(() => {
    if (user && !orgLoading) {
      if (isPlatformAdmin) {
        navigate("/admin/dashboard", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, isPlatformAdmin, orgLoading, navigate]);

  if (user && !orgLoading) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }
    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);
    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Email ou senha incorretos");
      } else {
        toast.error("Erro ao fazer login: " + error.message);
      }
      return;
    }
    toast.success("Login realizado com sucesso!");
    try {
      if (rememberMe) {
        localStorage.setItem("livreos:remember", JSON.stringify({ email: loginEmail, senha: loginPassword }));
      } else {
        localStorage.removeItem("livreos:remember");
      }
    } catch {}
    // The useEffect will handle redirection based on platform admin status
  };

  return (
      <div
        className="min-h-screen w-full overflow-x-hidden relative flex flex-col"
        style={{
          backgroundImage: `url(${loginBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Gradiente de sobreposição suave para leitura dos textos */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#061B32]/40 via-transparent to-[#061B32]/70 pointer-events-none z-0" />

      <div className="relative z-10 flex-1 flex w-full items-center justify-between px-4 sm:px-6 lg:px-12 xl:px-20 py-8">
        {/* Painel esquerdo - Apresentação */}
        <div className="hidden lg:flex lg:w-1/2 flex-col items-start justify-center h-full max-h-[85vh] pr-8">
          <div className="flex items-center gap-3 mb-8">
            <LivreOSLogo size="lg" tone="onDark" title="LivreOS" subtitle="Enterprise" />
          </div>

          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4 drop-shadow-[0_2px_12px_rgba(6,27,50,0.8)]">
            Tecnologia conectando o agro e muito mais.
          </h1>
          <p className="text-white/90 text-lg leading-relaxed mb-10 max-w-md drop-shadow-[0_2px_8px_rgba(6,27,50,0.9)]">
            Gestão inteligente, suporte especializado e soluções completas para o seu negócio.
          </p>

          {/* Cinco categorias */}
          <div className="flex flex-wrap gap-3 justify-start w-full">
            {categorias.map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.id} className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#061B32]/40 border border-white/20 backdrop-blur-md hover:bg-[#061B32]/60 transition-colors group">
                  <Icon className="w-4 h-4 text-[#55E65C] group-hover:text-[#00B83F] transition-colors" />
                  <span className="text-white text-sm font-medium">{cat.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Painel direito - Login */}
                <div className="flex-1 lg:w-1/2 flex items-center justify-center p-4">
                  <Card className="w-full max-w-lg bg-white/95 backdrop-blur-md border border-white/20 shadow-2xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <CardHeader className="text-center space-y-2 pb-8 pt-10">
              <div className="flex justify-center">
                <LivreOSLogo size="lg" tone="onLight" title="LivreOS" subtitle="Enterprise" />
              </div>
              <CardTitle className="text-3xl font-bold text-[#061B32]">Bem-vindo(a)!</CardTitle>
              <CardDescription className="text-[#061B32]/70 text-base">
                Acesse sua conta para continuar.
              </CardDescription>
            </CardHeader>

            <CardContent className="px-8 sm:px-10 pb-10 space-y-6">
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-sm font-medium text-[#061B32]">
                    E-mail ou usuário
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#061B32]/50" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="pl-10 bg-white border border-[#061B32]/20 focus:border-[#0876B9] focus:ring-2 focus:ring-[#0876B9]/30 text-[#061B32] placeholder-[#061B32]/40"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-sm font-medium text-[#061B32]">
                    Senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#061B32]/50" />
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-10 pr-10 bg-white border border-[#061B32]/20 focus:border-[#0876B9] focus:ring-2 focus:ring-[#0876B9]/30 text-[#061B32] placeholder-[#061B32]/40"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Ocultar senha" : "Visualizar senha"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#061B32]/50 hover:text-[#0876B9] transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember-me"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                    />
                    <Label htmlFor="remember-me" className="text-sm text-[#061B32]/80 cursor-pointer select-none">
                      Lembrar-me
                    </Label>
                  </div>
                  <a href="/reset-password" className="text-sm text-[#0876B9] font-medium hover:text-[#00B83F] transition-colors">
                    Esqueci minha senha
                  </a>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#00B83F] hover:bg-[#009a35] text-white font-semibold py-3.5 rounded-lg shadow-lg shadow-[#00B83F]/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4" />
                      Entrar
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-2 text-sm text-[#061B32]/60 justify-center">
                  <Shield className="h-4 w-4 text-[#00B83F]" />
                  <span>Seus dados protegidos com tecnologia de ponta.</span>
                </div>
              </form>

              <p className="text-sm text-[#061B32]/50 text-center">
                Quer cadastrar sua empresa?{" "}
                <a href="/cadastro-empresa" className="text-[#0876B9] font-medium underline hover:text-[#00B83F] transition-colors">
                  Criar conta grátis
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rodapé */}
      <footer className="relative z-10 bg-[#061B32]/95 border-t border-[#0876B9]/20 py-5 px-4 sm:px-6">
        <div className="max-w-[1440px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <LivreOSLogo size="xs" tone="onDark" title="LivreOS" subtitle="Enterprise" />
          </div>
          <div className="hidden lg:block text-[#55E65C]/80 font-medium text-center">
            Inovação, eficiência e produtividade no campo e na cidade.
          </div>
          <div className="flex items-center gap-4 sm:gap-6 text-[#55E65C]/70 flex-wrap justify-center">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>Segurança</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>Performance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5" />
              <span>Suporte Especializado</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
