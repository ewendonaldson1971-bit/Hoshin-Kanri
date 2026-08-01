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
  if (!value.startsWith("/") || value.startsWith("//")) return "/training";
  try {
    const parsed = new URL(value, "https://hoshin.local");
    if (parsed.origin !== "https://hoshin.local") return "/training";
    if ([HOSHIN_LOGIN_PATH, HOSHIN_LOGOUT_PATH].includes(parsed.pathname)) return "/training";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/training";
  }
}

export function renderLoginPage(returnTo: string, errorMessage = "", status = 200) {
  const error = escapeHtml(errorMessage);
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hoshin sign in</title><style>
  :root{--red:#e4002b;--dark:#53565a;--line:#dde1e7;--surface:#f5f6fa;--text:#26282c;--muted:#6c717a}*{box-sizing:border-box}body{display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;background:linear-gradient(132deg,transparent 0 62%,rgba(228,0,43,.08) 62% 100%),var(--surface);color:var(--text);font-family:"Open Sans",Arial,sans-serif}main{display:grid;gap:18px;width:min(430px,100%);padding:28px;border:1px solid var(--line);border-radius:10px;background:#fff;box-shadow:0 14px 34px rgba(38,40,44,.08)}img{width:164px;height:auto}p{margin:0;color:var(--red);font-size:.74rem;font-weight:800;text-transform:uppercase}h1{margin:0;color:var(--dark);font-size:1.55rem}form,label{display:grid;gap:12px}label{gap:6px;color:var(--muted);font-size:.78rem;font-weight:800}input{min-height:44px;padding:0 14px;border:1px solid var(--line);border-radius:8px;font:inherit}button{min-height:42px;border:0;border-radius:999px;background:var(--red);color:#fff;font:inherit;font-weight:800;cursor:pointer}.error{padding:10px 12px;border:1px solid #ffd4dc;border-radius:8px;background:#fff1f3;color:#a4001f;font-size:.86rem;font-weight:700}.note{padding-top:12px;border-top:1px solid var(--line);color:var(--muted);font-size:.86rem}</style></head><body><main><img src="/vivad-logo.png" alt="Vivad"><section><p>Hoshin Kanri</p><h1>Sign in to upload</h1></section>${error ? `<div class="error">${error}</div>` : ""}<form method="post" action="${HOSHIN_LOGIN_PATH}"><input type="hidden" name="return_to" value="${escapeHtml(returnTo)}"><label>User name<input name="username" autocomplete="username" autofocus required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">Continue to Hoshin</button></form><div class="note">Use the same Vivalux Builder credentials you use for Project Lotus.</div></main></body></html>`, {
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
