export const SOP_DEPARTMENTS = [
  { name: "Prepress", prefix: "PRE" },
  { name: "CST", prefix: "CST" },
  { name: "Printers", prefix: "PRI" },
  { name: "Cutters", prefix: "CUT" },
  { name: "Fab1", prefix: "FAB" },
  { name: "Sew", prefix: "SEW" },
  { name: "Despatch", prefix: "DES" },
  { name: "Light Box", prefix: "LIG" },
  { name: "Framing", prefix: "FRA" },
  { name: "Office", prefix: "OFF" },
] as const;

export type SopDepartment = (typeof SOP_DEPARTMENTS)[number]["name"];

export type SopStepInput = {
  id: string;
  instruction: string;
  imageCaption: string;
  existingImageKey?: string | null;
  existingImageUrl?: string | null;
  uploadKey?: string | null;
};

export type SopInput = {
  title: string;
  department: SopDepartment;
  author: string;
  createdDate: string;
  version: string;
  reviewDate: string;
  steps: SopStepInput[];
};

export type StoredSop = Omit<SopInput, "steps"> & {
  id: string;
  reference: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  steps: Array<SopStepInput & {
    position: number;
    imageName?: string | null;
    imageType?: string | null;
  }>;
};

export function departmentPrefix(department: string) {
  return SOP_DEPARTMENTS.find((item) => item.name === department)?.prefix ?? "";
}

export function formatSopReference(prefix: string, number: number) {
  return `${prefix}-${String(number).padStart(6, "0")}`;
}

export function validateSopInput(value: unknown): { data?: SopInput; errors: string[] } {
  if (!value || typeof value !== "object") return { errors: ["The SOP details are missing."] };
  const input = value as Record<string, unknown>;
  const errors: string[] = [];
  const title = cleanText(input.title, 180);
  const department = cleanText(input.department, 40) as SopDepartment;
  const author = cleanText(input.author, 120);
  const createdDate = cleanDate(input.createdDate);
  const version = cleanText(input.version, 30);
  const reviewDate = input.reviewDate ? cleanDate(input.reviewDate) : "";
  if (!title) errors.push("SOP title is required.");
  if (!departmentPrefix(department)) errors.push("Select a valid department.");
  if (!author) errors.push("Author or owner is required.");
  if (!createdDate) errors.push("Created date is required.");
  if (!version) errors.push("Revision or version is required.");
  if (input.reviewDate && !reviewDate) errors.push("Review or approval date is invalid.");

  const rawSteps = Array.isArray(input.steps) ? input.steps : [];
  if (!rawSteps.length) errors.push("Add at least one SOP step.");
  const steps = rawSteps.map((raw, index) => {
    const step = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const instruction = cleanText(step.instruction, 8000);
    if (!instruction) errors.push(`Step ${index + 1} instructions are required.`);
    return {
      id: cleanId(step.id) || crypto.randomUUID(),
      instruction,
      imageCaption: cleanText(step.imageCaption, 240),
      existingImageKey: cleanStorageKey(step.existingImageKey),
      existingImageUrl: null,
      uploadKey: cleanId(step.uploadKey),
    };
  });
  return { data: { title, department, author, createdDate, version, reviewDate, steps }, errors };
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\0/g, "").trim().slice(0, max) : "";
}

function cleanDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? "" : value;
}

function cleanId(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : "";
}

function cleanStorageKey(value: unknown) {
  return typeof value === "string" && /^sops\/[a-zA-Z0-9/_-]+\.[a-zA-Z0-9]+$/.test(value) ? value : null;
}

export function safeFileName(reference: string, title: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "sop";
  return `${reference}-${slug}`;
}
