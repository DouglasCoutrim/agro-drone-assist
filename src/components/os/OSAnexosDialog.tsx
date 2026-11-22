import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Image as ImageIcon, X, Loader2, Trash2 } from "lucide-react";

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
  onAnexosChange?: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DIMENSION = 1200; // maior lado da imagem
const JPEG_QUALITY = 0.7;

export function OSAnexosDialog({
  open,
  onOpenChange,
  ordemServicoId,
  organizationId,
  isPlatformAdmin,
  onAnexosChange,
}: OSAnexosDialogProps) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [urlsAssinadas, setUrlsAssinadas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewDescricao, setPreviewDescricao] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState("");
  const [pendingDescricao, setPendingDescricao] = useState("");
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

      const lista = (data || []) as Anexo[];
      setAnexos(lista);

      // Anexos novos guardam só o caminho do objeto dentro do bucket privado
      // `os-anexos` em `url`; a URL de leitura é assinada aqui, na hora, e não
      // fica salva no banco (assinatura que expira não deve virar dado).
      const caminhos = lista
        .map((a) => a.url)
        .filter((u) => u && !/^https?:\/\//i.test(u));

      if (caminhos.length === 0) {
        setUrlsAssinadas({});
      } else {
        const { data: assinadas } = await supabase.storage
          .from("os-anexos")
          .createSignedUrls(caminhos, 60 * 60 * 24 * 7);
        const mapa: Record<string, string> = {};
        (assinadas || []).forEach((item) => {
          if (item?.path && item?.signedUrl) mapa[item.path] = item.signedUrl;
        });
        setUrlsAssinadas(mapa);
      }
    } catch (e: any) {
      toast.error("Erro ao carregar anexos: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [ordemServicoId, organizationId, isPlatformAdmin]);

  /** Caminho no bucket vira URL assinada; URL http de anexo antigo continua valendo. */
  const urlDe = (anexo: Anexo) => urlsAssinadas[anexo.url] || anexo.url;

  /** Redimensiona e comprime a foto no navegador para reduzir o tamanho do arquivo. */
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
          resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
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

    try {
      // Compressão feita aqui; o envio acontece só depois que o técnico descrever a foto.
      const compressedDataUrl = await compressImage(file);
      setPendingImage(compressedDataUrl);
      setPendingFileName(file.name);
      setPendingDescricao("");
    } catch (err: any) {
      toast.error("Erro ao processar imagem: " + err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const cancelPending = () => {
    setPendingImage(null);
    setPendingFileName("");
    setPendingDescricao("");
  };

  const uploadPending = async () => {
    if (!pendingImage) return;
    setUploading(true);
    try {
      // Converte a data URL comprimida em Blob para envio multipart
      const response = await fetch(pendingImage);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append("file", blob, pendingFileName || "foto.jpg");
      formData.append("ordem_servico_id", ordemServicoId);
      formData.append("descricao", pendingDescricao.trim());

      // FormData não é suportado por supabase.functions.invoke, então chamamos direto.
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://qanmmpjofbacoxlxcgfy.supabase.co";
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
      const functionUrl = `${supabaseUrl}/functions/v1/ftp-upload`;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const fetchResponse = await fetch(functionUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseKey,
        },
        body: formData,
      });

      if (!fetchResponse.ok) {
              const errorText = await fetchResponse.text();
              let msg = errorText;
              try {
                const parsed = JSON.parse(errorText);
                if (parsed?.error) msg = parsed.error;
              } catch {
                // mantém o texto puro
              }
              throw new Error(msg);
            }

      const result = await fetchResponse.json();
      if (result.error) throw new Error(result.error);

      toast.success("Imagem anexada com sucesso!");
      cancelPending();
      fetchAnexos();
      onAnexosChange?.();
    } catch (err: any) {
      // TypeError aqui é falha de rede: o navegador não deixou a requisição sair
      // (conexão ou CORS) e o servidor não chegou a responder. "Failed to fetch"
      // sozinho não diz nada a quem está usando o app.
      const mensagem =
        err instanceof TypeError
          ? "não foi possível falar com o servidor (conexão ou bloqueio de CORS). Tente novamente."
          : err.message;
      toast.error("Erro ao anexar imagem: " + mensagem);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAnexo = async (anexoId: string) => {
    const ok = window.confirm("Tem certeza que deseja excluir este anexo?");
    if (!ok) return;

    try {
      const alvo = anexos.find((a) => a.id === anexoId);
      const { error } = await supabase.from("os_anexos").delete().eq("id", anexoId);
      if (error) throw error;

      // Best-effort: tira o arquivo do bucket para não deixar objeto órfão.
      // Só vale para anexo novo (guardado como caminho); URL http antiga não
      // é objeto de Storage e não tem o que remover aqui.
      if (alvo?.url && !/^https?:\/\//i.test(alvo.url)) {
        const { error: removeError } = await supabase.storage.from("os-anexos").remove([alvo.url]);
        if (removeError) console.warn("Anexo excluído, mas o arquivo ficou no Storage:", removeError.message);
      }

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
              <ImageIcon className="h-5 w-5 text-primary" />
              Anexos da OS
            </DialogTitle>
            <DialogDescription>
              Adicione fotos do equipamento, defeito ou serviço realizado
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Câmera / Galeria */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !!pendingImage}
              >
                <Camera className="mr-2 h-4 w-4" />
                Tirar Foto / Escolher da Galeria
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

            {/* Foto em espera: descrever antes de enviar */}
            {pendingImage && (
              <Card className="border-primary/40 bg-primary/5">
                <CardContent className="p-3 space-y-3">
                  <div className="flex gap-3">
                    <img
                      src={pendingImage}
                      alt="Prévia da foto"
                      className="h-24 w-24 rounded object-cover shrink-0 bg-muted"
                    />
                    <div className="flex-1 space-y-1.5">
                      <p className="text-xs font-medium">Foto capturada</p>
                      <Textarea
                        value={pendingDescricao}
                        onChange={(e) => setPendingDescricao(e.target.value)}
                        placeholder="Descreva a foto (ex: dano na hélice traseira)"
                        rows={2}
                        className="text-xs resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={cancelPending} disabled={uploading}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={uploadPending} disabled={uploading}>
                      {uploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Camera className="mr-2 h-4 w-4" />
                          Enviar foto
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lista de anexos */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : anexos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
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
                          src={urlDe(anexo)}
                          alt={anexo.nome_arquivo}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => openPreview(urlDe(anexo), anexo.descricao)}
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

      {/* Visualização em tela cheia */}
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