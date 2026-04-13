import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_FLOW = [
  { key: "recebido", label: "Recebido" },
  { key: "aguardando_diagnostico", label: "Diagnóstico" },
  { key: "aguardando_aprovacao", label: "Aprovação" },
  { key: "aprovado", label: "Aprovado" },
  { key: "em_reparo", label: "Em Reparo" },
  { key: "em_testes", label: "Testes" },
  { key: "pronto_retirada", label: "Pronto" },
  { key: "entregue", label: "Entregue" },
];

// Legacy mapping
const STATUS_MAP: Record<string, string> = {
  aberta: "recebido",
  em_andamento: "em_reparo",
  aguardando_peca: "aguardando_aprovacao",
  concluida: "pronto_retirada",
};

interface StatusPipelineProps {
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
  compact?: boolean;
}

export function StatusPipeline({ currentStatus, onStatusChange, compact }: StatusPipelineProps) {
  const normalizedStatus = STATUS_MAP[currentStatus] || currentStatus;
  const currentIndex = STATUS_FLOW.findIndex(s => s.key === normalizedStatus);

  if (normalizedStatus === "cancelada") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20">
        <div className="h-3 w-3 rounded-full bg-destructive" />
        <span className="text-sm font-medium text-destructive">Cancelado</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center overflow-x-auto pb-1 gap-0", compact ? "gap-0" : "gap-0")}>
      {STATUS_FLOW.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={step.key} className="flex items-center">
            <button
              type="button"
              onClick={() => onStatusChange?.(step.key)}
              disabled={!onStatusChange}
              className={cn(
                "flex flex-col items-center gap-1 min-w-0 transition-all",
                onStatusChange && "cursor-pointer hover:opacity-80",
                !onStatusChange && "cursor-default"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-full shrink-0 transition-all",
                  compact ? "h-6 w-6" : "h-8 w-8",
                  isDone && "bg-primary text-primary-foreground",
                  isCurrent && "border-2 border-primary text-primary ring-2 ring-primary/20 bg-background",
                  !isDone && !isCurrent && "border border-border text-muted-foreground bg-muted/30"
                )}
              >
                {isDone ? (
                  <Check className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
                ) : (
                  <Circle className={cn(compact ? "h-2 w-2" : "h-2.5 w-2.5", isCurrent && "fill-current")} />
                )}
              </div>
              <span
                className={cn(
                  "text-center whitespace-nowrap font-medium",
                  compact ? "text-[8px]" : "text-[9px]",
                  isDone && "text-primary",
                  isCurrent && "text-primary font-semibold",
                  !isDone && !isCurrent && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </button>
            {index < STATUS_FLOW.length - 1 && (
              <div
                className={cn(
                  "h-[2px] shrink-0 mx-0.5",
                  compact ? "w-3" : "w-4 sm:w-6",
                  isDone ? "bg-primary" : "bg-border",
                  "mt-[-14px]"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Get next status in the flow
export function getNextStatus(current: string): string | null {
  const normalized = STATUS_MAP[current] || current;
  const idx = STATUS_FLOW.findIndex(s => s.key === normalized);
  if (idx === -1 || idx >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1].key;
}

export function getStatusLabel(status: string): string {
  const normalized = STATUS_MAP[status] || status;
  return STATUS_FLOW.find(s => s.key === normalized)?.label || status;
}
