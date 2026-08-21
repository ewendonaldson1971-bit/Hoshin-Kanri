import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHoshinSessionCookie,
  canDeleteTrainingVideos,
  createHoshinSessionToken,
  getHoshinRequestUsername,
  trainingVideoDeleteAccess,
} from "../lib/auth/hoshin-auth.ts";

test("canonical request authentication accepts a valid signed application session", async () => {
  const previousSecret = process.env.LOTUS_AUTH_SECRET;
  process.env.LOTUS_AUTH_SECRET = "test-secret-that-is-not-used-in-production";
  try {
    const token = await createHoshinSessionToken("Rubin Sekuleski", process.env.LOTUS_AUTH_SECRET);
    const cookie = buildHoshinSessionCookie(token, new URL("https://vivadspark.test/training"), 3600);
    const request = new Request("https://vivadspark.test/api/training/videos", {
      method: "DELETE",
      headers: { cookie: cookie.split(";", 1)[0] },
    });
    assert.equal(await getHoshinRequestUsername(request), "Rubin Sekuleski");
  } finally {
    if (previousSecret === undefined) delete process.env.LOTUS_AUTH_SECRET;
    else process.env.LOTUS_AUTH_SECRET = previousSecret;
  }
});

test("unauthenticated deletion access returns 401", () => {
  assert.deepEqual(trainingVideoDeleteAccess("", "Rubin Sekuleski"), {
    allowed: false,
    status: 401,
    error: "Sign in is required to delete a training video.",
  });
});

test("authenticated user outside the configured permission list returns 403", () => {
  assert.deepEqual(trainingVideoDeleteAccess("Another User", "Rubin Sekuleski"), {
    allowed: false,
    status: 403,
    error: "Your account does not have permission to delete training videos.",
  });
});

test("authenticated authorized user can delete", () => {
  assert.equal(canDeleteTrainingVideos("Rubin Sekuleski", "Rubin Sekuleski, Ewen Donaldson"), true);
  assert.equal(trainingVideoDeleteAccess("Rubin Sekuleski", "Rubin Sekuleski").status, 200);
});
