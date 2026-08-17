import { getDatabase, MissingDatabaseConnectionError } from "@netlify/database";
import { Buffer } from "node:buffer";
import { departmentPrefix, formatSopReference, SopStepInput, StoredSop, validateSopInput } from "./vivadocs-model";

const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type QueryResult<T> = { rows: T[] };
type QueryClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
  release(): void;
};
type PreparedStep = SopStepInput & {
  imageKey: string | null;
  imageName: string | null;
  imageType: string | null;
  imageData: Buffer | null;
};

let cachedDatabase: ReturnType<typeof getDatabase> | undefined;

export class VivaDocsConfigurationError extends Error {}
export class VivaDocsValidationError extends Error {
  constructor(public errors: string[]) { super(errors.join(" ")); }
}

function database() {
  try {
    cachedDatabase ??= getDatabase();
    return cachedDatabase;
  } catch (error) {
    if (error instanceof MissingDatabaseConnectionError) {
      throw new VivaDocsConfigurationError("VivaDocs storage is not configured. Connect Netlify Database to this site.");
    }
    throw error;
  }
}

async function transaction<T>(operation: (client: QueryClient) => Promise<T>) {
  const client = await database().pool.connect() as unknown as QueryClient;
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
  const { input, files } = await parseSopRequest(request);
  const prefix = departmentPrefix(input.department);
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const steps = await prepareStepAssets(id, input.steps, files);

  await transaction(async (client) => {
    const counterResult = await client.query<{ last_number: number }>(`INSERT INTO sop_counters (department, prefix, last_number)
      VALUES ($1, $2, 1)
      ON CONFLICT(department) DO UPDATE SET prefix = EXCLUDED.prefix, last_number = sop_counters.last_number + 1
      RETURNING last_number`, [input.department, prefix]);
    const counter = counterResult.rows[0];
    if (!counter?.last_number) throw new Error("Could not allocate an SOP reference.");
    const reference = formatSopReference(prefix, counter.last_number);

    await client.query(`INSERT INTO sops
      (id, reference, title, department, author, created_date, version, review_date, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Published', $9, $10)`, [
      id, reference, input.title, input.department, input.author, input.createdDate, input.version,
      input.reviewDate || null, timestamp, timestamp,
    ]);
    await insertSteps(client, id, steps, timestamp);
  });
  return getSop(id);
}

export async function updateSop(id: string, request: Request) {
  const existing = await getSop(id);
  if (!existing) return null;
  const { input, files } = await parseSopRequest(request);
  const existingImages = new Map(existing.steps
    .filter((step) => step.existingImageKey)
    .map((step) => [step.existingImageKey as string, { imageName: step.imageName ?? null, imageType: step.imageType ?? null }]));
  for (const [index, step] of input.steps.entries()) {
    if (step.existingImageKey && !existingImages.has(step.existingImageKey)) {
      throw new VivaDocsValidationError([`Step ${index + 1} refers to an invalid image.`]);
    }
  }
  const timestamp = new Date().toISOString();
  const steps = await prepareStepAssets(id, input.steps, files, existingImages);

  await transaction(async (client) => {
    await client.query(`UPDATE sops
      SET title = $1, department = $2, author = $3, created_date = $4, version = $5, review_date = $6, updated_at = $7
      WHERE id = $8`, [input.title, input.department, input.author, input.createdDate, input.version, input.reviewDate || null, timestamp, id]);
    await client.query("DELETE FROM sop_steps WHERE sop_id = $1", [id]);
    await insertSteps(client, id, steps, timestamp);
    const retainedKeys = steps.map((step) => step.imageKey).filter((key): key is string => Boolean(key));
    if (retainedKeys.length) {
      await client.query("DELETE FROM sop_assets WHERE sop_id = $1 AND NOT (key = ANY($2::text[]))", [id, retainedKeys]);
    } else {
      await client.query("DELETE FROM sop_assets WHERE sop_id = $1", [id]);
    }
  });
  return getSop(id);
}

async function insertSteps(client: QueryClient, sopId: string, steps: PreparedStep[], timestamp: string) {
  for (const [index, step] of steps.entries()) {
    if (step.imageKey && step.imageData) {
      await client.query(`INSERT INTO sop_assets
        (key, sop_id, step_id, data, content_type, original_name, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
        step.imageKey, sopId, step.id, step.imageData, step.imageType, step.imageName, timestamp,
      ]);
    }
    await client.query(`INSERT INTO sop_steps
      (id, sop_id, position, instruction, image_key, image_name, image_type, image_caption)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
      step.id, sopId, index + 1, step.instruction, step.imageKey, step.imageName, step.imageType, step.imageCaption || null,
    ]);
  }
}

async function prepareStepAssets(
  sopId: string,
  steps: SopStepInput[],
  files: Map<string, File>,
  existingImages = new Map<string, { imageName: string | null; imageType: string | null }>(),
): Promise<PreparedStep[]> {
  return Promise.all(steps.map(async (step) => {
    const file = step.uploadKey ? files.get(step.uploadKey) : undefined;
    let imageKey = step.existingImageKey || null;
    let imageName = imageKey ? existingImages.get(imageKey)?.imageName ?? null : null;
    let imageType = imageKey ? existingImages.get(imageKey)?.imageType ?? null : null;
    let imageData: Buffer | null = null;
    if (file) {
      const extension = IMAGE_TYPES.get(file.type.toLowerCase())!;
      imageKey = `sops/${sopId}/${step.id}/${crypto.randomUUID()}.${extension}`;
      imageName = file.name.slice(0, 180);
      imageType = file.type;
      imageData = Buffer.from(await file.arrayBuffer());
    }
    return { ...step, imageKey, imageName, imageType, imageData };
  }));
}

export async function listSops() {
  const result = await database().pool.query(`SELECT s.id, s.reference, s.title, s.department, s.author, s.created_date,
    s.version, s.review_date, s.status, s.available_to_all_departments, s.created_at, s.updated_at, COUNT(st.id) AS step_count
    FROM sops s LEFT JOIN sop_steps st ON st.sop_id = s.id
    GROUP BY s.id ORDER BY s.updated_at DESC`);
  const rows = result.rows as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id), reference: String(row.reference), title: String(row.title), department: String(row.department),
    author: String(row.author), createdDate: String(row.created_date), version: String(row.version),
    reviewDate: row.review_date ? String(row.review_date) : "", status: String(row.status),
    availableToAllDepartments: Boolean(row.available_to_all_departments),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at), stepCount: Number(row.step_count),
  }));
}

export async function getSop(id: string): Promise<StoredSop | null> {
  const db = database();
  const sopResult = await db.pool.query("SELECT * FROM sops WHERE id = $1", [id]);
  const sop = sopResult.rows[0] as Record<string, unknown> | undefined;
  if (!sop) return null;
  const stepResult = await db.pool.query("SELECT * FROM sop_steps WHERE sop_id = $1 ORDER BY position", [id]);
  const stepRows = stepResult.rows as Record<string, unknown>[];
  return {
    id: String(sop.id), reference: String(sop.reference), title: String(sop.title), department: String(sop.department) as StoredSop["department"],
    author: String(sop.author), createdDate: String(sop.created_date), version: String(sop.version),
    reviewDate: sop.review_date ? String(sop.review_date) : "", status: String(sop.status),
    availableToAllDepartments: Boolean(sop.available_to_all_departments),
    createdAt: String(sop.created_at), updatedAt: String(sop.updated_at),
    steps: stepRows.map((step) => ({
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
  const result = await database().pool.query(
    "SELECT data, content_type, original_name FROM sop_assets WHERE key = $1",
    [key],
  );
  const asset = result.rows[0] as Record<string, unknown> | undefined;
  if (!asset) return null;
  return {
    data: Buffer.isBuffer(asset.data) ? asset.data : Buffer.from(asset.data as Uint8Array),
    contentType: String(asset.content_type),
    originalName: String(asset.original_name),
  };
}
