import { useState } from "react";
import { ImageOff, ImageIcon, Loader2, Link2, Search, Trash2 } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";

export async function buscarFotos(query: string): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke("buscar-imagem-produto", { body: { query } });
  if (error) {
    // Mostra o motivo real devolvido pela função (chave ausente, falha do provedor etc.).
    let detalhe = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const texto = await error.context.text();
        try {
          const corpo = JSON.parse(texto);
          detalhe = corpo?.detalhe || corpo?.error || texto;
        } catch { detalhe = texto; }
      } catch { /* sem corpo legível */ }
    }
    if (/402|credit/i.test(detalhe)) throw new Error("Sem créditos para buscar fotos.");
    throw new Error(`Não foi possível buscar fotos: ${String(detalhe).slice(0, 200)}`);
  }
  if (data?.aviso) toast.info(data.aviso);
  return data?.urls || [];
}

export function SafeImg({ src, className }: { src?: string | null; className?: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) return <div className={`flex items-center justify-center bg-muted text-muted-foreground ${className}`}><ImageOff className="h-6 w-6" /></div>;
  return <img src={src} alt="Foto do produto" loading="lazy" referrerPolicy="no-referrer" onError={() => setErr(true)} className={`object-contain bg-background ${className}`} />;
}

export function ProductImageHover({ url, children }: { url?: string | null; children: React.ReactNode }) {
  if (!url) return <>{children}</>;
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <span className="inline-flex cursor-default items-center gap-1">
          <ImageIcon className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Tem foto" />
          {children}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-56 p-2"><SafeImg src={url} className="h-48 w-full rounded" /></HoverCardContent>
    </HoverCard>
  );
}

export function ProductPhotoPanel({ itemId, descricao, url, onChange }: { itemId: string; descricao: string; url?: string | null; onChange: (u: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState<string[]>([]);
  const [manual, setManual] = useState("");
  const [salvando, setSalvando] = useState(false);

  const salvar = async (u: string | null) => {
    setSalvando(true);
    const { error } = await supabase.from("itens_estoque").update({ imagem_url: u }).eq("id", itemId);
    setSalvando(false);
    if (error) return toast.error("Não foi possível salvar a foto.");
    onChange(u); setOpen(false); setManual("");
  };
  const buscar = async () => {
    setOpen(true); setLoading(true); setOpts([]);
    try { const r = await buscarFotos(descricao); setOpts(r); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  const usarUrl = () => {
    const u = manual.trim();
    if (!/^https?:\/\//i.test(u)) return toast.error("Informe um endereço de imagem começando com http(s)://");
    salvar(u);
  };

  return (
    <div className="space-y-2">
      <SafeImg src={url} className="h-44 w-full rounded-md border" />
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={buscar}><Search className="mr-1 h-4 w-4" />{url ? "Trocar foto" : "Buscar foto"}</Button>
        {url && <Button type="button" size="icon" variant="ghost" title="Remover foto" onClick={() => salvar(null)}><Trash2 className="h-4 w-4" /></Button>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Escolha a foto</DialogTitle><DialogDescription>{descricao}</DialogDescription></DialogHeader>
          {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
            <>
              {opts.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {opts.map((u) => (
                    <button key={u} type="button" disabled={salvando} onClick={() => salvar(u)} className="rounded-md border p-1 hover:border-primary">
                      <SafeImg src={u} className="h-28 w-full" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Nenhuma foto encontrada para esta descrição. Encurte o nome (ex.: "Bateria DJI Agras T40") e busque de novo, ou cole o link da foto abaixo.
                </p>
              )}
              <div className="flex gap-2">
                <Input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="https://... (link da foto)"
                  className="h-9"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); usarUrl(); } }}
                />
                <Button type="button" size="sm" variant="outline" onClick={usarUrl} disabled={salvando || !manual.trim()}>
                  <Link2 className="mr-1 h-4 w-4" />Usar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
