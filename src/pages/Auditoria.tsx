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
import { getErrorMessage } from "@/lib/formatters";
import { toast } from "sonner";
import { Download, History, Loader2, Search } from "lucide-react";

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

export default function Auditoria() {
  const { organization } = useOrganization();
  const [linhas, setLinhas] = useState<Trilha[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(20);
  const [carregando, setCarregando] = useState(true);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [detalhe, setDetalhe] = useState<Trilha | null>(null);

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
        let consulta = supabase
          .from("audit_trail" as any)
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false });

        if (organization?.id) consulta = consulta.eq("organization_id", organization.id);
        if (de) consulta = consulta.gte("created_at", `${de}T00:00:00`);
        if (ate) consulta = consulta.lte("created_at", `${ate}T23:59:59`);
        if (acao !== "todas") consulta = consulta.eq("acao", acao);
        if (tabela !== "todas") consulta = consulta.eq("tabela", tabela);
        if (usuario !== "todos") consulta = consulta.eq("usuario_id", usuario);

        // Um campo so serve para as duas buscas: id do registro ou nome do campo alterado.
        const termo = busca.trim();
        if (UUID.test(termo)) {
          consulta = consulta.eq("registro_id", termo);
        } else {
          const campo = nomeCampoBusca(termo);
          if (campo) consulta = consulta.contains("campos", [campo]);
        }

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

  const exportar = async () => {
    try {
      let consulta = supabase
        .from("audit_trail" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5000);

      if (organization?.id) consulta = consulta.eq("organization_id", organization.id);
      if (de) consulta = consulta.gte("created_at", `${de}T00:00:00`);
      if (ate) consulta = consulta.lte("created_at", `${ate}T23:59:59`);
      if (acao !== "todas") consulta = consulta.eq("acao", acao);
      if (tabela !== "todas") consulta = consulta.eq("tabela", tabela);
      if (usuario !== "todos") consulta = consulta.eq("usuario_id", usuario);
      const termo = busca.trim();
      if (UUID.test(termo)) consulta = consulta.eq("registro_id", termo);
      else {
        const campo = nomeCampoBusca(termo);
        if (campo) consulta = consulta.contains("campos", [campo]);
      }

      const { data, error } = await consulta;
      if (error) throw error;

      const linhas = ((data || []) as unknown as Trilha[]).map((l) => ({
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
          <Button variant="outline" onClick={exportar}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
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
