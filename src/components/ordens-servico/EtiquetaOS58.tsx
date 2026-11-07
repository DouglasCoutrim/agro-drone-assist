import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { toDataURL } from "qrcode";
import { format, parseISO } from "date-fns";

/** Dados da OS usados na etiqueta. */
export interface EtiquetaOSDados {
  id: string;
  numero: string | number;
  tipo_equipamento?: string | null;
  modelo_equipamento?: string | null;
  numero_serie?: string | null;
  data_entrada?: string | null;
  data_previsao?: string | null;
}

export interface EtiquetaOS58Props {
  os: EtiquetaOSDados;
  /** Nome do técnico responsável, já resolvido pela tela a partir de `tecnico_id`. */
  tecnicoNome: string;
  /** Origem usada no link do QR code. Padrão: `window.location.origin`. */
  baseUrl?: string;
}

const ESTILOS_ETIQUETA = `
@media print {
  @page { size: 58mm auto; margin: 0; }
  body * { visibility: hidden; }
  #etiqueta-os, #etiqueta-os * { visibility: visible; }
  #etiqueta-os { position: absolute; left: 0; top: 0; width: 58mm; padding: 2mm; font-family: Arial, sans-serif; color: #000; }
}
`;

/**
 * Mantém o wrapper da impressão fora da tela sem virar o bloco de posicionamento
 * de `#etiqueta-os` (na impressão ele fica estático, então a etiqueta ancora na página).
 */
const ESTILOS_WRAPPER_PRINT = `
@media screen { [data-etiqueta-print] { position: fixed; left: -10000mm; top: 0; } }
`;

const TEXTO_VAZIO = "—";

const textoOuNull = (valor?: string | null): string | null => {
  const texto = (valor ?? "").trim();
  return texto.length ? texto : null;
};

const formatarData = (valor?: string | null): string | null => {
  if (!valor) return null;
  const data = parseISO(valor);
  return Number.isNaN(data.getTime()) ? null : format(data, "dd/MM/yyyy");
};

const montarUrlQrCode = (osId: string, baseUrl?: string): string => {
  const origem = (baseUrl ?? (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/+$/, "");
  return `${origem}/ordens-servico?os=${osId}`;
};

export function EtiquetaOS58({ os, tecnicoNome, baseUrl }: EtiquetaOS58Props) {
  const [qrCode, setQrCode] = useState("");

  useEffect(() => {
    let ativo = true;
    toDataURL(montarUrlQrCode(os.id, baseUrl), { width: 110, margin: 0 })
      .then((dataUrl: string) => {
        if (ativo) setQrCode(dataUrl);
      })
      .catch((erro: unknown) => {
        console.error("Falha ao gerar o QR code da etiqueta:", erro);
      });
    return () => {
      ativo = false;
    };
  }, [os.id, baseUrl]);

  const equipamento = [textoOuNull(os.tipo_equipamento), textoOuNull(os.modelo_equipamento)].filter(Boolean).join(" ");
  const serie = textoOuNull(os.numero_serie) ?? "Sem série";
  const tecnico = textoOuNull(tecnicoNome) ?? "Não atribuído";
  const entrada = formatarData(os.data_entrada) ?? TEXTO_VAZIO;
  const previsao = formatarData(os.data_previsao) ?? "A definir";

  return (
    <>
      <style>{ESTILOS_ETIQUETA}</style>
      <div id="etiqueta-os" className="w-[58mm] bg-white p-[2mm] text-black" style={{ fontFamily: "Arial, sans-serif" }}>
        <div className="flex items-start justify-between gap-[2mm]">
          <p className="text-[16pt] font-bold leading-none">OS-{os.numero}</p>
          {qrCode ? (
            <img src={qrCode} alt={`QR code da OS ${os.numero}`} className="h-[22mm] w-[22mm] shrink-0" />
          ) : (
            <span className="h-[22mm] w-[22mm] shrink-0" aria-hidden="true" />
          )}
        </div>
        <div className="mt-[1.5mm] space-y-[0.75mm] text-[9pt] leading-tight">
          <p>Equipamento: {equipamento || "Não informado"}</p>
          <p>Série: {serie}</p>
          <p>Técnico: {tecnico}</p>
          <p>Entrada: {entrada}</p>
          <p>Previsão: {previsao}</p>
        </div>
      </div>
    </>
  );
}

const aguardarQrCode = (container: HTMLElement, timeoutMs = 3000): Promise<void> =>
  new Promise((resolve) => {
    const inicio = Date.now();
    const verificar = () => {
      const imagem = container.querySelector<HTMLImageElement>("img");
      if (imagem?.src.startsWith("data:image")) return resolve();
      if (Date.now() - inicio >= timeoutMs) return resolve();
      window.setTimeout(verificar, 50);
    };
    verificar();
  });

/** Monta a etiqueta em um elemento oculto, abre a impressão e remove o elemento depois. */
export async function imprimirEtiquetaOS(
  os: EtiquetaOSDados,
  tecnicoNome: string,
  baseUrl?: string,
): Promise<void> {
  if (typeof window === "undefined") return;

  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-etiqueta-print", "");

  const container = document.createElement("div");
  wrapper.appendChild(container);

  const estiloWrapper = document.createElement("style");
  estiloWrapper.textContent = ESTILOS_WRAPPER_PRINT;

  document.head.appendChild(estiloWrapper);
  document.body.appendChild(wrapper);

  const raiz = createRoot(container);
  raiz.render(<EtiquetaOS58 os={os} tecnicoNome={tecnicoNome} baseUrl={baseUrl} />);

  await aguardarQrCode(container);

  let limpo = false;
  const limpar = () => {
    if (limpo) return;
    limpo = true;
    window.removeEventListener("afterprint", limpar);
    raiz.unmount();
    wrapper.remove();
    estiloWrapper.remove();
  };

  window.addEventListener("afterprint", limpar);
  window.print();
  window.setTimeout(limpar, 1000);
}
