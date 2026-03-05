import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Download, FileText, DollarSign, TrendingUp, TrendingDown,
  Users, Package, Zap, Loader2, Calendar, AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', '#8884d8', '#82ca9d'];

const STATUS_LABELS: Record<string, string> = {
  aberta: 'Aberta', em_andamento: 'Em Andamento', aguardando_peca: 'Aguardando Peça',
  concluida: 'Concluída', entregue: 'Entregue', cancelada: 'Cancelada'
};

export default function Relatorios() {
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('mes');
  const [stats, setStats] = useState({ osConcluidas: 0, faturamento: 0, despesas: 0, totalClientes: 0, totalItensEstoque: 0, osAbertas: 0 });
  const [osByStatus, setOsByStatus] = useState<{ name: string; value: number }[]>([]);
  const [osByEquip, setOsByEquip] = useState<{ name: string; value: number }[]>([]);
  const [finData, setFinData] = useState<{ name: string; receita: number; despesa: number }[]>([]);
  const [lowStock, setLowStock] = useState<{ descricao: string; quantidade: number; estoque_minimo: number }[]>([]);
  const [topClientes, setTopClientes] = useState<{ nome: string; total: number }[]>([]);

  useEffect(() => { fetchAll(); }, [periodo]);

  const getStartDate = () => {
    const d = new Date();
    if (periodo === 'semana') d.setDate(d.getDate() - 7);
    else if (periodo === 'mes') { d.setDate(1); d.setHours(0, 0, 0, 0); }
    else if (periodo === 'trimestre') { d.setMonth(d.getMonth() - 3); d.setHours(0, 0, 0, 0); }
    else { d.setMonth(0); d.setDate(1); d.setHours(0, 0, 0, 0); }
    return d.toISOString();
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const startDate = getStartDate();
      const [osRes, finRes, clientesRes, estoqueRes] = await Promise.all([
        supabase.from('ordens_servico').select('*').gte('created_at', startDate),
        supabase.from('financeiro').select('*').gte('data_transacao', startDate),
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase.from('itens_estoque').select('*'),
      ]);

      const os = osRes.data || [];
      const fin = finRes.data || [];
      const estoque = estoqueRes.data || [];

      // Stats
      const receitas = fin.filter(f => f.tipo === 'receita').reduce((a, f) => a + Number(f.valor), 0);
      const despesas = fin.filter(f => f.tipo !== 'receita').reduce((a, f) => a + Number(f.valor), 0);
      setStats({
        osConcluidas: os.filter(o => o.status === 'concluida' || o.status === 'entregue').length,
        faturamento: receitas, despesas,
        totalClientes: clientesRes.count || 0,
        totalItensEstoque: estoque.length,
        osAbertas: os.filter(o => o.status === 'aberta' || o.status === 'em_andamento').length,
      });

      // OS by status pie
      const statusCount: Record<string, number> = {};
      os.forEach(o => { statusCount[o.status] = (statusCount[o.status] || 0) + 1; });
      setOsByStatus(Object.entries(statusCount).map(([k, v]) => ({ name: STATUS_LABELS[k] || k, value: v })));

      // OS by equipment type
      const equipCount: Record<string, number> = {};
      os.forEach(o => { equipCount[o.tipo_equipamento] = (equipCount[o.tipo_equipamento] || 0) + 1; });
      setOsByEquip(Object.entries(equipCount).map(([k, v]) => ({ name: k.replace(/_/g, ' '), value: v })));

      // Financial by category bar chart
      const catMap: Record<string, { receita: number; despesa: number }> = {};
      fin.forEach(f => {
        const cat = f.categoria || 'Outros';
        if (!catMap[cat]) catMap[cat] = { receita: 0, despesa: 0 };
        if (f.tipo === 'receita') catMap[cat].receita += Number(f.valor);
        else catMap[cat].despesa += Number(f.valor);
      });
      setFinData(Object.entries(catMap).map(([k, v]) => ({ name: k, ...v })));

      // Low stock items
      setLowStock(estoque.filter(i => i.quantidade <= i.estoque_minimo).map(i => ({
        descricao: i.descricao, quantidade: i.quantidade, estoque_minimo: i.estoque_minimo
      })));

      // Top clientes by OS count
      const clienteOsCount: Record<string, number> = {};
      os.forEach(o => { clienteOsCount[o.cliente_id] = (clienteOsCount[o.cliente_id] || 0) + 1; });
      const { data: clienteNames } = await supabase.from('clientes').select('id, nome');
      const cMap = new Map((clienteNames || []).map(c => [c.id, c.nome]));
      setTopClientes(
        Object.entries(clienteOsCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id, total]) => ({ nome: cMap.get(id) || 'Desconhecido', total }))
      );
    } catch (e) { console.error(e); toast.error('Erro ao carregar relatórios'); } finally { setLoading(false); }
  };

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const handleExport = () => {
    const printContent = document.getElementById('report-content');
    if (!printContent) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Relatórios - Volt Control</title><style>
      body{font-family:system-ui,sans-serif;padding:40px;color:#333}
      h1{font-size:24px;margin-bottom:20px}h2{font-size:18px;margin:24px 0 12px}
      .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
      .stat{padding:16px;border:1px solid #e5e7eb;border-radius:8px;text-align:center}
      .stat-value{font-size:24px;font-weight:700}.stat-label{font-size:12px;color:#6b7280}
      table{width:100%;border-collapse:collapse;margin:12px 0}th,td{padding:8px 12px;border:1px solid #e5e7eb;text-align:left;font-size:13px}
      th{background:#f9fafb;font-weight:600}
    </style></head><body>
      <h1>Relatórios - Volt Control</h1><p>Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
      <div class="stats">
        <div class="stat"><div class="stat-value">${stats.osConcluidas}</div><div class="stat-label">OS Concluídas</div></div>
        <div class="stat"><div class="stat-value">${fmt(stats.faturamento)}</div><div class="stat-label">Faturamento</div></div>
        <div class="stat"><div class="stat-value">${fmt(stats.despesas)}</div><div class="stat-label">Despesas</div></div>
        <div class="stat"><div class="stat-value">${stats.totalClientes}</div><div class="stat-label">Clientes</div></div>
      </div>
      <h2>OS por Status</h2><table><tr><th>Status</th><th>Quantidade</th></tr>
        ${osByStatus.map(s => `<tr><td>${s.name}</td><td>${s.value}</td></tr>`).join('')}
      </table>
      <h2>Itens com Estoque Baixo</h2><table><tr><th>Item</th><th>Qtd Atual</th><th>Mínimo</th></tr>
        ${lowStock.map(i => `<tr><td>${i.descricao}</td><td>${i.quantidade}</td><td>${i.estoque_minimo}</td></tr>`).join('')}
      </table>
      <h2>Top 5 Clientes por OS</h2><table><tr><th>Cliente</th><th>Total OS</th></tr>
        ${topClientes.map(c => `<tr><td>${c.nome}</td><td>${c.total}</td></tr>`).join('')}
      </table>
    </body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <MainLayout>
      <div className="space-y-6" id="report-content">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-primary" />Relatórios
            </h1>
            <p className="text-muted-foreground">Análises e relatórios gerenciais com dados reais</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-40"><Calendar className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semana">Última Semana</SelectItem>
                <SelectItem value="mes">Este Mês</SelectItem>
                <SelectItem value="trimestre">Trimestre</SelectItem>
                <SelectItem value="ano">Este Ano</SelectItem>
              </SelectContent>
            </Select>
            <Button className="gradient-primary shadow-medium" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />Exportar
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Card className="shadow-soft"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{stats.osAbertas}</p><p className="text-xs text-muted-foreground">OS Abertas</p></CardContent></Card>
              <Card className="shadow-soft"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-success">{stats.osConcluidas}</p><p className="text-xs text-muted-foreground">OS Concluídas</p></CardContent></Card>
              <Card className="shadow-soft"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-success">{fmt(stats.faturamento)}</p><p className="text-xs text-muted-foreground">Faturamento</p></CardContent></Card>
              <Card className="shadow-soft"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-destructive">{fmt(stats.despesas)}</p><p className="text-xs text-muted-foreground">Despesas</p></CardContent></Card>
              <Card className="shadow-soft"><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{stats.totalClientes}</p><p className="text-xs text-muted-foreground">Clientes</p></CardContent></Card>
              <Card className="shadow-soft"><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{stats.totalItensEstoque}</p><p className="text-xs text-muted-foreground">Itens Estoque</p></CardContent></Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* OS by Status Pie */}
              <Card className="shadow-soft">
                <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5 text-primary" />OS por Status</CardTitle></CardHeader>
                <CardContent>
                  {osByStatus.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhuma OS no período</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={osByStatus} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          {osByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* OS by Equipment Bar */}
              <Card className="shadow-soft">
                <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Zap className="h-5 w-5 text-primary" />OS por Equipamento</CardTitle></CardHeader>
                <CardContent>
                  {osByEquip.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhuma OS no período</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={osByEquip}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Financial Chart */}
            {finData.length > 0 && (
              <Card className="shadow-soft">
                <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><DollarSign className="h-5 w-5 text-success" />Financeiro por Categoria</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={finData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Legend />
                      <Bar dataKey="receita" name="Receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Tables Row */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Low Stock */}
              <Card className="shadow-soft">
                <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="h-5 w-5 text-destructive" />Estoque Baixo</CardTitle></CardHeader>
                <CardContent>
                  {lowStock.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">Todos os itens com estoque adequado</p>
                  ) : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-center">Atual</TableHead><TableHead className="text-center">Mínimo</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {lowStock.map((i, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{i.descricao}</TableCell>
                            <TableCell className="text-center"><Badge variant="destructive">{i.quantidade}</Badge></TableCell>
                            <TableCell className="text-center">{i.estoque_minimo}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Top Clients */}
              <Card className="shadow-soft">
                <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-primary" />Top 5 Clientes por OS</CardTitle></CardHeader>
                <CardContent>
                  {topClientes.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">Nenhuma OS no período</p>
                  ) : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead className="text-center">Total OS</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {topClientes.map((c, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{c.nome}</TableCell>
                            <TableCell className="text-center"><Badge>{c.total}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
