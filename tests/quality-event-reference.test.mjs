import assert from "node:assert/strict";
import test from "node:test";
import { qualityEventJobNumber } from "../lib/quality-event-reference.ts";

test("preserves a genuine Google Sheet job number", () => {
  assert.equal(qualityEventJobNumber(" 194919 ", "21/08/2026", 2), "194919");
});

test("assigns a stable readable reference when a job number is blank", () => {
  const first = qualityEventJobNumber("", "21/08/2026", 2);
  assert.equal(first, "NCE-20260821-00002");
  assert.equal(qualityEventJobNumber("", "21/08/2026", 2), first);
});

test("blank-job rows always receive different references", () => {
  const references = [2, 3, 4, 257].map((row) => qualityEventJobNumber("", "21/08/2026", row));
  assert.equal(new Set(references).size, references.length);
});

test("undated rows still receive unique references", () => {
  assert.equal(qualityEventJobNumber("", "", 14), "NCE-UNDATED-00014");
  assert.notEqual(qualityEventJobNumber("", "", 14), qualityEventJobNumber("", "", 15));
});
