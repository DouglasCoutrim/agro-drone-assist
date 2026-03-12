import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown, Check, UserPlus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { QuickClientModal } from "@/components/os/QuickClientModal";

type Cliente = Tables<"clientes">;

interface ClientComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  clientes?: Cliente[];
  onClientesChange?: () => void;
}

export function ClientCombobox({ value, onValueChange, clientes: externalClientes, onClientesChange }: ClientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>(externalClientes || []);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (externalClientes) setClientes(externalClientes);
  }, [externalClientes]);

  useEffect(() => {
    if (!externalClientes) {
      supabase.from("clientes").select("*").order("nome").then(({ data }) => {
        if (data) setClientes(data);
      });
    }
  }, [externalClientes]);

  const filtered = clientes.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.telefone?.includes(search) ||
    c.cpf_cnpj?.includes(search)
  );

  const selectedClient = clientes.find(c => c.id === value);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
            {selectedClient ? selectedClient.nome : "Selecione um cliente..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente encontrado</p>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer text-left",
                    value === c.id && "bg-accent"
                  )}
                  onClick={() => { onValueChange(c.id); setOpen(false); setSearch(""); }}
                >
                  <Check className={cn("h-4 w-4 shrink-0", value === c.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{c.telefone}</p>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="border-t p-1">
            <button
              type="button"
              className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded-sm hover:bg-accent text-primary font-medium"
              onClick={() => { setOpen(false); setQuickClientOpen(true); }}
            >
              <UserPlus className="h-4 w-4" />
              + Cadastrar Novo Cliente
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <QuickClientModal
        open={quickClientOpen}
        onOpenChange={setQuickClientOpen}
        onClientCreated={(id) => {
          onValueChange(id);
          if (onClientesChange) onClientesChange();
          supabase.from("clientes").select("*").order("nome").then(({ data }) => {
            if (data) setClientes(data);
          });
        }}
      />
    </>
  );
}
