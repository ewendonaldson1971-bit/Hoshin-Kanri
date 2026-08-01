import { NextResponse } from "next/server";
import { authEnv, getHoshinSessionUsername } from "../../../../lib/auth/hoshin-auth";

type UploadRequest = {
  title?: string;
  description?: string;
  category?: string;
  level?: string;
  maxDurationSeconds?: number;
};

type DirectUploadResponse = {
  success: boolean;
  result?: { uid?: string; uploadURL?: string };
  errors?: Array<{ message?: string }>;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  const username = await getHoshinSessionUsername(
    request.headers.get("cookie") ?? "",
    authEnv(),
  );
  if (!username) {
    return NextResponse.json(
      { error: "Sign in with your Lotus credentials to upload videos.", loginUrl: "/hoshin-login?return_to=/training" },
      { status: 401 },
    );
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
  const apiToken =
    process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim() ??
    process.env.CLOUDFLARE_API_TOKEN?.trim() ??
    "";

  if (!accountId || !apiToken) {
    return NextResponse.json(
      {
        error: "Video uploads are not fully configured.",
        missing: [
          !accountId && "CLOUDFLARE_ACCOUNT_ID",
          !apiToken && "CLOUDFLARE_STREAM_API_TOKEN",
        ].filter(Boolean),
      },
      { status: 503 },
    );
  }

  let body: UploadRequest;
  try {
    body = (await request.json()) as UploadRequest;
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const title = clean(body.title, 140);
  if (!title) {
    return NextResponse.json({ error: "A video title is required." }, { status: 400 });
  }

  const maxDurationSeconds = Math.min(
    36_000,
    Math.max(60, Number(body.maxDurationSeconds) || 3_600),
  );
  const configuredOrigins = process.env.CLOUDFLARE_STREAM_ALLOWED_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, ""))
    .filter(Boolean);
  const allowedOrigins = configuredOrigins?.length
    ? configuredOrigins
    : [
        "keen-starlight-a13c9a.netlify.app",
        "hoshin-kanri-workspace.vivad-gpt-0611.chatgpt.site",
      ];

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maxDurationSeconds,
          allowedOrigins,
          creator: username,
          expiry: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          requireSignedURLs: false,
          thumbnailTimestampPct: 0.2,
          meta: {
            name: title,
            description: clean(body.description, 500),
            category: clean(body.category, 60) || "Training",
            level: clean(body.level, 60) || "Vivad learning",
            owner: username,
            source: "Hoshin Training Academy",
          },
        }),
      },
    );
    const payload = (await response.json()) as DirectUploadResponse;

    if (!response.ok || !payload.success || !payload.result?.uploadURL || !payload.result.uid) {
      throw new Error(payload.errors?.[0]?.message || `Cloudflare Stream returned ${response.status}.`);
    }

    return NextResponse.json({
      uid: payload.result.uid,
      uploadURL: payload.result.uploadURL,
      expiresInMinutes: 15,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "An upload URL could not be created.",
      },
      { status: 502 },
    );
  }
}
