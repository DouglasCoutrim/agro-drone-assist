import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, User, Shield, Loader2, Trash2, FileText, Package, DollarSign, UserPlus } from "lucide-react";
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
  const { user, role, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRoleAndPerms[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newMember, setNewMember] = useState({ nome: "", email: "", senha: "", role: "consulta" });

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

  const handleAddMember = async () => {
    if (!newMember.nome.trim() || !newMember.email.trim() || !newMember.senha.trim()) {
      toast.error('Nome, Email e Senha são obrigatórios');
      return;
    }
    setAddLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          nome: newMember.nome,
          email: newMember.email,
          senha: newMember.senha,
          role: newMember.role,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Membro adicionado com sucesso! Ele já pode fazer login.');
      setAddDialogOpen(false);
      setNewMember({ nome: "", email: "", senha: "", role: "consulta" });
      fetchUsers();
    } catch (error: any) {
      toast.error('Erro ao adicionar membro: ' + error.message);
    } finally {
      setAddLoading(false);
    }
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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />Gerenciamento de Equipe
            </h1>
            <p className="text-muted-foreground">Gerencie membros da equipe e suas permissões de acesso</p>
          </div>

          {isAdmin && (
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary shadow-medium">
                  <UserPlus className="mr-2 h-4 w-4" />Adicionar Membro
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Membro da Equipe</DialogTitle>
                  <DialogDescription>Adicione um novo membro ao sistema</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome Completo *</Label>
                    <Input value={newMember.nome} onChange={(e) => setNewMember({ ...newMember, nome: e.target.value })} placeholder="Nome do membro" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" value={newMember.email} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} placeholder="email@exemplo.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha</Label>
                    <Input type="password" value={newMember.senha} onChange={(e) => setNewMember({ ...newMember, senha: e.target.value })} placeholder="Senha inicial" />
                  </div>
                  <div className="space-y-2">
                    <Label>Função</Label>
                    <Select value={newMember.role} onValueChange={(v) => setNewMember({ ...newMember, role: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="tecnico">Técnico</SelectItem>
                        <SelectItem value="consulta">Atendimento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full gradient-primary" onClick={handleAddMember} disabled={addLoading}>
                    {addLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Adicionar à Equipe
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
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
                            <SelectItem value="consulta">Atendimento</SelectItem>
                          </SelectContent>
                        </Select>
                        {u.id !== user?.id && (
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(u.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>

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
