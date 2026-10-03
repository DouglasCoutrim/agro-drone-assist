"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Loader2,
  Clock,
  ArrowUpRight,
  AlertTriangle,
  Filter,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  CreditCard,
  Shield,
  DollarSign,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { KpiCard } from "@/components/premium/KpiCard";
import { PremiumCard } from "@/components/premium/PremiumCard";
import { cn } from "@/lib/utils";

type TechnicianSummary = {
  technician_id: string;
  technician_nome: string;
  saldo_bloqueado: number;
  saldo_liberado: number;
  total_retido: number;
  count_bloqueado: number;
  count_liberado: number;
};

type RetentionDetail = {
  id: string;
  os_numero: string;
  os_id: string;
  amount: number;
  status: "RETAINED" | "RELEASED_TO_TECH";
  retained_at: string;
  release_date: string;
  released_at: string | null;
  is_overdue: boolean;
};

export default function AdminTaxRetentions() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<TechnicianSummary[]>([]);
  const [details, setDetails] = useState<Map<string, RetentionDetail[]>>(new Map());
  const [expandedTechId, setExpandedTechId] = useState<string | null>(null);
  const [releasingTechId, setReleasingTechId] = useState<string | null>(null);

  const fetchSummary = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase.rpc("get_technician_retention_summary");
      if (error) throw error;
      setSummary(Array.isArray(data) ? data as unknown as TechnicianSummary[] : []);
    } catch (err: any) {
      console.error("Erro ao buscar resumo:", err);
      toast.error("Erro ao carregar resumo de retenções");
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async (technicianId: string) => {
    try {
      const { data, error } = await supabase.rpc("get_technician_retention_details", {
        _technician_id: technicianId,
      });
      if (error) throw error;
      setDetails(prev => new Map(prev).set(technicianId, Array.isArray(data) ? data as unknown as RetentionDetail[] : []));
    } catch (err: any) {
      console.error("Erro ao buscar detalhes:", err);
      toast.error("Erro ao carregar detalhes");
    }
  };

  const handleExpand = (technicianId: string) => {
    if (expandedTechId === technicianId) {
      setExpandedTechId(null);
    } else {
      setExpandedTechId(technicianId);
      if (!details.has(technicianId)) {
        fetchDetails(technicianId);
      }
    }
  };

  const handleRelease = async (tech: TechnicianSummary) => {
    if (tech.saldo_liberado === 0 && tech.count_liberado === 0) {
      toast.info("Nenhuma retenção vencida para liberar");
      return;
    }
    
    if (!confirm(`Realizar repasse para ${tech.technician_nome}?\n${tech.count_liberado} retenção(ões) vencidas, total: ${formatCurrency(tech.saldo_liberado)}`)) {
      return;
    }
    
    setReleasingTechId(tech.technician_id);
    try {
      const { data, error } = await supabase.rpc("batch_release_technician_retentions", {
        _technician_id: tech.technician_id,
      });
      if (error) throw error;
      toast.success(data && typeof data === "object" && !Array.isArray(data) && typeof data.message === "string" ? data.message : "Repasse realizado com sucesso");
      fetchSummary();
      if (details.has(tech.technician_id)) {
        fetchDetails(tech.technician_id);
      }
    } catch (err: any) {
      toast.error("Erro ao realizar repasse: " + err.message);
    } finally {
      setReleasingTechId(null);
    }
  };

  const getStatusBadge = (status: RetentionDetail["status"], isOverdue: boolean) => {
    switch (status) {
      case "RETAINED":
        return isOverdue ? (
          <Badge variant="default" className="bg-red-100 text-red-800 border-red-200 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Vencida
          </Badge>
        ) : (
          <Badge variant="default" className="bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Bloqueada
          </Badge>
        );
      case "RELEASED_TO_TECH":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3" /> Liberada
          </Badge>
        );
    }
  };

  // Totais gerais
  const totals = useMemo(() => summary.reduce(
    (acc, t) => ({
      saldo_bloqueado: acc.saldo_bloqueado + t.saldo_bloqueado,
      saldo_liberado: acc.saldo_liberado + t.saldo_liberado,
      total_retido: acc.total_retido + t.total_retido,
      count_bloqueado: acc.count_bloqueado + t.count_bloqueado,
      count_liberado: acc.count_liberado + t.count_liberado,
    }),
    { saldo_bloqueado: 0, saldo_liberado: 0, total_retido: 0, count_bloqueado: 0, count_liberado: 0 }
  ), [summary]);

  useEffect(() => {
    fetchSummary();
  }, [user?.id]);

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
              <Shield className="h-8 w-8 text-amber-500" />
              Caixa de Retenção de Impostos
            </h1>
            <p className="text-muted-foreground">
              Gerencie o fundo de retenção (ISS/impostos retidos de OSs sem NFe).<br />
              <strong>Bloqueado</strong>: {"<"} 6 meses | <strong>Liberado</strong>: ≥ 6 meses (pronto para repasse ao técnico)
            </p>
          </div>
          <Button variant="outline" onClick={fetchSummary} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        </div>

        {/* KPIs Gerais */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Bloqueado (< 6 meses)"
            value={totals.saldo_bloqueado}
            icon={Clock}
            color="orange"
            trend={{ value: totals.count_bloqueado, label: `${totals.count_bloqueado} item(ns) aguardando prazo` }}
            delay={0}
          />
          <KpiCard
            label="Total Liberado para Repasse (≥ 6 meses)"
            value={totals.saldo_liberado}
            icon={ArrowUpRight}
            color="green"
            trend={{ value: totals.count_liberado, label: `${totals.count_liberado} item(ns) prontos` }}
            delay={100}
          />
          <KpiCard
            label="Total no Fundo de Retenção"
            value={totals.total_retido}
            icon={DollarSign}
            color="blue"
            trend={{ value: summary.length, label: `${summary.length} técnico(s) com retenções` }}
            delay={200}
          />
        </div>

        {/* Tabela Agrupada por Técnico */}
        <PremiumCard delay={0}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Posição por Técnico
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma retenção encontrada</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Retenções são geradas quando OSs sem NFe são concluídas</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <th className="px-4 py-3 w-10"></th>
                      <th className="px-4 py-3">Técnico</th>
                      <th className="px-4 py-3 text-right w-[180px]">Bloqueado ({"<"} 6m)</th>
                      <th className="px-4 py-3 text-right w-[180px]">Liberado p/ Repasse (≥ 6m)</th>
                      <th className="px-4 py-3 text-right w-[140px]">Total</th>
                      <th className="px-4 py-3 text-right w-[140px]">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {summary.map((tech) => (
                      <Fragment key={tech.technician_id}>
                        {/* Linha principal do técnico */}
                        <tr className={cn(
                          "hover:bg-muted/30 transition-colors cursor-pointer",
                          expandedTechId === tech.technician_id && "bg-muted/50"
                        )} onClick={() => handleExpand(tech.technician_id)}>
                          <td className="px-4 py-3 text-center">
                            {expandedTechId === tech.technician_id ? (
                              <ChevronDown className="h-5 w-5 text-foreground mx-auto" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground mx-auto" />
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">{tech.technician_nome}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="font-semibold text-amber-600">{formatCurrency(tech.saldo_bloqueado)}</span>
                              <span className="text-[10px] text-amber-500">{tech.count_bloqueado} item(ns)</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="font-semibold text-green-600">{formatCurrency(tech.saldo_liberado)}</span>
                              <span className="text-[10px] text-green-500">{tech.count_liberado} item(ns)</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground">
                            {formatCurrency(tech.total_retido)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {tech.saldo_liberado > 0 && tech.count_liberado > 0 ? (
                              <Button
                                size="sm"
                                className="gradient-primary"
                                onClick={(e) => { e.stopPropagation(); handleRelease(tech); }}
                                disabled={releasingTechId === tech.technician_id}
                              >
                                {releasingTechId === tech.technician_id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />
                                    Repasse
                                  </>
                                )}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>

                        {/* Linha expansível com detalhes */}
                        {expandedTechId === tech.technician_id && (
                          <tr>
                            <td colSpan={6} className="px-0 py-0">
                              <div className="bg-muted/30 border-t border-border/50 p-4">
                                <div className="mb-3 flex items-center gap-2 text-sm">
                                  <span className="font-medium">{tech.technician_nome}</span>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {details.get(tech.technician_id)?.length || 0} lançamento(s)
                                  </Badge>
                                </div>
                                
                                {details.get(tech.technician_id)?.length === 0 ? (
                                  <p className="text-center text-muted-foreground text-sm py-4">Carregando detalhes...</p>
                                ) : details.get(tech.technician_id)!.length === 0 ? (
                                  <p className="text-center text-muted-foreground text-sm py-4">Nenhum lançamento encontrado</p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-border/50 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                          <th className="px-3 py-2 w-[100px]">OS</th>
                                          <th className="px-3 py-2">Data Retenção</th>
                                          <th className="px-3 py-2">Liberação Prevista</th>
                                          <th className="px-3 py-2 text-right w-[100px]">Valor</th>
                                          <th className="px-3 py-2 w-[100px]">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border/30">
                                        {details.get(tech.technician_id)!.map((item) => (
                                          <tr key={item.id} className="hover:bg-background/50">
                                            <td className="px-3 py-2 font-mono text-foreground">#{item.os_numero}</td>
                                            <td className="px-3 py-2 text-muted-foreground">{formatDate(item.retained_at)}</td>
                                            <td className="px-3 py-2">
                                              <span className={cn(item.is_overdue && "text-red-600 font-medium")}>
                                                {formatDate(item.release_date)}
                                                {item.is_overdue && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium text-foreground">{formatCurrency(item.amount)}</td>
                                            <td className="px-3 py-2">{getStatusBadge(item.status, item.is_overdue)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </PremiumCard>

        {/* Legenda */}
        <PremiumCard delay={100} className="bg-muted/30 border-amber-200/50">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-200" />
                <span className="text-amber-800">Bloqueado ({"<"} 6 meses)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-red-100" />
                <span className="text-red-800">Vencida (pronta para repasse)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-green-100" />
                <span className="text-green-800">Liberada ao técnico</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-100" />
                <span className="text-blue-800">Paga ao governo (NFe emitida)</span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Clique na linha para expandir detalhes</span>
              </div>
            </div>
          </CardContent>
        </PremiumCard>
      </div>
    </MainLayout>
  );
}