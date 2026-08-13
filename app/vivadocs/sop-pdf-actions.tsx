"use client";

import { useEffect, useRef, useState } from "react";

export type PdfSop = {
  reference: string;
  title: string;
  revision: string;
  status: string;
  owner?: string;
  location?: string;
  reviewDate?: string;
  steps: Array<{
    position?: number;
    title?: string;
    instruction: string;
    imageUrl?: string | null;
    imageCaption?: string;
  }>;
};

type PreparedImage = { data: string; fileType: string; width: number; height: number };
type PreparedStep = PdfSop["steps"][number] & { image: PreparedImage | null; imageUnavailable: boolean };

export const MAX_STEPS_PER_PDF_PAGE = 4;
const LOGO_URL = "/vivad-logo.png";

function filenamePart(value: string, fallback: string) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[. -]+|[. -]+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}

export function sopPdfFilename(sop: Pick<PdfSop, "reference" | "title" | "revision">) {
  return `${filenamePart(sop.reference, "SOP")}_${filenamePart(sop.title, "Procedure")}_Rev-${filenamePart(sop.revision, "1.0")}.pdf`;
}

async function urlAsDataUrl(url: string, label: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} could not be loaded.`);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`${label} could not be read.`));
    reader.readAsDataURL(blob);
  });
}

export async function buildSopPdf(sop: PdfSop) {
  const { jsPDF } = await import("jspdf");
  let logoData: string;
  try {
    logoData = await urlAsDataUrl(LOGO_URL, "The Vivad SPARK logo");
  } catch {
    throw new Error("The Vivad SPARK logo could not be loaded. The PDF was not created.");
  }

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const logoProps = pdf.getImageProperties(logoData);
  const prepared: PreparedStep[] = await Promise.all(
    sop.steps.map(async (step) => {
      if (!step.imageUrl) return { ...step, image: null, imageUnavailable: false };
      try {
        const data = await urlAsDataUrl(step.imageUrl, `Step ${step.position ?? ""} image`);
        const properties = pdf.getImageProperties(data);
        return { ...step, image: { data, fileType: properties.fileType, width: properties.width, height: properties.height }, imageUnavailable: false };
      } catch {
        return { ...step, image: null, imageUnavailable: true };
      }
    }),
  );

  const pageWidth = 210;
  const left = 15;
  const right = 15;
  const contentWidth = pageWidth - left - right;
  const contentTop = 43;
  const contentBottom = 279;
  const footerY = 288;
  let y = contentTop;
  let stepsOnPage = 0;

  const dateLabel = (value?: string) => {
    if (!value) return "Not scheduled";
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(parsed.valueOf()) ? value : new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed);
  };

  const addHeader = () => {
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(42, 112, 201);
    pdf.setFontSize(8);
    pdf.text(`${sop.reference}  |  REV ${sop.revision}`, left, 13);
    pdf.setTextColor(68, 74, 81);
    pdf.setFontSize(13);
    pdf.text(pdf.splitTextToSize(sop.title, 112).slice(0, 2), left, 20);
    const logoWidth = 54;
    const logoHeight = logoWidth * (logoProps.height / logoProps.width);
    pdf.addImage(logoData, logoProps.fileType, pageWidth - right - logoWidth, 8, logoWidth, logoHeight);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(100, 106, 113);
    const metadata = [
      `Status: ${sop.status || "Not specified"}`,
      `Owner: ${sop.owner || "Not specified"}`,
      `Location: ${sop.location || "Not specified"}`,
      `Review: ${dateLabel(sop.reviewDate)}`,
    ].join("   |   ");
    pdf.text(metadata, left, 37, { maxWidth: contentWidth });
    pdf.setDrawColor(220, 224, 228);
    pdf.line(left, 40, pageWidth - right, 40);
  };

  addHeader();

  for (let index = 0; index < prepared.length; index += 1) {
    const step = prepared[index];
    const stepNumber = step.position ?? index + 1;
    let fontSize = 8.5;
    let imageHeight = step.image ? Math.min(38, contentWidth * 0.48 * step.image.height / step.image.width) : 14;
    let instructionLines = pdf.splitTextToSize(step.instruction || "No instructions provided.", contentWidth - 10);
    const captionLines = step.imageCaption ? pdf.splitTextToSize(step.imageCaption, contentWidth - 10) : [];
    const measuredHeight = () => 12 + instructionLines.length * (fontSize * 0.39) + imageHeight + captionLines.length * 3 + 10;
    while (measuredHeight() > contentBottom - contentTop && fontSize > 6) {
      fontSize -= 0.5;
      pdf.setFontSize(fontSize);
      instructionLines = pdf.splitTextToSize(step.instruction || "No instructions provided.", contentWidth - 10);
      imageHeight = Math.max(step.image ? 18 : 12, imageHeight - 3);
    }
    const blockHeight = measuredHeight();
    if (blockHeight > contentBottom - contentTop) {
      throw new Error(`Step ${stepNumber} is too long to fit on one PDF page. Shorten or divide this step and try again.`);
    }
    if (stepsOnPage === MAX_STEPS_PER_PDF_PAGE || (stepsOnPage > 0 && y + blockHeight > contentBottom)) {
      pdf.addPage();
      addHeader();
      y = contentTop;
      stepsOnPage = 0;
    }

    pdf.setFillColor(247, 249, 252);
    pdf.setDrawColor(216, 221, 226);
    pdf.roundedRect(left, y, contentWidth, blockHeight - 4, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(42, 112, 201);
    pdf.setFontSize(8);
    pdf.text(`STEP ${stepNumber}`, left + 5, y + 7);
    if (step.title) {
      pdf.setTextColor(68, 74, 81);
      pdf.text(step.title, left + 26, y + 7, { maxWidth: contentWidth - 31 });
    }
    let cursor = y + 13;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(61, 67, 74);
    pdf.setFontSize(fontSize);
    pdf.text(instructionLines, left + 5, cursor);
    cursor += instructionLines.length * (fontSize * 0.39) + 4;

    const imageWidth = step.image ? Math.min(contentWidth - 10, imageHeight * step.image.width / step.image.height) : contentWidth - 10;
    if (step.image) {
      pdf.addImage(step.image.data, step.image.fileType, left + 5, cursor, imageWidth, imageHeight);
    } else {
      pdf.setFillColor(239, 242, 245);
      pdf.setDrawColor(190, 196, 202);
      pdf.setLineDashPattern([2, 2], 0);
      pdf.rect(left + 5, cursor, imageWidth, imageHeight, "FD");
      pdf.setLineDashPattern([], 0);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(115, 121, 128);
      pdf.setFontSize(7.5);
      pdf.text(step.imageUnavailable ? "STEP IMAGE UNAVAILABLE" : "NO STEP IMAGE PROVIDED", left + 5 + imageWidth / 2, cursor + imageHeight / 2 + 1, { align: "center" });
    }
    cursor += imageHeight + 4;
    if (captionLines.length) {
      pdf.setFont("helvetica", "italic");
      pdf.setTextColor(105, 111, 118);
      pdf.setFontSize(7);
      pdf.text(captionLines, left + 5, cursor);
    }
    y += blockHeight;
    stepsOnPage += 1;
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(220, 224, 228);
    pdf.line(left, 283, pageWidth - right, 283);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(115, 121, 128);
    pdf.setFontSize(7);
    pdf.text(sop.reference, left, footerY);
    pdf.text(`Page ${page} of ${pages}`, pageWidth - right, footerY, { align: "right" });
  }

  return { blob: pdf.output("blob"), filename: sopPdfFilename(sop), pageCount: pages };
}

export function SopPdfActions({ sop, compact = false }: { sop: PdfSop; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pdf, setPdf] = useState<{ blob: Blob; url: string; filename: string } | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf.url); }, [pdf]);
  useEffect(() => { if (pdf) closeRef.current?.focus(); }, [pdf]);

  async function generate() {
    setBusy(true);
    setError("");
    setMessage("Generating your branded PDF…");
    try {
      const result = await buildSopPdf(sop);
      const url = URL.createObjectURL(result.blob);
      setPdf((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { blob: result.blob, url, filename: result.filename };
      });
      setMessage(`PDF ready - ${result.pageCount} ${result.pageCount === 1 ? "page" : "pages"}.`);
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? caught.message : "The PDF could not be generated. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!pdf) return;
    const link = document.createElement("a");
    link.href = pdf.url;
    link.download = pdf.filename;
    link.click();
    setMessage("PDF downloaded successfully.");
  }

  async function share() {
    if (!pdf) return;
    const file = new File([pdf.blob], pdf.filename, { type: "application/pdf" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        await navigator.share({ title: sop.title, text: `${sop.reference} - ${sop.title}`, files: [file] });
        setMessage("PDF shared successfully.");
        return;
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
      }
    }
    download();
    setMessage("Sharing is not supported on this device, so the PDF was downloaded instead.");
  }

  function print() {
    if (!pdf) return;
    const frameWindow = frameRef.current?.contentWindow;
    if (frameWindow) {
      frameWindow.focus();
      frameWindow.print();
    } else {
      window.open(pdf.url, "_blank", "noopener,noreferrer");
    }
  }

  function close() {
    setPdf((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    setMessage("");
  }

  return <>
    <button className={compact ? "secondary sop-pdf-trigger" : "sop-pdf-trigger"} type="button" disabled={busy} onClick={generate} aria-haspopup="dialog">
      {busy ? "Generating PDF…" : "PDF"}<b aria-hidden="true">PDF</b>
    </button>
    {(message || error) && <span className={`sop-pdf-inline-feedback${error ? " error" : ""}`} role={error ? "alert" : "status"}>{error || message}</span>}
    {pdf && <div className="sop-pdf-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="sop-pdf-dialog" role="dialog" aria-modal="true" aria-labelledby="sop-pdf-title" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
        <header><div><span>VIVADOCS PDF</span><h2 id="sop-pdf-title">{sop.title}</h2></div><button ref={closeRef} type="button" aria-label="Close PDF preview" onClick={close}>×</button></header>
        <div className="sop-pdf-toolbar" aria-label="PDF actions">
          <a href={pdf.url} target="_blank" rel="noreferrer">Open PDF</a>
          <button type="button" onClick={print}>Print</button>
          <button type="button" onClick={share}>Share</button>
          <button className="primary" type="button" onClick={download}>Download</button>
        </div>
        <iframe ref={frameRef} src={pdf.url} title={`PDF preview for ${sop.title}`} />
      </section>
    </div>}
  </>;
}
