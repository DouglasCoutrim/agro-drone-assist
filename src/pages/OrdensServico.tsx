import { useState, useEffect, useCallback, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Edit, FileText, Loader2, Eye, MessageCircle, Download, UserPlus, CreditCard, Clock, Wrench, CheckCircle2, XCircle, ChevronRight, MoreVertical, ArrowRight, Trash2, Printer, Calculator, Navigation, Fuel, Gauge, MapPinned, Crosshair, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables, Enums } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { useUsageLimits } from "@/hooks/useUsageLimits";
import { UpgradePlanModal } from "@/components/UpgradePlanModal";
import { QuickClientModal } from "@/components/os/QuickClientModal";
import { LegalTermsFooter, getLegalTermsHTML } from "@/components/os/LegalTermsFooter";
import { SmartSelect, SmartSelectOption } from "@/components/ui/smart-select";
import { StatusPipeline, getNextStatus, getStatusLabel } from "@/components/os/StatusPipeline";
import { EmptyState } from "@/components/os/EmptyState";
import { OSItemsSection, OSItem } from "@/components/os/OSItemsSection";
import { formatCurrency, formatDate, getErrorMessage } from "@/lib/formatters";
import { whatsappTemplates, openWhatsApp, WhatsAppOS } from "@/lib/whatsapp-templates";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { generateOSPDF } from "@/components/ordens-servico/OSPDFGenerator";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgSegments } from "@/hooks/useOrgSegments";
import { useConfirm } from "@/hooks/useConfirm";
import { getAvailableTypes, findTypeByValue, SEGMENTOS } from "@/lib/equipment-segments";
import type { CustomType } from "@/lib/equipment-segments";
import { useChecklistConfig } from "@/hooks/useChecklistConfig";
import type { ChecklistItem, ChecklistTipo } from "@/hooks/useChecklistConfig";
import { PaymentConfirmDialog, PaymentData } from "@/components/os/PaymentConfirmDialog";


type OrdemServico = Tables<"ordens_servico"> & { clientes: { nome: string; telefone?: string } | null };
type Cliente = Tables<"clientes">;
type ItemOSRow = Tables<"itens_os">;

const mapDbItemsToOSItems = (data: ItemOSRow[] | null | undefined): OSItem[] =>
  (data || []).map((d: ItemOSRow) => ({
    id: d.id,
    tipo: d.tipo === "servico" ? "servico" : "produto",
    produto_id: d.produto_id,
    servico_id: d.servico_id,
    descricao: d.descricao,
    quantidade: Number(d.quantidade) || 0,
    valor_unitario: Number(d.valor_unitario) || 0,
    valor_total: Number(d.valor_total) || 0,
  }));

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  recebido: { label: "Recebido", variant: "outline" },
  aguardando_diagnostico: { label: "Aguard. Diagnóstico", variant: "secondary" },
  aguardando_aprovacao: { label: "Aguard. Aprovação", variant: "secondary" },
  aprovado: { label: "Aprovado", variant: "default" },
  em_reparo: { label: "Em Reparo", variant: "default" },
  em_testes: { label: "Em Testes", variant: "default" },
  pronto_retirada: { label: "Pronto p/ Retirada", variant: "default" },
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
const LOCK_CLOSED_STATUSES = new Set(["pronto_retirada", "concluida", "entregue"]);
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

export default function OrdensServico() {
  const { user, canEdit, isAdmin } = useAuth();
  const { organization, isPlatformAdmin, loading: orgLoading } = useOrganization();
  const { config: empresa } = useEmpresaConfig();
  const { tecnicos } = useTeamMembers();
  const confirm = useConfirm();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todas");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { canCreateOS, osUsed, osLimit, plan } = useUsageLimits();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingOS, setViewingOS] = useState<OrdemServico | null>(null);
  const [editingOS, setEditingOS] = useState<OrdemServico | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [cobrarLoading, setCobrarLoading] = useState(false);
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);
  const [lastCreatedOS, setLastCreatedOS] = useState<{ numero: string; cliente_id: string; tipo_equipamento: string; modelo_equipamento: string } | null>(null);
  const [quickClientPreName, setQuickClientPreName] = useState("");
  const [osItems, setOsItems] = useState<OSItem[]>([]);
  const [viewOsItems, setViewOsItems] = useState<OSItem[]>([]);
  const [viewOsItemsLoading, setViewOsItemsLoading] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean;
    osId: string | null;
    osNumero: string;
    valorSugerido: number;
    nextStatus: string | null;
    saving: boolean;
  }>({ open: false, osId: null, osNumero: "", valorSugerido: 0, nextStatus: null, saving: false });

  // Wizard step
  const [wizardStep, setWizardStep] = useState(0);
  const WIZARD_STEPS = ["Cliente", "Equipamento", "Problema", "Revisão"];

  const [calcDialogOpen, setCalcDialogOpen] = useState(false);
  const [calcCalculando, setCalcCalculando] = useState(false);
  const [calcResult, setCalcResult] = useState<{
    distanciaKm: number;
    custoTotal: number;
    custoCombustivel: number;
    custoKm: number;
    litrosUsados: number;
    origemNome: string;
    destinoNome: string;
  } | null>(null);
  const [calcForm, setCalcForm] = useState({
    modoEntrada: "endereco" as "endereco" | "coordenadas",
    origem: "",
    destino: "",
    origemLat: "",
    origemLon: "",
    destinoLat: "",
    destinoLon: "",
    modoCalculo: "combustivel" as "combustivel" | "valor_km",
    precoLitro: "",
    consumoKm: "",
    valorKm: "",
  });

  const handleCalcRoute = async () => {
    if (!calcForm.origem || !calcForm.destino) { toast.error("Preencha origem e destino"); return; }
    setCalcCalculando(true);
    setCalcResult(null);
    try {
      let origemNome: string;
      let destinoNome: string;
      let origemLon: number;
      let origemLat: number;
      let destinoLon: number;
      let destinoLat: number;

      if (calcForm.modoEntrada === "coordenadas") {
        origemLat = parseFloat(calcForm.origemLat);
        origemLon = parseFloat(calcForm.origemLon);
        destinoLat = parseFloat(calcForm.destinoLat);
        destinoLon = parseFloat(calcForm.destinoLon);
        if (isNaN(origemLat) || isNaN(origemLon) || isNaN(destinoLat) || isNaN(destinoLon)) { toast.error("Coordenadas inválidas"); setCalcCalculando(false); return; }
        origemNome = `${calcForm.origemLat}, ${calcForm.origemLon}`;
        destinoNome = `${calcForm.destinoLat}, ${calcForm.destinoLon}`;
      } else {
        const [origRes, destRes] = await Promise.all([
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(calcForm.origem)}&limit=1`).then(r => r.json()),
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(calcForm.destino)}&limit=1`).then(r => r.json()),
        ]);
        if (!origRes.length || !destRes.length) { toast.error("Endereços não encontrados"); setCalcCalculando(false); return; }
        origemLat = parseFloat(origRes[0].lat);
        origemLon = parseFloat(origRes[0].lon);
        destinoLat = parseFloat(destRes[0].lat);
        destinoLon = parseFloat(destRes[0].lon);
        origemNome = origRes[0].display_name;
        destinoNome = destRes[0].display_name;
      }

      const routeRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${origemLon},${origemLat};${destinoLon},${destinoLat}?overview=false`);
      const routeData = await routeRes.json();
      if (!routeData.routes?.[0]) { toast.error("Não foi possível calcular a rota"); setCalcCalculando(false); return; }
      const distKm = Math.round(routeData.routes[0].distance / 1000);
      let custoTotal = 0;
      let custoComb = 0;
      let custoKm = 0;
      let litros = 0;
      if (calcForm.modoCalculo === "combustivel") {
        const precoL = parseFloat(calcForm.precoLitro);
        const consKm = parseFloat(calcForm.consumoKm);
        if (isNaN(precoL) || isNaN(consKm) || consKm <= 0) { toast.error("Preço/litro e consumo válidos"); setCalcCalculando(false); return; }
        litros = distKm / consKm;
        custoComb = litros * precoL;
        custoTotal = custoComb;
      } else {
        const vKm = parseFloat(calcForm.valorKm);
        if (isNaN(vKm) || vKm <= 0) { toast.error("Valor do km válido"); setCalcCalculando(false); return; }
        custoKm = distKm * vKm;
        custoTotal = custoKm;
      }
      setCalcResult({ distanciaKm: distKm, custoTotal: Math.round(custoTotal * 100) / 100, custoCombustivel: Math.round(custoComb * 100) / 100, custoKm: Math.round(custoKm * 100) / 100, litrosUsados: Math.round(litros * 100) / 100, origemNome, destinoNome });
      toast.success(`Rota: ${distKm} km | ${formatCurrency(custoTotal)}`);
    } catch { toast.error("Erro ao calcular rota"); } finally { setCalcCalculando(false); }
  };

  const handleApplyRoute = () => {
    if (!calcResult) return;
    const tag = `\n[ROTA: ${calcResult.origemNome} → ${calcResult.destinoNome} | ${calcResult.distanciaKm} km | ${formatCurrency(calcResult.custoTotal)}]`;
    setFormData(prev => ({ ...prev, observacoes: (prev.observacoes || "") + tag }));
    setCalcDialogOpen(false);
    setCalcResult(null);
    setDialogOpen(true);
  };

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
    deslocamento: false,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, isPlatformAdmin, orgLoading]);

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
      toast.error("Não foi possível carregar os itens/serviços desta OS: " + error.message);
      return [];
    }

    return mapDbItemsToOSItems(data as ItemOSRow[]);
  }, [organization?.id, isPlatformAdmin]);

  const getPendingRequiredChecklist = useCallback(async (osId: string, osOrgId?: string | null): Promise<string[]> => {
    const checklistClient = supabase as any;
    let query = checklistClient
      .from("os_checklist_itens")
      .select("marcado, item:checklist_equipamento_itens(label, obrigatorio)")
      .eq("ordem_servico_id", osId);
    const orgId = osOrgId || organization?.id;
    if (orgId && !isPlatformAdmin) query = query.eq("organization_id", orgId);
    const { data, error } = await query;
    if (error) return [];
    return ((data as any[]) || [])
      .filter(r => r?.item?.obrigatorio && !r.marcado)
      .map(r => r.item.label as string);
  }, [organization?.id, isPlatformAdmin]);

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
  const readOnlyOsMessage = "Seu perfil tem acesso de consulta ao módulo de OS, mas não pode criar ou alterar ordens de serviço.";

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

    setFormLoading(true);
    try {
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

      const { ciclos_carga_entrada, ciclos_carga_saida, deslocamento, ...restForm } = formData;
      let observacoesWithMobility = (restForm.observacoes || "")
        .replace(/\[MOBILIDADE:[\s\S]*?\]/g, "")
        .replace(/\[CUSTOM:[^\]]*\]/g, "")
        .replace(/\[ROTA:[\s\S]*?\]/g, "")
        .trim();

      const isConfiguredCategory = (configTipos || []).some(t => t.value === uiCategory);
      if (!isMobility && (uiCategory.startsWith("custom_") || isConfiguredCategory)) {
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

      if (deslocamento && calcResult) {
        const rotaTag = `[ROTA: ${calcResult.origemNome} → ${calcResult.destinoNome} | ${calcResult.distanciaKm} km | ${formatCurrency(calcResult.custoTotal)}]`;
        observacoesWithMobility = observacoesWithMobility ? `${observacoesWithMobility}\n${rotaTag}` : rotaTag;
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
        data_previsao: formData.data_previsao || null,
        diagnostico: formData.diagnostico || null,
        // Campos UUID nunca podem ir como string vazia (erro 22P02 no Postgres)
        tecnico_id: formData.tecnico_id || (editingOS ? (editingOS as any).tecnico_id || user.id : user.id),
        ciclos_carga_entrada: isBateria ? ciclos_carga_entrada || null : null,
        ciclos_carga_saida: isBateria ? ciclos_carga_saida || null : null,
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
      if (editingOS) {
        const { error } = await supabase.from("ordens_servico").update(osData).eq("id", editingOS.id);
        if (error) throw error;
        osId = editingOS.id;
        toast.success("OS atualizada com sucesso!");
      } else {
        const { data: insertedData, error } = await supabase.from("ordens_servico").insert({
          ...osData, numero: "", status: "recebido" as any,
        }).select("id, numero, cliente_id, tipo_equipamento, modelo_equipamento").single();
        if (error) throw error;
        osId = insertedData.id;
        toast.success(`OS ${insertedData?.numero} criada com sucesso!`);
        if (insertedData) {
          setLastCreatedOS(insertedData);
          setTermsDialogOpen(true);
        }
      }


      // Save OS items
      if (osId) {
        // Delete existing items for this OS
        const { error: deleteItemsError } = await supabase.from("itens_os").delete().eq("ordem_servico_id", osId);
        if (deleteItemsError) throw deleteItemsError;
        // Insert new items
        if (osItems.length > 0) {
          const itemsToInsert = osItems.map(item => ({
            ordem_servico_id: osId,
            tipo: item.tipo === "produto" ? "produto" : "servico",
            produto_id: item.tipo === "produto" && item.produto_id ? item.produto_id : null,
            servico_id: item.tipo === "servico" && item.servico_id ? item.servico_id : null,
            descricao: (item.descricao || "Item").trim(),
            quantidade: Math.max(1, Math.round(Number(item.quantidade) || 1)),
            valor_unitario: Number(item.valor_unitario) || 0,
            valor_total: Number(item.valor_total) || 0,
            organization_id: editingOS?.organization_id || organizationId,
          }));
const { error: itemsError } = await supabase.from("itens_os").insert(itemsToInsert);
          if (itemsError) {
            console.error("Erro ao salvar itens:", itemsError);
            throw new Error(`A OS foi salva, mas os itens não: ${itemsError.message}`);
          }
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
      data_previsao: os.data_previsao || "",
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
    });
    setOsItems(await fetchOSItems(os.id, os.organization_id));
    setConfigCheckbox(await loadChecklistResponses(os.id, os.organization_id));
    setWizardStep(0);
    setDialogOpen(true);
  };

  const handleView = async (os: OrdemServico) => {
    setViewingOS(os);
    setViewOsItems([]);
    setViewOsItemsLoading(true);
    setViewConfigChecklist([]);
    setViewDialogOpen(true);
    try {
      const items = await fetchOSItems(os.id, os.organization_id);
      setViewOsItems(items);
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
    } finally {
      setViewOsItemsLoading(false);
    }
  };

  const computeSuggestedValue = async (os: OrdemServico): Promise<number> => {
    if (os.valor_final && os.valor_final > 0) return Number(os.valor_final);
    if (os.valor_orcamento && os.valor_orcamento > 0) return Number(os.valor_orcamento);
    const items = await fetchOSItems(os.id, os.organization_id);
    const total = items.reduce((s, i) => s + (i.valor_total || 0), 0);
    return Math.max(0, total - (Number((os as any).desconto) || 0));
  };

  const openPaymentForOS = async (os: OrdemServico, nextStatus: string | null) => {
    const sugerido = await computeSuggestedValue(os);
    setPaymentDialog({
      open: true,
      osId: os.id,
      osNumero: os.numero,
      valorSugerido: sugerido,
      nextStatus,
      saving: false,
    });
  };

  const applyStatusUpdate = async (osId: string, newStatus: string) => {
    if (!canEdit) throw new Error(readOnlyOsMessage);
    if (LOCK_CLOSED_STATUSES.has(newStatus)) {
      const os = ordens.find(o => o.id === osId);
      const pending = await getPendingRequiredChecklist(osId, os?.organization_id || organization?.id);
      if (pending.length > 0) {
        throw new Error(`Itens obrigatórios pendentes no checklist de revisão: ${pending.slice(0, 3).join("; ")}${pending.length > 3 ? "…" : ""}.`);
      }
    }
    const updateData: any = { status: newStatus };
    if (newStatus === "pronto_retirada" || newStatus === "concluida") updateData.data_conclusao = new Date().toISOString();
    if (newStatus === "entregue") updateData.data_entrega = new Date().toISOString();
    const { error } = await supabase.from("ordens_servico").update(updateData).eq("id", osId);
    if (error) throw error;
    try {
      await supabase.rpc('calculate_os_commission' as any, { _os_id: osId });
    } catch (err: any) {
      console.error("Erro ao recalcular comissão na mudança de status:", err);
    }
    if (user) {
      await supabase.from("os_historico").insert({
        ordem_servico_id: osId,
        usuario_id: user.id,
        acao: `Status alterado para ${getStatusLabel(newStatus)}`,
      }).then(() => {});
    }
  };

  const handleStatusChange = async (osId: string, newStatus: string): Promise<boolean> => {
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
    // Intercept "entregue" to require payment confirmation
    if (newStatus === "entregue") {
      const os = ordens.find(o => o.id === osId);
      if (os) {
        // Check if a financeiro entry already exists for this OS
        const { data: existing } = await supabase
          .from("financeiro")
          .select("id")
          .eq("ordem_servico_id", osId)
          .limit(1);
        if (existing && existing.length > 0) {
          // Already recorded; just advance status
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
        await openPaymentForOS(os, newStatus);
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

  const handleConfirmPayment = async (data: PaymentData) => {
    if (!paymentDialog.osId) return;
    if (!canEdit) { toast.error(readOnlyOsMessage); return; }
    setPaymentDialog(p => ({ ...p, saving: true }));
    try {
      const os = ordens.find(o => o.id === paymentDialog.osId);
      const orgId = os?.organization_id || organization?.id;
      if (!orgId) throw new Error("Organização não identificada.");

      // 1) Insert financeiro
      const { error: finErr } = await supabase.from("financeiro").insert({
        organization_id: orgId,
        ordem_servico_id: paymentDialog.osId,
        usuario_id: user?.id || null,
        tipo: "receita" as any,
        categoria: "Serviços",
        descricao: `Recebimento OS ${paymentDialog.osNumero}`,
        valor: data.valor,
        data_transacao: new Date().toISOString().slice(0, 10),
        observacoes: [`Forma: ${data.forma_pagamento}`, data.observacoes].filter(Boolean).join(" | "),
      });
      if (finErr) throw finErr;

      // 2) Update OS with valor_final + status
      const updateData: any = { valor_final: data.valor };
      if (paymentDialog.nextStatus) {
        updateData.status = paymentDialog.nextStatus;
        if (paymentDialog.nextStatus === "entregue") updateData.data_entrega = new Date().toISOString();
        if (paymentDialog.nextStatus === "pronto_retirada" || paymentDialog.nextStatus === "concluida")
          updateData.data_conclusao = new Date().toISOString();
      }
      const { error: osErr } = await supabase
        .from("ordens_servico")
        .update(updateData)
        .eq("id", paymentDialog.osId);
      if (osErr) throw osErr;

      if (user && paymentDialog.nextStatus) {
        await supabase.from("os_historico").insert({
          ordem_servico_id: paymentDialog.osId,
          usuario_id: user.id,
          acao: `Recebimento registrado (${data.forma_pagamento}) e status alterado para ${getStatusLabel(paymentDialog.nextStatus)}`,
        }).then(() => {});
      }

      toast.success("Recebimento registrado no Financeiro!");
      setPaymentDialog({ open: false, osId: null, osNumero: "", valorSugerido: 0, nextStatus: null, saving: false });
      fetchData();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
      setPaymentDialog(p => ({ ...p, saving: false }));
    }
  };

  const handleSkipPayment = async () => {
    if (!paymentDialog.osId || !paymentDialog.nextStatus) {
      setPaymentDialog({ open: false, osId: null, osNumero: "", valorSugerido: 0, nextStatus: null, saving: false });
      return;
    }
    setPaymentDialog(p => ({ ...p, saving: true }));
    try {
      await applyStatusUpdate(paymentDialog.osId, paymentDialog.nextStatus);
      toast.success(`Status atualizado sem cobrança.`);
      setPaymentDialog({ open: false, osId: null, osNumero: "", valorSugerido: 0, nextStatus: null, saving: false });
      fetchData();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
      setPaymentDialog(p => ({ ...p, saving: false }));
    }
  };

  const handleRegisterPaymentForExisting = async (os: OrdemServico) => {
    const { data: existing } = await supabase
      .from("financeiro")
      .select("id")
      .eq("ordem_servico_id", os.id)
      .limit(1);
    if (existing && existing.length > 0) {
      toast.info("Esta OS já possui um recebimento registrado no Financeiro.");
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
      title: `Deletar OS ${os.numero}?`,
      description: "Tem certeza que deseja deletar esta Ordem de Serviço? Esta ação não poderá ser desfeita e removerá itens, histórico e anexos vinculados.",
      variant: "destructive",
      confirmText: "Sim, deletar OS",
    });
    if (!ok) return;
    try {
      const { error } = await supabase.from("ordens_servico").delete().eq("id", os.id);
      if (error) throw error;
      toast.success(`OS ${os.numero} deletada.`);
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

    const t = toast.loading("Carregando itens da OS para o PDF...");
    try {
      const itemsForPdf = await fetchOSItems(viewingOS.id, viewingOS.organization_id);
      setViewOsItems(itemsForPdf);
      const empresaForPdf = { ...empresa, nome_empresa: empresa.nome_empresa || organization?.name || "Nome da Empresa" };
      console.log("Dados da Empresa para PDF:", empresaForPdf);
      // Look up técnico name from tecnicos array
      const técnico = tecnicos.find(t => t.id === viewingOS.tecnico_id);
      const html = generateOSPDF(viewingOS, itemsForPdf, empresaForPdf, técnico?.nome);
      printWindow.document.write(html);
      printWindow.document.close();
    } finally {
      toast.dismiss(t);
    }
  };



  const handleWhatsAppTemplate = (template: keyof typeof whatsappTemplates) => {
    if (!viewingOS) return;
    const cliente = clientes.find(c => c.id === viewingOS.cliente_id);
    if (!cliente?.telefone) { toast.error("Cliente sem telefone cadastrado"); return; }
    const osData: WhatsAppOS = {
      numero: viewingOS.numero,
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
    return `Olá, ${nome}! 👋\nAqui é da ${nomeEmpresa}.\n\nSua Ordem de Serviço foi gerada com sucesso!\n\n🛠️ OS: ${os.numero}\n📱 Equipamento: ${tipo} - ${marca}\n🔧 Defeito Relatado: ${defeito}\n\nSegue em anexo o PDF detalhado com o diagnóstico, valores, prazos e nossos termos de serviço para sua conferência.\n\nQualquer dúvida, estamos à disposição! 🔧`;
  };

  const shareOsAsPdf = async (os: any, cliente: any) => {
    if (!cliente?.telefone) { toast.error("Cliente sem telefone cadastrado"); return; }
    const t = toast.loading("Gerando PDF da OS...");
    try {
      const itemsForPdf = await fetchOSItems(os.id, os.organization_id);
      if (viewingOS?.id === os.id) setViewOsItems(itemsForPdf);
      const osComCliente = { ...os, clientes: os.clientes || { nome: cliente.nome, telefone: cliente.telefone } };
      const empresaForPdf = { ...empresa, nome_empresa: empresa.nome_empresa || organization?.name || "Nome da Empresa" };
      console.log("Dados da Empresa para PDF (share):", empresaForPdf);
      // Look up técnico name from tecnicos array
      const técnico = tecnicos.find(t => t.id === os.tecnico_id);
      const html = generateOSPDF(osComCliente, itemsForPdf, empresaForPdf, técnico?.nome);
      const { htmlToPdfBlob, sharePdfOnWhatsApp } = await import("@/lib/os-pdf-share");
      const filename = `OS_${os.numero}.pdf`;
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
      const dueDateStr = dueDate.toISOString().split("T")[0];
      const { data: result, error } = await supabase.functions.invoke('asaas', {
        body: {
          action: 'create_payment',
          customer: asaasId, billingType: "PIX", value: viewingOS.valor_orcamento, dueDate: dueDateStr,
          description: `OS ${viewingOS.numero}`, externalReference: viewingOS.numero,
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
        const texto = `Olá, *${viewingOS.clientes?.nome}*! 👋\n\n*${empresa.nome_empresa || "LivreOS"}*\n\n📋 *OS:* ${viewingOS.numero}\n💰 *Valor:* ${fmtCurLocal(viewingOS.valor_orcamento)}\n📅 *Vencimento:* ${new Date(dueDateStr + "T00:00:00").toLocaleDateString("pt-BR")}\n⚡ Pix${invoiceLink ? `\n\n🔗 ${invoiceLink}` : ""}`;
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
    setFormData({ cliente_id: "", tipo_equipamento: "bateria", marca: "", modelo_equipamento: "", numero_serie: "", descricao_problema: "", diagnostico: "", prioridade: "media", data_previsao: "", desconto: 0, valor_orcamento: 0, observacoes: "", tecnico_id: "", checklist_bateria: false, checklist_carregador: false, checklist_controle: false, checklist_cabos: false, checklist_helices: false, checklist_outros: false, condicao_visual: "", ciclos_carga_entrada: 0, ciclos_carga_saida: 0, deslocamento: false });
    setUiCategory("bateria");
    resetMobilityData();
    setConfigCheckbox({});
    setViewConfigChecklist([]);
    setEditingOS(null);
    setWizardStep(0);
    setOsItems([]);
    setCalcResult(null);
    setCalcDialogOpen(false);
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
    return matchSearch && matchStatus;
  });

  const stats = {
    recebidas: ordens.filter(os => os.status === "recebido" || os.status === "aberta").length,
    emReparo: ordens.filter(os => ["em_reparo", "em_andamento", "em_testes", "aprovado"].includes(os.status)).length,
    aguardando: ordens.filter(os => ["aguardando_diagnostico", "aguardando_aprovacao", "aguardando_peca"].includes(os.status)).length,
    prontas: ordens.filter(os => ["pronto_retirada", "concluida", "entregue"].includes(os.status)).length,
  };

  const STATUS_FILTERS = [
    { key: "todas", label: "Todas" },
    { key: "recebido", label: "Recebidas" },
    { key: "em_reparo", label: "Em Reparo" },
    { key: "aguardando_aprovacao", label: "Aguardando" },
    { key: "pronto_retirada", label: "Prontas" },
    { key: "entregue", label: "Entregues" },
    { key: "cancelada", label: "Canceladas" },
  ];

  // ======= RENDER =======
  return (
    <MainLayout>
      <div className="space-y-4" data-tour="os-page">
        {/* Header */}
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
            <Button size="sm" className="gradient-primary shadow-soft" onClick={() => {
              if (!canEdit) { toast.error(readOnlyOsMessage); return; }
              if (!canCreateOS) { setShowUpgrade(true); return; }
              resetForm(); setDialogOpen(true);
            }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />Nova OS
            </Button>
            {osLimit !== -1 && (
              <span className="text-[10px] text-muted-foreground">
                {osUsed}/{osLimit} OS este mês
              </span>
            )}
          </div>
        </div>
        <UpgradePlanModal open={showUpgrade} onOpenChange={setShowUpgrade} reason="os" currentPlan={plan} />

        {/* Stats */}
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
          {[
            { label: "Recebidas", value: stats.recebidas, icon: Clock, color: "text-blue-500" },
            { label: "Em Reparo", value: stats.emReparo, icon: Wrench, color: "text-amber-500" },
            { label: "Aguardando", value: stats.aguardando, icon: Clock, color: "text-orange-500" },
            { label: "Prontas", value: stats.prontas, icon: CheckCircle2, color: "text-primary" },
          ].map(s => (
            <Card key={s.label} className="shadow-soft border-border/50">
              <CardContent className="p-3 text-center">
                <s.icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por número, cliente ou defeito..." className="pl-9 h-9 text-xs bg-muted/30 border-border/50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        {/* OS List */}
        <Card className="shadow-soft border-border/50">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredOrdens.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={statusFilter !== "todas" ? "Nenhuma OS com este filtro" : "Nenhuma OS encontrada"}
                description={statusFilter !== "todas" ? "Tente um status diferente ou limpe a busca." : "Crie uma nova ordem de serviço para começar."}
                actionLabel={statusFilter !== "todas" ? "Limpar filtros" : "Criar primeira OS"}
                onAction={() => statusFilter !== "todas" ? setStatusFilter("todas") : setDialogOpen(true)}
              />
            ) : (
              <div className="divide-y divide-border/30">
                {filteredOrdens.map((os) => (
                  <div key={os.id} className="p-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleView(os)}>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-primary text-sm">{os.numero}</span>
                          {getStatusBadge(os.status)}
                          {os.prioridade === "alta" && <Badge variant="destructive" className="text-[9px]">Alta</Badge>}
                        </div>
                        <p className="text-sm font-medium truncate">{os.clientes?.nome || "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {getTypeDisplayLabel(os, orgSegmentos, orgCustomTypes)}
                          {os.modelo_equipamento ? ` · ${os.modelo_equipamento}` : ""}
                          <span className="ml-2">{formatDate(os.data_entrada)}</span>
                        </p>
                        <p className="text-sm font-bold text-primary mt-1">{formatCurrency((os as any).valor_orcamento)}</p>

                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Quick advance button */}
                        {getNextStatus(os.status) && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title={`Avançar para ${getStatusLabel(getNextStatus(os.status)!)}`}
                            onClick={() => handleAdvanceStatus(os)}
                          >
                            <ChevronRight className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        {/* Context menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleView(os)}><Eye className="mr-2 h-3.5 w-3.5" />Ver detalhes</DropdownMenuItem>
                            {canEdit && (
                              <DropdownMenuItem onClick={() => handleEdit(os)}><Edit className="mr-2 h-3.5 w-3.5" />Editar OS</DropdownMenuItem>
                            )}
                            {canEdit && getNextStatus(os.status) && (
                              <DropdownMenuItem onClick={() => handleAdvanceStatus(os)}>
                                <ArrowRight className="mr-2 h-3.5 w-3.5" />Avançar para {getStatusLabel(getNextStatus(os.status)!)}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setViewingOS(os); handleWhatsAppTemplate("statusUpdate"); }}>
                              <MessageCircle className="mr-2 h-3.5 w-3.5" />Enviar WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setViewingOS(os); setTimeout(handlePrintOS, 100); }}>
                              <Printer className="mr-2 h-3.5 w-3.5" />Imprimir OS
                            </DropdownMenuItem>
                            {canEdit && (
                              <DropdownMenuItem onClick={() => handleRegisterPaymentForExisting(os)}>
                                <CreditCard className="mr-2 h-3.5 w-3.5" />Registrar Recebimento
                              </DropdownMenuItem>
                            )}
                            {isAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDeleteOS(os)} className="text-destructive focus:text-destructive">
                                  <Trash2 className="mr-2 h-3.5 w-3.5" />Deletar OS
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== OS FORM DIALOG (single-scroll) ===== */}
        <Dialog open={dialogOpen} onOpenChange={handleOSDialogOpenChange}>
          <DialogContent
            className="max-w-2xl w-[calc(100vw-1rem)] sm:w-full h-[95dvh] sm:h-[90dvh] p-0 flex flex-col overflow-hidden"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader className="p-4 border-b shrink-0">
              <DialogTitle>{editingOS ? `Editar OS ${editingOS.numero}` : "Nova Ordem de Serviço"}</DialogTitle>
              <DialogDescription className="text-xs">
                Preencha os dados abaixo. Você pode salvar a qualquer momento.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
              className="flex-1 overflow-y-auto p-4 space-y-4"
              style={{ paddingBottom: "140px" }}
            >
              {!canEdit && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {readOnlyOsMessage}
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
                        {tecnicos.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
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
                  <Separator />
                  <OSItemsSection items={osItems} onChange={setOsItems} />
                </CardContent>
              </Card>

              {/* Observações + Resumo financeiro */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">4. Observações e Resumo</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5"><Label className="text-xs">Observações Técnicas / Internas</Label><Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={3} /></div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="deslocamento" checked={formData.deslocamento} onCheckedChange={(c) => setFormData({ ...formData, deslocamento: !!c })} />
                    <Label htmlFor="deslocamento" className="text-xs cursor-pointer flex items-center gap-1"><Calculator className="h-3 w-3" />Houve deslocamento?</Label>
                  </div>
                  {formData.deslocamento && !calcResult && (
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => { setCalcForm({ modoEntrada: "endereco", origem: "", destino: "", origemLat: "", origemLon: "", destinoLat: "", destinoLon: "", modoCalculo: "combustivel", precoLitro: "", consumoKm: "", valorKm: "" }); setCalcDialogOpen(true); }}>
                      <Navigation className="mr-2 h-3.5 w-3.5" />Calcular Rota de Deslocamento
                    </Button>
                  )}
                  {formData.deslocamento && calcResult && (
                    <div className="flex items-center gap-2 p-2 bg-success/5 border border-success/20 rounded-lg">
                      <Check className="h-4 w-4 text-success" />
                      <span className="text-xs text-success">{calcResult.distanciaKm} km | {formatCurrency(calcResult.custoTotal)}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setCalcResult(null)} className="ml-auto h-6">Remover</Button>
                    </div>
                  )}
                  <Separator />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs">Desconto (R$)</Label><NumberInput step="0.01" min="0" value={formData.desconto} onChange={(v) => setFormData({ ...formData, desconto: v })} className="h-9" placeholder="0,00" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Total Geral da OS</Label><Input type="text" value={formatCurrency(totalOrcamento)} readOnly disabled className="h-9 font-bold text-primary" /></div>
                  </div>
                </CardContent>
              </Card>
            </form>

            {/* Sticky bottom save bar */}
            <div className="border-t bg-background p-3 shrink-0 flex items-center justify-between gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={requestCloseOSForm}>Cancelar</Button>
                {editingOS && isAdmin && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteOS(editingOS)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Deletar</span>
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] text-muted-foreground uppercase leading-none">Total</p>
                  <p className="text-sm font-bold text-primary leading-tight">{formatCurrency(totalOrcamento)}</p>
                </div>
                <Button type="button" size="lg" className="gradient-primary min-w-[140px]" disabled={formLoading || !canEdit} onClick={() => handleSubmit()}>
                  {formLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  {!canEdit ? "Somente leitura" : editingOS ? "Salvar Alterações" : "Criar OS"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Route Calculation Dialog */}
        <Dialog open={calcDialogOpen} onOpenChange={(open) => { setCalcDialogOpen(open); if (!open) setCalcResult(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle><Calculator className="inline h-5 w-5 mr-2 text-primary" />Calculadora de Rota</DialogTitle>
              <DialogDescription>Informe origem, destino e parâmetros de custo para calcular o valor do deslocamento</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Modo de entrada */}
              <div className="space-y-2">
                <Label>Modo de entrada</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={calcForm.modoEntrada === "endereco" ? "default" : "outline"} className="flex-1" onClick={() => setCalcForm(prev => ({ ...prev, modoEntrada: "endereco" }))}>
                    <MapPinned className="mr-2 h-3.5 w-3.5" />Endereço/Cidade
                  </Button>
                  <Button type="button" variant={calcForm.modoEntrada === "coordenadas" ? "default" : "outline"} className="flex-1" onClick={() => setCalcForm(prev => ({ ...prev, modoEntrada: "coordenadas" }))}>
                    <Crosshair className="mr-2 h-3.5 w-3.5" />Coordenadas
                  </Button>
                </div>
              </div>

              {/* Origem */}
              <div className="space-y-2">
                <Label>Origem *</Label>
                {calcForm.modoEntrada === "endereco" ? (
                  <Input value={calcForm.origem} onChange={(e) => setCalcForm(prev => ({ ...prev, origem: e.target.value }))} placeholder="Ex: Goiânia, GO ou endereço completo" />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Lat" value={calcForm.origemLat} onChange={(e) => setCalcForm(prev => ({ ...prev, origemLat: e.target.value }))} type="number" step="any" />
                    <Input placeholder="Lon" value={calcForm.origemLon} onChange={(e) => setCalcForm(prev => ({ ...prev, origemLon: e.target.value }))} type="number" step="any" />
                  </div>
                )}
              </div>

              {/* Destino */}
              <div className="space-y-2">
                <Label>Destino *</Label>
                {calcForm.modoEntrada === "endereco" ? (
                  <Input value={calcForm.destino} onChange={(e) => setCalcForm(prev => ({ ...prev, destino: e.target.value }))} placeholder="Ex: Rio Verde, GO ou endereço completo" />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Lat" value={calcForm.destinoLat} onChange={(e) => setCalcForm(prev => ({ ...prev, destinoLat: e.target.value }))} type="number" step="any" />
                    <Input placeholder="Lon" value={calcForm.destinoLon} onChange={(e) => setCalcForm(prev => ({ ...prev, destinoLon: e.target.value }))} type="number" step="any" />
                  </div>
                )}
              </div>

              <Separator />

              {/* Modo de cálculo */}
              <div className="space-y-2">
                <Label>Modo de cálculo</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={calcForm.modoCalculo === "combustivel" ? "default" : "outline"} className="flex-1" onClick={() => setCalcForm(prev => ({ ...prev, modoCalculo: "combustivel" }))}>
                    <Fuel className="mr-2 h-3.5 w-3.5" />Preço por Litro
                  </Button>
                  <Button type="button" variant={calcForm.modoCalculo === "valor_km" ? "default" : "outline"} className="flex-1" onClick={() => setCalcForm(prev => ({ ...prev, modoCalculo: "valor_km" }))}>
                    <Gauge className="mr-2 h-3.5 w-3.5" />Valor do Km
                  </Button>
                </div>
              </div>

              {calcForm.modoCalculo === "combustivel" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Preço do Litro (R$) *</Label>
                      <Input type="number" step="0.01" value={calcForm.precoLitro} onChange={(e) => setCalcForm(prev => ({ ...prev, precoLitro: e.target.value }))} placeholder="Ex: 5.80" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Consumo (km/l) *</Label>
                      <Input type="number" step="0.1" value={calcForm.consumoKm} onChange={(e) => setCalcForm(prev => ({ ...prev, consumoKm: e.target.value }))} placeholder="Ex: 10" required />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Fuel className="h-3 w-3" />Litros gastos = Distância ÷ Consumo × Preço do litro</p>
                </>
              )}

              {calcForm.modoCalculo === "valor_km" && (
                <div className="space-y-2">
                  <Label>Valor por Km Rodado (R$) *</Label>
                  <Input type="number" step="0.01" value={calcForm.valorKm} onChange={(e) => setCalcForm(prev => ({ ...prev, valorKm: e.target.value }))} placeholder="Ex: 3.50" required />
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Gauge className="h-3 w-3" />Custo total = Distância × Valor do km</p>
                </div>
              )}

              <Button type="button" className="w-full gradient-primary" onClick={handleCalcRoute} disabled={calcCalculando}>
                {calcCalculando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}Calcular Rota
              </Button>

              {/* Resultado */}
              {calcResult && (
                <Card className="border-success/30 bg-success/5">
                  <CardHeader>
                    <CardTitle className="text-sm text-success flex items-center gap-2"><Route className="h-4 w-4" />Resultado da Rota</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div><p className="text-xs text-muted-foreground">Distância</p><p className="font-bold text-lg">{calcResult.distanciaKm} km</p></div>
                      <div><p className="text-xs text-muted-foreground">Custo Total</p><p className="font-bold text-lg text-success">{formatCurrency(calcResult.custoTotal)}</p></div>
                    </div>
                    {calcForm.modoCalculo === "combustivel" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div><p className="text-xs text-muted-foreground">Litros usados</p><p>{calcResult.litrosUsados} L</p></div>
                        <div><p className="text-xs text-muted-foreground">Custo combustível</p><p>{formatCurrency(calcResult.custoCombustivel)}</p></div>
                      </div>
                    )}
                    {calcForm.modoCalculo === "valor_km" && (
                      <div><p className="text-xs text-muted-foreground">Custo por km</p><p>{formatCurrency(calcResult.custoKm)}</p></div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button type="button" size="sm" className="flex-1" onClick={handleApplyRoute}>
                        <Check className="mr-2 h-3.5 w-3.5" />Usar na OS
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => { setCalcResult(null); setCalcDialogOpen(false); }}>Fechar</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* View OS Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl w-[95vw] sm:w-[90vw] h-[90vh] sm:h-[80vh] flex flex-col p-0 overflow-hidden rounded-xl">
            <DialogHeader className="p-4 sm:p-6 border-b shrink-0">

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    OS {viewingOS?.numero}
                    {viewingOS && <Badge className={STATUS_CONFIG[viewingOS.status]?.variant === 'destructive' ? 'bg-destructive' : 'bg-primary'}>{getStatusLabel(viewingOS.status)}</Badge>}
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
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

              {viewingOS && (
              <div className="space-y-4">
                {/* Status Pipeline */}
                <StatusPipeline
                  currentStatus={viewingOS.status}
                  onStatusChange={async (s) => {
                    const ok = await handleStatusChange(viewingOS.id, s);
                    if (ok) setViewingOS({ ...viewingOS, status: s as any });
                  }}
                />

                {/* Terms banner */}
                <div className="rounded-md bg-muted/30 border border-border/50 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
                  <FileText className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                  <span>Ao deixar seu equipamento, você concorda com nossos <button className="underline text-primary font-medium" onClick={() => { const t = empresa.termos_servico; if (t) { const w = window.open("", "_blank"); if (w) { w.document.write(`<pre style="font-family:sans-serif;padding:40px;white-space:pre-wrap;max-width:700px;margin:0 auto">${t}</pre>`); w.document.close(); } } else { toast.info("Termos não configurados."); } }}>termos de serviço</button>.</span>
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
                            <p className="text-xs text-muted-foreground uppercase font-medium">Total da OS</p>
                            <p className="text-base font-bold text-primary">{formatCurrency(viewItemsTotal > 0 ? viewItemsTotal - ((viewingOS as any).desconto || 0) : viewingOS.valor_orcamento)}</p>
                          </div>
                        </div>
                      </div>
                      <Separator />
                      {/* Items da OS */}
                      {viewOsItemsLoading ? (
                        <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando itens, peças e serviços...
                        </div>
                      ) : viewOsItems.length > 0 ? (
                        <OSItemsSection items={viewOsItems} onChange={() => {}} disabled />
                      ) : (
                        <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                          Nenhum item, peça ou serviço encontrado para esta OS.
                        </div>
                      )}
                      <Separator />
                      <div className="grid grid-cols-2 gap-3">
                        <div><p className="text-[10px] text-muted-foreground">Entrada</p><p className="text-sm">{formatDate(viewingOS.data_entrada)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Previsão</p><p className="text-sm">{formatDate(viewingOS.data_previsao)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Conclusão</p><p className="text-sm">{formatDate(viewingOS.data_conclusao)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Entrega</p><p className="text-sm">{formatDate(viewingOS.data_entrega)}</p></div>
                      </div>
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
          {viewingOS && viewingOS.status !== "entregue" && viewingOS.status !== "cancelada" && (
            <div className="p-4 border-t bg-muted/30 shrink-0">
              <Button className="w-full gradient-primary" onClick={() => handleAdvanceStatus(viewingOS)}>
                Avançar para {getStatusLabel(getNextStatus(viewingOS.status) || "")}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

        {/* Terms Dialog */}
        <Dialog open={termsDialogOpen} onOpenChange={(open) => { setTermsDialogOpen(open); if (!open) setLastCreatedOS(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" />OS Criada!</DialogTitle>
              <DialogDescription>Enviar termos via WhatsApp?</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {lastCreatedOS && (
                <div className="p-3 rounded-md bg-muted/30 border text-sm space-y-1">
                  <p><span className="text-muted-foreground">OS:</span> <span className="font-bold text-primary">{lastCreatedOS.numero}</span></p>
                  <p><span className="text-muted-foreground">Cliente:</span> {clientes.find(c => c.id === lastCreatedOS.cliente_id)?.nome || "-"}</p>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setTermsDialogOpen(false); setLastCreatedOS(null); }}>Pular</Button>
                <Button size="sm" onClick={handleSendTermsWhatsApp} className="bg-[hsl(142,72%,37%)] hover:bg-[hsl(142,72%,32%)] text-white">
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" />Enviar
                </Button>
              </div>
            </div>
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
          valorSugerido={paymentDialog.valorSugerido}
          loading={paymentDialog.saving}
          onConfirm={handleConfirmPayment}
          onSkip={paymentDialog.nextStatus ? handleSkipPayment : undefined}
          title={paymentDialog.nextStatus === "entregue" ? "Confirmar Entrega e Recebimento" : "Registrar Recebimento"}
        />

      </div>
    </MainLayout>
  );
}
