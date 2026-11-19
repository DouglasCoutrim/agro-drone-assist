"use client";

import { useEffect, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { todayDateInput } from "@/lib/formatters";
import { getPeriodRange, PERIOD_LABELS, type PeriodPreset, type PeriodRange } from "@/hooks/useTechnicianFinancials";

interface PeriodFilterBarProps {
  period: PeriodRange;
  onChange: (period: PeriodRange) => void;
  className?: string;
}

/** Abas de período: Hoje · Semana · Mês · Ano (+ intervalo personalizado). */
const PRESETS: PeriodPreset[] = ["hoje", "semana", "mes", "ano"];

const paraInput = (date: Date) => todayDateInput(date);

const doInput = (valor: string): Date | null => {
  if (!valor) return null;
  const d = new Date(valor + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
};

export function PeriodFilterBar({ period, onChange, className }: PeriodFilterBarProps) {
  const [open, setOpen] = useState(false);
  const [inicio, setInicio] = useState(paraInput(period.start));
  const [fim, setFim] = useState(paraInput(period.end));

  useEffect(() => {
    if (period.preset !== "custom") return;
    setInicio(paraInput(period.start));
    setFim(paraInput(period.end));
  }, [period]);

  const aplicar = () => {
    const start = doInput(inicio);
    const end = doInput(fim);
    if (!start || !end || start > end) return;
    onChange({ start, end, preset: "custom" });
    setOpen(false);
  };

  const labelCustom =
    period.preset === "custom"
      ? `${period.start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} - ${period.end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
      : "Período";

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      <div className="flex items-center rounded-lg border border-border/50 bg-muted/40 p-0.5">
        {PRESETS.map((preset) => (
          <Button
            key={preset}
            variant={period.preset === preset ? "default" : "ghost"}
            size="sm"
            className={cn("h-8 px-3 text-xs", period.preset === preset && "gradient-primary")}
            onClick={() => onChange(getPeriodRange(preset))}
          >
            {PERIOD_LABELS[preset]}
          </Button>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={period.preset === "custom" ? "default" : "outline"}
            size="sm"
            className={cn("h-8 gap-1 px-3 text-xs", period.preset === "custom" && "gradient-primary")}
          >
            <Calendar className="h-3.5 w-3.5" />
            {labelCustom}
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-3 p-3" align="end">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Início</label>
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Fim</label>
              <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <Button className="w-full gradient-primary" size="sm" onClick={aplicar}>
            Aplicar período
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
