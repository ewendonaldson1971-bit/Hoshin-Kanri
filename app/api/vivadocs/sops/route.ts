import { NextResponse } from "next/server";
import { createSop, listSops, VivaDocsConfigurationError, VivaDocsValidationError } from "../../../../lib/vivadocs-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ sops: await listSops() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const sop = await createSop(request);
    return NextResponse.json({ sop }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

function apiError(error: unknown) {
  if (error instanceof VivaDocsValidationError) return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 });
  if (error instanceof VivaDocsConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
  console.error("VivaDocs request failed", error);
  return NextResponse.json({ error: "VivaDocs could not save this SOP. Please try again." }, { status: 500 });
}
