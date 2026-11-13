import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { formatDate, getErrorMessage } from "@/lib/formatters";
import { gerarDocumentoPadrao, loadImageAsDataUrl, type ColunaPDF } from "@/lib/pdf-padrao";
import { toast } from "sonner";
import { AlertBox } from "@/components/premium/AlertBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, FileText, Loader2, Plus, SlidersHorizontal, Trash2 } from "lucide-react";

type AppRole = "admin" | "tecnico" | "consulta";
type TipoColuna = "texto" | "numero" | "data" | "booleano";

interface ColunaMeta {
  nome: string;
  rotulo: string;
  tipo: TipoColuna;
}

interface FonteRelatorio {
  id: string;
  rotulo: string;
  coluna_data: string | null;
  colunas: ColunaMeta[];
  filtros: string[];
  perfis: string[];
}

interface LinhaFiltro {
  id: number;
  campo: string;
  operador: string;
  valor: string;
}

interface ResultadoRelatorio {
  fonte: string;
  rotulo: string;
  colunas: ColunaMeta[];
  linhas: Record<string, unknown>[];
  total_linhas: number;
  limitado: boolean;
}

/** Critérios usados na geração, para o PDF descrever exatamente o que está na tela. */
interface Criterios {
  dataInicio: string;
  dataFim: string;
  filtros: LinhaFiltro[];
}

const OPERADORES: { value: string; label: string }[] = [
  { value: "eq", label: "Igual a" },
  { value: "neq", label: "Diferente de" },
  { value: "gt", label: "Maior que" },
  { value: "gte", label: "Maior ou igual a" },
  { value: "lt", label: "Menor que" },
  { value: "lte", label: "Menor ou igual a" },
  { value: "in", label: "Está entre (separar por vírgula)" },
  { value: "ilike", label: "Contém" },
  { value: "is_null", label: "Está vazio" },
  { value: "not_null", label: "Não está vazio" },
];

/** Operadores que não usam valor digitado. */
const SEM_VALOR = ["is_null", "not_null"];
const LIMITE_PADRAO = 5000;
const LIMITE_MAXIMO = 10000;

function valorTexto(valor: unknown, tipo: TipoColuna): string {
  if (valor === null || valor === undefined || valor === "") return "-";
  if (tipo === "booleano") return valor ? "Sim" : "Não";
  if (tipo === "data") return formatDate(String(valor));
  if (tipo === "numero") return typeof valor === "number" ? valor.toLocaleString("pt-BR") : String(valor);
  return String(valor);
}

/** Impede que um valor iniciado por =, +, - ou @ seja interpretado como fórmula na planilha. */
function protegerPlanilha(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

function rotuloOperador(operador: string): string {
  return OPERADORES.find((op) => op.value === operador)?.label || operador;
}

/**
 * Distribui a largura útil do PDF conforme o conteúdo real de cada coluna, em vez de
 * dividir igualmente: colunas estreitas (data, valor, sim/não) não roubam espaço das
 * colunas de texto. O resultado sempre soma exatamente a largura disponível.
 */
function calcularLarguras(colunas: ColunaMeta[], linhas: Record<string, unknown>[], disponivel: number): number[] {
  const pesos = colunas.map((col) => {
    const maiorCelula = linhas.reduce(
      (maior, linha) => Math.max(maior, valorTexto(linha[col.nome], col.tipo).length),
      0,
    );
    return Math.min(40, Math.max(8, Math.max(col.rotulo.length, maiorCelula)));
  });
  const soma = pesos.reduce((a, b) => a + b, 0);
  const comMinimo = pesos.map((peso) => Math.max(11, (peso / soma) * disponivel));
  const somaMinimo = comMinimo.reduce((a, b) => a + b, 0);
  return comMinimo.map((largura) => (largura / somaMinimo) * disponivel);
}

function baixarCsv(csv: string, nome: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export function RelatorioPersonalizado() {
  const { roles } = useAuth();
  const { organization } = useOrganization();
  const [fontes, setFontes] = useState<FonteRelatorio[] | null>(null);
  const [fonteId, setFonteId] = useState("");
  const [colunasSel, setColunasSel] = useState<string[]>([]);
  const [filtros, setFiltros] = useState<LinhaFiltro[]>([]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [limite, setLimite] = useState(String(LIMITE_PADRAO));
  const [gerando, setGerando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [resultado, setResultado] = useState<ResultadoRelatorio | null>(null);
  const [criterios, setCriterios] = useState<Criterios | null>(null);

  useEffect(() => {
    const carregar = async () => {
      const { data, error } = await supabase
        .from("relatorio_fontes" as any)
        .select("id, rotulo, coluna_data, colunas, filtros, perfis")
        .order("rotulo");
      if (error) {
        toast.error(getErrorMessage(error));
        setFontes([]);
        return;
      }
      const meus = ((data || []) as unknown as FonteRelatorio[]).filter((f) =>
        (f.perfis || []).some((p) => (roles as AppRole[]).includes(p as AppRole)),
      );
      setFontes(meus);
    };
    carregar();
  }, [roles]);

  const fonte = useMemo(
    () => (fontes || []).find((f) => f.id === fonteId) || null,
    [fontes, fonteId],
  );

  useEffect(() => {
    setColunasSel(fonte ? fonte.colunas.map((c) => c.nome) : []);
    setFiltros([]);
    setResultado(null);
    setCriterios(null);
  }, [fonte]);

  const toggleColuna = (nome: string, marcado: boolean) => {
    setColunasSel((atual) => (marcado ? [...atual, nome] : atual.filter((c) => c !== nome)));
  };

  const tipoDoCampo = (campo: string): TipoColuna =>
    fonte?.colunas.find((c) => c.nome === campo)?.tipo ?? "texto";

  const rotuloDoCampo = (campo: string): string =>
    fonte?.colunas.find((c) => c.nome === campo)?.rotulo ?? campo;

  const adicionarFiltro = () => {
    if (!fonte || fonte.filtros.length === 0) return;
    setFiltros((atual) => [
      ...atual,
      { id: Date.now() + atual.length, campo: fonte.filtros[0], operador: "eq", valor: "" },
    ]);
  };

  const atualizarFiltro = (id: number, mudanca: Partial<LinhaFiltro>) => {
    setFiltros((atual) => atual.map((f) => (f.id === id ? { ...f, ...mudanca } : f)));
  };

  const handleGerar = async () => {
    if (!fonte) return;
    if (colunasSel.length === 0) {
      toast.error("Selecione ao menos uma coluna.");
      return;
    }
    const limiteNumero = Math.trunc(Number(limite));
    if (!Number.isFinite(limiteNumero) || limiteNumero < 1) {
      toast.error("Informe um limite entre 1 e 10000 linhas.");
      return;
    }

    const filtrosUsados = filtros
      .filter((f) => f.campo && f.operador)
      .map((f) => ({
        campo: f.campo,
        operador: f.operador,
        valor: SEM_VALOR.includes(f.operador) ? "" : f.valor,
      }));

    setGerando(true);
    try {
      const { data, error } = await supabase.rpc("gerar_relatorio" as any, {
        _fonte: fonte.id,
        _colunas: colunasSel,
        _filtros: filtrosUsados,
        _data_inicio: dataInicio || null,
        _data_fim: dataFim || null,
        _limite: Math.min(limiteNumero, LIMITE_MAXIMO),
      });
      if (error) throw error;
      setResultado(data as unknown as ResultadoRelatorio);
      setCriterios({
        dataInicio,
        dataFim,
        filtros: filtrosUsados.map((f) => ({ ...f, id: 0 })),
      });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setGerando(false);
    }
  };

  const handleExportar = () => {
    if (!resultado) return;
    const linhas = resultado.linhas.map((linha) => {
      const registro: Record<string, string> = {};
      resultado.colunas.forEach((col) => {
        registro[col.rotulo] = protegerPlanilha(valorTexto(linha[col.nome], col.tipo));
      });
      return registro;
    });
    const csv = Papa.unparse(linhas, { columns: resultado.colunas.map((c) => c.rotulo) });
    baixarCsv(csv, `relatorio_${resultado.fonte}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const descricaoPeriodo = (c: Criterios | null): string => {
    if (!c || (!c.dataInicio && !c.dataFim)) return "Período: todos os registros";
    const de = c.dataInicio ? formatDate(c.dataInicio) : "início";
    return `Período: ${de} a ${c.dataFim ? formatDate(c.dataFim) : "hoje"}`;
  };

  const descricaoFiltros = (c: Criterios | null): string => {
    const aplicados = c?.filtros?.filter((f) => f.campo && f.operador) || [];
    const resumo = aplicados.length
      ? `Filtros: ${aplicados
          .map((f) =>
            SEM_VALOR.includes(f.operador)
              ? `${rotuloDoCampo(f.campo)} ${rotuloOperador(f.operador).toLowerCase()}`
              : `${rotuloDoCampo(f.campo)} ${rotuloOperador(f.operador).toLowerCase()} ${f.valor}`,
          )
          .join("; ")}`
      : "Filtros: nenhum";
    return resultado?.limitado
      ? `${resumo}. Atenção: exibindo as primeiras ${resultado.linhas.length} de ${resultado.total_linhas} linhas encontradas.`
      : `${resumo}.`;
  };

  const handleGerarPdf = async () => {
    if (!resultado) return;
    setGerandoPdf(true);
    try {
      const { data: emp } = organization?.id
        ? await supabase
            .from("empresa_config")
            .select("nome_empresa, cnpj, telefone, endereco, logo_url")
            .eq("organization_id", organization.id)
            .maybeSingle()
        : { data: null };

      const larguras = calcularLarguras(resultado.colunas, resultado.linhas, 297 - 30);
      const colunasPdf: ColunaPDF[] = resultado.colunas.map((col, i) => ({
        titulo: col.rotulo,
        largura: larguras[i],
        alinhar: col.tipo === "numero" ? "right" : "left",
      }));
      const linhasPdf = resultado.linhas.map((linha) =>
        resultado.colunas.map((col) => valorTexto(linha[col.nome], col.tipo)),
      );

      const doc = gerarDocumentoPadrao({
        orientacao: "paisagem",
        titulo: resultado.rotulo,
        linhasCabecalho: [
          `Emissão: ${new Date().toLocaleString("pt-BR")}`,
          descricaoPeriodo(criterios),
          `Registros: ${resultado.linhas.length}${resultado.limitado ? ` de ${resultado.total_linhas}` : ""}`,
        ],
        empresa: {
          nome: emp?.nome_empresa || organization?.name || "Empresa",
          cnpj: emp?.cnpj,
          telefone: emp?.telefone,
          endereco: emp?.endereco,
          logoDataUrl: await loadImageAsDataUrl(emp?.logo_url),
        },
        observacao: descricaoFiltros(criterios),
        tabela: {
          colunas: colunasPdf,
          linhas: linhasPdf,
          vazio: "Nenhum registro encontrado com os critérios informados.",
        },
        rodape: `${emp?.nome_empresa || organization?.name || ""} · Relatório de ${resultado.rotulo}`,
      });
      doc.save(`relatorio_${resultado.fonte}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setGerandoPdf(false);
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          Relatório personalizado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fontes === null ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : fontes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma fonte de relatório disponível para o seu perfil.
          </p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1 lg:col-span-2">
                <Label className="text-xs">Fonte de dados</Label>
                <Select value={fonteId} onValueChange={setFonteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o que relatar" />
                  </SelectTrigger>
                  <SelectContent>
                    {fontes.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">De</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  disabled={!fonte}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Até</Label>
                <Input
                  type="date"
                  value={dataFim}
                  disabled={!fonte}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Limite de linhas</Label>
                <Input
                  type="number"
                  min={1}
                  max={LIMITE_MAXIMO}
                  value={limite}
                  disabled={!fonte}
                  onChange={(e) => setLimite(e.target.value)}
                />
              </div>
            </div>

            {fonte && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Label className="text-xs">Colunas</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setColunasSel(fonte.colunas.map((c) => c.nome))}
                      >
                        Selecionar todas
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setColunasSel([])}
                      >
                        Limpar
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {fonte.colunas.map((col) => (
                      <label key={col.nome} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={colunasSel.includes(col.nome)}
                          onCheckedChange={(v) => toggleColuna(col.nome, v === true)}
                        />
                        <span>{col.rotulo}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Label className="text-xs">Filtros</Label>
                    <Button type="button" variant="outline" size="sm" onClick={adicionarFiltro}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Adicionar filtro
                    </Button>
                  </div>
                  {filtros.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Sem filtros: o relatório traz todos os registros do período.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {filtros.map((filtro) => (
                        <div key={filtro.id} className="flex flex-wrap items-end gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Campo</Label>
                            <Select
                              value={filtro.campo}
                              onValueChange={(v) =>
                                atualizarFiltro(filtro.id, { campo: v, valor: "" })
                              }
                            >
                              <SelectTrigger className="w-52">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {fonte.filtros.map((nome) => (
                                  <SelectItem key={nome} value={nome}>
                                    {rotuloDoCampo(nome)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Condição</Label>
                            <Select
                              value={filtro.operador}
                              onValueChange={(v) => atualizarFiltro(filtro.id, { operador: v })}
                            >
                              <SelectTrigger className="w-56">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {OPERADORES.map((op) => (
                                  <SelectItem key={op.value} value={op.value}>
                                    {op.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Valor</Label>
                            {tipoDoCampo(filtro.campo) === "booleano" ? (
                              <Select
                                value={filtro.valor}
                                onValueChange={(v) => atualizarFiltro(filtro.id, { valor: v })}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue placeholder="Escolha" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="true">Sim</SelectItem>
                                  <SelectItem value="false">Não</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                className="w-56"
                                type={tipoDoCampo(filtro.campo) === "data" ? "date" : "text"}
                                value={filtro.valor}
                                disabled={SEM_VALOR.includes(filtro.operador)}
                                placeholder={
                                  tipoDoCampo(filtro.campo) === "numero" ? "0,00" : "Valor"
                                }
                                onChange={(e) =>
                                  atualizarFiltro(filtro.id, { valor: e.target.value })
                                }
                              />
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Remover filtro"
                            onClick={() =>
                              setFiltros((atual) => atual.filter((f) => f.id !== filtro.id))
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <Button
                    className="gradient-primary shadow-medium"
                    onClick={handleGerar}
                    disabled={gerando}
                  >
                    {gerando ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                    )}
                    Gerar relatório
                  </Button>
                  {resultado && (
                    <>
                      <Button variant="outline" onClick={handleExportar} disabled={gerandoPdf}>
                        <Download className="mr-2 h-4 w-4" />
                        Exportar CSV
                      </Button>
                      <Button variant="outline" onClick={handleGerarPdf} disabled={gerandoPdf}>
                        {gerandoPdf ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="mr-2 h-4 w-4" />
                        )}
                        Gerar PDF
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}

            {resultado && (
              <div className="space-y-3">
                {resultado.limitado && (
                  <AlertBox
                    type="warning"
                    title="Relatório limitado"
                    items={[
                      { label: "Registros encontrados", value: String(resultado.total_linhas) },
                      { label: "Linhas exibidas", value: String(resultado.linhas.length) },
                    ]}
                  />
                )}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm font-medium">{resultado.rotulo}</p>
                  <Badge variant="secondary">
                    {resultado.linhas.length} de {resultado.total_linhas} registro(s)
                  </Badge>
                </div>
                {resultado.linhas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum registro encontrado com os critérios informados.
                  </p>
                ) : (
                  <div className="overflow-x-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {resultado.colunas.map((col) => (
                            <TableHead key={col.nome} className="whitespace-nowrap px-3 py-2 text-xs">
                              {col.rotulo}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resultado.linhas.map((linha, idx) => (
                          <TableRow key={idx}>
                            {resultado.colunas.map((col) => (
                              <TableCell key={col.nome} className="whitespace-nowrap px-3 py-1.5 text-xs">
                                {valorTexto(linha[col.nome], col.tipo)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
