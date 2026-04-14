import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, Search, Package, Wrench, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  quantidade: number;
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

export function OSItemsSection({ items, onChange, organizationId, disabled }: OSItemsSectionProps) {
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch catalog items on search change
  useEffect(() => {
    if (!search.trim()) { setCatalog([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const term = `%${search.trim()}%`;
        const [prodRes, servRes] = await Promise.all([
          supabase.from("produtos").select("id, descricao, preco_venda, codigo, categoria").ilike("descricao", term).limit(10),
          supabase.from("servicos").select("id, descricao, preco").ilike("descricao", term).limit(10),
        ]);
        const prods: CatalogItem[] = (prodRes.data || []).map(p => ({
          id: p.id, descricao: p.descricao, preco: p.preco_venda, tipo: "produto" as const,
          codigo: p.codigo, categoria: p.categoria,
        }));
        const servs: CatalogItem[] = (servRes.data || []).map(s => ({
          id: s.id, descricao: s.descricao, preco: s.preco, tipo: "servico" as const,
        }));
        setCatalog([...prods, ...servs]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const addItemFromCatalog = useCallback((cat: CatalogItem) => {
    const newItem: OSItem = {
      tipo: cat.tipo,
      produto_id: cat.tipo === "produto" ? cat.id : null,
      servico_id: cat.tipo === "servico" ? cat.id : null,
      descricao: cat.descricao,
      quantidade: 1,
      valor_unitario: cat.preco,
      valor_total: cat.preco,
    };
    onChange([...items, newItem]);
    setSearch("");
    setIsOpen(false);
    // Return focus to search
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [items, onChange]);

  const addNewToCatalog = useCallback(async (name: string) => {
    if (!name.trim()) return;
    setAddingNew(true);
    try {
      const { data, error } = await supabase.from("produtos").insert({
        descricao: name.trim(),
        preco_venda: 0,
        custo_unitario: 0,
        categoria: "geral",
        codigo: "",
        organization_id: organizationId || null,
      }).select("id, descricao, preco_venda").single();
      if (error) throw error;
      toast.success(`"${data.descricao}" adicionado ao catálogo`);
      const newItem: OSItem = {
        tipo: "produto",
        produto_id: data.id,
        servico_id: null,
        descricao: data.descricao,
        quantidade: 1,
        valor_unitario: data.preco_venda,
        valor_total: data.preco_venda,
      };
      onChange([...items, newItem]);
      setSearch("");
      setIsOpen(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAddingNew(false);
    }
  }, [items, onChange, organizationId]);

  const updateItem = (index: number, field: keyof OSItem, value: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    if (field === "quantidade" || field === "valor_unitario") {
      updated[index].valor_total = updated[index].quantidade * updated[index].valor_unitario;
    }
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const totalGeral = items.reduce((sum, item) => sum + item.valor_total, 0);

  const filtered = catalog.filter(c =>
    !items.some(i =>
      (i.produto_id && i.produto_id === c.id) ||
      (i.servico_id && i.servico_id === c.id)
    )
  );

  const exactMatch = catalog.some(c => c.descricao.toLowerCase() === search.trim().toLowerCase());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">Itens / Serviços</Label>
        {items.length > 0 && (
          <span className="text-xs font-bold text-primary">{formatCurrency(totalGeral)}</span>
        )}
      </div>

      {/* Search autocomplete */}
      {!disabled && (
        <div ref={wrapperRef} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => { if (search.trim()) setIsOpen(true); }}
              placeholder="Buscar produto ou serviço..."
              className="pl-9 h-9 text-sm"
            />
            {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>

          {isOpen && search.trim() && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100">
              {filtered.length === 0 && !loading && !exactMatch && (
                <div className="px-3 py-3 text-center text-sm text-muted-foreground">
                  Nenhum item encontrado
                </div>
              )}
              {filtered.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => addItemFromCatalog(cat)}
                  className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-b-0 flex items-center gap-2"
                >
                  {cat.tipo === "produto" ? (
                    <Package className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  ) : (
                    <Wrench className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{cat.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {cat.codigo && `${cat.codigo} · `}
                      {cat.tipo === "produto" ? "Produto" : "Serviço"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-primary shrink-0">
                    {formatCurrency(cat.preco)}
                  </span>
                </button>
              ))}
              {!exactMatch && search.trim() && (
                <button
                  type="button"
                  onClick={() => addNewToCatalog(search)}
                  disabled={addingNew}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors border-t border-border/50 bg-primary/[0.02]"
                >
                  {addingNew ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Adicionar "{search.trim()}" ao catálogo
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Items list */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 rounded-md border border-border/50 bg-muted/20">
              {item.tipo === "produto" ? (
                <Package className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              ) : (
                <Wrench className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{item.descricao}</p>
              </div>
              <Input
                type="number"
                min="1"
                value={item.quantidade}
                onChange={(e) => updateItem(idx, "quantidade", Math.max(1, Number(e.target.value)))}
                className="h-7 w-14 text-xs text-center"
                disabled={disabled}
              />
              <span className="text-[10px] text-muted-foreground">×</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={item.valor_unitario}
                onChange={(e) => updateItem(idx, "valor_unitario", Number(e.target.value))}
                className="h-7 w-20 text-xs"
                disabled={disabled}
              />
              <span className="text-xs font-semibold text-primary w-20 text-right">
                {formatCurrency(item.valor_total)}
              </span>
              {!disabled && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(idx)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          <Separator />
          <div className="flex justify-end">
            <p className="text-sm font-bold">
              Total: <span className="text-primary">{formatCurrency(totalGeral)}</span>
            </p>
          </div>
        </div>
      )}

      {items.length === 0 && !disabled && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Busque e adicione produtos ou serviços acima
        </p>
      )}
    </div>
  );
}
