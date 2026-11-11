import logoIcon from "@/assets/logo-icon.png";
import { cn } from "@/lib/utils";

type LogoSize = "xs" | "sm" | "md" | "lg";
type LogoTone = "onDark" | "onLight";

const ICON_CLASS: Record<LogoSize, string> = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-16 w-16",
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
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <img
        src={logoIcon}
        alt=""
        aria-hidden="true"
        className={cn("shrink-0 object-contain", ICON_CLASS[size])}
      />
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
