import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

interface CommissionEditorProps {
  profile: Profile;
  onSaved?: () => void;
}

export function CommissionEditor({ profile, onSaved }: CommissionEditorProps) {
  const [onServices, setOnServices] = useState<boolean>(!!profile.commission_on_services);
  const [serviceType, setServiceType] = useState<string>(profile.service_commission_type || "percentage");
  const [serviceValue, setServiceValue] = useState<string>(String(profile.service_commission_value ?? 0));
  const [onProducts, setOnProducts] = useState<boolean>(!!profile.commission_on_products);
  const [productType, setProductType] = useState<string>(profile.product_commission_type || "percentage");
  const [productValue, setProductValue] = useState<string>(String(profile.product_commission_value ?? 0));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        commission_on_services: onServices,
        service_commission_type: onServices ? serviceType : "percentage",
        service_commission_value: onServices ? Number(serviceValue) || 0 : 0,
        commission_on_products: onProducts,
        product_commission_type: onProducts ? productType : "percentage",
        product_commission_value: onProducts ? Number(productValue) || 0 : 0,
      };
      const { error } = await supabase.from("profiles").update(payload as any).eq("id", profile.id);
      if (error) throw error;
      toast.success("Comissão atualizada!");
      onSaved?.();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha ao salvar comissão"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Wrench className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Configuração de Comissão</p>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs">Comissão sobre Mão de Obra (serviços)</Label>
        <Switch checked={onServices} onCheckedChange={setOnServices} />
      </div>
      {onServices && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Tipo</Label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">% sobre serviços</SelectItem>
                <SelectItem value="fixed">R$ fixo por serviço</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">{serviceType === "percentage" ? "%" : "R$"}</Label>
            <Input className="h-8" type="number" min="0" step="0.01" value={serviceValue} onChange={(e) => setServiceValue(e.target.value)} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label className="text-xs">Comissão sobre Peças (produtos)</Label>
        <Switch checked={onProducts} onCheckedChange={setOnProducts} />
      </div>
      {onProducts && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Tipo</Label>
            <Select value={productType} onValueChange={setProductType}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">% sobre peças</SelectItem>
                <SelectItem value="fixed">R$ fixo por peça</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">{productType === "percentage" ? "%" : "R$"}</Label>
            <Input className="h-8" type="number" min="0" step="0.01" value={productValue} onChange={(e) => setProductValue(e.target.value)} />
          </div>
        </div>
      )}

      <Button size="sm" variant="outline" className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Salvar Comissão
      </Button>
    </div>
  );
}