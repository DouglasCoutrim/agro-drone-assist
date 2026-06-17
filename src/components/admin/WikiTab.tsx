import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Upload, Image as ImageIcon, FileText, FolderTree } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useConfirm";

interface Category { id: string; slug: string; name: string; description: string | null; icon: string; sort_order: number; }
interface Article {
  id: string; category_id: string | null; slug: string; title: string; summary: string | null;
  content: string; media: any[]; tour_target_route: string | null; tour_steps: any[];
  tags: string[]; published: boolean; sort_order: number;
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function WikiTab() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [cats, setCats] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [editingCat, setEditingCat] = useState<Partial<Category> | null>(null);
  const [editingArt, setEditingArt] = useState<Partial<Article> | null>(null);
  const [uploadingFor, setUploadingFor] = useState(false);

  const load = async () => {
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from("wiki_categories").select("*").order("sort_order"),
      supabase.from("wiki_articles").select("*").order("sort_order"),
    ]);
    setCats((c || []) as Category[]);
    setArticles((a || []) as Article[]);
  };

  useEffect(() => { load(); }, []);

  // -------- Categories --------
  const saveCat = async () => {
    if (!editingCat?.name) return;
    const payload = {
      name: editingCat.name,
      slug: editingCat.slug || slugify(editingCat.name),
      description: editingCat.description || null,
      icon: editingCat.icon || "BookOpen",
      sort_order: editingCat.sort_order ?? 0,
    };
    const { error } = editingCat.id
      ? await supabase.from("wiki_categories").update(payload).eq("id", editingCat.id)
      : await supabase.from("wiki_categories").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Categoria salva");
    setEditingCat(null); load();
  };

  const deleteCat = async (id: string) => {
    if (!await confirm({ title: 'Apagar categoria', description: 'A categoria e todos os artigos dela serão removidos.', variant: 'destructive', confirmText: 'Apagar' })) return;
    await supabase.from("wiki_categories").delete().eq("id", id);
    load();
  };

  // -------- Articles --------
  const saveArt = async () => {
    if (!editingArt?.title) return;
    const payload: any = {
      title: editingArt.title,
      slug: editingArt.slug || slugify(editingArt.title),
      summary: editingArt.summary || null,
      content: editingArt.content || "",
      category_id: editingArt.category_id || null,
      media: editingArt.media || [],
      tour_target_route: editingArt.tour_target_route || null,
      tour_steps: editingArt.tour_steps || [],
      tags: editingArt.tags || [],
      published: editingArt.published ?? true,
      sort_order: editingArt.sort_order ?? 0,
    };
    if (!editingArt.id) payload.created_by = user?.id;
    const { error } = editingArt.id
      ? await supabase.from("wiki_articles").update(payload).eq("id", editingArt.id)
      : await supabase.from("wiki_articles").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Artigo salvo");
    setEditingArt(null); load();
  };

  const deleteArt = async (id: string) => {
    if (!await confirm({ title: 'Apagar artigo', description: 'Esta ação não pode ser desfeita.', variant: 'destructive', confirmText: 'Apagar' })) return;
    await supabase.from("wiki_articles").delete().eq("id", id);
    load();
  };

  const uploadMedia = async (file: File) => {
    setUploadingFor(true);
    try {
      const path = `${Date.now()}-${slugify(file.name)}`;
      const { error } = await supabase.storage.from("wiki-media").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("wiki-media").getPublicUrl(path);
      const url = data.publicUrl;
      setEditingArt((a) => ({ ...a, media: [...(a?.media || []), { type: "image", url, name: file.name }] }));
      // also insert markdown reference
      setEditingArt((a) => ({ ...a, content: (a?.content || "") + `\n\n![${file.name}](${url})\n` }));
      toast.success("Mídia enviada");
    } catch (e: any) { toast.error(e.message); } finally { setUploadingFor(false); }
  };

  return (
    <div className="space-y-6">
      {/* Categorias */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><FolderTree className="h-4 w-4" />Categorias</h3>
          <Button size="sm" onClick={() => setEditingCat({ sort_order: cats.length })}>
            <Plus className="h-4 w-4 mr-1" />Nova
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {cats.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-md border border-border">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-[10px] text-muted-foreground">/{c.slug}</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingCat(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteCat(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Artigos */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" />Artigos</h3>
          <Button size="sm" onClick={() => setEditingArt({ published: true, media: [], tour_steps: [], tags: [] })}>
            <Plus className="h-4 w-4 mr-1" />Novo
          </Button>
        </div>
        <div className="space-y-2">
          {articles.map((a) => (
            <div key={a.id} className="flex items-center justify-between p-3 rounded-md border border-border">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  {!a.published && <Badge variant="outline" className="text-[9px]">rascunho</Badge>}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {cats.find((c) => c.id === a.category_id)?.name || "Sem categoria"} · /wiki/{a.slug}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingArt(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteArt(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Dialog categoria */}
      <Dialog open={!!editingCat} onOpenChange={(o) => !o && setEditingCat(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCat?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Nome</Label><Input value={editingCat?.name || ""} onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })} /></div>
            <div><Label className="text-xs">Slug</Label><Input value={editingCat?.slug || ""} onChange={(e) => setEditingCat({ ...editingCat, slug: e.target.value })} placeholder="auto a partir do nome" /></div>
            <div><Label className="text-xs">Descrição</Label><Textarea value={editingCat?.description || ""} onChange={(e) => setEditingCat({ ...editingCat, description: e.target.value })} /></div>
            <div><Label className="text-xs">Ícone (Lucide)</Label><Input value={editingCat?.icon || ""} onChange={(e) => setEditingCat({ ...editingCat, icon: e.target.value })} placeholder="BookOpen" /></div>
            <div><Label className="text-xs">Ordem</Label><Input type="number" value={editingCat?.sort_order ?? 0} onChange={(e) => setEditingCat({ ...editingCat, sort_order: parseInt(e.target.value) })} /></div>
            <Button onClick={saveCat} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog artigo */}
      <Dialog open={!!editingArt} onOpenChange={(o) => !o && setEditingArt(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingArt?.id ? "Editar artigo" : "Novo artigo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">Título</Label><Input value={editingArt?.title || ""} onChange={(e) => setEditingArt({ ...editingArt, title: e.target.value })} /></div>
              <div><Label className="text-xs">Slug</Label><Input value={editingArt?.slug || ""} onChange={(e) => setEditingArt({ ...editingArt, slug: e.target.value })} /></div>
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={editingArt?.category_id || ""} onValueChange={(v) => setEditingArt({ ...editingArt, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Resumo</Label><Input value={editingArt?.summary || ""} onChange={(e) => setEditingArt({ ...editingArt, summary: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Conteúdo (Markdown — suporta imagens, GIFs e embeds de iframe)</Label>
              <Textarea rows={12} className="font-mono text-xs" value={editingArt?.content || ""} onChange={(e) => setEditingArt({ ...editingArt, content: e.target.value })}
                placeholder={"# Título\n\nUse markdown.\n\n![Screenshot](url)\n\n<iframe src='https://youtube.com/embed/ID' />"} />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-2"><Upload className="h-3.5 w-3.5" />Upload de mídia (imagens, GIFs)</Label>
              <Input type="file" accept="image/*,.gif" disabled={uploadingFor}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMedia(f); e.currentTarget.value = ""; }} />
              {(editingArt?.media || []).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {(editingArt?.media || []).map((m: any, i: number) => (
                    <div key={i} className="relative w-20 h-20 rounded border border-border overflow-hidden">
                      <img src={m.url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">Rota do tour (opcional)</Label><Input value={editingArt?.tour_target_route || ""} onChange={(e) => setEditingArt({ ...editingArt, tour_target_route: e.target.value })} placeholder="/ordens-servico" /></div>
              <div><Label className="text-xs">Ordem</Label><Input type="number" value={editingArt?.sort_order ?? 0} onChange={(e) => setEditingArt({ ...editingArt, sort_order: parseInt(e.target.value) })} /></div>
            </div>
            <div>
              <Label className="text-xs">Passos do tour (JSON — array de {`{target, content, title?}`})</Label>
              <Textarea rows={4} className="font-mono text-xs" value={JSON.stringify(editingArt?.tour_steps || [], null, 2)}
                onChange={(e) => { try { setEditingArt({ ...editingArt, tour_steps: JSON.parse(e.target.value) }); } catch {} }} />
              <p className="text-[10px] text-muted-foreground mt-1">Ex.: <code>{`[{"target": ".sidebar-os", "content": "Aqui você gerencia as OS"}]`}</code></p>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="flex items-center gap-2">
                <Switch checked={editingArt?.published ?? true} onCheckedChange={(v) => setEditingArt({ ...editingArt, published: v })} />
                <Label className="text-xs">Publicado</Label>
              </div>
              <Button onClick={saveArt}>Salvar artigo</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
