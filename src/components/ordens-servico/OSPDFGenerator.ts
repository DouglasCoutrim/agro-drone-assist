import { Tables } from "@/integrations/supabase/types";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getStatusLabel } from "@/components/os/StatusPipeline";
import { getLegalTermsHTML } from "@/components/os/LegalTermsFooter";
import { EmpresaConfig } from "@/hooks/useEmpresaConfig";

type OrdemServico = Tables<"ordens_servico"> & { 
  clientes: { nome: string; telefone?: string } | null,
  tecnico?: { nome: string } | null
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

export const generateOSPDF = (
  viewingOS: OrdemServico,
  itemsForPdf: any[],
  empresa: EmpresaConfig,
  tecnicoNome?: string,
  checklistRevisaoItems?: Array<{ label: string; marcado: boolean; obrigatorio: boolean }>
) => {
  const fmtCur = (v: number | null | undefined) => formatCurrency(v || 0);
  const fmtDt = (d: string | null | undefined) => formatDate(d || "");
  const os = viewingOS as any;
  const obsText = viewingOS.observacoes || "";
  
  // Extract mobility data
  const mobilityMatch = obsText.match(/\[MOBILIDADE:(\w+)\s*\|\s*Voltagem:(.*?)\s*\|\s*Bateria:(.*?)Ah\s*\|\s*Odômetro:(.*?)km\s*\|\s*Chave:(.*?)\s*\|\s*Carregador:(.*?)\s*\|\s*Checklist:(.*?)\]/);
  const hasMobility = !!mobilityMatch;
  const cleanObs = obsText.replace(/\[MOBILIDADE:[\s\S]*?\]/g, "").trim();
  const mobilityCategory = mobilityMatch ? mobilityMatch[1] : "";
  // Get display type, fall back to tipo_equipamento
  const displayType = TIPO_EQUIPAMENTO[mobilityCategory] 
    || TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento] 
    || viewingOS.tipo_equipamento 
    || "Não informado";

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
    const mCheckItems = mobilityMatch[7] && mobilityMatch[7] !== "Nenhum" ? mobilityMatch[7] : "";
    mobilityHTML = `
      <div class="section">
        <div class="section-title">⚡ Dados do Equipamento / Mobilidade</div>
        <div class="grid">
          <div class="field"><div class="field-label">Voltagem</div><div class="field-value">${mobilityMatch[2] || "Não informado"}</div></div>
          <div class="field"><div class="field-label">Capacidade Bateria</div><div class="field-value">${mobilityMatch[3] || "Não informado"}Ah</div></div>
          <div class="field"><div class="field-label">Odômetro</div><div class="field-value">${mobilityMatch[4] || "Não informado"}km</div></div>
          <div class="field"><div class="field-label">Chave Ignição</div><div class="field-value">${mobilityMatch[5] || "Não informado"}</div></div>
          <div class="field"><div class="field-label">Carregador</div><div class="field-value">${mobilityMatch[6] || "Não informado"}</div></div>
          ${mCheckItems ? `<div class="field full-width"><div class="field-label">Checklist</div><div class="field-value">${mCheckItems.replace(/,/g, ", ")}</div></div>` : ""}
        </div>
      </div>`;
  }

  const subtotal = itemsForPdf.reduce((s, i) => s + (i.valor_total || 0), 0);
  const desconto = (os.desconto || 0);
  const totalFinal = subtotal > 0
    ? Math.max(0, subtotal - desconto)
    : (Number(viewingOS.valor_orcamento) || 0);

  const tableStyle = `width:100%;border-collapse:collapse;margin-top:6px;font-size:12px;table-layout:fixed;`;
  const thStyle = `text-align:left;padding:6px 8px;background:#f3f4f6;border-bottom:1px solid #d1d5db;font-weight:600;`;
  const tdStyle = `padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top;word-wrap:break-word;`;

  const renderItemsTable = (list: typeof itemsForPdf) => `
    <div class="section">
      <div class="section-title">Itens / Peças e Serviços</div>
      <table style="${tableStyle}">
        <colgroup><col style="width:50%"><col style="width:12%"><col style="width:19%"><col style="width:19%"></colgroup>
        <thead><tr>
          <th style="${thStyle}">Descrição</th>
          <th style="${thStyle}text-align:center">Qtd</th>
          <th style="${thStyle}text-align:right">Unit.</th>
          <th style="${thStyle}text-align:right">Total</th>
        </tr></thead>
        <tbody>
          ${list.length > 0 ? list.map(i => `<tr>
            <td style="${tdStyle}">${i.descricao || "Item sem descrição"}${i.codigo ? ` <span style="color:#888">(${i.codigo})</span>` : ""}</td>
            <td style="${tdStyle}text-align:center">${i.quantidade || 0}</td>
            <td style="${tdStyle}text-align:right">${fmtCur(i.valor_unitario)}</td>
            <td style="${tdStyle}text-align:right;font-weight:600">${fmtCur(i.valor_total)}</td>
          </tr>`).join("") : `<tr><td style="${tdStyle}color:#777;text-align:center" colspan="4">Nenhum item, peça ou serviço foi encontrado para esta OS.</td></tr>`}
        </tbody>
      </table>
    </div>`;

  const itensHtml = renderItemsTable(itemsForPdf);
  const totalLine = `
    <div class="section" style="margin-top:6px">
      <table style="width:100%;font-size:13px">
        ${subtotal > 0 ? `<tr><td style="text-align:right;padding:2px 8px">Subtotal:</td><td style="text-align:right;padding:2px 0;width:120px">${fmtCur(subtotal)}</td></tr>` : ""}
        ${subtotal > 0 && desconto > 0 ? `<tr><td style="text-align:right;padding:2px 8px">Desconto:</td><td style="text-align:right;padding:2px 0;width:120px">- ${fmtCur(desconto)}</td></tr>` : ""}
        <tr><td style="text-align:right;padding:6px 8px;font-weight:700;font-size:15px">TOTAL:</td><td style="text-align:right;padding:6px 0;font-weight:700;font-size:15px;color:#16a34a;width:120px">${fmtCur(totalFinal)}</td></tr>
      </table>
    </div>`;

  // Get technician name, first from param if available, then try os.tecnico, then fallback
  const finalTecnicoNome = tecnicoNome || os.tecnico?.nome || "Não informado";

  return `<!DOCTYPE html>
<html>
<head>
  <title>OS ${viewingOS.numero || "Sem número"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 30px; color: #333; max-width: 210mm; margin: 0 auto; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #16a34a; padding-bottom: 12px; margin-bottom: 15px; }
    .header h1 { font-size: 20px; color: #16a34a; }
    .section { margin-bottom: 12px; page-break-inside: avoid; }
    .section-title { font-size: 12px; font-weight: bold; color: #16a34a; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 20px; }
    .field { margin-bottom: 5px; }
    .field-label { font-size: 10px; color: #888; text-transform: uppercase; }
    .field-value { font-size: 12px; font-weight: 500; }
    .full-width { grid-column: 1 / -1; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: bold; background: #E8F5E9; color: #2E7D32; }
    .footer-sigs { margin-top: 30px; display: flex; justify-content: space-between; page-break-inside: avoid; }
    .signature { width: 220px; text-align: center; border-top: 1px solid #333; padding-top: 5px; font-size: 11px; margin-top: 40px; }
    .legal-terms { font-size: 9px; color: #666; margin-top: 20px; text-align: justify; line-height: 1.3; }
    @media print { 
      body { padding: 15px; }
      @page { margin: 1cm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div style="display: flex; align-items: center; gap: 15px;">
      ${empresa.logo_url ? `<img src="${empresa.logo_url}" alt="Logo" style="max-height:45px" />` : ""}
      <div>
        <h1>${empresa.nome_empresa || "Nome da Empresa"}</h1>
        ${empresa.cnpj || empresa.telefone ? `<p style="font-size:10px;color:#888">${empresa.cnpj ? "CNPJ: " + empresa.cnpj : ""} ${empresa.cnpj && empresa.telefone ? " | " : ""} ${empresa.telefone ? "Tel: " + empresa.telefone : ""}</p>` : ""}
        ${empresa.endereco ? `<p style="font-size:10px;color:#888">${empresa.endereco}</p>` : ""}
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:bold;">OS ${viewingOS.numero || "Sem número"}</div>
      <div class="status-badge">${getStatusLabel(viewingOS.status) || "Status não informado"}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Cliente</div>
    <div class="grid">
      <div class="field"><div class="field-label">Nome</div><div class="field-value">${viewingOS.clientes?.nome || "Não informado"}</div></div>
      <div class="field"><div class="field-label">Telefone</div><div class="field-value">${viewingOS.clientes?.telefone || "Não informado"}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Equipamento</div>
    <div class="grid">
      <div class="field"><div class="field-label">Tipo</div><div class="field-value">${displayType}</div></div>
      <div class="field"><div class="field-label">Marca</div><div class="field-value">${os.marca || "Não informado"}</div></div>
      <div class="field"><div class="field-label">Modelo</div><div class="field-value">${viewingOS.modelo_equipamento || "Não informado"}</div></div>
      <div class="field"><div class="field-label">Nº Série</div><div class="field-value">${viewingOS.numero_serie || "Não informado"}</div></div>
    </div>
  </div>

${mobilityHTML}
 
   ${os.tipo_os === "revisao" && checklistRevisaoItems && checklistRevisaoItems.length > 0 ? `
     <div class="section">
       <div class="section-title">Checklist de Revisão</div>
       <table style="${tableStyle}">
         <colgroup><col style="width:70%"><col style="width:30%"></colgroup>
         <thead><tr>
           <th style="${thStyle}">Item</th>
           <th style="${thStyle}text-align:center">Status</th>
         </tr></thead>
         <tbody>
           ${checklistRevisaoItems.map(item => `<tr>
             <td style="${tdStyle}">${item.label}${item.obrigatorio ? ' <span style="color:red">*</span>' : ''}</td>
             <td style="${tdStyle}text-align:center;font-weight:600;color:${item.marcado ? '#16a34a' : '#dc2626'}">${item.marcado ? '✓ Marcado' : '✗ Desmarcado'}</td>
           </tr>`).join("")}
         </tbody>
       </table>
     </div>` : ""}
 
   ${checklistItems.length > 0 || os.condicao_visual ? `
    <div class="section">
      <div class="section-title">Checklist e Condição</div>
      <div class="grid">
        ${checklistItems.length > 0 ? `<div class="field full-width"><div class="field-label">Itens Entregues</div><div class="field-value">${checklistItems.join(", ")}</div></div>` : ""}
        ${os.condicao_visual ? `<div class="field full-width"><div class="field-label">Condição Visual</div><div class="field-value">${os.condicao_visual}</div></div>` : ""}
      </div>
    </div>` : ""}

  <div class="section">
    <div class="section-title">Diagnóstico</div>
    <div class="grid">
      <div class="field full-width"><div class="field-label">Defeito Relatado</div><div class="field-value" style="white-space: pre-wrap;">${viewingOS.descricao_problema || "Não informado"}</div></div>
      ${viewingOS.diagnostico ? `<div class="field full-width"><div class="field-label">Diagnóstico Técnico</div><div class="field-value" style="white-space: pre-wrap;">${viewingOS.diagnostico || "Não informado"}</div></div>` : ""}
    </div>
  </div>

  ${itensHtml}
  ${totalLine}

  <div class="section">
    <div class="section-title">Datas</div>
    <div class="grid">
      <div class="field"><div class="field-label">Entrada</div><div class="field-value">${fmtDt(viewingOS.data_entrada)}</div></div>
      <div class="field"><div class="field-label">Previsão</div><div class="field-value">${fmtDt(viewingOS.data_previsao)}</div></div>
      ${viewingOS.data_conclusao ? `<div class="field"><div class="field-label">Conclusão</div><div class="field-value">${fmtDt(viewingOS.data_conclusao)}</div></div>` : ""}
      ${viewingOS.data_entrega ? `<div class="field"><div class="field-label">Entrega</div><div class="field-value">${fmtDt(viewingOS.data_entrega)}</div></div>` : ""}
    </div>
  </div>

  ${cleanObs ? `<div class="section"><div class="section-title">Observações</div><p style="font-size:12px; white-space: pre-wrap;">${cleanObs}</p></div>` : ""}

  <div class="footer-sigs">
    <div class="signature">
      ${finalTecnicoNome}<br/>
      Técnico Responsável
    </div>
    <div class="signature">
      ${viewingOS.clientes?.nome || "Cliente"}
    </div>
  </div>

  <div class="legal-terms">
    ${getLegalTermsHTML().replace(/<[^>]*>?/gm, " ")}
  </div>
  
  <div style="margin-top: 15px; text-align: center; font-size: 8px; color: #999;">
    Gerado em ${new Date().toLocaleString('pt-BR')} via LivreOS
  </div>

  <script>
    window.onload = () => {
      window.print();
    };
  </script>
</body>
</html>`;
};
