import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import {
  Loader2, Plus, Pencil, Trash2, ChevronUp, ChevronDown, ListChecks,
  Boxes, CheckCircle2, ClipboardList, ShieldAlert, X
} from "lucide-react";
import { useChecklistConfig, DB_ENUM_OPCOES } from "@/hooks/useChecklistConfig";

const DB_ENUM_LABELS: Record<string, string> = {
  drone_agricola: "Drone Agrícola",
  drone_convencional: "Drone de Consumo / Enterprise",
  controle: "Controle Remoto",
  bateria: "Bateria Avulsa",
  outro: "Gerador / Carregador / Outro",
};

export default function ConfiguracaoOS() {
  const { tipos, loading, reload, createTipo, updateTipo, deleteTipo, addItem, updateItem, deleteItem, moveItem } = useChecklistConfig();
  const confirm = useConfirm();

  // Dialog de tipo (criar/editar)
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<string | null>(null);
  const [typeForm, setTypeForm] = useState({ label: "", descricao: "", db_enum: "outro", ativo: true });
  const [typeSaving, setTypeSaving] = useState(false);

  // Dialog de itens
  const [itemsDialogTipoId, setItemsDialogTipoId] = useState<string | null>(null);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemRequired, setNewItemRequired] = useState(true);
  const [itemSaving, setItemSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string; label: string; obrigatorio: boolean } | null>(null);

  const openCreateTipo = () => {
    setEditingTipo(null);
    setTypeForm({ label: "", descricao: "", db_enum: "outro", ativo: true });
    setTypeDialogOpen(true);
  };

  const openEditTipo = (id: string) => {
    const t = tipos.find(x => x.id === id);
    if (!t) return;
    setEditingTipo(id);
    setTypeForm({ label: t.label, descricao: t.descricao || "", db_enum: t.db_enum || "outro", ativo: t.ativo });
    setTypeDialogOpen(true);
  };

  const currentTipo = tipos.find(t => t.id === itemsDialogTipoId) || null;
  const itens = currentTipo?.itens || [];

  const handleSaveTipo = async () => {
    if (!typeForm.label.trim()) { toast.error("Informe o nome do tipo de equipamento."); return; }
    setTypeSaving(true);
    try {
      if (editingTipo) {
        await updateTipo(editingTipo, {
          label: typeForm.label.trim(),
          descricao: typeForm.descricao.trim() || null,
          db_enum: typeForm.db_enum,
          ativo: typeForm.ativo,
        });
        toast.success("Tipo de equipamento atualizado!");
        setTypeDialogOpen(false);
      } else {
        const created = await createTipo({
          label: typeForm.label.trim(),
          descricao: typeForm.descricao.trim() || undefined,
          db_enum: typeForm.db_enum,
          ativo: typeForm.ativo,
        });
        toast.success(`Tipo "${typeForm.label.trim()}" criado!`);
        setTypeDialogOpen(false);
        setItemsDialogTipoId(created.id);
        toast.info("Preencha agora os itens do checklist deste tipo.", { duration: 5000 });
      }
    } catch (err: any) {
      toast.error(err?.message || "Falha ao salvar tipo.");
    } finally {
      setTypeSaving(false);
    }
  };

  const handleDeleteTipo = async (id: string) => {
    const t = tipos.find(x => x.id === id);
    const ok = await confirm({
      title: `Excluir tipo "${t?.label || ""}"?`,
      description: "Os itens de checklist vinculados também serão removidos. Essa ação não pode ser desfeita.",
      variant: "destructive",
      confirmText: "Sim, excluir",
    });
    if (!ok) return;
    try {
      await deleteTipo(id);
      toast.success("Tipo de equipamento excluído.");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao excluir tipo.");
    }
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    try {
      await updateTipo(id, { ativo });
      toast.success(ativo ? "Tipo ativado." : "Tipo desativado.");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao alterar status.");
    }
  };

  const handleAddItem = async () => {
    if (!itemsDialogTipoId) return;
    if (!newItemLabel.trim()) { toast.error("Informe a descrição do item."); return; }
    setItemSaving(true);
    try {
      await addItem(itemsDialogTipoId, { label: newItemLabel.trim(), obrigatorio: newItemRequired });
      setNewItemLabel("");
      setNewItemRequired(true);
      toast.success("Item de verificação adicionado.");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao adicionar item.");
    } finally {
      setItemSaving(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;
    const label = editingItem.label.trim();
    if (!label) { toast.error("Informe a descrição do item."); return; }
    setItemSaving(true);
    try {
      await updateItem(editingItem.id, { label, obrigatorio: editingItem.obrigatorio });
      setEditingItem(null);
      toast.success("Item atualizado.");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao atualizar item.");
    } finally {
      setItemSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    const ok = await confirm({
      title: "Remover item do checklist?",
      description: "Esse item deixará de ser exigido nas revisões deste tipo de equipamento.",
      variant: "destructive",
      confirmText: "Remover",
    });
    if (!ok) return;
    try {
      await deleteItem(id);
      toast.success("Item removido.");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao remover item.");
    }
  };

  const obrigatoriosCount = itens.filter(i => i.obrigatorio).length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" /> Configuração de OS / Checklist
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastre os tipos de equipamento que sua oficina atende e defina os itens de verificação (checklist de revisão) de cada um.
            </p>
          </div>
          <Button className="gradient-primary" onClick={openCreateTipo}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo tipo de equipamento
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : tipos.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="py-16 text-center space-y-3">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Boxes className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-medium">Nenhum tipo de equipamento configurado</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Clique em "Novo tipo de equipamento" para criar o primeiro (ex: Drones de Pulverização) e, em seguida, defina os itens do checklist de revisão.
                </p>
              </div>
              <Button className="gradient-primary" onClick={openCreateTipo}>
                <Plus className="h-4 w-4 mr-1.5" /> Criar primeiro tipo
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tipos.map(t => {
              const totalItens = t.itens?.length || 0;
              const obrig = (t.itens || []).filter(i => i.obrigatorio).length;
              return (
                <Card key={t.id} className={`shadow-soft ${!t.ativo ? "opacity-70" : ""}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base flex items-center gap-2">
                          <span className="truncate">{t.label}</span>
                          {t.ativo
                            ? <Badge className="bg-success/10 text-success border-success/20">Ativo</Badge>
                            : <Badge variant="outline">Inativo</Badge>}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {t.descricao || "Sem descrição cadastrada"}
                        </CardDescription>
                      </div>
                      <Switch
                        checked={t.ativo}
                        onCheckedChange={(v) => handleToggleAtivo(t.id, v)}
                        aria-label="Ativar/desativar tipo"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ListChecks className="h-3.5 w-3.5 text-primary" />
                      {totalItens === 0 ? "Nenhum item de verificação" : `${totalItens} item(ns)`}
                      {obrig > 0 && <Badge variant="secondary">{obrig} obrigatório(s)</Badge>}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => { reload(); setItemsDialogTipoId(t.id); }}>
                        <ListChecks className="h-4 w-4 mr-1" /> Checklist
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEditTipo(t.id)}>
                        <Pencil className="h-4 w-4 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteTipo(t.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog: criar/editar tipo de equipamento */}
      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTipo ? "Editar tipo de equipamento" : "Novo tipo de equipamento"}</DialogTitle>
            <DialogDescription>
              {editingTipo
                ? "Ajuste o nome, a descrição ou a compatibilidade do tipo."
                : "Ao criar, você será direcionado para o fluxo de itens de checklist."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do tipo *</Label>
              <Input
                value={typeForm.label}
                onChange={(e) => setTypeForm({ ...typeForm, label: e.target.value })}
                placeholder="Ex: Drone de Pulverização"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={typeForm.descricao}
                onChange={(e) => setTypeForm({ ...typeForm, descricao: e.target.value })}
                rows={2}
                placeholder="Ex: Drones utilizados na pulverização de lavouras..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria de compatibilidade</Label>
              <Select value={typeForm.db_enum} onValueChange={(v) => setTypeForm({ ...typeForm, db_enum: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DB_ENUM_OPCOES.map(o => (
                    <SelectItem key={o} value={o}>{DB_ENUM_LABELS[o] || o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" /> Usado para agrupar o equipamento no banco (OS). Manter "outro" em caso de dúvida.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Tipo ativo</p>
                <p className="text-xs text-muted-foreground">Tipos inativos não aparecem na OS.</p>
              </div>
              <Switch checked={typeForm.ativo} onCheckedChange={(v) => setTypeForm({ ...typeForm, ativo: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeDialogOpen(false)}>Cancelar</Button>
            <Button className="gradient-primary" onClick={handleSaveTipo} disabled={typeSaving}>
              {typeSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editingTipo ? "Salvar alterações" : "Criar tipo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: itens de checklist do tipo */}
      <Dialog open={!!itemsDialogTipoId} onOpenChange={(open) => { if (!open) { setItemsDialogTipoId(null); setEditingItem(null); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              Checklist — {currentTipo?.label || "Tipo de equipamento"}
            </DialogTitle>
            <DialogDescription>
              Defina os itens de verificação de revisão. Itens obrigatórios bloqueiam o fechamento da OS até serem preenchidos.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{itens.length} item(ns)</Badge>
            <Badge className="bg-warning/10 text-warning border-warning/20">{obrigatoriosCount} obrigatório(s)</Badge>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[120px]">
            {itens.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <ListChecks className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum item de verificação definido ainda.</p>
              </div>
            )}
            {itens.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2 border rounded-lg p-2.5 hover:bg-muted/30 transition-colors">
                {editingItem?.id === item.id ? (
                  <div className="flex-1 space-y-2">
                    <Input
                      value={editingItem.label}
                      onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })}
                      className="h-8 text-sm"
                      placeholder="Descrição do item..."
                    />
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editingItem.obrigatorio}
                          onCheckedChange={(v) => setEditingItem({ ...editingItem, obrigatorio: v })}
                        />
                        <span className="text-xs text-muted-foreground">
                          {editingItem.obrigatorio ? "Obrigatório" : "Opcional"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={handleUpdateItem} disabled={itemSaving}>
                          {itemSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}Salvar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingItem(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        className="disabled:opacity-30 text-muted-foreground hover:text-foreground"
                        disabled={idx === 0}
                        onClick={() => moveItem(itemsDialogTipoId!, item.id, "up")}
                        aria-label="Mover para cima"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="disabled:opacity-30 text-muted-foreground hover:text-foreground"
                        disabled={idx === itens.length - 1}
                        onClick={() => moveItem(itemsDialogTipoId!, item.id, "down")}
                        aria-label="Mover para baixo"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.obrigatorio ? "Obrigatório" : "Opcional"}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setEditingItem({ id: item.id, label: item.label, obrigatorio: item.obrigatorio })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteItem(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-2.5">
            <div className="space-y-1.5">
              <Label className="text-xs">Novo item de verificação</Label>
              <Input
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                placeholder="Ex: Conferir hélices e fixações"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch checked={newItemRequired} onCheckedChange={setNewItemRequired} />
                <span className="text-xs text-muted-foreground">
                  {newItemRequired ? "Item obrigatório" : "Item opcional"}
                </span>
              </div>
              <Button size="sm" className="gradient-primary" onClick={handleAddItem} disabled={itemSaving}>
                {itemSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
                Adicionar item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}