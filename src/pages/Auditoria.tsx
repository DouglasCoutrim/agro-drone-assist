import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecordPagination } from "@/components/RecordPagination";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, getErrorMessage } from "@/lib/formatters";
import { gerarDocumentoPadrao, loadImageAsDataUrl, type ColunaPDF } from "@/lib/pdf-padrao";
import { toast } from "sonner";
import { Download, FileText, History, Loader2, Search } from "lucide-react";

interface Trilha {
  id: string;
  organization_id: string;
  tabela: string;
  registro_id: string | null;
  acao: "INSERT" | "UPDATE" | "DELETE";
  campos: string[];
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  usuario_id: string | null;
  usuario_nome: string | null;
  usuario_email: string | null;
  created_at: string;
}

interface Usuario {
  id: string;
  nome: string | null;
  email: string | null;
}

/** Nome da tabela tecnicamente como esta no banco -> como o usuario conhece a tela. */
const TABELAS: Record<string, string> = {
  clientes: "Clientes",
  fornecedores: "Fornecedores",
  transportadoras: "Transportadoras",
  servicos: "Serviços",
  produtos: "Produtos (legado)",
  itens_estoque: "Estoque",
  movimentacoes_estoque: "Movimentações de estoque",
  transferencias_estoque: "Transferências de estoque",
  estoque_tecnico: "Estoque do técnico",
  saidas_demonstracao: "Itens para demonstração",
  ordens_servico: "Ordens de serviço",
  itens_os: "Itens da OS",
  os_anexos: "Anexos da OS",
  os_checklist_itens: "Checklist da OS",
  checklist_equipamento_itens: "Checklist: itens",
  checklist_tipos_equipamento: "Checklist: tipos de equipamento",
  orcamentos: "Orçamentos",
  vendas: "Vendas",
  venda_itens: "Itens da venda",
  financeiro: "Financeiro",
  contas_pagar: "Contas a pagar",
  fechamentos_dia: "Fechamento do dia",
  technician_expenses: "Despesas de técnico",
  tax_retention_ledger: "Retenções de imposto",
  nota_fiscal_emitida: "Notas fiscais",
  fiscal_documents: "Documentos fiscais",
  fiscal_regras: "Regras fiscais",
  fiscal_company_config: "Configuração fiscal",
  nfe_config: "Configuração de NF-e",
  notas_compra: "Notas de compra",
  notas_compra_itens: "Itens da nota de compra",
  notas_recebidas: "Notas recebidas",
  pedidos_compra: "Pedidos de compra",
  solicitacoes_compra: "Solicitações de compra",
  cotacoes_compra: "Cotações de compra",
  devolucoes_compra: "Devoluções de compra",
  devolucoes_venda: "Devoluções de venda",
  patrimonio_ferramentas: "Ferramentas e equipamentos",
  rotas: "Rotas",
  empresa_config: "Dados da empresa",
  empresa_gateway_credenciais: "Credenciais de pagamento",
  profiles: "Usuários",
};

const ACOES: Record<Trilha["acao"], { label: string; classe: string }> = {
  INSERT: { label: "Criou", classe: "bg-green-100 text-green-800 border-green-200" },
  UPDATE: { label: "Alterou", classe: "bg-amber-100 text-amber-800 border-amber-200" },
  DELETE: { label: "Excluiu", classe: "bg-red-100 text-red-800 border-red-200" },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function nomeTabela(tabela: string): string {
  return TABELAS[tabela] || tabela;
}

/** "valor_total" -> "valor total": o nome tecnico da coluna fica legivel sem inventar rotulo. */
function nomeCampo(campo: string): string {
  return campo.replace(/_/g, " ");
}

/** Nome de coluna aceito na busca: evita mandar vírgula, chave ou espaço para o filtro de lista. */
function nomeCampoBusca(termo: string): string {
  return /^[a-zA-Z0-9_]+$/.test(termo) ? termo : "";
}

function mostraValor(valor: unknown): string {
  if (valor === null || valor === undefined) return "-";
  if (typeof valor === "object") return JSON.stringify(valor);
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  return String(valor);
}

interface FiltrosAuditoria {
  organizationId?: string;
  de: string;
  ate: string;
  acao: string;
  tabela: string;
  usuario: string;
  busca: string;
}

/**
 * Recorte único da tela: lista, CSV e PDF passam por aqui, senão os três divergem
 * com o tempo e o arquivo exportado deixa de ser o que a pessoa está vendo.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltros(consulta: any, f: FiltrosAuditoria) {
  let c = consulta;
  if (f.organizationId) c = c.eq("organization_id", f.organizationId);
  if (f.de) c = c.gte("created_at", `${f.de}T00:00:00`);
  if (f.ate) c = c.lte("created_at", `${f.ate}T23:59:59`);
  if (f.acao !== "todas") c = c.eq("acao", f.acao);
  if (f.tabela !== "todas") c = c.eq("tabela", f.tabela);
  if (f.usuario !== "todos") c = c.eq("usuario_id", f.usuario);

  // Um campo só serve para as duas buscas: id do registro ou nome do campo alterado.
  const termo = f.busca.trim();
  if (UUID.test(termo)) {
    c = c.eq("registro_id", termo);
  } else {
    const campo = nomeCampoBusca(termo);
    if (campo) c = c.contains("campos", [campo]);
  }
  return c;
}

/** "campo: antes → depois" por campo alterado: no PDF é isso que conta a história da linha. */
function textoAlteracoes(linha: Trilha): string {
  const campos = linha.campos || [];
  if (!campos.length) return "-";
  return campos
    .map((campo) => {
      const rotulo = nomeCampo(campo);
      if (linha.acao === "INSERT") return `${rotulo}: ${mostraValor(linha.depois?.[campo])}`;
      if (linha.acao === "DELETE") return `${rotulo}: ${mostraValor(linha.antes?.[campo])}`;
      return `${rotulo}: ${mostraValor(linha.antes?.[campo])} → ${mostraValor(linha.depois?.[campo])}`;
    })
    .join("; ");
}

const LIMITE_EXPORTACAO = 5000;

/** Uma linha com dezenas de campos alterados viraria uma faixa de páginas: no PDF ela é resumida. */
const LIMITE_TEXTO_PDF = 500;

export default function Auditoria() {
  const { organization } = useOrganization();
  const [linhas, setLinhas] = useState<Trilha[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(20);
  const [carregando, setCarregando] = useState(true);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [detalhe, setDetalhe] = useState<Trilha | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [acao, setAcao] = useState("todas");
  const [tabela, setTabela] = useState("todas");
  const [usuario, setUsuario] = useState("todos");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!organization?.id) return;
    supabase
      .from("profiles")
      .select("id, nome, email")
      .eq("organization_id", organization.id)
      .order("nome")
      .then(({ data }) => setUsuarios((data || []) as Usuario[]));
  }, [organization?.id]);

  useEffect(() => {
    const carregar = async () => {
      setCarregando(true);
      try {
        const consulta = aplicarFiltros(
          supabase.from("audit_trail" as any).select("*", { count: "exact" }).order("created_at", { ascending: false }),
          { organizationId: organization?.id, de, ate, acao, tabela, usuario, busca },
        );

        const inicio = (pagina - 1) * porPagina;
        const { data, error, count } = await consulta.range(inicio, inicio + porPagina - 1);
        if (error) throw error;
        setLinhas((data || []) as unknown as Trilha[]);
        setTotal(count || 0);
      } catch (e) {
        toast.error(getErrorMessage(e));
        setLinhas([]);
        setTotal(0);
      } finally {
        setCarregando(false);
      }
    };
    carregar();
  }, [organization?.id, pagina, porPagina, de, ate, acao, tabela, usuario, busca]);

  // Mudar qualquer filtro volta para a primeira pagina.
  useEffect(() => {
    setPagina(1);
  }, [de, ate, acao, tabela, usuario, busca]);

  const tabelasDisponiveis = useMemo(
    () => Object.keys(TABELAS).sort((a, b) => nomeTabela(a).localeCompare(nomeTabela(b))),
    [],
  );

  /** Mesmo recorte da tela, mas sem paginação: a exportação leva tudo o que os filtros pegam. */
  const buscarRegistros = async (limite: number): Promise<Trilha[]> => {
    const consulta = aplicarFiltros(
      supabase.from("audit_trail" as any).select("*").order("created_at", { ascending: false }).limit(limite),
      { organizationId: organization?.id, de, ate, acao, tabela, usuario, busca },
    );
    const { data, error } = await consulta;
    if (error) throw error;
    return (data || []) as unknown as Trilha[];
  };

  /** Texto que acompanha o arquivo: sem ele o PDF não diz a que recorte ele se refere. */
  const descricaoFiltros = (): string => {
    const dono = usuarios.find((u) => u.id === usuario);
    return [
      de || ate ? `Período: ${de ? formatDate(de) : "início"} a ${ate ? formatDate(ate) : "hoje"}` : "Período: todo o histórico",
      `Ação: ${acao === "todas" ? "todas" : ACOES[acao as Trilha["acao"]]?.label || acao}`,
      `Tela: ${tabela === "todas" ? "todas" : nomeTabela(tabela)}`,
      `Usuário: ${usuario === "todos" ? "todos" : dono?.nome || dono?.email || usuario}`,
      `Busca: ${busca.trim() || "nenhuma"}`,
    ].join("  |  ");
  };

  const exportar = async () => {
    try {
      const registros = await buscarRegistros(LIMITE_EXPORTACAO);
      const linhas = registros.map((l) => ({
        Quando: new Date(l.created_at).toLocaleString("pt-BR"),
        Quem: l.usuario_nome || "Sistema",
        "E-mail": l.usuario_email || "",
        Ação: ACOES[l.acao]?.label || l.acao,
        Tela: nomeTabela(l.tabela),
        Registro: l.registro_id || "",
        "Campos alterados": (l.campos || []).join(", "),
        Antes: l.antes ? JSON.stringify(l.antes) : "",
        Depois: l.depois ? JSON.stringify(l.depois) : "",
      }));

      const csv = Papa.unparse(linhas);
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${linhas.length} registro(s) exportado(s)`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const exportarPdf = async () => {
    setGerandoPdf(true);
    try {
      const registros = await buscarRegistros(LIMITE_EXPORTACAO);
      const { data: emp } = organization?.id
        ? await supabase
            .from("empresa_config")
            .select("nome_empresa, cnpj, telefone, endereco, logo_url")
            .eq("organization_id", organization.id)
            .maybeSingle()
        : { data: null };

      // Largura fixa, sem `ajustarLargura`: as seis colunas são conhecidas e o id do registro
      // precisa de espaço garantido. Um valor longo sem espaços (json, url) deformaria a
      // medição automática e encolheria as outras colunas.
      const colunas: ColunaPDF[] = [
        { titulo: "Quando", largura: 34 },
        { titulo: "Quem", largura: 45 },
        { titulo: "Ação", largura: 16 },
        { titulo: "Tela", largura: 30 },
        { titulo: "Registro", largura: 64 },
        { titulo: "Alterações", largura: 78 },
      ];
      let resumido = false;
      const linhas = registros.map((l) => {
        const alteracoes = textoAlteracoes(l);
        if (alteracoes.length > LIMITE_TEXTO_PDF) resumido = true;
        return [
          new Date(l.created_at).toLocaleString("pt-BR"),
          l.usuario_email ? `${l.usuario_nome || "Sistema"} (${l.usuario_email})` : l.usuario_nome || "Sistema",
          ACOES[l.acao]?.label || l.acao,
          nomeTabela(l.tabela),
          l.registro_id || "-",
          alteracoes.length > LIMITE_TEXTO_PDF ? `${alteracoes.slice(0, LIMITE_TEXTO_PDF)}...` : alteracoes,
        ];
      });

      const doc = gerarDocumentoPadrao({
        orientacao: "paisagem",
        titulo: "Auditoria",
        linhasCabecalho: [
          `Emissão: ${new Date().toLocaleString("pt-BR")}`,
          `Registros: ${registros.length}${registros.length >= LIMITE_EXPORTACAO ? ` (limite de ${LIMITE_EXPORTACAO})` : ""}`,
        ],
        empresa: {
          nome: emp?.nome_empresa || organization?.name || "Empresa",
          cnpj: emp?.cnpj,
          telefone: emp?.telefone,
          endereco: emp?.endereco,
          logoDataUrl: await loadImageAsDataUrl(emp?.logo_url),
        },
        observacao: `${descricaoFiltros()}${resumido ? ` Alterações com mais de ${LIMITE_TEXTO_PDF} caracteres aparecem resumidas; o CSV traz o conteúdo completo.` : ""}`,
        tabela: {
          colunas,
          linhas,
          vazio: "Nenhum registro de auditoria encontrado com esses filtros.",
        },
        rodape: `${emp?.nome_empresa || organization?.name || ""} · Auditoria`,
      });
      doc.save(`auditoria_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setGerandoPdf(false);
    }
  };

  const camposDoDetalhe = detalhe
    ? Array.from(new Set([...(detalhe.campos || [])])).sort()
    : [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <History className="h-6 w-6 text-primary" />
              Auditoria
            </h1>
            <p className="text-sm text-muted-foreground">
              Quem criou, alterou ou excluiu cada registro, com o que mudou antes e depois
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={exportar} disabled={gerandoPdf}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button variant="outline" onClick={exportarPdf} disabled={gerandoPdf}>
              {gerandoPdf ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Gerar PDF
            </Button>
          </div>
        </div>

        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              <div className="space-y-1">
                <Label className="text-xs">De</Label>
                <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Até</Label>
                <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Usuário</Label>
                <Select value={usuario} onValueChange={setUsuario}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {usuarios.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome || u.email || u.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ação</Label>
                <Select value={acao} onValueChange={setAcao}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="INSERT">Criou</SelectItem>
                    <SelectItem value="UPDATE">Alterou</SelectItem>
                    <SelectItem value="DELETE">Excluiu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tela</Label>
                <Select value={tabela} onValueChange={setTabela}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {tabelasDisponiveis.map((t) => (
                      <SelectItem key={t} value={t}>
                        {nomeTabela(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Busca</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Id do registro ou campo"
                  />
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Na busca, cole o id do registro para ver tudo que aconteceu com ele; ou digite o nome de um
              campo (ex.: <span className="font-mono">valor_total</span>) para achar quem mexeu naquele campo.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft overflow-hidden">
          <CardContent className="p-0">
            {carregando ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : linhas.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Nenhum registro de auditoria encontrado com esses filtros.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Quando</TableHead>
                      <TableHead className="w-48">Quem</TableHead>
                      <TableHead className="w-24">Ação</TableHead>
                      <TableHead className="w-56">Tela / registro</TableHead>
                      <TableHead>Campos alterados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((linha) => (
                      <TableRow
                        key={linha.id}
                        className="cursor-pointer"
                        onClick={() => setDetalhe(linha)}
                      >
                        <TableCell className="whitespace-nowrap px-3 py-2 text-xs">
                          <div>{new Date(linha.created_at).toLocaleDateString("pt-BR")}</div>
                          <div className="text-muted-foreground">
                            {new Date(linha.created_at).toLocaleTimeString("pt-BR")}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs">
                          <div className="font-medium">{linha.usuario_nome || "Sistema"}</div>
                          <div className="text-muted-foreground">{linha.usuario_email || "-"}</div>
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Badge variant="outline" className={ACOES[linha.acao]?.classe}>
                            {ACOES[linha.acao]?.label || linha.acao}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs">
                          <div className="font-medium">{nomeTabela(linha.tabela)}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {linha.registro_id ? `${linha.registro_id.slice(0, 8)}...` : "-"}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {(linha.campos || []).slice(0, 6).map((campo) => (
                              <Badge key={campo} variant="secondary" className="text-[10px]">
                                {nomeCampo(campo)}
                              </Badge>
                            ))}
                            {(linha.campos || []).length > 6 && (
                              <Badge variant="secondary" className="text-[10px]">
                                +{(linha.campos || []).length - 6}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {total > 0 && (
              <RecordPagination
                total={total}
                page={pagina}
                pageSize={porPagina}
                setPage={setPagina}
                setPageSize={setPorPagina}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!detalhe} onOpenChange={(aberto) => !aberto && setDetalhe(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detalhe ? `${ACOES[detalhe.acao]?.label} em ${nomeTabela(detalhe.tabela)}` : "Detalhe"}
            </DialogTitle>
            <DialogDescription>
              {detalhe && (
                <>
                  {new Date(detalhe.created_at).toLocaleString("pt-BR")} por{" "}
                  <span className="font-medium">{detalhe.usuario_nome || "Sistema"}</span>
                  {detalhe.registro_id ? ` · registro ${detalhe.registro_id}` : ""}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {detalhe && camposDoDetalhe.length === 0 ? (
            <p className="text-sm text-muted-foreground">Registro sem campos alterados.</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Campo</TableHead>
                    <TableHead>Antes</TableHead>
                    <TableHead>Depois</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {camposDoDetalhe.map((campo) => (
                    <TableRow key={campo}>
                      <TableCell className="px-3 py-2 text-xs font-medium">{nomeCampo(campo)}</TableCell>
                      <TableCell className="px-3 py-2 text-xs">
                        {mostraValor(detalhe.antes?.[campo])}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs">
                        {mostraValor(detalhe.depois?.[campo])}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
