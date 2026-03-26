import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { useOrganization } from "@/hooks/useOrganization";

export default function EmpresaConfig() {
  const { config, loading: configLoading, refetch } = useEmpresaConfig();
  const { organizationId } = useOrganization();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome_empresa: "Ares Agrotec",
    cnpj: "",
    endereco: "",
    telefone: "61 9 91147599",
    responsavel: "Douglas",
    logo_url: "",
  });

  useEffect(() => {
    if (config.id) {
      setForm({
        nome_empresa: config.nome_empresa,
        cnpj: config.cnpj,
        endereco: config.endereco,
        telefone: config.telefone,
        responsavel: config.responsavel,
        logo_url: config.logo_url,
      });
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (config.id) {
        const { error } = await supabase
          .from("empresa_config" as any)
          .update(form as any)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("empresa_config" as any)
          .insert({ ...form, organization_id: organizationId } as any);
        if (error) throw error;
      }
      toast.success("Configurações da empresa salvas!");
      await refetch();
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (configLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            Configurações da Empresa
          </h1>
          <p className="text-muted-foreground">
            Dados exibidos no cabeçalho das Ordens de Serviço e relatórios
          </p>
        </div>

        <Card className="shadow-soft max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Dados da Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome da Empresa *</Label>
                <Input
                  value={form.nome_empresa}
                  onChange={(e) => setForm({ ...form, nome_empresa: e.target.value })}
                  placeholder="Ares Agrotec"
                />
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input
                  value={form.responsavel}
                  onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                  placeholder="Douglas"
                />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  placeholder="61 9 91147599"
                />
              </div>
              <div className="col-span-full space-y-2">
                <Label>Endereço</Label>
                <Input
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  placeholder="Rua, Nº, Cidade - UF"
                />
              </div>
              <div className="col-span-full space-y-2">
                <Label>URL da Logo</Label>
                <Input
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  placeholder="https://exemplo.com/logo.png"
                />
                {form.logo_url && (
                  <div className="mt-2 p-3 border rounded-lg bg-muted/50">
                    <img
                      src={form.logo_url}
                      alt="Preview da logo"
                      className="max-h-16 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}
              </div>
            </div>
            <Button className="gradient-primary shadow-medium" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar Configurações
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
