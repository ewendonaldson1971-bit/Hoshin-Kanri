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
  playback?: { hls?: string; dash?: string };
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
  const videosToRepair = videos.filter((video) => video.uid &&
    requiredOrigins.some((origin) => !video.allowedOrigins?.includes(origin)));

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
        body: JSON.stringify({ uid: video.uid, allowedOrigins }),
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
  }));

  // This is diagnostic only. Cloudflare's playback/thumbnail endpoints can be
  // briefly unavailable after encoding, so a failed probe must never hide an
  // otherwise ready video from the player.
  await Promise.all(videos.map(async (video) => {
    video.deliveryReady = await isPlaybackAvailable(video);
  }));

  return videosToRepair.length;
}

async function isPlaybackAvailable(video: CloudflareVideo) {
  if (!isEncodingComplete(video)) return false;
  const playbackUrl = video.playback?.hls || video.thumbnail;
  if (!playbackUrl) return true;
  try {
    const response = await fetch(playbackUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        Referer: "https://vivadspark.netlify.app/",
        Range: "bytes=0-1023",
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

function isEncodingComplete(video: CloudflareVideo) {
  const progress = Number(video.status?.pctComplete);
  if (Number.isFinite(progress)) {
    return video.status?.state === "ready" && progress >= 100;
  }
  return Boolean(video.readyToStream);
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

    const videos = await Promise.all(sourceVideos
      .filter((video) => video.uid)
      .map(async (video) => {
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
          // Cloudflare's readyToStream/status fields are authoritative. A
          // transient delivery probe failure is reported separately but does
          // not prevent the browser player from attempting playback.
          ready: isEncodingComplete(video),
          deliveryError: Boolean(isEncodingComplete(video) && !video.deliveryReady),
          status: isEncodingComplete(video) && !video.deliveryReady
            ? "delivery-error"
            : video.status?.state ?? "unknown",
          progress: video.status?.pctComplete ?? null,
          requiresSignedUrls: Boolean(video.requireSignedURLs),
          created: video.created ?? null,
          canDelete: Boolean(username),
        };
      }));
    videos.sort((a, b) => (b.created ?? "").localeCompare(a.created ?? ""));

    // A failed Stream upload can remain in Cloudflare after the original is
    // uploaded again. Prefer the healthy copy with the same title so the
    // training library never selects a known-broken duplicate.
    const preferredByTitle = new Map<string, (typeof videos)[number]>();
    for (const video of videos) {
      const key = video.title.trim().toLowerCase();
      const existing = preferredByTitle.get(key);
      if (!existing || (video.ready && !video.deliveryError && existing.deliveryError)) {
        preferredByTitle.set(key, video);
      }
    }
    const preferredVideos = Array.from(preferredByTitle.values());

    const derivedStreamHost = videos
      .flatMap((video) => [video.thumbnail, sourceVideos.find((item) => item.uid === video.videoUid)?.playback?.hls ?? ""])
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
      videos: preferredVideos,
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

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "This delete request did not originate from Vivad SPARK." },
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
    // Cloudflare's Stream delete endpoint returns no response body on success.
    // Only an HTTP failure or an explicit `success: false` is an error.
    if (!response.ok || payload.success === false) {
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
