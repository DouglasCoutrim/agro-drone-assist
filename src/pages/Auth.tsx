import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Wrench,
  Radar,
  Bike,
  Car,
  Tractor,
} from "lucide-react";
import { z } from "zod";
import { LivreOSLogo } from "@/components/brand/LivreOSLogo";

const emailSchema = z.string().email("Email inválido");
const passwordSchema = z.string().min(6, "Senha deve ter no mínimo 6 caracteres");

/** Segmentos de atuação exibidos na área institucional. */
const SEGMENTOS = [
  { label: "Assistência Técnica", Icon: Wrench },
  { label: "Drones Agrícolas", Icon: Radar },
  { label: "Mobilidade Elétrica", Icon: Bike },
  { label: "Carros Elétricos", Icon: Car },
  { label: "Máquinas Agrícolas", Icon: Tractor },
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
    // O useEffect acima cuida do redirecionamento conforme o perfil do usuário.
  };

  return (
    <div className="livreos-login relative flex min-h-[100svh] w-full flex-col overflow-hidden bg-[#031b22] text-white">
      {/* Fundo: foto oficial + véu de contraste (puramente decorativo) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="livreos-login__photo absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#001116]/65 via-[#001116]/20 to-[#001116]/45 lg:bg-gradient-to-r lg:from-[#001116]/50 lg:via-[#001116]/10 lg:to-transparent" />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 content-start items-center gap-8 px-5 py-9 sm:gap-10 sm:px-8 lg:grid-cols-[1fr_minmax(400px,540px)] lg:content-center lg:gap-x-12 lg:gap-y-12 lg:px-10 lg:py-12 xl:grid-cols-[1.05fr_minmax(420px,500px)] xl:gap-x-16 xl:px-16 xl:py-14">
        {/* 1. Marca + título (desktop: coluna esquerda, linha 1) */}
        <section className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1 lg:gap-8">
          <div className="flex justify-center lg:-translate-x-6">
            <LivreOSLogo size="md" tone="onDark" className="lg:hidden" />
            <LivreOSLogo size="lg" tone="onDark" className="hidden lg:flex xl:hidden" />
            <LivreOSLogo size="2xl" tone="onDark" className="hidden xl:flex" />
          </div>

          <div className="space-y-6">
            <span aria-hidden="true" className="block h-1 w-16 rounded-full bg-[#7cff00]" />
            <h1 className="max-w-[18ch] text-[clamp(1.75rem,3.2vw,3.4rem)] font-extrabold leading-[1.15] tracking-tight text-white">
              ERP Completo para Assistência Técnica
            </h1>
            <p className="max-w-xl text-base text-white/80 sm:text-lg lg:text-xl">
              Gestão, atendimento, serviços, estoque e financeiro em um só lugar.
            </p>
          </div>
        </section>

        {/* 2. Formulário (desktop: coluna direita, ocupando as duas linhas) */}
        <section className="flex w-full justify-center lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:justify-end">
          <div className="livreos-login__glass w-full max-w-[560px] p-5 sm:p-8 lg:p-9 xl:p-10">
            <div className="flex flex-col gap-6">
              <form onSubmit={handleLogin} className="flex flex-col gap-5">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-[#09232b]">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5f8391]"
                    />
                    <Input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="livreos-login__input pl-10 text-[#09232b] focus-visible:ring-0 focus-visible:ring-offset-0"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-[#09232b]">
                    Senha
                  </Label>
                  <div className="relative">
                    <Lock
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5f8391]"
                    />
                    <Input
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="livreos-login__input pl-10 pr-11 text-[#09232b] focus-visible:ring-0 focus-visible:ring-offset-0"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#5b7683] transition-colors hover:text-[#09232b]"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember-me"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                    />
                    <Label htmlFor="remember-me" className="cursor-pointer text-sm font-normal text-[#09232b]">
                      Lembrar-me
                    </Label>
                  </div>
                  <a
                    href="/reset-password"
                    className="text-sm font-medium text-[#007a38] underline-offset-2 hover:underline"
                  >
                    Esqueci minha senha
                  </a>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="livreos-login__button w-full focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
                      Entrar
                    </>
                  )}
                </Button>
              </form>

              <div className="border-t border-[#09232b]/10 pt-5 text-center text-sm text-[#3f5a66]">
                Quer cadastrar sua empresa?{" "}
                <a
                  href="/cadastro-empresa"
                  className="font-semibold text-[#007a38] underline-offset-2 hover:underline"
                >
                  Criar conta grátis
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Segmentos (desktop: coluna esquerda, linha 2) */}
        <section className="lg:col-start-1 lg:row-start-2">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-3 xl:gap-4">
            {SEGMENTOS.map(({ label, Icon }) => (
              <li
                key={label}
                className="livreos-login__chip flex flex-col items-center gap-2 px-2.5 py-4 text-center sm:px-3"
              >
                <Icon className="h-6 w-6 text-[#7cff00]" aria-hidden="true" />
                <span className="text-[0.7rem] font-semibold uppercase leading-tight tracking-wide text-white/90">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
