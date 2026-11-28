import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { PainelOrdenavel } from "@/components/layout/PainelOrdenavel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Edit, FileText, Loader2, Eye, MessageCircle, Download, UserPlus, CreditCard, Clock, Wrench, CheckCircle2, XCircle, ChevronRight, Settings2, Trash2, Printer, Check, SlidersHorizontal, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables, Enums } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { useUsageLimits } from "@/hooks/useUsageLimits";
import { UpgradePlanModal } from "@/components/UpgradePlanModal";
import { QuickClientModal } from "@/components/os/QuickClientModal";
import { LegalTermsFooter, getLegalTermsHTML } from "@/components/os/LegalTermsFooter";
import { SmartSelect, SmartSelectOption } from "@/components/ui/smart-select";
import { StatusPipeline, getNextStatus, getStatusLabel } from "@/components/os/StatusPipeline";
import {
  LOCK_CLOSED_STATUSES,
  MENSAGEM_OS_SEM_EDICAO,
  aplicarStatusOs,
  listarChecklistObrigatorioPendente,
} from "@/lib/os-status-update";
import { OSItemsSection, OSItem } from "@/components/os/OSItemsSection";
import { dateOnlyToIso, formatCurrency, formatDate, getErrorMessage, todayDateInput } from "@/lib/formatters";
import { whatsappTemplates, openWhatsApp, WhatsAppOS } from "@/lib/whatsapp-templates";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { generateOSPDF } from "@/components/ordens-servico/OSPDFGenerator";
import { carregarAnexosParaPdf } from "@/lib/os-anexos";
import { imprimirEtiquetaOS } from "@/components/ordens-servico/EtiquetaOS58";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgSegments } from "@/hooks/useOrgSegments";
import { useConfirm } from "@/hooks/useConfirm";
import { getAvailableTypes, findTypeByValue, SEGMENTOS } from "@/lib/equipment-segments";
import type { CustomType } from "@/lib/equipment-segments";
import { useChecklistConfig } from "@/hooks/useChecklistConfig";
import type { ChecklistItem, ChecklistTipo } from "@/hooks/useChecklistConfig";
import { AgruparOSDialog } from "@/components/os/AgruparOSDialog";
import { CommissionBreakdown, rateioDaOS } from "@/components/os/CommissionBreakdown";
import { CommissionOverrideDialog } from "@/components/os/CommissionOverrideDialog";
import { OSAnexosDialog } from "@/components/os/OSAnexosDialog";
import { calcularRateio } from "@/lib/commission";
import { calcularPrazoOS, rotuloPrazo } from "@/lib/os-prazo";
import { useNfseAliquota } from "@/hooks/useNfseAliquota";
import { PaymentConfirmDialog, PaymentData } from "@/components/os/PaymentConfirmDialog";
import { registrarRecebimentoOS, type RecebimentoResult } from "@/lib/os-billing";
import { classificarRecebimentoOS, valorCobradoOS } from "@/lib/os-valor";
import { PremiumCard, KpiCard, PremiumTable, AlertBox } from "@/components/premium";


type OrdemServico = Tables<"ordens_servico"> & { clientes: { nome: string; telefone?: string } | null };
type Cliente = Tables<"clientes">;
type ItemOSRow = Tables<"itens_os">;

const mapDbItemsToOSItems = (data: ItemOSRow[] | null | undefined): OSItem[] =>
  (data || []).map((d: ItemOSRow) => ({
    id: d.id,
    tipo: d.tipo === "servico" ? "servico" : "produto",
    produto_id: d.produto_id,
    item_estoque_id: (d as any).item_estoque_id ?? null,
    servico_id: d.servico_id,
    descricao: d.descricao,
    quantidade: Number(d.quantidade) || 0,
    valor_unitario: Number(d.valor_unitario) || 0,
    valor_total: Number(d.valor_total) || 0,
    desconto_percentual: Number((d as any).desconto_percentual) || 0,
    desconto_valor: Number((d as any).desconto_valor) || 0,
    desconto_maximo_percentual: Number((d as any).desconto_maximo_percentual) || 0,
    custo_servico: Number((d as any).custo_servico) || 0,
  }));

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  recebido: { label: "Recebido", variant: "outline" },
  aguardando_diagnostico: { label: "Aguard. Diagnóstico", variant: "secondary" },
  aguardando_aprovacao: { label: "Aguard. Aprovação", variant: "secondary" },
  aprovado: { label: "Aprovado", variant: "default" },
  em_reparo: { label: "Em Reparo", variant: "default" },
  em_testes: { label: "Em Testes", variant: "default" },
  pronto_retirada: { label: "Pronto p/ Retirada", variant: "default" },
  finalizada: { label: "Finalizada", variant: "default" },
  entregue: { label: "Entregue", variant: "default" },
  cancelada: { label: "Cancelado", variant: "destructive" },
  aberta: { label: "Recebido", variant: "outline" },
  em_andamento: { label: "Em Reparo", variant: "default" },
  aguardando_peca: { label: "Aguard. Aprovação", variant: "secondary" },
  concluida: { label: "Pronto p/ Retirada", variant: "default" },
};

const TIPO_EQUIPAMENTO: Record<string, string> = {
  drone_agricola: "Drone Agrícola",
  drone_convencional: "Drone de Consumo / Enterprise",
  controle: "Controle Remoto",
  bateria: "Bateria Avulsa",
  outro: "Gerador / Carregador / Outro",
  patinete_eletrico: "Patinete Elétrico",
  bicicleta_eletrica: "Bicicleta Elétrica",
  moto_eletrica: "Moto Elétrica",
  outros_autopropelidos: "Outros Autopropelidos",
};

const MOBILITY_CATEGORIES = ["patinete_eletrico", "bicicleta_eletrica", "moto_eletrica", "outros_autopropelidos"];

// Helper: verifica se o usuário pode editar esta OS
// Admin pode tudo; Técnico só se for o responsável (tecnico_id === user.id)
const canUserManageOS = (os: OrdemServico, userId: string | undefined, isAdminUser: boolean): boolean => {
  if (isAdminUser) return true;
  if (!userId) return false;
  return os.tecnico_id === userId;
};
const mapCategoryToDbEnum = (uiCategory: string): string => MOBILITY_CATEGORIES.includes(uiCategory) ? "outro" : uiCategory;
const detectUiCategory = (os: any): string => {
  const obs = os.observacoes || "";
  const mobMatch = obs.match(/\[MOBILIDADE:(\w+)/);
  if (mobMatch) return mobMatch[1];
  const customMatch = obs.match(/\[CUSTOM:([^\]]+)\]/);
  if (customMatch) return customMatch[1];
  return os.tipo_equipamento;
};

const getTypeDisplayLabel = (os: any, segs: string[], customs: CustomType[], configTipos?: ChecklistTipo[]): string => {
  const cat = detectUiCategory(os);
  const fromTipo = TIPO_EQUIPAMENTO[cat];
  if (fromTipo) return fromTipo;
  const configTipo = configTipos?.find(t => t.value === cat && t.ativo);
  if (configTipo?.label) return configTipo.label;
  const found = findTypeByValue(cat, segs, customs);
  if (found?.label) return found.label;
  return TIPO_EQUIPAMENTO[os.tipo_equipamento] || os.tipo_equipamento;
};

/** Mostra apenas o número da OS, sem o prefixo "OS-" (ex.: "OS-00036" → "00036"). */
const formatOSNumber = (numero?: string | null) => (numero || "").replace(/^OS-?\s*/i, "");

export default function OrdensServico() {
  const { user, canEdit, isAdmin, isTecnico } = useAuth();
  const { permissions } = usePermissions();
  // "Pode finalizar OS" (Equipe → Papéis e permissões): fecha OS de qualquer técnico. Não
  // dá direito de editar a OS — quem tem só essa permissão grava pelo RPC `finalizar_os`.
  const podeFinalizarOs = permissions?.pode_finalizar_os === true;
  const { organization, isPlatformAdmin, loading: orgLoading } = useOrganization();
  const { config: empresa } = useEmpresaConfig();
  const aliquotaNfse = useNfseAliquota();
  const [agruparOpen, setAgruparOpen] = useState(false);
  const { tecnicos } = useTeamMembers();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const osDeepLinkRef = useRef<string | null>(null);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todas");
  const [tecFilter, setTecFilter] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { canCreateOS, osUsed, osLimit, plan } = useUsageLimits();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
    const [viewingOS, setViewingOS] = useState<OrdemServico | null>(null);
    const [anexosDialogOpen, setAnexosDialogOpen] = useState(false);
  const [prazoHoras, setPrazoHoras] = useState(48);
  const [salvandoPrazo, setSalvandoPrazo] = useState(false);
  const [commissionDialogOpen, setCommissionDialogOpen] = useState(false);
  const [editingOS, setEditingOS] = useState<OrdemServico | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [cobrarLoading, setCobrarLoading] = useState(false);
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);
  const [lastCreatedOS, setLastCreatedOS] = useState<{ numero: string; cliente_id: string; tipo_equipamento: string; modelo_equipamento: string } | null>(null);
  const [quickClientPreName, setQuickClientPreName] = useState("");
  const [osItems, setOsItems] = useState<OSItem[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [viewOsItems, setViewOsItems] = useState<OSItem[]>([]);
  const [viewOsItemsLoading, setViewOsItemsLoading] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean;
    osId: string | null;
    osNumero: string;
    valorTotal: number;
    valorJaPago: number;
    osEquipamento: string;
    nextStatus: string | null;
    saving: boolean;
    parcial: boolean;
  }>({ open: false, osId: null, osNumero: "", valorTotal: 0, valorJaPago: 0, osEquipamento: "", nextStatus: null, saving: false, parcial: false });
  const [pagoOSIds, setPagoOSIds] = useState<Set<string>>(new Set());
  // OS com recebimento parcial (tem receita lançada e ainda tem saldo em aberto).
  const [parcialOSIds, setParcialOSIds] = useState<Set<string>>(new Set());
  const [osConta, setOsConta] = useState<{ saldo: number; valor: number; valor_recebido: number; vencimento: string | null; condicoes_pagamento: string | null; equipamento: string | null; status: string } | null>(null);
  const [osJaPago, setOsJaPago] = useState(0);

  // Wizard step
  const [wizardStep, setWizardStep] = useState(0);
  const WIZARD_STEPS = ["Cliente", "Equipamento", "Problema", "Revisão"];
        const [uiCategory, setUiCategory] = useState("bateria");
  const { segmentos: orgSegmentos, tipos_custom: orgCustomTypes, save: saveSegments } = useOrgSegments();
  const { tipos: configTipos } = useChecklistConfig();
  const [configCheckbox, setConfigCheckbox] = useState<Record<string, boolean>>({});
  const [viewConfigChecklist, setViewConfigChecklist] = useState<{ label: string; obrigatorio: boolean; marcado: boolean }[]>([]);
  const availableTypes = useMemo(() => {
    const base = getAvailableTypes(orgSegmentos, orgCustomTypes);
    const seen = new Set(base.map(t => t.value));
    const config = (configTipos || []).filter(t => t.ativo).map(t => ({ value: t.value, label: t.label, dbEnum: t.db_enum || "outro" }));
    return [...base, ...config.filter(t => !seen.has(t.value))];
  }, [orgSegmentos, orgCustomTypes, configTipos]);
  const selectedEquipmentType = availableTypes.some(t => t.value === uiCategory)
    ? null
    : editingOS && uiCategory
      ? { value: uiCategory, label: getTypeDisplayLabel(editingOS, orgSegmentos, orgCustomTypes, configTipos), dbEnum: editingOS.tipo_equipamento }
      : null;
  const [newCustomLabel, setNewCustomLabel] = useState("");

  const [formData, setFormData] = useState({
    cliente_id: "",
    tipo_equipamento: "bateria" as Enums<"tipo_equipamento">,
    marca: "",
    modelo_equipamento: "",
    numero_serie: "",
    descricao_problema: "",
    diagnostico: "",
    prioridade: "media",
    data_previsao: "",
    prazo_diagnostico_horas: 48,
    desconto: 0,
    valor_orcamento: 0,
    observacoes: "",
    tecnico_id: "" as string,
    checklist_bateria: false,
    checklist_carregador: false,
    checklist_controle: false,
    checklist_cabos: false,
    checklist_helices: false,
    checklist_outros: false,
    condicao_visual: "",
    ciclos_carga_entrada: 0,
    ciclos_carga_saida: 0,
    tipo_os: "normal" as Enums<"tipo_os">,
    checklist_equipamento_tipo_id: "",
    nfe_emitida: false,
  });

  const [mobilityData, setMobilityData] = useState({
    voltagem: "", capacidade_bateria: "", odometro: "",
    chave_ignicao: false, carregador_entregue: false,
    check_display: false, check_acelerador: false, check_freios: false,
    check_pneus: false, check_controladora: false, check_iluminacao: false, check_carenagem: false,
  });

  const isMobility = MOBILITY_CATEGORIES.includes(uiCategory);
  const isBateria = uiCategory === "bateria" || formData.modelo_equipamento?.toLowerCase().includes("bateria");
  const activeConfigTipo = (configTipos || []).find(t => t.value === uiCategory && t.ativo);
  const configItems: ChecklistItem[] = activeConfigTipo?.itens || [];
  const itemsTotal = osItems.reduce((s, i) => s + (i.valor_total || 0), 0);
  const totalOrcamento = Math.max(0, itemsTotal - (formData.desconto || 0));
  const legacyBudget = !!editingOS && osItems.length === 0 && Number(formData.valor_orcamento) > 0;
  const displayedTotal = legacyBudget ? Number(formData.valor_orcamento) : totalOrcamento;
  const viewItemsTotal = viewOsItems.reduce((s, i) => s + (i.valor_total || 0), 0);

  const isOSFormDirty = useMemo(() => {
    if (editingOS) return true;
    return Object.values(formData).some(value => {
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      return String(value || "").trim() !== "";
    }) || Object.values(mobilityData).some(value => {
      if (typeof value === "boolean") return value;
      return String(value || "").trim() !== "";
    }) || osItems.length > 0 || uiCategory !== "bateria" || Object.values(configCheckbox).some(Boolean);
  }, [editingOS, formData, mobilityData, osItems.length, uiCategory, configCheckbox]);

  useEffect(() => {
      if (orgLoading) return;
      if (!isPlatformAdmin && !organization?.id) {
        setLoading(false);
        return;
      }
      fetchData();
      fetchPaidOS();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organization?.id, isPlatformAdmin, orgLoading]);
  
    const fetchPaidOS = async () => {
      try {
        // Só receita conta como recebimento: `financeiro` também guarda despesas e
        // comissões que apontam para a OS (antes qualquer linha marcava a OS como paga).
        let recQuery = supabase.from("financeiro").select("ordem_servico_id, valor").eq("tipo", "receita").not("ordem_servico_id", "is", null);
        if (organization?.id && !isPlatformAdmin) recQuery = recQuery.eq("organization_id", organization.id);
        const recebidoPorOS = new Map<string, number>();
        const { data, error } = await recQuery;
        if (error) { console.error("Erro ao buscar OS pagas:", error); return; }
        (data || []).forEach((r: any) => {
          if (!r?.ordem_servico_id) return;
          recebidoPorOS.set(r.ordem_servico_id, (recebidoPorOS.get(r.ordem_servico_id) || 0) + Number(r.valor || 0));
        });

        // `contas_receber` é a fonte do saldo por OS (valor total e recebido oficiais).
        let contasQuery = supabase.from("contas_receber" as any).select("ordem_servico_id, valor, valor_recebido, saldo");
        if (organization?.id && !isPlatformAdmin) contasQuery = contasQuery.eq("organization_id", organization.id);
        const { data: contas, error: contasError } = await contasQuery;
        // Falha (RLS/rede/tabela) não pode virar "sem contas": sem a fonte do saldo não
        // classificamos nada, para não marcar como paga uma OS que talvez não esteja.
        if (contasError) { console.error("Erro ao buscar contas a receber:", contasError); return; }
        const contaPorOS = new Map<string, any>();
        (contas || []).forEach((c: any) => { if (c?.ordem_servico_id) contaPorOS.set(c.ordem_servico_id, c); });

        // Recebimentos antigos (sem linha em contas_receber): o total da OS precisa dos
        // itens. Buscamos direto do banco em vez de depender de `ordens` (que pode ainda
        // não estar carregada quando este efeito roda em paralelo com fetchData).
        const ids = [...new Set<string>([...recebidoPorOS.keys(), ...contaPorOS.keys()])];
        const semConta = ids.filter((osId) => !contaPorOS.has(osId));
        const totalPorOS = new Map<string, number>();
        if (semConta.length) {
          const [{ data: osRows, error: osErr }, { data: itensRows, error: itensErr }] = await Promise.all([
            supabase.from("ordens_servico").select("id, valor_final, valor_orcamento, desconto").in("id", semConta),
            supabase.from("itens_os").select("ordem_servico_id, valor_total").in("ordem_servico_id", semConta),
          ]);
          if (osErr || itensErr) { console.error("Erro ao buscar valores das OS:", osErr || itensErr); return; }
          const itensPorOS = new Map<string, number>();
          (itensRows || []).forEach((i: any) => {
            if (!i?.ordem_servico_id) return;
            itensPorOS.set(i.ordem_servico_id, (itensPorOS.get(i.ordem_servico_id) || 0) + Number(i.valor_total || 0));
          });
          (osRows || []).forEach((o: any) => totalPorOS.set(o.id, valorCobradoOS(o, itensPorOS.get(o.id) || 0)));
        }

        const { pago, parcial } = classificarRecebimentoOS(recebidoPorOS, contaPorOS, totalPorOS);
        setPagoOSIds(pago);
        setParcialOSIds(parcial);
      } catch (err) {
        console.error("Erro ao buscar OS pagas:", err);
      }
    };

  const fetchData = async () => {
    let didToast = false;
    try {
      let ordensQuery = supabase
        .from("ordens_servico")
        .select("*, clientes(nome, telefone)")
        .order("created_at", { ascending: false });
      let clientesQuery = supabase.from("clientes").select("*").order("nome");

      if (organization?.id && !isPlatformAdmin) {
        ordensQuery = ordensQuery.eq("organization_id", organization.id);
        clientesQuery = clientesQuery.eq("organization_id", organization.id);
      }

      const [ordensRes, clientesRes] = await Promise.all([ordensQuery, clientesQuery]);

      if (ordensRes.error) {
        console.error("Erro detalhado do Supabase (ordens_servico):", ordensRes.error);
        // Fallback: retry without the profiles join in case RLS blocks it
        let retry = supabase
          .from("ordens_servico")
          .select("*, clientes(nome, telefone)")
          .order("created_at", { ascending: false });
        if (organization?.id && !isPlatformAdmin) {
          retry = retry.eq("organization_id", organization.id);
        }
        const retryRes = await retry;
        if (retryRes.error) {
          console.error("Erro detalhado do Supabase (retry ordens_servico):", retryRes.error);
          if (!didToast) { toast.error(getErrorMessage(retryRes.error)); didToast = true; }
        } else {
          setOrdens(retryRes.data || []);
        }
      } else {
        setOrdens(ordensRes.data || []);
      }

      if (clientesRes.error) {
        console.error("Erro detalhado do Supabase (clientes):", clientesRes.error);
        if (!didToast) { toast.error(getErrorMessage(clientesRes.error)); didToast = true; }
      } else {
        setClientes(clientesRes.data || []);
      }
    } catch (err) {
      console.error("Erro detalhado do Supabase:", err);
      if (!didToast) toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchOSItems = useCallback(async (osId: string, osOrgId?: string | null): Promise<OSItem[]> => {
    let query = supabase
      .from("itens_os")
      .select("*")
      .eq("ordem_servico_id", osId)
      .order("created_at", { ascending: true });

    const orgId = osOrgId || organization?.id;
    if (orgId && !isPlatformAdmin) query = query.eq("organization_id", orgId);

    const { data, error } = await query;
    if (error) {
      console.error("Erro ao carregar itens da OS:", error);
      throw new Error("Não foi possível carregar os itens/serviços desta OS: " + error.message);
    }

    const mapped = mapDbItemsToOSItems(data as ItemOSRow[]);
    return mapped;
  }, [organization?.id, isPlatformAdmin]);

  const getPendingRequiredChecklist = useCallback(
    (osId: string, osOrgId?: string | null): Promise<string[]> =>
      listarChecklistObrigatorioPendente(osId, osOrgId || organization?.id, isPlatformAdmin),
    [organization?.id, isPlatformAdmin],
  );

  const loadChecklistResponses = useCallback(async (osId: string, osOrgId?: string | null): Promise<Record<string, boolean>> => {
    const checklistClient = supabase as any;
    let query = checklistClient
      .from("os_checklist_itens")
      .select("*")
      .eq("ordem_servico_id", osId);
    const orgId = osOrgId || organization?.id;
    if (orgId && !isPlatformAdmin) query = query.eq("organization_id", orgId);
    const { data, error } = await query;
    if (error) return {};
    const values: Record<string, boolean> = {};
    (data || []).forEach(r => { values[r.item_id] = !!r.marcado; });
    return values;
  }, [organization?.id, isPlatformAdmin]);

  const clienteOptions: SmartSelectOption[] = clientes.map(c => ({
    id: c.id,
    label: c.nome,
    sublabel: c.telefone + (c.cpf_cnpj ? ` · ${c.cpf_cnpj}` : ""),
  }));

  const selectedCliente = clientes.find(c => c.id === formData.cliente_id);
  const readOnlyOsMessage = MENSAGEM_OS_SEM_EDICAO;
  const readOnlyFecharMessage = "Seu perfil só pode finalizar (fechar) ordens de serviço — não pode criar, editar nem reabrir OS.";

  /** Quem pode fechar a OS: admin, o técnico responsável ou quem tem a permissão "Pode finalizar OS". */
  const podeFecharOS = (os?: OrdemServico | null): boolean =>
    podeFinalizarOs || (!!os && canUserManageOS(os, user?.id, isAdmin));

  /** "Avançar" para quem só tem a permissão só faz sentido quando o próximo passo fecha a OS. */
  const podeAvancarOS = (os?: OrdemServico | null): boolean => {
    if (!os || !podeFecharOS(os)) return false;
    if (canEdit) return true;
    const proximo = getNextStatus(os.status);
    return !!proximo && LOCK_CLOSED_STATUSES.has(proximo);
  };

  // Wizard validation
  const canAdvance = (step: number): boolean => {
    switch (step) {
      case 0: return !!formData.cliente_id;
      case 1: return !!uiCategory;
      case 2: return formData.descricao_problema.length >= 5;
      default: return true;
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user) { toast.error("Usuário não autenticado"); return; }
    if (!canEdit) { toast.error(readOnlyOsMessage); return; }
    if (!formData.cliente_id) { toast.error("Selecione um cliente"); return; }
    if (!formData.descricao_problema) { toast.error("Descreva o defeito"); return; }
    if (editingOS && !itemsLoaded) { toast.error("Aguarde o carregamento dos itens antes de salvar a OS."); return; }

    setFormLoading(true);
    try {
      // Read and confirm removals before changing the OS, so cancellation never leaves a partial save.
      const originalItems = editingOS ? await fetchOSItems(editingOS.id, editingOS.organization_id) : [];
      const removedIds = originalItems.filter(item => item.id && !osItems.some(current => current.id === item.id)).map(item => item.id as string);
      if (removedIds.length) {
        const approved = await confirm({
          title: "Remover lançamentos da OS?",
          description: `${removedIds.length} ${removedIds.length === 1 ? "peça ou serviço será removido" : "peças ou serviços serão removidos"} desta OS. Deseja continuar?`,
          confirmText: "Remover e salvar",
          variant: "destructive",
        });
        if (!approved) return;
      }
      let organizationId = organization?.id || null;
      if (!organizationId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .maybeSingle();
        organizationId = profile?.organization_id || null;
      }
      if (!organizationId && !isPlatformAdmin) {
        throw new Error("Sua conta não está vinculada a uma empresa. Contate o administrador.");
      }

      const { ciclos_carga_entrada, ciclos_carga_saida, tipo_os, checklist_equipamento_tipo_id, ...restForm } = formData;
      let observacoesWithMobility = (restForm.observacoes || "")
        .replace(/\[MOBILIDADE:[\s\S]*?\]/g, "")
        .replace(/\[CUSTOM:[^\]]*\]/g, "")
        .replace(/\[ROTA:[\s\S]*?\]/g, "")
        .trim();

      const isConfiguredCategory = (configTipos || []).some(t => t.value === uiCategory);
      if (!isMobility && (uiCategory.startsWith("custom_") || isConfiguredCategory || (!!editingOS && uiCategory !== editingOS.tipo_equipamento && uiCategory === detectUiCategory(editingOS)))) {
        observacoesWithMobility = observacoesWithMobility
          ? `${observacoesWithMobility}\n[CUSTOM:${uiCategory}]`
          : `[CUSTOM:${uiCategory}]`;
      }

      if (isMobility) {
        const mChecklist = [];
        if (mobilityData.check_display) mChecklist.push("Display");
        if (mobilityData.check_acelerador) mChecklist.push("Acelerador");
        if (mobilityData.check_freios) mChecklist.push("Freios");
        if (mobilityData.check_pneus) mChecklist.push("Pneus");
        if (mobilityData.check_controladora) mChecklist.push("Controladora");
        if (mobilityData.check_iluminacao) mChecklist.push("Iluminação");
        if (mobilityData.check_carenagem) mChecklist.push("Carenagem");
        const mobilityTag = `[MOBILIDADE:${uiCategory} | Voltagem:${mobilityData.voltagem || "-"} | Bateria:${mobilityData.capacidade_bateria || "-"}Ah | Odômetro:${mobilityData.odometro || "-"}km | Chave:${mobilityData.chave_ignicao ? "Sim" : "Não"} | Carregador:${mobilityData.carregador_entregue ? "Sim" : "Não"} | Checklist:${mChecklist.join(",") || "Nenhum"}]`;
        observacoesWithMobility = observacoesWithMobility ? `${observacoesWithMobility}\n${mobilityTag}` : mobilityTag;
      }

      // valor_orcamento é calculado pelos itens; quando não houver itens, preservar o valor existente (compat. com OS antigas)
      const valorOrcamentoFinal = osItems.length > 0
        ? (totalOrcamento || null)
        : (formData.valor_orcamento || null);

      // Blindagem: o enum do banco só aceita estes valores. Qualquer tipo de UI
      // fora dessa lista (mobilidade, informática, customizados) vira 'outro'
      // e a label real fica preservada em observacoes via [MOBILIDADE:]/[CUSTOM:].
      const DB_ENUM_TIPOS = ["drone_agricola", "drone_convencional", "controle", "bateria", "outro"];
      const tipoEquipamentoDb = DB_ENUM_TIPOS.includes(restForm.tipo_equipamento as string)
        ? restForm.tipo_equipamento
        : ("outro" as Enums<"tipo_equipamento">);

      const osData: any = {
        ...restForm,
        tipo_equipamento: tipoEquipamentoDb,
        organization_id: editingOS?.organization_id || organizationId,
        observacoes: observacoesWithMobility || null,
        valor_orcamento: valorOrcamentoFinal,
        data_previsao: formData.data_previsao ? dateOnlyToIso(formData.data_previsao) : null,
        prazo_diagnostico_horas: formData.prazo_diagnostico_horas > 0 ? formData.prazo_diagnostico_horas : 48,
        diagnostico: formData.diagnostico || null,
        // Campos UUID nunca podem ir como string vazia (erro 22P02 no Postgres).
        // Sem técnico escolhido, só assume o usuário logado se ele realmente executa serviço
        // (admin ou técnico); perfis de consulta não podem virar responsáveis técnicos.
        tecnico_id:
          formData.tecnico_id ||
          (editingOS
            ? (editingOS as any).tecnico_id || (isAdmin || isTecnico ? user.id : null)
            : isAdmin || isTecnico
              ? user.id
              : null),
        ciclos_carga_entrada: isBateria ? ciclos_carga_entrada || null : null,
         ciclos_carga_saida: isBateria ? ciclos_carga_saida || null : null,
         tipo_os: tipo_os || "normal",
         checklist_equipamento_tipo_id: tipo_os === "revisao" ? (checklist_equipamento_tipo_id || null) : null,
       };

      // Blindagem final: qualquer string vazia em campo não-textual vira null
      ["cliente_id", "tecnico_id", "data_previsao"].forEach((k) => {
        if (osData[k] === "") osData[k] = null;
      });
      if (!osData.cliente_id) throw new Error("Selecione um cliente antes de salvar.");
      if (!osData.organization_id && !isPlatformAdmin) {
        throw new Error("Sua conta não está vinculada a uma empresa. Contate o administrador.");
      }

      let osId: string;
      let createdOS: { numero: string; cliente_id: string; tipo_equipamento: string; modelo_equipamento: string } | null = null;
      if (editingOS) {
        const { error } = await supabase.from("ordens_servico").update(osData).eq("id", editingOS.id);
        if (error) throw error;
        osId = editingOS.id;
      } else {
        const { data: insertedData, error } = await supabase.from("ordens_servico").insert({
          ...osData, numero: "", status: "recebido" as any,
        }).select("id, numero, cliente_id, tipo_equipamento, modelo_equipamento").single();
        if (error) throw error;
        osId = insertedData.id;
        createdOS = insertedData;
      }


      // Preserve existing rows and only write changed items. Never replace an unread list with an empty one.
      if (osId) {
        const savedById = new Map(originalItems.map(item => [item.id, item]));
        const changedItems = osItems.filter(item => !item.id || JSON.stringify(item) !== JSON.stringify(savedById.get(item.id)));
        const itemPayload = (item: OSItem) => ({
            ordem_servico_id: osId,
            tipo: item.tipo === "produto" ? "produto" : "servico",
            produto_id: item.tipo === "produto" && item.produto_id ? item.produto_id : null,
            item_estoque_id: item.tipo === "produto" && item.item_estoque_id ? item.item_estoque_id : null,
            servico_id: item.tipo === "servico" && item.servico_id ? item.servico_id : null,
            descricao: (item.descricao || "Item").trim(),
            quantidade: Math.max(1, Math.round(Number(item.quantidade) || 1)),
            valor_unitario: Number(item.valor_unitario) || 0,
            valor_total: Number(item.valor_total) || 0,
            desconto_percentual: Number(item.desconto_percentual) || 0,
            desconto_valor: Number(item.desconto_valor) || 0,
            desconto_maximo_percentual: Number(item.desconto_maximo_percentual) || 0,
            custo_servico: Math.max(0, Number(item.custo_servico) || 0),
            organization_id: editingOS?.organization_id || organizationId,
          });
        for (const item of changedItems.filter(item => item.id)) {
          const { error } = await supabase.from("itens_os").update(itemPayload(item)).eq("id", item.id as string).eq("ordem_servico_id", osId);
          if (error) throw new Error(`A OS foi salva, mas os itens não: ${error.message}`);
        }
        const newItems = changedItems.filter(item => !item.id);
        if (newItems.length) {
          const { error } = await supabase.from("itens_os").insert(newItems.map(itemPayload));
          if (error) throw new Error(`A OS foi salva, mas os itens não: ${error.message}`);
        }
        if (removedIds.length) {
          const { error } = await supabase.from("itens_os").delete().eq("ordem_servico_id", osId).in("id", removedIds);
          if (error) throw new Error(`A OS foi salva, mas os itens não: ${error.message}`);
        }
        const checklistClient = supabase as any;
        const { error: delChecklistErr } = await checklistClient
          .from("os_checklist_itens")
          .delete()
          .eq("ordem_servico_id", osId);
        if (delChecklistErr) throw delChecklistErr;
        if (configItems.length > 0) {
          const { error: insChecklistErr } = await checklistClient
            .from("os_checklist_itens")
            .insert(configItems.map(item => ({
              organization_id: editingOS?.organization_id || organizationId,
              ordem_servico_id: osId,
              item_id: item.id,
              marcado: !!configCheckbox[item.id],
            })));
          if (insChecklistErr) throw insChecklistErr;
        }


      }
      // Calcula a comissão do técnico vinculado (config vigente no perfil)
      try {
        await supabase.rpc('calculate_os_commission' as any, { _os_id: osId });
      } catch (err: any) {
        console.error("Erro ao calcular comissão:", err);
      }
      toast.success(editingOS ? "OS atualizada com sucesso!" : `OS ${formatOSNumber(createdOS?.numero)} criada com sucesso!`);
      if (createdOS) {
        setLastCreatedOS(createdOS);
        setTermsDialogOpen(true);
      }
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      console.error("Erro detalhado ao salvar OS:", {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        status: err?.status,
      });
      toast.error(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (os: OrdemServico) => {
    if (!canEdit) { toast.error(readOnlyOsMessage); return; }
    if (!canUserManageOS(os, user?.id, isAdmin)) { toast.error("Você só pode editar OSs designadas a você."); return; }
    setItemsLoaded(false);
    setEditingOS(os);
    setOsItems([]);
    setConfigCheckbox({});
    const detectedCategory = detectUiCategory(os);
    setUiCategory(detectedCategory);
    const obs = os.observacoes || "";
    const mobilityMatch = obs.match(/\[MOBILIDADE:(\w+)\s*\|\s*Voltagem:(.*?)\s*\|\s*Bateria:(.*?)Ah\s*\|\s*Odômetro:(.*?)km\s*\|\s*Chave:(.*?)\s*\|\s*Carregador:(.*?)\s*\|\s*Checklist:(.*?)\]/);
    if (mobilityMatch) {
      const checkItems = mobilityMatch[7].split(",");
      setMobilityData({
        voltagem: mobilityMatch[2] === "-" ? "" : mobilityMatch[2],
        capacidade_bateria: mobilityMatch[3] === "-" ? "" : mobilityMatch[3],
        odometro: mobilityMatch[4] === "-" ? "" : mobilityMatch[4],
        chave_ignicao: mobilityMatch[5] === "Sim",
        carregador_entregue: mobilityMatch[6] === "Sim",
        check_display: checkItems.includes("Display"),
        check_acelerador: checkItems.includes("Acelerador"),
        check_freios: checkItems.includes("Freios"),
        check_pneus: checkItems.includes("Pneus"),
        check_controladora: checkItems.includes("Controladora"),
        check_iluminacao: checkItems.includes("Iluminação"),
        check_carenagem: checkItems.includes("Carenagem"),
      });
    } else {
      resetMobilityData();
    }
    const cleanObs = obs.replace(/\[MOBILIDADE:[\s\S]*?\]/g, "").replace(/\[CUSTOM:[^\]]*\]/g, "").trim();
    setFormData({
      cliente_id: os.cliente_id,
      tipo_equipamento: os.tipo_equipamento,
      marca: (os as any).marca || "",
      modelo_equipamento: os.modelo_equipamento || "",
      numero_serie: os.numero_serie || "",
      descricao_problema: os.descricao_problema,
      diagnostico: os.diagnostico || "",
      prioridade: os.prioridade,
      data_previsao: os.data_previsao ? os.data_previsao.split("T")[0] : "",
      prazo_diagnostico_horas: (os as any).prazo_diagnostico_horas ?? 48,
      desconto: (os as any).desconto || 0,
      valor_orcamento: os.valor_orcamento || 0,
      observacoes: cleanObs,
      checklist_bateria: (os as any).checklist_bateria || false,
      checklist_carregador: (os as any).checklist_carregador || false,
      checklist_controle: (os as any).checklist_controle || false,
      checklist_cabos: (os as any).checklist_cabos || false,
      checklist_helices: (os as any).checklist_helices || false,
      checklist_outros: (os as any).checklist_outros || false,
      condicao_visual: (os as any).condicao_visual || "",
      ciclos_carga_entrada: (os as any).ciclos_carga_entrada || 0,
       ciclos_carga_saida: (os as any).ciclos_carga_saida || 0,
        tecnico_id: os.tecnico_id || "",
        tipo_os: (os as any).tipo_os || "normal",
        checklist_equipamento_tipo_id: (os as any).checklist_equipamento_tipo_id || "",
        nfe_emitida: (os as any).nfe_emitida || false,
      });
    try {
      const [fetchedItems, checklistResponses] = await Promise.all([
        fetchOSItems(os.id, os.organization_id),
        loadChecklistResponses(os.id, os.organization_id),
      ]);
      setOsItems(fetchedItems);
      setConfigCheckbox(checklistResponses);
      setItemsLoaded(true);
      setWizardStep(0);
      setDialogOpen(true);
    } catch (error) {
      setEditingOS(null);
      toast.error(getErrorMessage(error));
    }
  };

  const handleView = async (os: OrdemServico) => {
    setViewingOS(os);
    setPrazoHoras((os as any).prazo_diagnostico_horas ?? 48);
    setViewOsItems([]);
    setViewOsItemsLoading(true);
    setViewConfigChecklist([]);
    setCommissionDialogOpen(false);
    setOsConta(null);
    setOsJaPago(0);
    setViewDialogOpen(true);
    carregarContaOS(os.id);
    try {
      setViewOsItems(await fetchOSItems(os.id, os.organization_id));
      const checklistClient = supabase as any;
      let checklistQuery = checklistClient
        .from("os_checklist_itens")
        .select("marcado, item:checklist_equipamento_itens(label, obrigatorio)")
        .eq("ordem_servico_id", os.id);
      const orgId = os.organization_id || organization?.id;
      if (orgId && !isPlatformAdmin) checklistQuery = checklistQuery.eq("organization_id", orgId);
      const { data: checklistData, error: checklistError } = await checklistQuery;
      if (!checklistError && checklistData) {
        setViewConfigChecklist((checklistData as any[]).map(r => ({
          label: r?.item?.label || "Item de verificação",
          obrigatorio: !!r?.item?.obrigatorio,
          marcado: !!r?.marcado,
        })));
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
      setViewDialogOpen(false);
    } finally {
      setViewOsItemsLoading(false);
    }
  };

  /** O técnico ajusta o prazo de diagnóstico desta OS, sem sair do diálogo. */
  const salvarPrazoDiagnostico = async () => {
    if (!viewingOS) return;
    if (!canEdit) { toast.error(readOnlyOsMessage); return; }
    const horas = Math.max(1, Math.round(prazoHoras));
    setSalvandoPrazo(true);
    try {
      const { error } = await supabase
        .from("ordens_servico")
        .update({ prazo_diagnostico_horas: horas } as any)
        .eq("id", viewingOS.id);
      if (error) throw error;
      const atualizada = { ...viewingOS, prazo_diagnostico_horas: horas } as OrdemServico;
      setViewingOS(atualizada);
      setOrdens(prev => prev.map(o => (o.id === atualizada.id ? ({ ...o, prazo_diagnostico_horas: horas } as OrdemServico) : o)));
      setPrazoHoras(horas);
      toast.success(`Prazo de diagnóstico atualizado para ${horas}h.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSalvandoPrazo(false);
    }
  };

  /** Relê a OS aberta (o rateio já vem com o ajuste) e atualiza a lista. */
  const recarregarOSVisualizada = async (osId: string) => {
    const { data, error } = await supabase
      .from("ordens_servico")
      .select("*, clientes(nome, telefone)")
      .eq("id", osId)
      .maybeSingle();
    if (error) {
      toast.error(getErrorMessage(error));
      return;
    }
    if (data) {
      setViewingOS(data as OrdemServico);
      setPrazoHoras((data as any).prazo_diagnostico_horas ?? 48);
    }
    fetchData();
  };

  // Deep link: /ordens-servico?os=<id> abre a OS correspondente e limpa o parâmetro da URL.
  useEffect(() => {
    const osId = searchParams.get("os");
    if (!osId) {
      osDeepLinkRef.current = null;
      return;
    }
    if (loading) return;
    if (osDeepLinkRef.current === osId) return;
    osDeepLinkRef.current = osId;

    const abrirOS = async () => {
      const naLista = ordens.find(o => o.id === osId);
      if (naLista) return handleView(naLista);

      let query = supabase
        .from("ordens_servico")
        .select("*, clientes(nome, telefone)")
        .eq("id", osId);
      if (organization?.id && !isPlatformAdmin) {
        query = query.eq("organization_id", organization.id);
      }

      const { data, error } = await query.maybeSingle();
      if (error) console.error("Erro ao buscar OS pelo link:", error);
      if (data) return handleView(data as OrdemServico);
      toast.error("OS não encontrada");
    };

    abrirOS().finally(() => {
      const restantes = new URLSearchParams(searchParams);
      restantes.delete("os");
      setSearchParams(restantes, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, ordens, organization?.id, isPlatformAdmin]);

  const computeSuggestedValue = async (os: OrdemServico): Promise<number> => {
    if (os.valor_final && os.valor_final > 0) return Number(os.valor_final);
    if (os.valor_orcamento && os.valor_orcamento > 0) return Number(os.valor_orcamento);
    const items = await fetchOSItems(os.id, os.organization_id);
    const total = items.reduce((s, i) => s + (i.valor_total || 0), 0);
    return Math.max(0, total - (Number((os as any).desconto) || 0));
  };

  /** Carrega a conta a receber (saldo em aberto) desta OS, se houver. */
  const carregarContaOS = async (osId: string) => {
    try {
      const [{ data: conta }, { data: fin }] = await Promise.all([
        (supabase.from as any)("contas_receber")
          .select("saldo, valor, valor_recebido, vencimento, condicoes_pagamento, equipamento, status")
          .eq("ordem_servico_id", osId)
          .maybeSingle(),
        supabase.from("financeiro").select("valor").eq("ordem_servico_id", osId).eq("tipo", "receita"),
      ]);
      setOsConta(conta || null);
      setOsJaPago((fin || []).reduce((s: number, f: any) => s + Number(f.valor || 0), 0));
    } catch {
      setOsConta(null);
      setOsJaPago(0);
    }
  };

  const openPaymentForOS = async (os: OrdemServico, nextStatus: string | null) => {
    const total = await computeSuggestedValue(os);
    const { data: fin } = await supabase
      .from("financeiro")
      .select("valor")
      .eq("ordem_servico_id", os.id)
      .eq("tipo", "receita");
    const jaPago = (fin || []).reduce((s: number, f: any) => s + Number(f.valor || 0), 0);
    setPaymentDialog({
      open: true,
      osId: os.id,
      osNumero: os.numero,
      valorTotal: total,
      valorJaPago: jaPago,
      osEquipamento: [(os as any).modelo_equipamento, (os as any).numero_serie].filter(Boolean).join(" — ") || (os as any).tipo_equipamento || "",
      nextStatus,
      saving: false,
      parcial: false,
    });
  };

  const applyStatusUpdate = async (osId: string, newStatus: string) => {
    const os = ordens.find(o => o.id === osId);
    // Quem edita só altera status de OS designada a si (admin altera qualquer uma).
    if (canEdit && os && !canUserManageOS(os, user?.id, isAdmin)) {
      throw new Error("Você só pode alterar status de OSs designadas a você.");
    }
    // As regras de status (RPC `finalizar_os`, checklist obrigatório, datas, comissão e
    // histórico) ficam em `@/lib/os-status-update`, compartilhadas com o painel do técnico.
    await aplicarStatusOs({
      osId,
      novoStatus: newStatus,
      organizationId: os?.organization_id || organization?.id,
      isPlatformAdmin,
      userId: user?.id,
      podeEditar: canEdit,
      podeFinalizarOs,
    });
  };

  const handleStatusChange = async (osId: string, newStatus: string): Promise<boolean> => {
    const os = ordens.find(o => o.id === osId);
    const isReview = (os as any)?.tipo_os === "revisao";
    if (newStatus === "finalizada" && os && !podeFecharOS(os)) {
      toast.error("Somente o técnico responsável, um administrador ou quem tem a permissão \"Pode finalizar OS\" pode finalizar esta OS.");
      return false;
    }

    // Bloqueio para Revisão: não permitir "entregue" ou "finalizada" sem checklist completo
    if (isReview && (newStatus === "entregue" || newStatus === "finalizada")) {
      try {
        const pending = await getPendingRequiredChecklist(osId);
        if (pending.length > 0) {
          toast.error(`Revisão incompleta: ${pending.slice(0, 3).join("; ")}${pending.length > 3 ? "…" : ""}. Marque todos os itens antes.`);
          return false;
        }
      } catch (err: any) {
        toast.error(getErrorMessage(err));
        return false;
      }
    }

    if (LOCK_CLOSED_STATUSES.has(newStatus)) {
      try {
        const pending = await getPendingRequiredChecklist(osId);
        if (pending.length > 0) {
          toast.error(`Itens obrigatórios pendentes no checklist de revisão: ${pending.slice(0, 3).join("; ")}${pending.length > 3 ? "…" : ""}. Marque-os antes de finalizar a OS.`);
          return false;
        }
      } catch (err: any) {
        toast.error(getErrorMessage(err));
        return false;
      }
    }
    // Sem pop-up de pagamento ao ir para "entregue" - apenas muda status
    if (newStatus === "entregue") {
      try {
        await applyStatusUpdate(osId, newStatus);
        toast.success(`Status atualizado para "${getStatusLabel(newStatus)}"`);
        fetchData();
        return true;
      } catch (err: any) {
        toast.error(getErrorMessage(err));
        return false;
      }
    }

    try {
      await applyStatusUpdate(osId, newStatus);
      toast.success(`Status atualizado para "${getStatusLabel(newStatus)}"`);
      fetchData();
      return true;
    } catch (err: any) {
      toast.error(getErrorMessage(err));
      return false;
    }
  };

  const fecharPaymentDialog = () =>
    setPaymentDialog({ open: false, osId: null, osNumero: "", valorTotal: 0, valorJaPago: 0, osEquipamento: "", nextStatus: null, saving: false, parcial: false });

  const handleConfirmPayment = async (data: PaymentData) => {
    if (!paymentDialog.osId) return;
    if (!canEdit) { toast.error(readOnlyOsMessage); return; }
    setPaymentDialog(p => ({ ...p, saving: true }));
    try {
      const osId = paymentDialog.osId;
      // O RPC lança a receita no Financeiro, cria/atualiza a conta a receber do
      // saldo e valida a organização. Vale para pagamento parcial ou total.
      const res: RecebimentoResult = await registrarRecebimentoOS({
        osId,
        valor: data.valor,
        formaPagamento: data.forma_pagamento,
        equipamento: data.equipamento,
        condicoesPagamento: data.condicoes_pagamento,
        vencimento: data.vencimento ?? null,
        observacoes: data.observacoes,
      });

      if (data.parcial && res.saldo > 0) {
        // Recebimento parcial: a OS fica em aberto até quitar (não muda o status).
        if (user) {
          await supabase.from("os_historico").insert({
            ordem_servico_id: osId,
            usuario_id: user.id,
            acao: `Recebimento parcial de ${formatCurrency(data.valor)} (${data.forma_pagamento}) — saldo em aberto ${formatCurrency(res.saldo)}`,
          }).then(() => {});
        }
        toast.success("Recebimento parcial registrado", {
          description: `Saldo em aberto: ${formatCurrency(res.saldo)}. A OS segue em aberto até quitar.`,
        });
      } else {
        // Pagamento total: aplica o status escolhido, se houver.
        if (paymentDialog.nextStatus) {
          const updateData: any = { status: paymentDialog.nextStatus };
          if (paymentDialog.nextStatus === "entregue") updateData.data_entrega = new Date().toISOString();
          if (paymentDialog.nextStatus === "pronto_retirada" || paymentDialog.nextStatus === "concluida" || paymentDialog.nextStatus === "finalizada")
            updateData.data_conclusao = new Date().toISOString();
          const { error: osErr } = await supabase.from("ordens_servico").update(updateData).eq("id", osId);
          if (osErr) throw osErr;
          if (user) {
            await supabase.from("os_historico").insert({
              ordem_servico_id: osId,
              usuario_id: user.id,
              acao: `Recebimento registrado (${data.forma_pagamento}) e status alterado para ${getStatusLabel(paymentDialog.nextStatus)}`,
            }).then(() => {});
          }
        }
        toast.success("Recebimento registrado no Financeiro!");
      }

      const quitada = res.saldo <= 0.005;
      setPagoOSIds(prev => {
        const n = new Set(prev);
        if (quitada) n.add(osId); else n.delete(osId);
        return n;
      });
      setParcialOSIds(prev => {
        const n = new Set(prev);
        if (quitada) n.delete(osId); else n.add(osId);
        return n;
      });
      const eraVista = viewingOS?.id === osId;
      fecharPaymentDialog();
      fetchData();
      if (eraVista) { await Promise.all([carregarContaOS(osId), recarregarOSVisualizada(osId)]); }
    } catch (err: any) {
      toast.error(getErrorMessage(err));
      setPaymentDialog(p => ({ ...p, saving: false }));
    }
  };

  const handleSkipPayment = async () => {
    if (!paymentDialog.osId || !paymentDialog.nextStatus) {
      fecharPaymentDialog();
      return;
    }
    setPaymentDialog(p => ({ ...p, saving: true }));
    try {
      await applyStatusUpdate(paymentDialog.osId, paymentDialog.nextStatus);
      toast.success(`Status atualizado sem cobrança.`);
      fecharPaymentDialog();
      fetchData();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
      setPaymentDialog(p => ({ ...p, saving: false }));
    }
  };

  const handleRegisterPaymentForExisting = async (os: OrdemServico) => {
    // Permite registrar um novo recebimento enquanto houver saldo em aberto.
    const { data: fin } = await supabase
      .from("financeiro")
      .select("valor")
      .eq("ordem_servico_id", os.id)
      .eq("tipo", "receita");
    const jaPago = (fin || []).reduce((s: number, f: any) => s + Number(f.valor || 0), 0);
    const total = await computeSuggestedValue(os);
    if (jaPago >= total - 0.005 && total > 0) {
      toast.info("Esta OS já está quitada — nenhum saldo em aberto.");
      return;
    }
    await openPaymentForOS(os, null);
  };

  const handleAdvanceStatus = (os: OrdemServico) => {
    const next = getNextStatus(os.status);
    if (next) handleStatusChange(os.id, next);
  };

  const handleDeleteOS = async (os: OrdemServico) => {
    if (!isAdmin) { toast.error("Apenas administradores podem deletar ordens de serviço."); return; }
    const ok = await confirm({
      title: `Deletar OS ${formatOSNumber(os.numero)}?`,
      description: "Tem certeza que deseja deletar esta Ordem de Serviço? Esta ação não poderá ser desfeita e removerá itens, histórico e anexos vinculados.",
      variant: "destructive",
      confirmText: "Sim, deletar OS",
    });
    if (!ok) return;
    try {
      const { error } = await supabase.from("ordens_servico").delete().eq("id", os.id);
      if (error) throw error;
      toast.success(`OS ${formatOSNumber(os.numero)} deletada.`);
      if (editingOS?.id === os.id) { setDialogOpen(false); resetForm(); }
      if (viewingOS?.id === os.id) { setViewDialogOpen(false); setViewingOS(null); }
      fetchData();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  const handlePrintOS = async () => {
    if (!viewingOS) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup bloqueado. Permita popups para imprimir.");
      return;
    }

    const t = toast.loading("Carregando itens e fotos da OS para o PDF...");
    try {
      const itemsForPdf = await fetchOSItems(viewingOS.id, viewingOS.organization_id);
      setViewOsItems(itemsForPdf);
      const empresaForPdf = { ...empresa, nome_empresa: empresa.nome_empresa || organization?.name || "Nome da Empresa" };
      // Look up técnico name from tecnicos array
      const técnico = tecnicos.find(t => t.id === viewingOS.tecnico_id);
      const anexosForPdf = await carregarAnexosParaPdf(viewingOS.id, viewingOS.organization_id)
        .catch((e) => { console.warn("Fotos não entraram no PDF:", e); return []; });
      const html = generateOSPDF(viewingOS, itemsForPdf, empresaForPdf, técnico?.nome, undefined, anexosForPdf);
      printWindow.document.write(html);
      printWindow.document.close();
    } finally {
      toast.dismiss(t);
    }
  };



  const handlePrintEtiqueta = (os: OrdemServico) => {
    const tecnicoNome = tecnicos.find(t => t.id === os.tecnico_id)?.nome ?? "";
    void imprimirEtiquetaOS(
      {
        id: os.id,
        numero: os.numero,
        tipo_equipamento: os.tipo_equipamento,
        modelo_equipamento: os.modelo_equipamento,
        numero_serie: os.numero_serie,
        data_entrada: os.data_entrada,
        data_previsao: os.data_previsao,
      },
      tecnicoNome,
    );
  };

  const handleWhatsAppTemplate = (template: keyof typeof whatsappTemplates) => {
    if (!viewingOS) return;
    const cliente = clientes.find(c => c.id === viewingOS.cliente_id);
    if (!cliente?.telefone) { toast.error("Cliente sem telefone cadastrado"); return; }
    const osData: WhatsAppOS = {
      numero: formatOSNumber(viewingOS.numero),
      clienteNome: viewingOS.clientes?.nome || "Cliente",
      equipamento: getTypeDisplayLabel(viewingOS, orgSegmentos, orgCustomTypes, configTipos),
      modelo: viewingOS.modelo_equipamento || undefined,
      defeito: viewingOS.descricao_problema,
      diagnostico: viewingOS.diagnostico || undefined,
      valorOrcamento: viewingOS.valor_orcamento,
      valorFinal: viewingOS.valor_final,
      previsao: viewingOS.data_previsao,
      status: getStatusLabel(viewingOS.status),
    };
    const nomeEmpresa = empresa.nome_empresa || "LivreOS";
    const msg = template === "osRecebida"
      ? whatsappTemplates.osRecebida(osData, nomeEmpresa, empresa.termos_servico || undefined)
      : whatsappTemplates[template](osData, nomeEmpresa);
    openWhatsApp(cliente.telefone, msg);
  };

  const buildShareMessage = (os: any, cliente: any) => {
    const nomeEmpresa = empresa.nome_empresa || "Volt Master";
    const tipo = getTypeDisplayLabel(os, orgSegmentos, orgCustomTypes, configTipos);
    const marca = os.marca || os.modelo_equipamento || "-";
    const defeito = os.descricao_problema || "-";
    const nome = cliente?.nome || os.clientes?.nome || "cliente";
    return `Olá, ${nome}! 👋\nAqui é da ${nomeEmpresa}.\n\nSua Ordem de Serviço foi gerada com sucesso!\n\n🛠️ OS: ${formatOSNumber(os.numero)}\n📱 Equipamento: ${tipo} - ${marca}\n🔧 Defeito Relatado: ${defeito}\n\nSegue em anexo o PDF detalhado com o diagnóstico, valores, prazos e nossos termos de serviço para sua conferência.\n\nQualquer dúvida, estamos à disposição! 🔧`;
  };

  const shareOsAsPdf = async (os: any, cliente: any) => {
    if (!cliente?.telefone) { toast.error("Cliente sem telefone cadastrado"); return; }
    const t = toast.loading("Gerando PDF da OS...");
    try {
      const itemsForPdf = await fetchOSItems(os.id, os.organization_id);
      if (viewingOS?.id === os.id) setViewOsItems(itemsForPdf);
      const osComCliente = { ...os, clientes: os.clientes || { nome: cliente.nome, telefone: cliente.telefone } };
      const empresaForPdf = { ...empresa, nome_empresa: empresa.nome_empresa || organization?.name || "Nome da Empresa" };
      // Look up técnico name from tecnicos array
      const técnico = tecnicos.find(t => t.id === os.tecnico_id);
      const anexosForPdf = await carregarAnexosParaPdf(os.id, os.organization_id)
        .catch((e) => { console.warn("Fotos não entraram no PDF:", e); return []; });
      const html = generateOSPDF(osComCliente, itemsForPdf, empresaForPdf, técnico?.nome, undefined, anexosForPdf);
      const { htmlToPdfBlob, sharePdfOnWhatsApp } = await import("@/lib/os-pdf-share");
      const filename = `OS_${formatOSNumber(os.numero)}.pdf`;
      const blob = await htmlToPdfBlob(html);
      const msg = buildShareMessage(os, cliente);
      const result = await sharePdfOnWhatsApp({ blob, filename, telefone: cliente.telefone, message: msg });
      toast.dismiss(t);
      if (result === "shared") toast.success("PDF compartilhado!");
      else toast.success("PDF baixado. Anexe-o na conversa do WhatsApp que abriu.");
    } catch (err: any) {
      toast.dismiss(t);
      toast.error("Erro ao gerar PDF: " + (err?.message || err));
    }
  };

  const handleSendPdfWhatsApp = async () => {
    if (!viewingOS) return;
    const cliente = clientes.find(c => c.id === viewingOS.cliente_id);
    await shareOsAsPdf(viewingOS, cliente);
  };


  const handleCobrar = async () => {
    if (!viewingOS) return;
    const cliente = clientes.find(c => c.id === viewingOS.cliente_id);
    const asaasId = (cliente as any)?.asaas_id;
    if (!asaasId) { toast.error("Cliente sem ID Asaas. Recadastre para sincronizar."); return; }
    if (!viewingOS.valor_orcamento || viewingOS.valor_orcamento <= 0) { toast.error("OS sem valor de orçamento."); return; }
    setCobrarLoading(true);
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      const dueDateStr = todayDateInput(dueDate);
      const { data: result, error } = await supabase.functions.invoke('asaas', {
        body: {
          action: 'create_payment',
          customer: asaasId, billingType: "PIX", value: viewingOS.valor_orcamento, dueDate: dueDateStr,
          description: `OS ${formatOSNumber(viewingOS.numero)}`, externalReference: viewingOS.id,
        },
      });
      if (error) throw error;
      if (result?.id) {
        toast.success("Cobrança criada!");
        const telefone = cliente?.telefone || "";
        const fmtCurLocal = (v: number) => formatCurrency(v);
        let invoiceLink = result.invoiceUrl || "";
        if (!invoiceLink && result.id) {
          try {
            const { data: linkData } = await supabase.functions.invoke('asaas', {
              body: { action: 'get_payment', id: result.id },
            });
            invoiceLink = linkData?.invoiceUrl || "";
          } catch {}
        }
        const texto = `Olá, *${viewingOS.clientes?.nome}*! 👋\n\n*${empresa.nome_empresa || "LivreOS"}*\n\n📋 *OS:* ${formatOSNumber(viewingOS.numero)}\n💰 *Valor:* ${fmtCurLocal(viewingOS.valor_orcamento)}\n📅 *Vencimento:* ${new Date(dueDateStr + "T00:00:00").toLocaleDateString("pt-BR")}\n⚡ Pix${invoiceLink ? `\n\n🔗 ${invoiceLink}` : ""}`;
        openWhatsApp(telefone, texto);
      } else {
        toast.error("Erro ao criar cobrança");
      }
    } catch (err: any) { toast.error(getErrorMessage(err)); } finally { setCobrarLoading(false); }
  };

  const handleSendTermsWhatsApp = async () => {
    if (!lastCreatedOS) return;
    const cliente = clientes.find(c => c.id === lastCreatedOS.cliente_id);
    if (!cliente) { toast.error("Cliente não encontrado"); return; }
    await shareOsAsPdf(lastCreatedOS, cliente);
    setTermsDialogOpen(false);
    setLastCreatedOS(null);
  };


  const resetMobilityData = () => setMobilityData({ voltagem: "", capacidade_bateria: "", odometro: "", chave_ignicao: false, carregador_entregue: false, check_display: false, check_acelerador: false, check_freios: false, check_pneus: false, check_controladora: false, check_iluminacao: false, check_carenagem: false });

  const resetForm = () => {
    setFormData({ cliente_id: "", tipo_equipamento: "bateria", marca: "", modelo_equipamento: "", numero_serie: "", descricao_problema: "", diagnostico: "", prioridade: "media", data_previsao: "", prazo_diagnostico_horas: 48, desconto: 0, valor_orcamento: 0, observacoes: "", tecnico_id: "", checklist_bateria: false, checklist_carregador: false, checklist_controle: false, checklist_cabos: false, checklist_helices: false, checklist_outros: false, condicao_visual: "", ciclos_carga_entrada: 0, ciclos_carga_saida: 0, tipo_os: "normal", checklist_equipamento_tipo_id: "", nfe_emitida: false });
    setUiCategory("bateria");
    resetMobilityData();
    setConfigCheckbox({});
    setViewConfigChecklist([]);
    setEditingOS(null);
    setItemsLoaded(false);
    setWizardStep(0);
    setOsItems([]);
  };

  const requestCloseOSForm = async () => {
    if (formLoading) return;
    if (isOSFormDirty) {
      const ok = await confirm({
        title: "Descartar OS?",
        description: "Existem dados preenchidos nesta Ordem de Serviço. Se fechar agora, as alterações não salvas serão perdidas.",
        confirmText: "Descartar",
        cancelText: "Continuar editando",
        variant: "destructive",
      });
      if (!ok) return;
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleOSDialogOpenChange = (open: boolean) => {
    if (open) {
      setDialogOpen(true);
      return;
    }
    void requestCloseOSForm();
  };

  const getStatusBadge = (status: string) => {
    const c = STATUS_CONFIG[status] || { label: status, variant: "outline" as const };
    return <Badge variant={c.variant} className="text-[10px]">{c.label}</Badge>;
  };

  const filteredOrdens = ordens.filter(os => {
    const matchSearch = os.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      os.clientes?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      os.descricao_problema?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === "todas" || os.status === statusFilter;
    const matchTec = tecFilter === "todos" || (tecFilter === "meus" ? os.tecnico_id === user?.id : os.tecnico_id === tecFilter);
    return matchSearch && matchStatus && matchTec;
  });

  const stats = {
    recebidas: ordens.filter(os => os.status === "recebido" || os.status === "aberta").length,
    emReparo: ordens.filter(os => ["em_reparo", "em_andamento", "em_testes", "aprovado"].includes(os.status)).length,
    aguardando: ordens.filter(os => ["aguardando_diagnostico", "aguardando_aprovacao", "aguardando_peca"].includes(os.status)).length,
    prontas: ordens.filter(os => ["pronto_retirada", "concluida", "entregue", "finalizada"].includes(os.status)).length,
  };

  const STATUS_FILTERS = [
    { key: "todas", label: "Todas" },
    { key: "recebido", label: "Recebidas" },
    { key: "em_reparo", label: "Em Reparo" },
    { key: "aguardando_aprovacao", label: "Aguardando" },
    { key: "pronto_retirada", label: "Prontas" },
    { key: "entregue", label: "Entregues" },
    { key: "finalizada", label: "Finalizadas" },
    { key: "cancelada", label: "Canceladas" },
  ];

  // ======= RENDER =======
  return (
    <MainLayout>
      <div className="space-y-4" data-tour="os-page">
        {/* Header */}
        <PremiumCard className="p-4" delay={0} rotulo="Ordens de Serviço">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {empresa.logo_url && (
                <img src={empresa.logo_url} alt={empresa.nome_empresa} className="h-8 w-auto rounded" />
              )}
              <div>
                <h1 className="text-lg font-bold font-display flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Ordens de Serviço</h1>
                <p className="text-xs text-muted-foreground">Gestão completa de reparos e manutenção</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-2">
              <Button data-tour="os-agrupar" size="sm" variant="outline" onClick={() => setAgruparOpen(true)}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />Agrupar em orçamento
              </Button>
              <Button data-tour="os-nova" size="sm" className="gradient-primary shadow-soft" onClick={() => {
                if (!canEdit) { toast.error(readOnlyOsMessage); return; }
                if (!canCreateOS) { setShowUpgrade(true); return; }
                resetForm(); setDialogOpen(true);
              }}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />Nova OS
              </Button>
              </div>
              <AgruparOSDialog open={agruparOpen} onOpenChange={setAgruparOpen} />
              {osLimit !== -1 && (
                <span className="text-[10px] text-muted-foreground">
                  {osUsed}/{osLimit} OS este mês
                </span>
              )}
            </div>
          </div>
        </PremiumCard>
        <UpgradePlanModal open={showUpgrade} onOpenChange={setShowUpgrade} reason="os" currentPlan={plan} />

        <PainelOrdenavel tela="ordens-servico">

        {/* Stats */}
        <div data-bloco="indicadores" data-rotulo="Indicadores" className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <KpiCard label="Recebidas" value={stats.recebidas} icon={Clock} color="blue" delay={0} />
          <KpiCard label="Em Reparo" value={stats.emReparo} icon={Wrench} color="yellow" delay={100} />
          <KpiCard label="Aguardando" value={stats.aguardando} icon={Clock} color="orange" delay={200} />
          <KpiCard label="Prontas" value={stats.prontas} icon={CheckCircle2} color="green" delay={300} />
        </div>

        {/* OS List */}
        <div data-bloco="lista" data-rotulo="Ordens de serviço" data-tour="os-lista">
        <PremiumCard delay={200}>
          <div className="p-4 border-b border-border">
            <div className="flex flex-wrap gap-2 items-center">
            <div data-tour="os-busca" className="relative max-w-xs flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por número, cliente ou defeito..." className="pl-9 h-9 text-xs bg-muted/30 border-border/50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button data-tour="os-filtros" size="sm" variant={tecFilter === "meus" ? "default" : "outline"} className="h-9" onClick={() => setTecFilter(tecFilter === "meus" ? "todos" : "meus")}>Minhas OS</Button>
            <select aria-label="Filtrar por técnico" className="h-9 rounded-md border border-border bg-background px-2 text-xs" value={tecFilter} onChange={(e) => setTecFilter(e.target.value)}>
              <option value="todos">Todos os técnicos</option>
              <option value="meus">Minhas OS</option>
              {tecnicos.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            </div>
          </div>
          <PremiumTable
            columns={[
              { key: "numero", label: "OS", width: "w-[100px]" },
              { key: "status", label: "Status", width: "w-[140px]" },
              { key: "cliente", label: "Cliente" },
              { key: "equipamento", label: "Equipamento" },
              { key: "prioridade", label: "Prioridade", width: "w-[80px]" },
              { key: "valor", label: "Valor", width: "w-[100px]", align: "right" },
              { key: "actions", label: "", width: "w-[100px]" },
            ]}
            data={filteredOrdens}
            loading={loading}
            emptyMessage={statusFilter !== "todas" ? "Nenhuma OS com este filtro" : "Nenhuma OS encontrada"}
            emptyIcon={<FileText className="h-8 w-8" />}
            emptyAction={{ label: "Nova OS", onClick: () => { if (!canEdit) { toast.error(readOnlyOsMessage); return; } if (!canCreateOS) { setShowUpgrade(true); return; } resetForm(); setDialogOpen(true); } }}
            rowKey={(os) => os.id}
            striped
            hoverable
            animateRows
            renderCell={(os, columnKey) => {
              const statusConfig = STATUS_CONFIG[os.status] || { label: os.status, variant: "outline" as const };
              switch (columnKey) {
                case "numero":
                  return <span className="font-bold text-primary text-sm">{formatOSNumber(os.numero)}</span>;
                case "status":
                                  return (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <Badge variant={statusConfig.variant} className="text-[10px] whitespace-nowrap">
                                        {statusConfig.label}
                                      </Badge>
                                      {pagoOSIds.has(os.id) && (
                                        <span className="inline-flex shrink-0 items-center rounded-full bg-green-600 px-1.5 py-px text-[9px] font-semibold leading-none text-white">
                                          Pago
                                        </span>
                                      )}
                                      {parcialOSIds.has(os.id) && (
                                        <span
                                          className="inline-flex shrink-0 items-center rounded-full bg-amber-500 px-1.5 py-px text-[9px] font-semibold leading-none text-white"
                                          title="Recebimento parcial — ainda há saldo em aberto"
                                        >
                                          Parcial
                                        </span>
                                      )}
                                      {(() => {
                                        const prazo = calcularPrazoOS(os as any);
                                        if (!prazo.emAtraso) return null;
                                        return (
                                          <Badge variant="destructive" className="text-[9px] whitespace-nowrap" title={rotuloPrazo(prazo)}>
                                            Atrasada
                                          </Badge>
                                        );
                                      })()}
                                    </div>
                                  );
                case "cliente":
                  return (
                    <div>
                      <p className="font-medium text-sm">{os.clientes?.nome || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-xs">{formatDate(os.data_entrada)}</p>
                    </div>
                  );
                case "equipamento":
                  return (
                    <div>
                      <p className="text-sm text-muted-foreground truncate max-w-xs">
                        {getTypeDisplayLabel(os, orgSegmentos, orgCustomTypes)}
                        {os.modelo_equipamento ? ` · ${os.modelo_equipamento}` : ""}
                      </p>
                    </div>
                  );
                case "prioridade":
                  if (os.prioridade === "alta") {
                    return <Badge variant="destructive" className="text-[9px]">Alta</Badge>;
                  }
                  if (os.prioridade === "media") {
                    return <Badge variant="secondary" className="text-[9px]">Média</Badge>;
                  }
                  return <Badge variant="outline" className="text-[9px]">Baixa</Badge>;
                case "valor":
                  return (
                    <span className="font-bold text-primary text-sm">
                      {formatCurrency((os as any).valor_orcamento)}
                    </span>
                  );
                case "actions":
                  return (
                    <div className="flex items-center justify-end gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Ações da OS ${formatOSNumber(os.numero)}`}><Settings2 className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleView(os); }}><Eye className="mr-2 h-3.5 w-3.5" />Ver detalhes</DropdownMenuItem>
                          {canEdit && canUserManageOS(os, user?.id, isAdmin) && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(os); }}><Edit className="mr-2 h-3.5 w-3.5" />Editar OS</DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setViewingOS(os); handleWhatsAppTemplate("statusUpdate"); }}>
                            <MessageCircle className="mr-2 h-3.5 w-3.5" />Enviar WhatsApp
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setViewingOS(os); setTimeout(handlePrintOS, 100); }}>
                            <Printer className="mr-2 h-3.5 w-3.5" />Imprimir OS
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePrintEtiqueta(os); }}>
                            <Printer className="mr-2 h-3.5 w-3.5" />Imprimir etiqueta
                          </DropdownMenuItem>
                          {canEdit && canUserManageOS(os, user?.id, isAdmin) && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRegisterPaymentForExisting(os); }}>
                              <CreditCard className="mr-2 h-3.5 w-3.5" />Registrar Recebimento
                            </DropdownMenuItem>
                          )}
                          {isAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteOS(os); }} className="text-destructive focus:text-destructive">
                                <Trash2 className="mr-2 h-3.5 w-3.5" />Deletar OS
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                default:
                  return null;
              }
            }}
          />
        </PremiumCard>
        </div>
        </PainelOrdenavel>

        {/* ===== OS FORM DIALOG (single-scroll) ===== */}
        <Dialog open={dialogOpen} onOpenChange={handleOSDialogOpenChange}>
          <DialogContent
            className="max-w-2xl w-[calc(100vw-1rem)] sm:w-full h-[95dvh] sm:h-[90dvh] p-0 flex flex-col overflow-hidden"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader className="p-4 border-b shrink-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <DialogTitle>{editingOS ? `Editar OS ${formatOSNumber(editingOS.numero)}` : "Nova Ordem de Serviço"}</DialogTitle>
                              <DialogDescription className="text-xs">
                                Preencha os dados abaixo. Você pode salvar a qualquer momento.
                              </DialogDescription>
                            </div>
                            {editingOS && (
                              <Button variant="outline" size="sm" onClick={() => setAnexosDialogOpen(true)}
                                className="h-8 text-xs bg-blue-50/50 text-blue-600 border-blue-200 hover:bg-blue-100">
                                <Image className="h-3.5 w-3.5 mr-1.5" /> Anexar Imagens
                              </Button>
                            )}
                          </div>
                        </DialogHeader>

            <form
              onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
              className="flex-1 overflow-y-auto p-4 space-y-4 pb-24"
            >
              {!canEdit && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {podeFinalizarOs ? readOnlyFecharMessage : readOnlyOsMessage}
                </div>
              )}
              {/* Cliente */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">1. Cliente</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <SmartSelect
                    label="Selecionar Cliente"
                    placeholder="Buscar por nome, telefone ou CPF..."
                    options={clienteOptions}
                    value={formData.cliente_id}
                    onSelect={(opt) => setFormData({ ...formData, cliente_id: opt.id })}
                    onClear={() => setFormData({ ...formData, cliente_id: "" })}
                    onCreateNew={(name) => { setQuickClientPreName(name); setQuickClientOpen(true); }}
                    createLabel="Cadastrar cliente"
                    required
                  />
                  {selectedCliente && (
                    <div className="p-3 rounded-md bg-muted/30 border border-border/50 text-xs space-y-1">
                      <p><span className="text-muted-foreground">Tel:</span> {selectedCliente.telefone}</p>
                      {selectedCliente.email && <p><span className="text-muted-foreground">Email:</span> {selectedCliente.email}</p>}
                      {selectedCliente.cidade && <p><span className="text-muted-foreground">Cidade:</span> {selectedCliente.cidade}/{selectedCliente.estado}</p>}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Equipamento */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">2. Equipamento</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tipo *</Label>
                      <Select
                        value={uiCategory}
                        onValueChange={(v) => {
                          setUiCategory(v);
                          setConfigCheckbox({});
                          const configTipo = (configTipos || []).find(ct => ct.value === v);
                          const baseType = findTypeByValue(v, orgSegmentos, orgCustomTypes);
                          const dbEnum = configTipo?.db_enum || baseType?.dbEnum || mapCategoryToDbEnum(v);
                          setFormData({ ...formData, tipo_equipamento: dbEnum as Enums<"tipo_equipamento"> });
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={availableTypes.length ? "Selecione" : "Configure os segmentos da sua empresa"} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTypes.length === 0 && (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
                              Nenhum segmento configurado. Vá em Configurações → Segmentos.
                            </div>
                          )}
                          {availableTypes.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                          {selectedEquipmentType && <SelectItem value={selectedEquipmentType.value}>{selectedEquipmentType.label}</SelectItem>}
                          {availableTypes.length > 0 && (
                            <div className="border-t mt-1 p-2 space-y-1">
                              <p className="text-[10px] text-muted-foreground uppercase">Adicionar tipo personalizado</p>
                              <div className="flex gap-1">
                                <Input
                                  value={newCustomLabel}
                                  onChange={(e) => setNewCustomLabel(e.target.value)}
                                  placeholder="Ex: Esteira Elétrica"
                                  className="h-8 text-xs"
                                  onKeyDown={(e) => e.stopPropagation()}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8"
                                  onClick={async () => {
                                    const label = newCustomLabel.trim();
                                    if (!label) return;
                                    const value = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`;
                                    try {
                                      await saveSegments({ tipos_custom: [...(orgCustomTypes || []), { value, label }] });
                                      setUiCategory(value);
                                      setConfigCheckbox({});
                                      setFormData({ ...formData, tipo_equipamento: 'outro' as Enums<"tipo_equipamento"> });
                                      setNewCustomLabel("");
                                      toast.success(`Tipo "${label}" adicionado`);
                                    } catch (e: any) {
                                      toast.error(e.message ?? 'Falha ao adicionar');
                                    }
                                  }}
                                >+
                                </Button>
                              </div>
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Marca</Label>
                      <Input value={formData.marca} onChange={(e) => setFormData({ ...formData, marca: e.target.value })} className="h-9" placeholder={isMobility ? "Ex: Xiaomi" : "Ex: DJI"} />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Modelo</Label>
                      <Input value={formData.modelo_equipamento} onChange={(e) => setFormData({ ...formData, modelo_equipamento: e.target.value })} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nº Série</Label>
                      <Input value={formData.numero_serie} onChange={(e) => setFormData({ ...formData, numero_serie: e.target.value })} className="h-9 font-mono" />
                    </div>
                  </div>

                  {isBateria && !isMobility && (
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-md border border-dashed border-primary/30 bg-primary/5">
                      <div className="space-y-1.5"><Label className="text-xs">Ciclos Entrada</Label><NumberInput min="0" value={formData.ciclos_carga_entrada} onChange={(v) => setFormData({ ...formData, ciclos_carga_entrada: v })} className="h-9" placeholder="0" /></div>
                      <div className="space-y-1.5"><Label className="text-xs">Ciclos Saída</Label><NumberInput min="0" value={formData.ciclos_carga_saida} onChange={(v) => setFormData({ ...formData, ciclos_carga_saida: v })} className="h-9" placeholder="0" /></div>
                    </div>
                  )}

                  {isMobility && (
                    <div className="p-3 rounded-md border border-dashed border-primary/30 bg-primary/5 space-y-3">
                      <p className="text-xs font-semibold text-primary">⚡ Mobilidade Elétrica</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Voltagem</Label>
                          <Select value={mobilityData.voltagem} onValueChange={(v) => setMobilityData({ ...mobilityData, voltagem: v })}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>{["36V", "48V", "60V", "72V"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5"><Label className="text-xs">Bateria (Ah)</Label><Input value={mobilityData.capacidade_bateria} onChange={(e) => setMobilityData({ ...mobilityData, capacidade_bateria: e.target.value })} className="h-9" /></div>
                        <div className="space-y-1.5"><Label className="text-xs">Odômetro (km)</Label><Input value={mobilityData.odometro} onChange={(e) => setMobilityData({ ...mobilityData, odometro: e.target.value })} className="h-9" /></div>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2"><Checkbox id="chave" checked={mobilityData.chave_ignicao} onCheckedChange={(c) => setMobilityData({ ...mobilityData, chave_ignicao: !!c })} /><Label htmlFor="chave" className="text-xs cursor-pointer">Chave entregue</Label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="carreg_mob" checked={mobilityData.carregador_entregue} onCheckedChange={(c) => setMobilityData({ ...mobilityData, carregador_entregue: !!c })} /><Label htmlFor="carreg_mob" className="text-xs cursor-pointer">Carregador</Label></div>
                      </div>
                    </div>
                  )}

                  <Separator />
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Checklist de Entrada</p>
                  {configItems.length > 0 ? (
                    <div className="space-y-2">
                      {activeConfigTipo?.label && (
                        <p className="text-[11px] text-muted-foreground">
                          Itens de revisão de "{activeConfigTipo.label}":
                        </p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {configItems.map(item => (
                          <div key={item.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`cfg_${item.id}`}
                              checked={!!configCheckbox[item.id]}
                              onCheckedChange={(c) => setConfigCheckbox(prev => ({ ...prev, [item.id]: !!c }))}
                            />
                            <Label htmlFor={`cfg_${item.id}`} className="text-xs cursor-pointer flex items-center gap-1.5">
                              <span>{item.label}</span>
                              {item.obrigatorio && (
                                <Badge variant="outline" className="text-[9px] text-warning border-warning/30 bg-warning/5 shrink-0">Obrigatório</Badge>
                              )}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : isMobility ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(["check_display|Display", "check_acelerador|Acelerador", "check_freios|Freios", "check_pneus|Pneus", "check_controladora|Controladora", "check_iluminacao|Iluminação", "check_carenagem|Carenagem"] as const).map(item => {
                        const [key, label] = item.split("|");
                        return (<div key={key} className="flex items-center space-x-1.5"><Checkbox id={key} checked={(mobilityData as any)[key]} onCheckedChange={(c) => setMobilityData({ ...mobilityData, [key]: !!c })} /><Label htmlFor={key} className="text-xs cursor-pointer">{label}</Label></div>);
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {([["checklist_bateria", "Bateria"], ["checklist_carregador", "Carregador"], ["checklist_controle", "Controle"], ["checklist_cabos", "Cabos"], ["checklist_helices", "Hélices"], ["checklist_outros", "Outros"]] as const).map(([key, label]) => (
                        <div key={key} className="flex items-center space-x-1.5"><Checkbox id={key} checked={(formData as any)[key]} onCheckedChange={(c) => setFormData({ ...formData, [key]: !!c })} /><Label htmlFor={key} className="text-xs cursor-pointer">{label}</Label></div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-1.5"><Label className="text-xs">Condição Visual</Label><Textarea value={formData.condicao_visual} onChange={(e) => setFormData({ ...formData, condicao_visual: e.target.value })} rows={2} className="text-sm" placeholder="Riscos, amassados, lacres..." /></div>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Técnico Responsável</Label>
                    <Select value={formData.tecnico_id || ""} onValueChange={(v) => setFormData({ ...formData, tecnico_id: v } as any)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar técnico..." /></SelectTrigger>
                      <SelectContent>
                        {tecnicos.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}{(t as any).nivel_tecnico ? ` · Nível ${(t as any).nivel_tecnico}` : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Diagnóstico, peças e serviços */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">3. Diagnóstico, Peças e Serviços</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5"><Label className="text-xs">Defeito Relatado *</Label><Textarea value={formData.descricao_problema} onChange={(e) => setFormData({ ...formData, descricao_problema: e.target.value })} rows={3} required placeholder="Descreva o defeito..." /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Diagnóstico / Solução Técnica</Label><Textarea value={formData.diagnostico} onChange={(e) => setFormData({ ...formData, diagnostico: e.target.value })} rows={2} placeholder="Resultado da análise..." /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Prioridade</Label>
                      <div className="flex gap-2">
                        {[{ v: "baixa", l: "Baixa" }, { v: "media", l: "Média" }, { v: "alta", l: "Alta" }].map(p => (
                          <button key={p.v} type="button" onClick={() => setFormData({ ...formData, prioridade: p.v })}
                            className={`flex-1 py-1.5 rounded-md text-xs font-medium border-2 transition-colors ${formData.prioridade === p.v ? (p.v === "alta" ? "border-destructive bg-destructive/10 text-destructive" : p.v === "media" ? "border-amber-500 bg-amber-500/10 text-amber-700" : "border-primary bg-primary/10 text-primary") : "border-border bg-muted/20 text-muted-foreground"}`}>
                            {p.l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5"><Label className="text-xs">Previsão de Entrega</Label><Input type="date" value={formData.data_previsao} onChange={(e) => setFormData({ ...formData, data_previsao: e.target.value })} className="h-9" /></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Prazo de diagnóstico (horas)</Label>
                    <div className="flex items-center gap-2">
                      <NumberInput
                        value={formData.prazo_diagnostico_horas}
                        onChange={(v) => setFormData({ ...formData, prazo_diagnostico_horas: v })}
                        min={1}
                        className="h-9 w-28"
                      />
                      <span className="text-xs text-muted-foreground">padrão 48h</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Tempo para concluir o diagnóstico. A OS só entra em atraso se o status não mudar dentro desse prazo.</p>
                  </div>
                  <Separator />
                  {legacyBudget && <p className="text-xs text-muted-foreground">Esta OS tem um orçamento salvo de {formatCurrency(formData.valor_orcamento)}, mas não possui peças ou serviços detalhados. Cadastre os lançamentos reais para substituir esse valor.</p>}
                  <OSItemsSection items={osItems} onChange={setOsItems} organizationId={editingOS?.organization_id || organization?.id} />
                </CardContent>
              </Card>


              {/* Observações + Resumo financeiro */}
<Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">4. Observações e Resumo</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5"><Label className="text-xs">Observações Técnicas / Internas</Label><Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={3} /></div>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Tipo de Ordem de Serviço</p>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tipo de OS *</Label>
                      <Select value={formData.tipo_os} onValueChange={(v) => setFormData({ ...formData, tipo_os: v as Enums<"tipo_os"> })}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Serviço Normal</SelectItem>
                          <SelectItem value="revisao">Revisão</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.tipo_os === "revisao" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Equipamento para Check-list *</Label>
                        <Select value={formData.checklist_equipamento_tipo_id} onValueChange={(v) => setFormData({ ...formData, checklist_equipamento_tipo_id: v })}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar equipamento..." /></SelectTrigger>
                          <SelectContent>
                            {(configTipos || []).filter(t => t.ativo).map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    <Separator />
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.nfe_emitida}
                          onChange={(e) => setFormData({ ...formData, nfe_emitida: e.target.checked })}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        Houve emissão de NFe/NFS-e?
                      </Label>
                      <p className="text-[10px] text-muted-foreground">
                        Marque quando a nota fiscal desta OS já foi emitida.
                      </p>
                    </div>

                    <Separator />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label className="text-xs">Desconto (R$)</Label><NumberInput step="0.01" min="0" value={formData.desconto} onChange={(v) => setFormData({ ...formData, desconto: v })} className="h-9" placeholder="0,00" /></div>
                      <div className="space-y-1.5"><Label className="text-xs">{legacyBudget ? "Orçamento salvo" : "Total Geral da OS"}</Label><Input type="text" value={formatCurrency(displayedTotal)} readOnly disabled className="h-9 font-bold text-primary" /></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </form>
            <DialogFooter className="shrink-0 border-t bg-background p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between gap-2 w-full">
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={requestCloseOSForm}>Cancelar</Button>
                  {editingOS && isAdmin && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteOS(editingOS)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Deletar</span>
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-1 justify-end">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] text-muted-foreground uppercase leading-none">Total</p>
                    <p className="text-sm font-bold text-primary leading-tight">{formatCurrency(displayedTotal)}</p>
                  </div>
                  <Button type="button" size="lg" className="gradient-primary min-w-[140px]" disabled={formLoading || !canEdit || (!!editingOS && !itemsLoaded)} onClick={() => handleSubmit()}>
                    {formLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                    {!canEdit ? "Somente leitura" : editingOS ? "Salvar Alterações" : "Criar OS"}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View OS Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={(o) => { setViewDialogOpen(o); if (!o) setCommissionDialogOpen(false); }}>
          <DialogContent className="max-w-4xl w-[95vw] sm:w-[90vw] h-[90vh] sm:h-[80vh] flex flex-col p-0 overflow-hidden rounded-xl">
            <DialogHeader className="p-4 sm:p-6 border-b shrink-0">

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-1">
                                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                                  OS {formatOSNumber(viewingOS?.numero)}
                                  {viewingOS && <Badge className={STATUS_CONFIG[viewingOS.status]?.variant === 'destructive' ? 'bg-destructive' : 'bg-primary'}>{getStatusLabel(viewingOS.status)}</Badge>}
                                  {viewingOS && pagoOSIds.has(viewingOS.id) && <Badge className="bg-green-600 text-white text-[10px]">Pago</Badge>}
                                  {viewingOS && parcialOSIds.has(viewingOS.id) && <Badge className="bg-amber-500 text-white text-[10px]">Parcial</Badge>}
                                </DialogTitle>
                  <DialogDescription className="text-xs">
                    Criada em {formatDate(viewingOS?.created_at || null)}
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handlePrintOS()} className="h-8 text-xs shrink-0">
                    <Printer className="h-3.5 w-3.5 mr-1.5" /> PDF
                  </Button>
                  {viewingOS && (
                    <Button variant="outline" size="sm" onClick={handleSendPdfWhatsApp}
                      className="h-8 text-xs bg-green-500/10 text-green-600 border-green-200 hover:bg-green-500 hover:text-white shrink-0">
                      <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Enviar PDF
                    </Button>
                  )}
                  {viewingOS && (
                    <Button variant="outline" size="sm" onClick={() => setAnexosDialogOpen(true)}
                      className="h-8 text-xs bg-blue-50/50 text-blue-600 border-blue-200 hover:bg-blue-100 shrink-0">
                      <Image className="h-3.5 w-3.5 mr-1.5" /> Anexar Imagens
                    </Button>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 pb-24">

              {viewingOS && (
              <div className="space-y-4">
                {(viewingOS as any).tecnico_id && !(viewingOS as any).recebida_em && !LOCK_CLOSED_STATUSES.has(viewingOS.status) && (
                  <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Aguardando recebimento do técnico
                      {(viewingOS as any).atribuida_em && <> · prazo até {new Date(new Date((viewingOS as any).atribuida_em).getTime() + 3600000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (depois é repassada a um técnico nível 2 ou 3)</>}
                    </span>
                    {(viewingOS as any).tecnico_id === user?.id && (
                      <Button size="sm" onClick={async () => {
                        const { error } = await supabase.rpc("confirmar_recebimento_os" as any, { _os_id: viewingOS.id });
                        if (error) { toast.error(error.message); return; }
                        toast.success("Recebimento confirmado");
                        setViewingOS({ ...viewingOS, recebida_em: new Date().toISOString() } as any);
                      }}>Confirmar recebimento</Button>
                    )}
                  </div>
                )}
                {/* Status Pipeline */}
                <StatusPipeline
                  currentStatus={viewingOS.status}
                  canChangeTo={(s) => canEdit || (podeFinalizarOs && LOCK_CLOSED_STATUSES.has(s))}
                  onStatusChange={async (s) => {
                    const ok = await handleStatusChange(viewingOS.id, s);
                    if (ok) setViewingOS({ ...viewingOS, status: s as any });
                  }}
                />

                {/* Terms banner */}
                <div className="rounded-md bg-muted/30 border border-border/50 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
                  <FileText className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                  <span>Ao deixar seu equipamento, você concorda com nossos <button className="underline text-primary font-medium" onClick={() => { const t = empresa.termos_servico; if (t) { const w = window.open("", "_blank"); if (w) { const pre = w.document.createElement("pre"); pre.setAttribute("style", "font-family:sans-serif;padding:40px;white-space:pre-wrap;max-width:700px;margin:0 auto"); pre.textContent = String(t); w.document.body.appendChild(pre); } } else { toast.info("Termos não configurados."); } }}>termos de serviço</button>.</span>
                </div>

                {(() => {
                  const obsText = viewingOS.observacoes || "";
                  const mMatch = obsText.match(/\[MOBILIDADE:(\w+)\s*\|\s*Voltagem:(.*?)\s*\|\s*Bateria:(.*?)Ah\s*\|\s*Odômetro:(.*?)km\s*\|\s*Chave:(.*?)\s*\|\s*Carregador:(.*?)\s*\|\s*Checklist:(.*?)\]/);
                  const hasMob = !!mMatch;
                  const customMatch = obsText.match(/\[CUSTOM:([^\]]+)\]/);
                  const cleanObs = obsText.replace(/\[MOBILIDADE:[\s\S]*?\]/g, "").replace(/\[CUSTOM:[^\]]*\]/g, "").trim();
                  let viewType: string;
                  if (hasMob && mMatch) {
                    viewType = TIPO_EQUIPAMENTO[mMatch[1]] || TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento];
                  } else if (customMatch) {
                    const configFound = (configTipos || []).find(t => t.value === customMatch[1]);
                    const found = findTypeByValue(customMatch[1], orgSegmentos, orgCustomTypes);
                    viewType = configFound?.label || found?.label || TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento] || viewingOS.tipo_equipamento;
                  } else {
                    viewType = TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento] || viewingOS.tipo_equipamento;
                  }

                  return (
                    <>
                      <div><h3 className="text-xs font-semibold text-primary uppercase mb-2">Cliente</h3><p className="font-medium text-sm">{viewingOS.clientes?.nome || "-"}</p></div>
                      <Separator />
                      <div>
                        <h3 className="text-xs font-semibold text-primary uppercase mb-2">Equipamento</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div><p className="text-[10px] text-muted-foreground">Tipo</p><p className="text-sm font-medium">{viewType}</p></div>
                          <div><p className="text-[10px] text-muted-foreground">Marca</p><p className="text-sm font-medium">{(viewingOS as any).marca || "-"}</p></div>
                          <div><p className="text-[10px] text-muted-foreground">Modelo</p><p className="text-sm font-medium">{viewingOS.modelo_equipamento || "-"}</p></div>
                          <div><p className="text-[10px] text-muted-foreground">Nº Série</p><p className="text-sm font-mono">{viewingOS.numero_serie || "-"}</p></div>
                        </div>
                      </div>
                      {hasMob && mMatch && (<><Separator /><div><h3 className="text-xs font-semibold text-primary uppercase mb-2">⚡ Mobilidade</h3><div className="grid grid-cols-2 gap-3">
                        <div><p className="text-[10px] text-muted-foreground">Voltagem</p><p className="text-sm">{mMatch[2]}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Bateria</p><p className="text-sm">{mMatch[3]}Ah</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Odômetro</p><p className="text-sm">{mMatch[4]}km</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Chave</p><p className="text-sm">{mMatch[5]}</p></div>
                      </div>{mMatch[7] !== "Nenhum" && <div className="mt-2 flex flex-wrap gap-1">{mMatch[7].split(",").map(i => <Badge key={i} variant="secondary" className="text-[10px]">{i}</Badge>)}</div>}</div></>)}
                       <Separator />
                       <div>
                         <h3 className="text-xs font-semibold text-primary uppercase mb-2">Tipo de Ordem de Serviço</h3>
                         <div className="space-y-2">
                           <div><p className="text-[10px] text-muted-foreground">Tipo</p><p className="text-sm font-medium">{(viewingOS as any).tipo_os === "revisao" ? "Revisão" : "Serviço Normal"}</p></div>
                         </div>
                       </div>
                       {viewConfigChecklist.length > 0 && (<><Separator /><div>
                         <h3 className="text-xs font-semibold text-primary uppercase mb-2">Checklist de Revisão</h3>
                        <div className="space-y-1.5">
                          {viewConfigChecklist.map((c, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {c.marcado ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
                                <span className="text-xs">{c.label}</span>
                              </div>
                              {c.obrigatorio && (
                                <Badge variant="outline" className="text-[9px] text-warning border-warning/30 bg-warning/5 shrink-0">Obrigatório</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div></>)}
                      <Separator />
                      <div>
                        <h3 className="text-xs font-semibold text-primary uppercase mb-2">Diagnóstico</h3>
                        <div className="space-y-2">
                          <div><p className="text-[10px] text-muted-foreground">Defeito</p><p className="text-sm">{viewingOS.descricao_problema}</p></div>
                          <div><p className="text-[10px] text-muted-foreground">Diagnóstico</p><p className="text-sm">{viewingOS.diagnostico || "-"}</p></div>
                          <div className="flex items-center justify-between rounded-md bg-muted/30 border border-border/50 px-3 py-2">
                            <p className="text-xs text-muted-foreground uppercase font-medium">{viewOsItems.length ? "Total da OS" : "Orçamento salvo"}</p>
                            <p className="text-base font-bold text-primary">{formatCurrency(valorCobradoOS(viewingOS as any, viewItemsTotal))}</p>
                          </div>
                        </div>
                      </div>
                      <Separator />
                      {/* Recebimento: total, o que já foi pago e o saldo em aberto (conta a receber). */}
                      {(() => {
                        const valorTotalOs = valorCobradoOS(viewingOS as any, viewItemsTotal);
                        const saldoOs = Math.max(0, Math.round((valorTotalOs - osJaPago) * 100) / 100);
                        return (
                          <div>
                            <h3 className="text-xs font-semibold text-primary uppercase mb-2">Recebimento</h3>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between rounded-md bg-muted/30 border border-border/50 px-3 py-2">
                                <p className="text-xs text-muted-foreground uppercase font-medium">Total da OS</p>
                                <p className="text-sm font-semibold">{formatCurrency(valorTotalOs)}</p>
                              </div>
                              {osJaPago > 0 && (
                                <div className="flex items-center justify-between rounded-md bg-muted/30 border border-border/50 px-3 py-2">
                                  <p className="text-xs text-muted-foreground uppercase font-medium">Já recebido</p>
                                  <p className="text-sm font-semibold">{formatCurrency(osJaPago)}</p>
                                </div>
                              )}
                              <div className={`flex items-center justify-between rounded-md border px-3 py-2 ${saldoOs > 0.005 ? "border-amber-500/40 bg-amber-500/5" : "border-border/50 bg-muted/30"}`}>
                                <p className={`text-xs uppercase font-medium ${saldoOs > 0.005 ? "text-amber-700" : "text-muted-foreground"}`}>
                                  {saldoOs > 0.005 ? "Saldo em aberto" : "Quitado"}
                                </p>
                                <p className={`text-sm font-bold ${saldoOs > 0.005 ? "text-amber-600" : "text-muted-foreground"}`}>{formatCurrency(saldoOs)}</p>
                              </div>
                              {osConta?.vencimento && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Vencimento</span>
                                  <span>{formatDate(osConta.vencimento)}</span>
                                </div>
                              )}
                              {osConta?.condicoes_pagamento && (
                                <div className="text-xs"><span className="text-muted-foreground">Condições: </span>{osConta.condicoes_pagamento}</div>
                              )}
                              {osConta?.equipamento && (
                                <div className="text-xs"><span className="text-muted-foreground">Equipamento retirado: </span>{osConta.equipamento}</div>
                              )}
                              {saldoOs > 0.005 && canEdit && (
                                <Button size="sm" variant="outline" className="w-full" onClick={() => openPaymentForOS(viewingOS, null)}>
                                  <CreditCard className="mr-1.5 h-3.5 w-3.5" />Receber saldo
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      <Separator />
                      {/* Rateio da comissão: o valor da OS é o que o técnico vai receber */}
                      {(() => {
                        // Mesma resolução de valor cobrado que o SQL usa: valor_final manda; sem ele, itens − desconto.
                        const descontoOs = Number((viewingOS as any).desconto) || 0;
                        const valorFinalOs = Number((viewingOS as any).valor_final) || 0;
                        const valorParaRateio = valorFinalOs !== 0
                          ? valorFinalOs
                          : Math.max(0, viewItemsTotal - descontoOs);
                        const rateio = rateioDaOS(viewingOS as any, valorParaRateio);
                        const avisos: string[] = [];
                        const congelado = rateio.congeladoEm ? new Date(rateio.congeladoEm) : null;
                        if (congelado && viewingOS.updated_at && new Date(viewingOS.updated_at) > congelado) {
                          avisos.push("A OS foi alterada depois do congelamento da comissão. Use “Conferência da comissão” para revisar.");
                        }
                        const semCusto = viewOsItems.some((i) => i.tipo === "servico") && viewOsItems.every((i) => !Number(i.custo_servico));
                        if (semCusto && LOCK_CLOSED_STATUSES.has(String(viewingOS.status))) {
                          avisos.push("OS concluída sem custo de serviço lançado. Se você repassou peças, informe o custo para a comissão sair certa.");
                        }
                        // O que a regra calcula hoje — serve tanto de prévia (OS sem rateio gravado)
                        // quanto de referência quando o administrador ajusta a comissão à mão.
                        const calculoRegra = calcularRateio({
                          valorOs: valorParaRateio,
                          desconto: descontoOs,
                          itens: viewOsItems.map((i) => ({
                            tipo: i.tipo,
                            valorTotal: Number(i.valor_total) || 0,
                            custoServico: Number(i.custo_servico) || 0,
                          })),
                          aliquota: aliquotaNfse,
                          nfeEmitida: Boolean(viewingOS.nfe_emitida),
                          taxaSemNota: empresa.commission_no_note_fee,
                        });
                        // OS antiga sem rateio gravado: mostra a regra nova como prévia, sem alterar o valor.
                        const itensCarregados = !viewOsItemsLoading;
                        const previa = rateio.semRateio && itensCarregados ? calculoRegra : null;
                        return (
                          <>
                            <CommissionBreakdown
                              data={{
                                ...rateio,
                                previa,
                                calculada: itensCarregados ? calculoRegra.comissao : null,
                                avisos,
                              }}
                            />
                            {isAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 w-full"
                                onClick={() => setCommissionDialogOpen(true)}
                              >
                                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                                Ajustar comissão
                              </Button>
                            )}
                            <CommissionOverrideDialog
                              open={commissionDialogOpen}
                              onOpenChange={setCommissionDialogOpen}
                              osId={viewingOS.id}
                              osNumero={formatOSNumber(viewingOS.numero)}
                              comissaoAtual={rateio.comissao}
                              override={rateio.override}
                              motivoAtual={rateio.overrideMotivo}
                              calculada={itensCarregados ? calculoRegra.comissao : null}
                              saldo={rateio.saldo}
                              onSaved={() => recarregarOSVisualizada(viewingOS.id)}
                            />
                          </>
                        );
                      })()}
                      <Separator />
                      {/* Items da OS */}
                      {viewOsItemsLoading ? (
                        <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando itens, peças e serviços...
                        </div>
                      ) : viewOsItems.length > 0 ? (
                        <OSItemsSection items={viewOsItems} onChange={() => {}} disabled costDisabled={!isAdmin} />
                      ) : (
                        <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                          Nenhuma peça ou serviço detalhado foi cadastrado nesta OS. O valor exibido é o orçamento salvo.
                        </div>
                      )}
                      <Separator />

                      <div className="grid grid-cols-2 gap-3">
                        <div><p className="text-[10px] text-muted-foreground">Entrada</p><p className="text-sm">{formatDate(viewingOS.data_entrada)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Previsão</p><p className="text-sm">{formatDate(viewingOS.data_previsao)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Conclusão</p><p className="text-sm">{formatDate(viewingOS.data_conclusao)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Entrega</p><p className="text-sm">{formatDate(viewingOS.data_entrega)}</p></div>
                      </div>
                      {(() => {
                        const prazo = calcularPrazoOS(viewingOS as any);
                        return (
                          <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                {prazo.fase === "diagnostico"
                                  ? "Prazo de diagnóstico"
                                  : prazo.fase === "entrega"
                                    ? "Prazo de entrega"
                                    : prazo.fase === "aprovacao"
                                      ? "Aguardando aprovação do cliente"
                                      : "OS encerrada"}
                              </p>
                              {prazo.emAtraso ? (
                                <Badge variant="destructive" className="text-[10px]">Atrasada</Badge>
                              ) : prazo.venceEm ? (
                                <Badge variant="outline" className="text-[10px]">No prazo</Badge>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground">{rotuloPrazo(prazo)}</p>
                            {canEdit && (
                              <div className="flex items-center gap-2 pt-1">
                                <Label className="text-[11px] text-muted-foreground">Prazo de diagnóstico (h)</Label>
                                <NumberInput value={prazoHoras} onChange={setPrazoHoras} min={1} className="h-8 w-20 text-xs" />
                                <Button size="sm" variant="outline" className="h-8" onClick={salvarPrazoDiagnostico} disabled={salvandoPrazo}>
                                  {salvandoPrazo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {cleanObs && <><Separator /><div><p className="text-[10px] text-muted-foreground">Observações</p><p className="text-sm">{cleanObs}</p></div></>}
                      <LegalTermsFooter />
                    </>
                  );
                })()}

                {/* WhatsApp templates dropdown + action buttons */}
                <div className="flex flex-wrap gap-2 justify-end pt-2">
                  <Button variant="outline" size="sm" onClick={handlePrintOS}><Download className="mr-1.5 h-3.5 w-3.5" />PDF</Button>
                  <Button variant="outline" size="sm" onClick={handleCobrar} disabled={cobrarLoading} className="border-primary/30 text-primary">
                    {cobrarLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CreditCard className="mr-1.5 h-3.5 w-3.5" />}Cobrar
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="bg-[hsl(142,72%,37%)] hover:bg-[hsl(142,72%,32%)] text-white">
                        <MessageCircle className="mr-1.5 h-3.5 w-3.5" />WhatsApp
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleSendPdfWhatsApp}>📎 Enviar PDF da OS</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleWhatsAppTemplate("osRecebida")}>📋 OS Recebida + Termos</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleWhatsAppTemplate("orcamentoAprovacao")}>💰 Orçamento p/ Aprovação</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleWhatsAppTemplate("osPronta")}>✅ Equipamento Pronto</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleWhatsAppTemplate("lembreteRetirada")}>🔔 Lembrete de Retirada</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleWhatsAppTemplate("statusUpdate")}>📌 Atualização de Status</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              )}
            </div>
            {viewingOS && viewingOS.status !== "entregue" && viewingOS.status !== "cancelada" && podeAvancarOS(viewingOS) && (
              <DialogFooter className="shrink-0 border-t bg-background">
                <div className="p-4">
                  <Button className="w-full gradient-primary" onClick={() => handleAdvanceStatus(viewingOS)}>
                    Avançar para {getStatusLabel(getNextStatus(viewingOS.status) || "")}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {/* Terms Dialog */}
        <Dialog open={termsDialogOpen} onOpenChange={(open) => { setTermsDialogOpen(open); if (!open) setLastCreatedOS(null); }}>
          <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" />OS Criada!</DialogTitle>
              <DialogDescription>Enviar termos via WhatsApp?</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 pb-24">
              <div className="space-y-3">
                {lastCreatedOS && (
                  <div className="p-3 rounded-md bg-muted/30 border text-sm space-y-1">
                    <p><span className="text-muted-foreground">OS:</span> <span className="font-bold text-primary">{formatOSNumber(lastCreatedOS.numero)}</span></p>
                    <p><span className="text-muted-foreground">Cliente:</span> {clientes.find(c => c.id === lastCreatedOS.cliente_id)?.nome || "-"}</p>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="shrink-0 border-t bg-background">
              <div className="flex gap-2 justify-end w-full p-4">
                <Button variant="outline" size="sm" onClick={() => { setTermsDialogOpen(false); setLastCreatedOS(null); }}>Pular</Button>
                <Button size="sm" onClick={handleSendTermsWhatsApp} className="bg-[hsl(142,72%,37%)] hover:bg-[hsl(142,72%,32%)] text-white">
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" />Enviar
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <QuickClientModal
          open={quickClientOpen}
          onOpenChange={setQuickClientOpen}
          onClientCreated={(id) => { setFormData(f => ({ ...f, cliente_id: id })); fetchData(); }}
        />

        <PaymentConfirmDialog
          open={paymentDialog.open}
          onOpenChange={(o) => setPaymentDialog(p => ({ ...p, open: o }))}
          osNumero={paymentDialog.osNumero}
          valorTotal={paymentDialog.valorTotal}
          valorJaPago={paymentDialog.valorJaPago}
          osEquipamento={paymentDialog.osEquipamento}
          loading={paymentDialog.saving}
          onConfirm={handleConfirmPayment}
          onSkip={paymentDialog.nextStatus ? handleSkipPayment : undefined}
          title={paymentDialog.nextStatus === "entregue" ? "Confirmar Entrega e Recebimento" : "Registrar Recebimento"}
        />

        <OSAnexosDialog
                  open={anexosDialogOpen}
                  onOpenChange={setAnexosDialogOpen}
                  ordemServicoId={viewingOS?.id || editingOS?.id || ""}
                  organizationId={viewingOS?.organization_id || editingOS?.organization_id || organization?.id || null}
                  isPlatformAdmin={isPlatformAdmin}
                  onAnexosChange={() => fetchData()}
                />

      </div>
    </MainLayout>
  );
}
