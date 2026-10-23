import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileCheck, Loader2, Save } from "lucide-react";
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
};

const EMPTY: Cfg = {
  habilitado: false, ambiente: "homologacao", focus_token_homologacao: "", focus_token_producao: "",
  razao_social: "", nome_fantasia: "", cnpj: "", inscricao_estadual: "", inscricao_municipal: "",
  regime_tributario: 1, logradouro: "", numero: "", complemento: "", bairro: "", municipio: "",
  codigo_municipio: "", uf: "", cep: "", telefone: "", serie: 1, natureza_operacao: "Venda de mercadoria",
  informacoes_complementares: "",
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

  const save = async () => {
    if (!organization?.id) return;
    if (cfg.habilitado && cfg.cnpj.replace(/\D/g, "").length !== 14) return toast.error("Informe um CNPJ válido do emitente");
    setSaving(true);
    const payload: Record<string, unknown> = { ...cfg, organization_id: organization.id };
    for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;
    payload.serie = Number(cfg.serie) || 1;
    payload.regime_tributario = Number(cfg.regime_tributario);
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

        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar configuração fiscal
        </Button>
      </CardContent>
    </Card>
  );
}
