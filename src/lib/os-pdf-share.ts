import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Render an HTML string into a multi-page PDF Blob (A4).
 */
export async function htmlToPdfBlob(html: string, _filename: string): Promise<Blob> {
  // Render the HTML offscreen so html2canvas can rasterize it
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "794px"; // ~A4 width @96dpi
  container.style.background = "#fff";
  container.style.padding = "0";
  container.innerHTML = html;
  // Strip the auto-print script
  container.querySelectorAll("script").forEach((s) => s.remove());
  document.body.appendChild(container);

  try {
    // Wait for images (logo) to load so they don't render blank
    const imgs = Array.from(container.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((res) => {
            if ((img as HTMLImageElement).complete) return res();
            img.addEventListener("load", () => res(), { once: true });
            img.addEventListener("error", () => res(), { once: true });
          })
      )
    );

    // Pick the body element (the HTML template wraps content in <body>)
    const bodyEl =
      (container.querySelector("body") as HTMLElement | null) ||
      (container.firstElementChild as HTMLElement) ||
      container;

    // Collect "blocks" = direct children we don't want to split across pages
    const blocks = Array.from(bodyEl.children) as HTMLElement[];

    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const MARGIN = 10; // mm
    const contentW = pageW - MARGIN * 2;
    const contentH = pageH - MARGIN * 2;

    let cursorY = MARGIN;

    const renderBlock = async (el: HTMLElement) => {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const wMm = contentW;
      const hMm = (canvas.height * wMm) / canvas.width;
      const data = canvas.toDataURL("image/jpeg", 0.95);
      return { data, wMm, hMm, canvas };
    };

    const addImage = (data: string, wMm: number, hMm: number) => {
      pdf.addImage(data, "JPEG", MARGIN, cursorY, wMm, hMm);
      cursorY += hMm;
    };

    const sliceTall = async (canvas: HTMLCanvasElement, wMm: number) => {
      // Block is taller than a full page → slice it across pages
      const pxPerMm = canvas.width / wMm;
      const pagePxAvailFirst = Math.floor((pageH - MARGIN - cursorY) * pxPerMm);
      const pagePxFull = Math.floor(contentH * pxPerMm);

      let offset = 0;
      let avail = pagePxAvailFirst > 100 ? pagePxAvailFirst : pagePxFull;
      if (avail !== pagePxAvailFirst) {
        pdf.addPage();
        cursorY = MARGIN;
      }
      while (offset < canvas.height) {
        const sliceH = Math.min(avail, canvas.height - offset);
        const tmp = document.createElement("canvas");
        tmp.width = canvas.width;
        tmp.height = sliceH;
        const ctx = tmp.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, tmp.width, tmp.height);
        ctx.drawImage(canvas, 0, -offset);
        const data = tmp.toDataURL("image/jpeg", 0.95);
        const hMm = sliceH / pxPerMm;
        addImage(data, wMm, hMm);
        offset += sliceH;
        if (offset < canvas.height) {
          pdf.addPage();
          cursorY = MARGIN;
          avail = pagePxFull;
        }
      }
    };

    for (const block of blocks) {
      const { data, wMm, hMm, canvas } = await renderBlock(block);
      if (hMm > contentH) {
        await sliceTall(canvas, wMm);
        continue;
      }
      if (cursorY + hMm > pageH - MARGIN) {
        pdf.addPage();
        cursorY = MARGIN;
      }
      addImage(data, wMm, hMm);
    }

    return pdf.output("blob");
  } finally {
    document.body.removeChild(container);
  }
}


/**
 * Share PDF via WhatsApp:
 *  - Mobile (Web Share API w/ files): opens native share sheet → user picks WhatsApp, PDF anexado.
 *  - Desktop / sem suporte: faz download do PDF e abre WhatsApp Web com mensagem curta.
 */
export async function sharePdfOnWhatsApp(opts: {
  blob: Blob;
  filename: string;
  telefone: string;
  message: string;
}): Promise<"shared" | "downloaded"> {
  const { blob, filename, telefone, message } = opts;
  const file = new File([blob], filename, { type: "application/pdf" });

  const nav = navigator as any;
  if (nav.canShare && nav.canShare({ files: [file] }) && typeof nav.share === "function") {
    try {
      await nav.share({ files: [file], title: filename, text: message });
      return "shared";
    } catch (err: any) {
      // user cancelled → fall through to download
      if (err?.name !== "AbortError") console.warn("share failed", err);
    }
  }

  // Fallback: download + abrir WhatsApp Web
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  const cleanPhone = (telefone || "").replace(/\D/g, "");
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank");
  return "downloaded";
}
