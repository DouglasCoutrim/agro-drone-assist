import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUp, Loader2, ArrowLeft, CheckCircle2, Search, Download, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { parseNfeXml, type NfeImport, type NfeParte } from "@/lib/nfe-xml";
import { functionErrorMessage } from "@/lib/function-error";
import { todayDateInput } from "@/lib/formatters";
import { DevolucaoCompraDialog } from "@/components/fiscal/DevolucaoCompraDialog";

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

  const onFile = async (file?: File) => { if (file) await processXml(await file.text()); };

  const hoje = todayDateInput();
  const [inicio, setInicio] = useState(todayDateInput(new Date(Date.now() - 30 * 864e5)));
  const [fim, setFim] = useState(hoje);
  const [recebidas, setRecebidas] = useState<any[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);

  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSinc, setUltimaSinc] = useState<string | null>(null);
  const [cienciaChave, setCienciaChave] = useState<string | null>(null);
  const [devolverId, setDevolverId] = useState<string | null>(null);

  const buscarNotas = async () => {
    setBuscando(true);
    const { data, error } = await supabase.functions.invoke("nfes-recebidas", { body: { action: "listar", inicio, fim } });
    setBuscando(false);
    if (error || data?.error) return toast.error(data?.error || await functionErrorMessage(error, "Não foi possível buscar as notas."));
    setRecebidas(data.notas || []);
    setUltimaSinc(data.ultima_sincronizacao ?? null);
  };

  const sincronizar = async () => {
    setSincronizando(true);
    const { data, error } = await supabase.functions.invoke("nfes-recebidas", { body: { action: "sincronizar" } });
    setSincronizando(false);
    if (error || data?.error) return toast.error(data?.error || await functionErrorMessage(error, "Não foi possível atualizar da SEFAZ."));
    toast.success(data.atualizadas ? `${data.atualizadas} nota(s) atualizada(s).` : "Nenhuma nota nova na SEFAZ.");
    await buscarNotas();
  };

  const [chaveBusca, setChaveBusca] = useState("");
  const [cienciaModo, setCienciaModo] = useState<"importar" | "baixar">("importar");

  const buscarPorChave = async () => {
    const chave = chaveBusca.replace(/\D/g, "");
    if (chave.length !== 44) return toast.error("A chave de acesso precisa ter 44 números.");
    setBuscando(true);
    const { data, error } = await supabase.functions.invoke("nfes-recebidas", { body: { action: "buscar_chave", chave } });
    setBuscando(false);
    if (error || data?.error) return toast.error(data?.error || await functionErrorMessage(error, "Não foi possível buscar a nota."));
    setRecebidas(data.nota ? [data.nota] : []);
  };

  const importarChave = async (chave: string, confirmar_ciencia = false, modo: "importar" | "baixar" = "importar") => {
    setBaixando(chave);
    const { data, error } = await supabase.functions.invoke("nfes-recebidas", { body: { action: "xml", chave, confirmar_ciencia } });
    setBaixando(null);
    if (data?.precisa_ciencia) { setCienciaModo(modo); return setCienciaChave(chave); }
    if (error || !data?.xml) return toast[data?.pendente ? "info" : "error"](data?.error || await functionErrorMessage(error, "Não foi possível baixar o XML."));
    if (modo === "baixar") {
      const url = URL.createObjectURL(new Blob([data.xml], { type: "application/xml" }));
      const a = document.createElement("a"); a.href = url; a.download = `${chave}.xml`; a.click();
      URL.revokeObjectURL(url);
      return;
    }
    await processXml(data.xml);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const processXml = async (text: string) => {
    if (!org) return;
    setDone(null);
    try {
      const n = parseNfeXml(text);
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
      const db = supabase as any;
      const { data: forn } = await supabase.from("fornecedores").select("id").eq("organization_id", org).eq("cpf_cnpj", nota.emitente.cpf_cnpj).limit(1);
      const totalProd = nota.produtos.reduce((s, p) => s + p.quantidade * p.custo_unitario, 0);
      const { data: nc, error: ncErr } = await db.from("notas_compra").insert({
        organization_id: org, fornecedor_id: forn?.[0]?.id ?? null, chave_acesso: nota.chave || null,
        numero: nota.numero || "s/n", serie: nota.serie || "1", data_emissao: new Date().toISOString(),
        valor_produtos: totalProd, valor_total: totalProd, created_by: user.id,
      }).select("id").single();
      if (ncErr) throw ncErr;
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
        const { error: itErr } = await db.from("notas_compra_itens").insert({
          nota_compra_id: nc.id, organization_id: org, item_estoque_id: itemId, codigo_fornecedor: p.codigo || null,
          descricao: p.descricao, ncm: p.ncm || null, cfop: p.cfop || null, unidade: p.unidade || null,
          quantidade: p.quantidade, valor_unitario: p.custo_unitario, valor_total: p.quantidade * p.custo_unitario,
        });
        if (itErr) throw itErr;
      }
      if (nota.chave) {
        await db.from("notas_recebidas").update({ importada: true, nota_compra_id: nc.id }).eq("organization_id", org).eq("chave_acesso", nota.chave);
        setRecebidas((rs) => rs?.map((r) => r.chave_acesso === nota.chave ? { ...r, importada: true, nota_compra_id: nc.id } : r) ?? rs);
      }
      log.push(`Nota de compra nº ${nota.numero} registrada.`);
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

        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Buscar notas emitidas para a empresa</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[260px]"><label className="text-xs text-muted-foreground">Chave de acesso</label>
                <Input inputMode="numeric" className="font-mono" placeholder="44 números da chave" value={chaveBusca}
                  onChange={(e) => setChaveBusca(e.target.value.replace(/\D/g, "").slice(0, 44))} onKeyDown={(e) => e.key === "Enter" && buscarPorChave()} /></div>
              <Button onClick={buscarPorChave} disabled={buscando}>{buscando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}Buscar</Button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div><label className="text-xs text-muted-foreground">De</label><Input type="date" value={inicio} max={fim} onChange={(e) => setInicio(e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">Até</label><Input type="date" value={fim} min={inicio} max={hoje} onChange={(e) => setFim(e.target.value)} /></div>
              <Button onClick={buscarNotas} disabled={buscando}>{buscando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}Buscar notas</Button>
              <Button variant="outline" onClick={sincronizar} disabled={sincronizando}>{sincronizando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}Atualizar da SEFAZ</Button>
            </div>
            {ultimaSinc && <p className="text-xs text-muted-foreground">Última atualização da SEFAZ: {new Date(ultimaSinc).toLocaleString("pt-BR")}</p>}
            {recebidas && (recebidas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma nota no período. Use "Atualizar da SEFAZ" para trazer notas novas.</p> : (
              <div className="space-y-2">{recebidas.map((n) => (
                <div key={n.chave_acesso} className="flex flex-col md:flex-row md:items-center gap-2 border rounded-md p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{n.nome_emitente || "Emitente"}</p>
                    <p className="text-xs text-muted-foreground font-mono">NF {n.numero} · {n.cnpj_emitente} · {n.data_emissao ? new Date(n.data_emissao).toLocaleDateString("pt-BR") : "—"}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {n.importada && <Badge variant="secondary">Importada</Badge>}
                      <Badge variant="outline">{n.tem_xml ? "XML disponível" : "Sem XML"}</Badge>
                      {n.manifestacao_destinatario && n.manifestacao_destinatario !== "sem_manifestacao" && <Badge variant="outline">Ciência registrada</Badge>}
                    </div>
                  </div>
                  <span className="font-semibold">{brl(Number(n.valor_total) || 0)}</span>
                  {n.importada && n.nota_compra_id && <Button size="sm" variant="outline" onClick={() => setDevolverId(n.nota_compra_id)}>Devolver</Button>}
                  {n.situacao_sefaz !== "cancelada" && (
                    <Button size="sm" variant="outline" disabled={!!baixando || busy} onClick={() => importarChave(n.chave_acesso, false, "baixar")}>
                      <Download className="h-4 w-4 mr-2" />Baixar XML
                    </Button>)}
                  {n.situacao_sefaz === "cancelada" ? <Badge variant="destructive">Cancelada</Badge> : (
                    <Button size="sm" variant="outline" disabled={!!baixando || busy} onClick={() => importarChave(n.chave_acesso)}>
                      {baixando === n.chave_acesso ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}{n.importada ? "Reimportar" : "Importar"}
                    </Button>)}
                </div>))}</div>))}
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
      <DevolucaoCompraDialog notaCompraId={devolverId} onOpenChange={(o) => !o && setDevolverId(null)} />
      <AlertDialog open={!!cienciaChave} onOpenChange={(o) => !o && setCienciaChave(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar ciência da operação?</AlertDialogTitle>
            <AlertDialogDescription>A SEFAZ exige registrar "Ciência da Operação" para liberar o XML completo desta nota. Esse registro fica vinculado ao CNPJ da empresa.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const c = cienciaChave; setCienciaChave(null); if (c) importarChave(c, true, cienciaModo); }}>Confirmar ciência</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
