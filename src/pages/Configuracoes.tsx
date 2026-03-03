import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Settings, User, Bell, Shield, Database, Globe, Save, Key, Info, Plane, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export default function Configuracoes() {
  const { user, role } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ nome: "", email: "", telefone: "" });
  const [settings, setSettings] = useState({ alertasEstoque: true, notificacoesEmail: true, smsUrgentes: false });

  useEffect(() => { if (user) fetchProfile(); }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
      if (error) throw error;
      if (data) { setProfile(data); setProfileForm({ nome: data.nome, email: data.email, telefone: data.telefone || "" }); }
    } catch (error: any) { console.error('Error fetching profile:', error); } finally { setLoading(false); }
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

  const getRoleBadge = () => {
    switch (role) {
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
                    <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center"><User className="h-8 w-8 text-primary" /></div>
                    <div>
                      <h3 className="font-semibold text-lg">{profile?.nome}</h3>
                      <p className="text-sm text-muted-foreground">{profile?.email}</p>
                      <div className="mt-1">{getRoleBadge()}</div>
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
                <Button variant="outline" className="w-full justify-start"><Key className="mr-2 h-4 w-4" />Alterar Senha</Button>
                <Button variant="outline" className="w-full justify-start"><Shield className="mr-2 h-4 w-4" />Sessões Ativas</Button>
              </CardContent>
            </Card>
            <Card className="shadow-soft">
              <CardHeader><CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary" />Sistema</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm"><span>Versão</span><span className="font-medium">Ares Agrotec v1.0.0</span></div>
                <div className="flex justify-between text-sm"><span>Status</span><Badge className="bg-success text-success-foreground">Online</Badge></div>
                <div className="flex justify-between text-sm"><span>Seu Perfil</span>{getRoleBadge()}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="shadow-soft">
          <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Notificações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between"><div className="space-y-1"><p className="font-medium">Alertas de Estoque Baixo</p><p className="text-sm text-muted-foreground">Receber notificações quando itens atingirem o nível mínimo</p></div><Switch checked={settings.alertasEstoque} onCheckedChange={(checked) => setSettings({ ...settings, alertasEstoque: checked })} /></div>
            <div className="flex items-center justify-between"><div className="space-y-1"><p className="font-medium">Notificações por E-mail</p><p className="text-sm text-muted-foreground">Enviar resumos diários por e-mail</p></div><Switch checked={settings.notificacoesEmail} onCheckedChange={(checked) => setSettings({ ...settings, notificacoesEmail: checked })} /></div>
            <div className="flex items-center justify-between"><div className="space-y-1"><p className="font-medium">SMS de OS Urgentes</p><p className="text-sm text-muted-foreground">Enviar SMS para OS com prioridade alta</p></div><Switch checked={settings.smsUrgentes} onCheckedChange={(checked) => setSettings({ ...settings, smsUrgentes: checked })} /></div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" />Integrações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3"><Globe className="h-5 w-5 text-primary" /><div><p className="font-medium">API REST</p><p className="text-sm text-muted-foreground">Acesso à API para integrações externas</p></div></div>
              <Badge className="bg-success text-success-foreground">Ativa</Badge>
            </div>
            <div className="p-4 border rounded-lg bg-muted/30">
              <div className="flex items-start gap-3"><Info className="h-5 w-5 text-muted-foreground mt-0.5" /><p className="text-sm text-muted-foreground">A API REST está disponível para integração com sistemas externos. Consulte a documentação para mais detalhes.</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
