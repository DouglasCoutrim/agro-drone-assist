import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useViaCep } from "@/hooks/useViaCep";
import { UF_LIST } from "@/lib/constants";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientCreated: (clientId: string) => void;
}

export function QuickClientModal({ open, onOpenChange, onClientCreated }: Props) {
  const { fetchCep, loading: cepLoading } = useViaCep();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "", telefone: "", email: "", cpf_cnpj: "",
    cep: "", endereco: "", cidade: "", estado: "",
  });

  const handleCepChange = async (value: string) => {
    setForm(f => ({ ...f, cep: value }));
    const clean = value.replace(/\D/g, "");
    if (clean.length === 8) {
      const result = await fetchCep(clean);
      if (result) {
        setForm(f => ({
          ...f,
          endereco: result.logradouro,
          cidade: result.localidade,
          estado: result.uf,
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão expirada. Faça login novamente.");
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!profile?.organization_id) {
        throw new Error("Sua conta não está vinculada a uma empresa. Contate o administrador.");
      }
      const payload = { ...form, organization_id: profile.organization_id };
      const { data, error } = await supabase.from("clientes").insert(payload).select("id").single();
      if (error) throw error;
      toast.success("Cliente criado com sucesso!");
      onClientCreated(data.id);
      onOpenChange(false);
      setForm({ nome: "", telefone: "", email: "", cpf_cnpj: "", cep: "", endereco: "", cidade: "", estado: "" });
    } catch (err: any) {
      toast.error("Erro ao criar cliente: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Cadastro Rápido de Cliente</DialogTitle>
          <DialogDescription>Preencha os dados essenciais do cliente</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Telefone *</Label>
              <Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CPF/CNPJ</Label>
              <Input value={form.cpf_cnpj} onChange={e => setForm({ ...form, cpf_cnpj: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <div className="relative">
                <Input value={form.cep} onChange={e => handleCepChange(e.target.value)} placeholder="00000-000" />
                {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Endereço</Label>
              <Input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => setForm({ ...form, estado: v })}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="gradient-primary" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar Cliente
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
