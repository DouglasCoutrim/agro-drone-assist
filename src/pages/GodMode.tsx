import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Building2, Users, LogIn, Loader2, FileText, Power, PowerOff, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface OrgData {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  settings: any;
  created_at: string;
  active: boolean;
  telefone: string | null;
  member_count?: number;
  owner_email?: string;
  os_count?: number;
}

const GOD_MODE_EMAILS = ["douglas@voltmaster.com.br"];

export default function GodMode() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<OrgData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOS, setTotalOS] = useState(0);

  const isAuthorized = user && GOD_MODE_EMAILS.includes(user.email || "");

  useEffect(() => {
    if (isAuthorized) fetchOrgs();
  }, [isAuthorized]);

  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      let osTotal = 0;

      const enriched = await Promise.all(
        (data || []).map(async (org: any) => {
          const { count: memberCount } = await supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id);

          const { count: osCount } = await supabase
            .from("ordens_servico")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id);

          const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", org.owner_id)
            .maybeSingle();

          osTotal += osCount || 0;

          return {
            ...org,
            member_count: memberCount || 0,
            os_count: osCount || 0,
            owner_email: ownerProfile?.email || "—",
          };
        })
      );

      setTotalOS(osTotal);
      setOrgs(enriched);
    } catch (err: any) {
      console.error("God Mode fetch error:", err);
      toast.error("Erro ao carregar organizações");
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async (orgId: string, orgName: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ organization_id: orgId } as any)
        .eq("id", user!.id);

      if (error) throw error;
      toast.success(`Agora você está como: ${orgName}. Recarregando...`);
      setTimeout(() => window.location.href = "/", 1000);
    } catch (err: any) {
      toast.error("Erro ao impersonar: " + err.message);
    }
  };

  const handleToggleActive = async (orgId: string, currentActive: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from("organizations")
        .update({ active: !currentActive })
        .eq("id", orgId);

      if (error) throw error;
      toast.success(currentActive ? "Empresa desativada" : "Empresa reativada");
      setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, active: !currentActive } : o));
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  if (!isAuthorized) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Shield className="h-16 w-16 text-destructive" />
          <h2 className="text-2xl font-bold">Acesso Negado</h2>
          <p className="text-muted-foreground">Esta página é restrita ao administrador do sistema.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">God Mode</h1>
              <p className="text-sm text-muted-foreground">Painel administrativo do sistema</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchOrgs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{orgs.length}</p>
                  <p className="text-sm text-muted-foreground">Organizações</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{orgs.reduce((a, o) => a + (o.member_count || 0), 0)}</p>
                  <p className="text-sm text-muted-foreground">Total de Usuários</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalOS}</p>
                  <p className="text-sm text-muted-foreground">Total de OS</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organizações Cadastradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Proprietário</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Membros</TableHead>
                      <TableHead>OS</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgs.map((org) => (
                      <TableRow key={org.id} className={!org.active ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{org.owner_email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{org.settings?.segmento || "—"}</Badge>
                        </TableCell>
                        <TableCell>{org.member_count}</TableCell>
                        <TableCell>{org.os_count}</TableCell>
                        <TableCell>
                          <Badge variant={org.active ? "default" : "destructive"}>
                            {org.active ? "Ativa" : "Desativada"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(org.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleImpersonate(org.id, org.name)}
                              className="gap-1"
                            >
                              <LogIn className="h-3.5 w-3.5" />
                              Entrar
                            </Button>
                            <Button
                              size="sm"
                              variant={org.active ? "destructive" : "default"}
                              onClick={() => handleToggleActive(org.id, org.active)}
                              className="gap-1"
                            >
                              {org.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                              {org.active ? "Desativar" : "Ativar"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {orgs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nenhuma organização cadastrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
