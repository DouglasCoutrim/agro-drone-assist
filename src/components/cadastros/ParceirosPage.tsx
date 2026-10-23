import { FormEvent, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Truck, Plus, Search, Pencil, Trash2, Loader2, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { useViaCep } from '@/hooks/useViaCep';
import { MainLayout } from '@/components/layout/MainLayout';
import { PremiumTable } from '@/components/premium/PremiumTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCpfCnpj, formatPhone, getErrorMessage } from '@/lib/formatters';
import { UF_LIST } from '@/lib/constants';
import { toast } from 'sonner';
import { paginationRange, DEFAULT_PAGE_SIZE } from '@/lib/pagination';
const emptyForm = {nome:'', nome_fantasia:'', cpf_cnpj:'', inscricao_estadual:'', contato:'', telefone:'', email:'', cep:'', endereco:'', numero:'', complemento:'', bairro:'', cidade:'', estado:'', observacoes:'', rntrc:'', ativo:true};
type Partner = typeof emptyForm & { id: string; organization_id: string };
export default function ParceirosPage({tipo}: {tipo: 'fornecedores' | 'transportadoras'}) {
 const {organization} = useOrganization();
 const {roles} = useAuth();
 const confirm = useConfirm();
 const cache = useQueryClient();
 const carrier = tipo === 'transportadoras';
 const title = carrier ? 'Transportadoras' : 'Fornecedores';
 const singular = carrier ? 'Transportadora' : 'Fornecedor';
 const Icon = carrier ? Truck : Building2;
 const canEdit = roles.some(r => r === 'admin' || r === 'tecnico');
 const [search,setSearch] = useState('');
 const [term,setTerm] = useState('');
 const [status,setStatus] = useState('todos');
 const [page,setPage] = useState(1);
 const [pageSize,setPageSize] = useState(DEFAULT_PAGE_SIZE);
 const [open,setOpen] = useState(false);
 const [editing,setEditing] = useState<Partner | null>(null);
 const [form,setForm] = useState(emptyForm);
 const [saving,setSaving] = useState(false);
 const {fetchCep,loading:cepLoading} = useViaCep();
 useEffect(() => { const timer = setTimeout(() => {setTerm(search); setPage(1);},250); return () => clearTimeout(timer); },[search]);
 useEffect(() => {setPage(1);},[status,pageSize,organization?.id,tipo]);
 const query = useQuery({queryKey:[tipo,organization?.id,term,status,page,pageSize], enabled: !!organization?.id, staleTime:30000, queryFn:async () => {
  if (!organization?.id) return {rows:[] as Partner[], total:0};
  let request = supabase.from(tipo).select('*',{count:'exact'}).eq('organization_id',organization.id).order('nome').order('id');
  const safe = term.replace(/[^\p{L}\p{N}\s@._-]/gu,'').trim();
  if (safe) request = request.or(`nome.ilike.%${safe}%,nome_fantasia.ilike.%${safe}%,cpf_cnpj.ilike.%${safe}%,contato.ilike.%${safe}%`);
  if (status !== 'todos') request = request.eq('ativo',status === 'ativos');
  const {data,count,error} = await request.range((page-1)*pageSize,page*pageSize-1);
  if (error) throw error;
  return {rows:(data || []).map(row => ({...emptyForm,...row})) as Partner[],total:count || 0};
 }});
 useEffect(() => { if(query.error) toast.error(getErrorMessage(query.error)); },[query.error]);
 const total = query.data?.total || 0;
 useEffect(() => {if(query.data) {const r = paginationRange(total,page,pageSize); if(r.currentPage !== page) setPage(r.currentPage);}},[query.data,total,page,pageSize]);
 const start = (row?: Partner) => {setEditing(row || null); setForm(row ? {...emptyForm,...row} : {...emptyForm});setOpen(true);};
 const close = async () => {
  if(saving) return;
  if(JSON.stringify(form) !== JSON.stringify(editing ? {...emptyForm,...editing} : emptyForm)) {
   if(!await confirm({title:'Descartar alterações?',description:'Os dados não salvos serão perdidos.',confirmText:'Descartar',variant:'destructive'})) return;
  }
  setOpen(false);
 };
 const save = async (event: FormEvent) => {
  event.preventDefault(); if(!organization?.id || !canEdit || saving) return;
  if(!form.nome.trim()) {toast.error('Informe o nome ou razão social.');return;}
  setSaving(true);
  try {
   const {rntrc,...fields} = form;
   const payload = {...fields,nome:form.nome.trim(),...(carrier ? {rntrc} : {})};
   const result = editing ? await supabase.from(tipo).update(payload).eq('organization_id',organization.id).eq('id',editing.id).select('id').single() : await supabase.from(tipo).insert({...payload,organization_id:organization.id}).select('id').single();
   if(result.error) throw result.error;
   toast.success(`${singular} ${editing ? 'atualizado' : 'cadastrado'}!`);setOpen(false);await cache.invalidateQueries({queryKey:[tipo,organization.id]});
  } catch(error) {toast.error(getErrorMessage(error));} finally {setSaving(false);}
 };
 const remove = async (row: Partner) => {
  if(!organization?.id || !roles.includes('admin')) return;
  if(!await confirm({title:`Excluir ${row.nome}?`,description:'Esta ação não pode ser desfeita.',variant:'destructive',confirmText:'Excluir'})) return;
  const {error} = await supabase.from(tipo).delete().eq('id',row.id).eq('organization_id',organization.id);
  if(error) toast.error(getErrorMessage(error)); else {toast.success('Cadastro excluído.');await cache.invalidateQueries({queryKey:[tipo,organization.id]});}
 };
 const field = (key: keyof typeof emptyForm,label:string,required=false) => <div className="space-y-1.5"><Label htmlFor={`${tipo}-${key}`}>{label}</Label><Input id={`${tipo}-${key}`} required={required} type={key === 'email' ? 'email' : 'text'} value={String(form[key])} onChange={e => setForm(f => ({...f,[key]:key === 'cpf_cnpj' ? formatCpfCnpj(e.target.value) : key === 'telefone' ? formatPhone(e.target.value) : e.target.value}))} /></div>;
 return <MainLayout><div className="space-y-5">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="mb-1 text-xs text-muted-foreground">Cadastros</p><h1 className="flex items-center gap-2 text-xl font-semibold"><Icon className="h-5 w-5 text-primary" />{title}</h1></div>{canEdit && <Button onClick={() => start()}><Plus />{carrier ? 'Nova Transportadora' : 'Novo Fornecedor'}</Button>}</header>
  <div className="flex flex-wrap items-center gap-3"><div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label={`Buscar ${title.toLowerCase()}`} placeholder="Nome, documento ou contato..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-36" aria-label="Filtrar status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="ativos">Ativos</SelectItem><SelectItem value="inativos">Inativos</SelectItem></SelectContent></Select></div>
  {query.isError ? <div className="border border-destructive/30 p-4 text-sm"><p>Não foi possível carregar os cadastros.</p><Button variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div> : <PremiumTable columns={[{key:'nome',label:'Nome / Razão social'},{key:'documento',label:'CPF/CNPJ'},{key:'contato',label:'Contato'},{key:'cidade',label:'Cidade / UF'},{key:'status',label:'Status'},{key:'acoes',label:'Ações',align:'right'}]} data={query.data?.rows || []} loading={query.isLoading} rowKey={row => row.id} pagination={{total,page,pageSize,setPage,setPageSize}} emptyIcon={<Icon className="h-8 w-8" />} emptyMessage={term ? 'Nenhum resultado encontrado' : `Nenhuma ${carrier ? 'transportadora cadastrada' : 'empresa fornecedora cadastrada'}`} renderCell={(row: Partner,key) => {
   if(key==='nome') return <div><p className="font-medium">{row.nome}</p>{row.nome_fantasia && <p className="text-xs text-muted-foreground">{row.nome_fantasia}</p>}</div>;
   if(key==='documento') return <span className="font-mono text-xs">{row.cpf_cnpj || '—'}</span>;
   if(key==='contato') return <div><p>{row.contato || row.telefone || '—'}</p><p className="text-xs text-muted-foreground">{row.contato ? row.telefone : row.email}</p></div>;
   if(key==='cidade') return [row.cidade,row.estado].filter(Boolean).join(' / ') || '—';
   if(key==='status') return <Badge variant={row.ativo ? 'secondary' : 'outline'}>{row.ativo ? 'Ativo' : 'Inativo'}</Badge>;
   if(key==='acoes') return <div className="flex justify-end gap-1">{canEdit && <Button variant="ghost" size="icon" aria-label={`Editar ${row.nome}`} title="Editar" onClick={() => start(row)}><Pencil /></Button>}{roles.includes('admin') && <Button variant="ghost" size="icon" aria-label={`Excluir ${row.nome}`} title="Excluir" onClick={() => remove(row)}><Trash2 className="text-destructive" /></Button>}</div>;
   return null;
  }} />}
  <Dialog open={open} onOpenChange={value => {if(!value) void close();}}><DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col"><DialogHeader><DialogTitle>{editing ? 'Editar' : carrier ? 'Nova' : 'Novo'} {singular}</DialogTitle><DialogDescription>Dados cadastrais da empresa e contato.</DialogDescription></DialogHeader><form id="parceiro-form" onSubmit={save} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1">
   <div className="grid gap-4 sm:grid-cols-2">{field('nome','Nome / Razão social *',true)}{field('nome_fantasia','Nome fantasia')}{field('cpf_cnpj','CPF/CNPJ')}{field('inscricao_estadual','Inscrição estadual')}{carrier && field('rntrc','RNTRC / ANTT')}{field('contato','Pessoa de contato')}{field('telefone','Telefone')}{field('email','E-mail')}</div>
   <div className="border-t border-border pt-4"><h2 className="mb-3 text-sm font-semibold">Endereço</h2><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="parceiro-cep">CEP</Label><div className="flex gap-2"><Input id="parceiro-cep" value={form.cep} maxLength={9} onChange={e => setForm(f=>({...f,cep:e.target.value}))} /><Button type="button" variant="outline" size="icon" aria-label="Buscar endereço pelo CEP" title="Buscar CEP" disabled={cepLoading} onClick={async () => {const address = await fetchCep(form.cep);if(address) setForm(f=>({...f,endereco:address.logradouro,bairro:address.bairro,cidade:address.localidade,estado:address.uf}));}}>{cepLoading ? <Loader2 className="animate-spin" /> : <MapPin />}</Button></div></div>{field('endereco','Logradouro')}{field('numero','Número')}{field('complemento','Complemento')}{field('bairro','Bairro')}{field('cidade','Cidade')}<div className="space-y-1.5"><Label>Estado</Label><Select value={form.estado} onValueChange={estado => setForm(f=>({...f,estado}))}><SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger><SelectContent>{UF_LIST.map(uf=><SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent></Select></div></div></div>
   <div className="space-y-1.5"><Label htmlFor="parceiro-observacoes">Observações</Label><Textarea id="parceiro-observacoes" value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} /></div><div className="flex items-center gap-3 pb-2"><Switch id="parceiro-ativo" checked={form.ativo} onCheckedChange={ativo=>setForm(f=>({...f,ativo}))} /><Label htmlFor="parceiro-ativo">Cadastro ativo</Label></div>
  </form><DialogFooter className="border-t border-border pt-4"><Button variant="outline" disabled={saving} onClick={() => void close()}>Cancelar</Button><Button form="parceiro-form" type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />}Salvar</Button></DialogFooter></DialogContent></Dialog>
 </div></MainLayout>;
}
