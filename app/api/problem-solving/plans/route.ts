import { NextResponse } from "next/server";
import { getHoshinRequestUsername } from "../../../../lib/auth/hoshin-auth";
import { ProblemSolvingConfigurationError, getProblemHistory, savePlan } from "../../../../lib/problem-solving-store";

export const dynamic = "force-dynamic";
const priorities = new Set(["High", "Medium", "Low"]);

export async function GET(request: Request) {
  const username = await getHoshinRequestUsername(request);
  if (!username) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const eventId = new URL(request.url).searchParams.get("eventId")?.trim();
  if (!eventId) return NextResponse.json({ error: "An event reference is required." }, { status: 400 });
  try { return NextResponse.json({ history: await getProblemHistory(eventId) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return storeError(error); }
}

export async function POST(request: Request) {
  const username = await getHoshinRequestUsername(request);
  if (!username) return NextResponse.json({ error: "Sign in is required to save a problem-solving plan." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "The plan request is invalid." }, { status: 400 }); }
  const steps = Array.isArray(body.nextSteps) ? body.nextSteps : [];
  if (typeof body.analysisId !== "string" || typeof body.qualityEventId !== "string" || !Array.isArray(body.selectedSolutionIds) || !steps.length
    || steps.some((step) => !step || typeof step !== "object" || typeof step.action !== "string" || !step.action.trim() || !priorities.has(String(step.priority)))) {
    return NextResponse.json({ error: "Add at least one complete next step before saving." }, { status: 400 });
  }
  try {
    const result = await savePlan({ analysisId: body.analysisId, qualityEventId: body.qualityEventId, selectedSolutionIds: body.selectedSolutionIds.map(String), nextSteps: steps as never }, username);
    return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return storeError(error); }
}

function storeError(error: unknown) {
  if (error instanceof ProblemSolvingConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
  console.error("Problem-solving plan request failed", error);
  return NextResponse.json({ error: "The problem-solving record could not be loaded or saved." }, { status: 500 });
}
