export interface WhatsAppOS {
  numero: string;
  clienteNome: string;
  equipamento: string;
  modelo?: string;
  defeito?: string;
  diagnostico?: string;
  valorOrcamento?: number | null;
  valorFinal?: number | null;
  previsao?: string | null;
  status?: string;
}

const fmtCur = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : 'A definir';

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '-';

export const whatsappTemplates = {
  osRecebida: (os: WhatsAppOS, nomeEmpresa: string, termos?: string) => {
    const equip = os.modelo ? `${os.equipamento} - ${os.modelo}` : os.equipamento;
    const termosBlock = termos ? `\n\n📋 *TERMOS DE SERVIÇO:*\n${termos}` : '';
    return `Olá, *${os.clienteNome}*! 👋

Aqui é da *${nomeEmpresa}*.

Recebemos o seu equipamento: *${equip}*.

📋 *OS:* ${os.numero}
🔧 Defeito: ${os.defeito || '-'}
📅 Previsão: ${fmtDate(os.previsao)}

*INFORMAÇÕES IMPORTANTES:*
• Nosso prazo de diagnóstico é de até 5 dias úteis.
• O pagamento é realizado integralmente na aprovação/retirada.
• Aceitamos Pix, Cartão e Dinheiro.
• Ao deixar seu equipamento, você concorda com nossos termos de serviço.
${termosBlock}

Qualquer dúvida, estamos à disposição! 🔧`;
  },

  orcamentoAprovacao: (os: WhatsAppOS, nomeEmpresa: string) => {
    const equip = os.modelo ? `${os.equipamento} - ${os.modelo}` : os.equipamento;
    return `Olá, *${os.clienteNome}*!

Aqui é da *${nomeEmpresa}*.

Finalizamos o diagnóstico do seu *${equip}*.

📋 *OS:* ${os.numero}
${os.diagnostico ? `🔍 *Diagnóstico:* ${os.diagnostico}\n` : ''}
💰 *Orçamento: ${fmtCur(os.valorOrcamento)}*

Responda *SIM* para aprovar ou *NÃO* para recusar.`;
  },

  osPronta: (os: WhatsAppOS, nomeEmpresa: string) => {
    const equip = os.modelo ? `${os.equipamento} - ${os.modelo}` : os.equipamento;
    return `Olá, *${os.clienteNome}*! ✅

*Boas notícias!* Seu *${equip}* está pronto para retirada.

📋 *OS:* ${os.numero}
💰 Valor: ${fmtCur(os.valorFinal || os.valorOrcamento)}

Te esperamos na oficina! 🔧`;
  },

  lembreteRetirada: (os: WhatsAppOS, nomeEmpresa: string) => {
    const equip = os.modelo ? `${os.equipamento} - ${os.modelo}` : os.equipamento;
    return `Olá, *${os.clienteNome}*! 😊

Aqui é da *${nomeEmpresa}*.

Seu *${equip}* (OS ${os.numero}) já está pronto há alguns dias. 

Passe na oficina para retirada quando puder! 🔧`;
  },

  statusUpdate: (os: WhatsAppOS, nomeEmpresa: string) => {
    const equip = os.modelo ? `${os.equipamento} - ${os.modelo}` : os.equipamento;
    return `Olá, *${os.clienteNome}*! 👋

Aqui é da *${nomeEmpresa}*.

Sua Ordem de Serviço foi atualizada:

📋 *OS:* ${os.numero}
🔧 *Equipamento:* ${equip}
📌 *Status:* ${os.status || '-'}
💰 *Valor:* ${fmtCur(os.valorOrcamento)}
${os.diagnostico ? `\n🔍 *Diagnóstico:* ${os.diagnostico}` : ''}

Qualquer dúvida, estamos à disposição!`;
  },
};

export interface CobrancaItem {
  numero: string;
  equipamento?: string;
  valor: number;
}

export interface CobrancaPagamento {
  gateway?: string;
  pix_key_type?: string;
  pix_key_value?: string;
  pix_receiver_name?: string;
  link?: string;
}

export function montarMensagemCobranca(
  clienteNome: string,
  nomeEmpresa: string,
  itens: CobrancaItem[],
  pagamento: CobrancaPagamento,
  observacao?: string
) {
  const linhas = itens
    .map(i => `• *OS ${i.numero}*${i.equipamento ? ` — ${i.equipamento}` : ''}: ${fmtCur(i.valor)}`)
    .join('\n');
  const total = itens.reduce((s, i) => s + (i.valor || 0), 0);

  let blocoPagamento = '';
  if (pagamento.pix_key_value) {
    blocoPagamento = `\n\n⚡ *Pagamento via PIX*\nChave (${pagamento.pix_key_type || 'pix'}): ${pagamento.pix_key_value}${pagamento.pix_receiver_name ? `\nTitular: ${pagamento.pix_receiver_name}` : ''}`;
  }
  if (pagamento.link) {
    blocoPagamento += `\n\n🔗 *Link de pagamento:*\n${pagamento.link}`;
  }
  if (!blocoPagamento) {
    blocoPagamento = `\n\n💳 Aceitamos Pix, Cartão e Dinheiro. Entre em contato para combinar o pagamento.`;
  }

  return `Olá, *${clienteNome}*! 👋

Aqui é da *${nomeEmpresa}*.

Segue o resumo ${itens.length > 1 ? 'das suas ordens de serviço' : 'da sua ordem de serviço'} em aberto:

${linhas}

💰 *Total: ${fmtCur(total)}*${blocoPagamento}${observacao ? `\n\n📝 ${observacao}` : ''}

Após o pagamento, por favor envie o comprovante por aqui. Obrigado! 🔧`;
}


export function openWhatsApp(telefone: string, mensagem: string) {
  const digits = telefone.replace(/\D/g, '');
  const phone = digits.startsWith('55') ? digits : `55${digits}`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`, '_blank');
}
