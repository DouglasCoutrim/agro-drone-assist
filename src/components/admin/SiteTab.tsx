import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Globe, Phone, Mail, Instagram, MapPin, Sparkles, LayoutList } from 'lucide-react';
import { toast } from 'sonner';

export default function SiteTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hero, setHero] = useState<any>(null);
  const [contact, setContact] = useState<any>(null);

  useEffect(() => {
    async function fetchConfig() {
      const { data } = await supabase.from('site_config').select('*');
      if (data) {
        const heroData = data.find(c => c.key === 'landing_hero')?.value;
        const contactData = data.find(c => c.key === 'site_contact')?.value;
        setHero(heroData || {});
        setContact(contactData || {});
      }
      setLoading(false);
    }
    fetchConfig();
  }, []);

  const handleSaveHero = async () => {
    setSaving(true);
    const { error } = await supabase.from('site_config').upsert({
      key: 'landing_hero',
      value: hero,
      updated_at: new Date().toISOString()
    });

    if (error) {
      toast.error('Erro ao salvar seção Hero');
    } else {
      toast.success('Seção Hero atualizada');
    }
    setSaving(false);
  };

  const handleSaveContact = async () => {
    setSaving(true);
    const { error } = await supabase.from('site_config').upsert({
      key: 'site_contact',
      value: contact,
      updated_at: new Date().toISOString()
    });

    if (error) {
      toast.error('Erro ao salvar contatos');
    } else {
      toast.success('Informações de contato atualizadas');
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seção Hero */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <CardTitle>Landing Page - Seção Hero</CardTitle>
            </div>
            <CardDescription>
              Gerencie os textos principais e chamadas do topo do site.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Título Principal</Label>
              <Input 
                value={hero?.title || ''} 
                onChange={(e) => setHero({...hero, title: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Destaque Colorido</Label>
              <Input 
                value={hero?.highlight || ''} 
                onChange={(e) => setHero({...hero, highlight: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea 
                value={hero?.description || ''} 
                onChange={(e) => setHero({...hero, description: e.target.value})}
                className="min-h-[100px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Botão Principal</Label>
                <Input 
                  value={hero?.cta_primary || ''} 
                  onChange={(e) => setHero({...hero, cta_primary: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Botão Secundário</Label>
                <Input 
                  value={hero?.cta_secondary || ''} 
                  onChange={(e) => setHero({...hero, cta_secondary: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Texto do Badge (Topo)</Label>
              <Input 
                value={hero?.badge || ''} 
                onChange={(e) => setHero({...hero, badge: e.target.value})}
              />
            </div>
            <Button onClick={handleSaveHero} disabled={saving} className="w-full mt-4">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Seção Hero
            </Button>
          </CardContent>
        </Card>

        {/* Seção Contato */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <Phone className="h-5 w-5" />
              <CardTitle>Informações de Contato</CardTitle>
            </div>
            <CardDescription>
              Dados globais de contato, redes sociais e endereço.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>WhatsApp (com DDD e DDI)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={contact?.whatsapp || ''} 
                  onChange={(e) => setContact({...contact, whatsapp: e.target.value})}
                  className="pl-10"
                  placeholder="5511999999999"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>E-mail de Contato</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={contact?.email || ''} 
                  onChange={(e) => setContact({...contact, email: e.target.value})}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <div className="relative">
                <Instagram className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={contact?.instagram || ''} 
                  onChange={(e) => setContact({...contact, instagram: e.target.value})}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Endereço / Localização</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={contact?.address || ''} 
                  onChange={(e) => setContact({...contact, address: e.target.value})}
                  className="pl-10"
                />
              </div>
            </div>
            <Button onClick={handleSaveContact} disabled={saving} className="w-full mt-8">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Contatos
            </Button>
          </CardContent>
        </Card>

        {/* Gerenciamento de Imagens Placeholder */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <Globe className="h-5 w-5" />
              <CardTitle>Gerenciamento de Campanhas e Imagens</CardTitle>
            </div>
            <CardDescription>
              Configure banners de campanha e URLs de imagens globais do site.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <div className="p-8 border border-dashed border-border rounded-lg text-center">
                <LayoutList className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm font-medium">Módulo de Upload de Imagens em Desenvolvimento</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Integração com Supabase Storage em andamento para permitir troca dinâmica de fotos.</p>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
