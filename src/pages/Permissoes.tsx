import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Shield, CheckCircle, X, Loader2 } from "lucide-react";

type UserPermission = {
  user_id: string;
  user_name: string;
  role: "admin" | "tecnico" | "consulta";
  can_finalize_os: boolean;
};

export default function Permissoes() {
  const { user, role, isAdmin } = useAuth();
  const { organization, isPlatformAdmin } = useOrganization();
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; nome: string; role: string }>>([]);
  const [permissions, setPermissions] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTeamMembers();
    fetchPermissions();
  }, []);

  const fetchTeamMembers = async () => {
    if (!organization?.id || isPlatformAdmin) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, role")
        .eq("organization_id", organization?.id)
        .order("nome");
      if (error) throw error;
      setTeamMembers(data || []);
      return;
    }
    // For platform admin, fetch all
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, role")
      .order("nome");
    if (error) throw error;
    setTeamMembers(data || []);
  };

  const fetchPermissions = async () => {
    try {
      // Try to get existing permissions from a config table or create default
      let { data, error } = await supabase
        .from("os_permissions")
        .select("*")
        .eq("organization_id", organization?.id);

      if (error || !data || data.length === 0) {
        // Create default permissions: admins can finalize, technicians can finalize, consulta cannot
        const defaultPerms = teamMembers.map((tm: any) => ({
          organization_id: organization?.id,
          user_id: tm.id,
          role: tm.role,
          can_finalize_os: tm.role === "admin" || tm.role === "tecnico",
        }));
        
        const { error: insError } = await supabase
          .from("os_permissions")
          .insert(defaultPerms);
        
        if (insError) throw insError;
        setPermissions(new Map(defaultPerms.map(p => [p.user_id, p.can_finalize_os])));
        return;
      }

      setPermissions(new Map(data.map((p: any) => [p.user_id, p.can_finalize_os])));
    } catch (err: any) {
      console.error("Erro ao buscar permissões:", err);
      toast.error("Erro ao carregar permissões");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!organization?.id) return;
    setSaving(true);
    try {
      // First, delete existing permissions for this organization
      await supabase
        .from("os_permissions")
        .delete()
        .eq("organization_id", organization.id);
      
      // Then insert updated permissions
      const permData = Array.from(permissions.entries()).map(([user_id, canFinalize]) => ({
        organization_id: organization.id,
        user_id: user_id,
        can_finalize_os: canFinalize,
      }));
      
      const { error } = await supabase
        .from("os_permissions")
        .insert(permData);
      
      if (error) throw error;
      
      toast.success("Permissões salvas com sucesso!");
      setSaving(false);
    } catch (err: any) {
      console.error("Erro ao salvar permissões:", err);
      toast.error("Erro ao salvar permissões: " + err.message);
      setSaving(false);
    }
  };

  const togglePermission = (userId: string) => {
    setPermissions(prev => {
      const newPerms = new Map(prev);
      newPerms.set(userId, !newPerms.get(userId)!);
      return newPerms;
    });
  };

  const canUserFinalize = (userId: string): boolean => {
    // Admin always can
    if (isAdmin || isPlatformAdmin) return true;
    // Check explicit permission
    return permissions.get(userId) === true;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Shield className="h-8 w-8 text-primary" />Permissões de OS</h1>
            <p className="text-muted-foreground">Configure quem pode finalizar ordens de serviço</p>
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
              ) : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : teamMembers.length === 0 ? (
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
              {teamMembers.map((member: any) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 border-b last:border-0 py-3"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={member.role === "admin" ? "primary" : member.role === "tecnico" ? "secondary" : "outline"}
                    >
                      {member.role}
                    </Badge>
                    <span className="font-medium">{member.nome}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={canUserFinalize(member.id)}
                      onCheckedChange={(v) => togglePermission(member.id)}
                      disabled={isPlatformAdmin}
                      aria-label={`Permitir que ${member.nome} finalize OS`}
                    />
                    {canUserFinalize(member.id) && (
                      <Badge
                        className="bg-green-600 text-white text-[9px]"
                        >Pode finalizar OS</Badge
                      >
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