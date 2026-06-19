import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Save, Loader2, FileText, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { useOrganization } from "@/hooks/useOrganization";
import { IntegracoesFinanceiras } from "@/components/IntegracoesFinanceiras";
import { HelpTooltip } from "@/components/ui/help-tooltip";

const emptyForm = {
  nome_empresa: "",
  cnpj: "",
  endereco: "",
  telefone: "",
  responsavel: "",
  logo_url: "",
  termos_servico: "",
  taxa_bancada: "",
  prazo_diagnostico: "",
  garantia: "",
};

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value && value.trim() ? value : <span className="italic text-muted-foreground">Não informado</span>}</p>
    </div>
  );
}

export default function EmpresaConfig() {
  const { config, loading: configLoading, refetch } = useEmpresaConfig();
  const { organization } = useOrganization();
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    setForm({
      nome_empresa: config.nome_empresa || "",
      cnpj: config.cnpj || "",
      endereco: config.endereco || "",
      telefone: config.telefone || "",
      responsavel: config.responsavel || "",
      logo_url: config.logo_url || "",
      termos_servico: config.termos_servico || "",
    });
  }, [config]);

  const handleSave = async () => {
    if (!organization?.id) {
      toast.error("Empresa não identificada.");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const payload = {
        ...form,
        organization_id: organization.id,
        owner_id: user.id,
      };

      const { error } = await supabase
        .from("empresa_config" as any)
        .upsert(payload as any, { onConflict: "organization_id" });
      if (error) throw error;
      toast.success("Configurações da empresa salvas!");
      await refetch();
      setIsEditing(false);
    } catch (error: any) {
      toast.error("Erro ao salvar: " + (error.message || "tente novamente."));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      nome_empresa: config.nome_empresa || "",
      cnpj: config.cnpj || "",
      endereco: config.endereco || "",
      telefone: config.telefone || "",
      responsavel: config.responsavel || "",
      logo_url: config.logo_url || "",
      termos_servico: config.termos_servico || "",
    });
    setIsEditing(false);
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
            {!isEditing ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nome da Empresa" value={config.nome_empresa} />
                  <Field label="Responsável" value={config.responsavel} />
                  <Field label="CPF/CNPJ" value={config.cnpj} />
                  <Field label="Telefone" value={config.telefone} />
                  <div className="md:col-span-2">
                    <Field label="Endereço" value={config.endereco} />
                  </div>
                </div>
                {config.logo_url && (
                  <div className="p-3 border rounded-lg bg-muted/50">
                    <img
                      src={config.logo_url}
                      alt="Logo"
                      className="max-h-16 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}
                <Button className="gradient-primary shadow-medium" onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar dados da empresa
                </Button>
              </>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome da Empresa *</Label>
                    <Input
                      value={form.nome_empresa}
                      onChange={(e) => setForm({ ...form, nome_empresa: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Responsável</Label>
                    <Input
                      value={form.responsavel}
                      onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF/CNPJ</Label>
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
                <div className="flex gap-2">
                  <Button className="gradient-primary shadow-medium" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar Configurações
                  </Button>
                  <Button variant="outline" onClick={handleCancel} disabled={saving}>
                    <X className="mr-2 h-4 w-4" />
                    Cancelar
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Termos de Serviço */}
        <Card className="shadow-soft max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Termos de Serviço Padrão
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Este texto será enviado automaticamente via WhatsApp ao abrir uma nova OS.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEditing ? (
              <>
                <div className="rounded-md border bg-muted/30 p-3 min-h-[120px] whitespace-pre-wrap font-mono text-xs leading-relaxed">
                  {config.termos_servico?.trim() ? config.termos_servico : <span className="italic text-muted-foreground">Não informado</span>}
                </div>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar termos
                </Button>
              </>
            ) : (
              <>
                <Textarea
                  value={form.termos_servico}
                  onChange={(e) => setForm({ ...form, termos_servico: e.target.value })}
                  rows={12}
                  placeholder="TERMOS E CONDIÇÕES DE PRESTAÇÃO DE SERVIÇO..."
                  className="font-mono text-xs leading-relaxed"
                />
                <Button className="gradient-primary shadow-medium" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Termos
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="max-w-2xl">
          <IntegracoesFinanceiras />
        </div>
      </div>
    </MainLayout>
  );
}
