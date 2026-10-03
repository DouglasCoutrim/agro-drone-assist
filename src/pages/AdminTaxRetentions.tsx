import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Loader2,
  Clock,
  ArrowUpRight,
  FileText,
  AlertTriangle,
  Filter,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { KpiCard } from "@/components/premium/KpiCard";
import { PremiumCard } from "@/components/premium/PremiumCard";
import { PremiumTable } from "@/components/premium/PremiumTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Retention = {
  id: string;
  os_id: string;
  os_numero: string;
  technician_id: string;
  technician_nome: string;
  amount: number;
  status: "RETAINED" | "RELEASED_TO_TECH" | "PAID_TO_GOV";
  retained_at: string;
  release_date: string;
  released_at: string | null;
  released_by: string | null;
  notes: string | null;
};

type FilterState = {
  status: "ALL" | "RETAINED" | "RELEASED_TO_TECH" | "PAID_TO_GOV";
  technician: string;
  search: string;
  dateFrom: string;
  dateTo: string;
};

export default function AdminTaxRetentions() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [retentions, setRetentions] = useState<Retention[]>([]);
  const [tecnicos, setTecnicos] = useState<{ id: string; nome: string }[]>([]);
  const [filter, setFilter] = useState<FilterState>({
    status: "ALL",
    technician: "",
    search: "",
    dateFrom: "",
    dateTo: "",
  });
  const [releasingIds, setReleasingIds] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    if (!user?.id) return;
    try {
      // Busca técnicos da org para filtro
      const { data: techs, error: techError } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("organization_id", (await supabase.from("profiles").select("organization_id").eq("id", user.id).single()).data?.organization_id)
        .eq("role", "tecnico");
      if (techError) throw techError;
      setTecnicos(techs || []);

      // Busca retenções
      const orgId = (await supabase.from("profiles").select("organization_id").eq("id", user.id).single()).data?.organization_id;
      let query = supabase
        .from("tax_retention_ledger")
        .select(`
          id,
          os_id,
          amount,
          status,
          retained_at,
          release_date,
          released_at,
          released_by,
          notes,
          technician_id,
          ordens_servico!inner(numero),
          profiles!inner(nome)
        `)
        .eq("organization_id", orgId)
        .order("retained_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setRetentions((data || []).map(r => ({
        ...r,
        os_numero: (r.ordens_servico as any)?.numero || "",
        technician_nome: (r.profiles as any)?.nome || "",
      })));
    } catch (err: any) {
      console.error("Erro ao buscar retenções:", err);
      toast.error("Erro ao carregar retenções");
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async (retention: Retention) => {
    if (!confirm(`Liberar retenção de R$ ${formatCurrency(retention.amount)} para o técnico ${retention.technician_nome}?`)) return;
    setReleasingIds(prev => new Set(prev).add(retention.id));
    try {
      const { error } = await supabase.rpc("release_expired_tax_retentions" as any);
      if (error) throw error;
      toast.success("Retenções vencidas liberadas automaticamente");
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao liberar: " + err.message);
    } finally {
      setReleasingIds(prev => {
        const next = new Set(prev);
        next.delete(retention.id);
        return next;
      });
    }
  };

  const handleReleaseSelected = async (ids: string[]) => {
    if (!confirm(`Liberar ${ids.length} retenção(ões) selecionada(s)?`)) return;
    setReleasingIds(prev => new Set([...prev, ...ids]));
    try {
      const { error } = await supabase
        .from("tax_retention_ledger")
        .update({ status: "RELEASED_TO_TECH", released_at: new Date().toISOString(), released_by: user.id })
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} retenção(ões) liberada(s)`);
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao liberar: " + err.message);
    } finally {
      setReleasingIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }
  };

  const filteredRetentions = retentions.filter(r => {
    if (filter.status !== "ALL" && r.status !== filter.status) return false;
    if (filter.technician && r.technician_id !== filter.technician) return false;
    if (filter.search && !r.os_numero.toLowerCase().includes(filter.search.toLowerCase()) &&
      !r.technician_nome.toLowerCase().includes(filter.search.toLowerCase())) return false;
    if (filter.dateFrom && r.retained_at.split("T")[0] < filter.dateFrom) return false;
    if (filter.dateTo && r.retained_at.split("T")[0] > filter.dateTo) return false;
    return true;
  });

  const retainedCount = retentions.filter(r => r.status === "RETAINED").length;
  const retainedAmount = retentions.filter(r => r.status === "RETAINED").reduce((s, r) => s + r.amount, 0);
  const releasedCount = retentions.filter(r => r.status === "RELEASED_TO_TECH").length;
  const releasedAmount = retentions.filter(r => r.status === "RELEASED_TO_TECH").reduce((s, r) => s + r.amount, 0);
  const overdueCount = retentions.filter(r => r.status === "RETAINED" && new Date(r.release_date) <= new Date()).length;
  const overdueAmount = retentions.filter(r => r.status === "RETAINED" && new Date(r.release_date) <= new Date()).reduce((s, r) => s + r.amount, 0);

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const getStatusBadge = (status: Retention["status"]) => {
    switch (status) {
      case "RETAINED":
        return <Badge variant="default" className="bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1"><Clock className="h-3 w-3" /> Retido</Badge>;
      case "RELEASED_TO_TECH":
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1"><ArrowUpRight className="h-3 w-3" /> Liberado</Badge>;
      case "PAID_TO_GOV":
        return <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1"><FileText className="h-3 w-3" /> Pago ao Gov</Badge>;
    }
  };

  const isOverdue = (r: Retention) => r.status === "RETAINED" && new Date(r.release_date) <= new Date();

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="text-center py-20">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold">Acesso restrito</h2>
          <p className="text-muted-foreground mt-2">Apenas administradores podem gerenciar retenções de impostos.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              Gestão de Retenções de Impostos
            </h1>
            <p className="text-muted-foreground">
              Acompanhe e libere retenções de ISS/impostos do fundo de retenção
            </p>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Retidas (Pendentes)"
            value={retainedAmount}
            icon={Clock}
            color="yellow"
            trend={{ value: retainedCount, label: `${retainedCount} item(ns)` }}
            delay={0}
          />
          <KpiCard
            label="Liberadas p/ Técnico"
            value={releasedAmount}
            icon={ArrowUpRight}
            color="green"
            trend={{ value: releasedCount, label: `${releasedCount} item(ns)` }}
            delay={100}
          />
          <KpiCard
            label="Vencidas (+6 meses)"
            value={overdueAmount}
            icon={AlertTriangle}
            color="red"
            trend={{ value: overdueCount, label: `${overdueCount} item(ns) prontos para liberar` }}
            delay={200}
          />
          <KpiCard
            label="Total no Fundo"
            value={retainedAmount + releasedAmount}
            icon={FileText}
            color="blue"
            trend={{ value: retentions.length, label: `${retentions.length} registros` }}
            delay={300}
          />
        </div>

        {/* Filtros */}
        <PremiumCard delay={0} className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1.5 flex-1 min-w-[200px]">
                <Label className="text-xs">Status</Label>
                <Select value={filter.status} onValueChange={v => setFilter(f => ({ ...f, status: v as FilterState["status"] }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    <SelectItem value="RETAINED">Retidas</SelectItem>
                    <SelectItem value="RELEASED_TO_TECH">Liberadas</SelectItem>
                    <SelectItem value="PAID_TO_GOV">Pagas ao Gov</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1 min-w-[200px]">
                <Label className="text-xs">Técnico</Label>
                <Select value={filter.technician || "all"} onValueChange={v => setFilter(f => ({ ...f, technician: v === "all" ? "" : v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os técnicos</SelectItem>
                    {tecnicos.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1 min-w-[200px]">
                <Label className="text-xs">Buscar (OS / Técnico)</Label>
                <Input
                  value={filter.search}
                  onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
                  placeholder="Número da OS ou nome do técnico"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">De</Label>
                <Input type="date" value={filter.dateFrom} onChange={e => setFilter(f => ({ ...f, dateFrom: e.target.value }))} className="h-9 w-full sm:w-[150px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Até</Label>
                <Input type="date" value={filter.dateTo} onChange={e => setFilter(f => ({ ...f, dateTo: e.target.value }))} className="h-9 w-full sm:w-[150px]" />
              </div>
            </div>
          </CardContent>
        </PremiumCard>

        {/* Tabela de Retenções */}
        <PremiumCard delay={100}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Lançamentos de Retenção ({filteredRetentions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PremiumTable
              data={filteredRetentions}
              columns={[
                { key: "os_numero", label: "OS" },
                { key: "technician_nome", label: "Técnico" },
                { key: "retained_at", label: "Retido em" },
                { key: "release_date", label: "Liberação prevista" },
                { key: "amount", label: "Valor", align: "right" },
                { key: "status", label: "Status" },
                { key: "actions", label: "Ações", align: "right" },
              ]}
              renderCell={(r: Retention, key) => {
                switch (key) {
                  case "os_numero": return <span className="font-mono text-sm">{r.os_numero}</span>;
                  case "technician_nome": return r.technician_nome;
                  case "retained_at": return formatDate(r.retained_at);
                  case "release_date": return (
                  <span className={cn(isOverdue(r) && "text-red-600 font-medium")}>
                    {formatDate(r.release_date)}
                    {isOverdue(r) && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                  </span>
                  );
                  case "amount": return formatCurrency(r.amount);
                  case "status": return getStatusBadge(r.status);
                  case "actions": {
                  if (r.status !== "RETAINED") return <span className="text-xs text-muted-foreground">—</span>;
                  return (
                    <Button
                      size="sm"
                      variant={isOverdue(r) ? "default" : "outline"}
                      className="gradient-primary"
                      onClick={() => handleRelease(r)}
                      disabled={releasingIds.has(r.id)}
                    >
                      {releasingIds.has(r.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                      {isOverdue(r) ? "Liberar (vencida)" : "Liberar"}
                    </Button>
                  );
                  }
                  default: return null;
                }
              }}
              emptyMessage="Nenhuma retenção encontrada"
            />
          </CardContent>
        </PremiumCard>
      </div>
    </MainLayout>
  );
}