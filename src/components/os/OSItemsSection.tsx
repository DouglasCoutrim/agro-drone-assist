import { useState, useEffect, useRef } from "react";
import { Trash2, Search, Package, Wrench, Loader2, Plus } from "lucide-react";
import { EstoqueItemDialog, ServicoDialog } from "@/components/os/QuickCatalogDialogs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NumberInput } from "@/components/ui/number-input";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { ItensAccordion } from "@/components/itens/ItensAccordion";
import { toast } from "sonner";
import { limitarPercentualDesconto, calcularValorDesconto, calcularTotalComDesconto } from "@/lib/desconto";

export interface OSItem {
  id?: string;
  tipo: "produto" | "servico";
  produto_id?: string | null;
  item_estoque_id?: string | null;
  servico_id?: string | null;
  descricao: string;
  codigo?: string;
  quantidade: number;
  unidade?: string;
  valor_unitario: number;
  valor_total: number;
  desconto_percentual?: number;
  desconto_valor?: number;
  desconto_maximo_percentual?: number;
}

interface CatalogItem {
  id: string;
  descricao: string;
  preco: number;
  tipo: "produto" | "servico";
  codigo?: string;
  categoria?: string;
  quantidade?: number;
  desconto_maximo_percentual?: number;
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const safe = search.trim().replace(/[,()%]/g, " ");
        const term = `%${safe}%`;
        if (tipo === "produto") {
          let query = supabase.from("itens_estoque").select("id, descricao, preco_venda, codigo, categoria, quantidade, desconto_maximo_percentual").or(`descricao.ilike.${term},codigo.ilike.${term}`).order("descricao").limit(20);
          if (organizationId) query = query.eq("organization_id", organizationId);
          const { data } = await query;
          setResults((data || []).map(p => ({ id: p.id, descricao: p.descricao, preco: Number(p.preco_venda) || 0, tipo: "produto" as const, codigo: p.codigo || undefined, categoria: p.categoria || undefined, quantidade: p.quantidade, desconto_maximo_percentual: Number(p.desconto_maximo_percentual) || 0 })));
        } else {
          let query = supabase.from("servicos").select("id, descricao, preco, desconto_maximo_percentual").ilike("descricao", term).order("descricao").limit(20);
          if (organizationId) query = query.eq("organization_id", organizationId);
          const { data } = await query;
          setResults((data || []).map(s => ({ id: s.id, descricao: s.descricao, preco: Number(s.preco) || 0, tipo: "servico" as const, desconto_maximo_percentual: Number(s.desconto_maximo_percentual) || 0 })));
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, tipo, organizationId]);

  const handleSelect = (cat: CatalogItem) => {
    onAdd({
      tipo: cat.tipo,
      produto_id: null,
      item_estoque_id: cat.tipo === "produto" ? cat.id : null,
      servico_id: cat.tipo === "servico" ? cat.id : null,
      descricao: cat.descricao,
      codigo: cat.codigo,
      quantidade: 1,
      unidade: cat.tipo === "produto" ? "UN" : "HR",
      valor_unitario: cat.preco,
      valor_total: cat.preco,
      desconto_percentual: 0,
      desconto_valor: 0,
      desconto_maximo_percentual: Number(cat.desconto_maximo_percentual) || 0,
    });
    setSearch("");
    setIsOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const openCreate = () => { setCreateName(search.trim()); setIsOpen(false); setCreateOpen(true); };

  const filtered = results.filter(r => !existingIds.has(r.id));
  const placeholder = tipo === "produto" ? "Buscar peça ou produto do estoque..." : "Buscar serviço...";

  return (
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

        {tipo === "produto" ? (
          <EstoqueItemDialog open={createOpen} onOpenChange={setCreateOpen} organizationId={organizationId} initialName={createName}
            onSaved={(i) => handleSelect({ id: i.id, descricao: i.descricao, preco: Number(i.preco_venda) || 0, tipo: "produto", codigo: i.codigo, categoria: i.categoria })} />
        ) : (
          <ServicoDialog open={createOpen} onOpenChange={setCreateOpen} organizationId={organizationId} initialName={createName}
            onSaved={(s) => handleSelect({ id: s.id, descricao: s.descricao, preco: Number(s.preco) || 0, tipo: "servico" })} />
        )}

        {isOpen && search.trim() && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100">
            {filtered.length === 0 && !loading && (
              <div className="px-3 py-2 text-center text-sm text-muted-foreground">Nenhum resultado.</div>
            )}
            {!loading && (
              <button type="button" onClick={openCreate}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b border-border/30 flex items-center gap-2 text-sm font-medium text-primary">
                <Plus className="h-4 w-4" />
                {tipo === "produto" ? `Cadastrar no estoque: "${search.trim()}"` : `Cadastrar serviço: "${search.trim()}"`}
              </button>
            )}
            {filtered.map((cat) => (
              <button key={cat.id} type="button" onClick={() => handleSelect(cat)}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-b-0 flex items-center gap-2">
                {cat.tipo === "produto" ? <Package className="h-4 w-4 text-blue-500 shrink-0" /> : <Wrench className="h-4 w-4 text-amber-500 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{cat.descricao}</p>
                  <p className="text-xs text-muted-foreground">{[cat.codigo, cat.categoria, cat.quantidade != null ? `Estoque: ${cat.quantidade}` : null].filter(Boolean).join(" · ")}</p>
                </div>
                <span className="text-sm font-semibold text-primary shrink-0">{formatCurrency(cat.preco)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
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
      <div className="grid grid-cols-[20%_34%_22%_1fr] gap-1 items-center">
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
        <NumberInput
          step="0.1" min="0" max={item.desconto_maximo_percentual ?? 0}
          value={item.desconto_percentual ?? 0}
          onChange={(v) => onUpdate("desconto_percentual", v)}
          className="h-7 text-[11px] px-1.5 w-full min-w-0 text-center" disabled={disabled}
          placeholder="Desc %"
          title={`Desconto máximo: ${item.desconto_maximo_percentual ?? 0}%`}
        />
        <div className="h-7 flex items-center justify-end text-[11px] font-semibold text-primary px-1 truncate">
          {formatCurrency(item.valor_total)}
        </div>
      </div>
      {(item.desconto_valor ?? 0) > 0 && (
        <p className="text-[10px] text-muted-foreground text-right">
          Desconto: - {formatCurrency(item.desconto_valor ?? 0)} ({item.desconto_percentual ?? 0}%)
        </p>
      )}
    </div>
  );
}

export function OSItemsSection({ items, onChange, organizationId, disabled }: OSItemsSectionProps) {
  const produtos = items.filter(i => i.tipo === "produto");
  const servicos = items.filter(i => i.tipo === "servico");
  const existingIds = new Set(items.map(i => i.item_estoque_id || i.produto_id || i.servico_id || "").filter(Boolean));

  const updateItem = (index: number, field: keyof OSItem, value: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value } as OSItem;

    // O usuário informa o percentual; o valor em R$ é derivado e limitado ao teto do item.
    if (field === "desconto_percentual") {
      const { percentual, limitado } = limitarPercentualDesconto(Number(value) || 0, item.desconto_maximo_percentual);
      if (limitado) toast.warning(`Desconto máximo deste item: ${item.desconto_maximo_percentual ?? 0}%`);
      item.desconto_percentual = percentual;
    }

    if (field === "quantidade" || field === "valor_unitario" || field === "desconto_percentual") {
      const percentual = limitarPercentualDesconto(item.desconto_percentual, item.desconto_maximo_percentual).percentual;
      item.desconto_percentual = percentual;
      item.desconto_valor = calcularValorDesconto(item.quantidade, item.valor_unitario, percentual);
      item.valor_total = calcularTotalComDesconto(item.quantidade, item.valor_unitario, percentual);
    }

    updated[index] = item;
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

  const renderMobileSection = (sectionItems: OSItem[], tipo: "produto" | "servico") => {
    const isProduct = tipo === "produto";
    const mobileItems = sectionItems.map((it, localIdx): OSItem & { id: string } => ({
      ...it,
      id: it.id ?? `${tipo}-${getGlobalIndex(tipo, localIdx)}`,
    }));
    const subtotal = isProduct ? totalProdutos : totalServicos;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {isProduct ? <Package className="h-4 w-4 text-blue-500" /> : <Wrench className="h-4 w-4 text-amber-500" />}
          <h4 className="text-sm font-bold">{isProduct ? "Itens / Peças" : "Serviços executados"}</h4>
          {sectionItems.length > 0 && (
            <span className="ml-auto text-xs font-semibold text-primary">{formatCurrency(subtotal)}</span>
          )}
        </div>
        <div className="border-t-2 border-primary" />

        <ItensAccordion
          itens={mobileItems}
          renderResumo={(item) => (
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium">{item.descricao || "Item sem descrição"}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {item.quantidade} × {formatCurrency(item.valor_unitario)}
              </span>
              {(item.desconto_percentual ?? 0) > 0 && (
                <span className="shrink-0 text-xs font-medium text-destructive">-{item.desconto_percentual}%</span>
              )}
              <span className="shrink-0 font-semibold text-primary">{formatCurrency(item.valor_total)}</span>
            </div>
          )}
          renderCampos={(item, idx) => {
            const globalIdx = getGlobalIndex(tipo, idx);
            return (
              <div className="space-y-2">
                <NumberInput
                  min="1"
                  value={item.quantidade}
                  onChange={(v) => updateItem(globalIdx, "quantidade", Math.max(1, v))}
                  className="h-11 w-full text-sm text-center"
                  disabled={disabled}
                  placeholder="Qtd"
                />
                <NumberInput
                  step="0.01"
                  min="0"
                  value={item.valor_unitario}
                  onChange={(v) => updateItem(globalIdx, "valor_unitario", v)}
                  className="h-11 w-full text-sm"
                  disabled={disabled}
                  placeholder="Unit."
                />
                <NumberInput
                  step="0.1"
                  min="0"
                  max={item.desconto_maximo_percentual ?? 0}
                  value={item.desconto_percentual ?? 0}
                  onChange={(v) => updateItem(globalIdx, "desconto_percentual", v)}
                  className="h-11 w-full text-sm text-center"
                  disabled={disabled}
                  placeholder={`Desconto % (máx ${item.desconto_maximo_percentual ?? 0}%)`}
                />
                <div className="flex h-11 items-center justify-end text-sm font-semibold text-primary">
                  {formatCurrency(item.valor_total)}
                </div>
              </div>
            );
          }}
          isVazio={(item) => !item.item_estoque_id && !item.produto_id && !item.servico_id && !item.descricao?.trim()}
          onAdd={() => {
            if (disabled) return;
            addItem({
              tipo,
              produto_id: null,
              item_estoque_id: null,
              servico_id: null,
              descricao: "",
              quantidade: 1,
              unidade: isProduct ? "UN" : "HR",
              valor_unitario: 0,
              valor_total: 0,
            });
          }}
          onRemove={(idx) => {
            if (disabled) return;
            removeItem(getGlobalIndex(tipo, idx));
          }}
          total={formatCurrency(subtotal)}
          totalLabel={isProduct ? "Total de peças" : "Total de serviços"}
        />

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
      {/* Desktop: layout atual (inalterado) */}
      <div className="hidden md:block space-y-6">
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

      {/* Mobile: lista de itens em accordion (mesmos totais do desktop) */}
      <div className="md:hidden space-y-6">
        {renderMobileSection(produtos, "produto")}
        <Separator />
        {renderMobileSection(servicos, "servico")}

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
    </div>
  );
}
