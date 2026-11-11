import { useEffect, useState } from "react";
import logoIcon from "@/assets/logo-icon.png";
import { cn } from "@/lib/utils";

type LogoSize = "xs" | "sm" | "md" | "lg";
type LogoTone = "onDark" | "onLight";

/** O ícone é dimensionado em ~1,3x a altura do bloco de texto, como na marca oficial. */
const ICON_CLASS: Record<LogoSize, string> = {
  xs: "h-9 w-9",
  sm: "h-11 w-11",
  md: "h-14 w-14",
  lg: "h-[4.5rem] w-[4.5rem]",
};

const TITLE_CLASS: Record<LogoSize, string> = {
  xs: "text-sm",
  sm: "text-lg",
  md: "text-[22px]",
  lg: "text-3xl",
};

const SUBTITLE_CLASS: Record<LogoSize, string> = {
  xs: "text-[8px]",
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
};

const TONE_CLASS: Record<LogoTone, { title: string; subtitle: string }> = {
  onDark: { title: "text-white", subtitle: "text-emerald-300" },
  onLight: { title: "text-foreground", subtitle: "text-emerald-600" },
};

const MARGEM = 236;

/** Pixel que não faz parte do emblema: transparente ou fundo branco sólido. */
function ehFundo(data: Uint8ClampedArray, i: number) {
  return (
    data[i + 3] < 12 ||
    (data[i] > MARGEM && data[i + 1] > MARGEM && data[i + 2] > MARGEM)
  );
}

/**
 * O arquivo do emblema costuma vir com moldura vazia em volta (e, às vezes, fundo branco).
 * Aqui a imagem é recortada no limite do desenho e o fundo branco vira transparência,
 * para o ícone preencher o mesmo espaço do modelo oficial em qualquer fundo do sistema.
 */
async function normalizarEmblema(src: string): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar o emblema"));
    img.src = src;
  });

  const origem = document.createElement("canvas");
  origem.width = image.naturalWidth;
  origem.height = image.naturalHeight;
  const ctx = origem.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(image, 0, 0);

  const { width, height } = origem;
  const { data } = ctx.getImageData(0, 0, width, height);

  let topo = height;
  let esquerda = width;
  let direita = -1;
  let base = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (ehFundo(data, (y * width + x) * 4)) continue;
      if (x < esquerda) esquerda = x;
      if (x > direita) direita = x;
      if (y < topo) topo = y;
      if (y > base) base = y;
    }
  }
  if (direita < esquerda || base < topo) return src;

  const largura = direita - esquerda + 1;
  const altura = base - topo + 1;
  const destino = document.createElement("canvas");
  destino.width = largura;
  destino.height = altura;
  const ctxDestino = destino.getContext("2d");
  if (!ctxDestino) return src;
  ctxDestino.drawImage(origem, esquerda, topo, largura, altura, 0, 0, largura, altura);

  const recorte = ctxDestino.getImageData(0, 0, largura, altura);
  for (let i = 0; i < recorte.data.length; i += 4) {
    if (recorte.data[i] > MARGEM && recorte.data[i + 1] > MARGEM && recorte.data[i + 2] > MARGEM) {
      recorte.data[i + 3] = 0;
    }
  }
  ctxDestino.putImageData(recorte, 0, 0);

  return destino.toDataURL("image/png");
}

const emblemas = new Map<string, Promise<string>>();

function useEmblema(src: string) {
  const [emblema, setEmblema] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    let processado = emblemas.get(src);
    if (!processado) {
      processado = normalizarEmblema(src).catch(() => src);
      emblemas.set(src, processado);
    }
    processado.then((resultado) => {
      if (ativo) setEmblema(resultado);
    });
    return () => {
      ativo = false;
    };
  }, [src]);

  return emblema;
}

interface LivreOSLogoProps {
  /** Tamanho do conjunto (ícone + assinatura). */
  size?: LogoSize;
  /** Fundo onde a marca é aplicada: escuro (sidebar/portal admin) ou claro. */
  tone?: LogoTone;
  title?: string;
  /** Segundo a marca oficial, sempre "Enterprise". Use `null` para exibir só o nome. */
  subtitle?: string | null;
  className?: string;
}

/**
 * Marca LivreOS: ícone + "LivreOS" + "Enterprise".
 * Fonte única da identidade visual — não duplicar o lockup em telas.
 */
export function LivreOSLogo({
  size = "md",
  tone = "onDark",
  title = "LivreOS",
  subtitle = "Enterprise",
  className,
}: LivreOSLogoProps) {
  const emblema = useEmblema(logoIcon);

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span className={cn("flex shrink-0 items-center justify-center", ICON_CLASS[size])}>
        {emblema ? (
          <img
            src={emblema}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-contain"
          />
        ) : null}
      </span>
      <span className="flex flex-col justify-center text-left leading-tight">
        <span className={cn("font-bold tracking-tight", TONE_CLASS[tone].title, TITLE_CLASS[size])}>
          {title}
        </span>
        {subtitle ? (
          <span className={cn("font-medium", TONE_CLASS[tone].subtitle, SUBTITLE_CLASS[size])}>
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
