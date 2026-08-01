"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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

export default function TrainingPage() {
  const [activeId, setActiveId] = useState(courses[0].id);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All topics");
  const [completed, setCompleted] = useState<string[]>([]);
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState<StreamConfig>({
    customerCode: process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE ?? "",
    videoIds: Object.fromEntries(courses.map((course) => [course.id, course.videoUid])),
  });
  const playerRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const savedConfig = window.localStorage.getItem(configKey);
    const savedProgress = window.localStorage.getItem(progressKey);
    if (savedConfig) {
      try {
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

    if (!document.querySelector('script[data-cloudflare-stream="true"]')) {
      const script = document.createElement("script");
      script.src = "https://embed.cloudflarestream.com/embed/sdk.latest.js";
      script.async = true;
      script.dataset.cloudflareStream = "true";
      document.head.appendChild(script);
    }
  }, []);

  const categories = useMemo(
    () => ["All topics", ...Array.from(new Set(courses.map((course) => course.category)))],
    [],
  );

  const filteredCourses = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesCategory = category === "All topics" || course.category === category;
      const matchesQuery =
        !needle ||
        [course.title, course.description, course.category, course.owner]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const activeCourse = courses.find((course) => course.id === activeId) ?? courses[0];
  const activeUid = config.videoIds[activeCourse.id] || activeCourse.videoUid;
  const isConnected = Boolean(config.customerCode.trim() && activeUid?.trim());
  const completionRate = Math.round((completed.length / courses.length) * 100);

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

  return (
    <div className="training-shell">
      <aside className="training-sidebar">
        <Link className="training-brand" href="/" aria-label="Vivad home">
          <img src="/vivad-logo.png" alt="Vivad" />
        </Link>
        <nav aria-label="Vivad workspace">
          <span>Workspace</span>
          <Link href="/strategy"><i>◎</i> Strategy</Link>
          <Link href="/quality"><i>◇</i> Quality events</Link>
          <Link className="active" href="/training"><i>▷</i> Training academy</Link>
        </nav>
        <div className="training-progress-card">
          <div><span>YOUR PROGRESS</span><strong>{completionRate}%</strong></div>
          <div className="training-progress-track"><i style={{ width: `${completionRate}%` }} /></div>
          <small>{completed.length} of {courses.length} modules complete</small>
        </div>
      </aside>

      <main className="training-main">
        <header className="training-topbar">
          <div>
            <span className="training-eyebrow">VIVAD LEARNING SYSTEM</span>
            <h1>Training Academy</h1>
            <p>Short, practical learning that connects quality, problem solving, and strategy to the work.</p>
          </div>
          <button className="stream-config-button" type="button" onClick={() => setConfigOpen(true)}>
            <span className={config.customerCode ? "connected" : ""} />
            {config.customerCode ? "Stream connected" : "Configure Stream"}
          </button>
        </header>

        <section className="training-feature">
          <div className="training-player">
            {isConnected ? (
              <iframe
                key={`${config.customerCode}-${activeUid}`}
                ref={playerRef}
                src={`https://customer-${config.customerCode}.cloudflarestream.com/${activeUid}/iframe?primaryColor=%23478FE1&letterboxColor=%2353565A&preload=metadata`}
                title={activeCourse.title}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                onLoad={connectPlayer}
              />
            ) : (
              <div className="training-player-empty">
                <span className="stream-mark"><i /><i /><i /></span>
                <strong>Connect this module to Cloudflare Stream</strong>
                <p>Add your customer code and this video’s UID to start adaptive, secure playback.</p>
                <button type="button" onClick={() => setConfigOpen(true)}>Add Stream video</button>
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
          <div className="training-grid">
            {filteredCourses.map((course, index) => {
              const connected = Boolean(config.customerCode && (config.videoIds[course.id] || course.videoUid));
              const done = completed.includes(course.id);
              return (
                <article className={activeId === course.id ? "training-card active" : "training-card"} key={course.id}>
                  <button className={`training-card-visual ${course.accent}`} type="button" onClick={() => { setActiveId(course.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label={`Open ${course.title}`}>
                    <span className="training-card-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="training-play">▶</span>
                    <span className={connected ? "stream-state connected" : "stream-state"}>{connected ? "STREAM READY" : "ADD VIDEO"}</span>
                  </button>
                  <div className="training-card-body">
                    <div><span>{course.category}</span><span>{course.duration}</span></div>
                    <h3>{course.title}</h3>
                    <p>{course.description}</p>
                    <button type="button" onClick={() => markComplete(course.id)}><span>{done ? "✓" : "○"}</span>{done ? "Complete" : "Mark complete"}</button>
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
    </div>
  );
}
