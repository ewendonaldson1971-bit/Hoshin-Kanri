import { buildHoshinSessionCookie } from "../../lib/auth/hoshin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return new Response(null, { status: 303, headers: { Location: "/hoshin-login", "Set-Cookie": buildHoshinSessionCookie("", url, 0) } });
}
