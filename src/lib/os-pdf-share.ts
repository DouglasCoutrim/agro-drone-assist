import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Render an HTML string into a multi-page PDF Blob (A4).
 */
export async function htmlToPdfBlob(html: string, filename: string): Promise<Blob> {
  // Render the HTML offscreen so html2canvas can rasterize it
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "794px"; // ~A4 width @96dpi
  container.style.background = "#fff";
  container.innerHTML = html;
  // Strip the auto-print script
  container.querySelectorAll("script").forEach((s) => s.remove());
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const MARGIN = 10; // mm on all sides
    const contentW = pageW - MARGIN * 2;
    const contentH = pageH - MARGIN * 2;
    const imgW = contentW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    let heightLeft = imgH;
    let position = MARGIN;

    pdf.addImage(imgData, "JPEG", MARGIN, position, imgW, imgH);
    heightLeft -= contentH;

    while (heightLeft > 0) {
      position = MARGIN - (imgH - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", MARGIN, position, imgW, imgH);
      heightLeft -= contentH;
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
