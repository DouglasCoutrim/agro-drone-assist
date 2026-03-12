import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChevronsUpDown, Check, Search, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

type ItemEstoque = Tables<"itens_estoque">;

interface ItemComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  onItemSelected?: (item: ItemEstoque) => void;
  items?: ItemEstoque[];
  onItemsChange?: () => void;
}

export function ItemCombobox({ value, onValueChange, onItemSelected, items: externalItems, onItemsChange }: ItemComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [items, setItems] = useState<ItemEstoque[]>(externalItems || []);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState({ codigo: "", descricao: "", categoria: "peça", custo_unitario: 0, preco_venda: 0 });

  useEffect(() => {
    if (externalItems) setItems(externalItems);
  }, [externalItems]);

  useEffect(() => {
    if (!externalItems) {
      supabase.from("itens_estoque").select("*").order("descricao").then(({ data }) => {
        if (data) setItems(data);
      });
    }
  }, [externalItems]);

  const filtered = items.filter(i =>
    i.descricao.toLowerCase().includes(search.toLowerCase()) ||
    i.codigo.toLowerCase().includes(search.toLowerCase())
  );

  const selectedItem = items.find(i => i.id === value);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data, error } = await supabase.from("itens_estoque").insert(newItem).select("*").single();
      if (error) throw error;
      toast.success("Peça cadastrada!");
      setQuickAddOpen(false);
      setNewItem({ codigo: "", descricao: "", categoria: "peça", custo_unitario: 0, preco_venda: 0 });
      onValueChange(data.id);
      if (onItemSelected) onItemSelected(data);
      if (onItemsChange) onItemsChange();
      const { data: refreshed } = await supabase.from("itens_estoque").select("*").order("descricao");
      if (refreshed) setItems(refreshed);
    } catch (err: any) { toast.error("Erro: " + err.message); } finally { setSaving(false); }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-9 text-sm">
            {selectedItem ? selectedItem.descricao : "Selecione uma peça..."}
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar peça..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
            </div>
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma peça encontrada</p>
            ) : (
              filtered.map(i => (
                <button
                  key={i.id}
                  type="button"
                  className={cn("w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer text-left", value === i.id && "bg-accent")}
                  onClick={() => {
                    onValueChange(i.id);
                    if (onItemSelected) onItemSelected(i);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check className={cn("h-4 w-4 shrink-0", value === i.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{i.descricao}</p>
                    <p className="text-xs text-muted-foreground">{i.codigo} • R$ {Number(i.preco_venda).toFixed(2)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="border-t p-1">
            <button
              type="button"
              className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded-sm hover:bg-accent text-primary font-medium"
              onClick={() => { setOpen(false); setQuickAddOpen(true); }}
            >
              <Plus className="h-4 w-4" />
              + Cadastrar Nova Peça
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastro Rápido de Peça</DialogTitle>
            <DialogDescription>Preencha os dados básicos da peça</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQuickAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input value={newItem.codigo} onChange={(e) => setNewItem({ ...newItem, codigo: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Input value={newItem.categoria} onChange={(e) => setNewItem({ ...newItem, categoria: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input value={newItem.descricao} onChange={(e) => setNewItem({ ...newItem, descricao: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Custo (R$)</Label>
                <Input type="number" step="0.01" value={newItem.custo_unitario} onChange={(e) => setNewItem({ ...newItem, custo_unitario: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Preço Venda (R$)</Label>
                <Input type="number" step="0.01" value={newItem.preco_venda} onChange={(e) => setNewItem({ ...newItem, preco_venda: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setQuickAddOpen(false)}>Cancelar</Button>
              <Button type="submit" className="gradient-primary" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
