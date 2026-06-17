import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, User, Bell, Shield, Database, Globe, Save, Key, Info, Zap, Loader2, Users, Trash2, UserPlus, CreditCard, Camera } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useConfirm";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { SEGMENTOS } from "@/lib/equipment-segments";
import { useOrgSegments } from "@/hooks/useOrgSegments";
import { Checkbox } from "@/components/ui/checkbox";

type Profile = Tables<"profiles">;
type UserRole = Tables<"user_roles">;

interface UserWithRole extends Profile {
  role?: string;
}

export default function Configuracoes() {
  const { user, role } = useAuth();
  const confirm = useConfirm();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ nome: "", email: "", telefone: "" });
  const [settings, setSettings] = useState({ alertasEstoque: true, notificacoesEmail: true, smsUrgentes: false });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // User management
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [addUserDialog, setAddUserDialog] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ email: "", password: "", nome: "", role: "consulta" });

  useEffect(() => { if (user) { fetchProfile(); fetchUsers(); } }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
      if (error) throw error;
      if (data) { setProfile(data); setProfileForm({ nome: data.nome, email: data.email, telefone: data.telefone || "" }); }
    } catch (error: any) { console.error('Error fetching profile:', error); } finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').order('nome');
      if (pErr) throw pErr;
      const { data: roles, error: rErr } = await supabase.from('user_roles').select('*');
      if (rErr) throw rErr;
      
      const usersWithRoles: UserWithRole[] = (profiles || []).map(p => ({
        ...p,
        role: roles?.find(r => r.user_id === p.id)?.role || 'consulta'
      }));
      setUsers(usersWithRoles);
    } catch (error: any) { console.error('Error fetching users:', error); } finally { setUsersLoading(false); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione um arquivo de imagem'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem deve ter no máximo 5MB'); return; }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: avatarUrl } as any).eq('id', user.id);
      if (updateError) throw updateError;

      toast.success('Foto de perfil atualizada!');
      fetchProfile();
    } catch (error: any) { toast.error('Erro ao enviar foto: ' + error.message); } finally { setUploadingAvatar(false); }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ nome: profileForm.nome, telefone: profileForm.telefone || null }).eq('id', user.id);
      if (error) throw error;
      toast.success('Perfil atualizado com sucesso!');
      fetchProfile();
    } catch (error: any) { toast.error('Erro ao atualizar perfil: ' + error.message); } finally { setSaving(false); }
  };

  const handleChangeUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase.from('user_roles').update({ role: newRole as any }).eq('user_id', userId);
      if (error) throw error;
      toast.success('Papel atualizado!');
      fetchUsers();
    } catch (error: any) { toast.error('Erro: ' + error.message); }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === user?.id) { toast.error('Você não pode excluir seu próprio usuário'); return; }
    if (!await confirm({ title: 'Remover usuário', description: 'Esta ação não pode ser desfeita.', variant: 'destructive', confirmText: 'Remover' })) return;
    try {
      // Remove role and profile (cascade will handle auth user)
      await supabase.from('user_roles').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('id', userId);
      toast.success('Usuário removido!');
      fetchUsers();
    } catch (error: any) { toast.error('Erro: ' + error.message); }
  };

  const getRoleBadge = (r?: string) => {
    switch (r) {
      case 'admin': return <Badge className="bg-primary text-primary-foreground">Administrador</Badge>;
      case 'tecnico': return <Badge variant="secondary">Técnico</Badge>;
      case 'consulta': return <Badge variant="outline">Consulta</Badge>;
      default: return null;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Settings className="h-8 w-8 text-primary" />Configurações</h1>
            <p className="text-muted-foreground">Gerencie as configurações do sistema e seu perfil</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 shadow-soft">
            <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" />Meu Perfil</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (
                <>
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                    <div className="relative group">
                      <Avatar className="h-16 w-16">
                        {profile?.avatar_url ? (
                          <AvatarImage src={profile.avatar_url} alt={profile.nome} />
                        ) : null}
                        <AvatarFallback className="bg-primary/20 text-primary text-xl">
                          {profile?.nome?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        {uploadingAvatar ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                      </label>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{profile?.nome}</h3>
                      <p className="text-sm text-muted-foreground">{profile?.email}</p>
                      <div className="mt-1">{getRoleBadge(role || undefined)}</div>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><label className="text-sm font-medium">Nome</label><Input value={profileForm.nome} onChange={(e) => setProfileForm({ ...profileForm, nome: e.target.value })} /></div>
                    <div className="space-y-2"><label className="text-sm font-medium">E-mail</label><Input value={profileForm.email} disabled className="bg-muted" /></div>
                    <div className="space-y-2"><label className="text-sm font-medium">Telefone</label><Input value={profileForm.telefone} onChange={(e) => setProfileForm({ ...profileForm, telefone: e.target.value })} placeholder="(00) 00000-0000" /></div>
                  </div>
                  <Button className="gradient-primary shadow-medium" onClick={handleSaveProfile} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar Alterações
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />Segurança</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start" onClick={async () => {
                  const { error } = await supabase.auth.resetPasswordForEmail(profile?.email || '', { redirectTo: window.location.origin });
                  if (error) toast.error('Erro: ' + error.message);
                  else toast.success('E-mail de redefinição enviado!');
                }}><Key className="mr-2 h-4 w-4" />Alterar Senha</Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => toast.info('Você está na sessão atual. Para encerrar outras sessões, altere sua senha.')}><Shield className="mr-2 h-4 w-4" />Sessões Ativas</Button>
              </CardContent>
            </Card>
            <Card className="shadow-soft">
              <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />Sistema</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm"><span>Versão</span><span className="font-medium">LivreOS v1.0.0</span></div>
                <div className="flex justify-between text-sm"><span>Status</span><Badge className="bg-success text-success-foreground">Online</Badge></div>
                <div className="flex justify-between text-sm"><span>Seu Perfil</span>{getRoleBadge(role || undefined)}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* User Management - Admin only */}
        <Card className="shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Gerenciamento de Usuários</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-4">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {(u as any).avatar_url ? <AvatarImage src={(u as any).avatar_url} alt={u.nome} /> : null}
                        <AvatarFallback className="bg-primary/20 text-primary">{u.nome?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{u.nome}</p>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Select value={u.role} onValueChange={(v) => handleChangeUserRole(u.id, v)}>
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Notificações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between"><div className="space-y-1"><p className="font-medium">Alertas de Estoque Baixo</p><p className="text-sm text-muted-foreground">Receber notificações quando itens atingirem o nível mínimo</p></div><Switch checked={settings.alertasEstoque} onCheckedChange={(checked) => setSettings({ ...settings, alertasEstoque: checked })} /></div>
            <div className="flex items-center justify-between"><div className="space-y-1"><p className="font-medium">Notificações por E-mail</p><p className="text-sm text-muted-foreground">Enviar resumos diários por e-mail</p></div><Switch checked={settings.notificacoesEmail} onCheckedChange={(checked) => setSettings({ ...settings, notificacoesEmail: checked })} /></div>
            <div className="flex items-center justify-between"><div className="space-y-1"><p className="font-medium">SMS de OS Urgentes</p><p className="text-sm text-muted-foreground">Enviar SMS para OS com prioridade alta</p></div><Switch checked={settings.smsUrgentes} onCheckedChange={(checked) => setSettings({ ...settings, smsUrgentes: checked })} /></div>
          </CardContent>
        </Card>

        <SegmentosCard />

        <Card className="shadow-soft">

          <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" />Integrações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3"><Globe className="h-5 w-5 text-primary" /><div><p className="font-medium">API REST</p><p className="text-sm text-muted-foreground">Acesso à API para integrações externas</p></div></div>
              <Badge className="bg-success text-success-foreground">Ativa</Badge>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3"><CreditCard className="h-5 w-5 text-primary" /><div><p className="font-medium">Asaas</p><p className="text-sm text-muted-foreground">Cobranças via Pix, Boleto e Cartão</p></div></div>
              <Badge className="bg-success text-success-foreground">Configurada</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
