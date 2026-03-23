import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Edit, FileText, Loader2, Eye, MessageCircle, Download, UserPlus, CreditCard, Clock, Wrench, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables, Enums } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { QuickClientModal } from "@/components/os/QuickClientModal";
import { LegalTermsFooter, getLegalTermsHTML } from "@/components/os/LegalTermsFooter";

type OrdemServico = Tables<"ordens_servico"> & { clientes: { nome: string; telefone?: string } | null };
type Cliente = Tables<"clientes">;

// New professional status mapping (DB enum -> UI label)
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
  // Legacy mappings
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
  // UI-only categories (mapped to "outro" in DB)
  patinete_eletrico: "Patinete Elétrico",
  bicicleta_eletrica: "Bicicleta Elétrica",
  moto_eletrica: "Moto Elétrica",
  outros_autopropelidos: "Outros Autopropelidos",
};

// UI categories that map to "outro" in the DB enum
const MOBILITY_CATEGORIES = ["patinete_eletrico", "bicicleta_eletrica", "moto_eletrica", "outros_autopropelidos"];

// Map UI category to DB enum value
const mapCategoryToDbEnum = (uiCategory: string): string => {
  if (MOBILITY_CATEGORIES.includes(uiCategory)) return "outro";
  return uiCategory;
};

// Try to detect UI category from observacoes metadata
const detectUiCategory = (os: any): string => {
  const obs = os.observacoes || "";
  const match = obs.match(/\[MOBILIDADE:(\w+)/);
  if (match) return match[1];
  return os.tipo_equipamento;
};

export default function OrdensServico() {
  const { user } = useAuth();
  const { config: empresa } = useEmpresaConfig();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingOS, setViewingOS] = useState<OrdemServico | null>(null);
  const [editingOS, setEditingOS] = useState<OrdemServico | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [cobrarLoading, setCobrarLoading] = useState(false);

  // uiCategory tracks the actual UI selection; tipo_equipamento stores the DB enum
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
    valor_orcamento: 0,
    observacoes: "",
    // Checklist (drone/bateria)
    checklist_bateria: false,
    checklist_carregador: false,
    checklist_controle: false,
    checklist_cabos: false,
    checklist_helices: false,
    checklist_outros: false,
    condicao_visual: "",
    // Battery-specific
    ciclos_carga_entrada: 0,
    ciclos_carga_saida: 0,
  });

  // Mobility-specific state (not stored directly in DB columns)
  const [mobilityData, setMobilityData] = useState({
    voltagem: "",
    capacidade_bateria: "",
    odometro: "",
    chave_ignicao: false,
    carregador_entregue: false,
    // Mobility checklist
    check_display: false,
    check_acelerador: false,
    check_freios: false,
    check_pneus: false,
    check_controladora: false,
    check_iluminacao: false,
    check_carenagem: false,
  });

  const isMobility = MOBILITY_CATEGORIES.includes(uiCategory);
  const isBateria = uiCategory === "bateria" || 
    formData.modelo_equipamento?.toLowerCase().includes("bateria");

  useEffect(() => { fetchData(); }, []);

  // Auto-calculate total
  const totalOrcamento = (formData.custo_pecas || 0) + (formData.custo_mao_obra || 0);

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
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Usuário não autenticado"); return; }
    setFormLoading(true);
    try {
      const { ciclos_carga_entrada, ciclos_carga_saida, ...restForm } = formData;

      // Build mobility metadata string to inject into observacoes
      let observacoesWithMobility = restForm.observacoes || "";
      // Remove any previous mobility metadata
      observacoesWithMobility = observacoesWithMobility.replace(/\[MOBILIDADE:[\s\S]*?\]/g, "").trim();

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
      if (editingOS) {
        const { error } = await supabase.from("ordens_servico").update(osData).eq("id", editingOS.id);
        if (error) throw error;
        toast.success("OS atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("ordens_servico").insert({
          ...osData,
          numero: "",
          tecnico_id: user.id,
          status: "recebido" as any,
        });
        if (error) throw error;
        toast.success("OS criada com sucesso!");
      }
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao salvar OS: " + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (os: OrdemServico) => {
    setEditingOS(os);
    const detectedCategory = detectUiCategory(os);
    setUiCategory(detectedCategory);

    // Parse mobility data from observacoes if present
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

    // Clean observacoes of mobility metadata for display
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
    });
    setDialogOpen(true);
  };

  const handleView = (os: OrdemServico) => {
    setViewingOS(os);
    setViewDialogOpen(true);
  };

  const handlePrintOS = () => {
    if (!viewingOS) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Popup bloqueado. Permita popups para imprimir."); return; }

    const fmtCur = (v: number | null) => v != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "-";
    const fmtDt = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "-";
    const os = viewingOS as any;

    // Parse mobility data from observacoes
    const obsText = viewingOS.observacoes || "";
    const mobilityMatch = obsText.match(/\[MOBILIDADE:(\w+)\s*\|\s*Voltagem:(.*?)\s*\|\s*Bateria:(.*?)Ah\s*\|\s*Odômetro:(.*?)km\s*\|\s*Chave:(.*?)\s*\|\s*Carregador:(.*?)\s*\|\s*Checklist:(.*?)\]/);
    const hasMobility = !!mobilityMatch;
    const cleanObs = obsText.replace(/\[MOBILIDADE:[\s\S]*?\]/g, "").trim();
    const mobilityCategory = mobilityMatch ? mobilityMatch[1] : "";
    const displayType = TIPO_EQUIPAMENTO[mobilityCategory] || TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento] || viewingOS.tipo_equipamento;

    // Standard checklist
    const checklistItems: string[] = [];
    if (!hasMobility) {
      if (os.checklist_bateria) checklistItems.push("Bateria");
      if (os.checklist_carregador) checklistItems.push("Carregador");
      if (os.checklist_controle) checklistItems.push("Controle");
      if (os.checklist_cabos) checklistItems.push("Cabos");
      if (os.checklist_helices) checklistItems.push("Hélices");
      if (os.checklist_outros) checklistItems.push("Outros");
    }

    // Mobility section HTML
    let mobilityHTML = "";
    if (hasMobility && mobilityMatch) {
      const mCheckItems = mobilityMatch[7] !== "Nenhum" ? mobilityMatch[7] : "";
      mobilityHTML = `
        <div class="section"><div class="section-title">⚡ Dados da Mobilidade Elétrica</div><div class="grid">
          <div class="field"><div class="field-label">Voltagem</div><div class="field-value">${mobilityMatch[2]}</div></div>
          <div class="field"><div class="field-label">Capacidade Bateria</div><div class="field-value">${mobilityMatch[3]}Ah</div></div>
          <div class="field"><div class="field-label">Odômetro</div><div class="field-value">${mobilityMatch[4]}km</div></div>
          <div class="field"><div class="field-label">Chave Ignição</div><div class="field-value">${mobilityMatch[5]}</div></div>
          <div class="field"><div class="field-label">Carregador</div><div class="field-value">${mobilityMatch[6]}</div></div>
          ${mCheckItems ? `<div class="field full-width"><div class="field-label">Checklist Mobilidade</div><div class="field-value">${mCheckItems.replace(/,/g, ", ")}</div></div>` : ""}
        </div></div>`;
    }

    printWindow.document.write(`<!DOCTYPE html><html><head><title>OS ${viewingOS.numero}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; max-width: 210mm; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #4CAF50; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { font-size: 24px; color: #4CAF50; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 14px; font-weight: bold; color: #4CAF50; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 12px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
        .field { margin-bottom: 8px; }
        .field-label { font-size: 11px; color: #888; text-transform: uppercase; }
        .field-value { font-size: 14px; font-weight: 500; }
        .full-width { grid-column: 1 / -1; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; background: #E8F5E9; color: #2E7D32; }
        .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 16px; display: flex; justify-content: space-between; }
        .signature { width: 200px; text-align: center; border-top: 1px solid #333; padding-top: 8px; font-size: 12px; }
        @media print { body { padding: 20px; } }
      </style>
    </head><body>
      <div class="header">
        ${empresa.logo_url ? `<img src="${empresa.logo_url}" alt="Logo" style="max-height:50px;margin-right:12px" />` : ""}
        <div><h1>${empresa.nome_empresa || "Volt Control"}</h1><p style="font-size:12px;color:#888">${empresa.cnpj ? "CNPJ: " + empresa.cnpj : ""} ${empresa.telefone ? "| Tel: " + empresa.telefone : ""}</p>${empresa.endereco ? `<p style="font-size:11px;color:#888">${empresa.endereco}</p>` : ""}</div>
        <div style="text-align:right"><div style="font-size:20px;font-weight:bold;">OS ${viewingOS.numero}</div><div class="status-badge">${getStatusLabel(viewingOS.status)}</div></div>
      </div>
      <div class="section"><div class="section-title">Dados do Cliente</div><div class="grid">
        <div class="field"><div class="field-label">Nome</div><div class="field-value">${viewingOS.clientes?.nome || "-"}</div></div>
      </div></div>
      <div class="section"><div class="section-title">Equipamento</div><div class="grid">
        <div class="field"><div class="field-label">Tipo</div><div class="field-value">${displayType}</div></div>
        <div class="field"><div class="field-label">Marca</div><div class="field-value">${os.marca || "-"}</div></div>
        <div class="field"><div class="field-label">Modelo</div><div class="field-value">${viewingOS.modelo_equipamento || "-"}</div></div>
        <div class="field"><div class="field-label">Nº Série</div><div class="field-value">${viewingOS.numero_serie || "-"}</div></div>
      </div></div>
      ${mobilityHTML}
      ${checklistItems.length > 0 ? `<div class="section"><div class="section-title">Checklist de Entrada</div><div class="grid">
        <div class="field full-width"><div class="field-label">Acessórios Entregues</div><div class="field-value">${checklistItems.join(", ")}</div></div>
        ${os.condicao_visual ? `<div class="field full-width"><div class="field-label">Condição Visual</div><div class="field-value">${os.condicao_visual}</div></div>` : ""}
      </div></div>` : ""}
      <div class="section"><div class="section-title">Diagnóstico e Orçamento</div><div class="grid">
        <div class="field full-width"><div class="field-label">Defeito Relatado</div><div class="field-value">${viewingOS.descricao_problema}</div></div>
        <div class="field full-width"><div class="field-label">Diagnóstico Técnico</div><div class="field-value">${viewingOS.diagnostico || "-"}</div></div>
        <div class="field"><div class="field-label">Custo Peças</div><div class="field-value">${fmtCur(os.custo_pecas)}</div></div>
        <div class="field"><div class="field-label">Custo Mão de Obra</div><div class="field-value">${fmtCur(os.custo_mao_obra)}</div></div>
        <div class="field"><div class="field-label">Total Orçamento</div><div class="field-value" style="font-weight:bold;color:#4CAF50">${fmtCur(viewingOS.valor_orcamento)}</div></div>
        <div class="field"><div class="field-label">Valor Final</div><div class="field-value">${fmtCur(viewingOS.valor_final)}</div></div>
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

  const handleWhatsApp = () => {
    if (!viewingOS) return;
    const cliente = clientes.find(c => c.id === viewingOS.cliente_id);
    const telefone = cliente?.telefone || "";
    const cleanPhone = telefone.replace(/\D/g, "");
    const phone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const fmtCur = (v: number | null) => v != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "A definir";

    const texto = `Olá, *${viewingOS.clientes?.nome || "Cliente"}*! 👋\n\nAqui é da *${empresa.nome_empresa || "Volt Control"}*.\n\nSua Ordem de Serviço está atualizada:\n\n📋 *OS:* ${viewingOS.numero}\n🔧 *Equipamento:* ${TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento] || viewingOS.tipo_equipamento}${viewingOS.modelo_equipamento ? ` - ${viewingOS.modelo_equipamento}` : ""}\n📌 *Status:* ${getStatusLabel(viewingOS.status)}\n💰 *Valor:* ${fmtCur(viewingOS.valor_orcamento)}\n\n${viewingOS.diagnostico ? `🔍 *Diagnóstico:* ${viewingOS.diagnostico}\n` : ""}${viewingOS.observacoes ? `📝 *Obs:* ${viewingOS.observacoes}\n` : ""}\nQualquer dúvida, estamos à disposição!`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(texto)}`, "_blank");
  };

  const handleCobrar = async () => {
    if (!viewingOS) return;
    const cliente = clientes.find(c => c.id === viewingOS.cliente_id);
    const asaasId = (cliente as any)?.asaas_id;

    if (!asaasId) {
      toast.error('Este cliente não possui ID Asaas. Vá em Clientes e recadastre para sincronizar.');
      return;
    }

    if (!viewingOS.valor_orcamento || viewingOS.valor_orcamento <= 0) {
      toast.error('Esta OS não possui valor de orçamento definido.');
      return;
    }

    setCobrarLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) { toast.error('Sessão expirada'); return; }

      // Set due date to 3 days from now
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/asaas?action=create_payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customer: asaasId,
            billingType: 'PIX',
            value: viewingOS.valor_orcamento,
            dueDate: dueDateStr,
            description: `OS ${viewingOS.numero} - ${TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento] || viewingOS.tipo_equipamento}`,
            externalReference: viewingOS.numero,
          }),
        }
      );
      const result = await res.json();

      if (result.id) {
        toast.success('Cobrança criada com sucesso!');
        
        // Now send via WhatsApp with the invoice link
        const telefone = cliente?.telefone || "";
        const cleanPhone = telefone.replace(/\D/g, "");
        const phone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
        const fmtCur = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        let invoiceLink = result.invoiceUrl || '';
        
        // If no invoice URL in create response, try to fetch it
        if (!invoiceLink && result.id) {
          try {
            const linkRes = await fetch(
              `https://${projectId}.supabase.co/functions/v1/asaas?action=get_payment&id=${result.id}`,
              { headers: { 'Authorization': `Bearer ${token}`, 'apikey': anonKey } }
            );
            const linkData = await linkRes.json();
            invoiceLink = linkData.invoiceUrl || '';
          } catch { /* silent */ }
        }

        const texto = `Olá, *${viewingOS.clientes?.nome || "Cliente"}*! 👋\n\nAqui é da *${empresa.nome_empresa || "Volt Control"}*.\n\nSegue a cobrança referente à sua Ordem de Serviço:\n\n📋 *OS:* ${viewingOS.numero}\n🔧 *Serviço:* ${TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento] || viewingOS.tipo_equipamento}${viewingOS.modelo_equipamento ? ` - ${viewingOS.modelo_equipamento}` : ""}\n💰 *Valor:* ${fmtCur(viewingOS.valor_orcamento)}\n📅 *Vencimento:* ${new Date(dueDateStr + 'T00:00:00').toLocaleDateString('pt-BR')}\n⚡ *Pagamento via Pix*${invoiceLink ? `\n\n🔗 *Link para pagamento:*\n${invoiceLink}` : ''}\n\nQualquer dúvida, estamos à disposição!`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(texto)}`, "_blank");
      } else {
        toast.error('Erro ao criar cobrança: ' + JSON.stringify(result.errors || result));
      }
    } catch (err: any) {
      toast.error('Erro ao cobrar: ' + err.message);
    } finally {
      setCobrarLoading(false);
    }
  };

  const handleStatusChange = async (osId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "pronto_retirada" || newStatus === "concluida") updateData.data_conclusao = new Date().toISOString();
      if (newStatus === "entregue") updateData.data_entrega = new Date().toISOString();
      const { error } = await supabase.from("ordens_servico").update(updateData).eq("id", osId);
      if (error) throw error;
      toast.success("Status atualizado!");
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao atualizar status: " + err.message);
    }
  };

  const resetMobilityData = () => {
    setMobilityData({
      voltagem: "", capacidade_bateria: "", odometro: "",
      chave_ignicao: false, carregador_entregue: false,
      check_display: false, check_acelerador: false, check_freios: false,
      check_pneus: false, check_controladora: false, check_iluminacao: false, check_carenagem: false,
    });
  };

  const resetForm = () => {
    setFormData({
      cliente_id: "", tipo_equipamento: "bateria", marca: "", modelo_equipamento: "", numero_serie: "",
      descricao_problema: "", diagnostico: "", prioridade: "media", data_previsao: "",
      custo_pecas: 0, custo_mao_obra: 0, valor_orcamento: 0, observacoes: "",
      checklist_bateria: false, checklist_carregador: false, checklist_controle: false,
      checklist_cabos: false, checklist_helices: false, checklist_outros: false, condicao_visual: "",
      ciclos_carga_entrada: 0, ciclos_carga_saida: 0,
    });
    setUiCategory("bateria");
    resetMobilityData();
    setEditingOS(null);
  };

  const getStatusLabel = (status: string) => STATUS_CONFIG[status]?.label || status;
  const getStatusBadge = (status: string) => {
    const c = STATUS_CONFIG[status] || { label: status, variant: "outline" as const };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const formatCurrency = (v: number | null) => v != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "-";
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "-";

  const filteredOrdens = ordens.filter(os =>
    os.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
    os.clientes?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    os.descricao_problema.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    recebidas: ordens.filter(os => os.status === "recebido" || os.status === "aberta").length,
    emReparo: ordens.filter(os => ["em_reparo", "em_andamento", "em_testes", "aprovado"].includes(os.status)).length,
    aguardando: ordens.filter(os => ["aguardando_diagnostico", "aguardando_aprovacao", "aguardando_peca"].includes(os.status)).length,
    prontas: ordens.filter(os => ["pronto_retirada", "concluida", "entregue"].includes(os.status)).length,
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Ordens de Serviço</h1>
            <p className="text-xs text-muted-foreground">Drones, baterias, patinetes, bicicletas e veículos elétricos</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild><Button className="gradient-primary shadow-medium"><Plus className="mr-2 h-4 w-4" />Nova OS</Button></DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingOS ? "Editar OS" : "Nova Ordem de Serviço"}</DialogTitle>
                <DialogDescription>Preencha os dados da ordem de serviço</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <Tabs defaultValue="equipamento" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="equipamento">Equipamento</TabsTrigger>
                    <TabsTrigger value="checklist">Checklist</TabsTrigger>
                    <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
                  </TabsList>

                  {/* TAB 1 - EQUIPAMENTO */}
                  <TabsContent value="equipamento" className="space-y-4 mt-4">
                    <Card>
                      <CardHeader className="pb-3"><CardTitle className="text-base">Cliente e Equipamento</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Cliente *</Label>
                          <div className="flex gap-2">
                            <Select value={formData.cliente_id} onValueChange={(v) => setFormData({ ...formData, cliente_id: v })}>
                              <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                              <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                            </Select>
                            <Button type="button" variant="outline" size="icon" onClick={() => setQuickClientOpen(true)} title="Cadastro rápido de cliente">
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Tipo de Equipamento *</Label>
                            <Select value={uiCategory} onValueChange={(v) => { setUiCategory(v); setFormData({ ...formData, tipo_equipamento: mapCategoryToDbEnum(v) as Enums<"tipo_equipamento"> }); }}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="drone_agricola">Drone Agrícola</SelectItem>
                                <SelectItem value="drone_convencional">Drone de Consumo / Enterprise</SelectItem>
                                <SelectItem value="bateria">Bateria Avulsa</SelectItem>
                                <SelectItem value="controle">Controle Remoto</SelectItem>
                                <SelectItem value="outro">Gerador / Carregador / Outro</SelectItem>
                                <SelectItem value="patinete_eletrico">Patinete Elétrico</SelectItem>
                                <SelectItem value="bicicleta_eletrica">Bicicleta Elétrica</SelectItem>
                                <SelectItem value="moto_eletrica">Moto Elétrica</SelectItem>
                                <SelectItem value="outros_autopropelidos">Outros Autopropelidos</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Marca</Label>
                            <Input value={formData.marca} onChange={(e) => setFormData({ ...formData, marca: e.target.value })} placeholder={isMobility ? "Ex: Xiaomi, Caloi..." : "Ex: DJI, XAG..."} />
                          </div>
                          <div className="space-y-2">
                            <Label>Modelo</Label>
                            <Input value={formData.modelo_equipamento} onChange={(e) => setFormData({ ...formData, modelo_equipamento: e.target.value })} placeholder={isMobility ? "Ex: Mi Pro 2, E-Vibe..." : "Ex: Agras T40..."} />
                          </div>
                          <div className="space-y-2">
                            <Label>Número de Série</Label>
                            <Input value={formData.numero_serie} onChange={(e) => setFormData({ ...formData, numero_serie: e.target.value })} />
                          </div>
                        </div>
                        {/* Battery conditional fields */}
                        {isBateria && !isMobility && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                            <div className="space-y-2">
                              <Label>Ciclos de Carga (Entrada)</Label>
                              <Input type="number" min="0" value={formData.ciclos_carga_entrada}
                                onChange={(e) => setFormData({ ...formData, ciclos_carga_entrada: Number(e.target.value) })}
                                placeholder="Ex: 150" />
                            </div>
                            <div className="space-y-2">
                              <Label>Ciclos de Carga (Saída)</Label>
                              <Input type="number" min="0" value={formData.ciclos_carga_saida}
                                onChange={(e) => setFormData({ ...formData, ciclos_carga_saida: Number(e.target.value) })}
                                placeholder="Ex: 155" />
                            </div>
                          </div>
                        )}
                        {/* Mobility-specific fields */}
                        {isMobility && (
                          <Card className="border-dashed border-primary/30 bg-primary/5">
                            <CardHeader className="pb-2"><CardTitle className="text-sm">⚡ Dados da Mobilidade Elétrica</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Voltagem Nominal</Label>
                                  <Select value={mobilityData.voltagem} onValueChange={(v) => setMobilityData({ ...mobilityData, voltagem: v })}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="36V">36V</SelectItem>
                                      <SelectItem value="48V">48V</SelectItem>
                                      <SelectItem value="60V">60V</SelectItem>
                                      <SelectItem value="72V">72V</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Capacidade da Bateria (Ah)</Label>
                                  <Input value={mobilityData.capacidade_bateria} onChange={(e) => setMobilityData({ ...mobilityData, capacidade_bateria: e.target.value })} placeholder="Ex: 12, 20, 30..." />
                                </div>
                                <div className="space-y-2">
                                  <Label>Odômetro / Quilometragem</Label>
                                  <Input value={mobilityData.odometro} onChange={(e) => setMobilityData({ ...mobilityData, odometro: e.target.value })} placeholder="Ex: 1500" />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center space-x-2">
                                  <Checkbox id="chave_ignicao" checked={mobilityData.chave_ignicao} onCheckedChange={(c) => setMobilityData({ ...mobilityData, chave_ignicao: !!c })} />
                                  <Label htmlFor="chave_ignicao" className="cursor-pointer">Chave de Ignição entregue</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox id="carregador_mob" checked={mobilityData.carregador_entregue} onCheckedChange={(c) => setMobilityData({ ...mobilityData, carregador_entregue: !!c })} />
                                  <Label htmlFor="carregador_mob" className="cursor-pointer">Carregador entregue</Label>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Prioridade</Label>
                            <Select value={formData.prioridade} onValueChange={(v) => setFormData({ ...formData, prioridade: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="baixa">Baixa</SelectItem>
                                <SelectItem value="media">Média</SelectItem>
                                <SelectItem value="alta">Alta</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Previsão de Entrega</Label>
                            <Input type="date" value={formData.data_previsao} onChange={(e) => setFormData({ ...formData, data_previsao: e.target.value })} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* TAB 2 - CHECKLIST DE ENTRADA */}
                  <TabsContent value="checklist" className="space-y-4 mt-4">
                    <Card>
                      <CardHeader className="pb-3"><CardTitle className="text-base">Checklist de Entrada {isMobility ? "(Mobilidade)" : "(Drone/Acessório)"}</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">Marque os itens verificados na entrada:</p>
                        {isMobility ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {([
                              ["check_display", "Display / Painel"],
                              ["check_acelerador", "Acelerador"],
                              ["check_freios", "Freios"],
                              ["check_pneus", "Pneus"],
                              ["check_controladora", "Módulo / Controladora"],
                              ["check_iluminacao", "Iluminação"],
                              ["check_carenagem", "Carenagem"],
                            ] as const).map(([key, label]) => (
                              <div key={key} className="flex items-center space-x-2">
                                <Checkbox
                                  id={key}
                                  checked={(mobilityData as any)[key]}
                                  onCheckedChange={(checked) => setMobilityData({ ...mobilityData, [key]: !!checked })}
                                />
                                <Label htmlFor={key} className="cursor-pointer">{label}</Label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {([
                              ["checklist_bateria", "Bateria"],
                              ["checklist_carregador", "Carregador"],
                              ["checklist_controle", "Controle"],
                              ["checklist_cabos", "Cabos"],
                              ["checklist_helices", "Hélices"],
                              ["checklist_outros", "Outros"],
                            ] as const).map(([key, label]) => (
                              <div key={key} className="flex items-center space-x-2">
                                <Checkbox
                                  id={key}
                                  checked={(formData as any)[key]}
                                  onCheckedChange={(checked) => setFormData({ ...formData, [key]: !!checked })}
                                />
                                <Label htmlFor={key} className="cursor-pointer">{label}</Label>
                              </div>
                            ))}
                          </div>
                        )}
                        <Separator />
                        <div className="space-y-2">
                          <Label>Condição Visual (Riscos, amassados, lacres)</Label>
                          <Textarea
                            value={formData.condicao_visual}
                            onChange={(e) => setFormData({ ...formData, condicao_visual: e.target.value })}
                            rows={3}
                            placeholder="Descreva a condição visual do equipamento na entrada..."
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* TAB 3 - DIAGNÓSTICO E ORÇAMENTO */}
                  <TabsContent value="diagnostico" className="space-y-4 mt-4">
                    <Card>
                      <CardHeader className="pb-3"><CardTitle className="text-base">Diagnóstico e Orçamento</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Defeito Relatado *</Label>
                          <Textarea
                            value={formData.descricao_problema}
                            onChange={(e) => setFormData({ ...formData, descricao_problema: e.target.value })}
                            rows={3}
                            required
                            placeholder="Descreva o defeito relatado pelo cliente..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Diagnóstico Técnico</Label>
                          <Textarea
                            value={formData.diagnostico}
                            onChange={(e) => setFormData({ ...formData, diagnostico: e.target.value })}
                            rows={3}
                            placeholder="Resultado da análise técnica..."
                          />
                        </div>
                        <Separator />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Custo de Peças (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.custo_pecas}
                              onChange={(e) => setFormData({ ...formData, custo_pecas: Number(e.target.value) })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Custo Mão de Obra (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.custo_mao_obra}
                              onChange={(e) => setFormData({ ...formData, custo_mao_obra: Number(e.target.value) })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Total (R$)</Label>
                            <Input
                              type="number"
                              value={totalOrcamento.toFixed(2)}
                              readOnly
                              disabled
                              className="font-bold text-primary"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Observações</Label>
                          <Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={2} />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 mt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="gradient-primary" disabled={formLoading}>
                    {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingOS ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card className="shadow-soft border-border/50"><CardContent className="p-3"><div className="flex items-center justify-between"><div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Recebidas</p><p className="text-lg font-bold text-warning">{stats.recebidas}</p></div><div className="p-2 rounded-lg bg-warning/10"><Clock className="h-4 w-4 text-warning" /></div></div></CardContent></Card>
          <Card className="shadow-soft border-border/50"><CardContent className="p-3"><div className="flex items-center justify-between"><div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Em Reparo</p><p className="text-lg font-bold text-primary">{stats.emReparo}</p></div><div className="p-2 rounded-lg bg-primary/10"><Wrench className="h-4 w-4 text-primary" /></div></div></CardContent></Card>
          <Card className="shadow-soft border-border/50"><CardContent className="p-3"><div className="flex items-center justify-between"><div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Aguardando</p><p className="text-lg font-bold text-secondary-foreground">{stats.aguardando}</p></div><div className="p-2 rounded-lg bg-muted"><Clock className="h-4 w-4 text-muted-foreground" /></div></div></CardContent></Card>
          <Card className="shadow-soft border-border/50"><CardContent className="p-3"><div className="flex items-center justify-between"><div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Prontas</p><p className="text-lg font-bold text-success">{stats.prontas}</p></div><div className="p-2 rounded-lg bg-success/10"><CheckCircle2 className="h-4 w-4 text-success" /></div></div></CardContent></Card>
        </div>

        {/* Search */}
        <div className="relative"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar por OS, cliente ou equipamento..." className="pl-9 h-9 text-xs bg-muted/30 border-border/50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>

        {/* List */}
        <Card className="shadow-soft border-border/50">
          <CardHeader className="pb-2 px-4 pt-4"><CardTitle className="text-sm">Lista de Ordens de Serviço</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredOrdens.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><FileText className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Nenhuma ordem de serviço encontrada</p></div>
            ) : (
              <div className="space-y-2">
                {filteredOrdens.map((os) => (
                  <div key={os.id} className="border border-border/50 rounded-lg p-3 hover:bg-muted/30 transition-colors">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-primary">{os.numero}</p>
                          <Badge variant={os.prioridade === "alta" ? "destructive" : os.prioridade === "media" ? "secondary" : "outline"}>
                            {os.prioridade === "alta" ? "Alta" : os.prioridade === "media" ? "Média" : "Baixa"}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">{os.clientes?.nome}</p>
                      </div>
                      <div><p className="text-sm text-muted-foreground">Equipamento</p><p className="font-medium">{TIPO_EQUIPAMENTO[detectUiCategory(os)] || TIPO_EQUIPAMENTO[os.tipo_equipamento] || os.tipo_equipamento}</p>{os.modelo_equipamento && <p className="text-xs text-muted-foreground">{os.modelo_equipamento}</p>}</div>
                      <div><p className="text-sm text-muted-foreground">Status</p>{getStatusBadge(os.status)}</div>
                      <div><p className="text-sm text-muted-foreground">Entrada</p><p className="text-sm">{new Date(os.data_entrada).toLocaleDateString("pt-BR")}</p></div>
                      <div className="flex gap-2 items-start justify-end flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => handleView(os)} title="Visualizar"><Eye className="h-4 w-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => handleEdit(os)} title="Editar"><Edit className="h-4 w-4" /></Button>
                        <Select onValueChange={(v) => handleStatusChange(os.id, v)}>
                          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Alterar Status" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="recebido">Recebido</SelectItem>
                            <SelectItem value="aguardando_diagnostico">Aguard. Diagnóstico</SelectItem>
                            <SelectItem value="aguardando_aprovacao">Aguard. Aprovação</SelectItem>
                            <SelectItem value="aprovado">Aprovado</SelectItem>
                            <SelectItem value="em_reparo">Em Reparo</SelectItem>
                            <SelectItem value="em_testes">Em Testes</SelectItem>
                            <SelectItem value="pronto_retirada">Pronto p/ Retirada</SelectItem>
                            <SelectItem value="entregue">Entregue</SelectItem>
                            <SelectItem value="cancelada">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* View OS Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>OS {viewingOS?.numero}</span>
                {viewingOS && getStatusBadge(viewingOS.status)}
              </DialogTitle>
              <DialogDescription>Visualização da ordem de serviço</DialogDescription>
            </DialogHeader>
            {viewingOS && (() => {
              const obsText = viewingOS.observacoes || "";
              const mMatch = obsText.match(/\[MOBILIDADE:(\w+)\s*\|\s*Voltagem:(.*?)\s*\|\s*Bateria:(.*?)Ah\s*\|\s*Odômetro:(.*?)km\s*\|\s*Chave:(.*?)\s*\|\s*Carregador:(.*?)\s*\|\s*Checklist:(.*?)\]/);
              const hasMob = !!mMatch;
              const cleanObsView = obsText.replace(/\[MOBILIDADE:[\s\S]*?\]/g, "").trim();
              const viewDisplayType = hasMob && mMatch ? (TIPO_EQUIPAMENTO[mMatch[1]] || TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento]) : (TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento] || viewingOS.tipo_equipamento);

              return (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-primary uppercase mb-3">Dados do Cliente</h3>
                  <p className="font-medium">{viewingOS.clientes?.nome || "-"}</p>
                </div>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold text-primary uppercase mb-3">Equipamento</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-muted-foreground">Tipo</p><p className="font-medium">{viewDisplayType}</p></div>
                    <div><p className="text-xs text-muted-foreground">Marca</p><p className="font-medium">{(viewingOS as any).marca || "-"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Modelo</p><p className="font-medium">{viewingOS.modelo_equipamento || "-"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Nº Série</p><p className="font-medium">{viewingOS.numero_serie || "-"}</p></div>
                  </div>
                </div>
                {/* Mobility data section */}
                {hasMob && mMatch && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold text-primary uppercase mb-3">⚡ Dados da Mobilidade Elétrica</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div><p className="text-xs text-muted-foreground">Voltagem</p><p className="font-medium">{mMatch[2]}</p></div>
                        <div><p className="text-xs text-muted-foreground">Capacidade Bateria</p><p className="font-medium">{mMatch[3]}Ah</p></div>
                        <div><p className="text-xs text-muted-foreground">Odômetro</p><p className="font-medium">{mMatch[4]}km</p></div>
                        <div><p className="text-xs text-muted-foreground">Chave Ignição</p><p className="font-medium">{mMatch[5]}</p></div>
                        <div><p className="text-xs text-muted-foreground">Carregador</p><p className="font-medium">{mMatch[6]}</p></div>
                      </div>
                      {mMatch[7] !== "Nenhum" && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {mMatch[7].split(",").map(item => <Badge key={item} variant="secondary">{item}</Badge>)}
                        </div>
                      )}
                    </div>
                  </>
                )}
                <Separator />
                {/* Standard Checklist section */}
                {!hasMob && (() => {
                  const os = viewingOS as any;
                  const items: string[] = [];
                  if (os.checklist_bateria) items.push("Bateria");
                  if (os.checklist_carregador) items.push("Carregador");
                  if (os.checklist_controle) items.push("Controle");
                  if (os.checklist_cabos) items.push("Cabos");
                  if (os.checklist_helices) items.push("Hélices");
                  if (os.checklist_outros) items.push("Outros");
                  if (items.length === 0 && !os.condicao_visual) return null;
                  return (
                    <>
                      <div>
                        <h3 className="text-sm font-semibold text-primary uppercase mb-3">Checklist de Entrada</h3>
                        {items.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {items.map(i => <Badge key={i} variant="secondary">{i}</Badge>)}
                          </div>
                        )}
                        {os.condicao_visual && (
                          <div><p className="text-xs text-muted-foreground">Condição Visual</p><p className="text-sm">{os.condicao_visual}</p></div>
                        )}
                      </div>
                      <Separator />
                    </>
                  );
                })()}
                <div>
                  <h3 className="text-sm font-semibold text-primary uppercase mb-3">Diagnóstico e Orçamento</h3>
                  <div className="space-y-3">
                    <div><p className="text-xs text-muted-foreground">Defeito Relatado</p><p className="text-sm">{viewingOS.descricao_problema}</p></div>
                    <div><p className="text-xs text-muted-foreground">Diagnóstico Técnico</p><p className="text-sm">{viewingOS.diagnostico || "-"}</p></div>
                    <div className="grid grid-cols-3 gap-4">
                      <div><p className="text-xs text-muted-foreground">Custo Peças</p><p className="font-medium">{formatCurrency((viewingOS as any).custo_pecas)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Custo M.O.</p><p className="font-medium">{formatCurrency((viewingOS as any).custo_mao_obra)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Total</p><p className="font-medium text-primary">{formatCurrency(viewingOS.valor_orcamento)}</p></div>
                    </div>
                  </div>
                </div>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold text-primary uppercase mb-3">Datas</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-muted-foreground">Entrada</p><p className="text-sm">{formatDate(viewingOS.data_entrada)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Previsão</p><p className="text-sm">{formatDate(viewingOS.data_previsao)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Conclusão</p><p className="text-sm">{formatDate(viewingOS.data_conclusao)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Entrega</p><p className="text-sm">{formatDate(viewingOS.data_entrega)}</p></div>
                  </div>
                </div>
                {cleanObsView && (<><Separator /><div><p className="text-xs text-muted-foreground">Observações</p><p className="text-sm">{cleanObsView}</p></div></>)}

                {/* Legal Terms */}
                <LegalTermsFooter />

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 justify-end pt-2">
                  <Button variant="outline" onClick={handlePrintOS}>
                    <Download className="mr-2 h-4 w-4" />Baixar PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleCobrar} 
                    disabled={cobrarLoading}
                    className="border-primary/30 text-primary hover:bg-primary/10"
                  >
                    {cobrarLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                    Cobrar
                  </Button>
                  <Button onClick={handleWhatsApp} className="bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,38%)] text-white">
                    <MessageCircle className="mr-2 h-4 w-4" />Enviar WhatsApp
                  </Button>
                </div>
              </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Quick Client Modal */}
        <QuickClientModal
          open={quickClientOpen}
          onOpenChange={setQuickClientOpen}
          onClientCreated={(id) => {
            setFormData(f => ({ ...f, cliente_id: id }));
            fetchData();
          }}
        />
      </div>
    </MainLayout>
  );
}
