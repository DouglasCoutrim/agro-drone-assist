import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  MapPin,
  User,
  Building,
  Edit,
  Trash2,
  Loader2
} from "lucide-react";
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
  const [formLoading, setFormLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    cpf_cnpj: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    observacoes: ""
  });

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');

      if (error) throw error;
      setClientes(data || []);
    } catch (error: any) {
      console.error('Error fetching clientes:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      if (editingCliente) {
        const { error } = await supabase
          .from('clientes')
          .update(formData)
          .eq('id', editingCliente.id);

        if (error) throw error;
        toast.success('Cliente atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('clientes')
          .insert(formData);

        if (error) throw error;
        toast.success('Cliente criado com sucesso!');
      }

      setDialogOpen(false);
      resetForm();
      fetchClientes();
    } catch (error: any) {
      console.error('Error saving cliente:', error);
      toast.error('Erro ao salvar cliente: ' + error.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome,
      telefone: cliente.telefone,
      email: cliente.email || "",
      cpf_cnpj: cliente.cpf_cnpj || "",
      endereco: cliente.endereco || "",
      cidade: cliente.cidade || "",
      estado: cliente.estado || "",
      cep: cliente.cep || "",
      observacoes: cliente.observacoes || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;

    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Cliente excluído com sucesso!');
      fetchClientes();
    } catch (error: any) {
      console.error('Error deleting cliente:', error);
      toast.error('Erro ao excluir cliente: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      telefone: "",
      email: "",
      cpf_cnpj: "",
      endereco: "",
      cidade: "",
      estado: "",
      cep: "",
      observacoes: ""
    });
    setEditingCliente(null);
  };

  const filteredClientes = clientes.filter(cliente =>
    cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.telefone.includes(searchTerm) ||
    cliente.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.cpf_cnpj?.includes(searchTerm)
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              Clientes
            </h1>
            <p className="text-muted-foreground">
              Gerencie o cadastro de clientes
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary shadow-medium">
                <Plus className="mr-2 h-4 w-4" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados do cliente
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone *</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpf_cnpj">CPF/CNPJ</Label>
                    <Input
                      id="cpf_cnpj"
                      value={formData.cpf_cnpj}
                      onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP</Label>
                    <div className="relative">
                      <Input
                        id="cep"
                        value={formData.cep}
                        onChange={async (e) => {
                          const val = e.target.value;
                          setFormData({ ...formData, cep: val });
                          const clean = val.replace(/\D/g, "");
                          if (clean.length === 8) {
                            const result = await fetchCep(clean);
                            if (result) {
                              setFormData(f => ({ ...f, cep: val, endereco: result.logradouro, cidade: result.localidade, estado: result.uf }));
                            }
                          }
                        }}
                        placeholder="00000-000"
                      />
                      {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      value={formData.cidade}
                      onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado</Label>
                    <Select value={formData.estado} onValueChange={v => setFormData({ ...formData, estado: v })}>
                      <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                      <SelectContent>
                        {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="gradient-primary" disabled={formLoading}>
                    {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingCliente ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{clientes.length}</p>
                <p className="text-sm text-muted-foreground">Total de Clientes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{clientes.filter(c => c.email).length}</p>
                <p className="text-sm text-muted-foreground">Com E-mail</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-warning">{clientes.filter(c => c.cpf_cnpj).length}</p>
                <p className="text-sm text-muted-foreground">Com CPF/CNPJ</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone, e-mail ou documento..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Clients List */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Lista de Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredClientes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum cliente encontrado</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredClientes.map((cliente) => (
                  <div key={cliente.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-full bg-primary/10">
                            {cliente.cpf_cnpj && cliente.cpf_cnpj.length > 14 ? 
                              <Building className="h-4 w-4 text-primary" /> : 
                              <User className="h-4 w-4 text-primary" />
                            }
                          </div>
                          <div>
                            <p className="font-bold">{cliente.nome}</p>
                            <p className="text-xs text-muted-foreground">{cliente.cpf_cnpj || 'Sem documento'}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{cliente.telefone}</span>
                        </div>
                        {cliente.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate">{cliente.email}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        {cliente.cidade && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{cliente.cidade}{cliente.estado ? ` - ${cliente.estado}` : ''}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(cliente)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(cliente.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
