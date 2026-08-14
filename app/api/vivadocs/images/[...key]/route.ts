import { NextResponse } from "next/server";
import { getSopAsset, VivaDocsConfigurationError } from "../../../../../lib/vivadocs-store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  try {
    const { key } = await context.params;
    const storageKey = key.join("/");
    if (!/^sops\/[a-zA-Z0-9/_-]+\.[a-zA-Z0-9]+$/.test(storageKey)) return NextResponse.json({ error: "Invalid image." }, { status: 400 });
    const asset = await getSopAsset(storageKey);
    if (!asset) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    const headers = new Headers({
      "Cache-Control": "private, max-age=3600",
      "Content-Type": asset.contentType,
      "Content-Disposition": `inline; filename="${asset.originalName.replace(/["\\\r\n]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
    });
    return new Response(new Uint8Array(asset.data), { headers });
  } catch (error) {
    if (error instanceof VivaDocsConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: "Image unavailable." }, { status: 500 });
  }
}
