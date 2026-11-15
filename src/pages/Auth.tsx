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

/**
 * Segmentos de atuação exibidos na área institucional.
 * A ordem e os nomes sao os da composicao aprovada — nao trocar os cinco.
 */
const SEGMENTOS = [
  { label: "Assistência Técnica", Icon: Wrench },
  { label: "Drones Agrícolas", Icon: Radar },
  { label: "Mobilidade Elétrica", Icon: Bike },
  { label: "Carros Elétricos", Icon: Car },
  { label: "Máquinas Agrícolas", Icon: Tractor },
];

/**
 * Tela de login — composicao aprovada (Liquid Glass / Water Droplet).
 * Desktop: marca, titulo, descricao e os cinco segmentos a esquerda; painel de
 * vidro verde-menta a direita. Mobile: marca, titulo, formulario e cards.
 * Toda a ancoragem proporcional vive nas classes `.livreos-login*` (src/index.css).
 */
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
    <div className="livreos-login" data-testid="login-screen">
      {/* 1. Marca — quadrante superior esquerdo */}
      <header className="livreos-login__brand">
        <LivreOSLogo size="md" tone="onDark" className="livreos-login__logo lg:hidden" />
        <LivreOSLogo size="lg" tone="onDark" className="livreos-login__logo hidden lg:flex xl:hidden" />
        <LivreOSLogo size="2xl" tone="onDark" className="livreos-login__logo hidden xl:flex" />
      </header>

      {/* 2. Traço de acento, headline e descrição */}
      <div className="livreos-login__intro">
        <span aria-hidden="true" className="livreos-login__accent" />
        <h1 className="livreos-login__headline">
          ERP Completo para{" "}
          <br />
          Assistência Técnica
        </h1>
        <p className="livreos-login__description">
          Gestão, atendimento, serviços, estoque e financeiro em um só lugar.
        </p>
      </div>

      {/* 3. Painel de login em vidro líquido */}
      <section className="livreos-login__panel" data-testid="login-panel">
        <form onSubmit={handleLogin} className="livreos-login__form" data-testid="login-form">
          <div className="livreos-login__field">
            <Label htmlFor="login-email" className="livreos-login__label">
              Email
            </Label>
            <div className="livreos-login__control">
              <Mail aria-hidden="true" className="livreos-login__field-icon" />
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="livreos-login__input focus-visible:ring-0 focus-visible:ring-offset-0"
                required
              />
            </div>
          </div>

          <div className="livreos-login__field">
            <Label htmlFor="login-password" className="livreos-login__label">
              Senha
            </Label>
            <div className="livreos-login__control">
              <Lock aria-hidden="true" className="livreos-login__field-icon" />
              <Input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="livreos-login__input livreos-login__input--password focus-visible:ring-0 focus-visible:ring-offset-0"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="livreos-login__reveal"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" className="livreos-login__reveal-icon" />
                ) : (
                  <Eye aria-hidden="true" className="livreos-login__reveal-icon" />
                )}
              </button>
            </div>
          </div>

          <div className="livreos-login__row">
            <div className="livreos-login__remember">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label htmlFor="remember-me" className="livreos-login__remember-label">
                Lembrar-me
              </Label>
            </div>
            <a href="/reset-password" className="livreos-login__link">
              Esqueci minha senha
            </a>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="livreos-login__submit focus-visible:ring-0 focus-visible:ring-offset-0"
            data-testid="login-submit"
          >
            {loading ? (
              <>
                <Loader2 className="livreos-login__submit-icon animate-spin" aria-hidden="true" />
                Entrando...
              </>
            ) : (
              <>
                <LogIn className="livreos-login__submit-icon" aria-hidden="true" />
                Entrar
              </>
            )}
          </Button>
        </form>

        <div className="livreos-login__footer">
          Quer cadastrar sua empresa?{" "}
          <a href="/cadastro-empresa" className="livreos-login__link livreos-login__link--strong">
            Criar conta grátis
          </a>
        </div>
      </section>

      {/* 4. Cinco segmentos — vidro esmeralda com contorno neon */}
      <section className="livreos-login__segments" aria-label="Segmentos atendidos">
        <ul className="livreos-login__segment-list" data-testid="login-segments">
          {SEGMENTOS.map(({ label, Icon }) => (
            <li key={label} className="livreos-login__segment">
              <Icon aria-hidden="true" className="livreos-login__segment-icon" />
              <span className="livreos-login__segment-label">{label}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
