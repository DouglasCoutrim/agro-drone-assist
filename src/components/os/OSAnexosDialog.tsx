import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Image, X, Loader2, Trash2, Plus, Eye } from "lucide-react";

interface Anexo {
  id: string;
  nome_arquivo: string;
  url: string;
  tipo: string | null;
  tamanho: number | null;
  descricao: string | null;
  created_at: string;
}

interface OSAnexosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemServicoId: string;
  organizationId: string | null;
  isPlatformAdmin: boolean;
  usuarioId: string;
  onAnexosChange?: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DIMENSION = 1200; // max width/height
const JPEG_QUALITY = 0.7;

export function OSAnexosDialog({
  open,
  onOpenChange,
  ordemServicoId,
  organizationId,
  isPlatformAdmin,
  usuarioId,
  onAnexosChange,
}: OSAnexosDialogProps) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewDescricao, setPreviewDescricao] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAnexos = useCallback(async () => {
    if (!ordemServicoId) return;
    setLoading(true);
    try {
      let query = supabase
        .from("os_anexos")
        .select("*")
        .eq("ordem_servico_id", ordemServicoId)
        .order("created_at", { ascending: false });

      if (organizationId && !isPlatformAdmin) {
        query = query.eq("organization_id", organizationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAnexos((data || []) as Anexo[]);
    } catch (e: any) {
      toast.error("Erro ao carregar anexos: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [ordemServicoId, organizationId, isPlatformAdmin]);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas não suportado"));

          let { width, height } = img;
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width > height) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            } else {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }
          }
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error("Erro ao carregar imagem"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione apenas arquivos de imagem");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Imagem muito grande. Máximo 5MB.");
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      const nomeArquivo = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;

      const { error } = await supabase.from("os_anexos").insert({
        ordem_servico_id: ordemServicoId,
        organization_id: organizationId,
        nome_arquivo: nomeArquivo,
        url: dataUrl,
        tipo: "image/jpeg",
        tamanho: Math.round(dataUrl.length * 0.75), // approximate base64 size
        usuario_id: usuarioId,
        descricao: "",
      });

      if (error) throw error;

      toast.success("Imagem anexada com sucesso!");
      fetchAnexos();
      onAnexosChange?.();
    } catch (e: any) {
      toast.error("Erro ao anexar imagem: " + e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAnexo = async (anexoId: string) => {
    const ok = window.confirm("Tem certeza que deseja excluir este anexo?");
    if (!ok) return;

    try {
      const { error } = await supabase.from("os_anexos").delete().eq("id", anexoId);
      if (error) throw error;
      toast.success("Anexo excluído");
      fetchAnexos();
      onAnexosChange?.();
    } catch (e: any) {
      toast.error("Erro ao excluir: " + e.message);
    }
  };

  const handleUpdateDescricao = async (anexoId: string, descricao: string) => {
    try {
      const { error } = await supabase
        .from("os_anexos")
        .update({ descricao })
        .eq("id", anexoId);
      if (error) throw error;
      fetchAnexos();
    } catch (e: any) {
      toast.error("Erro ao salvar descrição: " + e.message);
    }
  };

  const openPreview = (url: string, descricao: string | null) => {
    setPreviewImage(url);
    setPreviewDescricao(descricao || "");
  };

  const closePreview = () => {
    setPreviewImage(null);
    setPreviewDescricao("");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              Anexos da OS
            </DialogTitle>
            <DialogDescription>
              Adicione fotos do equipamento, defeito ou serviço realizado
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Camera/Gallery Button */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="mr-2 h-4 w-4" />
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Tirar Foto / Escolher da Galeria"
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Anexos List */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : anexos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum anexo ainda</p>
                <p className="text-xs">Use o botão acima para adicionar fotos</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {anexos.map((anexo) => (
                  <Card key={anexo.id} className="relative overflow-hidden">
                    <CardContent className="p-2">
                      <div className="aspect-square relative overflow-hidden rounded bg-muted">
                        <img
                          src={anexo.url}
                          alt={anexo.nome_arquivo}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => openPreview(anexo.url, anexo.descricao)}
                        />
                        {anexo.descricao && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1.5 truncate">
                            {anexo.descricao}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium truncate">{anexo.nome_arquivo}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAnexo(anexo.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Textarea
                          value={anexo.descricao || ""}
                          onChange={(e) => handleUpdateDescricao(anexo.id, e.target.value)}
                          placeholder="Descrição (opcional)"
                          rows={2}
                          className="text-xs h-16 resize-none"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(anexo.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      {previewImage && (
        <Dialog open={true} onOpenChange={closePreview}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="flex-shrink-0 flex items-center justify-between p-4 border-b">
              <DialogTitle>Visualização</DialogTitle>
              <Button variant="ghost" size="icon" onClick={closePreview}>
                <X className="h-5 w-5" />
              </Button>
            </DialogHeader>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-black/50">
              <img src={previewImage} alt="Preview" className="max-w-full max-h-[70vh] rounded shadow-xl" />
            </div>
            {previewDescricao && (
              <div className="p-4 border-t bg-background">
                <p className="text-sm text-muted-foreground">{previewDescricao}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}