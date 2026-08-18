"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MobileWorkspaceNavigation, navigationItem } from "../components/workspace-navigation";

type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  level: string;
  owner: string;
  accent: "blue" | "green" | "red" | "amber";
  videoUid: string;
  thumbnail?: string;
  ready?: boolean;
  deliveryError?: boolean;
  requiresSignedUrls?: boolean;
  source?: "stream" | "youtube";
  youtubeId?: string;
  created?: string | null;
};

type StreamLibraryResponse = {
  connected: boolean;
  canDelete?: boolean;
  streamHost?: string;
  refreshedAt?: string;
  error?: string;
  missing?: string[];
  videos: Array<{
    id: string;
    videoUid: string;
    title: string;
    description: string;
    category: string;
    level: string;
    owner: string;
    durationSeconds: number;
    thumbnail: string;
    ready: boolean;
    deliveryError?: boolean;
    requiresSignedUrls: boolean;
    created?: string | null;
  }>;
};

type StreamConfig = {
  customerCode: string;
  videoIds: Record<string, string>;
};

type StreamPlayer = {
  addEventListener: (event: string, callback: () => void) => void;
};

declare global {
  interface Window {
    Stream?: (iframe: HTMLIFrameElement) => StreamPlayer;
  }
}

const courses: Course[] = [
  {
    id: "nce-foundations",
    title: "NCE foundations",
    description: "Recognise a non-conformance, capture useful evidence, and start the right response without delay.",
    category: "Quality",
    duration: "12 min",
    level: "Essential",
    owner: "Quality team",
    accent: "red",
    videoUid: process.env.NEXT_PUBLIC_STREAM_VIDEO_NCE_FOUNDATIONS ?? "",
  },
  {
    id: "root-cause",
    title: "Root cause that leads to action",
    description: "Move past symptoms using a practical cause-analysis sequence built for production teams.",
    category: "Problem solving",
    duration: "18 min",
    level: "Core skill",
    owner: "Continuous improvement",
    accent: "blue",
    videoUid: process.env.NEXT_PUBLIC_STREAM_VIDEO_ROOT_CAUSE ?? "",
  },
  {
    id: "remedial-action",
    title: "Close the corrective-action loop",
    description: "Assign, verify, and close remedial actions with evidence that the problem will not recur.",
    category: "Quality",
    duration: "15 min",
    level: "Core skill",
    owner: "Quality team",
    accent: "green",
    videoUid: process.env.NEXT_PUBLIC_STREAM_VIDEO_REMEDIAL_ACTION ?? "",
  },
  {
    id: "daily-flow",
    title: "Daily flow management",
    description: "Use daily visual management to expose blockers, stabilise work, and protect customer commitments.",
    category: "Operations",
    duration: "21 min",
    level: "Leader practice",
    owner: "Operations",
    accent: "amber",
    videoUid: process.env.NEXT_PUBLIC_STREAM_VIDEO_DAILY_FLOW ?? "",
  },
  {
    id: "hoshin-review",
    title: "Running a Hoshin review",
    description: "Turn the monthly review into a focused learning and decision rhythm rather than status reporting.",
    category: "Strategy",
    duration: "16 min",
    level: "Leader practice",
    owner: "Strategy team",
    accent: "blue",
    videoUid: process.env.NEXT_PUBLIC_STREAM_VIDEO_HOSHIN_REVIEW ?? "",
  },
  {
    id: "standard-work",
    title: "Leader standard work",
    description: "Build simple routines that keep priorities visible and make support predictable for frontline teams.",
    category: "Leadership",
    duration: "14 min",
    level: "Leader practice",
    owner: "People team",
    accent: "green",
    videoUid: process.env.NEXT_PUBLIC_STREAM_VIDEO_STANDARD_WORK ?? "",
  },
];

const configKey = "vivad-stream-training-config";
const progressKey = "vivad-stream-training-progress";
const youtubeKey = "vivad-youtube-training-links";
const BASIC_UPLOAD_MAX_BYTES = 200 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 1024 * 1024 * 1024;
const TUS_CHUNK_BYTES = 50 * 1024 * 1024;

function youtubeVideoId(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (url.hostname === "youtube.com" || url.hostname.endsWith(".youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v") ?? "";
      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0] ?? "")) return parts[1] ?? "";
    }
  } catch {
    return "";
  }
  return "";
}

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function uploadVideoWithTus(
  file: File,
  details: {
    title: string;
    description: string;
    category: string;
    level: string;
    maxDurationSeconds: number;
  },
  onProgress: (percentage: number) => void,
) {
  const response = await fetch("/api/training/upload", {
    method: "POST",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(file.size),
      "X-Upload-Title": encodeURIComponent(details.title),
      "X-Upload-Description": encodeURIComponent(details.description),
      "X-Upload-Category": encodeURIComponent(details.category),
      "X-Upload-Level": encodeURIComponent(details.level),
      "X-Max-Duration-Seconds": String(details.maxDurationSeconds),
    },
  });
  const location = response.headers.get("Location");
  if (response.status !== 201 || !location) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "The resumable upload could not be prepared.");
  }

  let offset = 0;
  let failures = 0;
  while (offset < file.size) {
    const end = Math.min(offset + TUS_CHUNK_BYTES, file.size);
    try {
      offset = await uploadTusChunk(
        location,
        file.slice(offset, end),
        offset,
        file.size,
        onProgress,
      );
      failures = 0;
    } catch (error) {
      failures += 1;
      if (failures > 3) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, failures * 1500));
      offset = await readTusOffset(location, offset);
    }
  }
}

function uploadTusChunk(
  location: string,
  chunk: Blob,
  offset: number,
  total: number,
  onProgress: (percentage: number) => void,
) {
  return new Promise<number>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PATCH", location);
    request.setRequestHeader("Tus-Resumable", "1.0.0");
    request.setRequestHeader("Upload-Offset", String(offset));
    request.setRequestHeader("Content-Type", "application/offset+octet-stream");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round(((offset + event.loaded) / total) * 100));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve(Number(request.getResponseHeader("Upload-Offset")) || offset + chunk.size);
      } else {
        reject(new Error(`Cloudflare rejected a video chunk (${request.status}).`));
      }
    };
    request.onerror = () => reject(
      new Error("The upload was interrupted. It will retry from the last saved chunk."),
    );
    request.send(chunk);
  });
}

async function readTusOffset(location: string, fallback: number) {
  try {
    const response = await fetch(location, {
      method: "HEAD",
      headers: { "Tus-Resumable": "1.0.0" },
    });
    const offset = Number(response.headers.get("Upload-Offset"));
    return response.ok && Number.isFinite(offset) ? offset : fallback;
  } catch {
    return fallback;
  }
}

function formatDuration(seconds: number) {
  if (!seconds) return "Duration pending";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

function manualStreamHost(customerCode: string) {
  const cleaned = customerCode.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  if (!cleaned) return "";
  if (cleaned.endsWith(".cloudflarestream.com")) return cleaned;
  if (cleaned.startsWith("customer-")) return `${cleaned}.cloudflarestream.com`;
  return `customer-${cleaned}.cloudflarestream.com`;
}

export default function TrainingPage() {
  const [activeId, setActiveId] = useState(courses[0].id);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All topics");
  const [completed, setCompleted] = useState<string[]>([]);
  const [configOpen, setConfigOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "preparing" | "uploading" | "processing" | "error">("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadSource, setUploadSource] = useState<"file" | "youtube">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [youtubeCourses, setYoutubeCourses] = useState<Course[]>([]);
  const [library, setLibrary] = useState<StreamLibraryResponse>({ connected: false, videos: [] });
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [deleteNotice, setDeleteNotice] = useState<{ message: string; error: boolean } | null>(null);
  const [config, setConfig] = useState<StreamConfig>({
    customerCode: process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE ?? "",
    videoIds: Object.fromEntries(courses.map((course) => [course.id, course.videoUid])),
  });
  const playerRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const response = await fetch("/api/training/videos", { cache: "no-store" });
      const payload = (await response.json()) as StreamLibraryResponse;
      setLibrary(payload);
      if (payload.connected && payload.videos.length) {
        const requested = new URLSearchParams(window.location.search).get("video");
        setActiveId((current) => requested && payload.videos.some((video) => video.id === requested) ? requested : payload.videos.some((video) => video.id === current) ? current : payload.videos[0].id);
      }
    } catch {
      setLibrary({ connected: false, videos: [], error: "The Stream library could not be reached." });
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedConfig = window.localStorage.getItem(configKey);
    const savedProgress = window.localStorage.getItem(progressKey);
    const savedYoutube = window.localStorage.getItem(youtubeKey);
    if (savedConfig) {
      try {
        // Restore the user's local Stream connection settings after mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setConfig(JSON.parse(savedConfig) as StreamConfig);
      } catch {
        window.localStorage.removeItem(configKey);
      }
    }
    if (savedProgress) {
      try {
        setCompleted(JSON.parse(savedProgress) as string[]);
      } catch {
        window.localStorage.removeItem(progressKey);
      }
    }
    if (savedYoutube) {
      try {
        const linkedCourses = JSON.parse(savedYoutube) as Course[];
        setYoutubeCourses(linkedCourses);
        const requested = new URLSearchParams(window.location.search).get("video");
        if (requested && linkedCourses.some((course) => course.id === requested)) setActiveId(requested);
      } catch {
        window.localStorage.removeItem(youtubeKey);
      }
    }

    if (!document.querySelector('script[data-cloudflare-stream="true"]')) {
      const script = document.createElement("script");
      script.src = "https://embed.cloudflarestream.com/embed/sdk.latest.js";
      script.async = true;
      script.dataset.cloudflareStream = "true";
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    // Populate the remotely backed library when this client surface mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshLibrary();
  }, [refreshLibrary]);

  const libraryCourses = useMemo<Course[]>(() => {
    if (!library.connected || !library.videos.length) return [...courses, ...youtubeCourses];
    const accents: Course["accent"][] = ["blue", "green", "red", "amber"];
    const streamCourses = library.videos.map((video, index) => ({
      id: video.id,
      title: video.title,
      description: video.description,
      category: video.category,
      duration: formatDuration(video.durationSeconds),
      level: video.level,
      owner: video.owner,
      accent: accents[index % accents.length],
      videoUid: video.videoUid,
      thumbnail: video.thumbnail,
      ready: video.ready,
      deliveryError: video.deliveryError,
      requiresSignedUrls: video.requiresSignedUrls,
      created: video.created ?? null,
      source: "stream" as const,
    }));
    return [...streamCourses, ...youtubeCourses];
  }, [library, youtubeCourses]);

  const categories = useMemo(
    () => ["All topics", ...Array.from(new Set(libraryCourses.map((course) => course.category)))],
    [libraryCourses],
  );

  const filteredCourses = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return libraryCourses.filter((course) => {
      const matchesCategory = category === "All topics" || course.category === category;
      const matchesQuery =
        !needle ||
        [course.title, course.description, course.category, course.owner]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      return matchesCategory && matchesQuery;
    });
  }, [category, libraryCourses, query]);

  const activeCourse = libraryCourses.find((course) => course.id === activeId) ?? libraryCourses[0];
  const activeUid = activeCourse.videoUid || config.videoIds[activeCourse.id];
  const isYoutube = Boolean(activeCourse.youtubeId);
  const streamHost = library.streamHost || manualStreamHost(config.customerCode);
  const isProtected = Boolean(activeCourse.requiresSignedUrls);
  const isReady = activeCourse.ready !== false;
  const hasDeliveryError = Boolean(activeCourse.deliveryError);
  const isConnected = Boolean(!isYoutube && streamHost && activeUid?.trim() && isReady && !isProtected);
  const completionRate = libraryCourses.length ? Math.round((completed.filter((id) => libraryCourses.some((course) => course.id === id)).length / libraryCourses.length) * 100) : 0;

  function markComplete(courseId: string) {
    setCompleted((current) => {
      const next = current.includes(courseId)
        ? current.filter((id) => id !== courseId)
        : [...current, courseId];
      window.localStorage.setItem(progressKey, JSON.stringify(next));
      return next;
    });
  }

  function connectPlayer() {
    if (!playerRef.current || !window.Stream) return;
    const player = window.Stream(playerRef.current);
    player.addEventListener("ended", () => {
      setCompleted((current) => {
        if (current.includes(activeCourse.id)) return current;
        const next = [...current, activeCourse.id];
        window.localStorage.setItem(progressKey, JSON.stringify(next));
        return next;
      });
    });
  }

  function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: StreamConfig = {
      customerCode: String(form.get("customerCode") ?? "").trim(),
      videoIds: Object.fromEntries(
        courses.map((course) => [course.id, String(form.get(course.id) ?? "").trim()]),
      ),
    };
    window.localStorage.setItem(configKey, JSON.stringify(next));
    setConfig(next);
    setConfigOpen(false);
  }

  async function uploadVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (uploadSource === "youtube") {
      const videoId = youtubeVideoId(String(form.get("youtubeUrl") ?? ""));
      if (!videoId || !/^[\w-]{6,20}$/.test(videoId)) {
        setUploadStatus("error");
        setUploadMessage("Paste a valid YouTube video, Shorts, Live, or youtu.be link.");
        return;
      }
      const title = String(form.get("title") ?? "").trim();
      const nextCourse: Course = {
        id: `youtube-${videoId}`,
        title,
        description: String(form.get("description") ?? "").trim() || "Watch this linked YouTube training video.",
        category: String(form.get("category") ?? "Training"),
        duration: "YouTube",
        level: String(form.get("level") ?? "Vivad learning"),
        owner: "Vivad",
        accent: "red",
        videoUid: "",
        source: "youtube",
        youtubeId: videoId,
        created: new Date().toISOString(),
      };
      setYoutubeCourses((current) => {
        const next = [...current.filter((course) => course.youtubeId !== videoId), nextCourse];
        window.localStorage.setItem(youtubeKey, JSON.stringify(next));
        return next;
      });
      setActiveId(nextCourse.id);
      setUploadProgress(100);
      setUploadStatus("processing");
      setUploadMessage("YouTube module added to this device and opened in the learning library.");
      return;
    }

    const file = selectedFile;
    if (!file?.size) {
      setUploadStatus("error");
      setUploadMessage("Choose a video file to upload.");
      return;
    }
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      setUploadStatus("error");
      setUploadMessage("This uploader accepts video files up to 1 GB.");
      return;
    }

    const uploadDetails = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      category: String(form.get("category") ?? "Training"),
      level: String(form.get("level") ?? "Vivad learning"),
      maxDurationSeconds: Number(form.get("maxDurationSeconds") ?? 3_600),
    };

    setUploadStatus("preparing");
    setUploadProgress(0);
    setUploadMessage(
      file.size > BASIC_UPLOAD_MAX_BYTES
        ? "Preparing a secure resumable upload…"
        : "Creating a secure one-time upload…",
    );

    try {
      if (file.size > BASIC_UPLOAD_MAX_BYTES) {
        setUploadStatus("uploading");
        setUploadMessage("Uploading to Cloudflare Stream in resumable chunks…");
        await uploadVideoWithTus(file, uploadDetails, setUploadProgress);
      } else {
        const response = await fetch("/api/training/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(uploadDetails),
        });
        const payload = (await response.json()) as { uploadURL?: string; error?: string; missing?: string[] };
        if (!response.ok || !payload.uploadURL) {
          const missing = payload.missing?.length ? ` Add ${payload.missing.join(", ")} to the deployment environment.` : "";
          throw new Error(`${payload.error || "The upload could not be prepared."}${missing}`);
        }

        setUploadStatus("uploading");
        setUploadMessage("Uploading directly to Cloudflare Stream…");
        const uploadData = new FormData();
        uploadData.append("file", file);

        await new Promise<void>((resolve, reject) => {
          const request = new XMLHttpRequest();
          request.open("POST", payload.uploadURL as string);
          request.upload.onprogress = (progressEvent) => {
            if (progressEvent.lengthComputable) {
              setUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
            }
          };
          request.onload = () => {
            if (request.status >= 200 && request.status < 300) resolve();
            else reject(new Error(`Cloudflare rejected the upload (${request.status}).`));
          };
          request.onerror = () => reject(new Error("The upload was interrupted. Check your connection and try again."));
          request.send(uploadData);
        });
      }

      setUploadProgress(100);
      setUploadStatus("processing");
      setUploadMessage("Upload complete. Cloudflare is encoding the video; it will appear in the library shortly.");
      setSelectedFile(null);
      formElement.reset();
      window.setTimeout(() => void refreshLibrary(), 2500);
    } catch (error) {
      setUploadStatus("error");
      setUploadMessage(error instanceof Error ? error.message : "The video could not be uploaded.");
    }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setUploadStatus("idle");
    setUploadMessage("");
  }

  function dropFile(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setUploadStatus("error");
      setUploadMessage("Drop a video file such as MP4, MOV, or WebM.");
      return;
    }
    setSelectedFile(file);
    setUploadStatus("idle");
    setUploadMessage("");
  }

  function openUploader() {
    setUploadStatus("idle");
    setUploadMessage("");
    setUploadProgress(0);
    setSelectedFile(null);
    setDragActive(false);
    setUploadSource("file");
    setUploadOpen(true);
  }

  async function deleteCourse(course: Course) {
    const confirmed = window.confirm(
      `Permanently delete “${course.title}” from the training library? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(course.id);
    setDeleteNotice(null);
    try {
      if (course.source === "youtube") {
        setYoutubeCourses((current) => {
          const next = current.filter((item) => item.id !== course.id);
          window.localStorage.setItem(youtubeKey, JSON.stringify(next));
          return next;
        });
      } else if (course.source === "stream") {
        const response = await fetch("/api/training/videos", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: course.videoUid }),
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "The training video could not be deleted.");
        }
        await refreshLibrary();
      } else {
        throw new Error("This built-in module cannot be deleted.");
      }

      setCompleted((current) => {
        const next = current.filter((id) => id !== course.id);
        window.localStorage.setItem(progressKey, JSON.stringify(next));
        return next;
      });
      if (activeId === course.id) {
        setActiveId(libraryCourses.find((item) => item.id !== course.id)?.id ?? courses[0].id);
      }
      setDeleteNotice({ message: `“${course.title}” was deleted.`, error: false });
    } catch (error) {
      setDeleteNotice({
        message: error instanceof Error ? error.message : "The training video could not be deleted.",
        error: true,
      });
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="training-shell">
      <aside className="training-sidebar">
        <Link className="training-brand" href="/" aria-label="Vivad SPARK home">
          <img src="/vivad-logo.png" alt="Vivad SPARK — Hoshin, Continuous Improvement" />
        </Link>
        <nav aria-label="Vivad workspace">
          <span>Workspace</span>
          <Link href={navigationItem("strategy").href}><i>{navigationItem("strategy").icon}</i> {navigationItem("strategy").label}</Link>
          <Link href={navigationItem("quality").href}><i>{navigationItem("quality").icon}</i> {navigationItem("quality").label}</Link>
          <Link className="active" href={navigationItem("training").href}><i>{navigationItem("training").icon}</i> {navigationItem("training").label}</Link>
          <Link href={navigationItem("vivadocs").href}><i>{navigationItem("vivadocs").icon}</i> {navigationItem("vivadocs").label}</Link>
        </nav>
        <div className="training-progress-card">
          <div><span>YOUR PROGRESS</span><strong>{completionRate}%</strong></div>
          <div className="training-progress-track"><i style={{ width: `${completionRate}%` }} /></div>
          <small>{completed.filter((id) => libraryCourses.some((course) => course.id === id)).length} of {libraryCourses.length} modules complete</small>
        </div>
      </aside>

      <main className="training-main">
        <header className="training-topbar">
          <MobileWorkspaceNavigation activeItem="training" />
          <div>
            <span className="training-eyebrow">VIVAD LEARNING SYSTEM</span>
            <h1>Training Academy</h1>
            <p>Short, practical learning that connects quality, problem solving, and strategy to the work.</p>
          </div>
          <div className="training-top-actions">
            <button className="training-upload-button" type="button" onClick={openUploader}><span>＋</span> Add new video</button>
            <button className="stream-config-button" type="button" onClick={() => setConfigOpen(true)}>
              <span className={library.connected || config.customerCode ? "connected" : ""} />
              {libraryLoading ? "Checking Stream…" : library.connected ? `${library.videos.length} Stream videos` : config.customerCode ? "Stream connected" : "Configure Stream"}
            </button>
          </div>
        </header>

        <section className="training-feature">
          <div className="training-player">
            {isYoutube ? (
              <iframe
                key={activeCourse.youtubeId}
                src={`https://www.youtube-nocookie.com/embed/${activeCourse.youtubeId}?rel=0`}
                title={activeCourse.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            ) : isConnected ? (
              <iframe
                key={`${streamHost}-${activeUid}-${library.refreshedAt ?? "initial"}`}
                ref={playerRef}
                src={`https://${streamHost}/${activeUid}/iframe?primaryColor=%23478FE1&letterboxColor=%2353565A&preload=metadata`}
                title={activeCourse.title}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                onLoad={connectPlayer}
              />
            ) : (
              <div className="training-player-empty">
                <span className="stream-mark"><i /><i /><i /></span>
                <strong>{isProtected ? "Protected Stream video" : hasDeliveryError ? "Cloudflare could not deliver this video" : !isReady ? "Video is still processing" : "Connect this module to Cloudflare Stream"}</strong>
                <p>{isProtected ? "This video requires a signed playback token. Add user authentication before enabling secure viewing on the public Netlify deployment." : hasDeliveryError ? "The upload was encoded, but Cloudflare is returning a playback error. Try again now; if it continues, upload the original file again." : !isReady ? "Cloudflare is encoding this video. It will become playable here automatically when processing is complete." : "Add your customer subdomain and this video’s UID to start adaptive playback."}</p>
                {hasDeliveryError ? <button type="button" onClick={() => void refreshLibrary()}>Try playback again</button> : !isProtected && isReady && <button type="button" onClick={() => setConfigOpen(true)}>Add Stream video</button>}
              </div>
            )}
          </div>
          <article className="training-feature-copy">
            <div className="training-feature-meta">
              <span className={`training-category ${activeCourse.accent}`}>{activeCourse.category}</span>
              <span>{activeCourse.duration}</span>
              <span>{activeCourse.level}</span>
            </div>
            <h2>{activeCourse.title}</h2>
            <p>{activeCourse.description}</p>
            <div className="training-owner"><span>{activeCourse.owner.slice(0, 2).toUpperCase()}</span><div><small>CONTENT OWNER</small><strong>{activeCourse.owner}</strong></div></div>
            <button className={completed.includes(activeCourse.id) ? "module-complete completed" : "module-complete"} type="button" onClick={() => markComplete(activeCourse.id)}>
              <span>{completed.includes(activeCourse.id) ? "✓" : "○"}</span>
              {completed.includes(activeCourse.id) ? "Completed" : "Mark as complete"}
            </button>
          </article>
        </section>

        <section className="training-library">
          <div className="training-library-head">
            <div><span className="training-eyebrow">LEARNING LIBRARY</span><h2>Build capability, one practice at a time.</h2></div>
            <label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search training" aria-label="Search training" /></label>
          </div>
          <div className="training-topic-filter" role="group" aria-label="Filter training by topic">
            {categories.map((item) => <button className={category === item ? "active" : ""} type="button" key={item} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
          {deleteNotice && (
            <div className={deleteNotice.error ? "training-delete-notice error" : "training-delete-notice"} role={deleteNotice.error ? "alert" : "status"}>
              {deleteNotice.message}
            </div>
          )}
          <div className="training-grid">
            {filteredCourses.map((course, index) => {
              const connected = Boolean(course.youtubeId || (streamHost && (config.videoIds[course.id] || course.videoUid) && course.ready !== false && !course.requiresSignedUrls));
              const done = completed.includes(course.id);
              return (
                <article className={activeId === course.id ? "training-card active" : "training-card"} key={course.id}>
                  <button className={`training-card-visual ${course.accent} ${course.thumbnail ? "has-thumbnail" : ""}`} style={course.thumbnail ? { backgroundImage: `linear-gradient(rgba(26,30,35,.12), rgba(26,30,35,.42)), url(${course.thumbnail})` } : undefined} type="button" onClick={() => { setActiveId(course.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label={`Open ${course.title}`}>
                    <span className="training-card-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="training-play">▶</span>
                    <span className={connected ? "stream-state connected" : "stream-state"}>{course.youtubeId ? "YOUTUBE LINK" : course.requiresSignedUrls ? "SIGNED / LOCKED" : course.ready === false ? "PROCESSING" : connected ? "STREAM READY" : "ADD VIDEO"}</span>
                  </button>
                  <div className="training-card-body">
                    <div><span>{course.category}</span><span>{course.duration}</span></div>
                    <h3>{course.title}</h3>
                    <p>{course.description}</p>
                    <div className="training-card-actions">
                      <button type="button" onClick={() => markComplete(course.id)}><span>{done ? "✓" : "○"}</span>{done ? "Complete" : "Mark complete"}</button>
                      {(course.source === "youtube" || (course.source === "stream" && library.canDelete)) && (
                        <button
                          className="training-delete-video"
                          type="button"
                          disabled={deletingId === course.id}
                          onClick={() => void deleteCourse(course)}
                          aria-label={`Delete ${course.title}`}
                        >
                          {deletingId === course.id ? "Deleting…" : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {!filteredCourses.length && <div className="training-empty"><strong>No training matches your search.</strong><button type="button" onClick={() => { setQuery(""); setCategory("All topics"); }}>Clear filters</button></div>}
        </section>
      </main>

      {configOpen && (
        <div className="stream-modal-backdrop" role="presentation" onMouseDown={() => setConfigOpen(false)}>
          <form className="stream-modal" onSubmit={saveConfiguration} onMouseDown={(event) => event.stopPropagation()}>
            <div className="stream-modal-head"><div><span className="training-eyebrow">CLOUDFLARE STREAM</span><h2>Connect your video library</h2></div><button type="button" onClick={() => setConfigOpen(false)} aria-label="Close configuration">×</button></div>
            <p>Paste the customer code from your Stream dashboard, then add each uploaded video’s UID. These non-secret playback identifiers are stored on this device.</p>
            <label className="stream-customer-field"><span>Customer code</span><input name="customerCode" defaultValue={config.customerCode} placeholder="e.g. f33zs165nr7gyfy4" autoComplete="off" /></label>
            <div className="stream-video-fields">
              {courses.map((course) => <label key={course.id}><span>{course.title}</span><input name={course.id} defaultValue={config.videoIds[course.id] || course.videoUid} placeholder="Cloudflare Stream video UID" autoComplete="off" /></label>)}
            </div>
            <div className="stream-security-note"><span>◎</span><p><strong>Protect internal training.</strong> In Cloudflare Stream, restrict allowed origins to your Vivad site. For stronger access control, enable signed URLs before wider rollout.</p></div>
            <div className="stream-modal-actions"><a href="https://dash.cloudflare.com/?to=/:account/stream/videos" target="_blank" rel="noreferrer">Open Stream dashboard ↗</a><button type="submit">Save connection</button></div>
          </form>
        </div>
      )}

      {uploadOpen && (
        <div className="stream-modal-backdrop" role="presentation" onMouseDown={() => uploadStatus !== "uploading" && setUploadOpen(false)}>
          <form className="stream-modal training-upload-modal" onSubmit={uploadVideo} onMouseDown={(event) => event.stopPropagation()}>
            <div className="stream-modal-head"><div><span className="training-eyebrow">TRAINING VIDEO LIBRARY</span><h2>Add a training video</h2></div><button type="button" disabled={uploadStatus === "uploading"} onClick={() => setUploadOpen(false)} aria-label="Close uploader">×</button></div>
            <div className="training-source-tabs" role="tablist" aria-label="Video source">
              <button className={uploadSource === "file" ? "active" : ""} type="button" role="tab" aria-selected={uploadSource === "file"} onClick={() => { setUploadSource("file"); setUploadStatus("idle"); setUploadMessage(""); }}>↑ Upload a file</button>
              <button className={uploadSource === "youtube" ? "active" : ""} type="button" role="tab" aria-selected={uploadSource === "youtube"} onClick={() => { setUploadSource("youtube"); setUploadStatus("idle"); setUploadMessage(""); }}>▶ Paste from YouTube</button>
            </div>
            <p>{uploadSource === "file" ? "Drag a video here or choose one from your device. It uploads directly to Cloudflare Stream, so Hoshin never handles the file or exposes the API token." : "Paste a YouTube link to add its official embedded player to your learning library. Linked modules are saved on this device."}</p>
            {uploadSource === "file" ? (
              <label
                className={`training-upload-drop ${dragActive ? "dragging" : ""} ${selectedFile ? "selected" : ""}`}
                onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
                onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false); }}
                onDrop={dropFile}
              >
                <input ref={fileInputRef} className="training-file-input" name="video" type="file" accept="video/*" onChange={chooseFile} disabled={uploadStatus === "uploading" || uploadStatus === "preparing"} />
                <span className="training-drop-icon">{selectedFile ? "✓" : "↑"}</span>
                <strong>{selectedFile ? selectedFile.name : dragActive ? "Drop your video here" : "Drag and drop your video"}</strong>
                <small>{selectedFile ? `${fileSize(selectedFile.size)} · Click to choose a different file` : "or click to browse · MP4, MOV, WebM · maximum 1 GB"}</small>
              </label>
            ) : (
              <label className="training-youtube-field"><span>YouTube link</span><div><i>▶</i><input name="youtubeUrl" type="url" placeholder="https://www.youtube.com/watch?v=…" required={uploadSource === "youtube"} autoComplete="off" disabled={uploadStatus === "preparing"} /></div><small>Supports youtube.com, youtu.be, Shorts, and Live links.</small></label>
            )}
            <div className="training-upload-fields">
              <label><span>Title</span><input name="title" placeholder="e.g. How to record a non-conformance" required disabled={uploadStatus === "uploading" || uploadStatus === "preparing"} /></label>
              <label><span>Topic</span><select name="category" defaultValue="Quality" disabled={uploadStatus === "uploading" || uploadStatus === "preparing"}><option>Quality</option><option>Problem solving</option><option>Operations</option><option>Strategy</option><option>Leadership</option><option>Safety</option><option>Training</option></select></label>
              <label className="training-upload-wide"><span>Description</span><textarea name="description" rows={3} placeholder="What will people learn?" disabled={uploadStatus === "uploading" || uploadStatus === "preparing"} /></label>
              <label><span>Level</span><select name="level" defaultValue="Vivad learning" disabled={uploadStatus === "uploading" || uploadStatus === "preparing"}><option>Essential</option><option>Core skill</option><option>Leader practice</option><option>Vivad learning</option></select></label>
              {uploadSource === "file" && <label><span>Maximum duration</span><select name="maxDurationSeconds" defaultValue="3600" disabled={uploadStatus === "uploading" || uploadStatus === "preparing"}><option value="600">10 minutes</option><option value="1800">30 minutes</option><option value="3600">60 minutes</option><option value="7200">2 hours</option></select></label>}
            </div>
            {uploadStatus !== "idle" && <div className={`training-upload-status ${uploadStatus}`}><div><span>{uploadStatus === "processing" ? "✓" : uploadStatus === "error" ? "!" : "↑"}</span><p><strong>{uploadStatus === "preparing" ? "Preparing upload" : uploadStatus === "uploading" ? `Uploading · ${uploadProgress}%` : uploadStatus === "processing" ? uploadSource === "youtube" ? "YouTube module added" : "Processing started" : "Upload needs attention"}</strong><small>{uploadMessage}</small></p></div>{uploadStatus === "uploading" && <div className="training-upload-progress"><i style={{ width: `${uploadProgress}%` }} /></div>}</div>}
            <div className="stream-modal-actions"><small>{uploadSource === "file" ? "Cloudflare Stream direct upload" : "Official YouTube privacy-enhanced embed · saved on this device"}</small><button type="submit" disabled={uploadStatus === "preparing" || uploadStatus === "uploading"}>{uploadStatus === "preparing" ? "Preparing…" : uploadStatus === "uploading" ? `Uploading ${uploadProgress}%` : uploadSource === "youtube" ? uploadStatus === "processing" ? "Add another link" : "Add YouTube video" : uploadStatus === "processing" ? "Upload another" : "Start upload"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
