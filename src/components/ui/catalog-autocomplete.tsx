import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Plus, Loader2, Package, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface CatalogResult {
  id: string;
  descricao: string;
  preco: number;
  tipo: "produto" | "servico";
  codigo?: string | null;
  categoria?: string | null;
}

interface CatalogAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (item: CatalogResult) => void;
  onCreateNew?: (name: string, item: CatalogResult) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  /**
   * Catálogo consultado. Sempre usa o estoque real (`itens_estoque`) para produtos;
   * o catálogo legado `produtos` não é mais lido por nenhuma tela.
   */
  source?: "all" | "produtos" | "servicos";
  /** Whether selecting an item fills only the text or triggers onSelect callback */
  mode?: "text" | "select";
  organizationId?: string | null;
  /** Current category to use when creating a new product (instead of hardcoded "geral") */
  currentCategory?: string;
  /** Disable quick creation where only previously registered items should be selected. */
  allowCreate?: boolean;
}

export function CatalogAutocomplete({
  value,
  onChange,
  onSelect,
  onCreateNew,
  placeholder = "Buscar no catálogo...",
  label,
  className,
  disabled,
  required,
  source = "produtos",
  mode = "select",
  organizationId,
  currentCategory,
  allowCreate = true,
}: CatalogAutocompleteProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CatalogResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(organizationId ?? null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value
  useEffect(() => {
    if (mode === "text") setSearch(value);
  }, [value, mode]);

  useEffect(() => {
    setOrgId(organizationId ?? null);
  }, [organizationId]);

  // Resolve a organização do usuário quando o chamador não informa.
  useEffect(() => {
    if (orgId) return;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: profile } = await supabase
        .from("profiles").select("organization_id").eq("id", auth.user.id).maybeSingle();
      if (profile?.organization_id) setOrgId(profile.organization_id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search — nunca mistura produtos e serviços na mesma lista.
  useEffect(() => {
    const term = search.trim();
    if (!term || !orgId) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const like = `%${term}%`;
        const items: CatalogResult[] = [];

        if (source !== "servicos") {
          const { data } = await supabase
            .from("itens_estoque")
            .select("id, descricao, preco_venda, codigo, categoria")
            .eq("organization_id", orgId)
            .eq("finalidade", "revenda")
            .ilike("descricao", like)
            .limit(8);
          (data || []).forEach((p) => items.push({
            id: p.id, descricao: p.descricao, preco: Number(p.preco_venda) || 0,
            tipo: "produto", codigo: p.codigo, categoria: p.categoria,
          }));
        } else {
          const { data } = await supabase
            .from("servicos")
            .select("id, descricao, preco")
            .eq("organization_id", orgId)
            .ilike("descricao", like)
            .limit(8);
          (data || []).forEach((s) => items.push({
            id: s.id, descricao: s.descricao, preco: Number(s.preco) || 0,
            tipo: "servico",
          }));
        }

        setResults(items);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, source, orgId]);

  const handleSelectItem = useCallback((item: CatalogResult) => {
    if (mode === "text") {
      setSearch(item.descricao);
      onChange(item.descricao);
    }
    onSelect?.(item);
    setIsOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [mode, onChange, onSelect]);

  const handleAddNew = useCallback(async (name: string) => {
    if (!name.trim()) return;
    if (!orgId) {
      toast.error("Sua conta não está vinculada a uma empresa. Contate o administrador.");
      return;
    }
    setAdding(true);
    try {
      if (source === "servicos") {
        const { data, error } = await supabase.from("servicos").insert({
          descricao: name.trim(), preco: 0, organization_id: orgId,
        }).select("id, descricao, preco").single();
        if (error) throw error;
        const newItem: CatalogResult = {
          id: data.id, descricao: data.descricao, preco: Number(data.preco) || 0, tipo: "servico",
        };
        toast.success(`"${data.descricao}" adicionado aos serviços`);
        if (mode === "text") { setSearch(data.descricao); onChange(data.descricao); }
        onCreateNew?.(name, newItem);
        onSelect?.(newItem);
      } else {
        const { data, error } = await supabase.from("itens_estoque").insert({
          descricao: name.trim(),
          preco_venda: 0,
          custo_unitario: 0,
          categoria: currentCategory?.trim() || "Geral",
          codigo: `P-${String(Date.now()).slice(-6)}`,
          finalidade: "revenda",
          organization_id: orgId,
        } as any).select("id, descricao, preco_venda, codigo, categoria").single();
        if (error) throw error;
        const newItem: CatalogResult = {
          id: data.id, descricao: data.descricao, preco: Number(data.preco_venda) || 0,
          tipo: "produto", codigo: data.codigo, categoria: data.categoria,
        };
        toast.success(`"${data.descricao}" adicionado ao estoque`);
        if (mode === "text") { setSearch(data.descricao); onChange(data.descricao); }
        onCreateNew?.(name, newItem);
        onSelect?.(newItem);
      }
      setIsOpen(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao cadastrar");
    } finally {
      setAdding(false);
    }
  }, [source, orgId, mode, onChange, onCreateNew, onSelect, currentCategory]);

  const displaySearch = search;
  const exactMatch = results.some(r => r.descricao.toLowerCase() === displaySearch.trim().toLowerCase());

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {label && (
        <label className="text-xs font-medium text-foreground mb-1.5 block">
          {label}{required && " *"}
        </label>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => {
            const v = e.target.value;
            setSearch(v);
            if (mode === "text") onChange(v);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => { if (search.trim()) setIsOpen(true); }}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className="pl-9 h-9 text-sm"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && displaySearch.trim() && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100">
          {results.length === 0 && !loading && (
            <div className="px-3 py-3 text-center text-sm text-muted-foreground">
              Nenhum resultado encontrado
            </div>
          )}
          {results.map((item) => (
            <button
              key={`${item.tipo}-${item.id}`}
              type="button"
              onClick={() => handleSelectItem(item)}
              className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-b-0 flex items-center gap-2"
            >
              {item.tipo === "produto" ? (
                <Package className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              ) : (
                <Wrench className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{item.descricao}</p>
                <p className="text-xs text-muted-foreground">
                  {item.codigo && `${item.codigo} · `}
                  {item.tipo === "produto" ? "Produto" : "Serviço"}
                  {item.categoria && ` · ${item.categoria}`}
                </p>
              </div>
              <span className="text-sm font-semibold text-primary shrink-0">
                {formatPrice(item.preco)}
              </span>
            </button>
          ))}
          {allowCreate && !exactMatch && displaySearch.trim() && (
            <button
              type="button"
              onClick={() => handleAddNew(displaySearch)}
              disabled={adding}
              className="w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors border-t border-border/50 bg-primary/[0.02]"
            >
              {adding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Adicionar "{displaySearch.trim()}" ao catálogo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
