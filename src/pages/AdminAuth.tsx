import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

const emailSchema = z.string().email("E-mail inválido");
const passwordSchema = z.string().min(6, "Senha é obrigatória");

export default function AdminAuth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session) return;
      const { data: pa } = await supabase
        .from("platform_admins" as any)
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!cancelled && pa) navigate("/admin/dashboard", { replace: true });
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) throw error || new Error("Credenciais inválidas");

      const { data: pa } = await supabase
        .from("platform_admins" as any)
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (!pa) {
        await supabase.auth.signOut();
        toast.error("Conta sem acesso administrativo.");
        return;
      }

      toast.success("Bem-vindo, administrador!");
      navigate("/admin/dashboard", { replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Usuário ou senha incorretos");
    } finally {
      setLoading(false);
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
              <Label htmlFor="admin-email" className="text-gray-300">
                E-mail
              </Label>
              <div className="relative">
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@livreos.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
