import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Building2, Users, LogIn, Loader2 } from "lucide-react";
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
  member_count?: number;
  owner_email?: string;
}

const GOD_MODE_EMAILS = ["douglas@voltmaster.com.br"];

export default function GodMode() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<OrgData[]>([]);
  const [loading, setLoading] = useState(true);

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

      // Fetch member counts and owner emails
      const enriched = await Promise.all(
        (data || []).map(async (org: any) => {
          const { count } = await supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id);

          const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", org.owner_id)
            .maybeSingle();

          return {
            ...org,
            member_count: count || 0,
            owner_email: ownerProfile?.email || "—",
          };
        })
      );

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
      // Update current user's profile to point to this org temporarily
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
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">God Mode</h1>
            <p className="text-sm text-muted-foreground">Painel administrativo do sistema</p>
          </div>
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
                      <TableHead>Criado em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgs.map((org) => (
                      <TableRow key={org.id}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{org.owner_email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {org.settings?.segmento || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>{org.member_count}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(org.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleImpersonate(org.id, org.name)}
                            className="gap-1"
                          >
                            <LogIn className="h-3.5 w-3.5" />
                            Entrar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {orgs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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