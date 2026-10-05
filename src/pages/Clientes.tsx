import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Search, Plus, Phone, Mail, MapPin, User, Building, Edit, Trash2, Loader2, AlertTriangle, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { useViaCep } from "@/hooks/useViaCep";
import { UF_LIST } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCpfCnpj, formatPhone, getErrorMessage } from "@/lib/formatters";
import { useOrganization } from "@/hooks/useOrganization";
import { useConfirm } from "@/hooks/useConfirm";
import { CsvImportExport, emptyToNull } from "@/components/CsvImportExport";
import { PremiumCard, KpiCard, PremiumTable, AlertBox } from "@/components/premium";

const CLIENTES_CSV_COLUMNS = [
  "nome", "telefone", "email", "cpf_cnpj",
  "endereco", "cidade", "estado", "cep", "observacoes",
];

type Cliente = Tables<"clientes">;

export default function Clientes() {
  const { organization } = useOrganization();
  const confirm = useConfirm();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const { fetchCep, loading: cepLoading } = useViaCep();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [viewingCliente, setViewingCliente] = useState<Cliente | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: "", telefone: "", email: "", cpf_cnpj: "",
    endereco: "", cidade: "", estado: "", cep: "", observacoes: ""
  });

  const isFormDirty = useMemo(
    () => !!editingCliente || Object.values(formData).some(value => String(value || "").trim() !== ""),
    [editingCliente, formData]
  );

  // Stats para KpiCard
  const totalClientes = clientes.length;
  const syncedCount = clientes.filter(c => (c as any).asaas_id).length;
  const withDocCount = clientes.filter(c => c.cpf_cnpj).length;

  useEffect(() => { if (organization?.id) fetchClientes(); }, [organization?.id]);

  const fetchClientes = async () => {
    if (!organization?.id) return;
    try {
      const { data, error } = await supabase.from('clientes').select('*').eq('organization_id', organization.id).order('nome');
      if (error) throw error;
      setClientes(data || []);
    } catch { toast.error('Erro ao carregar clientes'); } finally { setLoading(false); }
  };

  const checkDuplicate = async (cpfCnpj: string) => {
    if (!cpfCnpj || cpfCnpj.replace(/\D/g, '').length < 11) { setDuplicateWarning(null); return; }
    const { data } = await supabase.from('clientes').select('id, nome').eq('cpf_cnpj', cpfCnpj).maybeSingle();
    if (data && data.id !== editingCliente?.id) {
      setDuplicateWarning(`Cliente já cadastrado: ${data.nome}`);
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleCepChange = async (value: string) => {
    setFormData(current => ({ ...current, cep: value }));
    const cleanCep = value.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    const address = await fetchCep(cleanCep);
    if (!address) return;
    setFormData(current => ({
      ...current,
      endereco: address.logradouro,
      cidade: address.localidade,
      estado: address.uf,
    }));
  };

  const createAsaasCustomer = async (clienteData: typeof formData, clienteId: string) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('asaas-customer-sync', {
        body: { nome: clienteData.nome, email: clienteData.email, telefone: clienteData.telefone, cpf_cnpj: clienteData.cpf_cnpj, cep: clienteData.cep, endereco: clienteData.endereco, cidade: clienteData.cidade, clienteId },
      });
      if (error) throw error;
      if (result?.asaas_id) {
        await supabase.from('clientes').update({ asaas_id: result.asaas_id } as any).eq('id', clienteId);
        toast.success(result.reused ? 'Cliente vinculado ao Asaas!' : 'Sincronizado com Asaas!');
      } else if (result?.error) {
        toast.warning('Sincronização Asaas pendente.');
      }
    } catch { toast.warning('Cliente salvo. Sincronização Asaas pendente.'); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.nome.length < 3) { toast.error("Nome muito curto (mínimo 3 caracteres)"); return; }
    if (!formData.telefone) { toast.error("Informe o telefone"); return; }
    
    setFormLoading(true);
    try {
      if (editingCliente) {
        const { error } = await supabase.from('clientes').update(formData).eq('id', editingCliente.id);
        if (error) throw error;
        toast.success('Cliente atualizado!');
        if (!(editingCliente as any).asaas_id) createAsaasCustomer(formData, editingCliente.id);
      } else {
        const { data, error } = await supabase.from('clientes').insert({ ...formData, organization_id: organization?.id } as any).select('id').single();
        if (error) throw error;
        toast.success('Cliente criado!');
        if (data?.id) createAsaasCustomer(formData, data.id);
      }
      setDialogOpen(false); resetForm(); fetchClientes();
    } catch (error: any) { toast.error(getErrorMessage(error)); } finally { setFormLoading(false); }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome, telefone: cliente.telefone, email: cliente.email || "",
      cpf_cnpj: cliente.cpf_cnpj || "", endereco: cliente.endereco || "",
      cidade: cliente.cidade || "", estado: cliente.estado || "",
      cep: cliente.cep || "", observacoes: cliente.observacoes || ""
    });
    setDuplicateWarning(null);
    setDialogOpen(true);
  };

  const handleDelete = async (cliente: Cliente) => {
    try {
      const { count: osCount } = await supabase
        .from('ordens_servico')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', cliente.id);
      const impacto = osCount && osCount > 0
        ? `Este cliente possui ${osCount} Ordem(ns) de Serviço vinculada(s). `
        : '';
      const ok = await confirm({
        title: `⚠️ Deletar ${cliente.nome}?`,
        description: `Atenção: ${impacto}Deletar este cliente irá apagar permanentemente todas as Ordens de Serviço, itens, históricos e anexos vinculados a ele. Esta ação não pode ser desfeita. Deseja continuar?`,
        variant: 'destructive',
        confirmText: 'Sim, deletar tudo',
        cancelText: 'Cancelar',
      });
      if (!ok) return;
      const { error } = await supabase.from('clientes').delete().eq('id', cliente.id);
      if (error) throw error;
      toast.success('Cliente e dados vinculados excluídos.');
      fetchClientes();
    } catch (error: any) { toast.error(getErrorMessage(error)); }
  };

  const resetForm = () => {
    setFormData({ nome: "", telefone: "", email: "", cpf_cnpj: "", endereco: "", cidade: "", estado: "", cep: "", observacoes: "" });
    setEditingCliente(null);
    setDuplicateWarning(null);
  };

  const requestCloseDialog = async () => {
    if (formLoading) return;
    if (isFormDirty) {
      const ok = await confirm({
        title: "Descartar cadastro?",
        description: "Existem dados preenchidos neste formulário. Se fechar agora, as alterações não salvas serão perdidas.",
        confirmText: "Descartar",
        cancelText: "Continuar editando",
        variant: "destructive",
      });
      if (!ok) return;
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      setDialogOpen(true);
      return;
    }
    void requestCloseDialog();
  };

  const filteredClientes = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return clientes.filter(c =>
      c.nome.toLowerCase().includes(term) ||
      c.telefone.includes(searchTerm) ||
      c.email?.toLowerCase().includes(term) ||
      c.cpf_cnpj?.includes(searchTerm)
    );
  }, [clientes, searchTerm]);

  return (
    <MainLayout>
      <div className="space-y-4" data-tour="clientes-page">
        {/* Header */}
        <PremiumCard className="p-4" delay={0}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold font-display flex items-center gap-2">Clientes</h1>
                <p className="text-xs text-muted-foreground">Cadastro e gestão de clientes</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CsvImportExport
                tableName="clientes"
                organizationId={organization?.id}
                exportColumns={CLIENTES_CSV_COLUMNS}
                templateColumns={CLIENTES_CSV_COLUMNS}
                filename="clientes"
                onImported={fetchClientes}
                transformRow={(row) => {
                  const nome = (row.nome || "").trim();
                  const telefone = (row.telefone || "").trim();
                  if (!nome || !telefone) return null;
                  return {
                    nome,
                    telefone,
                    email: emptyToNull(row.email),
                    cpf_cnpj: emptyToNull(row.cpf_cnpj),
                    endereco: emptyToNull(row.endereco),
                    cidade: emptyToNull(row.cidade),
                    estado: emptyToNull(row.estado),
                    cep: emptyToNull(row.cep),
                    observacoes: emptyToNull(row.observacoes),
                  };
                }}
              />
              <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gradient-primary"><Plus className="mr-1.5 h-3.5 w-3.5" />Novo Cliente</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingCliente ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
                    <DialogDescription>
                      {editingCliente ? "Atualize os dados do cliente." : "Preencha os dados para cadastrar o cliente."}
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="cliente-nome">Nome *</Label>
                        <Input
                          id="cliente-nome"
                          value={formData.nome}
                          onChange={(event) => setFormData({ ...formData, nome: event.target.value })}
                          required
                          autoFocus
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cliente-telefone">Telefone *</Label>
                        <Input
                          id="cliente-telefone"
                          value={formData.telefone}
                          onChange={(event) => setFormData({ ...formData, telefone: formatPhone(event.target.value) })}
                          required
                          inputMode="tel"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cliente-email">E-mail</Label>
                        <Input
                          id="cliente-email"
                          type="email"
                          value={formData.email}
                          onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cliente-documento">CPF/CNPJ</Label>
                        <Input
                          id="cliente-documento"
                          value={formData.cpf_cnpj}
                          onChange={(event) => {
                            const value = formatCpfCnpj(event.target.value);
                            setFormData({ ...formData, cpf_cnpj: value });
                            void checkDuplicate(value);
                          }}
                          inputMode="numeric"
                        />
                        {duplicateWarning && <p className="text-xs text-destructive">{duplicateWarning}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cliente-cep">CEP</Label>
                        <div className="relative">
                          <Input
                            id="cliente-cep"
                            value={formData.cep}
                            onChange={(event) => void handleCepChange(event.target.value)}
                            placeholder="00000-000"
                            inputMode="numeric"
                          />
                          {cepLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                        </div>
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="cliente-endereco">Endereço</Label>
                        <Input
                          id="cliente-endereco"
                          value={formData.endereco}
                          onChange={(event) => setFormData({ ...formData, endereco: event.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cliente-cidade">Cidade</Label>
                        <Input
                          id="cliente-cidade"
                          value={formData.cidade}
                          onChange={(event) => setFormData({ ...formData, cidade: event.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cliente-estado">Estado</Label>
                        <Select value={formData.estado} onValueChange={(value) => setFormData({ ...formData, estado: value })}>
                          <SelectTrigger id="cliente-estado"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {UF_LIST.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="cliente-observacoes">Observações</Label>
                        <Textarea
                          id="cliente-observacoes"
                          value={formData.observacoes}
                          onChange={(event) => setFormData({ ...formData, observacoes: event.target.value })}
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 border-t pt-4">
                      <Button type="button" variant="outline" onClick={() => void requestCloseDialog()} disabled={formLoading}>
                        Cancelar
                      </Button>
                      <Button type="submit" className="gradient-primary" disabled={formLoading || !!duplicateWarning}>
                        {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingCliente ? "Salvar Alterações" : "Cadastrar Cliente"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </PremiumCard>

        {/* KPIs */}
        <div className="grid gap-3 grid-cols-3 sm:grid-cols-4">
          <KpiCard label="Total Clientes" value={totalClientes} icon={Users} color="blue" trend={`${syncedCount} sincronizados com Asaas`} delay={0} />
          <KpiCard label="Com CPF/CNPJ" value={withDocCount} icon={Building} color="green" delay={100} />
          <KpiCard label="Sincronizados" value={syncedCount} icon={Mail} color="purple" delay={200} />
          <KpiCard label="Taxa Documentos" value={`${totalClientes > 0 ? Math.round((withDocCount / totalClientes) * 100) : 0}%`} icon={AlertTriangle} color="orange" delay={300} />
        </div>

        {/* Search + Table */}
        <PremiumCard delay={100}>
          <div className="p-4 border-b border-border">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por nome, telefone, e-mail ou documento..." className="pl-9 h-9 text-xs bg-muted/30 border-border/50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <PremiumTable
            columns={[
              { key: "tipo", label: "Tipo", width: "w-[50px]" },
              { key: "nome", label: "Nome" },
              { key: "telefone", label: "Telefone" },
              { key: "cidade", label: "Cidade" },
              { key: "documento", label: "CPF/CNPJ" },
              { key: "asaas", label: "Asaas", width: "w-[80px]" },
              { key: "actions", label: "", width: "w-[90px]" },
            ]}
            data={filteredClientes}
            loading={loading}
            emptyMessage={searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            emptyIcon={<Users className="h-8 w-8" />}
            emptyAction={{
              label: "Cadastrar primeiro cliente",
              onClick: () => setDialogOpen(true)
            }}
            rowKey={(cliente) => cliente.id}
            striped
            hoverable
            animateRows={true}
            renderCell={(cliente, columnKey) => {
              switch (columnKey) {
                case "tipo":
                  return (
                    <div className="p-1 rounded-full bg-primary/10">
                      {cliente.cpf_cnpj && cliente.cpf_cnpj.replace(/\D/g, '').length > 11 ? (
                        <Building className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <User className="h-3.5 w-3.5 text-primary" />
                      )}
                    </div>
                  );
                case "nome":
                  return (
                    <div>
                      <p className="font-medium text-sm">{cliente.nome}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-xs">{cliente.endereco || "Sem endereço"}</p>
                    </div>
                  );
                case "telefone":
                  return <span className="text-sm">{cliente.telefone}</span>;
                case "cidade":
                  return <span className="text-sm text-muted-foreground">{cliente.cidade || "-"}</span>;
                case "documento":
                  return <span className="text-sm font-mono text-muted-foreground">{cliente.cpf_cnpj || "-"}</span>;
                case "asaas":
                  return (cliente as any).asaas_id ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      Sincronizado
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pendente</span>
                  );
                case "actions":
                  return (
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleEdit(cliente); }}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleDelete(cliente); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  );
                default:
                  return null;
              }
            }}
          />
        </PremiumCard>

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
