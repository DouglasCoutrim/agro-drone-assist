import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Search, Plus, Phone, Mail, MapPin, User, Building, Edit, Trash2, Loader2, Eye, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { useViaCep } from "@/hooks/useViaCep";
import { UF_LIST } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Cliente = Tables<"clientes">;

// Parse infrastructure metadata from observacoes
const parseInfra = (obs: string) => {
  const match = obs.match(/\[INFRA:\s*SSID:(.*?)\s*\|\s*SenhaWifi:(.*?)\s*\|\s*SenhaRouter:(.*?)\s*\|\s*FaixaIP:(.*?)\s*\|\s*Gateway:(.*?)\s*\|\s*DNS:(.*?)\]/);
  if (match) return { ssid: match[1] === "-" ? "" : match[1], senha_wifi: match[2] === "-" ? "" : match[2], senha_router: match[3] === "-" ? "" : match[3], faixa_ip: match[4] === "-" ? "" : match[4], gateway: match[5] === "-" ? "" : match[5], dns: match[6] === "-" ? "" : match[6] };
  return { ssid: "", senha_wifi: "", senha_router: "", faixa_ip: "", gateway: "", dns: "" };
};

const buildInfraTag = (infra: ReturnType<typeof parseInfra>) => {
  const hasAny = infra.ssid || infra.senha_wifi || infra.senha_router || infra.faixa_ip || infra.gateway || infra.dns;
  if (!hasAny) return "";
  return `[INFRA: SSID:${infra.ssid || "-"} | SenhaWifi:${infra.senha_wifi || "-"} | SenhaRouter:${infra.senha_router || "-"} | FaixaIP:${infra.faixa_ip || "-"} | Gateway:${infra.gateway || "-"} | DNS:${infra.dns || "-"}]`;
};

const cleanInfraFromObs = (obs: string) => obs.replace(/\[INFRA:[\s\S]*?\]/g, "").trim();

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

  const [infraData, setInfraData] = useState({ ssid: "", senha_wifi: "", senha_router: "", faixa_ip: "", gateway: "", dns: "" });

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
      const { data: result, error } = await supabase.functions.invoke('asaas-customer-sync', {
        body: { nome: clienteData.nome, email: clienteData.email, telefone: clienteData.telefone, cpf_cnpj: clienteData.cpf_cnpj, cep: clienteData.cep, endereco: clienteData.endereco, cidade: clienteData.cidade, clienteId },
      });
      if (error) throw error;
      if (result?.asaas_id) {
        await supabase.from('clientes').update({ asaas_id: result.asaas_id } as any).eq('id', clienteId);
        toast.success(result.reused ? 'Cliente vinculado ao Asaas (já existente)!' : 'Cliente sincronizado com Asaas!');
      } else if (result?.error) {
        toast.warning('Cliente criado localmente. Asaas: ' + result.error);
      }
    } catch (err) {
      console.warn('Asaas sync failed:', err);
      toast.warning('Cliente salvo. Sincronização Asaas pendente.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      // Merge infrastructure data into observacoes
      const cleanObs = cleanInfraFromObs(formData.observacoes);
      const infraTag = buildInfraTag(infraData);
      const mergedObs = infraTag ? (cleanObs ? `${cleanObs}\n${infraTag}` : infraTag) : cleanObs;
      const submitData = { ...formData, observacoes: mergedObs || "" };

      if (editingCliente) {
        const { error } = await supabase.from('clientes').update(submitData).eq('id', editingCliente.id);
        if (error) throw error;
        toast.success('Cliente atualizado!');
        if (!(editingCliente as any).asaas_id) createAsaasCustomer(submitData, editingCliente.id);
      } else {
        const { data, error } = await supabase.from('clientes').insert(submitData).select('id').single();
        if (error) throw error;
        toast.success('Cliente criado!');
        if (data?.id) createAsaasCustomer(submitData, data.id);
      }
      setDialogOpen(false); resetForm(); fetchClientes();
    } catch (error: any) { toast.error('Erro: ' + error.message); } finally { setFormLoading(false); }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    const obs = cliente.observacoes || "";
    const infra = parseInfra(obs);
    setInfraData(infra);
    setFormData({
      nome: cliente.nome, telefone: cliente.telefone, email: cliente.email || "",
      cpf_cnpj: cliente.cpf_cnpj || "", endereco: cliente.endereco || "",
      cidade: cliente.cidade || "", estado: cliente.estado || "",
      cep: cliente.cep || "", observacoes: cleanInfraFromObs(obs)
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
    setInfraData({ ssid: "", senha_wifi: "", senha_router: "", faixa_ip: "", gateway: "", dns: "" });
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
              <form onSubmit={handleSubmit}>
                <Tabs defaultValue="dados" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="dados">Dados do Cliente</TabsTrigger>
                    <TabsTrigger value="infra" className="flex items-center gap-1.5"><Wifi className="h-3.5 w-3.5" />Infraestrutura</TabsTrigger>
                  </TabsList>

                  <TabsContent value="dados" className="space-y-3 mt-4">
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
                  </TabsContent>

                  <TabsContent value="infra" className="space-y-3 mt-4">
                    <Card className="border-dashed border-primary/30 bg-primary/5">
                      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wifi className="h-4 w-4" />Inventário de Infraestrutura</CardTitle></CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground mb-4">Dados da rede do cliente. Salvos permanentemente para consulta dos técnicos em visitas futuras.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1"><Label className="text-xs">SSID do Wi-Fi</Label><Input value={infraData.ssid} onChange={(e) => setInfraData({ ...infraData, ssid: e.target.value })} placeholder="Nome da rede Wi-Fi" className="h-9" /></div>
                          <div className="space-y-1"><Label className="text-xs">Senha do Wi-Fi</Label><Input type="password" value={infraData.senha_wifi} onChange={(e) => setInfraData({ ...infraData, senha_wifi: e.target.value })} placeholder="••••••••" className="h-9" /></div>
                          <div className="space-y-1"><Label className="text-xs">Senha do Roteador</Label><Input type="password" value={infraData.senha_router} onChange={(e) => setInfraData({ ...infraData, senha_router: e.target.value })} placeholder="Acesso admin do roteador" className="h-9" /></div>
                          <div className="space-y-1"><Label className="text-xs">Faixa de IP</Label><Input value={infraData.faixa_ip} onChange={(e) => setInfraData({ ...infraData, faixa_ip: e.target.value })} placeholder="Ex: 192.168.1.0/24" className="h-9" /></div>
                          <div className="space-y-1"><Label className="text-xs">Gateway</Label><Input value={infraData.gateway} onChange={(e) => setInfraData({ ...infraData, gateway: e.target.value })} placeholder="Ex: 192.168.1.1" className="h-9" /></div>
                          <div className="space-y-1"><Label className="text-xs">DNS</Label><Input value={infraData.dns} onChange={(e) => setInfraData({ ...infraData, dns: e.target.value })} placeholder="Ex: 8.8.8.8" className="h-9" /></div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 mt-4">
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
                          {cliente.observacoes?.includes("[INFRA:") && <span className="text-primary text-[10px]">● Infra</span>}
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
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-base">Detalhes do Cliente</DialogTitle></DialogHeader>
            {viewingCliente && (() => {
              const obs = viewingCliente.observacoes || "";
              const infra = parseInfra(obs);
              const hasInfra = obs.includes("[INFRA:");
              const cleanObs = cleanInfraFromObs(obs);

              return (
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
                    {cleanObs && <div className="col-span-2"><p className="text-[10px] text-muted-foreground uppercase">Observações</p><p className="text-sm">{cleanObs}</p></div>}
                  </div>

                  {/* Infrastructure section */}
                  {hasInfra && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="text-sm font-semibold text-primary uppercase mb-3 flex items-center gap-2"><Wifi className="h-4 w-4" />Infraestrutura de Rede</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div><p className="text-[10px] text-muted-foreground uppercase">SSID Wi-Fi</p><p className="text-sm">{infra.ssid || "-"}</p></div>
                          <div><p className="text-[10px] text-muted-foreground uppercase">Senha Wi-Fi</p><p className="text-sm font-mono">{infra.senha_wifi || "-"}</p></div>
                          <div><p className="text-[10px] text-muted-foreground uppercase">Senha Roteador</p><p className="text-sm font-mono">{infra.senha_router || "-"}</p></div>
                          <div><p className="text-[10px] text-muted-foreground uppercase">Faixa de IP</p><p className="text-sm font-mono">{infra.faixa_ip || "-"}</p></div>
                          <div><p className="text-[10px] text-muted-foreground uppercase">Gateway</p><p className="text-sm font-mono">{infra.gateway || "-"}</p></div>
                          <div><p className="text-[10px] text-muted-foreground uppercase">DNS</p><p className="text-sm font-mono">{infra.dns || "-"}</p></div>
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => { handleEdit(viewingCliente); setViewingCliente(null); }}>
                      <Edit className="mr-1.5 h-3.5 w-3.5" />Editar
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
