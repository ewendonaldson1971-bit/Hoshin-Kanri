import { NextResponse } from "next/server";
import {
  addSkillsPerson,
  getSkillsMatrix,
  recordSopCompletion,
  removeSkillsPerson,
  transferSkillsPerson,
  updateTrainingRecord,
  VivaDocsSkillsConfigurationError,
  VivaDocsSkillsNotFoundError,
  VivaDocsSkillsValidationError,
} from "../../../../lib/vivadocs-skills-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getSkillsMatrix(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action?: unknown };
    let result: unknown;
    switch (body.action) {
      case "addPerson":
        result = await addSkillsPerson(body);
        break;
      case "transferPerson":
        result = await transferSkillsPerson(body);
        break;
      case "removePerson":
        result = await removeSkillsPerson(body);
        break;
      case "updateTraining":
        result = await updateTrainingRecord(body);
        break;
      case "completeSop":
        result = await recordSopCompletion(body);
        break;
      default:
        throw new VivaDocsSkillsValidationError("Select a valid skills action.");
    }
    return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

function apiError(error: unknown) {
  if (error instanceof VivaDocsSkillsValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof VivaDocsSkillsNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof VivaDocsSkillsConfigurationError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  console.error("VivaDocs skills request failed", error);
  return NextResponse.json(
    { error: "VivaDocs could not update the skills matrix. Please try again." },
    { status: 500 },
  );
}
