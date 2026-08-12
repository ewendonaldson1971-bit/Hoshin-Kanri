import { NextResponse } from "next/server";
import { getSop, updateSop, VivaDocsConfigurationError, VivaDocsValidationError } from "../../../../../lib/vivadocs-store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sop = await getSop(id);
    return sop ? NextResponse.json({ sop }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "SOP not found." }, { status: 404 });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sop = await updateSop(id, request);
    return sop ? NextResponse.json({ sop }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "SOP not found." }, { status: 404 });
  } catch (error) { return apiError(error); }
}

function apiError(error: unknown) {
  if (error instanceof VivaDocsValidationError) return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 });
  if (error instanceof VivaDocsConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
  console.error("VivaDocs request failed", error);
  return NextResponse.json({ error: "VivaDocs could not save this SOP. Please try again." }, { status: 500 });
}
