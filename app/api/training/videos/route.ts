import { NextResponse } from "next/server";
import { authEnv, getHoshinSessionUsername } from "../../../../lib/auth/hoshin-auth";

type CloudflareVideo = {
  uid?: string;
  allowedOrigins?: string[];
  deliveryReady?: boolean;
  created?: string;
  duration?: number;
  meta?: Record<string, unknown>;
  publicDetails?: { title?: string | null };
  readyToStream?: boolean;
  requireSignedURLs?: boolean;
  status?: { state?: string; pctComplete?: string };
  thumbnail?: string;
};

type CloudflareResponse = {
  success: boolean;
  result?: CloudflareVideo[];
  errors?: Array<{ message?: string }>;
};

type DeleteVideoRequest = {
  uid?: unknown;
};

function getEnvironment() {
  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "",
    apiToken:
      process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim() ??
      process.env.CLOUDFLARE_API_TOKEN?.trim() ??
      "",
    customerSubdomain:
      process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim() ??
      process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim() ??
      process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim() ??
      "",
  };
}

function canDeleteVideo(username: string) {
  if (!username) return false;
  const allowedUsers = (process.env.TRAINING_VIDEO_DELETE_USERS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowedUsers.includes("*") || allowedUsers.includes(username.toLowerCase());
}

function normaliseStreamHost(value: string) {
  const cleaned = value
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
  if (!cleaned) return "";
  if (cleaned.endsWith(".cloudflarestream.com")) return cleaned;
  if (cleaned.startsWith("customer-")) return `${cleaned}.cloudflarestream.com`;
  return `customer-${cleaned}.cloudflarestream.com`;
}

function textMeta(meta: Record<string, unknown> | undefined, key: string) {
  const value = meta?.[key];
  return typeof value === "string" ? value.trim() : "";
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

async function repairPlaybackOrigins(
  videos: CloudflareVideo[],
  accountId: string,
  apiToken: string,
) {
  const requiredOrigins = configuredOrigins();
  await Promise.all(videos.map(async (video) => {
    video.deliveryReady = await isPlaybackAvailable(video);
  }));
  const videosToRepair = videos.filter((video) => video.uid && (
    requiredOrigins.some((origin) => !video.allowedOrigins?.includes(origin)) ||
    (isEncodingComplete(video) && !video.deliveryReady)
  ));

  await Promise.all(videosToRepair.map(async (video) => {
    const allowedOrigins = Array.from(new Set([
      ...(video.allowedOrigins ?? []),
      ...requiredOrigins,
    ]));
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/${encodeURIComponent(video.uid as string)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: video.uid,
          allowedOrigins,
          ...(video.deliveryReady ? {} : { thumbnailTimestampPct: 0.2 }),
        }),
      },
    );
    const payload = (await response.json()) as CloudflareResponse;
    if (!response.ok || !payload.success) {
      throw new Error(
        payload.errors?.[0]?.message ||
          `Cloudflare could not enable playback for ${video.uid}.`,
      );
    }
    video.allowedOrigins = allowedOrigins;
    if (!video.deliveryReady) video.deliveryReady = await isPlaybackAvailable(video);
  }));

  return videosToRepair.length;
}

async function isPlaybackAvailable(video: CloudflareVideo) {
  if (!isEncodingComplete(video) || !video.thumbnail) return false;
  try {
    const response = await fetch(video.thumbnail, {
      method: "HEAD",
      cache: "no-store",
      headers: { Referer: "https://vivadspark.netlify.app/" },
    });
    return response.ok;
  } catch {
    return false;
  }
}

function isEncodingComplete(video: CloudflareVideo) {
  return video.status?.state === "ready" &&
    Number(video.status.pctComplete ?? 0) >= 100;
}

export async function GET(request: Request) {
  const env = getEnvironment();
  const username = await getHoshinSessionUsername(
    request.headers.get("cookie") ?? "",
    authEnv(),
  );
  const missing = [
    !env.accountId && "CLOUDFLARE_ACCOUNT_ID",
    !env.apiToken && "CLOUDFLARE_STREAM_API_TOKEN",
  ].filter(Boolean);

  if (missing.length) {
    return NextResponse.json(
      { connected: false, videos: [], missing },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.accountId)}/stream?limit=1000&type=vod`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${env.apiToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    const payload = (await response.json()) as CloudflareResponse;

    if (!response.ok || !payload.success) {
      const message = payload.errors?.[0]?.message || `Cloudflare Stream returned ${response.status}.`;
      throw new Error(message);
    }

    const sourceVideos = payload.result ?? [];
    const repairedPlaybackOrigins = await repairPlaybackOrigins(
      sourceVideos,
      env.accountId,
      env.apiToken,
    );

    const videos = sourceVideos
      .filter((video) => video.uid)
      .map((video) => {
        const fallbackName = `Training video ${video.uid?.slice(0, 6)}`;
        return {
          id: video.uid,
          videoUid: video.uid,
          title:
            textMeta(video.meta, "name") ||
            video.publicDetails?.title?.trim() ||
            fallbackName,
          description:
            textMeta(video.meta, "description") ||
            "Cloudflare Stream training video.",
          category: textMeta(video.meta, "category") || "Training",
          level: textMeta(video.meta, "level") || "Vivad learning",
          owner: textMeta(video.meta, "owner") || "Vivad",
          durationSeconds: Math.max(0, Math.round(video.duration ?? 0)),
          thumbnail: video.thumbnail ?? "",
          ready: Boolean(isEncodingComplete(video) && video.deliveryReady),
          deliveryError: Boolean(isEncodingComplete(video) && !video.deliveryReady),
          status: isEncodingComplete(video) && !video.deliveryReady
            ? "delivery-error"
            : video.status?.state ?? "unknown",
          progress: video.status?.pctComplete ?? null,
          requiresSignedUrls: Boolean(video.requireSignedURLs),
          created: video.created ?? null,
        };
      })
      .sort((a, b) => (b.created ?? "").localeCompare(a.created ?? ""));

    const derivedStreamHost = videos
      .map((video) => video.thumbnail)
      .filter(Boolean)
      .map((thumbnail) => {
        try {
          return new URL(thumbnail).hostname;
        } catch {
          return "";
        }
      })
      .find((hostname) => hostname.endsWith(".cloudflarestream.com"));

    return NextResponse.json({
      connected: true,
      streamHost: normaliseStreamHost(env.customerSubdomain) || derivedStreamHost || "",
      videos,
      canDelete: canDeleteVideo(username),
      repairedPlaybackOrigins,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        connected: false,
        videos: [],
        error: error instanceof Error ? error.message : "Cloudflare Stream could not be reached.",
      },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  const username = await getHoshinSessionUsername(
    request.headers.get("cookie") ?? "",
    authEnv(),
  );
  if (!username) {
    return NextResponse.json(
      { error: "Sign in is required to delete a training video." },
      { status: 401 },
    );
  }
  if (!canDeleteVideo(username)) {
    return NextResponse.json(
      { error: "Your account does not have permission to delete training videos." },
      { status: 403 },
    );
  }

  let body: DeleteVideoRequest;
  try {
    body = await request.json() as DeleteVideoRequest;
  } catch {
    return NextResponse.json({ error: "A video ID is required." }, { status: 400 });
  }

  const uid = typeof body.uid === "string" ? body.uid.trim() : "";
  if (!/^[a-f0-9]{32}$/i.test(uid)) {
    return NextResponse.json({ error: "The video ID is invalid." }, { status: 400 });
  }

  const env = getEnvironment();
  if (!env.accountId || !env.apiToken) {
    return NextResponse.json(
      { error: "Cloudflare Stream is not configured for this deployment." },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.accountId)}/stream/${encodeURIComponent(uid)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${env.apiToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      errors?: Array<{ message?: string }>;
    };
    if (!response.ok || !payload.success) {
      throw new Error(
        payload.errors?.[0]?.message ||
          `Cloudflare Stream could not delete the video (${response.status}).`,
      );
    }

    return NextResponse.json(
      { deleted: true, uid, deletedBy: username },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "The training video could not be deleted.",
      },
      { status: 502 },
    );
  }
}
