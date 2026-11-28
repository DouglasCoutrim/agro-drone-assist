import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Switch } from "@/components/ui/switch";
import { Users, Shield, CheckCircle, X, Loader2, Save } from "lucide-react";

type AppRole = "admin" | "tecnico" | "consulta";

interface UserWithPerms {
  id: string;
  nome: string;
  email: string;
  role: AppRole;
  roles: AppRole[];
  pode_finalizar_os: boolean;
}

export default function Permissoes() {
  const { user, role, isAdmin } = useAuth();
  const { organization, isPlatformAdmin: isPlatformAdminOrg } = useOrganization();
  const [users, setUsers] = useState<UserWithPerms[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Buscar perfis
      let profilesQuery = supabase.from("profiles").select("id, nome, email, organization_id");
      if (organization?.id && !isPlatformAdminOrg) {
        profilesQuery = profilesQuery.eq("organization_id", organization.id);
      }
      const { data: profiles, error: profilesError } = await profilesQuery.order("nome");
      if (profilesError) throw profilesError;

      // Buscar roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rolesError) throw rolesError;

      // Buscar permissões
      const { data: permsData, error: permsError } = await supabase
        .from("user_permissions")
        .select("*");
      if (permsError) throw permsError;

      const usersData: UserWithPerms[] = (profiles || []).map((p: any) => {
        const assignedRoles = (rolesData || [])
          .filter((r: any) => r.user_id === p.id)
          .map((r: any) => r.role as AppRole);
        const effectiveRole = (["admin", "tecnico", "consulta"] as AppRole[]).find((c) =>
          assignedRoles.includes(c)
        ) ?? "consulta";

        const permData = (permsData || []).find((pm: any) => pm.user_id === p.id);
        // Sem linha em user_permissions o padrão é o papel: admin e técnico já finalizam OS.
        const podeFinalizar = permData?.pode_finalizar_os ??
          (effectiveRole === "admin" || effectiveRole === "tecnico");

        return {
          id: p.id,
          nome: p.nome,
          email: p.email,
          role: effectiveRole,
          roles: assignedRoles.length ? assignedRoles : ["consulta"],
          pode_finalizar_os: podeFinalizar,
        };
      });

      setUsers(usersData);
    } catch (error: any) {
      console.error("Erro ao buscar usuários:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!organization?.id) return;
    setSaving(true);
    try {
      // Atualizar permissões para cada usuário
      for (const u of users) {
        // user_permissions não tem organization_id: a organização vem do próprio usuário.
        const { error } = await supabase
          .from("user_permissions")
          .upsert({
            user_id: u.id,
            pode_finalizar_os: u.pode_finalizar_os,
          }, { onConflict: "user_id" });
        if (error) throw error;
      }
      toast.success("Permissões salvas com sucesso!");
    } catch (err: any) {
      console.error("Erro ao salvar permissões:", err);
      toast.error("Erro ao salvar permissões: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, pode_finalizar_os: !u.pode_finalizar_os } : u
      )
    );
  };

  /** Admin e técnico já finalizam OS — o interruptor só muda algo para os outros papéis. */
  const semprePodeFinalizar = (u: UserWithPerms) => u.roles.includes("admin") || u.roles.includes("tecnico");
  const canUserFinalize = (u: UserWithPerms) => semprePodeFinalizar(u) || u.pode_finalizar_os === true;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 data-tour="permissoes-page" className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />Permissões de OS
            </h1>
            <p className="text-muted-foreground">
              Configure quem pode finalizar ordens de serviço
            </p>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              onClick={handleSavePermissions}
              disabled={saving}
              className="gradient-primary shadow-medium"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="py-16 text-center space-y-3">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-medium">Nenhum usuário encontrado</p>
                <p className="text-sm text-muted-foreground">
                  Verifique se a organização está configurada corretamente.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Usuários da Equipe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {users.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 border-b last:border-0 py-3"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                                          variant={
                                            member.role === "admin"
                                              ? "default"
                                              : member.role === "tecnico"
                                              ? "secondary"
                                              : "outline"
                                          }
                                        >
                      {member.role}
                    </Badge>
                    <span className="font-medium">{member.nome}</span>
                    <span className="text-sm text-muted-foreground">
                      {member.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <Switch
                      checked={canUserFinalize(member)}
                      onCheckedChange={() => togglePermission(member.id)}
                      disabled={isPlatformAdminOrg || semprePodeFinalizar(member)}
                      aria-label={`Permitir que ${member.nome} finalize OS`}
                    />
                    {canUserFinalize(member) && (
                      <Badge className="bg-green-600 text-white text-[9px]">
                        {semprePodeFinalizar(member) ? "Finaliza pelo papel" : "Pode finalizar OS"}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}