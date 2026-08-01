import { authenticateWithLotus, authEnv, buildHoshinSessionCookie, createHoshinSessionToken, HOSHIN_AUTH_TTL_SECONDS, renderLoginPage, safeReturnPath } from "../../lib/auth/hoshin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return renderLoginPage(safeReturnPath(new URL(request.url).searchParams.get("return_to") ?? "/training"));
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const env = authEnv();
  const secret = env.LOTUS_AUTH_SECRET?.trim();
  const form = await request.formData();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "").trim();
  const returnTo = safeReturnPath(String(form.get("return_to") ?? "/training"));
  if (!secret) return renderLoginPage(returnTo, "Hoshin login is not configured in this environment.", 503);
  if (!username || !password) return renderLoginPage(returnTo, "Enter your user name and password.", 400);

  const result = await authenticateWithLotus(username, password, env);
  if (!result.ok || !result.user?.username) {
    const messages: Record<string, string> = {
      invalidCredentials: "User name or password is incorrect.",
      lotusAccessDenied: "Your account is not enabled for Project Lotus.",
      lotusAccessMissing: "The login service could not confirm Lotus access.",
      serviceUnavailable: "Hoshin could not reach the Lotus login service.",
    };
    return renderLoginPage(returnTo, messages[result.error ?? ""] ?? "Could not check login.", result.error?.startsWith("lotusAccess") ? 403 : 401);
  }

  const token = await createHoshinSessionToken(result.user.username, secret);
  return new Response(null, { status: 303, headers: { Location: returnTo, "Set-Cookie": buildHoshinSessionCookie(token, url, HOSHIN_AUTH_TTL_SECONDS) } });
}
