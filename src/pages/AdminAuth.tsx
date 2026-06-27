import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { z } from "zod";
import logo from "@/assets/logo.png";

const usernameSchema = z.string().min(1, "Usuário é obrigatório");
const passwordSchema = z.string().min(6, "Senha é obrigatória");

// Master admin config - map username to email
const ADMIN_USER_EMAIL_MAP: Record<string, string> = {
  admin: "douglas@admin.local",
  douglas: "douglas@admin.local",
};

export default function AdminAuth() {
  const navigate = useNavigate();
  const { signIn, signOut, user } = useAuth();
  const { isPlatformAdmin, loading: orgLoading } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    // Clear any legacy bypass flag — admin must have a real Supabase session
    // so RLS policies (is_platform_admin(auth.uid())) actually work.
    if (localStorage.getItem('admin_bypass')) {
      localStorage.removeItem('admin_bypass');
    }

    // If user is already logged in but is NOT a platform admin, sign them out
    if (user && !orgLoading && !isPlatformAdmin) {
      toast.error("Acesso restrito a administradores da plataforma");
      signOut();
    } else if (user && !orgLoading && isPlatformAdmin) {
      navigate("/admin/dashboard");
    }
  }, [user, isPlatformAdmin, orgLoading, navigate, signOut]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      usernameSchema.parse(username);
      passwordSchema.parse(password);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    // Map username to hidden master email
    const masterEmail = ADMIN_USER_EMAIL_MAP[username.toLowerCase()];
    if (!masterEmail) {
      toast.error("Usuário ou senha incorretos");
      return;
    }

    setLoading(true);
    let { error } = await signIn(masterEmail, password);

    // Self-heal: if the seeded master account doesn't exist yet, seed it and retry.
    if (error && error.message.includes("Invalid login credentials") && username.toLowerCase() === "douglas") {
      try {
        await (await import("@/integrations/supabase/client")).supabase.functions.invoke("seed-platform-admin");
        const retry = await signIn(masterEmail, password);
        error = retry.error;
      } catch {
        // ignore and fall through to error toast
      }
    }

    if (error) {
      setLoading(false);
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Usuário ou senha incorretos");
      } else {
        toast.error("Erro ao fazer login: " + error.message);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4 font-sans text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
      
      <Card className="w-full max-w-md shadow-2xl relative z-10 border-blue-500/20 bg-[#111111] text-white">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center flex-col items-center gap-2">
            <img src={logo} alt="LivreOS Admin" className="h-16 w-auto grayscale brightness-200" />
            <div className="flex items-center gap-2 text-blue-400 font-mono text-sm tracking-widest uppercase">
              <ShieldCheck className="h-4 w-4" />
              Portal Administrativo
            </div>
          </div>
          <CardDescription className="text-gray-400">
            Acesso exclusivo para administradores da plataforma LivreOS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="admin-username" className="text-gray-300">
                Usuário
              </Label>
              <div className="relative">
                <Input
                  id="admin-username"
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 bg-black/50 border-gray-800 focus:border-blue-500 text-white"
                  required
                  autoComplete="username"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-gray-300">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-black/50 border-gray-800 focus:border-blue-500 text-white"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>
            
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20 h-11"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Autenticando...
                </>
              ) : (
                "Entrar no Sistema"
              )}
            </Button>
            
            <div className="text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-tighter">
                Sua atividade está sendo monitorada por razões de segurança
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
      
      <div className="fixed bottom-4 text-gray-600 text-[10px] font-mono">LIVREOS ADMIN v2.1.0 • PWA STANDALONE</div>
    </div>
  );
}
