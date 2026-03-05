import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, User, Shield, Loader2, Trash2, FileText, Package, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

interface UserWithRoleAndPerms extends Profile {
  role?: string;
  permissions?: {
    acesso_os: boolean;
    acesso_estoque: boolean;
    acesso_financeiro: boolean;
  };
}

export default function Equipe() {
  const { user, role } = useAuth();
  const [users, setUsers] = useState<UserWithRoleAndPerms[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [profilesRes, rolesRes, permsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('nome'),
        supabase.from('user_roles').select('*'),
        supabase.from('user_permissions').select('*'),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const usersData: UserWithRoleAndPerms[] = (profilesRes.data || []).map(p => {
        const roleData = rolesRes.data?.find(r => r.user_id === p.id);
        const permData = (permsRes.data as any[])?.find((pm: any) => pm.user_id === p.id);
        return {
          ...p,
          role: roleData?.role || 'consulta',
          permissions: permData ? {
            acesso_os: permData.acesso_os,
            acesso_estoque: permData.acesso_estoque,
            acesso_financeiro: permData.acesso_financeiro,
          } : { acesso_os: true, acesso_estoque: true, acesso_financeiro: false }
        };
      });
      setUsers(usersData);
    } catch (error: any) { toast.error('Erro ao carregar equipe'); } finally { setLoading(false); }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase.from('user_roles').update({ role: newRole as any }).eq('user_id', userId);
      if (error) throw error;
      toast.success('Papel atualizado!');
      fetchUsers();
    } catch (error: any) { toast.error('Erro: ' + error.message); }
  };

  const handleTogglePermission = async (userId: string, field: string, value: boolean) => {
    try {
      const { error } = await supabase.from('user_permissions').update({ [field]: value } as any).eq('user_id', userId);
      if (error) throw error;
      // Update local state immediately
      setUsers(prev => prev.map(u => u.id === userId ? {
        ...u, permissions: { ...u.permissions!, [field]: value }
      } : u));
      toast.success('Permissão atualizada!');
    } catch (error: any) { toast.error('Erro: ' + error.message); }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === user?.id) { toast.error('Você não pode excluir seu próprio usuário'); return; }
    if (!confirm('Tem certeza que deseja remover este membro?')) return;
    try {
      await supabase.from('user_permissions').delete().eq('user_id', userId);
      await supabase.from('user_roles').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('id', userId);
      toast.success('Membro removido!');
      fetchUsers();
    } catch (error: any) { toast.error('Erro: ' + error.message); }
  };

  const getRoleBadge = (r?: string) => {
    switch (r) {
      case 'admin': return <Badge className="bg-primary text-primary-foreground">Admin</Badge>;
      case 'tecnico': return <Badge variant="secondary">Técnico</Badge>;
      default: return <Badge variant="outline">Consulta</Badge>;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />Gerenciamento de Equipe
          </h1>
          <p className="text-muted-foreground">Gerencie membros da equipe e suas permissões de acesso</p>
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />Membros e Permissões
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><Users className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Nenhum membro encontrado</p></div>
            ) : (
              <div className="space-y-6">
                {users.map((u) => (
                  <div key={u.id} className="border rounded-lg p-5 hover:bg-muted/30 transition-colors space-y-4">
                    {/* User info row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{u.nome}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Select value={u.role} onValueChange={(v) => handleChangeRole(u.id, v)}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="tecnico">Técnico</SelectItem>
                            <SelectItem value="consulta">Consulta</SelectItem>
                          </SelectContent>
                        </Select>
                        {u.id !== user?.id && (
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(u.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Permissions row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-13">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Acesso a OS</span>
                        </div>
                        <Switch
                          checked={u.permissions?.acesso_os ?? true}
                          onCheckedChange={(v) => handleTogglePermission(u.id, 'acesso_os', v)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Acesso a Estoque</span>
                        </div>
                        <Switch
                          checked={u.permissions?.acesso_estoque ?? true}
                          onCheckedChange={(v) => handleTogglePermission(u.id, 'acesso_estoque', v)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Acesso Financeiro</span>
                        </div>
                        <Switch
                          checked={u.permissions?.acesso_financeiro ?? false}
                          onCheckedChange={(v) => handleTogglePermission(u.id, 'acesso_financeiro', v)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
