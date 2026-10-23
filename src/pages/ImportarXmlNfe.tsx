import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUp, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { parseNfeXml, type NfeImport, type NfeParte } from "@/lib/nfe-xml";

type Linha = { idx: number; existenteId: string | null; qtdAtual: number; preco_venda: number };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ImportarXmlNfe() {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [nota, setNota] = useState<NfeImport | null>(null);
  const [fornExiste, setFornExiste] = useState(false);
  const [transpExiste, setTranspExiste] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string[] | null>(null);
  const org = organization?.id;

  const findParte = async (tabela: "fornecedores" | "transportadoras", p: NfeParte | null) => {
    if (!p?.cpf_cnpj || !org) return false;
    const { data } = await supabase.from(tabela).select("id").eq("organization_id", org).eq("cpf_cnpj", p.cpf_cnpj).limit(1);
    return !!data?.length;
  };

  const onFile = async (file?: File) => {
    if (!file || !org) return;
    setDone(null);
    try {
      const n = parseNfeXml(await file.text());
      setBusy(true);
      const { data: itens } = await supabase.from("itens_estoque").select("id,codigo,gtin,descricao,quantidade").eq("organization_id", org);
      const all = itens || [];
      setLinhas(n.produtos.map((p, idx) => {
        const hit = all.find((i) => (p.gtin && i.gtin === p.gtin) || i.codigo === p.codigo || i.descricao.trim().toLowerCase() === p.descricao.trim().toLowerCase());
        return { idx, existenteId: hit?.id ?? null, qtdAtual: Number(hit?.quantidade ?? 0), preco_venda: 0 };
      }));
      setFornExiste(await findParte("fornecedores", n.emitente));
      setTranspExiste(await findParte("transportadoras", n.transportadora));
      setNota(n);
    } catch (e: any) {
      toast.error(e.message || "Não foi possível ler o XML.");
    } finally { setBusy(false); }
  };

  const confirmar = async () => {
    if (!nota || !org || !user) return;
    setBusy(true);
    const log: string[] = [];
    try {
      if (fornExiste) log.push(`Fornecedor ${nota.emitente.nome} já está cadastrado.`);
      else {
        const { error } = await supabase.from("fornecedores").insert({ ...nota.emitente, organization_id: org });
        if (error) throw error; log.push(`Fornecedor ${nota.emitente.nome} cadastrado.`);
      }
      if (nota.transportadora) {
        if (transpExiste) log.push(`Transportadora ${nota.transportadora.nome} já está cadastrada.`);
        else {
          const { error } = await supabase.from("transportadoras").insert({ ...nota.transportadora, organization_id: org });
          if (error) throw error; log.push(`Transportadora ${nota.transportadora.nome} cadastrada.`);
        }
      }
      const motivo = `Entrada via NF-e nº ${nota.numero}`;
      for (const l of linhas) {
        const p = nota.produtos[l.idx];
        let itemId = l.existenteId;
        if (itemId) {
          const { error } = await supabase.from("itens_estoque").update({ quantidade: l.qtdAtual + p.quantidade, custo_unitario: p.custo_unitario }).eq("id", itemId);
          if (error) throw error;
          log.push(`${p.descricao}: estoque atualizado (+${p.quantidade}).`);
        } else {
          let codigo = p.codigo || `NF-${nota.numero}-${l.idx + 1}`;
          const { data: dup } = await supabase.from("itens_estoque").select("id").eq("organization_id", org).eq("codigo", codigo).limit(1);
          if (dup?.length) codigo = `${codigo}-${Date.now().toString().slice(-4)}`;
          const { data, error } = await supabase.from("itens_estoque").insert({
            organization_id: org, codigo, descricao: p.descricao, categoria: "Peças", quantidade: p.quantidade,
            custo_unitario: p.custo_unitario, preco_venda: l.preco_venda, fornecedor: nota.emitente.nome,
            ncm: p.ncm || null, cest: p.cest || null, unidade: p.unidade, gtin: p.gtin || null,
          }).select("id").single();
          if (error) throw error;
          itemId = data.id;
          log.push(`${p.descricao}: novo produto cadastrado (${p.quantidade}).`);
        }
        await supabase.from("movimentacoes_estoque").insert({ item_id: itemId!, organization_id: org, quantidade: p.quantidade, tipo: "entrada", motivo, usuario_id: user.id });
      }
      setDone(log); setNota(null);
      toast.success("Importação concluída.");
    } catch (e: any) {
      toast.error("Erro na importação: " + (e.message || e));
      setDone(log);
    } finally { setBusy(false); }
  };

  const ParteCard = ({ titulo, p, existe }: { titulo: string; p: NfeParte; existe: boolean }) => (
    <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center justify-between gap-2">
      {titulo}<Badge variant={existe ? "secondary" : "default"}>{existe ? "Já cadastrado" : "Será cadastrado"}</Badge>
    </CardTitle></CardHeader>
    <CardContent className="text-sm text-muted-foreground space-y-1">
      <p className="font-medium text-foreground">{p.nome}</p>
      <p>CPF/CNPJ: {p.cpf_cnpj || "—"} · IE: {p.inscricao_estadual || "—"}</p>
      <p>{[p.endereco, p.numero, p.bairro, p.cidade, p.estado].filter(Boolean).join(", ")}</p>
    </CardContent></Card>
  );

  return (
    <MainLayout>
      <div className="space-y-6 py-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Importar XML de NF-e</h1>
            <p className="text-muted-foreground text-sm">Cadastra fornecedor, transportadora e produtos, e dá entrada no estoque.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/estoque")}><ArrowLeft className="h-4 w-4 mr-2" />Estoque</Button>
        </div>

        <Card><CardContent className="pt-6">
          <label className="flex flex-col items-center gap-2 border-2 border-dashed rounded-lg p-8 cursor-pointer hover:bg-muted/50">
            {busy ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <FileUp className="h-8 w-8 text-primary" />}
            <span className="font-medium">Selecione o arquivo .xml da nota</span>
            <input type="file" accept=".xml,text/xml" className="hidden" disabled={busy} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </CardContent></Card>

        {done && (
          <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />Resultado</CardTitle></CardHeader>
            <CardContent><ul className="text-sm space-y-1">{done.map((d, i) => <li key={i}>• {d}</li>)}</ul></CardContent></Card>
        )}

        {nota && (<>
          <p className="text-sm text-muted-foreground">NF-e nº {nota.numero} · Série {nota.serie}</p>
          <div className="grid md:grid-cols-2 gap-4">
            <ParteCard titulo="Fornecedor" p={nota.emitente} existe={fornExiste} />
            {nota.transportadora && <ParteCard titulo="Transportadora" p={nota.transportadora} existe={transpExiste} />}
          </div>
          <Card><CardHeader><CardTitle className="text-base">Produtos ({nota.produtos.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {linhas.map((l) => { const p = nota.produtos[l.idx]; return (
                <div key={l.idx} className="flex flex-col md:flex-row md:items-center gap-2 border rounded-md p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.descricao}</p>
                    <p className="text-xs text-muted-foreground">Cód. {p.codigo} · NCM {p.ncm || "—"} · {p.quantidade} {p.unidade} × {brl(p.custo_unitario)}</p>
                  </div>
                  <Badge variant={l.existenteId ? "secondary" : "default"}>
                    {l.existenteId ? `Atualiza estoque (+${p.quantidade})` : "Novo produto"}
                  </Badge>
                  {!l.existenteId && (
                    <Input type="number" step="0.01" min={0} placeholder="Preço de venda" className="md:w-36"
                      onChange={(e) => setLinhas((ls) => ls.map((x) => x.idx === l.idx ? { ...x, preco_venda: Number(e.target.value) || 0 } : x))} />
                  )}
                </div>); })}
            </CardContent></Card>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNota(null)} disabled={busy}>Cancelar</Button>
            <Button onClick={confirmar} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar importação</Button>
          </div>
        </>)}
      </div>
    </MainLayout>
  );
}
