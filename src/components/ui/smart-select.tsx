import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SmartSelectOption {
  id: string;
  label: string;
  sublabel?: string;
  extra?: string;
}

interface SmartSelectProps {
  label?: string;
  placeholder?: string;
  options: SmartSelectOption[];
  value?: string;
  onSelect: (option: SmartSelectOption) => void;
  onClear?: () => void;
  onCreateNew?: (searchTerm: string) => void;
  createLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function SmartSelect({
  label,
  placeholder = "Buscar...",
  options,
  value,
  onSelect,
  onClear,
  onCreateNew,
  createLabel = "Cadastrar novo",
  loading,
  disabled,
  required,
  className,
}: SmartSelectProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = value ? options.find(o => o.id === value) : null;

  const filtered = search.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.sublabel?.toLowerCase().includes(search.toLowerCase()) ||
        o.extra?.toLowerCase().includes(search.toLowerCase())
      )
    : options;

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

  const handleSelect = useCallback((option: SmartSelectOption) => {
    onSelect(option);
    setSearch("");
    setIsOpen(false);
  }, [onSelect]);

  const handleClear = useCallback(() => {
    onClear?.();
    setSearch("");
    setIsOpen(false);
  }, [onClear]);

  if (selected) {
    return (
      <div className={cn("space-y-1.5", className)}>
        {label && <label className="text-xs font-medium text-foreground">{label}{required && ' *'}</label>}
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-primary/30 bg-primary/5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{selected.label}</p>
            {selected.sublabel && <p className="text-xs text-muted-foreground truncate">{selected.sublabel}</p>}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={cn("relative space-y-1.5", className)}>
      {label && <label className="text-xs font-medium text-foreground">{label}{required && ' *'}</label>}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9 h-9 text-sm"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100">
          {filtered.length === 0 && !onCreateNew && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              Nenhum resultado encontrado
            </div>
          )}
          {filtered.length === 0 && onCreateNew && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              Nenhum resultado encontrado
            </div>
          )}
          {filtered.slice(0, 20).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option)}
              className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-b-0"
            >
              <p className="text-sm font-medium text-foreground">{option.label}</p>
              {option.sublabel && <p className="text-xs text-muted-foreground">{option.sublabel}</p>}
            </button>
          ))}
          {onCreateNew && (
            <button
              type="button"
              onClick={() => {
                onCreateNew(search);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors border-t border-border/50 bg-primary/[0.02]"
            >
              <Plus className="h-3.5 w-3.5" />
              {search ? `${createLabel}: "${search}"` : createLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
