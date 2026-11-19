"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { AlertTriangle, BadgeDollarSign, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { useOrganization } from "@/hooks/useOrganization";
import { getErrorMessage } from "@/lib/formatters";

/**
 * Regra da comissão em um só lugar: a taxa sem nota é configurável aqui e a alíquota do
 * imposto vem de `nfe_config.nfse_aliquota` (aba fiscal), agora fonte única — antes o cálculo
 * lia `empresa_config.tax_percentage_nfe`, coluna que nenhuma tela mostrava.
 */
export function CommissionConfigCard() {
  const { config, refetch } = useEmpresaConfig();
  const { organization } = useOrganization();
  const [taxa, setTaxa] = useState("3.5");
  const [aliquota, setAliquota] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTaxa(String(config.commission_no_note_fee ?? 3.5));
  }, [config.commission_no_note_fee]);

  useEffect(() => {
    if (!organization?.id) return;
    supabase
      .from("nfe_config" as any)
      .select("nfse_aliquota")
      .eq("organization_id", organization.id)
      .maybeSingle()
      .then(({ data }) => setAliquota(data ? Number((data as any).nfse_aliquota) || 0 : null));
  }, [organization?.id]);

  const salvar = async () => {
    if (!organization?.id) return;
    const valor = Number(taxa.replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
      toast.error("Informe uma taxa entre 0 e 100.");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("empresa_config" as any)
        .upsert(
          { organization_id: organization.id, owner_id: user?.id, commission_no_note_fee: valor } as any,
          { onConflict: "organization_id" },
        );
      if (error) throw error;
      toast.success("Taxa sem nota atualizada.");
      await refetch();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-soft max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BadgeDollarSign className="h-5 w-5 text-primary" />
          Comissão dos técnicos
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          A comissão é: valor cobrado da OS − imposto da nota − custo do serviço repassado, dividido 50% entre
          empresa e técnico.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>Taxa sem nota (%)</Label>
            <HelpTooltip content="Percentual descontado da parte do técnico quando a OS é concluída sem nota fiscal. Padrão: 3,5%." />
          </div>
          <div className="flex gap-2">
            <Input
              value={taxa}
              onChange={(e) => setTaxa(e.target.value)}
              inputMode="decimal"
              className="max-w-[140px]"
            />
            <Button className="gradient-primary shadow-medium" onClick={salvar} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>

        <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Alíquota do imposto (ISS)
          </p>
          <p className="text-sm font-semibold">
            {aliquota === null ? "Não configurada" : `${aliquota.toLocaleString("pt-BR")}%`}
          </p>
          <p className="flex items-start gap-1.5 pt-1 text-xs text-amber-600">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Esta alíquota é lida da configuração fiscal (Alíquota ISS em Configuração fiscal) e é a
            única fonte do imposto da comissão — só é aplicada em OS com nota emitida.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
