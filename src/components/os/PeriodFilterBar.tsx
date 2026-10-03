"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PeriodPreset, PeriodRange } from "@/hooks/useTechnicianFinancials";

interface PeriodFilterBarProps {
  period: PeriodRange;
  onChange: (period: PeriodRange) => void;
  className?: string;
}

const PRESETS: { value: PeriodPreset; label: string; icon: React.ReactNode }[] = [
  { value: "current_month", label: "Mês atual", icon: <Calendar className="h-3.5 w-3.5" /> },
  { value: "last_month", label: "Mês passado", icon: <Calendar className="h-3.5 w-3.5" /> },
];

function formatDateForInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

function parseInputDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

export function PeriodFilterBar({ period, onChange, className }: PeriodFilterBarProps) {
  const [openPopover, setOpenPopover] = useState(false);
  const [customStart, setCustomStart] = useState(formatDateForInput(period.start));
  const [customEnd, setCustomEnd] = useState(formatDateForInput(period.end));
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (period.preset === "custom") {
      setCustomStart(formatDateForInput(period.start));
      setCustomEnd(formatDateForInput(period.end));
    }
  }, [period]);

  const handlePresetClick = (preset: PeriodPreset) => {
    const now = new Date();
    let start: Date, end: Date;

    if (preset === "current_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    onChange({ start, end, preset });
    setOpenPopover(false);
  };

  const handleCustomApply = () => {
    const start = parseInputDate(customStart);
    const end = parseInputDate(customEnd);
    
    if (!start || !end) return;
    if (start > end) {
      alert("Data inicial deve ser anterior à data final");
      return;
    }

    onChange({ start, end, preset: "custom" });
    setOpenPopover(false);
  };

  const getPeriodLabel = (p: PeriodRange): string => {
    if (p.preset === "current_month") return "Mês atual";
    if (p.preset === "last_month") return "Mês passado";
    
    const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return `${fmt(p.start)} - ${fmt(p.end)}`;
  };

  return (
    <div className={cn("flex items-center gap-3 flex-wrap", className)}>
      {/* Label atual */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border/50 min-w-[180px]">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{getPeriodLabel(period)}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
      </div>

      {/* Popover com opções */}
      <Popover open={openPopover} onOpenChange={setOpenPopover}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1 h-9 px-3">
            <Calendar className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Alterar período</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-72 p-0" 
          side="bottom" 
          align="start"
          ref={popoverRef}
        >
          <div className="p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Período rápido</p>
            <div className="space-y-1">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  variant={period.preset === preset.value ? "default" : "ghost"}
                  className="w-full justify-start gap-2 h-9 px-3 text-sm"
                  onClick={() => handlePresetClick(preset.value)}
                >
                  {preset.icon}
                  {preset.label}
                  {period.preset === preset.value && (
                    <span className="ml-auto text-xs text-primary font-medium">Ativo</span>
                  )}
                </Button>
              ))}
            </div>

            <hr className="my-2 border-border" />

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Período personalizado</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Início</label>
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 text-xs"
                  max={formatDateForInput(new Date())}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Fim</label>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 text-xs"
                  max={formatDateForInput(new Date())}
                />
              </div>
            </div>
            <Button 
              className="w-full gradient-primary" 
              size="sm" 
              onClick={handleCustomApply}
            >
              Aplicar período
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}