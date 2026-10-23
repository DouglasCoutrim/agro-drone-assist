import { useEffect, useState } from "react";

/** Balão automático para qualquer botão/link que mostre só um ícone. */
const ICON_LABELS: Record<string, string> = {
  "trash": "Excluir", "trash-2": "Excluir", "pencil": "Editar", "edit": "Editar", "square-pen": "Editar", "pen": "Editar",
  "eye": "Visualizar", "eye-off": "Ocultar", "plus": "Adicionar", "x": "Fechar", "search": "Pesquisar",
  "download": "Baixar", "upload": "Enviar arquivo", "printer": "Imprimir", "share": "Compartilhar", "share-2": "Compartilhar",
  "send": "Enviar", "message-circle": "WhatsApp", "phone": "Ligar", "mail": "E-mail", "copy": "Copiar",
  "refresh-cw": "Atualizar", "rotate-cw": "Atualizar", "settings": "Configurações", "bell": "Notificações",
  "log-out": "Sair", "menu": "Menu", "chevron-left": "Anterior", "chevron-right": "Próximo",
  "chevrons-left": "Primeira página", "chevrons-right": "Última página", "chevron-down": "Expandir", "chevron-up": "Recolher",
  "arrow-left": "Voltar", "shield": "Papéis e permissões", "shield-check": "Permissões", "file-text": "Documento / PDF",
  "file-down": "Baixar PDF", "file-code": "XML", "dollar-sign": "Financeiro", "credit-card": "Cobrança",
  "check": "Confirmar", "circle-check": "Concluir", "ban": "Cancelar", "sun": "Tema claro", "moon": "Tema escuro",
  "more-horizontal": "Mais opções", "ellipsis": "Mais opções", "more-vertical": "Mais opções", "ellipsis-vertical": "Mais opções",
  "calendar": "Escolher data", "filter": "Filtrar", "camera": "Foto", "image": "Imagem", "paperclip": "Anexar",
  "map-pin": "Localização", "user-plus": "Novo usuário", "key": "Senha", "lock": "Bloquear", "unlock": "Desbloquear",
  "save": "Salvar", "external-link": "Abrir em nova aba", "panel-left": "Recolher menu", "info": "Informações",
};

function labelFor(el: HTMLElement): string | null {
  const own = el.getAttribute("aria-label") || el.dataset.tip || el.getAttribute("title");
  if (own) return own;
  if ((el.textContent || "").trim().length > 0) return null; // já tem texto visível
  const svg = el.querySelector("svg[class*='lucide-']");
  if (!svg) return null;
  const cls = Array.from(svg.classList).find((c) => c.startsWith("lucide-") && c !== "lucide-icon");
  return cls ? ICON_LABELS[cls.slice(7)] ?? null : null;
}

export function GlobalIconTooltip() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  useEffect(() => {
    let current: HTMLElement | null = null;
    const over = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.("button, a, [role='button']") as HTMLElement | null;
      if (el === current) return;
      current = el;
      if (!el) return setTip(null);
      const text = labelFor(el);
      if (!text) return setTip(null);
      if (el.hasAttribute("title")) { el.dataset.tip = el.getAttribute("title")!; el.removeAttribute("title"); }
      const r = el.getBoundingClientRect();
      setTip({ text, x: r.left + r.width / 2, y: r.top });
    };
    const hide = () => { current = null; setTip(null); };
    document.addEventListener("mouseover", over);
    document.addEventListener("mousedown", hide);
    window.addEventListener("scroll", hide, true);
    return () => { document.removeEventListener("mouseover", over); document.removeEventListener("mousedown", hide); window.removeEventListener("scroll", hide, true); };
  }, []);
  if (!tip) return null;
  return (
    <div role="tooltip" className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-full rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md border"
      style={{ left: tip.x, top: tip.y - 6 }}>
      {tip.text}
    </div>
  );
}
