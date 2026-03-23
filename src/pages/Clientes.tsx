import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Search, Plus, Phone, Mail, MapPin, User, Building, Edit, Trash2, Loader2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { useViaCep } from "@/hooks/useViaCep";
import { UF_LIST } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Cliente = Tables<"clientes">;

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const { fetchCep, loading: cepLoading } = useViaCep();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [viewingCliente, setViewingCliente] = useState<Cliente | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [formData, setFormData] = useState({
    nome: "", telefone: "", email: "", cpf_cnpj: "",
    endereco: "", cidade: "", estado: "", cep: "", observacoes: ""
  });

  useEffect(() => { fetchClientes(); }, []);

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase.from('clientes').select('*').order('nome');
      if (error) throw error;
      setClientes(data || []);
    } catch { toast.error('Erro ao carregar clientes'); } finally { setLoading(false); }
  };

  const createAsaasCustomer = async (clienteData: typeof formData, clienteId: string) => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/asaas?action=create_customer`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: clienteData.nome,
            email: clienteData.email || undefined,
            phone: clienteData.telefone || undefined,
            cpfCnpj: clienteData.cpf_cnpj || undefined,
            postalCode: clienteData.cep?.replace(/\D/g, '') || undefined,
            address: clienteData.endereco || undefined,
            province: clienteData.cidade || undefined,
            externalReference: clienteId,
          }),
        }
      );
      const result = await res.json();
      if (result.id) {
        await supabase.from('clientes').update({ asaas_id: result.id } as any).eq('id', clienteId);
        toast.success('Cliente sincronizado com Asaas!');
      } else if (result.errors) {
        console.warn('Asaas sync warning:', result.errors);
        toast.warning('Cliente criado localmente. Falha ao sincronizar com Asaas.');
      }
    } catch (err) {
      console.warn('Asaas sync failed:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (editingCliente) {
        const { error } = await supabase.from('clientes').update(formData).eq('id', editingCliente.id);
        if (error) throw error;
        toast.success('Cliente atualizado!');
        // Re-sync with Asaas if no asaas_id yet
        if (!(editingCliente as any).asaas_id) {
          createAsaasCustomer(formData, editingCliente.id);
        }
      } else {
        const { data, error } = await supabase.from('clientes').insert(formData).select('id').single();
        if (error) throw error;
        toast.success('Cliente criado!');
        if (data?.id) createAsaasCustomer(formData, data.id);
      }
      setDialogOpen(false); resetForm(); fetchClientes();
    } catch (error: any) { toast.error('Erro: ' + error.message); } finally { setFormLoading(false); }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome, telefone: cliente.telefone, email: cliente.email || "",
      cpf_cnpj: cliente.cpf_cnpj || "", endereco: cliente.endereco || "",
      cidade: cliente.cidade || "", estado: cliente.estado || "",
      cep: cliente.cep || "", observacoes: cliente.observacoes || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este cliente?')) return;
    try {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) throw error;
      toast.success('Cliente excluído!'); fetchClientes();
    } catch (error: any) { toast.error('Erro: ' + error.message); }
  };

  const resetForm = () => {
    setFormData({ nome: "", telefone: "", email: "", cpf_cnpj: "", endereco: "", cidade: "", estado: "", cep: "", observacoes: "" });
    setEditingCliente(null);
  };

  const filteredClientes = clientes.filter(c =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.telefone.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cpf_cnpj?.includes(searchTerm)
  );

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Clientes</h1>
            <p className="text-xs text-muted-foreground">Cadastro e gestão de clientes</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gradient-primary"><Plus className="mr-1.5 h-3.5 w-3.5" />Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-base">{editingCliente ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
                <DialogDescription className="text-xs">Preencha os dados do cliente</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 space-y-1"><Label className="text-xs">Nome *</Label><Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required className="h-9" /></div>
                  <div className="space-y-1"><Label className="text-xs">Telefone *</Label><Input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} required className="h-9" /></div>
                  <div className="space-y-1"><Label className="text-xs">E-mail</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="h-9" /></div>
                  <div className="space-y-1"><Label className="text-xs">CPF/CNPJ</Label><Input value={formData.cpf_cnpj} onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })} className="h-9" /></div>
                  <div className="space-y-1">
                    <Label className="text-xs">CEP</Label>
                    <div className="relative">
                      <Input value={formData.cep} className="h-9" onChange={async (e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, cep: val });
                        const clean = val.replace(/\D/g, "");
                        if (clean.length === 8) {
                          const result = await fetchCep(clean);
                          if (result) setFormData(f => ({ ...f, cep: val, endereco: result.logradouro, cidade: result.localidade, estado: result.uf }));
                        }
                      }} placeholder="00000-000" />
                      {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    </div>
                  </div>
                  <div className="sm:col-span-2 space-y-1"><Label className="text-xs">Endereço</Label><Input value={formData.endereco} onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} className="h-9" /></div>
                  <div className="space-y-1"><Label className="text-xs">Cidade</Label><Input value={formData.cidade} onChange={(e) => setFormData({ ...formData, cidade: e.target.value })} className="h-9" /></div>
                  <div className="space-y-1">
                    <Label className="text-xs">Estado</Label>
                    <Select value={formData.estado} onValueChange={v => setFormData({ ...formData, estado: v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="UF" /></SelectTrigger>
                      <SelectContent>{UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 space-y-1"><Label className="text-xs">Observações</Label><Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={2} /></div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" size="sm" className="gradient-primary" disabled={formLoading}>
                    {formLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{editingCliente ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-3">
          <Card className="shadow-soft border-border/50"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-primary">{clientes.length}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p></CardContent></Card>
          <Card className="shadow-soft border-border/50"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-success">{clientes.filter(c => (c as any).asaas_id).length}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sincronizados</p></CardContent></Card>
          <Card className="shadow-soft border-border/50"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-warning">{clientes.filter(c => c.cpf_cnpj).length}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Com CPF/CNPJ</p></CardContent></Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, telefone, e-mail ou documento..." className="pl-9 h-9 text-xs bg-muted/30 border-border/50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        {/* List */}
        <Card className="shadow-soft border-border/50">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filteredClientes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><Users className="h-10 w-10 mx-auto mb-3 opacity-50" /><p className="text-sm">Nenhum cliente encontrado</p></div>
            ) : (
              <div className="divide-y divide-border">
                {filteredClientes.map((cliente) => (
                  <div key={cliente.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setViewingCliente(cliente)}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 rounded-full bg-primary/10 shrink-0">
                        {cliente.cpf_cnpj && cliente.cpf_cnpj.length > 14 ? <Building className="h-3.5 w-3.5 text-primary" /> : <User className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{cliente.nome}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{cliente.telefone}</span>
                          {cliente.cidade && <span className="hidden sm:flex items-center gap-1"><MapPin className="h-3 w-3" />{cliente.cidade}</span>}
                          {(cliente as any).asaas_id && <span className="text-primary text-[10px]">● Asaas</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(cliente)}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(cliente.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Client Dialog */}
        <Dialog open={!!viewingCliente} onOpenChange={(open) => { if (!open) setViewingCliente(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="text-base">Detalhes do Cliente</DialogTitle></DialogHeader>
            {viewingCliente && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><p className="text-[10px] text-muted-foreground uppercase">Nome</p><p className="font-medium">{viewingCliente.nome}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Telefone</p><p className="text-sm">{viewingCliente.telefone}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">E-mail</p><p className="text-sm">{viewingCliente.email || "-"}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">CPF/CNPJ</p><p className="text-sm">{viewingCliente.cpf_cnpj || "-"}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">CEP</p><p className="text-sm">{viewingCliente.cep || "-"}</p></div>
                  <div className="col-span-2"><p className="text-[10px] text-muted-foreground uppercase">Endereço</p><p className="text-sm">{viewingCliente.endereco || "-"}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Cidade</p><p className="text-sm">{viewingCliente.cidade || "-"}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Estado</p><p className="text-sm">{viewingCliente.estado || "-"}</p></div>
                  {(viewingCliente as any).asaas_id && <div className="col-span-2"><p className="text-[10px] text-muted-foreground uppercase">ID Asaas</p><p className="text-sm text-primary">{(viewingCliente as any).asaas_id}</p></div>}
                  {viewingCliente.observacoes && <div className="col-span-2"><p className="text-[10px] text-muted-foreground uppercase">Observações</p><p className="text-sm">{viewingCliente.observacoes}</p></div>}
                </div>
                <Separator />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => { handleEdit(viewingCliente); setViewingCliente(null); }}>
                    <Edit className="mr-1.5 h-3.5 w-3.5" />Editar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
