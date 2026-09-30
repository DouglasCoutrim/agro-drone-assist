import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Wrench, Search, Plus, Edit, Trash2, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { EmptyState } from "@/components/os/EmptyState";
import { useOrganization } from "@/hooks/useOrganization";
import { useConfirm } from "@/hooks/useConfirm";
import { CsvImportExport, parseNumberBR, emptyToNull } from "@/components/CsvImportExport";

type Servico = Tables<"servicos">;

const SERVICOS_CSV_COLUMNS = ["descricao", "preco", "tempo_estimado"];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function Servicos() {
  const { organization } = useOrganization();
  const confirm = useConfirm();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Servico | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [formData, setFormData] = useState({
    descricao: "",
    preco: 0,
    tempo_estimado: "",
  });

  useEffect(() => {
    if (organization?.id) fetchServicos();
  }, [organization?.id]);

  const fetchServicos = async () => {
    if (!organization?.id) return;
    try {
      const { data, error } = await supabase
        .from("servicos")
        .select("*")
        .eq("organization_id", organization.id)
        .order("descricao");
      if (error) throw error;
      setServicos(data || []);
    } catch {
      toast.error("Erro ao carregar serviços");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ descricao: "", preco: 0, tempo_estimado: "" });
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.descricao.trim()) {
      toast.error("Informe a descrição do serviço");
      return;
    }
    setFormLoading(true);
    try {
      const payload = {
        descricao: formData.descricao.trim(),
        preco: Number(formData.preco) || 0,
        tempo_estimado: formData.tempo_estimado.trim() || null,
      };
      if (editing) {
        const { error } = await supabase
          .from("servicos")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Serviço atualizado!");
      } else {
        const { error } = await supabase
          .from("servicos")
          .insert({ ...payload, organization_id: organization?.id } as any);
        if (error) throw error;
        toast.success("Serviço criado!");
      }
      setDialogOpen(false);
      resetForm();
      fetchServicos();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e.message || e));
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (s: Servico) => {
    setEditing(s);
    setFormData({
      descricao: s.descricao,
      preco: s.preco,
      tempo_estimado: s.tempo_estimado || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (s: Servico) => {
    const ok = await confirm({
      title: `Excluir "${s.descricao}"?`,
      description: "Esta ação não pode ser desfeita.",
      variant: "destructive",
      confirmText: "Excluir",
    });
    if (!ok) return;
    try {
      const { error } = await supabase.from("servicos").delete().eq("id", s.id);
      if (error) throw error;
      toast.success("Serviço excluído.");
      fetchServicos();
    } catch (e: any) {
      toast.error("Erro ao excluir: " + (e.message || e));
    }
  };

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return servicos.filter((s) => s.descricao.toLowerCase().includes(term));
  }, [servicos, searchTerm]);

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold font-display flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Serviços
            </h1>
            <p className="text-xs text-muted-foreground">
              Catálogo de serviços oferecidos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CsvImportExport
              tableName="servicos"
              organizationId={organization?.id}
              exportColumns={SERVICOS_CSV_COLUMNS}
              templateColumns={SERVICOS_CSV_COLUMNS}
              filename="servicos"
              onImported={fetchServicos}
              transformRow={(row) => {
                const descricao = (row.descricao || "").trim();
                if (!descricao) return null;
                return {
                  descricao,
                  preco: parseNumberBR(row.preco),
                  tempo_estimado: emptyToNull(row.tempo_estimado),
                };
              }}
            />
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" className="gradient-primary">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Novo Serviço
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-base">
                    {editing ? "Editar Serviço" : "Novo Serviço"}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Preencha os dados do serviço
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Descrição *</Label>
                    <Input
                      value={formData.descricao}
                      onChange={(e) =>
                        setFormData({ ...formData, descricao: e.target.value })
                      }
                      required
                      className="h-9"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Preço (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={formData.preco}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            preco: Number(e.target.value),
                          })
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tempo estimado</Label>
                      <Input
                        placeholder="ex: 1h30"
                        value={formData.tempo_estimado}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            tempo_estimado: e.target.value,
                          })
                        }
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      className="gradient-primary"
                      disabled={formLoading}
                    >
                      {formLoading && (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      )}
                      {editing ? "Salvar" : "Criar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar serviço..."
            className="pl-9 h-9 text-xs bg-muted/30 border-border/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Card className="shadow-soft border-border/50">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title={
                  searchTerm
                    ? "Nenhum serviço encontrado"
                    : "Nenhum serviço cadastrado"
                }
                description={
                  searchTerm
                    ? "Tente buscar com outros termos."
                    : "Cadastre seu primeiro serviço para usar nas Ordens de Serviço."
                }
                actionLabel={searchTerm ? undefined : "Cadastrar serviço"}
                onAction={searchTerm ? undefined : () => setDialogOpen(true)}
              />
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {s.descricao}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono text-primary">
                          {formatCurrency(s.preco)}
                        </span>
                        {s.tempo_estimado && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {s.tempo_estimado}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleEdit(s)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleDelete(s)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
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
