import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Vivad Hoshin workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Hoshin — Turn Strategy Into Action<\/title>/i);
  assert.match(html, /src="\/vivad-logo\.png"/i);
  assert.match(html, /Turn strategy into/i);
  assert.match(html, /href="\/strategy"/i);
  assert.match(html, /href="\/quality"/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("includes the live Non-Conformance Event workspace", async () => {
  const [page, route, css] = await Promise.all([
    readFile(new URL("../app/quality/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/non-conformance/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Non-Conformance Events/);
  assert.match(page, /Monthly trend/);
  assert.match(page, /All departments/);
  assert.match(page, /Open Google Sheet/);
  assert.match(page, /Training added this week/);
  assert.match(page, /\/api\/training\/videos/);
  assert.match(page, /vivad-youtube-training-links/);
  assert.match(page, /\/training\?video=/);
  assert.match(route, /export\?format=csv&gid=/);
  assert.match(route, /normaliseStatus/);
  assert.match(route, /NextResponse\.json/);
  assert.match(css, /\.quality-kpis/);
  assert.match(css, /\.quality-table/);
  assert.match(css, /\.quality-training-widget/);
  assert.match(css, /@media \(max-width: 620px\)/);
});

test("includes the Cloudflare Stream training academy", async () => {
  const [page, route, envExample, css] = await Promise.all([
    readFile(new URL("../app/training/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/training/videos/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Training Academy/);
  assert.match(page, /cloudflarestream\.com/);
  assert.match(page, /embed\.cloudflarestream\.com\/embed\/sdk\.latest\.js/);
  assert.match(page, /signed URLs/);
  assert.match(page, /addEventListener\("ended"/);
  assert.match(page, /\/api\/training\/videos/);
  assert.match(route, /api\.cloudflare\.com\/client\/v4\/accounts/);
  assert.match(route, /Authorization: `Bearer \$\{env\.apiToken\}`/);
  assert.doesNotMatch(route, /NextResponse\.json\([^)]*apiToken/);
  assert.match(envExample, /CLOUDFLARE_STREAM_API_TOKEN=/);
  assert.match(envExample, /CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN=/);
  assert.match(envExample, /NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE=/);
  assert.match(css, /\.training-player iframe/);
  assert.match(css, /\.stream-modal/);
});

test("protects Stream uploads with the Lotus login system", async () => {
  const [page, uploadRoute, sessionRoute, auth, envExample] = await Promise.all([
    readFile(new URL("../app/training/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/training/upload/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth/hoshin-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Sign in to add video/);
  assert.match(page, /TRAINING VIDEO LIBRARY/);
  assert.match(page, /Drag and drop your video/);
  assert.match(page, /Paste from YouTube/);
  assert.match(page, /youtube-nocookie\.com\/embed/);
  assert.match(page, /vivad-youtube-training-links/);
  assert.match(page, /onDrop=\{dropFile\}/);
  assert.match(uploadRoute, /getHoshinSessionUsername/);
  assert.match(uploadRoute, /stream\/direct_upload/);
  assert.match(sessionRoute, /authenticated: Boolean\(username\)/);
  assert.match(auth, /application: "Lotus"/);
  assert.match(auth, /HttpOnly; SameSite=Lax/);
  assert.match(envExample, /LOTUS_AUTH_SECRET=/);
  assert.doesNotMatch(page, /Upload access key/);
  assert.doesNotMatch(uploadRoute, /CLOUDFLARE_STREAM_UPLOAD_SECRET/);
});
