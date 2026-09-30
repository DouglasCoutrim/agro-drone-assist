import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, Search, Package, Wrench, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { NumberInput } from "@/components/ui/number-input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, getErrorMessage } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface OSItem {
  id?: string;
  tipo: "produto" | "servico";
  produto_id?: string | null;
  servico_id?: string | null;
  descricao: string;
  codigo?: string;
  quantidade: number;
  unidade?: string;
  valor_unitario: number;
  valor_total: number;
}

interface CatalogItem {
  id: string;
  descricao: string;
  preco: number;
  tipo: "produto" | "servico";
  codigo?: string;
  categoria?: string;
}

interface OSItemsSectionProps {
  items: OSItem[];
  onChange: (items: OSItem[]) => void;
  organizationId?: string | null;
  disabled?: boolean;
}

function ItemSearchRow({
  tipo,
  onAdd,
  organizationId,
  existingIds,
  disabled,
}: {
  tipo: "produto" | "servico";
  onAdd: (item: OSItem) => void;
  organizationId?: string | null;
  existingIds: Set<string>;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateName, setQuickCreateName] = useState("");
  const [quickCreatePrice, setQuickCreatePrice] = useState(0);
  const [quickCreateUnit, setQuickCreateUnit] = useState("UN");
  const [creating, setCreating] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const term = `%${search.trim()}%`;
        if (tipo === "produto") {
          let query = supabase.from("produtos").select("id, descricao, preco_venda, codigo, categoria").or(`descricao.ilike.${term},codigo.ilike.${term}`).limit(8);
          if (organizationId) {
            query = query.eq("organization_id", organizationId);
          }
          const { data } = await query;
          setResults((data || []).map(p => ({ id: p.id, descricao: p.descricao, preco: p.preco_venda, tipo: "produto" as const, codigo: p.codigo || undefined, categoria: p.categoria || undefined })));
        } else {
          let query = supabase.from("servicos").select("id, descricao, preco").ilike("descricao", term).limit(8);
          if (organizationId) {
            query = query.eq("organization_id", organizationId);
          }
          const { data } = await query;
          setResults((data || []).map(s => ({ id: s.id, descricao: s.descricao, preco: s.preco, tipo: "servico" as const })));
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, tipo, organizationId]);

  const handleSelect = (cat: CatalogItem) => {
    onAdd({
      tipo: cat.tipo,
      produto_id: cat.tipo === "produto" ? cat.id : null,
      servico_id: cat.tipo === "servico" ? cat.id : null,
      descricao: cat.descricao,
      codigo: cat.codigo,
      quantidade: 1,
      unidade: cat.tipo === "produto" ? "UN" : "HR",
      valor_unitario: cat.preco,
      valor_total: cat.preco,
    });
    setSearch("");
    setIsOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleQuickCreate = async () => {
    if (!quickCreateName.trim()) return;
    setCreating(true);
    try {
      let orgId = organizationId || null;
      if (!orgId) {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw new Error("Sessão expirada. Faça login novamente.");
        const { data: profile } = await supabase
          .from("profiles").select("organization_id").eq("id", auth.user.id).maybeSingle();
        orgId = profile?.organization_id || null;
      }
      if (!orgId) {
        throw new Error("Sua conta não está vinculada a uma empresa. Contate o administrador.");
      }
      if (tipo === "produto") {
        const { data: existing } = await supabase
          .from("produtos").select("id, descricao, preco_venda, codigo")
          .eq("organization_id", orgId).ilike("descricao", quickCreateName.trim()).maybeSingle();
        let row = existing;
        if (!row) {
          const { data, error } = await supabase.from("produtos").insert({
            descricao: quickCreateName.trim(), preco_venda: quickCreatePrice, custo_unitario: 0,
            categoria: "geral", codigo: null, organization_id: orgId,
          }).select("id, descricao, preco_venda, codigo").single();
          if (error) throw error;
          row = data;
          toast.success(`"${data.descricao}" cadastrado!`);
        }
        onAdd({
          tipo: "produto", produto_id: row.id, servico_id: null,
          descricao: row.descricao, codigo: row.codigo || undefined,
          quantidade: 1, unidade: quickCreateUnit, valor_unitario: row.preco_venda ?? quickCreatePrice,
          valor_total: row.preco_venda ?? quickCreatePrice,
        });
      } else {
        const { data: existing } = await supabase
          .from("servicos").select("id, descricao, preco")
          .eq("organization_id", orgId).ilike("descricao", quickCreateName.trim()).maybeSingle();
        let row = existing;
        if (!row) {
          const { data, error } = await supabase.from("servicos").insert({
            descricao: quickCreateName.trim(), preco: quickCreatePrice,
            organization_id: orgId,
          }).select("id, descricao, preco").single();
          if (error) throw error;
          row = data;
          toast.success(`"${data.descricao}" cadastrado!`);
        }
        onAdd({
          tipo: "servico", produto_id: null, servico_id: row.id,
          descricao: row.descricao, quantidade: 1, unidade: "HR",
          valor_unitario: row.preco ?? quickCreatePrice, valor_total: row.preco ?? quickCreatePrice,
        });
      }

      setQuickCreateOpen(false);
      setSearch("");
      setQuickCreateName("");
      setQuickCreatePrice(0);
      setQuickCreateUnit("UN");
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setCreating(false); }
  };

  const filtered = results.filter(r => !existingIds.has(r.id));
  const exactMatch = results.some(r => r.descricao.toLowerCase() === search.trim().toLowerCase());
  const placeholder = tipo === "produto" ? "Buscar peça ou produto..." : "Buscar serviço...";

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
            placeholder={placeholder}
            disabled={disabled}
            className="h-10 text-sm pl-8"
          />
          {loading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>

        {isOpen && search.trim() && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-52 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100">
            {filtered.length === 0 && !loading && (
              <div className="px-3 py-3 text-center text-sm text-muted-foreground">Nenhum resultado</div>
            )}
            {filtered.map((cat) => (
              <button key={cat.id} type="button" onClick={() => handleSelect(cat)}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-b-0 flex items-center gap-2">
                {cat.tipo === "produto" ? <Package className="h-4 w-4 text-blue-500 shrink-0" /> : <Wrench className="h-4 w-4 text-amber-500 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{cat.descricao}</p>
                  {cat.codigo && <p className="text-xs text-muted-foreground">{cat.codigo}</p>}
                </div>
                <span className="text-sm font-semibold text-primary shrink-0">{formatCurrency(cat.preco)}</span>
              </button>
            ))}
            {!exactMatch && search.trim() && (
              <button type="button"
                onClick={() => { setQuickCreateName(search.trim()); setQuickCreateOpen(true); setIsOpen(false); }}
                className="w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors border-t border-border/50">
                <Plus className="h-4 w-4" />
                Cadastrar "{search.trim()}"
              </button>
            )}
          </div>
        )}
      </div>

      <Dialog open={quickCreateOpen} onOpenChange={setQuickCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Cadastrar {tipo === "produto" ? "Produto" : "Serviço"}</DialogTitle>
            <DialogDescription className="sr-only">Cadastro rápido de item</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Input value={quickCreateName} onChange={(e) => setQuickCreateName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Preço de Venda (R$)</Label>
                <NumberInput step="0.01" min="0" value={quickCreatePrice} onChange={setQuickCreatePrice} className="h-9 text-sm" placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unidade</Label>
                <Input value={quickCreateUnit} onChange={(e) => setQuickCreateUnit(e.target.value)} className="h-9 text-sm" placeholder="UN" />
              </div>
            </div>
            <Button size="sm" className="w-full gradient-primary" onClick={handleQuickCreate} disabled={creating}>
              {creating && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Salvar e Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Mobile card for a single item
function ItemCard({
  item,
  index,
  onUpdate,
  onRemove,
  disabled,
}: {
  item: OSItem;
  index: number;
  onUpdate: (field: keyof OSItem, value: any) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-card/50 px-2 py-1.5 space-y-1">
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <span className="text-[10px] font-bold text-muted-foreground shrink-0">{index + 1}.</span>
          <p className="text-[12px] font-medium truncate flex-1">{item.descricao}</p>
        </div>
        {!disabled && (
          <Button type="button" size="icon" variant="ghost"
            className="h-5 w-5 text-destructive/60 hover:text-destructive shrink-0 p-0"
            onClick={onRemove}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-[22%_40%_1fr] gap-1 items-center">
        <NumberInput
          min="1"
          value={item.quantidade}
          onChange={(v) => onUpdate("quantidade", Math.max(1, v))}
          className="h-7 text-[11px] px-1.5 w-full min-w-0 text-center" disabled={disabled}
          placeholder="Qtd"
        />
        <NumberInput
          step="0.01" min="0"
          value={item.valor_unitario}
          onChange={(v) => onUpdate("valor_unitario", v)}
          className="h-7 text-[11px] px-1.5 w-full min-w-0" disabled={disabled}
          placeholder="Unit."
        />
        <div className="h-7 flex items-center justify-end text-[11px] font-semibold text-primary px-1 truncate">
          {formatCurrency(item.valor_total)}
        </div>
      </div>
    </div>
  );
}

export function OSItemsSection({ items, onChange, organizationId, disabled }: OSItemsSectionProps) {
  const produtos = items.filter(i => i.tipo === "produto");
  const servicos = items.filter(i => i.tipo === "servico");
  const existingIds = new Set(items.map(i => i.produto_id || i.servico_id || "").filter(Boolean));

  const updateItem = (index: number, field: keyof OSItem, value: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    if (field === "quantidade" || field === "valor_unitario") {
      updated[index].valor_total = updated[index].quantidade * updated[index].valor_unitario;
    }
    onChange(updated);
  };

  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));
  const addItem = (item: OSItem) => onChange([...items, item]);

  const totalProdutos = produtos.reduce((s, i) => s + i.valor_total, 0);
  const totalServicos = servicos.reduce((s, i) => s + i.valor_total, 0);
  const totalGeral = totalProdutos + totalServicos;

  const getGlobalIndex = (tipo: "produto" | "servico", localIdx: number) => {
    let count = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].tipo === tipo) {
        if (count === localIdx) return i;
        count++;
      }
    }
    return -1;
  };

  const renderSection = (sectionItems: OSItem[], tipo: "produto" | "servico") => {
    const isProduct = tipo === "produto";
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {isProduct ? <Package className="h-4 w-4 text-blue-500" /> : <Wrench className="h-4 w-4 text-amber-500" />}
          <h4 className="text-sm font-bold">{isProduct ? "Itens / Peças" : "Serviços executados"}</h4>
          {sectionItems.length > 0 && (
            <span className="ml-auto text-xs font-semibold text-primary">
              {formatCurrency(isProduct ? totalProdutos : totalServicos)}
            </span>
          )}
        </div>
        <div className="border-t-2 border-primary" />

        {/* Item cards */}
        <div className="space-y-2">
          {sectionItems.map((item, localIdx) => {
            const globalIdx = getGlobalIndex(tipo, localIdx);
            return (
              <ItemCard
                key={globalIdx}
                item={item}
                index={localIdx}
                onUpdate={(field, value) => updateItem(globalIdx, field, value)}
                onRemove={() => removeItem(globalIdx)}
                disabled={disabled}
              />
            );
          })}
        </div>

        {/* Search to add */}
        {!disabled && (
          <ItemSearchRow
            tipo={tipo}
            onAdd={addItem}
            organizationId={organizationId}
            existingIds={existingIds}
            disabled={disabled}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderSection(produtos, "produto")}
      <Separator />
      {renderSection(servicos, "servico")}

      {items.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col items-end gap-1 text-sm">
            {produtos.length > 0 && <p>Peças: <span className="font-semibold">{formatCurrency(totalProdutos)}</span></p>}
            {servicos.length > 0 && <p>Serviços: <span className="font-semibold">{formatCurrency(totalServicos)}</span></p>}
            <p className="text-base font-bold">Total: <span className="text-primary">{formatCurrency(totalGeral)}</span></p>
          </div>
        </>
      )}
    </div>
  );
}
