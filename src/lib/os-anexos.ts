import { supabase } from "@/integrations/supabase/client";

const BUCKET = "os-anexos";
/** Curto de propósito: a assinatura serve só para baixar a imagem agora, não vira dado. */
const SIGNED_URL_TTL = 60 * 10;

export interface AnexoParaPdf {
  /** Imagem já embutida como data URL, pronta para entrar no HTML do PDF. */
  imagem: string;
  descricao: string | null;
}

async function paraDataUrl(url: string): Promise<string> {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  const blob = await resposta.blob();
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error("Falha ao ler a imagem"));
    leitor.readAsDataURL(blob);
  });
}

/**
 * Carrega as fotos anexadas à OS para dentro do PDF.
 *
 * O bucket `os-anexos` é privado e `os_anexos.url` guarda o caminho do objeto,
 * então a leitura é assinada na hora. Cada imagem é baixada e convertida em
 * data URL: assim o HTML do PDF não depende de rede na hora de rasterizar
 * (html2canvas) nem de a janela de impressão buscar a URL de novo.
 *
 * Anexo que falhar é ignorado — um PDF sem uma foto é melhor do que nenhum PDF.
 */
export async function carregarAnexosParaPdf(
  ordemServicoId: string,
  organizationId?: string | null,
): Promise<AnexoParaPdf[]> {
  if (!ordemServicoId) return [];

  let consulta = supabase
    .from("os_anexos")
    .select("url, descricao, tipo, created_at")
    .eq("ordem_servico_id", ordemServicoId)
    .order("created_at", { ascending: true });

  if (organizationId) consulta = consulta.eq("organization_id", organizationId);

  const { data, error } = await consulta;
  if (error) throw error;

  const linhas = (data || []).filter((a) => !a.tipo || a.tipo.startsWith("image/"));
  if (linhas.length === 0) return [];

  const caminhos = linhas.map((a) => a.url).filter((u) => u && !/^https?:\/\//i.test(u));
  const assinadas: Record<string, string> = {};
  if (caminhos.length > 0) {
    const { data: urls } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(caminhos, SIGNED_URL_TTL);
    (urls || []).forEach((item) => {
      if (item?.path && item?.signedUrl) assinadas[item.path] = item.signedUrl;
    });
  }

  const fotos = await Promise.all(
    linhas.map(async (anexo) => {
      const url = assinadas[anexo.url] || anexo.url;
      if (!url) return null;
      try {
        return { imagem: await paraDataUrl(url), descricao: anexo.descricao ?? null };
      } catch (e) {
        console.warn("[os-anexos] foto ignorada no PDF", { url: anexo.url, erro: e });
        return null;
      }
    }),
  );

  return fotos.filter((f): f is AnexoParaPdf => f !== null);
}
