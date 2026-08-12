import { departmentPrefix, formatSopReference, SopStepInput, StoredSop, validateSopInput } from "./vivadocs-model";

type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};

type SopDatabase = {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
};

type SopBucket = {
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string }; writeHttpMetadata(headers: Headers): void } | null>;
  put(key: string, value: ArrayBuffer, options: { httpMetadata: { contentType: string }; customMetadata: Record<string, string> }): Promise<unknown>;
  delete(key: string): Promise<void>;
};

const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export class VivaDocsConfigurationError extends Error {}
export class VivaDocsValidationError extends Error {
  constructor(public errors: string[]) { super(errors.join(" ")); }
}

async function bindings() {
  const { env } = await import("cloudflare:workers");
  const db = env.DB as unknown as SopDatabase | undefined;
  const assets = env.SOP_ASSETS as unknown as SopBucket | undefined;
  if (!db || !assets) throw new VivaDocsConfigurationError("VivaDocs storage is not configured.");
  return { db, assets };
}

export async function parseSopRequest(request: Request) {
  const form = await request.formData();
  const raw = form.get("sop");
  if (typeof raw !== "string") throw new VivaDocsValidationError(["The SOP details are missing."]);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new VivaDocsValidationError(["The SOP details are invalid."]); }
  const result = validateSopInput(parsed);
  if (!result.data || result.errors.length) throw new VivaDocsValidationError(result.errors);
  const files = new Map<string, File>();
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("image-") || !(value instanceof File) || !value.size) continue;
    const type = value.type.toLowerCase();
    if (!IMAGE_TYPES.has(type)) throw new VivaDocsValidationError([`${value.name || "Image"} must be JPEG, PNG, WebP or GIF.`]);
    if (value.size > MAX_IMAGE_BYTES) throw new VivaDocsValidationError([`${value.name || "Image"} must be 8 MB or smaller.`]);
    files.set(key.slice(6), value);
  }
  for (const [index, step] of result.data.steps.entries()) {
    if (step.uploadKey && !files.has(step.uploadKey)) throw new VivaDocsValidationError([`Step ${index + 1} image upload is missing.`]);
  }
  return { input: result.data, files };
}

export async function createSop(request: Request) {
  const { db, assets } = await bindings();
  const { input, files } = await parseSopRequest(request);
  const prefix = departmentPrefix(input.department);
  const counter = await db.prepare(`INSERT INTO sop_counters (department, prefix, last_number)
    VALUES (?, ?, 1)
    ON CONFLICT(department) DO UPDATE SET last_number = last_number + 1
    RETURNING last_number`).bind(input.department, prefix).first<{ last_number: number }>();
  if (!counter?.last_number) throw new Error("Could not allocate an SOP reference.");

  const id = crypto.randomUUID();
  const reference = formatSopReference(prefix, counter.last_number);
  const timestamp = new Date().toISOString();
  const uploaded: string[] = [];
  try {
    const steps = await prepareStepAssets(id, input.steps, files, assets, uploaded);
    const statements = [
      db.prepare(`INSERT INTO sops
        (id, reference, title, department, author, created_date, version, review_date, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Published', ?, ?)`).bind(
        id, reference, input.title, input.department, input.author, input.createdDate, input.version,
        input.reviewDate || null, timestamp, timestamp,
      ),
      ...steps.map((step, index) => db.prepare(`INSERT INTO sop_steps
        (id, sop_id, position, instruction, image_key, image_name, image_type, image_caption)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        step.id, id, index + 1, step.instruction, step.imageKey, step.imageName, step.imageType, step.imageCaption || null,
      )),
    ];
    await db.batch(statements);
  } catch (error) {
    await Promise.allSettled(uploaded.map((key) => assets.delete(key)));
    throw error;
  }
  return getSop(id);
}

export async function updateSop(id: string, request: Request) {
  const { db, assets } = await bindings();
  const existing = await getSop(id);
  if (!existing) return null;
  const { input, files } = await parseSopRequest(request);
  const existingKeys = new Set(existing.steps.map((step) => step.existingImageKey).filter(Boolean) as string[]);
  for (const [index, step] of input.steps.entries()) {
    if (step.existingImageKey && !existingKeys.has(step.existingImageKey)) {
      throw new VivaDocsValidationError([`Step ${index + 1} refers to an invalid image.`]);
    }
  }
  const uploaded: string[] = [];
  const timestamp = new Date().toISOString();
  try {
    const steps = await prepareStepAssets(id, input.steps, files, assets, uploaded);
    await db.batch([
      db.prepare(`UPDATE sops SET title = ?, department = ?, author = ?, created_date = ?, version = ?, review_date = ?, updated_at = ? WHERE id = ?`).bind(
        input.title, input.department, input.author, input.createdDate, input.version, input.reviewDate || null, timestamp, id,
      ),
      db.prepare("DELETE FROM sop_steps WHERE sop_id = ?").bind(id),
      ...steps.map((step, index) => db.prepare(`INSERT INTO sop_steps
        (id, sop_id, position, instruction, image_key, image_name, image_type, image_caption)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        step.id, id, index + 1, step.instruction, step.imageKey, step.imageName, step.imageType, step.imageCaption || null,
      )),
    ]);
    const retained = new Set(steps.map((step) => step.imageKey).filter(Boolean));
    await Promise.allSettled([...existingKeys].filter((key) => !retained.has(key)).map((key) => assets.delete(key)));
  } catch (error) {
    await Promise.allSettled(uploaded.map((key) => assets.delete(key)));
    throw error;
  }
  return getSop(id);
}

async function prepareStepAssets(
  sopId: string,
  steps: SopStepInput[],
  files: Map<string, File>,
  assets: SopBucket,
  uploaded: string[],
) {
  return Promise.all(steps.map(async (step) => {
    const file = step.uploadKey ? files.get(step.uploadKey) : undefined;
    let imageKey = step.existingImageKey || null;
    let imageName: string | null = null;
    let imageType: string | null = null;
    if (file) {
      const extension = IMAGE_TYPES.get(file.type.toLowerCase())!;
      imageKey = `sops/${sopId}/${step.id}/${crypto.randomUUID()}.${extension}`;
      imageName = file.name.slice(0, 180);
      imageType = file.type;
      await assets.put(imageKey, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
        customMetadata: { sopId, stepId: step.id, originalName: imageName },
      });
      uploaded.push(imageKey);
    }
    return { ...step, imageKey, imageName, imageType };
  }));
}

export async function listSops() {
  const { db } = await bindings();
  const rows = await db.prepare(`SELECT s.id, s.reference, s.title, s.department, s.author, s.created_date,
    s.version, s.review_date, s.status, s.created_at, s.updated_at, COUNT(st.id) AS step_count
    FROM sops s LEFT JOIN sop_steps st ON st.sop_id = s.id
    GROUP BY s.id ORDER BY s.updated_at DESC`).all<Record<string, unknown>>();
  return rows.results.map((row) => ({
    id: String(row.id), reference: String(row.reference), title: String(row.title), department: String(row.department),
    author: String(row.author), createdDate: String(row.created_date), version: String(row.version),
    reviewDate: row.review_date ? String(row.review_date) : "", status: String(row.status),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at), stepCount: Number(row.step_count),
  }));
}

export async function getSop(id: string): Promise<StoredSop | null> {
  const { db } = await bindings();
  const sop = await db.prepare("SELECT * FROM sops WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!sop) return null;
  const stepRows = await db.prepare("SELECT * FROM sop_steps WHERE sop_id = ? ORDER BY position").bind(id).all<Record<string, unknown>>();
  return {
    id: String(sop.id), reference: String(sop.reference), title: String(sop.title), department: String(sop.department) as StoredSop["department"],
    author: String(sop.author), createdDate: String(sop.created_date), version: String(sop.version),
    reviewDate: sop.review_date ? String(sop.review_date) : "", status: String(sop.status),
    createdAt: String(sop.created_at), updatedAt: String(sop.updated_at),
    steps: stepRows.results.map((step) => ({
      id: String(step.id), position: Number(step.position), instruction: String(step.instruction),
      imageCaption: step.image_caption ? String(step.image_caption) : "",
      existingImageKey: step.image_key ? String(step.image_key) : null,
      existingImageUrl: step.image_key ? `/api/vivadocs/images/${String(step.image_key).split("/").map(encodeURIComponent).join("/")}` : null,
      uploadKey: null, imageName: step.image_name ? String(step.image_name) : null,
      imageType: step.image_type ? String(step.image_type) : null,
    })),
  };
}

export async function getSopAsset(key: string) {
  const { assets } = await bindings();
  return assets.get(key);
}
