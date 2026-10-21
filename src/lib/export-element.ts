import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function buildExportFilename(
  leagueName: string,
  editionLabel: string,
  extension: "png" | "pdf",
) {
  const base = ["power-rankings", slugify(leagueName), slugify(editionLabel)]
    .filter(Boolean)
    .join("-");
  return `${base || "power-rankings"}.${extension}`;
}

function resolveBackgroundColor(node: HTMLElement) {
  const fromNode = getComputedStyle(node).backgroundColor;
  if (fromNode && fromNode !== "rgba(0, 0, 0, 0)" && fromNode !== "transparent") {
    return fromNode;
  }
  const fromBody = getComputedStyle(document.body).backgroundColor;
  if (fromBody && fromBody !== "rgba(0, 0, 0, 0)" && fromBody !== "transparent") {
    return fromBody;
  }
  return "#ffffff";
}

function withAvatarFallbacksOnly<T>(node: HTMLElement, run: () => Promise<T>) {
  const images = Array.from(node.querySelectorAll("img"));
  const fallbacks = Array.from(
    node.querySelectorAll<HTMLElement>('[data-slot="avatar-fallback"]'),
  );

  const previousImageDisplay = images.map((img) => img.style.display);
  const previousFallbackDisplay = fallbacks.map((el) => el.style.display);

  images.forEach((img) => {
    img.style.display = "none";
  });
  fallbacks.forEach((el) => {
    el.style.display = "flex";
  });

  return run().finally(() => {
    images.forEach((img, index) => {
      img.style.display = previousImageDisplay[index] ?? "";
    });
    fallbacks.forEach((el, index) => {
      el.style.display = previousFallbackDisplay[index] ?? "";
    });
  });
}

async function captureElementPng(node: HTMLElement) {
  const options = {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: resolveBackgroundColor(node),
  };

  try {
    return await toPng(node, options);
  } catch {
    // ESPN (and other) logos often lack CORS headers; fall back to initials.
    return withAvatarFallbacksOnly(node, () => toPng(node, options));
  }
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = href;
  link.click();
}

export async function downloadElementAsPng(
  node: HTMLElement,
  filename: string,
) {
  const dataUrl = await captureElementPng(node);
  triggerDownload(dataUrl, filename);
}

export async function downloadElementAsPdf(
  node: HTMLElement,
  filename: string,
) {
  const dataUrl = await captureElementPng(node);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const contentWidth = pageWidth - margin * 2;

  const image = new Image();
  image.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to load export image."));
  });

  const contentHeight = (image.height * contentWidth) / image.width;
  let heightLeft = contentHeight;
  let offsetY = margin;

  pdf.addImage(
    dataUrl,
    "PNG",
    margin,
    offsetY,
    contentWidth,
    contentHeight,
    undefined,
    "FAST",
  );
  heightLeft -= pageHeight - margin;

  while (heightLeft > 0) {
    offsetY = margin - (contentHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(
      dataUrl,
      "PNG",
      margin,
      offsetY,
      contentWidth,
      contentHeight,
      undefined,
      "FAST",
    );
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}
