import { getDatabase, MissingDatabaseConnectionError } from "@netlify/database";
import type { ProblemAnalysis, QualityEventSnapshot, NextStep } from "./problem-solving-model";

export class ProblemSolvingConfigurationError extends Error {}
type Row = Record<string, unknown>;
let cached: ReturnType<typeof getDatabase> | undefined;

function db() {
  try { cached ??= getDatabase(); return cached; }
  catch (error) {
    if (error instanceof MissingDatabaseConnectionError) throw new ProblemSolvingConfigurationError("Problem-solving storage is not configured. Connect Netlify Database to this site.");
    throw error;
  }
}

export async function saveAnalysis(event: QualityEventSnapshot, notes: string, analysis: ProblemAnalysis, actor: string, provider: string, model: string) {
  const client = await db().pool.connect();
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  try {
    await client.query("BEGIN");
    const versionResult = await client.query("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM problem_solving_analyses WHERE quality_event_id = $1", [event.id]);
    const version = Number(versionResult.rows[0]?.version ?? 1);
    await client.query(`INSERT INTO problem_solving_analyses
      (id, quality_event_id, event_snapshot, analysis_notes, version, diagnosis, research_sources, solutions, suggested_next_steps, provider, model, created_by, created_at)
      VALUES ($1,$2,$3::jsonb,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,$13)`,
      [id, event.id, JSON.stringify(event), notes, version, JSON.stringify({ summary: analysis.summary, causes: analysis.causes, researchAvailable: analysis.researchAvailable, researchMessage: analysis.researchMessage }), JSON.stringify(analysis.sources), JSON.stringify(analysis.solutions), JSON.stringify(analysis.nextSteps), provider, model, actor, now]);
    await client.query(`INSERT INTO problem_solving_audit (id, quality_event_id, analysis_id, action, details, actor, created_at)
      VALUES ($1,$2,$3,'analysis_created',$4::jsonb,$5,$6)`, [crypto.randomUUID(), event.id, id, JSON.stringify({ version, provider }), actor, now]);
    await client.query("COMMIT");
    return { id, version, createdAt: now };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

export async function savePlan(input: { analysisId: string; qualityEventId: string; selectedSolutionIds: string[]; nextSteps: NextStep[] }, actor: string) {
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  await db().pool.query(`INSERT INTO problem_solving_plans (id, analysis_id, quality_event_id, selected_solution_ids, next_steps, created_by, created_at, updated_at)
    VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$7)
    ON CONFLICT (analysis_id) DO UPDATE SET selected_solution_ids=EXCLUDED.selected_solution_ids, next_steps=EXCLUDED.next_steps, updated_at=EXCLUDED.updated_at`,
    [id, input.analysisId, input.qualityEventId, JSON.stringify(input.selectedSolutionIds), JSON.stringify(input.nextSteps), actor, now]);
  await db().pool.query(`INSERT INTO problem_solving_audit (id, quality_event_id, analysis_id, action, details, actor, created_at)
    VALUES ($1,$2,$3,'plan_saved',$4::jsonb,$5,$6)`, [crypto.randomUUID(), input.qualityEventId, input.analysisId, JSON.stringify({ stepCount: input.nextSteps.length }), actor, now]);
  return { id, savedAt: now };
}

export async function getProblemHistory(eventId: string) {
  const result = await db().pool.query(`SELECT a.id, a.version, a.analysis_notes, a.diagnosis, a.research_sources, a.solutions,
    a.suggested_next_steps, a.provider, a.model, a.created_by, a.created_at,
    p.selected_solution_ids, p.next_steps, p.updated_at AS plan_updated_at
    FROM problem_solving_analyses a LEFT JOIN problem_solving_plans p ON p.analysis_id=a.id
    WHERE a.quality_event_id=$1 ORDER BY a.version DESC`, [eventId]);
  return (result.rows as Row[]).map((row) => ({
    id: String(row.id), version: Number(row.version), notes: String(row.analysis_notes ?? ""), diagnosis: row.diagnosis,
    sources: row.research_sources, solutions: row.solutions, suggestedNextSteps: row.suggested_next_steps,
    provider: String(row.provider), model: String(row.model), createdBy: String(row.created_by), createdAt: String(row.created_at),
    selectedSolutionIds: row.selected_solution_ids ?? [], nextSteps: row.next_steps ?? [], planUpdatedAt: row.plan_updated_at ?? null,
  }));
}
