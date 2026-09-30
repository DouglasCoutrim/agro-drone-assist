import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, FileText, Users, Package, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: "os" | "cliente" | "estoque";
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
}

const TYPE_CONFIG = {
  os: { icon: FileText, label: "Ordens de Serviço", color: "text-primary", bg: "bg-primary/10", route: "/ordens-servico" },
  cliente: { icon: Users, label: "Clientes", color: "text-blue-500", bg: "bg-blue-500/10", route: "/clientes" },
  estoque: { icon: Package, label: "Estoque", color: "text-amber-500", bg: "bg-amber-500/10", route: "/estoque" },
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const doSearch = useCallback(async (term: string) => {
    if (term.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const [osRes, clienteRes, estoqueRes] = await Promise.all([
        supabase.from("ordens_servico")
          .select("id, numero, status, descricao_problema, clientes(nome)")
          .or(`numero.ilike.%${term}%,descricao_problema.ilike.%${term}%`)
          .limit(5),
        supabase.from("clientes")
          .select("id, nome, telefone, cpf_cnpj")
          .or(`nome.ilike.%${term}%,telefone.ilike.%${term}%,cpf_cnpj.ilike.%${term}%`)
          .limit(5),
        supabase.from("itens_estoque")
          .select("id, descricao, codigo, quantidade")
          .or(`descricao.ilike.%${term}%,codigo.ilike.%${term}%`)
          .limit(5),
      ]);

      const items: SearchResult[] = [];

      (osRes.data || []).forEach((os: any) => {
        items.push({
          id: os.id,
          title: `OS ${os.numero}`,
          subtitle: os.clientes?.nome || os.descricao_problema?.slice(0, 50) || "",
          type: "os",
          badge: os.status,
          badgeVariant: "secondary",
        });
      });

      (clienteRes.data || []).forEach((c: any) => {
        items.push({
          id: c.id,
          title: c.nome,
          subtitle: c.telefone || c.cpf_cnpj || "",
          type: "cliente",
        });
      });

      (estoqueRes.data || []).forEach((e: any) => {
        items.push({
          id: e.id,
          title: e.descricao,
          subtitle: `Código: ${e.codigo} | Qtd: ${e.quantidade}`,
          type: "estoque",
          badge: e.quantidade <= 0 ? "Sem estoque" : undefined,
          badgeVariant: "destructive",
        });
      });

      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const handleResultClick = (result: SearchResult) => {
    const config = TYPE_CONFIG[result.type];
    navigate(config.route);
    setOpen(false);
  };

  if (!open) return null;

  const grouped = {
    os: results.filter(r => r.type === "os"),
    cliente: results.filter(r => r.type === "cliente"),
    estoque: results.filter(r => r.type === "estoque"),
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex flex-col items-center pt-[10vh] px-4 animate-in fade-in-0 duration-150"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-popover border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="relative border-b border-border">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar OS, clientes, peças..."
            className="w-full pl-11 pr-10 py-4 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={() => setOpen(false)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query.length < 2 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Digite pelo menos 2 caracteres para buscar
            </div>
          ) : loading ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground animate-pulse">
              Buscando...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum resultado para "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([type, items]) => {
              if (items.length === 0) return null;
              const config = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG];
              const Icon = config.icon;
              return (
                <div key={type}>
                  <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
                    {config.label}
                  </div>
                  {items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleResultClick(item)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/20 last:border-b-0"
                    >
                      <div className={cn("p-1.5 rounded", config.bg)}>
                        <Icon className={cn("h-3.5 w-3.5", config.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                      </div>
                      {item.badge && (
                        <Badge variant={item.badgeVariant || "secondary"} className="text-[10px] shrink-0">
                          {item.badge}
                        </Badge>
                      )}
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/20 text-center">
          <span className="text-[10px] text-muted-foreground">
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[9px] font-mono">Esc</kbd> para fechar
            <span className="mx-2">·</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[9px] font-mono">Ctrl+K</kbd> para abrir
          </span>
        </div>
      </div>
    </div>
  );
}

// Trigger button for header
export function GlobalSearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-muted/30 hover:bg-muted/50 transition-colors text-muted-foreground text-xs"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Buscar...</span>
      <kbd className="hidden sm:inline px-1 py-0.5 rounded bg-muted border border-border text-[9px] font-mono ml-2">⌘K</kbd>
    </button>
  );
}
