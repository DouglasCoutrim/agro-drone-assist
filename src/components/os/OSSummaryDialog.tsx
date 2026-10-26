import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Phone, User, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface Props {
  osId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function OSSummaryDialog({ osId, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [os, setOs] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [tecnico, setTecnico] = useState<string | null>(null);

  useEffect(() => {
    if (!osId) return;
    let active = true;
    (async () => {
      setLoading(true);
      setOs(null); setItems([]); setTecnico(null);
      const { data } = await supabase
        .from("ordens_servico")
        .select("id, numero, status, created_at, data_conclusao, tipo_equipamento, marca, modelo_equipamento, descricao_problema, valor_final, valor_orcamento, desconto, commission_services, commission_products, commission_total, tecnico_id, clientes(nome, telefone)")
        .eq("id", osId)
        .maybeSingle();
      const [{ data: its }, prof] = await Promise.all([
        supabase.from("itens_os").select("id, descricao, tipo, quantidade, valor_unitario").eq("ordem_servico_id", osId),
        data?.tecnico_id
          ? supabase.from("profiles").select("nome").eq("id", data.tecnico_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      if (!active) return;
      setOs(data); setItems((its as any[]) || []); setTecnico((prof as any)?.data?.nome ?? null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [osId]);

  const total = items.reduce((s, i) => s + Number(i.quantidade || 0) * Number(i.valor_unitario || 0), 0);
  const phone = os?.clientes?.telefone?.replace(/\D/g, "");

  return (
    <Dialog open={!!osId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Resumo da OS {os && <span className="font-mono">#{os.numero}</span>}
            {os && <Badge variant="outline" className="ml-auto capitalize">{String(os.status).replace(/_/g, " ")}</Badge>}
          </DialogTitle>
        </DialogHeader>
        {loading || !os ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="font-medium flex items-center gap-1"><User className="h-3.5 w-3.5" />{os.clientes?.nome || "—"}</p>
                {phone && (
                  <a href={`https://wa.me/55${phone}`} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3" />{os.clientes.telefone}
                  </a>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Técnico responsável</p>
                <p className="font-medium flex items-center gap-1"><Wrench className="h-3.5 w-3.5" />{tecnico || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Equipamento</p>
                <p className="font-medium">{[os.tipo_equipamento, os.marca, os.modelo_equipamento].filter(Boolean).join(" • ") || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Abertura / Conclusão</p>
                <p className="font-medium">{formatDate(os.created_at)} {os.data_conclusao ? `→ ${formatDate(os.data_conclusao)}` : ""}</p>
              </div>
            </div>
            {os.descricao_problema && <p className="text-xs text-muted-foreground">{os.descricao_problema}</p>}
            <Separator />
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum item lançado.</p>
              ) : items.map((i) => (
                <div key={i.id} className="flex justify-between gap-2">
                  <span className="truncate"><Badge variant="secondary" className="mr-1 text-[10px]">{i.tipo === "produto" ? "Peça" : "Serviço"}</Badge>{i.quantidade}x {i.descricao}</span>
                  <span className="font-mono shrink-0">{formatCurrency(Number(i.quantidade) * Number(i.valor_unitario))}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Valor da OS</span><span className="font-semibold">{formatCurrency(Number(os.valor_final || os.valor_orcamento || total))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Comissão serviço</span><span>{formatCurrency(Number(os.commission_services || 0))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span>{formatCurrency(Number(os.desconto || 0))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Comissão peças</span><span>{formatCurrency(Number(os.commission_products || 0))}</span></div>
              <div className="col-span-2 flex justify-between font-semibold text-primary"><span>Comissão total</span><span>{formatCurrency(Number(os.commission_total || 0))}</span></div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
