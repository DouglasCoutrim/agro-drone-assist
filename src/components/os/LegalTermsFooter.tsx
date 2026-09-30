export function LegalTermsFooter() {
  return (
    <div className="mt-6 border-t border-border pt-4 space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Termos e Condições</h4>
      <ul className="space-y-1.5 text-[11px] text-muted-foreground leading-relaxed">
        <li><strong>PRAZO DE RETIRADA:</strong> O cliente possui prazo máximo de 90 dias para retirada após comunicação.</li>
        <li><strong>ABANDONO:</strong> Equipamentos não retirados após 120 dias poderão ser considerados abandonados (legislação civil).</li>
        <li><strong>GARANTIA:</strong> Garantia de 90 dias apenas sobre o serviço executado, não cobrindo mau uso, quedas ou umidade.</li>
        <li><strong>DIAGNÓSTICO:</strong> Pode ser cobrada taxa de diagnóstico em caso de recusa do orçamento.</li>
      </ul>
    </div>
  );
}

export function getLegalTermsHTML(): string {
  return `
    <div style="margin-top:32px;border-top:1px solid #ddd;padding-top:16px;">
      <h4 style="font-size:10px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Termos e Condições</h4>
      <ul style="font-size:9px;color:#666;line-height:1.6;list-style:none;padding:0;margin:0;">
        <li style="margin-bottom:4px;"><strong>PRAZO DE RETIRADA:</strong> O cliente possui prazo máximo de 90 dias para retirada após comunicação.</li>
        <li style="margin-bottom:4px;"><strong>ABANDONO:</strong> Equipamentos não retirados após 120 dias poderão ser considerados abandonados (legislação civil).</li>
        <li style="margin-bottom:4px;"><strong>GARANTIA:</strong> Garantia de 90 dias apenas sobre o serviço executado, não cobrindo mau uso, quedas ou umidade.</li>
        <li style="margin-bottom:4px;"><strong>DIAGNÓSTICO:</strong> Pode ser cobrada taxa de diagnóstico em caso de recusa do orçamento.</li>
      </ul>
    </div>`;
}
