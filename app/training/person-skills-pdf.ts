export type PersonSkillsReport = {
  person: { name: string; department: string; role: string };
  sopSkills: Array<{
    reference: string;
    title: string;
    status: string;
    source: string;
    completedAt: string;
  }>;
  videos: Array<{
    title: string;
    category: string;
    completedAt: string;
  }>;
};

const LOGO_URL = "/vivad-logo.png";

function filenamePart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[. -]+|[. -]+$/g, "")
    .slice(0, 80) || "Team-member";
}

function dateLabel(value: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

async function logoAsDataUrl() {
  const response = await fetch(LOGO_URL);
  if (!response.ok) throw new Error("The Vivad SPARK logo could not be loaded. The PDF was not created.");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The Vivad SPARK logo could not be read."));
    reader.readAsDataURL(blob);
  });
}

export async function buildPersonSkillsPdf(report: PersonSkillsReport) {
  const { jsPDF } = await import("jspdf");
  const logoData = await logoAsDataUrl();
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const logoProps = pdf.getImageProperties(logoData);
  const pageWidth = 210;
  const left = 15;
  const right = 15;
  const contentWidth = pageWidth - left - right;
  const contentTop = 48;
  const contentBottom = 279;
  let y = contentTop;

  const addHeader = () => {
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(42, 112, 201);
    pdf.setFontSize(8);
    pdf.text("VIVAD LEARNING SYSTEM", left, 12);
    pdf.setTextColor(68, 74, 81);
    pdf.setFontSize(17);
    pdf.text("Training and skills record", left, 21);
    pdf.setFontSize(11);
    pdf.text(report.person.name, left, 29);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100, 106, 113);
    pdf.setFontSize(8);
    pdf.text(`${report.person.department}  |  ${report.person.role || "Team member"}`, left, 35);
    pdf.text(`Generated ${dateLabel(new Date().toISOString())}`, left, 40);
    const logoWidth = 55;
    const logoHeight = logoWidth * (logoProps.height / logoProps.width);
    pdf.addImage(logoData, logoProps.fileType, pageWidth - right - logoWidth, 8, logoWidth, logoHeight);
    pdf.setDrawColor(220, 224, 228);
    pdf.line(left, 44, pageWidth - right, 44);
  };

  const newPage = () => {
    pdf.addPage();
    addHeader();
    y = contentTop;
  };

  const ensureSpace = (height: number) => {
    if (y + height > contentBottom) newPage();
  };

  const section = (title: string, count: number) => {
    ensureSpace(13);
    pdf.setFillColor(235, 244, 253);
    pdf.roundedRect(left, y, contentWidth, 10, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(42, 112, 201);
    pdf.setFontSize(9);
    pdf.text(`${title.toUpperCase()}  (${count})`, left + 4, y + 6.5);
    y += 14;
  };

  const empty = (message: string) => {
    ensureSpace(15);
    pdf.setFont("helvetica", "italic");
    pdf.setTextColor(115, 121, 128);
    pdf.setFontSize(8);
    pdf.text(message, left + 3, y + 5);
    y += 13;
  };

  addHeader();
  section("SOP skills acquired", report.sopSkills.length);
  if (!report.sopSkills.length) empty("No SOP competency records have been acquired yet.");
  for (const skill of report.sopSkills) {
    const titleLines = pdf.splitTextToSize(skill.title, 92);
    const height = Math.max(16, 10 + titleLines.length * 3.4);
    ensureSpace(height + 3);
    pdf.setDrawColor(221, 225, 229);
    pdf.setFillColor(249, 250, 252);
    pdf.roundedRect(left, y, contentWidth, height, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(68, 74, 81);
    pdf.setFontSize(8);
    pdf.text(skill.reference, left + 4, y + 6);
    pdf.setFont("helvetica", "normal");
    pdf.text(titleLines, left + 34, y + 6);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(84, 142, 35);
    pdf.text(skill.status, left + 130, y + 6);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(110, 116, 123);
    pdf.setFontSize(7);
    pdf.text(`${skill.source}  |  ${dateLabel(skill.completedAt)}`, left + 130, y + 11);
    y += height + 3;
  }

  section("Training videos watched", report.videos.length);
  if (!report.videos.length) empty("No completed training videos have been recorded yet.");
  for (const video of report.videos) {
    const titleLines = pdf.splitTextToSize(video.title, 112);
    const height = Math.max(15, 9 + titleLines.length * 3.4);
    ensureSpace(height + 3);
    pdf.setDrawColor(221, 225, 229);
    pdf.roundedRect(left, y, contentWidth, height, 2, 2, "S");
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(68, 74, 81);
    pdf.setFontSize(8);
    pdf.text(titleLines, left + 4, y + 6);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(42, 112, 201);
    pdf.text(video.category, left + 126, y + 6);
    pdf.setTextColor(110, 116, 123);
    pdf.setFontSize(7);
    pdf.text(dateLabel(video.completedAt), left + 126, y + 11);
    y += height + 3;
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(220, 224, 228);
    pdf.line(left, 283, pageWidth - right, 283);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(115, 121, 128);
    pdf.setFontSize(7);
    pdf.text(`${report.person.name} - training and skills record`, left, 288);
    pdf.text(`Page ${page} of ${pages}`, pageWidth - right, 288, { align: "right" });
  }

  return {
    blob: pdf.output("blob"),
    filename: `${filenamePart(report.person.name)}_Training-and-Skills.pdf`,
    pageCount: pages,
  };
}
