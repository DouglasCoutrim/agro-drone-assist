import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ChevronLeft, ChevronRight, FileCheck, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";

const TABS = ["Dados", "Tomador", "Serviço", "Observações"] as const;
type Tab = (typeof TABS)[number];

export default function NovaNfse() {
  const { organization } = useOrganization();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>("Dados");
  const [cfg, setCfg] = useState<any>(null);
  const [ordens, setOrdens] = useState<any[]>([]);
  const [osId, setOsId] = useState(params.get("os") || "");
  const [os, setOs] = useState<any>(null);
  const [srv, setSrv] = useState({ discriminacao: "", valor_servicos: 0, aliquota: 0, iss_retido: false, item_lista_servico: "", codigo_tributario_municipio: "" });
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!organization?.id) return;
    supabase.from("nfe_config").select("*").eq("organization_id", organization.id).maybeSingle().then(({ data }) => setCfg(data));
    supabase.from("ordens_servico").select("id, numero, status, valor_final, clientes!ordens_servico_cliente_id_fkey(nome)")
      .eq("organization_id", organization.id).neq("status", "cancelada").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setOrdens(data || []));
  }, [organization?.id]);

  useEffect(() => {
    if (!osId) { setOs(null); return; }
    supabase.from("ordens_servico").select("*, itens_os(*), clientes!ordens_servico_cliente_id_fkey(*)").eq("id", osId).maybeSingle()
      .then(({ data }) => {
        setOs(data);
        if (!data) return;
        const servicos = (data.itens_os || []).filter((i: any) => i.tipo === "servico");
        const valor = servicos.reduce((s: number, i: any) => s + Number(i.valor_total || 0), 0) || Number(data.valor_final || 0);
        setSrv({
          discriminacao: cfg?.nfse_discriminacao_padrao || servicos.map((i: any) => `${i.descricao} (${i.quantidade}x)`).join("; ") || `Serviços da OS ${data.numero}`,
          valor_servicos: Number(valor.toFixed(2)),
          aliquota: Number(cfg?.nfse_aliquota || 0),
          iss_retido: !!cfg?.nfse_iss_retido,
          item_lista_servico: cfg?.nfse_item_lista_servico || "",
          codigo_tributario_municipio: cfg?.nfse_codigo_tributario_municipio || "",
        });
      });
  }, [osId, cfg]);

  const iss = useMemo(() => Number((srv.valor_servicos * srv.aliquota / 100).toFixed(2)), [srv]);
  const cli = os?.clientes;
  const idx = TABS.indexOf(tab);

  const emitir = async () => {
    if (!osId) { toast.error("Selecione a ordem de serviço"); setTab("Dados"); return; }
    setBusy(true);
    const discriminacao = obs.trim() ? `${srv.discriminacao}\n${obs.trim()}` : srv.discriminacao;
    const { data, error } = await supabase.functions.invoke("emitir-nfse-os", { body: { action: "emitir", os_id: osId, servico: { ...srv, discriminacao } } });
    setBusy(false);
    if (error) {
      let msg = error.message;
      try { const b = await (error as any).context?.json?.(); msg = b?.problemas?.length ? b.problemas.join("\n") : b?.error || msg; } catch { /* */ }
      toast.error("NFS-e não emitida", { description: msg, duration: 12000 });
      return;
    }
    toast.success(data?.nf?.status === "autorizado" ? "NFS-e autorizada!" : "NFS-e enviada. Acompanhe em Notas Fiscais.");
    navigate("/vendas?tab=notas");
  };

  const Info = ({ l, v }: { l: string; v?: string | null }) => (
    <div><p className="text-xs text-muted-foreground">{l}</p><p className="text-sm font-medium">{v || <span className="text-destructive">não informado</span>}</p></div>
  );

  return (
    <MainLayout>
      <div className="space-y-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FileCheck className="h-6 w-6 text-primary" />Nova NFS-e</h1>
            <p className="text-sm text-muted-foreground">Fiscal › Nota de serviço</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
            <Button onClick={emitir} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Emitir NFS-e</Button>
          </div>
        </div>

        {cfg && !cfg.nfse_habilitado && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            A emissão de NFS-e está desativada. Ative em <button className="underline" onClick={() => navigate("/empresa")}>Configuração fiscal</button>.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border transition ${tab === t ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}>{t}</button>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">{tab}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {tab === "Dados" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Ordem de serviço *</Label>
                  <Select value={osId} onValueChange={setOsId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a OS" /></SelectTrigger>
                    <SelectContent>
                      {ordens.map((o) => <SelectItem key={o.id} value={o.id}>{o.numero} — {o.clientes?.nome || "sem cliente"} — {formatCurrency(Number(o.valor_final || 0))}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Info l="Ambiente" v={cfg?.ambiente === "producao" ? "Produção" : "Homologação (testes)"} />
                <Info l="Natureza da operação" v={cfg?.nfse_natureza_operacao} />
                <Info l="Prestador (CNPJ)" v={cfg?.cnpj} />
                <Info l="Inscrição municipal" v={cfg?.inscricao_municipal} />
                <Info l="Município (IBGE)" v={cfg?.codigo_municipio} />
                <Info l="Regime" v={cfg?.regime_tributario <= 2 ? "Simples Nacional" : "Regime Normal"} />
              </div>
            )}

            {tab === "Tomador" && (!cli ? <p className="text-sm text-muted-foreground">Selecione uma OS com cliente na aba Dados.</p> : (
              <div className="grid gap-4 sm:grid-cols-3">
                <Info l="Nome / Razão social" v={cli.nome} />
                <Info l="CPF/CNPJ" v={cli.cpf_cnpj} />
                <Info l="E-mail" v={cli.email} />
                <Info l="Logradouro" v={cli.endereco} />
                <Info l="Número" v={cli.numero} />
                <Info l="Bairro" v={cli.bairro} />
                <Info l="Cidade / UF" v={cli.cidade && `${cli.cidade} / ${cli.estado}`} />
                <Info l="CEP" v={cli.cep} />
                <Info l="Código IBGE" v={cli.codigo_municipio} />
                <div className="sm:col-span-3"><Button variant="outline" size="sm" onClick={() => navigate("/clientes")}>Corrigir cadastro do cliente</Button></div>
              </div>
            ))}

            {tab === "Serviço" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Discriminação do serviço *</Label>
                  <Textarea rows={4} value={srv.discriminacao} onChange={(e) => setSrv({ ...srv, discriminacao: e.target.value })} />
                </div>
                <div className="space-y-1.5"><Label>Item da lista (LC 116) *</Label><Input value={srv.item_lista_servico} onChange={(e) => setSrv({ ...srv, item_lista_servico: e.target.value })} placeholder="14.01" /></div>
                <div className="space-y-1.5"><Label>Código de tributação municipal</Label><Input value={srv.codigo_tributario_municipio} onChange={(e) => setSrv({ ...srv, codigo_tributario_municipio: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Valor dos serviços *</Label><Input type="number" step="0.01" min={0} value={srv.valor_servicos} onChange={(e) => setSrv({ ...srv, valor_servicos: Number(e.target.value) || 0 })} /></div>
                <div className="space-y-1.5"><Label>Alíquota ISS (%)</Label><Input type="number" step="0.01" min={0} value={srv.aliquota} onChange={(e) => setSrv({ ...srv, aliquota: Number(e.target.value) || 0 })} /></div>
                <div className="flex items-center justify-between rounded-lg border p-3"><Label>ISS retido pelo tomador</Label><Switch checked={srv.iss_retido} onCheckedChange={(v) => setSrv({ ...srv, iss_retido: v })} /></div>
                <div className="rounded-lg border p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span>Valor ISS</span><span>{formatCurrency(iss)}</span></div>
                  <div className="flex justify-between font-semibold"><span>Valor líquido</span><span>{formatCurrency(srv.valor_servicos - (srv.iss_retido ? iss : 0))}</span></div>
                </div>
              </div>
            )}

            {tab === "Observações" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Observações (acrescentadas à discriminação)</Label>
                  <Textarea rows={4} value={obs} onChange={(e) => setObs(e.target.value)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <span className="font-medium">Total da NFS-e</span>
                  <Badge className="text-base">{formatCurrency(srv.valor_servicos)}</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" disabled={idx === 0} onClick={() => setTab(TABS[idx - 1])}><ChevronLeft className="h-4 w-4 mr-1" />Anterior</Button>
          {idx < TABS.length - 1
            ? <Button variant="outline" onClick={() => setTab(TABS[idx + 1])}>Próxima<ChevronRight className="h-4 w-4 ml-1" /></Button>
            : <Button onClick={emitir} disabled={busy}>Emitir NFS-e</Button>}
        </div>
      </div>
    </MainLayout>
  );
}
