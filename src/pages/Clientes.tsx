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
          }),
        }
      );
      const result = await res.json();
      if (result.id) {
        // Save Asaas ID to the client record
        await supabase.from('clientes').update({ asaas_id: result.id } as any).eq('id', clienteId);
        toast.success('Cliente sincronizado com Asaas: ' + result.id);
      } else if (result.errors) {
        console.warn('Asaas customer creation warning:', result.errors);
        toast.warning('Cliente criado, mas não foi possível sincronizar com Asaas.');
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
      } else {
        const { data, error } = await supabase.from('clientes').insert(formData).select('id').single();
        if (error) throw error;
        toast.success('Cliente criado!');
        // Auto-create Asaas customer
        if (data?.id) {
          createAsaasCustomer(formData, data.id);
        }
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Users className="h-8 w-8 text-primary" />Clientes</h1>
            <p className="text-muted-foreground">Gerencie o cadastro de clientes</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary shadow-medium"><Plus className="mr-2 h-4 w-4" />Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingCliente ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
                <DialogDescription>Preencha os dados do cliente</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2"><Label>Nome *</Label><Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required /></div>
                  <div className="space-y-2"><Label>Telefone *</Label><Input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} required /></div>
                  <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                  <div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={formData.cpf_cnpj} onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })} /></div>
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <div className="relative">
                      <Input value={formData.cep} onChange={async (e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, cep: val });
                        const clean = val.replace(/\D/g, "");
                        if (clean.length === 8) {
                          const result = await fetchCep(clean);
                          if (result) setFormData(f => ({ ...f, cep: val, endereco: result.logradouro, cidade: result.localidade, estado: result.uf }));
                        }
                      }} placeholder="00000-000" />
                      {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                  </div>
                  <div className="col-span-2 space-y-2"><Label>Endereço</Label><Input value={formData.endereco} onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Cidade</Label><Input value={formData.cidade} onChange={(e) => setFormData({ ...formData, cidade: e.target.value })} /></div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={formData.estado} onValueChange={v => setFormData({ ...formData, estado: v })}>
                      <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                      <SelectContent>{UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2"><Label>Observações</Label><Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={3} /></div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="gradient-primary" disabled={formLoading}>
                    {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingCliente ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-soft card-hover"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{clientes.length}</p><p className="text-sm text-muted-foreground">Total de Clientes</p></CardContent></Card>
          <Card className="shadow-soft card-hover"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-success">{clientes.filter(c => c.email).length}</p><p className="text-sm text-muted-foreground">Com E-mail</p></CardContent></Card>
          <Card className="shadow-soft card-hover"><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-warning">{clientes.filter(c => c.cpf_cnpj).length}</p><p className="text-sm text-muted-foreground">Com CPF/CNPJ</p></CardContent></Card>
        </div>

        {/* Search */}
        <Card className="shadow-soft"><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar por nome, telefone, e-mail ou documento..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></CardContent></Card>

        {/* List */}
        <Card className="shadow-soft">
          <CardHeader><CardTitle>Lista de Clientes</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredClientes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><Users className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Nenhum cliente encontrado</p></div>
            ) : (
              <div className="space-y-4">
                {filteredClientes.map((cliente) => (
                  <div key={cliente.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setViewingCliente(cliente)}>
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-full bg-primary/10">
                            {cliente.cpf_cnpj && cliente.cpf_cnpj.length > 14 ? <Building className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-primary" />}
                          </div>
                          <div>
                            <p className="font-bold">{cliente.nome}</p>
                            <p className="text-xs text-muted-foreground">{cliente.cpf_cnpj || 'Sem documento'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span>{cliente.telefone}</span></div>
                        {cliente.email && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span className="truncate">{cliente.email}</span></div>}
                      </div>
                      <div className="space-y-2">
                        {cliente.cidade && <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{cliente.cidade}{cliente.estado ? ` - ${cliente.estado}` : ''}</span></div>}
                      </div>
                      <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => setViewingCliente(cliente)}><Eye className="h-4 w-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => handleEdit(cliente)}><Edit className="h-4 w-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(cliente.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
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
            <DialogHeader><DialogTitle>Detalhes do Cliente</DialogTitle></DialogHeader>
            {viewingCliente && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Nome</p><p className="font-bold text-lg">{viewingCliente.nome}</p></div>
                  <div><p className="text-xs text-muted-foreground">Telefone</p><p className="font-medium">{viewingCliente.telefone}</p></div>
                  <div><p className="text-xs text-muted-foreground">E-mail</p><p className="font-medium">{viewingCliente.email || "-"}</p></div>
                  <div><p className="text-xs text-muted-foreground">CPF/CNPJ</p><p className="font-medium">{viewingCliente.cpf_cnpj || "-"}</p></div>
                  <div><p className="text-xs text-muted-foreground">CEP</p><p className="font-medium">{viewingCliente.cep || "-"}</p></div>
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Endereço</p><p className="font-medium">{viewingCliente.endereco || "-"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Cidade</p><p className="font-medium">{viewingCliente.cidade || "-"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Estado</p><p className="font-medium">{viewingCliente.estado || "-"}</p></div>
                  {(viewingCliente as any).asaas_id && <div className="col-span-2"><p className="text-xs text-muted-foreground">ID Asaas</p><p className="font-medium text-primary">{(viewingCliente as any).asaas_id}</p></div>}
                  {viewingCliente.observacoes && <div className="col-span-2"><p className="text-xs text-muted-foreground">Observações</p><p className="text-sm">{viewingCliente.observacoes}</p></div>}
                </div>
                <Separator />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { handleEdit(viewingCliente); setViewingCliente(null); }}>
                    <Edit className="mr-2 h-4 w-4" />Editar
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
