import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";

const MAX_VIDEO_UPLOAD_BYTES = 1024 * 1024 * 1024;

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

  if (request.headers.get("Tus-Resumable") === "1.0.0") {
    return createTusUpload(request, accountId, apiToken);
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
  const allowedOrigins = configuredOrigins();

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
          creator: "Vivad contributor",
          expiry: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          requireSignedURLs: false,
          thumbnailTimestampPct: 0.2,
          meta: {
            name: title,
            description: clean(body.description, 500),
            category: clean(body.category, 60) || "Training",
            level: clean(body.level, 60) || "Vivad learning",
            owner: "Vivad",
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

async function createTusUpload(
  request: Request,
  accountId: string,
  apiToken: string,
) {
  const uploadLength = Number(request.headers.get("Upload-Length"));
  if (!Number.isSafeInteger(uploadLength) || uploadLength <= 0) {
    return NextResponse.json({ error: "The video file size is invalid." }, { status: 400 });
  }
  if (uploadLength > MAX_VIDEO_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "This uploader accepts video files up to 1 GB." },
      { status: 413 },
    );
  }

  const title = clean(decodeHeader(request.headers.get("X-Upload-Title")), 140);
  if (!title) {
    return NextResponse.json({ error: "A video title is required." }, { status: 400 });
  }
  const description = clean(
    decodeHeader(request.headers.get("X-Upload-Description")),
    500,
  );
  const category = clean(
    decodeHeader(request.headers.get("X-Upload-Category")),
    60,
  ) || "Training";
  const level = clean(decodeHeader(request.headers.get("X-Upload-Level")), 60) ||
    "Vivad learning";
  const maxDurationSeconds = Math.min(
    36_000,
    Math.max(60, Number(request.headers.get("X-Max-Duration-Seconds")) || 3_600),
  );
  const allowedOrigins = configuredOrigins();
  const metadata = [
    metadataEntry("name", title),
    metadataEntry("description", description),
    metadataEntry("category", category),
    metadataEntry("level", level),
    metadataEntry("owner", "Vivad"),
    metadataEntry("source", "Hoshin Training Academy"),
    metadataEntry("maxdurationseconds", String(maxDurationSeconds)),
    metadataEntry("allowedorigins", JSON.stringify(allowedOrigins)),
    metadataEntry("thumbnailtimestamppct", "0.2"),
  ].join(",");

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream?direct_user=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Tus-Resumable": "1.0.0",
          "Upload-Length": String(uploadLength),
          "Upload-Creator": "Vivad contributor",
          "Upload-Metadata": metadata,
        },
      },
    );
    const location = response.headers.get("Location");
    const mediaId = response.headers.get("stream-media-id");
    if (response.status !== 201 || !location) {
      const detail = await response.text();
      throw new Error(detail || `Cloudflare Stream returned ${response.status}.`);
    }
    const headers = new Headers({
      "Access-Control-Expose-Headers": "Location, stream-media-id, Tus-Resumable",
      "Cache-Control": "no-store",
      Location: location,
      "Tus-Resumable": "1.0.0",
    });
    if (mediaId) headers.set("stream-media-id", mediaId);
    return new Response(null, { status: 201, headers });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "A resumable upload URL could not be created.",
      },
      { status: 502 },
    );
  }
}

function configuredOrigins() {
  const values = process.env.CLOUDFLARE_STREAM_ALLOWED_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, ""))
    .filter(Boolean);
  return Array.from(new Set([
    "vivadspark.netlify.app",
    ...(values?.length
      ? values
      : [
          "keen-starlight-a13c9a.netlify.app",
          "hoshin-kanri-workspace.vivad-gpt-0611.chatgpt.site",
        ]),
  ]));
}

function decodeHeader(value: string | null) {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function metadataEntry(key: string, value: string) {
  return `${key} ${Buffer.from(value, "utf8").toString("base64")}`;
}
