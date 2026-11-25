import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Phone, User, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { CommissionBreakdown, rateioDaOS } from "@/components/os/CommissionBreakdown";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { useNfseAliquota } from "@/hooks/useNfseAliquota";
import { calcularRateio } from "@/lib/commission";
import { descontoEfetivoOS, valorCobradoOS } from "@/lib/os-valor";

interface Props {
  osId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function OSSummaryDialog({ osId, onOpenChange }: Props) {
  const { config: empresa } = useEmpresaConfig();
  const aliquotaNfse = useNfseAliquota();
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
        .select("id, numero, status, created_at, updated_at, data_conclusao, tipo_equipamento, marca, modelo_equipamento, descricao_problema, valor_final, valor_orcamento, desconto, commission_base, commission_tax, commission_cost, commission_no_note_fee, commission_company, commission_tax_rate, commission_total, commission_frozen_at, commission_override, commission_override_reason, tecnico_id, nfe_emitida, clientes(nome, telefone)")
        .eq("id", osId)
        .maybeSingle();
      const [{ data: its }, prof] = await Promise.all([
        supabase.from("itens_os").select("id, descricao, tipo, quantidade, valor_unitario, valor_total, custo_servico").eq("ordem_servico_id", osId),
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
              <div className="flex justify-between"><span className="text-muted-foreground">Valor da OS</span><span className="font-semibold">{formatCurrency(valorCobradoOS(os as any, total))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span>{formatCurrency(descontoEfetivoOS(os as any, total))}</span></div>
            </div>
            {(() => {
              // Mesma resolução de valor cobrado que o SQL usa: valor_final manda; sem ele, itens − desconto.
              const descontoOs = Number(os.desconto) || 0;
              const valorCobrado = valorCobradoOS(os as any, total);
              const rateio = rateioDaOS(os, valorCobrado);
              // O que a regra calcula hoje — prévia (OS sem rateio gravado) e referência do
              // ajuste manual feito pelo administrador.
              const calculoRegra = calcularRateio({
                valorOs: valorCobrado,
                desconto: descontoOs,
                itens: items.map((i) => ({
                  tipo: i.tipo,
                  valorTotal: Number(i.valor_total) || Number(i.quantidade) * Number(i.valor_unitario) || 0,
                  custoServico: Number(i.custo_servico) || 0,
                })),
                aliquota: aliquotaNfse,
                nfeEmitida: Boolean(os.nfe_emitida),
                taxaSemNota: empresa.commission_no_note_fee,
              });
              const previa = rateio.semRateio ? calculoRegra : null;
              return (
                <CommissionBreakdown
                  data={{
                    ...rateio,
                    previa,
                    calculada: calculoRegra.comissao,
                    taxaPercentual: empresa.commission_no_note_fee,
                    avisos:
                      os.commission_frozen_at && os.updated_at && new Date(os.updated_at) > new Date(os.commission_frozen_at)
                        ? ["A OS foi alterada depois do congelamento da comissão."]
                        : [],
                  }}
                />
              );
            })()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
