import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export async function htmlToPdfBlob(html: string): Promise<Blob> {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.background = "#fff";
  container.style.padding = "0";
  container.innerHTML = html;

  container.querySelectorAll("script").forEach((s) => s.remove());
  document.body.appendChild(container);

  try {
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

    const bodyEl = container.querySelector("body") as HTMLElement | null;
    let contentEl: HTMLElement;

    if (bodyEl) {
      contentEl = document.createElement("div");
      const bodyStyle = getComputedStyle(bodyEl);
      contentEl.style.cssText = `
        width: ${bodyEl.scrollWidth}px;
        padding: ${bodyStyle.padding};
        font-family: ${bodyStyle.fontFamily};
        font-size: ${bodyStyle.fontSize};
        color: ${bodyStyle.color};
        line-height: ${bodyStyle.lineHeight};
        background: #fff;
      `;
      while (bodyEl.firstChild) {
        contentEl.appendChild(bodyEl.firstChild);
      }
      container.innerHTML = "";
      container.style.padding = "0";
      container.appendChild(contentEl);
    } else {
      contentEl = container;
    }

    await new Promise((r) => setTimeout(r, 100));

    const canvas = await html2canvas(contentEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: contentEl.scrollWidth,
      height: contentEl.scrollHeight,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const MARGIN = 10;
    const contentW = pageW - MARGIN * 2;
    const contentH = pageH - MARGIN * 2;

    const pxPerMm = canvas.width / contentW;
    const totalHeightMm = canvas.height / pxPerMm;

    if (totalHeightMm <= contentH) {
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        MARGIN,
        MARGIN,
        contentW,
        totalHeightMm
      );
    } else {
      const pagePx = Math.floor(contentH * pxPerMm);
      let offset = 0;
      let first = true;

      while (offset < canvas.height) {
        if (!first) pdf.addPage();
        first = false;

        const sliceH = Math.min(pagePx, canvas.height - offset);
        const tmp = document.createElement("canvas");
        tmp.width = canvas.width;
        tmp.height = sliceH;
        const ctx = tmp.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, tmp.width, tmp.height);
        ctx.drawImage(canvas, 0, -offset);

        const hMm = sliceH / pxPerMm;
        pdf.addImage(
          tmp.toDataURL("image/jpeg", 0.95),
          "JPEG",
          MARGIN,
          MARGIN,
          contentW,
          hMm
        );
        offset += sliceH;
      }
    }

    return pdf.output("blob");
  } finally {
    document.body.removeChild(container);
  }
}

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
      if (err?.name !== "AbortError") console.warn("share failed", err);
    }
  }

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
