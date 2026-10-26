import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Settings, User, Shield, Save, Key, Zap, Loader2, Users, Camera } from "lucide-react";
import { Link } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { SEGMENTOS } from "@/lib/equipment-segments";
import { useOrgSegments } from "@/hooks/useOrgSegments";
import { Checkbox } from "@/components/ui/checkbox";
import { PushNotificationsCard } from "@/components/PushNotificationsCard";

type Profile = Tables<"profiles">;
export default function Configuracoes() {
  const { user, role } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ nome: "", email: "", telefone: "" });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  useEffect(() => { if (user) fetchProfile(); }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
      if (error) throw error;
      if (data) { setProfile(data); setProfileForm({ nome: data.nome, email: data.email, telefone: data.telefone || "" }); }
    } catch (error: any) { console.error('Error fetching profile:', error); } finally { setLoading(false); }
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
            <PushNotificationsCard />
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

        <Button variant="outline" asChild>
          <Link to="/equipe"><Users className="mr-2 h-4 w-4" />Gerenciar equipe</Link>
        </Button>

        <SegmentosCard />

      </div>
    </MainLayout>
  );
}

function SegmentosCard() {
  const { segmentos, tipos_custom, save, loading } = useOrgSegments();
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const toggle = async (key: string) => {
    const next = segmentos.includes(key) ? segmentos.filter(s => s !== key) : [...segmentos, key];
    setSaving(true);
    try { await save({ segmentos: next }); toast.success("Segmentos atualizados"); }
    catch (e: any) { toast.error(e.message ?? "Falha ao salvar"); }
    finally { setSaving(false); }
  };

  const addCustom = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const value = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`;
    setSaving(true);
    try { await save({ tipos_custom: [...tipos_custom, { value, label }] }); setNewLabel(""); toast.success("Tipo adicionado"); }
    catch (e: any) { toast.error(e.message ?? "Falha ao salvar"); }
    finally { setSaving(false); }
  };

  const removeCustom = async (value: string) => {
    setSaving(true);
    try { await save({ tipos_custom: tipos_custom.filter(t => t.value !== value) }); toast.success("Tipo removido"); }
    catch (e: any) { toast.error(e.message ?? "Falha ao salvar"); }
    finally { setSaving(false); }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />Segmentos de Atuação</CardTitle>
        <p className="text-xs text-muted-foreground">Selecione os nichos da sua empresa. O cadastro de OS mostrará apenas os tipos de equipamento desses segmentos.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              {SEGMENTOS.map(s => (
                <label key={s.key} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition ${segmentos.includes(s.key) ? 'border-primary bg-primary/5' : 'hover:border-primary/40'}`}>
                  <Checkbox checked={segmentos.includes(s.key)} onCheckedChange={() => toggle(s.key)} disabled={saving} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{s.types.map(t => t.label).join(', ')}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs uppercase text-muted-foreground">Tipos personalizados</Label>
              <div className="flex gap-2">
                <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Ex: Esteira Elétrica" />
                <Button type="button" onClick={addCustom} disabled={saving || !newLabel.trim()}>Adicionar</Button>
              </div>
              {tipos_custom.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {tipos_custom.map(t => (
                    <Badge key={t.value} variant="secondary" className="gap-1.5">
                      {t.label}
                      <button type="button" onClick={() => removeCustom(t.value)} className="hover:text-destructive">×</button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
