import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, FileCheck, Loader2, Save, Stethoscope, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useViaCep } from "@/hooks/useViaCep";
import { toast } from "sonner";

type Cfg = {
  habilitado: boolean;
  ambiente: "homologacao" | "producao";
  focus_token_homologacao: string;
  focus_token_producao: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  regime_tributario: number;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  codigo_municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  serie: number;
  natureza_operacao: string;
  informacoes_complementares: string;
  nfse_habilitado: boolean;
  nfse_item_lista_servico: string;
  nfse_codigo_tributario_municipio: string;
  nfse_codigo_cnae: string;
  nfse_aliquota: number | string;
  nfse_iss_retido: boolean;
  nfse_natureza_operacao: string;
  nfse_discriminacao_padrao: string;
  nfse_codigo_nbs: string;
  nfse_codigo_indop: string;
  nfse_ibs_cbs_class_trib: string;
  nfse_ibs_cbs_cst: string;
};

const EMPTY: Cfg = {
  habilitado: false, ambiente: "homologacao", focus_token_homologacao: "", focus_token_producao: "",
  razao_social: "", nome_fantasia: "", cnpj: "", inscricao_estadual: "", inscricao_municipal: "",
  regime_tributario: 1, logradouro: "", numero: "", complemento: "", bairro: "", municipio: "",
  codigo_municipio: "", uf: "", cep: "", telefone: "", serie: 1, natureza_operacao: "Venda de mercadoria",
  informacoes_complementares: "",
  nfse_habilitado: false, nfse_item_lista_servico: "", nfse_codigo_tributario_municipio: "", nfse_codigo_cnae: "",
  nfse_aliquota: 0, nfse_iss_retido: false, nfse_natureza_operacao: "1", nfse_discriminacao_padrao: "",
  nfse_codigo_nbs: "115021000", nfse_codigo_indop: "100301", nfse_ibs_cbs_class_trib: "000001", nfse_ibs_cbs_cst: "000",
};

function F({ label, k, cfg, set, ...rest }: { label: string; k: keyof Cfg; cfg: Cfg; set: (k: keyof Cfg, v: any) => void } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={String(cfg[k] ?? "")} onChange={(e) => set(k, e.target.value)} {...rest} />
    </div>
  );
}

export function NfeConfigCard() {
  const { organization } = useOrganization();
  const { fetchCep, loading: cepLoading } = useViaCep();
  const [cfg, setCfg] = useState<Cfg>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!organization?.id) return;
    (async () => {
      const { data } = await supabase.from("nfe_config").select("*").eq("organization_id", organization.id).maybeSingle();
      if (data) {
        const clean = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? ""]));
        setCfg({ ...EMPTY, ...(clean as any) });
      }
      setLoading(false);
    })();
  }, [organization?.id]);

  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const onCep = async (cep: string) => {
    set("cep", cep);
    const r = await fetchCep(cep);
    if (r) setCfg((c) => ({ ...c, logradouro: r.logradouro || c.logradouro, bairro: r.bairro || c.bairro, municipio: r.localidade, uf: r.uf, codigo_municipio: r.ibge || c.codigo_municipio }));
  };

  const [diagnosing, setDiagnosing] = useState(false);
  const [diag, setDiag] = useState<{ ok: boolean; texto: string }[] | null>(null);
  const diagnosticar = async () => {
    setDiagnosing(true);
    const { data, error } = await supabase.functions.invoke("emitir-nfe-venda", { body: { action: "diagnosticar" } });
    setDiagnosing(false);
    if (error && !data) { toast.error("Não foi possível testar: " + error.message); return; }
    setDiag(data?.itens || []);
  };

  const save = async () => {
    if (!organization?.id) return;
    if (cfg.habilitado && cfg.cnpj.replace(/\D/g, "").length !== 14) return toast.error("Informe um CNPJ válido do emitente");
    setSaving(true);
    const payload: Record<string, unknown> = { ...cfg, organization_id: organization.id };
    for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;
    payload.serie = Number(cfg.serie) || 1;
    payload.regime_tributario = Number(cfg.regime_tributario);
    payload.nfse_aliquota = Number(cfg.nfse_aliquota) || 0;
    payload.nfse_natureza_operacao = cfg.nfse_natureza_operacao || "1";
    payload.natureza_operacao = cfg.natureza_operacao || "Venda de mercadoria";
    const { error } = await supabase.from("nfe_config").upsert(payload as any, { onConflict: "organization_id" });
    setSaving(false);
    if (error) toast.error("Erro ao salvar configuração fiscal: " + error.message);
    else toast.success("Configuração fiscal salva");
  };

  if (loading) return null;


  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2"><FileCheck className="h-5 w-5 text-primary" /> Nota Fiscal (NF-e)</CardTitle>
          <Badge variant={cfg.ambiente === "producao" ? "default" : "secondary"}>
            {cfg.ambiente === "producao" ? "Produção" : "Homologação (testes)"}
          </Badge>
        </div>
        <CardDescription>Dados do emitente e integração com a Focus NFe para emitir notas de venda de produtos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="font-medium text-sm">Emissão de NF-e ativada</p>
            <p className="text-xs text-muted-foreground">Libera o botão "Emitir NF-e" nas vendas.</p>
          </div>
          <Switch checked={cfg.habilitado} onCheckedChange={(v) => set("habilitado", v)} />
        </div>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Integração Focus NFe</h3>
          <div className="space-y-1.5">
            <Label>Ambiente</Label>
            <Select value={cfg.ambiente} onValueChange={(v) => set("ambiente", v as Cfg["ambiente"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="homologacao">Homologação — testes sem valor fiscal</SelectItem>
                <SelectItem value="producao">Produção — notas com valor fiscal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <F cfg={cfg} set={set} label="Token de homologação" k="focus_token_homologacao" type="password" autoComplete="off" />
            <F cfg={cfg} set={set} label="Token de produção" k="focus_token_producao" type="password" autoComplete="off" />
          </div>
          <p className="text-xs text-muted-foreground">Os tokens ficam no painel da Focus NFe, no cadastro da sua empresa. O certificado digital A1 deve ser enviado diretamente no painel da Focus.</p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Emitente</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <F cfg={cfg} set={set} label="Razão social" k="razao_social" />
            <F cfg={cfg} set={set} label="Nome fantasia" k="nome_fantasia" />
            <F cfg={cfg} set={set} label="CNPJ" k="cnpj" inputMode="numeric" />
            <F cfg={cfg} set={set} label="Inscrição estadual" k="inscricao_estadual" />
            <F cfg={cfg} set={set} label="Inscrição municipal" k="inscricao_municipal" />
            <div className="space-y-1.5">
              <Label>Regime tributário</Label>
              <Select value={String(cfg.regime_tributario)} onValueChange={(v) => set("regime_tributario", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — Simples Nacional</SelectItem>
                  <SelectItem value="2">2 — Simples Nacional (excesso de sublimite)</SelectItem>
                  <SelectItem value="3">3 — Regime Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Endereço do emitente</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>CEP {cepLoading && <Loader2 className="inline h-3 w-3 animate-spin" />}</Label>
              <Input value={cfg.cep} onChange={(e) => set("cep", e.target.value)} onBlur={(e) => onCep(e.target.value)} inputMode="numeric" />
            </div>
            <div className="sm:col-span-2"><F cfg={cfg} set={set} label="Logradouro" k="logradouro" /></div>
            <F cfg={cfg} set={set} label="Número" k="numero" />
            <F cfg={cfg} set={set} label="Complemento" k="complemento" />
            <F cfg={cfg} set={set} label="Bairro" k="bairro" />
            <F cfg={cfg} set={set} label="Município" k="municipio" />
            <F cfg={cfg} set={set} label="UF" k="uf" maxLength={2} />
            <F cfg={cfg} set={set} label="Código IBGE" k="codigo_municipio" inputMode="numeric" />
            <F cfg={cfg} set={set} label="Telefone" k="telefone" />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Padrões da nota</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <F cfg={cfg} set={set} label="Série" k="serie" type="number" min={1} />
            <div className="sm:col-span-2"><F cfg={cfg} set={set} label="Natureza da operação" k="natureza_operacao" /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Informações complementares (saem em todas as notas)</Label>
            <Textarea rows={3} value={cfg.informacoes_complementares} onChange={(e) => set("informacoes_complementares", e.target.value)}
              placeholder="Ex.: Documento emitido por ME ou EPP optante pelo Simples Nacional." />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium text-sm">Emissão de NFS-e (serviços) ativada</p>
              <p className="text-xs text-muted-foreground">Libera a emissão de nota de serviço a partir das ordens de serviço. Usa o mesmo token e certificado da Focus.</p>
            </div>
            <Switch checked={cfg.nfse_habilitado} onCheckedChange={(v) => set("nfse_habilitado", v)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <F cfg={cfg} set={set} label="Item da lista de serviço (LC 116) *" k="nfse_item_lista_servico" placeholder="Ex.: 14.01" />
            <F cfg={cfg} set={set} label="Código de tributação do município" k="nfse_codigo_tributario_municipio" />
            <F cfg={cfg} set={set} label="CNAE" k="nfse_codigo_cnae" inputMode="numeric" />
            <F cfg={cfg} set={set} label="Código NBS" k="nfse_codigo_nbs" inputMode="numeric" placeholder="Ex.: 115021000" />
            <F cfg={cfg} set={set} label="Indicador da operação (INDOP)" k="nfse_codigo_indop" inputMode="numeric" placeholder="Ex.: 100301" />
            <F cfg={cfg} set={set} label="Classificação tributária IBS/CBS" k="nfse_ibs_cbs_class_trib" inputMode="numeric" placeholder="Ex.: 000001" />
            <F cfg={cfg} set={set} label="CST IBS/CBS" k="nfse_ibs_cbs_cst" inputMode="numeric" placeholder="Ex.: 000" />
            <F cfg={cfg} set={set} label="Alíquota ISS (%)" k="nfse_aliquota" type="number" step="0.01" min={0} />
            <div className="space-y-1.5">
              <Label>Natureza da operação (NFS-e)</Label>
              <Select value={cfg.nfse_natureza_operacao} onValueChange={(v) => set("nfse_natureza_operacao", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — Tributação no município</SelectItem>
                  <SelectItem value="2">2 — Tributação fora do município</SelectItem>
                  <SelectItem value="3">3 — Isenção</SelectItem>
                  <SelectItem value="4">4 — Imune</SelectItem>
                  <SelectItem value="5">5 — Exigibilidade suspensa (judicial)</SelectItem>
                  <SelectItem value="6">6 — Exigibilidade suspensa (administrativa)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>ISS retido pelo tomador</Label>
              <Switch checked={cfg.nfse_iss_retido} onCheckedChange={(v) => set("nfse_iss_retido", v)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Discriminação padrão do serviço (opcional)</Label>
            <Textarea rows={2} value={cfg.nfse_discriminacao_padrao} onChange={(e) => set("nfse_discriminacao_padrao", e.target.value)}
              placeholder="Se vazio, usa os serviços lançados na OS." />
          </div>
        </section>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar configuração fiscal
          </Button>
          <Button variant="outline" onClick={diagnosticar} disabled={diagnosing} className="w-full sm:w-auto">
            {diagnosing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Stethoscope className="mr-2 h-4 w-4" />}
            Testar conexão e diagnosticar
          </Button>
        </div>
        {diag && (
          <ul className="space-y-1.5 rounded-lg border p-3 text-sm">
            {diag.map((d, i) => (
              <li key={i} className="flex items-start gap-2">
                {d.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                <span>{d.texto}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
