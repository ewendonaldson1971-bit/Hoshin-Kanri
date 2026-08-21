import { NextResponse } from "next/server";
import { getHoshinRequestUsername } from "../../../../lib/auth/hoshin-auth";
import { GET as getQualityEvents } from "../../non-conformance/route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const username = await getHoshinRequestUsername(request);
  if (!username) return NextResponse.json({ events: [], error: "Sign in is required to view quality events." }, { status: 401 });
  return getQualityEvents();
}
