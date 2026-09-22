import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, User, Shield, Loader2, Trash2, FileText, Package, DollarSign, UserPlus, Pencil, LayoutDashboard, Wrench, Settings, BookOpen, Bell, BarChart3, Navigation, CreditCard, ClipboardList, MapPin, Monitor, UserRound, Building2, LifeBuoy } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { useUsageLimits } from "@/hooks/useUsageLimits";
import { UpgradePlanModal } from "@/components/UpgradePlanModal";
import { useConfirm } from "@/hooks/useConfirm";
import { CommissionEditor } from "@/components/commission/CommissionEditor";

type Profile = Tables<"profiles">;

interface UserWithRoleAndPerms extends Profile {
  role?: string;
  roles: AppRole[];
  permissions?: {
    acesso_dashboard: boolean;
    acesso_os: boolean;
    acesso_meu_painel: boolean;
    acesso_oficina_vivo: boolean;
    acesso_clientes: boolean;
    acesso_estoque: boolean;
    acesso_servicos: boolean;
    acesso_financeiro: boolean;
    acesso_cobrancas: boolean;
    acesso_orcamentos: boolean;
    acesso_rotas: boolean;
    acesso_relatorios: boolean;
    acesso_equipe: boolean;
    acesso_empresa: boolean;
    acesso_configuracoes: boolean;
    acesso_checklist: boolean;
    acesso_notificacoes: boolean;
    acesso_wiki: boolean;
    acesso_suporte: boolean;
  };
}

type AppRole = 'admin' | 'tecnico' | 'consulta';
const ROLE_OPTIONS: Array<{ value: AppRole; label: string }> = [
  { value: 'admin', label: 'Administrador' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'consulta', label: 'Atendimento' },
];

const getCreateMemberError = async (error: unknown) => {
  const fallback = error instanceof Error ? error.message : 'Não foi possível adicionar o membro';
  const context = typeof error === 'object' && error !== null && 'context' in error
    ? (error as { context?: Response }).context
    : undefined;

  if (context) {
    try {
      const payload = await context.clone().json() as { error?: string };
      if (payload.error) return payload.error;
    } catch {
      // A resposta pode não conter JSON; nesse caso, usa a mensagem padrão.
    }
  }

  return fallback;
};

export default function Equipe() {
  const { user, role, isAdmin } = useAuth();
  const confirm = useConfirm();
  const [users, setUsers] = useState<UserWithRoleAndPerms[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newMember, setNewMember] = useState<{ nome: string; email: string; senha: string; roles: AppRole[] }>({ nome: "", email: "", senha: "", roles: ["consulta"] });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserWithRoleAndPerms | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", email: "" });

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
        const assignedRoles = (rolesRes.data || []).filter(r => r.user_id === p.id).map(r => r.role as AppRole);
        const effectiveRole = ROLE_OPTIONS.find(({ value }) => assignedRoles.includes(value))?.value || 'consulta';
        const permData = (permsRes.data as any[])?.find((pm: any) => pm.user_id === p.id);
        return {
          ...p,
          role: effectiveRole,
          roles: assignedRoles.length ? assignedRoles : ['consulta'],
          permissions: permData ? {
            acesso_dashboard: permData.acesso_dashboard ?? true,
            acesso_os: permData.acesso_os ?? true,
            acesso_meu_painel: permData.acesso_meu_painel ?? true,
            acesso_oficina_vivo: permData.acesso_oficina_vivo ?? true,
            acesso_clientes: permData.acesso_clientes ?? true,
            acesso_estoque: permData.acesso_estoque ?? true,
            acesso_servicos: permData.acesso_servicos ?? true,
            acesso_financeiro: permData.acesso_financeiro ?? false,
            acesso_cobrancas: permData.acesso_cobrancas ?? false,
            acesso_orcamentos: permData.acesso_orcamentos ?? true,
            acesso_rotas: permData.acesso_rotas ?? true,
            acesso_relatorios: permData.acesso_relatorios ?? true,
            acesso_equipe: permData.acesso_equipe ?? true,
            acesso_empresa: permData.acesso_empresa ?? true,
            acesso_configuracoes: permData.acesso_configuracoes ?? true,
            acesso_checklist: permData.acesso_checklist ?? true,
            acesso_notificacoes: permData.acesso_notificacoes ?? true,
            acesso_wiki: permData.acesso_wiki ?? true,
            acesso_suporte: permData.acesso_suporte ?? true,
          } : { acesso_dashboard: true, acesso_os: true, acesso_meu_painel: true, acesso_oficina_vivo: true, acesso_clientes: true, acesso_estoque: true, acesso_servicos: true, acesso_financeiro: false, acesso_cobrancas: false, acesso_orcamentos: true, acesso_rotas: true, acesso_relatorios: true, acesso_equipe: true, acesso_empresa: true, acesso_configuracoes: true, acesso_checklist: true, acesso_notificacoes: true, acesso_wiki: true, acesso_suporte: true }
        };
      });
      setUsers(usersData);
    } catch (error: any) { toast.error('Erro ao carregar equipe'); } finally { setLoading(false); }
  };

  const handleChangeRoles = async (userId: string, currentRoles: AppRole[], changedRole: AppRole, checked: boolean) => {
    const nextRoles = checked ? [...new Set([...currentRoles, changedRole])] : currentRoles.filter((assignedRole) => assignedRole !== changedRole);
    if (nextRoles.length === 0) { toast.error('Selecione pelo menos um papel'); return; }
    try {
      const { error } = await supabase.rpc('set_user_roles', { _user_id: userId, _roles: nextRoles });
      if (error) throw error;
      toast.success('Papéis atualizados!');
      fetchUsers();
    } catch (error: any) { toast.error('Erro: ' + error.message); }
  };

  const toggleNewMemberRole = (changedRole: AppRole, checked: boolean) => {
    setNewMember((current) => ({ ...current, roles: checked ? [...new Set([...current.roles, changedRole])] : current.roles.filter((assignedRole) => assignedRole !== changedRole) }));
  };

  const handleTogglePermission = async (userId: string, field: string, value: boolean) => {
    try {
      const current = users.find(u => u.id === userId)?.permissions;
      const allPerms = { ...current, [field]: value };
      const payload = {
        user_id: userId,
        ...allPerms,
      };
      const { error } = await supabase.from('user_permissions').upsert(payload as any, { onConflict: 'user_id' });
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? {
        ...u, permissions: { ...u.permissions!, [field]: value }
      } : u));
      toast.success('Permissão atualizada!');
    } catch (error: any) { toast.error('Erro: ' + error.message); }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === user?.id) { toast.error('Você não pode excluir seu próprio usuário'); return; }
    if (!await confirm({ title: 'Remover membro', description: 'Esta ação não pode ser desfeita.', variant: 'destructive', confirmText: 'Remover' })) return;
    try {
      await supabase.from('user_permissions').delete().eq('user_id', userId);
      await supabase.from('user_roles').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('id', userId);
      toast.success('Membro removido!');
      fetchUsers();
    } catch (error: any) { toast.error('Erro: ' + error.message); }
  };

  const { canInviteUser, usersUsed, usersLimit, plan } = useUsageLimits();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleAddMember = async () => {
    const nome = newMember.nome.trim();
    const email = newMember.email.trim().toLowerCase();
    const senha = newMember.senha;
    if (!nome || !email || !senha) {
      toast.error('Nome, e-mail e senha são obrigatórios');
      return;
    }
    if (senha.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres');
      return;
    }
    if (newMember.roles.length === 0) { toast.error('Selecione pelo menos um papel'); return; }
    if (!canInviteUser) { setShowUpgrade(true); return; }
    setAddLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          nome,
          email,
          senha,
          roles: newMember.roles,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Membro adicionado com sucesso! Ele já pode fazer login.');
      setAddDialogOpen(false);
      setNewMember({ nome: "", email: "", senha: "", roles: ["consulta"] });
      fetchUsers();
    } catch (error: unknown) {
      toast.error(await getCreateMemberError(error));
    } finally {
      setAddLoading(false);
    }
  };

  const openEditDialog = (u: UserWithRoleAndPerms) => {
    setEditUser(u);
    setEditForm({ nome: u.nome, email: u.email });
    setEditDialogOpen(true);
  };

  const handleEditUser = async () => {
    if (!editUser || !editForm.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    try {
      const { error } = await supabase.from('profiles').update({ nome: editForm.nome }).eq('id', editUser.id);
      if (error) throw error;
      toast.success('Dados atualizados!');
      setEditDialogOpen(false);
      fetchUsers();
    } catch (error: any) { toast.error('Erro: ' + error.message); }
  };

  const getRoleBadge = (r?: string) => {
    switch (r) {
      case 'admin': return <Badge className="bg-primary text-primary-foreground">Admin</Badge>;
      case 'tecnico': return <Badge variant="secondary">Técnico</Badge>;
      default: return <Badge variant="outline">Atendimento</Badge>;
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
            <div className="flex flex-col items-end gap-1">
              <Button className="gradient-primary shadow-medium" onClick={() => {
                if (!canInviteUser) { setShowUpgrade(true); return; }
                setAddDialogOpen(true);
              }}>
                <UserPlus className="mr-2 h-4 w-4" />Adicionar Membro
              </Button>
              {usersLimit !== -1 && (
                <span className="text-[10px] text-muted-foreground">{usersUsed}/{usersLimit} usuários</span>
              )}
            </div>
          )}
          <UpgradePlanModal open={showUpgrade} onOpenChange={setShowUpgrade} reason="users" currentPlan={plan} />
          {isAdmin && (
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
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
                    <Label>Senha *</Label>
                    <Input type="password" minLength={8} maxLength={128} autoComplete="new-password" value={newMember.senha} onChange={(e) => setNewMember({ ...newMember, senha: e.target.value })} placeholder="Senha inicial forte" />
                    <p className="text-xs text-muted-foreground">Use pelo menos 8 caracteres e evite senhas comuns ou fáceis de adivinhar.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Papéis *</Label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {ROLE_OPTIONS.map((option) => (
                        <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border p-3 text-sm">
                          <Checkbox checked={newMember.roles.includes(option.value)} onCheckedChange={(checked) => toggleNewMemberRole(option.value, checked === true)} />
                          {option.label}
                        </label>
                      ))}
                    </div>
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
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          {(u as any).avatar_url ? <AvatarImage src={(u as any).avatar_url} alt={u.nome} /> : null}
                          <AvatarFallback className="bg-primary/20 text-primary">{u.nome?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{u.nome}</p>
                          <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                         {isAdmin ? (
                           <div className="flex flex-wrap gap-2" aria-label={`Papéis de ${u.nome}`}>
                             {ROLE_OPTIONS.map((option) => (
                               <label key={option.value} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 text-xs">
                                 <Checkbox checked={u.roles.includes(option.value)} disabled={u.id === user?.id && option.value === 'admin'} onCheckedChange={(checked) => handleChangeRoles(u.id, u.roles, option.value, checked === true)} />
                                 {option.label}
                               </label>
                             ))}
                           </div>
                         ) : (
                           <div className="flex flex-wrap gap-1">{u.roles.map((assignedRole) => <span key={assignedRole}>{getRoleBadge(assignedRole)}</span>)}</div>
                         )}
                        {isAdmin && u.id !== user?.id && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openEditDialog(u)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(u.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

<div className="space-y-4 sm:pl-13">
                      {/* PRINCIPAL */}
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Principal</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {[
                            { key: 'acesso_dashboard', label: 'Dashboard', icon: LayoutDashboard },
                            { key: 'acesso_os', label: 'Ordens de Serviço', icon: FileText },
                            { key: 'acesso_meu_painel', label: 'Meu Painel', icon: Wrench },
                            { key: 'acesso_oficina_vivo', label: 'Oficina ao Vivo', icon: Monitor },
                            { key: 'acesso_clientes', label: 'Clientes', icon: Users },
                          ].map(item => (
                            <div key={item.key} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2">
                                <item.icon className="h-3.5 w-3.5 text-primary" />
                                <span className="text-xs font-medium">{item.label}</span>
                              </div>
                              <Switch checked={u.permissions?.[item.key as keyof typeof u.permissions] ?? true} onCheckedChange={(v) => handleTogglePermission(u.id, item.key, v)} />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* GESTÃO */}
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Gestão</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {[
                            { key: 'acesso_estoque', label: 'Estoque', icon: Package },
                            { key: 'acesso_servicos', label: 'Serviços', icon: Wrench },
                            { key: 'acesso_financeiro', label: 'Financeiro', icon: DollarSign },
                            { key: 'acesso_cobrancas', label: 'Cobranças', icon: CreditCard },
                            { key: 'acesso_orcamentos', label: 'Orçamentos', icon: ClipboardList },
                            { key: 'acesso_rotas', label: 'Rotas', icon: Navigation },
                            { key: 'acesso_relatorios', label: 'Relatórios', icon: BarChart3 },
                          ].map(item => (
                            <div key={item.key} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2">
                                <item.icon className="h-3.5 w-3.5 text-primary" />
                                <span className="text-xs font-medium">{item.label}</span>
                              </div>
                              <Switch checked={u.permissions?.[item.key as keyof typeof u.permissions] ?? true} onCheckedChange={(v) => handleTogglePermission(u.id, item.key, v)} />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* SISTEMA */}
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Sistema</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {[
                            { key: 'acesso_equipe', label: 'Equipe', icon: UserRound },
                            { key: 'acesso_empresa', label: 'Empresa', icon: Building2 },
                            { key: 'acesso_configuracoes', label: 'Configurações', icon: Settings },
                            { key: 'acesso_checklist', label: 'Checklist de OS', icon: ClipboardList },
                            { key: 'acesso_notificacoes', label: 'Notificações', icon: Bell },
                            { key: 'acesso_wiki', label: 'Central de Ajuda', icon: BookOpen },
                            { key: 'acesso_suporte', label: 'Suporte', icon: LifeBuoy },
                          ].map(item => (
                            <div key={item.key} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2">
                                <item.icon className="h-3.5 w-3.5 text-primary" />
                                <span className="text-xs font-medium">{item.label}</span>
                              </div>
                              <Switch checked={u.permissions?.[item.key as keyof typeof u.permissions] ?? true} onCheckedChange={(v) => handleTogglePermission(u.id, item.key, v)} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {isAdmin && u.roles.includes('tecnico') && (
                      <div className="sm:pl-14">
                        <CommissionEditor profile={u as any} onSaved={fetchUsers} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Membro</DialogTitle>
              <DialogDescription>Altere os dados do membro da equipe</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editForm.email} disabled className="opacity-60" />
                <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
              </div>
              <Button className="w-full gradient-primary" onClick={handleEditUser}>
                <Pencil className="mr-2 h-4 w-4" />Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
