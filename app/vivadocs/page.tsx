"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  MobileWorkspaceNavigation,
  workspaceNavigationItems,
} from "../components/workspace-navigation";
import { SopWorkflow } from "./sop-workflow";
import { SopPdfActions } from "./sop-pdf-actions";

type Status = "Draft" | "In review" | "Approved" | "Published";
type View =
  | "Dashboard"
  | "SOP library"
  | "Approvals"
  | "Operator mode"
  | "Skills matrix"
  | "Audit log";

type Sop = {
  id: string;
  reference: string;
  title: string;
  description: string;
  category: string;
  location: string;
  owner: string;
  revision: string;
  status: Status;
  nextReview: string;
  steps: Array<{
    title: string;
    instruction: string;
    kind: "Info" | "Confirm" | "Checklist" | "Pass / fail";
    warning?: string;
    imageUrl?: string;
    imageCaption?: string;
  }>;
};

type AuditEvent = {
  id: string;
  action: string;
  detail: string;
  time: string;
  actor: string;
};

type StoredSopSummary = {
  id: string;
  reference: string;
  title: string;
  department: string;
  author: string;
  version: string;
  reviewDate: string;
  status: string;
  stepCount: number;
};

type StoredSopDetail = StoredSopSummary & {
  steps: Array<{
    position: number;
    instruction: string;
    existingImageUrl?: string | null;
    imageCaption?: string;
  }>;
};

const STORAGE_KEY = "vivadocs-demo-state-v1";
const REMOVED_DEMO_REFERENCES = new Set([
  "OPS-014",
  "WHS-008",
  "QLT-021",
  "CUS-005",
]);

const seedSops: Sop[] = [];

const seedAudit: AuditEvent[] = [];

const activeSeedSops = seedSops.filter(
  (sop) => !REMOVED_DEMO_REFERENCES.has(sop.reference),
);
const activeSeedAudit = seedAudit.filter(
  (event) =>
    !Array.from(REMOVED_DEMO_REFERENCES).some((reference) =>
      event.detail.includes(reference),
    ),
);

const skills = [
  {
    person: "Jordan Lee",
    initials: "JL",
    role: "Line operator",
    values: ["Competent", "In training", "Competent", "Missing"],
  },
  {
    person: "Amelia Ross",
    initials: "AR",
    role: "Team leader",
    values: ["Trainer", "Competent", "Competent", "Competent"],
  },
  {
    person: "Kai Morgan",
    initials: "KM",
    role: "Warehouse",
    values: ["In training", "Competent", "Missing", "Expired"],
  },
  {
    person: "Priya Shah",
    initials: "PS",
    role: "Quality tech",
    values: ["Competent", "Missing", "Trainer", "Competent"],
  },
];

function statusTone(status: Status) {
  return status.toLowerCase().replace(" ", "-");
}

function nowLabel() {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

export default function VivaDocsPage() {
  const [view, setView] = useState<View>("Dashboard");
  const [sops, setSops] = useState<Sop[]>(activeSeedSops);
  const [audit, setAudit] = useState<AuditEvent[]>(activeSeedAudit);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [selectedId, setSelectedId] = useState(activeSeedSops[0]?.id ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [runId, setRunId] = useState(activeSeedSops[0]?.id ?? "");
  const [runStep, setRunStep] = useState(0);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [completionMessage, setCompletionMessage] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { audit?: AuditEvent[] };
        const storedAudit = (parsed.audit ?? []).filter(
          (event) =>
            !Array.from(REMOVED_DEMO_REFERENCES).some((reference) =>
              event.detail.includes(reference),
            ),
        );
        // Restore device-local activity while database SOPs remain the source of truth.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (storedAudit.length) setAudit(storedAudit);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    void syncStoredSops();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ audit }));
  }, [audit]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("sop")) return;
    const timeout = window.setTimeout(() => setCreateOpen(true), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const filtered = useMemo(
    () =>
      sops.filter((sop) => {
        const haystack =
          `${sop.title} ${sop.reference} ${sop.category} ${sop.owner}`.toLowerCase();
        return (
          haystack.includes(query.toLowerCase()) &&
          (status === "All statuses" || sop.status === status)
        );
      }),
    [query, sops, status],
  );

  const selected = sops.find((sop) => sop.id === selectedId) ?? sops[0];
  const running = sops.find((sop) => sop.id === runId) ?? sops[0];
  const published = sops.filter((sop) => sop.status === "Published");
  const approvalQueue = sops.filter(
    (sop) => sop.status === "In review" || sop.status === "Approved",
  );

  async function syncStoredSops() {
    try {
      const response = await fetch("/api/vivadocs/sops", { cache: "no-store" });
      if (!response.ok) return;
      const summaries = ((await response.json()).sops ??
        []) as StoredSopSummary[];
      const details = await Promise.all(
        summaries.map(async (summary) => {
          const detailResponse = await fetch(
            `/api/vivadocs/sops/${encodeURIComponent(summary.id)}`,
            { cache: "no-store" },
          );
          if (!detailResponse.ok) return null;
          return (await detailResponse.json()).sop as StoredSopDetail;
        }),
      );
      const stored = details
        .filter((item): item is StoredSopDetail => Boolean(item))
        .map((item): Sop => ({
          id: item.id,
          reference: item.reference,
          title: item.title,
          description: `Controlled ${item.department} standard operating procedure.`,
          category: item.department,
          location: item.department,
          owner: item.author,
          revision: item.version,
          status: (["Draft", "In review", "Approved", "Published"].includes(
            item.status,
          )
            ? item.status
            : "Published") as Status,
          nextReview: item.reviewDate || "Not scheduled",
          steps: item.steps.map((step) => ({
            title: `Step ${step.position}`,
            instruction: step.instruction,
            kind: "Info",
            imageUrl: step.existingImageUrl || undefined,
            imageCaption: step.imageCaption || undefined,
          })),
        }));
      setSops(stored);
      setSelectedId((current) =>
        stored.some((item) => item.id === current)
          ? current
          : stored[0]?.id ?? "",
      );
      const firstPublished = stored.find((item) => item.status === "Published");
      setRunId((current) =>
        stored.some(
          (item) => item.id === current && item.status === "Published",
        )
          ? current
          : firstPublished?.id ?? "",
      );
      setRunStep(0);
    } catch {
      // Keep the last loaded database state if hosted storage is temporarily unavailable.
    }
  }

  function record(action: string, detail: string) {
    setAudit((current) => [
      {
        id: crypto.randomUUID(),
        action,
        detail,
        time: `Today, ${nowLabel()}`,
        actor: "Rubin Sekuleski",
      },
      ...current,
    ]);
  }

  function transition(id: string, next: Status) {
    const sop = sops.find((item) => item.id === id);
    if (!sop) return;
    setSops((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: next } : item,
      ),
    );
    const action =
      next === "In review"
        ? "Approval requested"
        : next === "Approved"
          ? "Revision approved"
          : "SOP published";
    record(action, `${sop.reference} revision ${sop.revision}`);
    setToast(`${sop.reference} is now ${next.toLowerCase()}.`);
  }

  function startRun(id: string) {
    setRunId(id);
    setRunStep(0);
    setResponses({});
    setCompletionMessage("");
    setView("Operator mode");
  }

  function completeRun() {
    if (!running) return;
    const complete = running.steps.every((_, index) => responses[index]);
    if (!complete) {
      setCompletionMessage("Complete each step before submitting this run.");
      return;
    }
    record("Procedure completed", `${running.reference} · ${running.title}`);
    setCompletionMessage(
      `Completed successfully at ${nowLabel()} by Rubin Sekuleski.`,
    );
    setToast("Procedure completion recorded.");
    setView("SOP library");
  }

  return (
    <div className="vivadocs-shell">
      <aside className="vivadocs-sidebar">
        <Link className="vivadocs-brand" href="/" aria-label="Vivad SPARK home">
          <img
            src="/vivad-logo.png"
            alt="Vivad SPARK — Hoshin, Continuous Improvement"
          />
        </Link>
        <nav aria-label="Workspace navigation">
          <span>Workspace</span>
          {workspaceNavigationItems
            .filter((item) => item.group === "Workspace")
            .map((item) => (
              <Link
                className={item.id === "vivadocs" ? "active" : ""}
                href={item.href}
                key={item.id}
              >
                <i>{item.icon}</i>
                {item.label}
                {item.count && <b>{item.count}</b>}
              </Link>
            ))}
          <span className="vivadocs-manage-label">Manage</span>
          {workspaceNavigationItems
            .filter((item) => item.group === "Manage")
            .map((item) => (
              <Link href={item.href} key={item.id}>
                <i>{item.icon}</i>
                {item.label}
              </Link>
            ))}
        </nav>
        <div className="vivadocs-profile">
          <span>RS</span>
          <div>
            <strong>Rubin Sekuleski</strong>
            <small>Owner · Vivad</small>
          </div>
          <b>•••</b>
        </div>
      </aside>

      <main className="vivadocs-main">
        <header className="vivadocs-topbar">
          <MobileWorkspaceNavigation activeItem="vivadocs" />
          <div>
            <span className="vivadocs-eyebrow">
              CONTROLLED WORK INSTRUCTIONS
            </span>
            <h1>VivaDocs</h1>
            <p>
              Build, approve and complete visual procedures with confidence.
            </p>
          </div>
          <div className="vivadocs-top-actions">
            <button
              className="vivadocs-icon-button"
              type="button"
              aria-label="Notifications"
            >
              ♢<i />
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={() => setCreateOpen(true)}
            >
              ＋ New SOP
            </button>
          </div>
        </header>

        <div
          className="vivadocs-viewbar"
          role="navigation"
          aria-label="VivaDocs sections"
        >
          {(
            [
              "Dashboard",
              "SOP library",
              "Approvals",
              "Operator mode",
              "Skills matrix",
              "Audit log",
            ] as View[]
          ).map((item) => (
            <button
              className={view === item ? "active" : ""}
              type="button"
              onClick={() => setView(item)}
              key={item}
            >
              {item}
              {item === "Approvals" && approvalQueue.length > 0 && (
                <span>{approvalQueue.length}</span>
              )}
            </button>
          ))}
        </div>

        {view === "Dashboard" && (
          <section className="vivadocs-dashboard">
            <div className="vivadocs-welcome">
              <div>
                <span>GOOD MORNING, RUBIN</span>
                <h2>Standard work, made visible.</h2>
                <p>
                  Keep every team aligned to the latest approved way of working.
                </p>
              </div>
              <button type="button" onClick={() => setView("SOP library")}>
                Explore SOP library <b>→</b>
              </button>
            </div>
            <div className="vivadocs-metrics">
              <article>
                <i className="blue">▤</i>
                <div>
                  <strong>{sops.length}</strong>
                  <span>Total SOPs</span>
                  <small>{published.length} currently published</small>
                </div>
              </article>
              <article>
                <i className="amber">◷</i>
                <div>
                  <strong>
                    {sops.filter((sop) => sop.status === "In review").length}
                  </strong>
                  <span>Awaiting approval</span>
                  <small>Decision required</small>
                </div>
              </article>
              <article>
                <i className="green">✓</i>
                <div>
                  <strong>18</strong>
                  <span>Completions</span>
                  <small>96% pass rate this month</small>
                </div>
              </article>
              <article>
                <i className="red">△</i>
                <div>
                  <strong>3</strong>
                  <span>Training gaps</span>
                  <small>Across 2 active teams</small>
                </div>
              </article>
            </div>
            <div className="vivadocs-dashboard-grid">
              <article className="vivadocs-panel">
                <div className="vivadocs-panel-head">
                  <div>
                    <span>SOP HEALTH</span>
                    <h3>Documents by status</h3>
                  </div>
                  <button type="button" onClick={() => setView("SOP library")}>
                    View all →
                  </button>
                </div>
                <div className="status-bars">
                  {(
                    ["Published", "In review", "Approved", "Draft"] as Status[]
                  ).map((item) => {
                    const count = sops.filter(
                      (sop) => sop.status === item,
                    ).length;
                    return (
                      <div key={item}>
                        <span>{item}</span>
                        <div>
                          <i
                            className={statusTone(item)}
                            style={{
                              width: `${Math.max(14, (count / Math.max(1, sops.length)) * 100)}%`,
                            }}
                          />
                        </div>
                        <strong>{count}</strong>
                      </div>
                    );
                  })}
                </div>
              </article>
              <article className="vivadocs-panel">
                <div className="vivadocs-panel-head">
                  <div>
                    <span>ACTION REQUIRED</span>
                    <h3>Approval queue</h3>
                  </div>
                  <button type="button" onClick={() => setView("Approvals")}>
                    Review all →
                  </button>
                </div>
                <div className="mini-queue">
                  {approvalQueue.slice(0, 3).map((sop) => (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(sop.id);
                        setView("Approvals");
                      }}
                      key={sop.id}
                    >
                      <i>{sop.category.slice(0, 1)}</i>
                      <span>
                        <strong>{sop.title}</strong>
                        <small>
                          {sop.reference} · Rev {sop.revision}
                        </small>
                      </span>
                      <b
                        className={`vivadocs-status ${statusTone(sop.status)}`}
                      >
                        {sop.status}
                      </b>
                    </button>
                  ))}
                </div>
              </article>
              <article className="vivadocs-panel vivadocs-activity">
                <div className="vivadocs-panel-head">
                  <div>
                    <span>TRACEABILITY</span>
                    <h3>Recent activity</h3>
                  </div>
                  <button type="button" onClick={() => setView("Audit log")}>
                    Audit log →
                  </button>
                </div>
                {audit.slice(0, 4).map((event) => (
                  <div className="activity-row" key={event.id}>
                    <i />
                    <span>
                      <strong>{event.action}</strong>
                      <small>
                        {event.detail} · {event.actor}
                      </small>
                    </span>
                    <time>{event.time}</time>
                  </div>
                ))}
              </article>
            </div>
          </section>
        )}

        {view === "SOP library" && (
          <section className="vivadocs-section">
            <div className="vivadocs-section-head">
              <div>
                <span>CONTROLLED DOCUMENTS</span>
                <h2>SOP library</h2>
                <p>{filtered.length} procedures shown</p>
              </div>
              <button
                className="button button-primary"
                type="button"
                onClick={() => setCreateOpen(true)}
              >
                ＋ Create SOP
              </button>
            </div>
            <div className="vivadocs-filters">
              <label>
                <span>⌕</span>
                <input
                  aria-label="Search SOPs"
                  placeholder="Search title, reference, owner or category"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <select
                aria-label="Filter by status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option>All statuses</option>
                <option>Draft</option>
                <option>In review</option>
                <option>Approved</option>
                <option>Published</option>
              </select>
            </div>
            <div className="vivadocs-library-layout">
              <div className="vivadocs-table">
                <div className="vivadocs-table-head">
                  <span>Procedure</span>
                  <span>Owner / location</span>
                  <span>Revision</span>
                  <span>Status</span>
                  <span />
                </div>
                {filtered.map((sop) => (
                  <button
                    className={selected?.id === sop.id ? "selected" : ""}
                    type="button"
                    onClick={() => setSelectedId(sop.id)}
                    key={sop.id}
                  >
                    <span className="sop-title">
                      <i>{sop.category.slice(0, 1)}</i>
                      <span>
                        <strong>{sop.title}</strong>
                        <small>
                          {sop.reference} · {sop.category}
                        </small>
                      </span>
                    </span>
                    <span>
                      <strong>{sop.owner}</strong>
                      <small>{sop.location}</small>
                    </span>
                    <span>
                      <strong>Rev {sop.revision}</strong>
                      <small>Review {sop.nextReview}</small>
                    </span>
                    <b className={`vivadocs-status ${statusTone(sop.status)}`}>
                      {sop.status}
                    </b>
                    <em>›</em>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="vivadocs-empty">
                    <strong>No SOPs found</strong>
                    <span>Try changing your search or status filter.</span>
                  </div>
                )}
              </div>
              {selected && (
                <aside className="sop-inspector">
                  <div className="sop-inspector-top">
                    <i>{selected.category.slice(0, 1)}</i>
                    <b
                      className={`vivadocs-status ${statusTone(selected.status)}`}
                    >
                      {selected.status}
                    </b>
                  </div>
                  <span>
                    {selected.reference} · REV {selected.revision}
                  </span>
                  <h3>{selected.title}</h3>
                  <p>{selected.description}</p>
                  <dl>
                    <div>
                      <dt>Owner</dt>
                      <dd>{selected.owner}</dd>
                    </div>
                    <div>
                      <dt>Location</dt>
                      <dd>{selected.location}</dd>
                    </div>
                    <div>
                      <dt>Steps</dt>
                      <dd>{selected.steps.length}</dd>
                    </div>
                    <div>
                      <dt>Next review</dt>
                      <dd>{selected.nextReview}</dd>
                    </div>
                  </dl>
                  <div className="sop-action-stack">
                    {selected.status === "Draft" && (
                      <button
                        type="button"
                        onClick={() => transition(selected.id, "In review")}
                      >
                        Submit for approval <b>→</b>
                      </button>
                    )}
                    {selected.status === "In review" && (
                      <button
                        type="button"
                        onClick={() => transition(selected.id, "Approved")}
                      >
                        Approve revision <b>✓</b>
                      </button>
                    )}
                    {selected.status === "Approved" && (
                      <button
                        type="button"
                        onClick={() => transition(selected.id, "Published")}
                      >
                        Publish revision <b>↑</b>
                      </button>
                    )}
                    {selected.status === "Published" && (
                      <button
                        type="button"
                        onClick={() => startRun(selected.id)}
                      >
                        Run this SOP <b>▷</b>
                      </button>
                    )}
                    <SopPdfActions sop={selected} compact />
                    <button
                      className="secondary"
                      type="button"
                      onClick={() =>
                        setToast("Revision history opened for review.")
                      }
                    >
                      Revision history
                    </button>
                  </div>
                </aside>
              )}
            </div>
          </section>
        )}

        {view === "Approvals" && (
          <section className="vivadocs-section">
            <div className="vivadocs-section-head">
              <div>
                <span>DOCUMENT CONTROL</span>
                <h2>Approval queue</h2>
                <p>Review controlled revisions before release.</p>
              </div>
            </div>
            <div className="approval-list">
              {approvalQueue.map((sop) => (
                <article key={sop.id}>
                  <div className="approval-main">
                    <div className="approval-doc-icon">▤</div>
                    <div>
                      <span>
                        {sop.reference} · REV {sop.revision}
                      </span>
                      <h3>{sop.title}</h3>
                      <p>{sop.description}</p>
                      <small>
                        Submitted by {sop.owner} · {sop.steps.length} procedure
                        steps
                      </small>
                    </div>
                  </div>
                  <div className="approval-actions">
                    <b className={`vivadocs-status ${statusTone(sop.status)}`}>
                      {sop.status}
                    </b>
                    {sop.status === "In review" ? (
                      <>
                        <button
                          className="reject"
                          type="button"
                          onClick={() => transition(sop.id, "Draft")}
                        >
                          Return to author
                        </button>
                        <button
                          type="button"
                          onClick={() => transition(sop.id, "Approved")}
                        >
                          Approve revision
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => transition(sop.id, "Published")}
                      >
                        Publish revision
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {approvalQueue.length === 0 && (
                <div className="vivadocs-empty tall">
                  <strong>Approval queue is clear</strong>
                  <span>New submissions will appear here.</span>
                </div>
              )}
            </div>
          </section>
        )}

        {view === "Operator mode" && (
          <section className="operator-shell">
            <div className="operator-picker">
              <div>
                <span>OPERATOR MODE</span>
                <h2>Follow a published procedure</h2>
              </div>
              <select
                value={runId}
                onChange={(event) => startRun(event.target.value)}
              >
                {published.map((sop) => (
                  <option value={sop.id} key={sop.id}>
                    {sop.reference} · {sop.title}
                  </option>
                ))}
              </select>
            </div>
            {running ? (
              <article className="operator-player">
              <div className="operator-progress">
                <span>
                  Step {runStep + 1} of {running.steps.length}
                </span>
                <div>
                  {running.steps.map((_, index) => (
                    <i
                      className={index <= runStep ? "complete" : ""}
                      key={index}
                    />
                  ))}
                </div>
                <strong>
                  {Math.round(((runStep + 1) / running.steps.length) * 100)}%
                </strong>
              </div>
              <div className="operator-card">
                <div className={`operator-visual ${running.steps[runStep].imageUrl ? "has-image" : ""}`}>
                  {running.steps[runStep].imageUrl ? (
                    <figure>
                      <img
                        src={running.steps[runStep].imageUrl}
                        alt={running.steps[runStep].imageCaption || `Visual instruction for Step ${runStep + 1}`}
                      />
                      {running.steps[runStep].imageCaption && <figcaption>{running.steps[runStep].imageCaption}</figcaption>}
                    </figure>
                  ) : (
                    <>
                      <span>{String(runStep + 1).padStart(2, "0")}</span>
                      <i>▤</i>
                      <small>VISUAL WORK INSTRUCTION</small>
                    </>
                  )}
                </div>
                <div className="operator-copy">
                  <span>
                    {running.reference} · REV {running.revision}
                  </span>
                  <h2>{running.steps[runStep].title}</h2>
                  <p>{running.steps[runStep].instruction}</p>
                  {running.steps[runStep].warning && (
                    <div className="operator-warning">
                      <b>!</b>
                      <span>
                        <strong>Safety acknowledgement required</strong>
                        <small>{running.steps[runStep].warning}</small>
                      </span>
                    </div>
                  )}
                  <label className="operator-confirm">
                    <input
                      type="checkbox"
                      checked={Boolean(responses[runStep])}
                      onChange={(event) =>
                        setResponses((current) => ({
                          ...current,
                          [runStep]: event.target.checked ? "Confirmed" : "",
                        }))
                      }
                    />
                    <span>
                      {running.steps[runStep].kind === "Pass / fail"
                        ? "This check passed"
                        : "I have completed and understood this step"}
                    </span>
                  </label>
                </div>
              </div>
              <div className="operator-controls">
                <button
                  type="button"
                  disabled={runStep === 0}
                  onClick={() =>
                    setRunStep((current) => Math.max(0, current - 1))
                  }
                >
                  ← Previous
                </button>
                <span>Progress is saved on this device</span>
                {runStep < running.steps.length - 1 ? (
                  <button
                    className="next"
                    type="button"
                    disabled={!responses[runStep]}
                    onClick={() => setRunStep((current) => current + 1)}
                  >
                    Next step →
                  </button>
                ) : (
                  <button
                    className="complete"
                    type="button"
                    onClick={completeRun}
                  >
                    Submit completion ✓
                  </button>
                )}
              </div>
              {completionMessage && (
                <div
                  className={
                    completionMessage.startsWith("Complete each")
                      ? "operator-message error"
                      : "operator-message"
                  }
                >
                  {completionMessage}
                </div>
              )}
              </article>
            ) : (
              <div className="vivadocs-empty tall">
                <strong>No published SOPs available</strong>
                <span>Create and publish an SOP before starting operator mode.</span>
              </div>
            )}
          </section>
        )}

        {view === "Skills matrix" && (
          <section className="vivadocs-section">
            <div className="vivadocs-section-head">
              <div>
                <span>CAPABILITY</span>
                <h2>Skills matrix</h2>
                <p>Competency against required published procedures.</p>
              </div>
              <div className="skills-legend">
                <span className="competent">● Competent</span>
                <span className="training">● In training</span>
                <span className="gap">● Gap</span>
              </div>
            </div>
            <div className="skills-table">
              <div className="skills-head">
                <span>Team member</span>
                {sops.map((sop) => (
                  <span key={sop.id}>
                    {sop.reference}
                    <small>{sop.title}</small>
                  </span>
                ))}
              </div>
              {skills.map((person) => (
                <div className="skills-row" key={person.person}>
                  <span className="skills-person">
                    <i>{person.initials}</i>
                    <span>
                      <strong>{person.person}</strong>
                      <small>{person.role}</small>
                    </span>
                  </span>
                  {sops.map((sop, index) => {
                    const value = person.values[index] ?? "Missing";
                    return (
                      <button
                        className={value.toLowerCase().replace(" ", "-")}
                        type="button"
                        onClick={() =>
                          setToast(
                            `${person.person}: ${value} for ${sop.reference}`,
                          )
                        }
                        key={sop.id}
                      >
                        <i>
                          {value === "Trainer"
                            ? "★"
                            : value === "Competent"
                              ? "✓"
                              : value === "In training"
                                ? "◷"
                                : "!"}
                        </i>
                        <span>{value}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        )}

        {view === "Audit log" && (
          <section className="vivadocs-section">
            <div className="vivadocs-section-head">
              <div>
                <span>APPEND-ONLY RECORD</span>
                <h2>Audit log</h2>
                <p>Important document-control and completion events.</p>
              </div>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => setToast("Audit log exported as CSV.")}
              >
                ↓ Export log
              </button>
            </div>
            <div className="audit-table">
              <div>
                <span>Event</span>
                <span>Record</span>
                <span>Actor</span>
                <span>Time</span>
              </div>
              {audit.map((event) => (
                <div key={event.id}>
                  <span>
                    <i />
                    {event.action}
                  </span>
                  <strong>{event.detail}</strong>
                  <span>{event.actor}</span>
                  <time>{event.time}</time>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {createOpen && (
        <SopWorkflow
          onSaved={syncStoredSops}
          onClose={() => {
            setCreateOpen(false);
            void syncStoredSops();
          }}
        />
      )}
      {toast && (
        <div className="vivadocs-toast" role="status">
          <i>✓</i>
          {toast}
        </div>
      )}
    </div>
  );
}
