import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, Trash2, Search, UserPlus, Percent, DollarSign, Loader2, X, User, Users, Shield, CreditCard, HelpCircle } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface OSTechnician {
  id?: string;
  ordem_servico_id: string;
  technician_id: string;
  technician_nome?: string;
  role: "PRINCIPAL" | "AUXILIARY";
  commission_type: "percentage" | "fixed";
  commission_value: number;
  payer_type: "COMPANY" | "PRINCIPAL" | "SHARED";
  net_value_received: number;
  tax_retained_amount: number;
}

interface Tecnico {
  id: string;
  nome: string;
  role?: string;
  service_commission_type?: string;
  service_commission_value?: number;
}

interface OSTechniciansSectionProps {
  technicians: OSTechnician[];
  onChange: (technicians: OSTechnician[]) => void;
  tecnicos: Tecnico[];
  organizationId?: string | null;
  disabled?: boolean;
  isMainTecnico?: boolean;
  canManage?: boolean;
  osValorServicos?: number; // Valor total dos serviços para cálculo
  osValorProdutos?: number; // Valor total dos produtos
  taxPercentageNfe?: number; // % imposto NFS-e da empresa
}

const ROLE_LABELS: Record<"PRINCIPAL" | "AUXILIARY", string> = {
  PRINCIPAL: "Principal",
  AUXILIARY: "Auxiliar",
};

const ROLE_ICONS: Record<"PRINCIPAL" | "AUXILIARY", React.ComponentType<{ className?: string }>> = {
  PRINCIPAL: User,
  AUXILIARY: Users,
};

const PAYER_LABELS: Record<"COMPANY" | "PRINCIPAL" | "SHARED", string> = {
  COMPANY: "Empresa paga",
  PRINCIPAL: "Principal paga",
  SHARED: "Rateio",
};

const PAYER_DESCRIPTIONS: Record<"COMPANY" | "PRINCIPAL" | "SHARED", string> = {
  COMPANY: "A empresa arca com a comissão do auxiliar",
  PRINCIPAL: "O técnico principal paga a comissão do auxiliar (descontada da dele)",
  SHARED: "Rateio entre empresa e principal (50/50)",
};

function TechnicianSearchRow({
  tecnicos,
  onAdd,
  existingTecnicoIds,
  disabled,
  currentRole,
}: {
  tecnicos: Tecnico[];
  onAdd: (tech: OSTechnician) => void;
  existingTecnicoIds: Set<string>;
  disabled?: boolean;
  currentRole: "PRINCIPAL" | "AUXILIARY";
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTecnico, setSelectedTecnico] = useState<Tecnico | null>(null);
  const [commissionType, setCommissionType] = useState<"percentage" | "fixed">("percentage");
  const [commissionValue, setCommissionValue] = useState(0);
  const [payerType, setPayerType] = useState<"COMPANY" | "PRINCIPAL" | "SHARED">("COMPANY");
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
    // Pré-preenche comissão com base no perfil do técnico
    if (tecnico.service_commission_type && tecnico.service_commission_value) {
      setCommissionType(tecnico.service_commission_type as "percentage" | "fixed");
      setCommissionValue(Number(tecnico.service_commission_value));
    }
    setTimeout(() => {
      const nextInput = document.querySelector('[data-commission-input="true"]') as HTMLInputElement;
      nextInput?.focus();
    }, 50);
  };

  const handleAddTechnician = () => {
    if (!selectedTecnico) return;
    onAdd({
      ordem_servico_id: "", // Será preenchido pelo pai
      technician_id: selectedTecnico.id,
      technician_nome: selectedTecnico.nome,
      role: currentRole,
      commission_type: commissionType,
      commission_value: commissionValue,
      payer_type: currentRole === "AUXILIARY" ? payerType : "COMPANY",
      net_value_received: 0,
      tax_retained_amount: 0,
    });
    // Reset
    setSelectedTecnico(null);
    setSearch("");
    setCommissionValue(0);
    setCommissionType("percentage");
    setPayerType("COMPANY");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const filtered = availableTecnicos.filter(t =>
    t.nome.toLowerCase().includes(search.toLowerCase())
  );

  const isPrincipal = currentRole === "PRINCIPAL";

  return (
    <TooltipProvider>
      <>
        <div ref={wrapperRef} className="relative w-full">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => { setSearch(e.target.value); if (!isOpen) setIsOpen(true); }}
              onFocus={() => { if (search.trim()) setIsOpen(true); }}
              placeholder={isPrincipal ? "Buscar técnico para definir como principal..." : "Buscar técnico para adicionar como auxiliar..."}
              disabled={disabled || availableTecnicos.length === 0}
              className="h-10 text-sm pl-8"
            />
          </div>

          {isOpen && search.trim() && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-52 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100">
              {filtered.length === 0 && (
                <div className="px-3 py-3 text-center text-sm text-muted-foreground">
                  {availableTecnicos.length === 0
                    ? "Todos os técnicos já estão alocados nesta OS"
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
                <Badge variant="outline" className="ml-auto text-[9px]">
                  {ROLE_LABELS[currentRole]}
                </Badge>
                <Button type="button" size="icon" variant="ghost" className="h-5 w-5 ml-auto p-0" onClick={() => setSelectedTecnico(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de Comissão</Label>
                <Select value={commissionType} onValueChange={(v) => setCommissionType(v as "percentage" | "fixed")}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">
                      <Percent className="mr-2 h-3.5 w-3.5" /> Porcentagem (%)
                    </SelectItem>
                    <SelectItem value="fixed">
                      <DollarSign className="mr-2 h-3.5 w-3.5" /> Valor Fixo (R$)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {commissionType === "fixed" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor da Comissão (R$)</Label>
                  <NumberInput
                    step="0.01"
                    min="0"
                    value={commissionValue}
                    onChange={setCommissionValue}
                    className="h-9 text-sm"
                    placeholder="0,00"
                    data-commission-input="true"
                  />
                </div>
              )}

              {commissionType === "percentage" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Porcentagem (%)</Label>
                  <div className="flex items-center gap-2">
                    <NumberInput
                      step="0.01"
                      min="0"
                      max="100"
                      value={commissionValue}
                      onChange={setCommissionValue}
                      className="h-9 text-sm flex-1"
                      placeholder="Ex: 10"
                      data-commission-input="true"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              )}

              {/* Payer type only for auxiliaries */}
              {!isPrincipal && (
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    Quem paga a comissão do auxiliar?
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-muted-foreground/50" />
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" className="max-w-xs">
                        <p className="text-xs">
                          <strong>Empresa paga:</strong> Empresa arca com o custo<br/>
                          <strong>Principal paga:</strong> Descontado da comissão do principal<br/>
                          <strong>Rateio:</strong> 50% empresa, 50% principal
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Select value={payerType} onValueChange={(v) => setPayerType(v as "COMPANY" | "PRINCIPAL" | "SHARED")}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMPANY">
                        <CreditCard className="mr-2 h-3.5 w-3.5" /> Empresa paga
                      </SelectItem>
                      <SelectItem value="PRINCIPAL">
                        <User className="mr-2 h-3.5 w-3.5" /> Principal paga
                      </SelectItem>
                      <SelectItem value="SHARED">
                        <Shield className="mr-2 h-3.5 w-3.5" /> Rateio (50/50)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">{PAYER_DESCRIPTIONS[payerType]}</p>
                </div>
              )}

              <Button size="sm" className="w-full gradient-primary" onClick={handleAddTechnician}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> {isPrincipal ? "Definir como Principal" : "Adicionar Auxiliar"}
              </Button>
            </div>
          )}
        </div>
      </>
    </TooltipProvider>
  );
}

function TechnicianCard({
  technician,
  index,
  onUpdate,
  onRemove,
  disabled,
  tecnicos,
  osValorServicos,
  osValorProdutos,
  taxPercentageNfe,
}: {
  technician: OSTechnician;
  index: number;
  onUpdate: (field: keyof OSTechnician, value: any) => void;
  onRemove: () => void;
  disabled?: boolean;
  tecnicos: Tecnico[];
  osValorServicos?: number;
  osValorProdutos?: number;
  taxPercentageNfe?: number;
}) {
  const tecnico = tecnicos.find(t => t.id === technician.technician_id);
  const isPrincipal = technician.role === "PRINCIPAL";
  const RoleIcon = ROLE_ICONS[technician.role];
  const isPercentage = technician.commission_type === "percentage";

  // Calcula estimativa de comissão e imposto
  const estimatedCommission = useMemo(() => {
    if (!osValorServicos && !osValorProdutos) return 0;
    const serviceComm = isPercentage
      ? (osValorServicos || 0) * (technician.commission_value / 100)
      : technician.commission_value;
    // Produtos usam config do profile
    const productComm = tecnico?.service_commission_type === "percentage"
      ? (osValorProdutos || 0) * ((tecnico.service_commission_value || 0) / 100)
      : (tecnico?.service_commission_value || 0);
    return serviceComm + productComm;
  }, [isPercentage, osValorServicos, osValorProdutos, technician.commission_value, tecnico]);

  const estimatedTax = useMemo(() => {
    return estimatedCommission * ((taxPercentageNfe || 0) / 100);
  }, [estimatedCommission, taxPercentageNfe]);

  const estimatedNet = estimatedCommission - estimatedTax;

  return (
    <div className="rounded-md border border-border/60 bg-card/50 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[10px] font-bold text-muted-foreground shrink-0">{index + 1}.</span>
          <RoleIcon className={cn("h-4 w-4 shrink-0", isPrincipal ? "text-primary" : "text-blue-500")} />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate flex-1">{tecnico?.nome || technician.technician_nome || "Técnico não encontrado"}</span>
            <Badge variant={isPrincipal ? "default" : "secondary"} className="text-[9px] shrink-0">
              {ROLE_LABELS[technician.role]}
            </Badge>
            {technician.commission_type === "fixed" && (
              <Badge variant="secondary" className="text-[9px] shrink-0">
                <DollarSign className="mr-0.5 h-2.5 w-2.5" /> Fixo: {formatCurrency(technician.commission_value)}
              </Badge>
            )}
            {technician.commission_type === "percentage" && (
              <Badge variant="secondary" className="text-[9px] shrink-0">
                <Percent className="mr-0.5 h-2.5 w-2.5" /> {technician.commission_value}%
              </Badge>
            )}
          </div>
        </div>
        {!disabled && !isPrincipal && (
          <Button type="button" size="icon" variant="ghost"
            className="h-6 w-6 text-destructive/60 hover:text-destructive shrink-0 p-0"
            onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {!disabled && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Tipo Comissão</Label>
            <Select value={technician.commission_type} onValueChange={(v) => onUpdate("commission_type", v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">
                  <Percent className="mr-1.5 h-3 w-3" /> Porcentagem
                </SelectItem>
                <SelectItem value="fixed">
                  <DollarSign className="mr-1.5 h-3 w-3" /> Valor Fixo
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px]">{isPercentage ? "% Comissão" : "Valor Fixo (R$)"}</Label>
            {isPercentage ? (
              <div className="flex items-center gap-1">
                <NumberInput
                  step="0.01"
                  min="0"
                  max="100"
                  value={technician.commission_value}
                  onChange={(v) => onUpdate("commission_value", v)}
                  className="h-8 text-xs flex-1"
                  placeholder="%"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            ) : (
              <NumberInput
                step="0.01"
                min="0"
                value={technician.commission_value}
                onChange={(v) => onUpdate("commission_value", v)}
                className="h-8 text-xs"
                placeholder="0,00"
              />
            )}
          </div>

          {!isPrincipal && (
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <Label className="text-[10px] flex items-center gap-1">
                Quem paga
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3 text-muted-foreground/50" />
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" className="max-w-xs">
                    <p className="text-xs">
                      <strong>Empresa paga:</strong> Empresa arca com o custo<br/>
                      <strong>Principal paga:</strong> Descontado da comissão do principal<br/>
                      <strong>Rateio:</strong> 50% empresa, 50% principal
                    </p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <Select value={technician.payer_type} onValueChange={(v) => onUpdate("payer_type", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPANY">
                    <CreditCard className="mr-1.5 h-3 w-3" /> Empresa
                  </SelectItem>
                  <SelectItem value="PRINCIPAL">
                    <User className="mr-1.5 h-3 w-3" /> Principal
                  </SelectItem>
                  <SelectItem value="SHARED">
                    <Shield className="mr-1.5 h-3 w-3" /> Rateio
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {isPrincipal && (
            <div className="space-y-1 lg:col-span-2">
              <Label className="text-[10px] text-muted-foreground">Principal da OS (não removível)</Label>
            </div>
          )}
        </div>
      )}

      {disabled && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {isPercentage ? (
            <>
              <Percent className="h-3 w-3" /> {technician.commission_value}% sobre serviços
            </>
          ) : (
            <>
              <DollarSign className="h-3 w-3" /> {formatCurrency(technician.commission_value)} fixo
            </>
          )}
          {!isPrincipal && (
            <>
              <span className="mx-1">|</span>
              <span>{PAYER_LABELS[technician.payer_type]}</span>
            </>
          )}
        </div>
      )}

      {/* Estimativas (quando há valores da OS) */}
      {(osValorServicos || osValorProdutos) && (
        <div className="pt-2 border-t border-border/30 space-y-1 text-[11px]">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Est. Comissão:</span>
            <span className="font-medium">{formatCurrency(estimatedCommission)}</span>
          </div>
          {taxPercentageNfe && taxPercentageNfe > 0 && (
            <>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Est. Imposto ({taxPercentageNfe}%):</span>
                <span className="font-medium text-orange-500">{formatCurrency(estimatedTax)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Est. Líquido:</span>
                <span className="font-bold text-green-600">{formatCurrency(estimatedNet)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Valores realizados (após cálculo) */}
      {technician.net_value_received > 0 || technician.tax_retained_amount > 0 ? (
        <div className="pt-2 border-t border-border/30 space-y-1 text-[11px]">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Recebido líquido:</span>
            <span className="font-bold text-green-600">{formatCurrency(technician.net_value_received)}</span>
          </div>
          {technician.tax_retained_amount > 0 && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Imposto retido (fundo):</span>
              <span className="font-medium text-orange-500">{formatCurrency(technician.tax_retained_amount)}</span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function OSTechniciansSection({
  technicians,
  onChange,
  tecnicos,
  organizationId,
  disabled,
  isMainTecnico,
  canManage,
  osValorServicos,
  osValorProdutos,
  taxPercentageNfe,
}: OSTechniciansSectionProps) {
  const existingTecnicoIds = useMemo(() => new Set(technicians.map(t => t.technician_id).filter(Boolean)), [technicians]);
  const principal = technicians.find(t => t.role === "PRINCIPAL");
  const auxiliaries = technicians.filter(t => t.role === "AUXILIARY");

  const updateTechnician = (index: number, field: keyof OSTechnician, value: any) => {
    const updated = [...technicians];
    (updated[index] as any)[field] = value;
    // Se mudou tipo de comissão, mantém valor (pode ser % ou fixo)
    onChange(updated);
  };

  const removeTechnician = (index: number) => onChange(technicians.filter((_, i) => i !== index));
  const addTechnician = (tech: OSTechnician) => onChange([...technicians, tech]);

  const canAddPrincipal = canManage && !disabled && !principal && tecnicos.length > 0;
  const canAddAuxiliary = canManage && !disabled && tecnicos.length > technicians.length;

  return (
    <div className="space-y-4">
      {/* Principal */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-bold">Técnico Principal</h4>
          {principal && (
            <span className="ml-auto text-xs font-semibold text-primary">
              Definido
            </span>
          )}
        </div>
        <div className="border-t-2 border-primary" />

        <div className="space-y-2">
          {principal ? (
            <TechnicianCard
              key={principal.id || "principal"}
              technician={principal}
              index={0}
              onUpdate={(field, value) => updateTechnician(technicians.indexOf(principal), field, value)}
              onRemove={() => {}} // Principal não pode ser removido aqui
              disabled={disabled || !canManage}
              tecnicos={tecnicos}
              osValorServicos={osValorServicos}
              osValorProdutos={osValorProdutos}
              taxPercentageNfe={taxPercentageNfe}
            />
          ) : (
            canAddPrincipal && (
              <TechnicianSearchRow
                tecnicos={tecnicos}
                onAdd={addTechnician}
                existingTecnicoIds={existingTecnicoIds}
                disabled={disabled}
                currentRole="PRINCIPAL"
              />
            )
          )}

          {!principal && !canAddPrincipal && (
            <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border/50 rounded-md">
              {disabled ? "Visualização apenas" : "Nenhum técnico disponível para definir como principal"}
            </div>
          )}
        </div>
      </div>

      {/* Auxiliares */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-500" />
          <h4 className="text-sm font-bold">Técnicos Auxiliares</h4>
          {auxiliaries.length > 0 && (
            <span className="ml-auto text-xs font-semibold text-blue-500">
              {auxiliaries.length} auxiliar{auxiliaries.length > 1 ? "es" : ""}
            </span>
          )}
        </div>
        <div className="border-t-2 border-blue-500" />

        <div className="space-y-2">
          {auxiliaries.map((assistant, idx) => {
            const globalIndex = technicians.indexOf(assistant);
            return (
              <TechnicianCard
                key={assistant.id || `aux-${idx}`}
                technician={assistant}
                index={globalIndex}
                onUpdate={(field, value) => updateTechnician(globalIndex, field, value)}
                onRemove={() => removeTechnician(globalIndex)}
                disabled={disabled || !canManage}
                tecnicos={tecnicos}
                osValorServicos={osValorServicos}
                osValorProdutos={osValorProdutos}
                taxPercentageNfe={taxPercentageNfe}
              />
            );
          })}

          {canAddAuxiliary && (
            <TechnicianSearchRow
              tecnicos={tecnicos}
              onAdd={addTechnician}
              existingTecnicoIds={existingTecnicoIds}
              disabled={disabled}
              currentRole="AUXILIARY"
            />
          )}

          {auxiliaries.length === 0 && !canAddAuxiliary && (
            <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border/50 rounded-md">
              {disabled ? "Visualização apenas" : "Nenhum técnico disponível para adicionar como auxiliar"}
            </div>
          )}
        </div>

        {/* Resumo das comissões auxiliares */}
        {auxiliaries.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1 text-sm">
              <p className="flex justify-between gap-2">
                <span className="text-muted-foreground">Auxiliares (fixos):</span>
                <span className="font-semibold">
                  {formatCurrency(auxiliaries.filter(a => a.commission_type === "fixed").reduce((s, a) => s + a.commission_value, 0))}
                </span>
              </p>
              <p className="flex justify-between gap-2">
                <span className="text-muted-foreground">Auxiliares (%):</span>
                <span className="font-semibold">
                  {auxiliaries.filter(a => a.commission_type === "percentage").reduce((s, a) => s + a.commission_value, 0)}%
                </span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                * Pagador: {auxiliaries.map(a => PAYER_LABELS[a.payer_type]).join(", ") || "Empresa"}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}