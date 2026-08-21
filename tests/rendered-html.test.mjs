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

test("requires the shared Apps Script login before rendering Vivad SPARK", async () => {
  const response = await render();
  assert.equal(response.status, 307);
  assert.match(response.headers.get("location") ?? "", /\/hoshin-login\?return_to=%2F$/i);

  const loginResponse = await render("/hoshin-login");
  assert.equal(loginResponse.status, 200);
  assert.match(loginResponse.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await loginResponse.text();
  assert.match(html, /<title>Vivad SPARK sign in<\/title>/i);
  assert.match(html, /src="\/vivad-logo\.png"/i);
  assert.match(html, /<h1>Sign in<\/h1>/i);
  assert.match(html, /Open Vivad SPARK/i);
  assert.match(html, /Vivalux Builder user name and password/i);
  assert.match(html, /autocomplete="username"/i);
  assert.match(html, /autocomplete="current-password"/i);
});

test("landing dashboard uses live metrics and accessible workspace destinations", async () => {
  const [page, css, vivadocs, training] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/vivadocs/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/training/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Where would you like to go\?/);
  assert.match(page, /href: "\/quality"/);
  assert.match(page, /href: "\/vivadocs\?view=skills"/);
  assert.match(page, /href: "\/vivadocs\?view=library"/);
  assert.match(page, /href: "\/training"/);
  assert.match(page, /Promise\.allSettled/);
  assert.match(page, /\/api\/auth\/session/);
  assert.match(page, /\/api\/non-conformance/);
  assert.match(page, /\/api\/vivadocs\/skills/);
  assert.match(page, /\/api\/vivadocs\/sops/);
  assert.match(page, /\/api\/training\/videos/);
  assert.match(page, /record\.status === "Competent" \|\| record\.status === "Trainer"/);
  assert.match(page, /sop\.status === "Published"/);
  assert.match(page, /event\.action\?\.trim\(\) && event\.status !== "Completed"/);
  assert.match(page, /7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(page, /role="status"/);
  assert.match(page, /metric\.value \?\? "—"/);
  assert.doesNotMatch(page, /Report a quality event/);
  assert.doesNotMatch(page, /Recently viewed/);
  assert.match(vivadocs, /librarySearchRef/);
  assert.match(vivadocs, /requestedView === "library"/);
  assert.match(training, /get\("upload"\) === "1"/);
  assert.match(css, /\.portal-destinations/);
  assert.match(css, /\.portal-destination:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(max-width: 700px\)/);
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
  assert.match(page, /signed URLs/);
  assert.doesNotMatch(page, /import Hls from "hls\.js"/);
  assert.match(page, /embed\.cloudflarestream\.com\/embed\/sdk\.latest\.js/);
  assert.match(page, /url\.pathname = `\$\{url\.pathname\.slice\(0, manifestIndex\)\}\/iframe`/);
  assert.match(page, /url\.searchParams\.set\("preload", "auto"\)/);
  assert.match(page, /player\.addEventListener\("playing"/);
  assert.match(page, /player\.addEventListener\("ended", handleEnded\)/);
  assert.match(page, /player\.addEventListener\("error"/);
  assert.match(page, /src=\{activeCourse\.playbackUrl as string\}/);
  assert.match(page, /\/api\/training\/videos/);
  assert.match(route, /api\.cloudflare\.com\/client\/v4\/accounts/);
  assert.match(route, /Authorization: `Bearer \$\{env\.apiToken\}`/);
  assert.match(route, /repairPlaybackOrigins/);
  assert.match(route, /isPlaybackAvailable/);
  assert.match(route, /isEncodingComplete/);
  assert.match(route, /readyToStream/);
  assert.match(route, /status\?\.state === "ready"/);
  assert.match(route, /Number\.isFinite\(progress\)/);
  assert.match(route, /progress >= 100/);
  assert.match(route, /method: "GET"/);
  assert.match(route, /Range: "bytes=0-1023"/);
  assert.match(route, /ready: Boolean\(isEncodingComplete\(video\) && video\.playback\?\.hls && video\.deliveryReady\)/);
  assert.match(route, /playbackUrl: video\.playback\?\.hls/);
  assert.match(route, /deliveryError/);
  assert.match(route, /allowedOrigins/);
  assert.match(route, /vivadspark\.netlify\.app/);
  assert.match(page, /key=\{`\$\{activeCourse\.playbackUrl\}-\$\{activeUid\}`\}/);
  assert.doesNotMatch(page, /key=\{[^\n]*library\.refreshedAt/);
  assert.match(page, /Cloudflare could not deliver this video/);
  assert.match(page, /Try playback again/);
  assert.match(page, /window\.setTimeout\(\(\) => void refreshLibrary\(\), 8_000\)/);
  assert.match(page, /Permanently delete/);
  assert.match(page, /aria-label=\{`Delete \$\{course\.title\}`\}/);
  assert.match(page, /method: "DELETE"/);
  assert.match(page, /credentials: "include"/);
  assert.match(page, /response\.status === 401/);
  assert.match(page, /response\.status === 403/);
  assert.match(page, /setReauthCourse\(course\)/);
  assert.match(page, /role="dialog"/);
  assert.match(page, /aria-modal="true"/);
  assert.match(page, /Sign in and delete video/);
  assert.match(page, /autoComplete="current-password"/);
  assert.match(page, /fetch\("\/hoshin-login\?return_to=%2Ftraining"/);
  assert.match(page, /deleteCourse\(course, true\)/);
  assert.match(page, /document\.body\.style\.overflow = "hidden"/);
  assert.match(page, /window\.localStorage\.setItem\(youtubeKey/);
  assert.match(page, /training-delete-notice/);
  assert.match(page, /fetch\("\/api\/vivadocs\/skills"/);
  assert.match(page, /aria-label="Select training department"/);
  assert.match(page, /aria-label="Select person watching training"/);
  assert.match(page, /PERSON WATCHING/);
  assert.match(page, /selectedPerson\?\.name/);
  assert.match(page, /personProgressKey\(selectedPersonId\)/);
  assert.match(page, /selectedPersonIdRef\.current/);
  assert.match(page, /disabled=\{!selectedPersonId \|\| completingId/);
  assert.match(route, /export async function DELETE\(request: Request\)/);
  assert.match(route, /getHoshinRequestUsername/);
  assert.match(route, /trainingVideoDeleteAccess/);
  assert.match(route, /canDelete: canDeleteTrainingVideos\(username\)/);
  assert.match(route, /request\.headers\.get\("origin"\)/);
  assert.match(route, /preferredByTitle/);
  assert.match(route, /video\.ready && !video\.deliveryError/);
  assert.match(page, /course\.source === "youtube" \|\| course\.source === "stream"/);
  assert.match(page, /<svg viewBox="0 0 24 24"/);
  assert.match(route, /\^\[a-f0-9\]\{32\}\$/i);
  assert.match(route, /method: "DELETE"/);
  assert.match(route, /export async function DELETE[\s\S]*payload\.success === false/);
  assert.match(route, /normalisedVideoTitle/);
  assert.match(route, /deletedUids = Array\.from\(new Set/);
  assert.match(route, /normalisedVideoTitle\(video\) === targetTitle/);
  assert.match(route, /Promise\.all\(deletedUids\.map/);
  assert.match(route, /alreadyAbsent = response\.status === 404/);
  assert.match(route, /\{ deleted: true, uid, deletedUids, deletedBy: username \}/);
  assert.match(page, /videos: current\.videos\.filter/);
  assert.match(page, /!deletedUids\.has\(video\.videoUid\)/);
  assert.ok(
    page.indexOf("if (!response.ok)") < page.indexOf("videos: current.videos.filter"),
    "the UI must not remove a card until deletion succeeds",
  );
  assert.doesNotMatch(page, /window\.setTimeout\(\(\) => void refreshLibrary\(\), 1500\)/);
  assert.match(route, /deletedBy: username/);
  assert.doesNotMatch(route, /NextResponse\.json\([^)]*apiToken/);
  assert.match(envExample, /CLOUDFLARE_STREAM_API_TOKEN=/);
  assert.match(envExample, /CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN=/);
  assert.match(envExample, /NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE=/);
  assert.match(envExample, /CLOUDFLARE_STREAM_ALLOWED_ORIGINS=vivadspark\.netlify\.app/);
  assert.match(envExample, /TRAINING_VIDEO_DELETE_USERS=/);
  assert.match(page, /PLAYBACK ERROR/);
  assert.match(page, /course\.ready === true && !course\.deliveryError/);
  assert.match(css, /\.training-player iframe/);
  assert.match(css, /\.training-stream-video iframe/);
  assert.match(css, /\.stream-modal/);
  assert.match(css, /\.training-delete-video/);
  assert.match(css, /\.training-delete-notice/);
  assert.match(css, /\.training-reauth-modal/);
  assert.match(css, /\.training-reauth-error/);
  assert.match(css, /\.training-progress-person/);
  assert.match(css, /\.training-mobile-progress/);
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
  assert.match(page, /MAX_VIDEO_UPLOAD_BYTES = 1024 \* 1024 \* 1024/);
  assert.match(page, /TUS_CHUNK_BYTES = 50 \* 1024 \* 1024/);
  assert.match(page, /uploadVideoWithTus/);
  assert.match(page, /maximum 1 GB/);
  assert.doesNotMatch(page, /maximum 200 MB/);
  assert.match(uploadRoute, /stream\/direct_upload/);
  assert.match(uploadRoute, /stream\?direct_user=true/);
  assert.match(uploadRoute, /"Tus-Resumable": "1\.0\.0"/);
  assert.match(uploadRoute, /"Upload-Length": String\(uploadLength\)/);
  assert.match(uploadRoute, /MAX_VIDEO_UPLOAD_BYTES = 1024 \* 1024 \* 1024/);
  assert.match(uploadRoute, /"vivadspark\.netlify\.app"/);
  assert.doesNotMatch(uploadRoute, /getHoshinSessionUsername/);
  assert.doesNotMatch(page, /Upload access key/);
  assert.doesNotMatch(uploadRoute, /CLOUDFLARE_STREAM_UPLOAD_SECRET/);
});

test("training videos support department libraries, durable completion records and person skills PDFs", async () => {
  const [page, report, skillsRoute, skillsStore, skillsMatrix, schema, migration, css] = await Promise.all([
    readFile(new URL("../app/training/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/training/person-skills-pdf.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/vivadocs/skills/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/vivadocs-skills-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/vivadocs/skills-matrix.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../netlify/database/migrations/20260819090000_create_training_video_completions/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const department of ["CST", "Prepress", "Printers", "Cutters", "Fab1", "Framing", "Sew", "Light Box", "Office", "Despatch"]) {
    assert.match(page, new RegExp(`"${department}"`));
  }
  for (const category of ["Operations", "Training", "Quality"]) assert.match(page, new RegExp(`"${category}"`));
  assert.match(page, /Library \/ department/);
  assert.match(page, /action: "completeVideo"/);
  assert.match(page, /videoUid: course\.videoUid \|\| course\.id/);
  assert.match(page, /buildPersonSkillsPdf/);
  assert.match(page, /Download skills PDF/);
  assert.match(page, /URL\.createObjectURL/);
  assert.match(skillsRoute, /case "completeVideo"/);
  assert.match(skillsStore, /export async function recordVideoCompletion/);
  assert.match(skillsStore, /INSERT INTO vivadocs_video_completions/);
  assert.match(skillsStore, /ON CONFLICT \(person_id, video_uid\) DO UPDATE/);
  assert.match(skillsStore, /videoCompletions/);
  assert.match(skillsMatrix, /Training videos watched/);
  assert.match(skillsMatrix, /SHARED_VIDEO_LIBRARIES/);
  assert.match(skillsMatrix, /departmentVideoCompletions/);
  assert.match(schema, /pgTable\("vivadocs_video_completions"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS vivadocs_video_completions/);
  assert.match(migration, /UNIQUE \(person_id, video_uid\)/);
  assert.match(report, /LOGO_URL = "\/vivad-logo\.png"/);
  assert.match(report, /pdf\.addImage\(logoData/);
  assert.match(report, /SOP skills acquired/);
  assert.match(report, /Training videos watched/);
  assert.match(report, /Page \$\{page\} of \$\{pages\}/);
  assert.match(report, /Training-and-Skills\.pdf/);
  assert.match(css, /\.training-skills-pdf/);
  assert.match(css, /\.skills-video-table/);
});

test("includes the interactive VivaDocs controlled-document workspace", async () => {
  const [page, strategy, quality, training, css, store, imageRoute, migration, uploadRoute] = await Promise.all([
    readFile(new URL("../app/vivadocs/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/strategy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/quality/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/training/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/vivadocs-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/vivadocs/images/[...key]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../netlify/database/migrations/20260814045400_create_vivadocs/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/training/upload/route.ts", import.meta.url), "utf8"),
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
  assert.match(page, /setSops\(stored\)/);
  assert.match(page, /const REMOVED_DEMO_REFERENCES = new Set/);
  for (const reference of ["OPS-014", "WHS-008", "QLT-021", "CUS-005"]) {
    assert.match(page, new RegExp(`REMOVED_DEMO_REFERENCES[\\s\\S]*${reference}`));
  }
  assert.doesNotMatch(page, /JSON\.stringify\(\{ sops, audit \}\)/);
  assert.match(page, /imageUrl: step\.existingImageUrl/);
  assert.match(page, /operator-visual.*has-image/);
  assert.match(page, /Visual instruction for Step/);
  assert.match(page, /<SopPdfActions sop=\{selected\} compact/);
  assert.match(page, /Submit completion/);
  assert.match(
    page,
    /async function completeRun\(\)[\s\S]*action: "completeSop"[\s\S]*skills matrix updated[\s\S]*setView\("SOP library"\);/,
  );
  assert.match(strategy, /href="\/vivadocs"/);
  assert.match(quality, /navigationItem\("vivadocs"\)\.href/);
  assert.match(training, /navigationItem\("vivadocs"\)\.href/);
  assert.match(css, /\.vivadocs-shell/);
  assert.match(css, /\.operator-player/);
  assert.match(store, /from "@netlify\/database"/);
  assert.doesNotMatch(store, /cloudflare:workers|SOP_ASSETS|D1/);
  assert.match(store, /INSERT INTO sop_assets/);
  assert.match(imageRoute, /asset\.contentType/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sops/);
  assert.match(migration, /data BYTEA NOT NULL/);
  assert.match(uploadRoute, /api\.cloudflare\.com\/client\/v4\/accounts/);
});

test("VivaDocs skills matrix is department-scoped, editable and updated by SOP completion", async () => {
  const [page, skills, route, store, migration, globalSopMigration, css] = await Promise.all([
    readFile(new URL("../app/vivadocs/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/vivadocs/skills-matrix.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/vivadocs/skills/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/vivadocs-skills-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../netlify/database/migrations/20260817020000_create_vivadocs_skills/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../netlify/database/migrations/20260817043000_make_new_sop_training_global/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const department of ["CST", "Prepress", "Printers", "Cutters", "Fab1", "Framing", "Sew", "Light Box", "Office", "Despatch"]) {
    assert.match(skills, new RegExp(`"${department}"`));
  }
  assert.match(skills, /aria-label="Select department"/);
  assert.match(skills, /sop\.category === department \|\| sop\.availableToAllDepartments/);
  assert.match(skills, /person\.department === department/);
  assert.match(skills, /Add person/);
  assert.match(skills, /Transfer person/);
  assert.match(skills, /Remove person/);
  assert.match(skills, /Update training record/);
  assert.match(skills, /event\.key === "Escape"/);
  assert.match(route, /case "addPerson"/);
  assert.match(route, /case "transferPerson"/);
  assert.match(route, /case "removePerson"/);
  assert.match(route, /case "updateTraining"/);
  assert.match(route, /case "completeSop"/);
  assert.match(store, /ELSE 'Competent'/);
  assert.match(store, /source = 'SOP completion'/);
  assert.match(page, /aria-label="Filter by department"/);
  assert.match(page, /All departments/);
  assert.match(page, /sop\.category === department/);
  assert.match(page, /sop\.availableToAllDepartments/);
  assert.match(page, /Select your name &amp; run/);
  assert.match(page, /async function openRunPicker/);
  assert.match(page, /person\.department === sop\.category/);
  assert.match(page, /aria-label="Select your name"/);
  assert.match(page, /Record name & start SOP/);
  assert.match(page, /personName: runPersonName/);
  assert.match(page, /Completing as <strong>\{runPersonName\}<\/strong>/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS vivadocs_people/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS vivadocs_training_records/);
  assert.match(migration, /UNIQUE \(person_id, sop_id\)/);
  assert.match(globalSopMigration, /available_to_all_departments BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(globalSopMigration, /reference = 'OFF-000001'/);
  assert.match(globalSopMigration, /Office - How to create a new SOP/);
  assert.match(css, /\.skills-toolbar/);
  assert.match(css, /\.skills-table-scroll/);
  assert.match(css, /\.skills-modal/);
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
  const [workflow, pdfActions, model, store, schema, migration, routes, css] = await Promise.all([
    readFile(new URL("../app/vivadocs/sop-workflow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/vivadocs/sop-pdf-actions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/vivadocs-model.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/vivadocs-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../netlify/database/migrations/20260814045400_create_vivadocs/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/vivadocs/sops/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
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
  assert.match(store, /from "@netlify\/database"/);
  assert.match(store, /ON CONFLICT\(department\) DO UPDATE SET prefix = EXCLUDED\.prefix, last_number = sop_counters\.last_number \+ 1/);
  assert.match(store, /RETURNING last_number/);
  assert.match(schema, /uniqueIndex\("idx_sops_reference"\)/);
  assert.match(schema, /uniqueIndex\("idx_sop_steps_position"\)/);
  assert.match(schema, /pgTable\("sop_assets"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sop_counters/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sop_assets/);
  assert.match(migration, /data BYTEA NOT NULL/);
  assert.match(store, /await client\.query\("ROLLBACK"\)/);
  assert.match(store, /INSERT INTO sop_assets/);
  assert.match(store, /IMAGE_TYPES/);
  assert.match(store, /MAX_IMAGE_BYTES = 8 \* 1024 \* 1024/);
  assert.match(store, /existingImageKey/);
  assert.match(routes, /export async function POST/);
  assert.doesNotMatch(store, /cloudflare:workers|SOP_ASSETS|D1/);

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
  assert.match(workflow, /<SopPdfActions/);
  assert.match(pdfActions, /export const MAX_STEPS_PER_PDF_PAGE = 4/);
  assert.match(pdfActions, /stepsOnPage === MAX_STEPS_PER_PDF_PAGE/);
  assert.match(pdfActions, /y \+ blockHeight > contentBottom/);
  assert.match(pdfActions, /if \(blockHeight > contentBottom - contentTop\)/);
  assert.match(pdfActions, /for \(let index = 0; index < prepared\.length; index \+= 1\)/);
  assert.match(pdfActions, /`Status: \$\{sop\.status/);
  assert.match(pdfActions, /`Owner: \$\{sop\.owner/);
  assert.match(pdfActions, /`Location: \$\{sop\.location/);
  assert.match(pdfActions, /`Review: \$\{dateLabel\(sop\.reviewDate\)\}`/);
  assert.match(pdfActions, /LOGO_URL = "\/vivad-logo\.png"/);
  assert.match(pdfActions, /pdf\.addImage\(logoData/);
  assert.match(pdfActions, /Page \$\{page\} of \$\{pages\}/);
  assert.match(pdfActions, /NO STEP IMAGE PROVIDED/);
  assert.match(pdfActions, /STEP IMAGE UNAVAILABLE/);
  assert.match(pdfActions, /navigator\.share/);
  assert.match(pdfActions, /navigator\.canShare/);
  assert.match(pdfActions, /frameWindow\.print\(\)/);
  assert.match(pdfActions, /link\.download = pdf\.filename/);
  assert.match(pdfActions, /Sharing is not supported on this device/);
  assert.match(pdfActions, /Rev-\$\{filenamePart\(sop\.revision/);
  assert.match(pdfActions, /\[<>:"\/\\\\\|\?\*/);
  assert.match(pdfActions, /aria-haspopup="dialog"/);
  assert.match(pdfActions, /aria-modal="true"/);
  assert.doesNotMatch(workflow, /QRCode|qrUrl|Download QR|Scan to open/);
  assert.doesNotMatch(workflow, /canonicalUrl/);
  assert.match(workflow, /aria-modal="true"/);
  assert.match(workflow, /aria-readonly="true"/);
  assert.match(css, /height: min\(94dvh,940px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media print/);
});
