import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Search, UserPlus, Percent, DollarSign, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, getErrorMessage } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";

export interface OSAssistant {
  id?: string;
  tecnico_id: string;
  tecnico_nome?: string;
  tipo_comissao: "fixo" | "porcentagem";
  valor_comissao: number;
  porcentagem_comissao: number;
}

interface Tecnico {
  id: string;
  nome: string;
  role?: string;
}

interface OSAssistantsSectionProps {
  assistants: OSAssistant[];
  onChange: (assistants: OSAssistant[]) => void;
  tecnicos: Tecnico[];
  organizationId?: string | null;
  disabled?: boolean;
  isMainTecnico?: boolean; // Se o usuário logado é o técnico principal da OS
  canManage?: boolean; // Se pode gerenciar (admin ou técnico principal)
}

function AssistantSearchRow({
  tecnicos,
  onAdd,
  existingTecnicoIds,
  disabled,
}: {
  tecnicos: Tecnico[];
  onAdd: (assistant: OSAssistant) => void;
  existingTecnicoIds: Set<string>;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTecnico, setSelectedTecnico] = useState<Tecnico | null>(null);
  const [tipoComissao, setTipoComissao] = useState<"fixo" | "porcentagem">("fixo");
  const [valorComissao, setValorComissao] = useState(0);
  const [porcentagemComissao, setPorcentagemComissao] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const availableTecnicos = tecnicos.filter(t => !existingTecnicoIds.has(t.id));

  const handleSelectTecnico = (tecnico: Tecnico) => {
    setSelectedTecnico(tecnico);
    setSearch(tecnico.nome);
    setIsOpen(false);
    setTimeout(() => {
      // Focus no campo de valor/porcentagem
      const nextInput = document.querySelector('[data-commission-input="true"]') as HTMLInputElement;
      nextInput?.focus();
    }, 50);
  };

  const handleAddAssistant = () => {
    if (!selectedTecnico) return;
    onAdd({
      tecnico_id: selectedTecnico.id,
      tecnico_nome: selectedTecnico.nome,
      tipo_comissao: tipoComissao,
      valor_comissao: tipoComissao === "fixo" ? valorComissao : 0,
      porcentagem_comissao: tipoComissao === "porcentagem" ? porcentagemComissao : 0,
    });
    // Reset
    setSelectedTecnico(null);
    setSearch("");
    setValorComissao(0);
    setPorcentagemComissao(0);
    setTipoComissao("fixo");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const filtered = availableTecnicos.filter(t =>
    t.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div ref={wrapperRef} className="relative w-full">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (!isOpen) setIsOpen(true); }}
            onFocus={() => { if (search.trim()) setIsOpen(true); }}
            placeholder="Buscar técnico para adicionar como ajudante..."
            disabled={disabled || availableTecnicos.length === 0}
            className="h-10 text-sm pl-8"
          />
        </div>

        {isOpen && search.trim() && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-52 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100">
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-center text-sm text-muted-foreground">
                {availableTecnicos.length === 0
                  ? "Todos os técnicos já estão como ajudantes"
                  : "Nenhum técnico encontrado"}
              </div>
            )}
            {filtered.map((tecnico) => (
              <button
                key={tecnico.id}
                type="button"
                onClick={() => handleSelectTecnico(tecnico)}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-b-0 flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-sm font-medium truncate">{tecnico.nome}</span>
              </button>
            ))}
          </div>
        )}

        {/* Comissão fields - shown after selecting technician */}
        {selectedTecnico && !disabled && (
          <div className="mt-3 space-y-2 p-3 rounded-md border border-primary/20 bg-primary/5 animate-in fade-in-0 zoom-in-95 duration-100">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <UserPlus className="h-3.5 w-3.5" />
              Adicionando: <span className="font-semibold">{selectedTecnico.nome}</span>
              <Button type="button" size="icon" variant="ghost" className="h-5 w-5 ml-auto p-0" onClick={() => setSelectedTecnico(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Comissão</Label>
              <Select value={tipoComissao} onValueChange={(v) => setTipoComissao(v as "fixo" | "porcentagem")}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixo">
                    <DollarSign className="mr-2 h-3.5 w-3.5" /> Valor Fixo (R$)
                  </SelectItem>
                  <SelectItem value="porcentagem">
                    <Percent className="mr-2 h-3.5 w-3.5" /> Porcentagem do Lucro dos Serviços (%)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipoComissao === "fixo" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Valor da Comissão (R$)</Label>
                <NumberInput
                  step="0.01"
                  min="0"
                  value={valorComissao}
                  onChange={setValorComissao}
                  className="h-9 text-sm"
                  placeholder="0,00"
                  data-commission-input="true"
                />
              </div>
            )}

            {tipoComissao === "porcentagem" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Porcentagem do Lucro dos Serviços (%)</Label>
                <div className="flex items-center gap-2">
                  <NumberInput
                    step="0.01"
                    min="0"
                    max="100"
                    value={porcentagemComissao}
                    onChange={setPorcentagemComissao}
                    className="h-9 text-sm flex-1"
                    placeholder="Ex: 10"
                    data-commission-input="true"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Calculado apenas sobre o lucro dos serviços (peças não geram comissão para ajudantes)
                </p>
              </div>
            )}

            <Button size="sm" className="w-full gradient-primary" onClick={handleAddAssistant}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar Ajudante
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function AssistantCard({
  assistant,
  index,
  onUpdate,
  onRemove,
  disabled,
  tecnicos,
}: {
  assistant: OSAssistant;
  index: number;
  onUpdate: (field: keyof OSAssistant, value: any) => void;
  onRemove: () => void;
  disabled?: boolean;
  tecnicos: Tecnico[];
}) {
  const tecnico = tecnicos.find(t => t.id === assistant.tecnico_id);
  const isPercentage = assistant.tipo_comissao === "porcentagem";

  return (
    <div className="rounded-md border border-border/60 bg-card/50 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[10px] font-bold text-muted-foreground shrink-0">{index + 1}.</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate flex-1">{tecnico?.nome || assistant.tecnico_nome || "Técnico não encontrado"}</span>
            {assistant.tipo_comissao === "fixo" && (
              <Badge variant="secondary" className="text-[9px] shrink-0">
                <DollarSign className="mr-0.5 h-2.5 w-2.5" /> Fixo: {formatCurrency(assistant.valor_comissao)}
              </Badge>
            )}
            {assistant.tipo_comissao === "porcentagem" && (
              <Badge variant="secondary" className="text-[9px] shrink-0">
                <Percent className="mr-0.5 h-2.5 w-2.5" /> {assistant.porcentagem_comissao}%
              </Badge>
            )}
          </div>
        </div>
        {!disabled && (
          <Button type="button" size="icon" variant="ghost"
            className="h-6 w-6 text-destructive/60 hover:text-destructive shrink-0 p-0"
            onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {!disabled && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Tipo Comissão</Label>
            <Select value={assistant.tipo_comissao} onValueChange={(v) => onUpdate("tipo_comissao", v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixo">
                  <DollarSign className="mr-1.5 h-3 w-3" /> Valor Fixo
                </SelectItem>
                <SelectItem value="porcentagem">
                  <Percent className="mr-1.5 h-3 w-3" /> % Lucro Serviços
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isPercentage ? (
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[10px]">% do Lucro dos Serviços</Label>
              <div className="flex items-center gap-1">
                <NumberInput
                  step="0.01"
                  min="0"
                  max="100"
                  value={assistant.porcentagem_comissao}
                  onChange={(v) => onUpdate("porcentagem_comissao", v)}
                  className="h-8 text-xs flex-1"
                  placeholder="%"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[10px]">Valor Fixo (R$)</Label>
              <NumberInput
                step="0.01"
                min="0"
                value={assistant.valor_comissao}
                onChange={(v) => onUpdate("valor_comissao", v)}
                className="h-8 text-xs"
                placeholder="0,00"
              />
            </div>
          )}
        </div>
      )}

      {disabled && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {isPercentage ? (
            <>
              <Percent className="h-3 w-3" /> {assistant.porcentagem_comissao}% do lucro dos serviços
            </>
          ) : (
            <>
              <DollarSign className="h-3 w-3" /> {formatCurrency(assistant.valor_comissao)} fixo
            </>
          )}
        </div>
      )}
    </div>
  );
}

import { Badge } from "@/components/ui/badge";

export function OSAssistantsSection({
  assistants,
  onChange,
  tecnicos,
  organizationId,
  disabled,
  isMainTecnico,
  canManage,
}: OSAssistantsSectionProps) {
  const existingTecnicoIds = new Set(assistants.map(a => a.tecnico_id).filter(Boolean));

  const updateAssistant = (index: number, field: keyof OSAssistant, value: any) => {
    const updated = [...assistants];
    (updated[index] as any)[field] = value;
    // Se mudou tipo de comissão, zera o outro campo
    if (field === "tipo_comissao") {
      if (value === "fixo") {
        updated[index].porcentagem_comissao = 0;
      } else {
        updated[index].valor_comissao = 0;
      }
    }
    onChange(updated);
  };

  const removeAssistant = (index: number) => onChange(assistants.filter((_, i) => i !== index));
  const addAssistant = (assistant: OSAssistant) => onChange([...assistants, assistant]);

  const totalFixos = assistants
    .filter(a => a.tipo_comissao === "fixo")
    .reduce((s, a) => s + a.valor_comissao, 0);

  const totalPercentuais = assistants
    .filter(a => a.tipo_comissao === "porcentagem")
    .reduce((s, a) => s + a.porcentagem_comissao, 0);

  const canAdd = canManage && !disabled && tecnicos.length > assistants.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-blue-500" />
        <h4 className="text-sm font-bold">Técnicos Ajudantes</h4>
        {assistants.length > 0 && (
          <span className="ml-auto text-xs font-semibold text-primary">
            {assistants.length} ajudante{assistants.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="border-t-2 border-blue-500" />

      {/* Lista de ajudantes */}
      <div className="space-y-2">
        {assistants.map((assistant, idx) => (
          <AssistantCard
            key={assistant.id || idx}
            assistant={assistant}
            index={idx}
            onUpdate={(field, value) => updateAssistant(idx, field, value)}
            onRemove={() => removeAssistant(idx)}
            disabled={disabled || !canManage}
            tecnicos={tecnicos}
          />
        ))}

        {/* Add new assistant */}
        {canAdd && (
          <AssistantSearchRow
            tecnicos={tecnicos}
            onAdd={addAssistant}
            existingTecnicoIds={existingTecnicoIds}
            disabled={disabled}
          />
        )}

        {assistants.length === 0 && !canAdd && (
          <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border/50 rounded-md">
            {disabled ? "Visualização apenas" : "Nenhum técnico disponível para adicionar como ajudante"}
          </div>
        )}
      </div>

      {/* Resumo das comissões */}
      {assistants.length > 0 && (
        <>
          <Separator />
          <div className="space-y-1 text-sm">
            <p className="flex justify-between gap-2">
              <span className="text-muted-foreground">Comissões Fixas:</span>
              <span className="font-semibold">{formatCurrency(totalFixos)}</span>
            </p>
            {totalPercentuais > 0 && (
              <p className="flex justify-between gap-2">
                <span className="text-muted-foreground">Total % sobre Lucro Serviços:</span>
                <span className="font-semibold">{totalPercentuais}%</span>
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              * Comissão por porcentagem calculada apenas sobre o lucro dos serviços (peças não geram comissão para ajudantes)
            </p>
          </div>
        </>
      )}
    </div>
  );
}