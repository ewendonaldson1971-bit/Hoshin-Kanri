import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildInternalAnalysis, ISHIKAWA_CATEGORIES, sanitiseTechnicalContext, validateProblemAnalysis } from "../lib/problem-solving-model.ts";

const event = {
  id: "NCE-42", status: "Open", category: "Defect", origin: "Internal", dateLabel: "21/08/2026",
  jobNumber: "SECRET-JOB", department: "Printers", reportedBy: "Private Person", assignedTo: "Another Person",
  description: "Print banding occurred on a large-format job.", severity: 3, rootCause: "", action: "",
};

test("sanitised AI context excludes personal names and job identifiers", () => {
  const context = sanitiseTechnicalContext(event, "Check nozzle tests");
  const serialised = JSON.stringify(context);
  assert.doesNotMatch(serialised, /Private Person|Another Person|SECRET-JOB|NCE-42/);
  assert.match(serialised, /Print banding/);
});

test("fallback analysis covers every Ishikawa category without invented research", () => {
  const analysis = buildInternalAnalysis(event, "Check nozzle tests", "Research unavailable");
  assert.deepEqual(analysis.causes.map((cause) => cause.category), [...ISHIKAWA_CATEGORIES]);
  assert.ok(analysis.causes.every((cause) => /Insufficient evidence/i.test(cause.evidenceGap)));
  assert.equal(analysis.researchAvailable, false);
  assert.deepEqual(analysis.sources, []);
  assert.ok(validateProblemAnalysis(analysis));
});

test("problem-solving routes keep authentication, structured output and persistence server-side", async () => {
  const analyse = await readFile(new URL("../app/api/problem-solving/analyse/route.ts", import.meta.url), "utf8");
  const plans = await readFile(new URL("../app/api/problem-solving/plans/route.ts", import.meta.url), "utf8");
  assert.match(analyse, /getHoshinRequestUsername/);
  assert.match(analyse, /web_search/);
  assert.match(analyse, /json_schema/);
  assert.match(analyse, /saveAnalysis/);
  assert.match(plans, /savePlan/);
  assert.match(plans, /getProblemHistory/);
});

test("workflow uses live events, same-origin credentials, version confirmation and editable plans", async () => {
  const client = await readFile(new URL("../app/lets-problem-solve/problem-solving-workflow.tsx", import.meta.url), "utf8");
  assert.match(client, /\/api\/problem-solving\/events/);
  assert.match(client, /credentials: "same-origin"/);
  assert.match(client, /Run a new analysis version/);
  assert.match(client, /Save action plan/);
  assert.match(client, /HISTORY & AUDIT/);
});
