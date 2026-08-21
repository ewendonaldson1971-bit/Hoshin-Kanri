export const HOSHIN_AUTH_COOKIE_NAME = "hoshin_session_v1";
export const HOSHIN_AUTH_TTL_SECONDS = 60 * 60 * 10;
export const HOSHIN_LOGIN_PATH = "/hoshin-login";
export const HOSHIN_LOGOUT_PATH = "/hoshin-logout";

export type HoshinAuthEnv = {
  LOTUS_AUTH_SERVICE_URL?: string;
  LOTUS_AUTH_SECRET?: string;
};

type AuthResponse = {
  ok?: boolean;
  error?: string;
  user?: { username?: string; [key: string]: unknown };
  [key: string]: unknown;
};

const DEFAULT_AUTH_SERVICE_URL =
  "https://script.google.com/macros/s/AKfycbxFTRc0Q3Kd-51nmYaM96fzzWHBbKaFoXujgQ7I7c-yHWy5teZu1j9SjA1IWjluuxc/exec";
const encoder = new TextEncoder();

export function authEnv(): HoshinAuthEnv {
  return {
    LOTUS_AUTH_SERVICE_URL: process.env.LOTUS_AUTH_SERVICE_URL,
    LOTUS_AUTH_SECRET: process.env.LOTUS_AUTH_SECRET,
  };
}

export async function getHoshinSessionUsername(cookieHeader: string, env: HoshinAuthEnv) {
  const secret = env.LOTUS_AUTH_SECRET?.trim();
  const token = readCookie(cookieHeader, HOSHIN_AUTH_COOKIE_NAME);
  if (!secret || !token) return "";

  const [issuedAtRaw, usernameRaw, signature] = token.split(".");
  const issuedAt = Number.parseInt(issuedAtRaw ?? "", 10);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(issuedAt) || !usernameRaw || !signature) return "";
  if (issuedAt > now + 60 || now - issuedAt > HOSHIN_AUTH_TTL_SECONDS) return "";

  const expected = await sign(`${issuedAtRaw}.${usernameRaw}`, secret);
  if (!constantTimeEqual(signature, expected)) return "";
  return base64UrlDecode(usernameRaw);
}

export async function getHoshinRequestUsername(request: Request) {
  return getHoshinSessionUsername(request.headers.get("cookie") ?? "", authEnv());
}

export function canDeleteTrainingVideos(
  username: string,
  configuredUsers = process.env.TRAINING_VIDEO_DELETE_USERS,
) {
  return trainingVideoDeleteAccess(username, configuredUsers).allowed;
}

export function trainingVideoDeleteAccess(
  username: string,
  configuredUsers = process.env.TRAINING_VIDEO_DELETE_USERS,
) {
  if (!username) {
    return {
      allowed: false as const,
      status: 401 as const,
      error: "Sign in is required to delete a training video.",
    };
  }
  const allowedUsers = configuredUsers
    ?.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean) ?? [];
  // Lotus access is the existing application permission. Deployments can
  // narrow deletion further with a server-side username allowlist.
  if (allowedUsers.length === 0 || allowedUsers.includes(username.trim().toLowerCase())) {
    return { allowed: true as const, status: 200 as const, error: "" };
  }
  return {
    allowed: false as const,
    status: 403 as const,
    error: "Your account does not have permission to delete training videos.",
  };
}

export async function authenticateWithLotus(username: string, password: string, env: HoshinAuthEnv) {
  const serviceUrl = env.LOTUS_AUTH_SERVICE_URL?.trim() || DEFAULT_AUTH_SERVICE_URL;
  try {
    const response = await fetch(serviceUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ type: "authenticate", application: "Lotus", username, password }),
    });
    const result = (await response.json()) as AuthResponse;
    if (!result.ok || !result.user?.username) return result;
    const lotusFlag = readKeyDeep(result, "lotus");
    if (!isTruthySheetValue(lotusFlag)) {
      return { ok: false, error: lotusFlag === undefined ? "lotusAccessMissing" : "lotusAccessDenied" };
    }
    return result;
  } catch {
    return { ok: false, error: "serviceUnavailable" } as AuthResponse;
  }
}

export async function createHoshinSessionToken(username: string, secret: string) {
  const issuedAt = Math.floor(Date.now() / 1000).toString();
  const usernameValue = base64UrlEncode(encoder.encode(username));
  return `${issuedAt}.${usernameValue}.${await sign(`${issuedAt}.${usernameValue}`, secret)}`;
}

export function buildHoshinSessionCookie(value: string, url: URL, maxAge: number) {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `${HOSHIN_AUTH_COOKIE_NAME}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export function safeReturnPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const parsed = new URL(value, "https://hoshin.local");
    if (parsed.origin !== "https://hoshin.local") return "/";
    if ([HOSHIN_LOGIN_PATH, HOSHIN_LOGOUT_PATH].includes(parsed.pathname)) return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function renderLoginPage(returnTo: string, errorMessage = "", status = 200) {
  const error = escapeHtml(errorMessage);
  const action = `${HOSHIN_LOGIN_PATH}?return_to=${encodeURIComponent(returnTo)}`;
  return new Response(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Vivad SPARK sign in</title>
    <style>
      :root{--red:#e4002b;--red-dark:#aa001f;--blue:#348be2;--dark:#53565a;--line:#dde1e7;--surface:#f7f8fa;--text:#2f3336;--muted:#6c717a}
      *{box-sizing:border-box}
      html{background:var(--surface)}
      body{display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;background:linear-gradient(135deg,rgba(228,0,43,.06) 0 18%,transparent 18% 100%),linear-gradient(90deg,rgba(83,86,90,.055) 0 1px,transparent 1px 100%),linear-gradient(0deg,rgba(83,86,90,.045) 0 1px,transparent 1px 100%),var(--surface);background-size:auto,38px 38px,38px 38px,auto;color:var(--text);font-family:"Open Sans","Segoe UI",Arial,sans-serif}
      main{display:grid;gap:18px;width:min(430px,100%);padding:28px;border:1px solid rgba(83,86,90,.16);border-radius:8px;background:#fff;box-shadow:0 20px 54px rgba(47,51,54,.18)}
      img{width:164px;height:auto}
      .eyebrow{margin:0 0 4px;color:var(--red);font-size:.74rem;font-weight:800;text-transform:uppercase}
      h1{margin:0;color:var(--dark);font-family:Cabin,"Trebuchet MS",Arial,sans-serif;font-size:1.55rem;line-height:1.1}
      form{display:grid;gap:12px}
      label{display:grid;gap:7px;color:var(--dark);font-size:.8rem;font-weight:700}
      input{width:100%;min-height:44px;padding:9px 14px;border:1px solid transparent;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1px rgba(83,86,90,.14),0 3px 10px rgba(83,86,90,.08);color:var(--text);font:inherit;font-weight:400}
      input:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 3px rgba(52,139,226,.22),inset 0 0 0 1px rgba(83,86,90,.14),0 3px 10px rgba(83,86,90,.08)}
      button{min-height:44px;margin-top:6px;padding:0 18px;border:1px solid var(--red);border-radius:999px;background:var(--red);box-shadow:0 4px 10px rgba(228,0,43,.22);color:#fff;font:inherit;font-size:.86rem;font-weight:700;cursor:pointer;transition:background-color .16s ease,box-shadow .16s ease,transform .16s ease}
      button:hover,button:focus-visible{background:#f65856;box-shadow:0 8px 18px rgba(228,0,43,.24);outline:none;transform:translateY(-1px)}
      .error{padding:10px 12px;border:1px solid #ffd4dc;border-radius:8px;background:#fff1f3;color:var(--red-dark);font-size:.86rem;font-weight:700;overflow-wrap:anywhere}
      .note{padding-top:12px;border-top:1px solid rgba(83,86,90,.14);color:var(--dark);font-size:.86rem;line-height:1.45}
      @media(max-width:540px){body{padding:16px}main{padding:22px}}
    </style>
  </head>
  <body>
    <main>
      <img src="/vivad-logo.png" alt="Vivad" width="164" height="45">
      <section><p class="eyebrow">Vivad SPARK</p><h1>Sign in</h1></section>
      ${error ? `<div class="error" role="alert">${error}</div>` : ""}
      <form method="post" action="${escapeHtml(action)}">
        <input type="hidden" name="return_to" value="${escapeHtml(returnTo)}">
        <label>User name<input name="username" type="text" autocomplete="username" autofocus required></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
        <button type="submit">Open Vivad SPARK</button>
      </form>
      <div class="note">Use your Vivalux Builder user name and password.</div>
    </main>
  </body>
</html>`, {
    status,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", "Referrer-Policy": "no-referrer" },
  });
}

function readCookie(header: string, name: string) {
  return header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}
async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64UrlEncode(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}
function base64UrlEncode(bytes: Uint8Array) {
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function base64UrlDecode(value: string) {
  try { const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")); const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0)); return new TextDecoder().decode(bytes); } catch { return ""; }
}
function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false; let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}
function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function readKeyDeep(value: unknown, target: string, seen = new Set<object>()): unknown {
  if (!value || typeof value !== "object" || seen.has(value)) return undefined; seen.add(value);
  if (Array.isArray(value)) { for (const item of value) { const found = readKeyDeep(item, target, seen); if (found !== undefined) return found; } return undefined; }
  const record = value as Record<string, unknown>; const key = Object.keys(record).find((item) => item.trim().toLowerCase() === target); if (key) return record[key];
  for (const nested of Object.values(record)) { const found = readKeyDeep(nested, target, seen); if (found !== undefined) return found; } return undefined;
}
function isTruthySheetValue(value: unknown) { return value === true || value === 1 || (typeof value === "string" && ["true", "yes", "y", "1"].includes(value.trim().toLowerCase())); }
