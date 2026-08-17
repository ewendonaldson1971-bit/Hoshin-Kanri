import { getDatabase, MissingDatabaseConnectionError } from "@netlify/database";
import { SOP_DEPARTMENTS } from "./vivadocs-model";

export const TRAINING_STATUSES = [
  "Gap",
  "In training",
  "Competent",
  "Trainer",
  "Expired",
] as const;

export type TrainingStatus = (typeof TRAINING_STATUSES)[number];

export type SkillsPerson = {
  id: string;
  name: string;
  department: string;
  role: string;
  createdAt: string;
  updatedAt: string;
};

export type TrainingRecord = {
  id: string;
  personId: string;
  sopId: string;
  status: TrainingStatus;
  source: "Manual" | "SOP completion";
  completedAt: string;
  updatedAt: string;
};

type QueryResult<T> = { rows: T[] };
type QueryClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
  release(): void;
};

let cachedDatabase: ReturnType<typeof getDatabase> | undefined;

export class VivaDocsSkillsConfigurationError extends Error {}
export class VivaDocsSkillsValidationError extends Error {}
export class VivaDocsSkillsNotFoundError extends Error {}

function database() {
  try {
    cachedDatabase ??= getDatabase();
    return cachedDatabase;
  } catch (error) {
    if (error instanceof MissingDatabaseConnectionError) {
      throw new VivaDocsSkillsConfigurationError(
        "Skills storage is not configured. Connect Netlify Database to this site.",
      );
    }
    throw error;
  }
}

async function transaction<T>(operation: (client: QueryClient) => Promise<T>) {
  const client = (await database().pool.connect()) as unknown as QueryClient;
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

export async function getSkillsMatrix() {
  const db = database();
  const [peopleResult, recordResult] = await Promise.all([
    db.pool.query(
      `SELECT id, name, department, role, created_at, updated_at
       FROM vivadocs_people ORDER BY department, name`,
    ),
    db.pool.query(
      `SELECT id, person_id, sop_id, status, source, completed_at, updated_at
       FROM vivadocs_training_records ORDER BY updated_at DESC`,
    ),
  ]);

  return {
    departments: SOP_DEPARTMENTS.map((department) => department.name),
    people: (peopleResult.rows as Record<string, unknown>[]).map(mapPerson),
    records: (recordResult.rows as Record<string, unknown>[]).map(mapRecord),
  };
}

export async function addSkillsPerson(value: unknown) {
  const input = asObject(value);
  const name = cleanText(input.name, 120);
  const department = validDepartment(input.department);
  const role = cleanText(input.role, 120) || "Team member";
  if (!name) throw new VivaDocsSkillsValidationError("Enter the person's name.");
  if (!department) throw new VivaDocsSkillsValidationError("Select a valid department.");
  const timestamp = new Date().toISOString();
  try {
    const result = await database().pool.query(
      `INSERT INTO vivadocs_people (id, name, department, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING id, name, department, role, created_at, updated_at`,
      [crypto.randomUUID(), name, department, role, timestamp],
    );
    return mapPerson(result.rows[0] as Record<string, unknown>);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new VivaDocsSkillsValidationError("That person is already in the skills matrix.");
    }
    throw error;
  }
}

export async function transferSkillsPerson(value: unknown) {
  const input = asObject(value);
  const personId = cleanId(input.personId);
  const department = validDepartment(input.department);
  if (!personId) throw new VivaDocsSkillsValidationError("Select a person to transfer.");
  if (!department) throw new VivaDocsSkillsValidationError("Select a valid department.");
  const result = await database().pool.query(
    `UPDATE vivadocs_people SET department = $1, updated_at = $2 WHERE id = $3
     RETURNING id, name, department, role, created_at, updated_at`,
    [department, new Date().toISOString(), personId],
  );
  if (!result.rows[0]) throw new VivaDocsSkillsNotFoundError("Person not found.");
  return mapPerson(result.rows[0] as Record<string, unknown>);
}

export async function removeSkillsPerson(value: unknown) {
  const input = asObject(value);
  const personId = cleanId(input.personId);
  if (!personId) throw new VivaDocsSkillsValidationError("Select a person to remove.");
  const result = await database().pool.query(
    "DELETE FROM vivadocs_people WHERE id = $1 RETURNING name",
    [personId],
  );
  if (!result.rows[0]) throw new VivaDocsSkillsNotFoundError("Person not found.");
  return { removed: true, name: String(result.rows[0].name) };
}

export async function updateTrainingRecord(value: unknown) {
  const input = asObject(value);
  const personId = cleanId(input.personId);
  const sopId = cleanId(input.sopId);
  const status = validTrainingStatus(input.status);
  if (!personId || !sopId) {
    throw new VivaDocsSkillsValidationError("Select a person and SOP.");
  }
  if (!status) throw new VivaDocsSkillsValidationError("Select a valid training status.");
  const timestamp = new Date().toISOString();
  const result = await database().pool.query(
    `INSERT INTO vivadocs_training_records
       (id, person_id, sop_id, status, source, completed_at, updated_at)
     SELECT $1, p.id, s.id, $4, 'Manual',
       CASE WHEN $4 IN ('Competent', 'Trainer') THEN $5 ELSE NULL END, $5
     FROM vivadocs_people p, sops s
     WHERE p.id = $2 AND s.id = $3
     ON CONFLICT (person_id, sop_id) DO UPDATE SET
       status = EXCLUDED.status,
       source = 'Manual',
       completed_at = EXCLUDED.completed_at,
       updated_at = EXCLUDED.updated_at
     RETURNING id, person_id, sop_id, status, source, completed_at, updated_at`,
    [crypto.randomUUID(), personId, sopId, status, timestamp],
  );
  if (!result.rows[0]) throw new VivaDocsSkillsNotFoundError("Person or SOP not found.");
  return mapRecord(result.rows[0] as Record<string, unknown>);
}

export async function recordSopCompletion(value: unknown) {
  const input = asObject(value);
  const sopId = cleanId(input.sopId);
  const personName = cleanText(input.personName, 120);
  if (!sopId) throw new VivaDocsSkillsValidationError("Select an SOP to complete.");
  if (!personName) throw new VivaDocsSkillsValidationError("A team member is required.");

  return transaction(async (client) => {
    const sopResult = await client.query<{ department: string }>(
      "SELECT department FROM sops WHERE id = $1 AND status = 'Published'",
      [sopId],
    );
    const department = sopResult.rows[0]?.department;
    if (!department) throw new VivaDocsSkillsNotFoundError("Published SOP not found.");

    const timestamp = new Date().toISOString();
    const peopleResult = await client.query<{ id: string }>(
      "SELECT id FROM vivadocs_people WHERE LOWER(name) = LOWER($1)",
      [personName],
    );
    let personId = peopleResult.rows[0]?.id;
    if (!personId) {
      personId = crypto.randomUUID();
      await client.query(
        `INSERT INTO vivadocs_people (id, name, department, role, created_at, updated_at)
         VALUES ($1, $2, $3, 'Team member', $4, $4)`,
        [personId, personName, department, timestamp],
      );
    }

    const recordResult = await client.query(
      `INSERT INTO vivadocs_training_records
         (id, person_id, sop_id, status, source, completed_at, updated_at)
       VALUES ($1, $2, $3, 'Competent', 'SOP completion', $4, $4)
       ON CONFLICT (person_id, sop_id) DO UPDATE SET
         status = CASE
           WHEN vivadocs_training_records.status = 'Trainer' THEN 'Trainer'
           ELSE 'Competent'
         END,
         source = 'SOP completion',
         completed_at = EXCLUDED.completed_at,
         updated_at = EXCLUDED.updated_at
       RETURNING id, person_id, sop_id, status, source, completed_at, updated_at`,
      [crypto.randomUUID(), personId, sopId, timestamp],
    );
    return mapRecord(recordResult.rows[0] as Record<string, unknown>);
  });
}

function mapPerson(row: Record<string, unknown>): SkillsPerson {
  return {
    id: String(row.id),
    name: String(row.name),
    department: String(row.department),
    role: String(row.role),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapRecord(row: Record<string, unknown>): TrainingRecord {
  return {
    id: String(row.id),
    personId: String(row.person_id),
    sopId: String(row.sop_id),
    status: String(row.status) as TrainingStatus,
    source: String(row.source) as TrainingRecord["source"],
    completedAt: row.completed_at ? String(row.completed_at) : "",
    updatedAt: String(row.updated_at),
  };
}

function asObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\0/g, "").trim().slice(0, max) : "";
}

function cleanId(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value)
    ? value
    : "";
}

function validDepartment(value: unknown) {
  const name = cleanText(value, 40);
  return SOP_DEPARTMENTS.some((department) => department.name === name) ? name : "";
}

function validTrainingStatus(value: unknown): TrainingStatus | "" {
  const status = cleanText(value, 30);
  return TRAINING_STATUSES.includes(status as TrainingStatus)
    ? (status as TrainingStatus)
    : "";
}

function isUniqueViolation(error: unknown) {
  return Boolean(
    error && typeof error === "object" && "code" in error && error.code === "23505",
  );
}
