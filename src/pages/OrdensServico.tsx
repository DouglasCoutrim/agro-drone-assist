import { useState, useEffect } from "react";
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
import { Plus, Search, Edit, FileText, Loader2, Eye, MessageCircle, Download, UserPlus, CreditCard, Clock, Wrench, CheckCircle2, ChevronRight, MoreVertical, ArrowRight, Trash2, Printer } from "lucide-react";
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

type OrdemServico = Tables<"ordens_servico"> & { clientes: { nome: string; telefone?: string } | null };
type Cliente = Tables<"clientes">;

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
const mapCategoryToDbEnum = (uiCategory: string): string => MOBILITY_CATEGORIES.includes(uiCategory) ? "outro" : uiCategory;
const detectUiCategory = (os: any): string => {
  const match = (os.observacoes || "").match(/\[MOBILIDADE:(\w+)/);
  return match ? match[1] : os.tipo_equipamento;
};

export default function OrdensServico() {
  const { user } = useAuth();
  const { config: empresa } = useEmpresaConfig();
  const { tecnicos } = useTeamMembers();
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

  // Wizard step
  const [wizardStep, setWizardStep] = useState(0);
  const WIZARD_STEPS = ["Cliente", "Equipamento", "Problema", "Revisão"];

  const [uiCategory, setUiCategory] = useState("bateria");

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
    custo_pecas: 0,
    custo_mao_obra: 0,
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
  });

  const [mobilityData, setMobilityData] = useState({
    voltagem: "", capacidade_bateria: "", odometro: "",
    chave_ignicao: false, carregador_entregue: false,
    check_display: false, check_acelerador: false, check_freios: false,
    check_pneus: false, check_controladora: false, check_iluminacao: false, check_carenagem: false,
  });

  const isMobility = MOBILITY_CATEGORIES.includes(uiCategory);
  const isBateria = uiCategory === "bateria" || formData.modelo_equipamento?.toLowerCase().includes("bateria");
  const itemsTotal = osItems.reduce((s, i) => s + (i.valor_total || 0), 0);
  const totalOrcamento = Math.max(0, itemsTotal - (formData.desconto || 0));
  const viewItemsTotal = viewOsItems.reduce((s, i) => s + (i.valor_total || 0), 0);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [ordensRes, clientesRes] = await Promise.all([
        supabase.from("ordens_servico").select("*, clientes(nome, telefone)").order("created_at", { ascending: false }),
        supabase.from("clientes").select("*").order("nome"),
      ]);
      if (ordensRes.error) throw ordensRes.error;
      if (clientesRes.error) throw clientesRes.error;
      setOrdens(ordensRes.data || []);
      setClientes(clientesRes.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const clienteOptions: SmartSelectOption[] = clientes.map(c => ({
    id: c.id,
    label: c.nome,
    sublabel: c.telefone + (c.cpf_cnpj ? ` · ${c.cpf_cnpj}` : ""),
  }));

  const selectedCliente = clientes.find(c => c.id === formData.cliente_id);

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
    if (!formData.cliente_id) { toast.error("Selecione um cliente"); return; }
    if (!formData.descricao_problema) { toast.error("Descreva o defeito"); return; }

    setFormLoading(true);
    try {
      const { ciclos_carga_entrada, ciclos_carga_saida, ...restForm } = formData;
      let observacoesWithMobility = (restForm.observacoes || "").replace(/\[MOBILIDADE:[\s\S]*?\]/g, "").trim();

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

      const osData: any = {
        ...restForm,
        tipo_equipamento: mapCategoryToDbEnum(uiCategory),
        observacoes: observacoesWithMobility || null,
        valor_orcamento: totalOrcamento || null,
        data_previsao: formData.data_previsao || null,
        diagnostico: formData.diagnostico || null,
        ciclos_carga_entrada: isBateria ? ciclos_carga_entrada || null : null,
        ciclos_carga_saida: isBateria ? ciclos_carga_saida || null : null,
      };

      let osId: string;
      if (editingOS) {
        const { error } = await supabase.from("ordens_servico").update(osData).eq("id", editingOS.id);
        if (error) throw error;
        osId = editingOS.id;
        toast.success("OS atualizada com sucesso!");
      } else {
        const { data: insertedData, error } = await supabase.from("ordens_servico").insert({
          ...osData, numero: "", tecnico_id: formData.tecnico_id || user.id, status: "recebido" as any,
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
        await supabase.from("itens_os").delete().eq("ordem_servico_id", osId);
        // Insert new items
        if (osItems.length > 0) {
          const itemsToInsert = osItems.map(item => ({
            ordem_servico_id: osId,
            tipo: item.tipo,
            produto_id: item.produto_id || null,
            servico_id: item.servico_id || null,
            descricao: item.descricao,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            valor_total: item.valor_total,
            organization_id: osData.organization_id || null,
          }));
          const { error: itemsError } = await supabase.from("itens_os").insert(itemsToInsert);
          if (itemsError) console.error("Erro ao salvar itens:", itemsError);
        }
      }
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (os: OrdemServico) => {
    setEditingOS(os);
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
    const cleanObs = obs.replace(/\[MOBILIDADE:[\s\S]*?\]/g, "").trim();
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
      custo_pecas: (os as any).custo_pecas || 0,
      custo_mao_obra: (os as any).custo_mao_obra || 0,
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
    // Load items for this OS
    supabase.from("itens_os").select("*").eq("ordem_servico_id", os.id).then(({ data }) => {
      setOsItems((data || []).map((d: any) => ({
        id: d.id, tipo: d.tipo, produto_id: d.produto_id, servico_id: d.servico_id,
        descricao: d.descricao, quantidade: d.quantidade, valor_unitario: d.valor_unitario, valor_total: d.valor_total,
      })));
    });
    setWizardStep(0);
    setDialogOpen(true);
  };

  const handleView = (os: OrdemServico) => {
    setViewingOS(os);
    setViewDialogOpen(true);
    // Load items for view
    supabase.from("itens_os").select("*").eq("ordem_servico_id", os.id).then(({ data }) => {
      setViewOsItems((data || []).map((d: any) => ({
        id: d.id, tipo: d.tipo, produto_id: d.produto_id, servico_id: d.servico_id,
        descricao: d.descricao, quantidade: d.quantidade, valor_unitario: d.valor_unitario, valor_total: d.valor_total,
      })));
    });
  };

  const handleStatusChange = async (osId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "pronto_retirada" || newStatus === "concluida") updateData.data_conclusao = new Date().toISOString();
      if (newStatus === "entregue") updateData.data_entrega = new Date().toISOString();
      const { error } = await supabase.from("ordens_servico").update(updateData).eq("id", osId);
      if (error) throw error;
      toast.success(`Status atualizado para "${getStatusLabel(newStatus)}"`);

      // Log to historico
      if (user) {
        await supabase.from("os_historico").insert({
          ordem_servico_id: osId,
          usuario_id: user.id,
          acao: `Status alterado para ${getStatusLabel(newStatus)}`,
        }).then(() => {});
      }

      fetchData();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleAdvanceStatus = (os: OrdemServico) => {
    const next = getNextStatus(os.status);
    if (next) handleStatusChange(os.id, next);
  };

  const handlePrintOS = () => {
    if (!viewingOS) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Popup bloqueado. Permita popups para imprimir."); return; }
    const fmtCur = (v: number | null) => formatCurrency(v);
    const fmtDt = (d: string | null) => formatDate(d);
    const os = viewingOS as any;
    const obsText = viewingOS.observacoes || "";
    const mobilityMatch = obsText.match(/\[MOBILIDADE:(\w+)\s*\|\s*Voltagem:(.*?)\s*\|\s*Bateria:(.*?)Ah\s*\|\s*Odômetro:(.*?)km\s*\|\s*Chave:(.*?)\s*\|\s*Carregador:(.*?)\s*\|\s*Checklist:(.*?)\]/);
    const hasMobility = !!mobilityMatch;
    const cleanObs = obsText.replace(/\[MOBILIDADE:[\s\S]*?\]/g, "").trim();
    const mobilityCategory = mobilityMatch ? mobilityMatch[1] : "";
    const displayType = TIPO_EQUIPAMENTO[mobilityCategory] || TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento] || viewingOS.tipo_equipamento;

    const checklistItems: string[] = [];
    if (!hasMobility) {
      if (os.checklist_bateria) checklistItems.push("Bateria");
      if (os.checklist_carregador) checklistItems.push("Carregador");
      if (os.checklist_controle) checklistItems.push("Controle");
      if (os.checklist_cabos) checklistItems.push("Cabos");
      if (os.checklist_helices) checklistItems.push("Hélices");
      if (os.checklist_outros) checklistItems.push("Outros");
    }

    let mobilityHTML = "";
    if (hasMobility && mobilityMatch) {
      const mCheckItems = mobilityMatch[7] !== "Nenhum" ? mobilityMatch[7] : "";
      mobilityHTML = `<div class="section"><div class="section-title">⚡ Dados da Mobilidade Elétrica</div><div class="grid">
        <div class="field"><div class="field-label">Voltagem</div><div class="field-value">${mobilityMatch[2]}</div></div>
        <div class="field"><div class="field-label">Capacidade Bateria</div><div class="field-value">${mobilityMatch[3]}Ah</div></div>
        <div class="field"><div class="field-label">Odômetro</div><div class="field-value">${mobilityMatch[4]}km</div></div>
        <div class="field"><div class="field-label">Chave Ignição</div><div class="field-value">${mobilityMatch[5]}</div></div>
        <div class="field"><div class="field-label">Carregador</div><div class="field-value">${mobilityMatch[6]}</div></div>
        ${mCheckItems ? `<div class="field full-width"><div class="field-label">Checklist</div><div class="field-value">${mCheckItems.replace(/,/g, ", ")}</div></div>` : ""}
      </div></div>`;
    }

    printWindow.document.write(`<!DOCTYPE html><html><head><title>OS ${viewingOS.numero}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; max-width: 210mm; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #16a34a; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { font-size: 24px; color: #16a34a; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 14px; font-weight: bold; color: #16a34a; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 12px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
        .field { margin-bottom: 8px; }
        .field-label { font-size: 11px; color: #888; text-transform: uppercase; }
        .field-value { font-size: 14px; font-weight: 500; }
        .full-width { grid-column: 1 / -1; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; background: #E8F5E9; color: #2E7D32; }
        .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 16px; display: flex; justify-content: space-between; }
        .signature { width: 200px; text-align: center; border-top: 1px solid #333; padding-top: 8px; font-size: 12px; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <div class="header">
        ${empresa.logo_url ? `<img src="${empresa.logo_url}" alt="Logo" style="max-height:50px" />` : ""}
        <div><h1>${empresa.nome_empresa || "LivreOS"}</h1><p style="font-size:12px;color:#888">${empresa.cnpj ? "CNPJ: " + empresa.cnpj : ""} ${empresa.telefone ? "| Tel: " + empresa.telefone : ""}</p></div>
        <div style="text-align:right"><div style="font-size:20px;font-weight:bold;">OS ${viewingOS.numero}</div><div class="status-badge">${getStatusLabel(viewingOS.status)}</div></div>
      </div>
      <div class="section"><div class="section-title">Cliente</div><div class="grid">
        <div class="field"><div class="field-label">Nome</div><div class="field-value">${viewingOS.clientes?.nome || "-"}</div></div>
      </div></div>
      <div class="section"><div class="section-title">Equipamento</div><div class="grid">
        <div class="field"><div class="field-label">Tipo</div><div class="field-value">${displayType}</div></div>
        <div class="field"><div class="field-label">Marca</div><div class="field-value">${os.marca || "-"}</div></div>
        <div class="field"><div class="field-label">Modelo</div><div class="field-value">${viewingOS.modelo_equipamento || "-"}</div></div>
        <div class="field"><div class="field-label">Nº Série</div><div class="field-value">${viewingOS.numero_serie || "-"}</div></div>
      </div></div>
      ${mobilityHTML}
      ${checklistItems.length > 0 ? `<div class="section"><div class="section-title">Checklist</div><div class="grid"><div class="field full-width"><div class="field-value">${checklistItems.join(", ")}</div></div>${os.condicao_visual ? `<div class="field full-width"><div class="field-label">Condição Visual</div><div class="field-value">${os.condicao_visual}</div></div>` : ""}</div></div>` : ""}
      <div class="section"><div class="section-title">Diagnóstico e Orçamento</div><div class="grid">
        <div class="field full-width"><div class="field-label">Defeito</div><div class="field-value">${viewingOS.descricao_problema}</div></div>
        <div class="field full-width"><div class="field-label">Diagnóstico</div><div class="field-value">${viewingOS.diagnostico || "-"}</div></div>
        <div class="field"><div class="field-label">Peças</div><div class="field-value">${fmtCur(os.custo_pecas)}</div></div>
        <div class="field"><div class="field-label">Mão de Obra</div><div class="field-value">${fmtCur(os.custo_mao_obra)}</div></div>
        <div class="field"><div class="field-label">Total</div><div class="field-value" style="font-weight:bold;color:#16a34a">${fmtCur(viewingOS.valor_orcamento)}</div></div>
      </div></div>
      <div class="section"><div class="section-title">Datas</div><div class="grid">
        <div class="field"><div class="field-label">Entrada</div><div class="field-value">${fmtDt(viewingOS.data_entrada)}</div></div>
        <div class="field"><div class="field-label">Previsão</div><div class="field-value">${fmtDt(viewingOS.data_previsao)}</div></div>
        <div class="field"><div class="field-label">Conclusão</div><div class="field-value">${fmtDt(viewingOS.data_conclusao)}</div></div>
        <div class="field"><div class="field-label">Entrega</div><div class="field-value">${fmtDt(viewingOS.data_entrega)}</div></div>
      </div></div>
      ${cleanObs ? `<div class="section"><div class="section-title">Observações</div><p style="font-size:14px">${cleanObs}</p></div>` : ""}
      <div class="footer"><div class="signature">Técnico Responsável</div><div class="signature">Cliente</div></div>
      ${getLegalTermsHTML()}
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const handleWhatsAppTemplate = (template: keyof typeof whatsappTemplates) => {
    if (!viewingOS) return;
    const cliente = clientes.find(c => c.id === viewingOS.cliente_id);
    if (!cliente?.telefone) { toast.error("Cliente sem telefone cadastrado"); return; }
    const osData: WhatsAppOS = {
      numero: viewingOS.numero,
      clienteNome: viewingOS.clientes?.nome || "Cliente",
      equipamento: TIPO_EQUIPAMENTO[detectUiCategory(viewingOS)] || TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento] || viewingOS.tipo_equipamento,
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

  const handleCobrar = async () => {
    if (!viewingOS) return;
    const cliente = clientes.find(c => c.id === viewingOS.cliente_id);
    const asaasId = (cliente as any)?.asaas_id;
    if (!asaasId) { toast.error("Cliente sem ID Asaas. Recadastre para sincronizar."); return; }
    if (!viewingOS.valor_orcamento || viewingOS.valor_orcamento <= 0) { toast.error("OS sem valor de orçamento."); return; }
    setCobrarLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) { toast.error("Sessão expirada"); return; }
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      const dueDateStr = dueDate.toISOString().split("T")[0];
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/asaas?action=create_payment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, apikey: anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: asaasId, billingType: "PIX", value: viewingOS.valor_orcamento, dueDate: dueDateStr,
          description: `OS ${viewingOS.numero}`, externalReference: viewingOS.numero,
        }),
      });
      const result = await res.json();
      if (result.id) {
        toast.success("Cobrança criada!");
        const telefone = cliente?.telefone || "";
        const fmtCurLocal = (v: number) => formatCurrency(v);
        let invoiceLink = result.invoiceUrl || "";
        if (!invoiceLink && result.id) {
          try {
            const linkRes = await fetch(`https://${projectId}.supabase.co/functions/v1/asaas?action=get_payment&id=${result.id}`, { headers: { Authorization: `Bearer ${token}`, apikey: anonKey } });
            const linkData = await linkRes.json();
            invoiceLink = linkData.invoiceUrl || "";
          } catch {}
        }
        const texto = `Olá, *${viewingOS.clientes?.nome}*! 👋\n\n*${empresa.nome_empresa || "LivreOS"}*\n\n📋 *OS:* ${viewingOS.numero}\n💰 *Valor:* ${fmtCurLocal(viewingOS.valor_orcamento)}\n📅 *Vencimento:* ${new Date(dueDateStr + "T00:00:00").toLocaleDateString("pt-BR")}\n⚡ Pix${invoiceLink ? `\n\n🔗 ${invoiceLink}` : ""}`;
        openWhatsApp(telefone, texto);
      } else {
        toast.error("Erro ao criar cobrança");
      }
    } catch (err: any) { toast.error(getErrorMessage(err)); } finally { setCobrarLoading(false); }
  };

  const handleSendTermsWhatsApp = () => {
    if (!lastCreatedOS) return;
    const cliente = clientes.find(c => c.id === lastCreatedOS.cliente_id);
    if (!cliente) { toast.error("Cliente não encontrado"); return; }
    const osData: WhatsAppOS = {
      numero: lastCreatedOS.numero,
      clienteNome: cliente.nome,
      equipamento: TIPO_EQUIPAMENTO[uiCategory] || TIPO_EQUIPAMENTO[lastCreatedOS.tipo_equipamento] || lastCreatedOS.tipo_equipamento,
      modelo: lastCreatedOS.modelo_equipamento || undefined,
    };
    const msg = whatsappTemplates.osRecebida(osData, empresa.nome_empresa || "LivreOS", empresa.termos_servico || undefined);
    openWhatsApp(cliente.telefone, msg);
    setTermsDialogOpen(false);
    setLastCreatedOS(null);
  };

  const resetMobilityData = () => setMobilityData({ voltagem: "", capacidade_bateria: "", odometro: "", chave_ignicao: false, carregador_entregue: false, check_display: false, check_acelerador: false, check_freios: false, check_pneus: false, check_controladora: false, check_iluminacao: false, check_carenagem: false });

  const resetForm = () => {
    setFormData({ cliente_id: "", tipo_equipamento: "bateria", marca: "", modelo_equipamento: "", numero_serie: "", descricao_problema: "", diagnostico: "", prioridade: "media", data_previsao: "", custo_pecas: 0, custo_mao_obra: 0, desconto: 0, valor_orcamento: 0, observacoes: "", tecnico_id: "", checklist_bateria: false, checklist_carregador: false, checklist_controle: false, checklist_cabos: false, checklist_helices: false, checklist_outros: false, condicao_visual: "", ciclos_carga_entrada: 0, ciclos_carga_saida: 0 });
    setUiCategory("bateria");
    resetMobilityData();
    setEditingOS(null);
    setWizardStep(0);
    setOsItems([]);
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
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold font-display flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Ordens de Serviço</h1>
            <p className="text-xs text-muted-foreground">Gestão completa de reparos e manutenção</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button size="sm" className="gradient-primary shadow-soft" onClick={() => {
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
        <div className="grid gap-2 grid-cols-4">
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
                          {TIPO_EQUIPAMENTO[detectUiCategory(os)] || os.tipo_equipamento}
                          {os.modelo_equipamento ? ` · ${os.modelo_equipamento}` : ""}
                          <span className="ml-2">{formatDate(os.data_entrada)}</span>
                        </p>
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
                            <DropdownMenuItem onClick={() => handleEdit(os)}><Edit className="mr-2 h-3.5 w-3.5" />Editar OS</DropdownMenuItem>
                            {getNextStatus(os.status) && (
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

        {/* ===== WIZARD DIALOG ===== */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingOS ? "Editar OS" : "Nova Ordem de Serviço"}</DialogTitle>
              <DialogDescription>
                {editingOS ? "Altere os dados da OS" : `Passo ${wizardStep + 1} de ${WIZARD_STEPS.length}: ${WIZARD_STEPS[wizardStep]}`}
              </DialogDescription>
            </DialogHeader>

            {/* Wizard progress */}
            {!editingOS && (
              <div className="flex items-center gap-1 mb-2">
                {WIZARD_STEPS.map((step, i) => (
                  <div key={step} className="flex items-center gap-1 flex-1">
                    <div className={`h-1.5 flex-1 rounded-full transition-colors ${i <= wizardStep ? "bg-primary" : "bg-muted"}`} />
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); if (!editingOS && wizardStep < WIZARD_STEPS.length - 1) return; handleSubmit(); }}>
              {/* STEP 0: Cliente */}
              {(editingOS || wizardStep === 0) && (
                <div className={editingOS ? "" : wizardStep !== 0 ? "hidden" : ""}>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Cliente</CardTitle></CardHeader>
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
                </div>
              )}

              {/* STEP 1: Equipamento + Checklist */}
              {(editingOS || wizardStep === 1) && (
                <div className={editingOS ? "mt-4" : wizardStep !== 1 ? "hidden" : ""}>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Equipamento</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Tipo *</Label>
                          <Select value={uiCategory} onValueChange={(v) => { setUiCategory(v); setFormData({ ...formData, tipo_equipamento: mapCategoryToDbEnum(v) as Enums<"tipo_equipamento"> }); }}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="drone_agricola">Drone Agrícola</SelectItem>
                              <SelectItem value="drone_convencional">Drone Consumo/Enterprise</SelectItem>
                              <SelectItem value="bateria">Bateria Avulsa</SelectItem>
                              <SelectItem value="controle">Controle Remoto</SelectItem>
                              <SelectItem value="outro">Gerador/Carregador/Outro</SelectItem>
                              <SelectItem value="patinete_eletrico">Patinete Elétrico</SelectItem>
                              <SelectItem value="bicicleta_eletrica">Bicicleta Elétrica</SelectItem>
                              <SelectItem value="moto_eletrica">Moto Elétrica</SelectItem>
                              <SelectItem value="outros_autopropelidos">Outros Autopropelidos</SelectItem>
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

                      {/* Battery fields */}
                      {isBateria && !isMobility && (
                        <div className="grid grid-cols-2 gap-3 p-3 rounded-md border border-dashed border-primary/30 bg-primary/5">
                          <div className="space-y-1.5"><Label className="text-xs">Ciclos Entrada</Label><NumberInput min="0" value={formData.ciclos_carga_entrada} onChange={(v) => setFormData({ ...formData, ciclos_carga_entrada: v })} className="h-9" placeholder="0" /></div>
                          <div className="space-y-1.5"><Label className="text-xs">Ciclos Saída</Label><NumberInput min="0" value={formData.ciclos_carga_saida} onChange={(v) => setFormData({ ...formData, ciclos_carga_saida: v })} className="h-9" placeholder="0" /></div>
                        </div>
                      )}

                      {/* Mobility fields */}
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

                      {/* Checklist */}
                      <Separator />
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Checklist de Entrada</p>
                      {isMobility ? (
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
                </div>
              )}

              {/* STEP 2: Problema */}
              {(editingOS || wizardStep === 2) && (
                <div className={editingOS ? "mt-4" : wizardStep !== 2 ? "hidden" : ""}>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Diagnóstico e Orçamento</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1.5"><Label className="text-xs">Defeito Relatado *</Label><Textarea value={formData.descricao_problema} onChange={(e) => setFormData({ ...formData, descricao_problema: e.target.value })} rows={3} required placeholder="Descreva o defeito..." /></div>
                      <div className="space-y-1.5"><Label className="text-xs">Diagnóstico Técnico</Label><Textarea value={formData.diagnostico} onChange={(e) => setFormData({ ...formData, diagnostico: e.target.value })} rows={2} placeholder="Resultado da análise..." /></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Prioridade</Label>
                          <div className="flex gap-2">
                            {[{ v: "baixa", l: "Baixa", c: "border-muted-foreground/30" }, { v: "media", l: "Média", c: "border-amber-500/30" }, { v: "alta", l: "Alta", c: "border-destructive/30" }].map(p => (
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
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1.5"><Label className="text-xs">Peças (R$)</Label><NumberInput step="0.01" min="0" value={formData.custo_pecas} onChange={(v) => setFormData({ ...formData, custo_pecas: v })} className="h-9" placeholder="0,00" /></div>
                        <div className="space-y-1.5"><Label className="text-xs">Mão de Obra (R$)</Label><NumberInput step="0.01" min="0" value={formData.custo_mao_obra} onChange={(v) => setFormData({ ...formData, custo_mao_obra: v })} className="h-9" placeholder="0,00" /></div>
                        <div className="space-y-1.5"><Label className="text-xs">Desconto (R$)</Label><NumberInput step="0.01" min="0" value={formData.desconto} onChange={(v) => setFormData({ ...formData, desconto: v })} className="h-9" placeholder="0,00" /></div>
                        <div className="space-y-1.5"><Label className="text-xs">Total</Label><Input type="text" value={totalOrcamento.toFixed(2)} readOnly disabled className="h-9 font-bold text-primary" /></div>
                      </div>
                      <div className="space-y-1.5"><Label className="text-xs">Observações</Label><Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={2} /></div>
                      <Separator />
                      <OSItemsSection
                        items={osItems}
                        onChange={setOsItems}
                        organizationId={user ? undefined : undefined}
                      />
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* STEP 3: Revisão */}
              {!editingOS && wizardStep === 3 && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Revisão Final</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-[10px] text-muted-foreground uppercase">Cliente</p><p className="font-medium">{selectedCliente?.nome || "—"}</p></div>
                      <div><p className="text-[10px] text-muted-foreground uppercase">Equipamento</p><p className="font-medium">{TIPO_EQUIPAMENTO[uiCategory] || uiCategory}</p></div>
                      <div><p className="text-[10px] text-muted-foreground uppercase">Marca/Modelo</p><p className="font-medium">{formData.marca || "—"} {formData.modelo_equipamento || ""}</p></div>
                      <div><p className="text-[10px] text-muted-foreground uppercase">Nº Série</p><p className="font-mono">{formData.numero_serie || "—"}</p></div>
                      <div className="col-span-2"><p className="text-[10px] text-muted-foreground uppercase">Defeito</p><p>{formData.descricao_problema}</p></div>
                      <div><p className="text-[10px] text-muted-foreground uppercase">Prioridade</p><Badge variant={formData.prioridade === "alta" ? "destructive" : "secondary"}>{formData.prioridade}</Badge></div>
                      <div><p className="text-[10px] text-muted-foreground uppercase">Total Orçamento</p><p className="font-bold text-primary">{formatCurrency(totalOrcamento || null)}</p></div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Navigation */}
              <div className="flex justify-between items-center mt-4">
                {!editingOS && wizardStep > 0 ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setWizardStep(s => s - 1)}>Voltar</Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                )}
                {!editingOS && wizardStep < WIZARD_STEPS.length - 1 ? (
                  <Button type="button" size="sm" className="gradient-primary" disabled={!canAdvance(wizardStep)} onClick={() => setWizardStep(s => s + 1)}>
                    Próximo <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button type="button" size="sm" className="gradient-primary" disabled={formLoading} onClick={() => handleSubmit()}>
                    {formLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    {editingOS ? "Salvar" : "Criar OS"}
                  </Button>
                )}
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* View OS Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>OS {viewingOS?.numero}</span>
                {viewingOS && getStatusBadge(viewingOS.status)}
              </DialogTitle>
            </DialogHeader>

            {viewingOS && (
              <div className="space-y-4">
                {/* Status Pipeline */}
                <StatusPipeline
                  currentStatus={viewingOS.status}
                  onStatusChange={(s) => { handleStatusChange(viewingOS.id, s); setViewingOS({ ...viewingOS, status: s as any }); }}
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
                  const cleanObs = obsText.replace(/\[MOBILIDADE:[\s\S]*?\]/g, "").trim();
                  const viewType = hasMob && mMatch ? (TIPO_EQUIPAMENTO[mMatch[1]] || TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento]) : (TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento] || viewingOS.tipo_equipamento);

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
                        <h3 className="text-xs font-semibold text-primary uppercase mb-2">Diagnóstico</h3>
                        <div className="space-y-2">
                          <div><p className="text-[10px] text-muted-foreground">Defeito</p><p className="text-sm">{viewingOS.descricao_problema}</p></div>
                          <div><p className="text-[10px] text-muted-foreground">Diagnóstico</p><p className="text-sm">{viewingOS.diagnostico || "-"}</p></div>
                          <div className="grid grid-cols-3 gap-3">
                            <div><p className="text-[10px] text-muted-foreground">Peças</p><p className="text-sm font-medium">{formatCurrency((viewingOS as any).custo_pecas)}</p></div>
                            <div><p className="text-[10px] text-muted-foreground">M.O.</p><p className="text-sm font-medium">{formatCurrency((viewingOS as any).custo_mao_obra)}</p></div>
                            <div><p className="text-[10px] text-muted-foreground">Total</p><p className="text-sm font-bold text-primary">{formatCurrency(viewingOS.valor_orcamento)}</p></div>
                          </div>
                        </div>
                      </div>
                      <Separator />
                      {/* Items da OS */}
                      {viewOsItems.length > 0 && (
                        <OSItemsSection items={viewOsItems} onChange={() => {}} disabled />
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
      </div>
    </MainLayout>
  );
}
