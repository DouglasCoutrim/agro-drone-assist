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
      {/* Fundo cinematográfico (puramente decorativo) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_12%_0%,#0a3a2c_0%,#031b22_45%,#001116_100%)]" />
        <div className="absolute -left-40 top-1/4 h-[38rem] w-[38rem] rounded-full bg-[#00c83f]/20 blur-[140px]" />
        <div className="absolute -right-32 -top-24 h-[34rem] w-[34rem] rounded-full bg-[#7cff00]/10 blur-[130px]" />
        <div className="absolute -bottom-40 left-1/3 h-[30rem] w-[30rem] rounded-full bg-[#007a38]/25 blur-[130px]" />
        <div className="absolute -left-24 top-[36%] h-[3px] w-[72%] -rotate-6 bg-gradient-to-r from-transparent via-[#7cff00]/70 to-transparent" />
        <div className="absolute -right-24 top-[58%] h-[2px] w-[58%] rotate-3 bg-gradient-to-r from-transparent via-[#00c83f]/60 to-transparent" />
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:64px_64px]" />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.05fr_minmax(440px,560px)] lg:gap-16 lg:px-16 lg:py-14">
        {/* Área institucional */}
        <section className="order-2 flex flex-col gap-8 lg:order-1 lg:gap-14">
          <div className="hidden lg:block">
            <LivreOSLogo size="lg" tone="onDark" />
          </div>

          <div className="space-y-7">
            <span aria-hidden="true" className="block h-1 w-16 rounded-full bg-[#7cff00]" />
            <h1 className="max-w-[18ch] text-3xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-4xl sm:leading-[1.15] lg:text-[3.4rem] lg:leading-[1.15]">
              ERP Completo para Assistência Técnica
            </h1>
            <p className="max-w-xl text-base text-white/75 sm:text-lg lg:text-xl">
              Gestão, atendimento, serviços, estoque e financeiro em um só lugar.
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
            {SEGMENTOS.map(({ label, Icon }) => (
              <li
                key={label}
                className="flex flex-col items-center gap-2 rounded-2xl border border-[#00c83f]/35 bg-white/5 px-3 py-4 text-center transition-colors hover:border-[#7cff00]/60 hover:bg-white/10"
              >
                <Icon className="h-6 w-6 text-[#7cff00]" aria-hidden="true" />
                <span className="text-[0.7rem] font-semibold uppercase leading-tight tracking-wide text-white/85">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Área do formulário */}
        <section className="order-1 flex w-full justify-center lg:order-2 lg:justify-end">
          <div className="livreos-login__glass w-full max-w-[560px] p-6 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <LivreOSLogo size="md" tone="onLight" />
                <p className="text-sm text-[#4a6470]">Gestão completa para sua assistência técnica</p>
              </div>

              <form onSubmit={handleLogin} className="flex flex-col gap-5">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-[#09232b]">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7d97a3]"
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
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7d97a3]"
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

              <div className="border-t border-[#09232b]/10 pt-5 text-center text-sm text-[#4a6470]">
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
      </div>
    </div>
  );
}
