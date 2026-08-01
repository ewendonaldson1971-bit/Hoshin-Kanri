import { NextResponse } from "next/server";
import { authEnv, getHoshinSessionUsername } from "../../../../lib/auth/hoshin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const configured = Boolean(authEnv().LOTUS_AUTH_SECRET?.trim());
  const username = await getHoshinSessionUsername(request.headers.get("cookie") ?? "", authEnv());
  return NextResponse.json({ authenticated: Boolean(username), username, configured }, { headers: { "Cache-Control": "no-store" } });
}
