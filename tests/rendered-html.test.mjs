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

test("provides public access to the Stream and YouTube video uploader", async () => {
  const [page, uploadRoute] = await Promise.all([
    readFile(new URL("../app/training/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/training/upload/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Add new video/);
  assert.match(page, /TRAINING VIDEO LIBRARY/);
  assert.match(page, /Drag and drop your video/);
  assert.match(page, /Paste from YouTube/);
  assert.match(page, /youtube-nocookie\.com\/embed/);
  assert.match(page, /vivad-youtube-training-links/);
  assert.match(page, /onDrop=\{dropFile\}/);
  assert.match(uploadRoute, /stream\/direct_upload/);
  assert.doesNotMatch(uploadRoute, /getHoshinSessionUsername/);
  assert.doesNotMatch(page, /Upload access key/);
  assert.doesNotMatch(uploadRoute, /CLOUDFLARE_STREAM_UPLOAD_SECRET/);
});

test("includes the interactive VivaDocs controlled-document workspace", async () => {
  const [page, strategy, quality, training, css] = await Promise.all([
    readFile(new URL("../app/vivadocs/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/strategy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/quality/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/training/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /VivaDocs/);
  assert.match(page, /SOP library/);
  assert.match(page, /Approval queue/);
  assert.match(page, /Operator mode/);
  assert.match(page, /Skills matrix/);
  assert.match(page, /Audit log/);
  assert.match(page, /window\.localStorage/);
  assert.match(page, /async function syncStoredSops/);
  assert.match(page, /fetch\("\/api\/vivadocs\/sops"/);
  assert.match(page, /onSaved=\{syncStoredSops\}/);
  assert.match(page, /return \[\s*\.\.\.stored,\s*\.\.\.current\.filter/);
  assert.match(page, /imageUrl: step\.existingImageUrl/);
  assert.match(page, /operator-visual.*has-image/);
  assert.match(page, /Visual instruction for Step/);
  assert.match(page, /Submit completion/);
  assert.match(strategy, /href="\/vivadocs"/);
  assert.match(quality, /navigationItem\("vivadocs"\)\.href/);
  assert.match(training, /navigationItem\("vivadocs"\)\.href/);
  assert.match(css, /\.vivadocs-shell/);
  assert.match(css, /\.operator-player/);
});

test("mobile workspace drawer covers routes, state and accessible closing behaviour", async () => {
  const [navigation, home, strategy, quality, training, vivadocs, css] = await Promise.all([
    readFile(new URL("../app/components/workspace-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/strategy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/quality/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/training/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/vivadocs/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const label of ["Strategy", "Quality events", "Training academy", "Scorecards", "Initiatives", "Reviews", "VivaDocs", "People", "Settings"]) {
    assert.match(navigation, new RegExp(`label: "${label}"`));
  }
  assert.match(navigation, /aria-expanded=\{open\}/);
  assert.match(navigation, /aria-controls="mobile-workspace-drawer"/);
  assert.match(navigation, /aria-modal="true"/);
  assert.match(navigation, /aria-current=\{activeItem === item\.id \? "page"/);
  assert.match(navigation, /event\.key === "Escape"/);
  assert.match(navigation, /mobile-drawer-backdrop[\s\S]*closeDrawer\(true\)/);
  assert.match(navigation, /onClick=\{\(\) => closeDrawer\(\)\}/);
  assert.match(navigation, /document\.body\.style\.overflow = "hidden"/);
  assert.match(navigation, /window\.matchMedia\("\(min-width: 701px\)"\)/);
  assert.match(navigation, /triggerRef\.current\?\.focus/);
  assert.match(navigation, /event\.key !== "Tab"/);
  assert.match(css, /height: 100dvh/);
  assert.match(css, /env\(safe-area-inset-top/);
  assert.match(css, /overflow-y: auto/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /:focus-visible/);
  for (const page of [home, strategy, quality, training, vivadocs]) assert.match(page, /MobileWorkspaceNavigation/);
  assert.match(strategy, /view === "Initiatives" \? "initiatives"/);
  assert.match(strategy, /view === "Reviews" \? "reviews"/);
});

test("VivaDocs provides durable SOP creation, media and PDF workflows without QR links", async () => {
  const [workflow, model, store, schema, migration, routes, css, hosting] = await Promise.all([
    readFile(new URL("../app/vivadocs/sop-workflow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/vivadocs-model.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/vivadocs-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0000_lethal_multiple_man.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/vivadocs/sops/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  const departments = [
    ["Prepress", "PRE"], ["CST", "CST"], ["Printers", "PRI"], ["Cutters", "CUT"], ["Fab1", "FAB"],
    ["Sew", "SEW"], ["Despatch", "DES"], ["Light Box", "LIG"], ["Framing", "FRA"], ["Office", "OFF"],
  ];
  for (const [department, prefix] of departments) {
    assert.match(model, new RegExp(`name: "${department}"`));
    assert.match(model, new RegExp(`prefix: "${prefix}"`));
  }
  assert.match(model, /padStart\(6, "0"\)/);
  assert.match(store, /ON CONFLICT\(department\) DO UPDATE SET last_number = last_number \+ 1/);
  assert.match(store, /RETURNING last_number/);
  assert.match(schema, /uniqueIndex\("idx_sops_reference"\)/);
  assert.match(schema, /uniqueIndex\("idx_sop_steps_position"\)/);
  assert.match(migration, /CREATE TABLE `sop_counters`/);
  assert.match(migration, /CREATE UNIQUE INDEX `idx_sops_reference`/);
  assert.match(store, /Promise\.allSettled\(uploaded\.map/);
  assert.match(store, /IMAGE_TYPES/);
  assert.match(store, /MAX_IMAGE_BYTES = 8 \* 1024 \* 1024/);
  assert.match(store, /existingImageKey/);
  assert.match(routes, /export async function POST/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "SOP_ASSETS"/);

  assert.match(workflow, /Add Next Step/);
  assert.match(workflow, /position: current\.steps\.length \+ 1/);
  assert.match(workflow, /const nextCard = cards\[nextIndex\]/);
  assert.match(workflow, /nextCard\?\.scrollIntoView/);
  assert.match(workflow, /querySelector<HTMLTextAreaElement>\("textarea"\)\?\.focus/);
  assert.match(workflow, /Move Step \$\{index \+ 1\} up/);
  assert.match(workflow, /Delete Step \$\{index \+ 1\}/);
  assert.match(workflow, /window\.confirm\(`Delete Step/);
  assert.match(workflow, /URL\.createObjectURL/);
  assert.match(workflow, /Replace image/);
  assert.match(workflow, /Remove image/);
  assert.match(workflow, /beforeunload/);
  assert.match(workflow, /Finish SOP/);
  assert.match(workflow, /Edit SOP/);
  assert.match(workflow, /Download PDF/);
  assert.match(workflow, /pdf\.addImage/);
  assert.match(workflow, /Page \$\{page\} of \$\{pages\}/);
  assert.doesNotMatch(workflow, /QRCode|qrUrl|Download QR|Scan to open/);
  assert.doesNotMatch(workflow, /canonicalUrl/);
  assert.match(workflow, /aria-modal="true"/);
  assert.match(workflow, /aria-readonly="true"/);
  assert.match(css, /height: min\(94dvh,940px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media print/);
});
