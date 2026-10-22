import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { SearchableInput } from "@/components/ui/searchable-input";

export interface SavedEstoqueItem { id: string; descricao: string; codigo: string; categoria: string; preco_venda: number; quantidade: number }
export interface SavedServico { id: string; descricao: string; preco: number }

async function nextEstoqueCode(orgId: string) {
  const { data } = await supabase.from("itens_estoque").select("codigo").eq("organization_id", orgId);
  const nums = (data || []).map(i => i.codigo).filter(c => /^P-\d+$/.test(c)).map(c => parseInt(c.slice(2), 10));
  return `P-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(5, "0")}`;
}

export function EstoqueItemDialog({ open, onOpenChange, organizationId, initialName, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; organizationId?: string | null; initialName: string; onSaved: (i: SavedEstoqueItem) => void;
}) {
  const empty = { codigo: "", descricao: "", categoria: "", quantidade: 0, estoque_minimo: 0, custo_unitario: 0, preco_venda: 0, fornecedor: "", localizacao: "" };
  const [form, setForm] = useState(empty);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!open || !organizationId) return;
    setForm({ ...empty, descricao: initialName });
    nextEstoqueCode(organizationId).then(codigo => setForm(p => ({ ...p, codigo })));
    supabase.from("itens_estoque").select("categoria").eq("organization_id", organizationId)
      .then(({ data }) => setCategorias([...new Set((data || []).map(d => d.categoria).filter(Boolean))]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, organizationId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (busy.current || !organizationId) return;
    if (!form.descricao.trim() || !form.categoria.trim()) { toast.error("Preencha descrição e categoria"); return; }
    busy.current = true; setSaving(true);
    try {
      const payload = { ...form, descricao: form.descricao.trim(), categoria: form.categoria.trim(), organization_id: organizationId };
      let res = await supabase.from("itens_estoque").insert(payload as any).select("id, descricao, codigo, categoria, preco_venda, quantidade").single();
      if (res.error?.code === "23505") {
        const codigo = await nextEstoqueCode(organizationId);
        res = await supabase.from("itens_estoque").insert({ ...payload, codigo } as any).select("id, descricao, codigo, categoria, preco_venda, quantidade").single();
      }
      if (res.error) throw res.error;
      toast.success("Item cadastrado no estoque!");
      onSaved(res.data as SavedEstoqueItem);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao salvar item: " + (err?.code === "23505" ? "código já usado, tente novamente." : err?.message));
    } finally { busy.current = false; setSaving(false); }
  };

  const num = (k: keyof typeof form) => (v: number) => setForm(p => ({ ...p, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Cadastrar no estoque</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Código *</Label><Input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} required /></div>
            <div className="space-y-1"><Label>Categoria *</Label>
              <SearchableInput value={form.categoria} onChange={v => setForm(p => ({ ...p, categoria: v }))} suggestions={categorias} placeholder="Ex: Peças" onAddNew={v => setForm(p => ({ ...p, categoria: v }))} addNewLabel="Criar categoria" required />
            </div>
          </div>
          <div className="space-y-1"><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} required /></div>
          <div className="space-y-1"><Label>Fornecedor</Label><Input value={form.fornecedor} onChange={e => setForm(p => ({ ...p, fornecedor: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Custo unitário</Label><NumberInput step="0.01" min="0" value={form.custo_unitario} onChange={num("custo_unitario")} /></div>
            <div className="space-y-1"><Label>Preço de venda</Label><NumberInput step="0.01" min="0" value={form.preco_venda} onChange={num("preco_venda")} /></div>
            <div className="space-y-1"><Label>Quantidade</Label><NumberInput min="0" value={form.quantidade} onChange={num("quantidade")} /></div>
            <div className="space-y-1"><Label>Estoque mínimo</Label><NumberInput min="0" value={form.estoque_minimo} onChange={num("estoque_minimo")} /></div>
          </div>
          <div className="space-y-1"><Label>Localização</Label><Input value={form.localizacao} onChange={e => setForm(p => ({ ...p, localizacao: e.target.value }))} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ServicoDialog({ open, onOpenChange, organizationId, initialName, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; organizationId?: string | null; initialName: string; onSaved: (s: SavedServico) => void;
}) {
  const [form, setForm] = useState({ descricao: "", preco: 0, tempo_estimado: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm({ descricao: initialName, preco: 0, tempo_estimado: "" }); }, [open, initialName]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (saving || !organizationId) return;
    if (!form.descricao.trim()) { toast.error("Informe a descrição do serviço"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("servicos").insert({
        descricao: form.descricao.trim(), preco: Number(form.preco) || 0,
        tempo_estimado: form.tempo_estimado.trim() || null, organization_id: organizationId,
      } as any).select("id, descricao, preco").single();
      if (error) throw error;
      toast.success("Serviço cadastrado!");
      onSaved(data as SavedServico);
      onOpenChange(false);
    } catch (err: any) { toast.error("Erro ao salvar: " + err?.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Cadastrar serviço</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1"><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Preço</Label><NumberInput step="0.01" min="0" value={form.preco} onChange={v => setForm(p => ({ ...p, preco: v }))} /></div>
            <div className="space-y-1"><Label>Tempo estimado</Label><Input value={form.tempo_estimado} onChange={e => setForm(p => ({ ...p, tempo_estimado: e.target.value }))} placeholder="Ex: 2h" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
