"use client";

// Interactive strategy workspace.
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type View = "Overview" | "X-matrix" | "Initiatives" | "Reviews";

type Initiative = {
  title: string;
  owner: string;
  progress: number;
  status: "On track" | "At risk";
  due: string;
};

const objectives = [
  {
    code: "O1",
    title: "Become the easiest partner to do business with",
    owner: "Customer",
    progress: 78,
    tone: "blue",
  },
  {
    code: "O2",
    title: "Build a predictable, scalable delivery engine",
    owner: "Operations",
    progress: 64,
    tone: "red",
  },
  {
    code: "O3",
    title: "Create a high-trust, high-performance culture",
    owner: "People",
    progress: 71,
    tone: "green",
  },
];

const keyResults = [
  { metric: "Customer effort score", target: "≤ 2.0", actual: "2.3", trend: "↓ 0.4", status: "At risk" },
  { metric: "On-time delivery", target: "96%", actual: "94.8%", trend: "↑ 1.8%", status: "Watch" },
  { metric: "First-time-right quality", target: "98%", actual: "98.6%", trend: "↑ 0.7%", status: "On track" },
  { metric: "Team engagement", target: "82", actual: "84", trend: "↑ 3", status: "On track" },
];

const matrixRows = [
  { label: "Effortless customer experience", values: [3, 2, 0, 1] },
  { label: "Reliable delivery system", values: [1, 3, 3, 2] },
  { label: "Empowered frontline teams", values: [2, 1, 2, 3] },
];

export default function Home() {
  const [view, setView] = useState<View>("Overview");
  const [modalOpen, setModalOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("All");
  const [initiatives, setInitiatives] = useState<Initiative[]>([
    { title: "One-click order status", owner: "Maya Chen", progress: 82, status: "On track", due: "18 Sep" },
    { title: "Daily flow management", owner: "Liam Ward", progress: 61, status: "At risk", due: "30 Sep" },
    { title: "Leader standard work", owner: "Noah Singh", progress: 74, status: "On track", due: "12 Oct" },
    { title: "Skills matrix rollout", owner: "Ava Brooks", progress: 47, status: "On track", due: "28 Oct" },
  ]);

  const visibleInitiatives = useMemo(
    () => initiatives.filter((item) => filter === "All" || item.status === filter),
    [filter, initiatives],
  );

  function addInitiative(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    const owner = String(data.get("owner") || "").trim();
    if (!title || !owner) return;

    setInitiatives((current) => [
      ...current,
      { title, owner, progress: 0, status: "On track", due: "30 Nov" },
    ]);
    setModalOpen(false);
    setView("Initiatives");
    setNotice(`Initiative added — ${title}`);
    window.setTimeout(() => setNotice(""), 3200);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Vivad SPARK strategy workspace">
          <img className="vivad-logo strategy-vivad-logo" src="/vivad-logo.png" alt="Vivad SPARK — Hoshin, Continuous Improvement" />
        </a>

        <nav className="side-nav" aria-label="Workspace navigation">
          <p className="nav-label">Workspace</p>
          <button className="nav-item active" type="button">
            <span className="nav-icon">◫</span> Strategy
          </button>
          <Link className="nav-item" href="/quality">
            <span className="nav-icon">◇</span> Quality events
          </Link>
          <Link className="nav-item" href="/training">
            <span className="nav-icon">▷</span> Training academy
          </Link>
          <button className="nav-item" type="button">
            <span className="nav-icon">◎</span> Scorecards
          </button>
          <button className="nav-item" type="button">
            <span className="nav-icon">↗</span> Initiatives
            <span className="nav-count">4</span>
          </button>
          <button className="nav-item" type="button">
            <span className="nav-icon">◷</span> Reviews
          </button>
          <Link className="nav-item" href="/vivadocs">
            <span className="nav-icon">▤</span> VivaDocs
          </Link>
          <p className="nav-label nav-label-spaced">Manage</p>
          <button className="nav-item" type="button">
            <span className="nav-icon">♙</span> People
          </button>
          <button className="nav-item" type="button">
            <span className="nav-icon">⚙</span> Settings
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="help-card">
            <span className="help-dot">?</span>
            <div>
              <strong>Need a hand?</strong>
              <small>Open the planning guide</small>
            </div>
          </div>
          <div className="profile">
            <span className="avatar">ED</span>
            <div>
              <strong>Ewen Donaldson</strong>
              <small>Strategy lead</small>
            </div>
            <span className="more">•••</span>
          </div>
        </div>
      </aside>

      <main className="main" id="top">
        <header className="topbar">
          <div>
            <span className="eyebrow">FY2026 CORPORATE PLAN</span>
            <h1>Strategy deployment</h1>
          </div>
          <div className="top-actions">
            <button className="icon-button" type="button" aria-label="Open notifications">
              <span>♢</span><i />
            </button>
            <button className="button button-secondary" type="button" onClick={() => setReviewOpen(true)}>
              Run monthly review
            </button>
            <button className="button button-primary" type="button" onClick={() => setModalOpen(true)}>
              <span>＋</span> Add initiative
            </button>
          </div>
        </header>

        <div className="workspace-bar">
          <div className="tabs" role="tablist" aria-label="Strategy views">
            {(["Overview", "X-matrix", "Initiatives", "Reviews"] as View[]).map((tab) => (
              <button
                className={view === tab ? "tab active" : "tab"}
                type="button"
                role="tab"
                aria-selected={view === tab}
                key={tab}
                onClick={() => setView(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <label className="period-control">
            <span>Planning period</span>
            <select defaultValue="FY2026" aria-label="Planning period">
              <option>FY2026</option>
              <option>FY2025</option>
            </select>
          </label>
        </div>

        {view === "Overview" && (
          <section className="dashboard" aria-label="Strategy overview">
            <article className="card north-star">
              <div className="card-heading">
                <div>
                  <span className="section-kicker true-north-label">
                    <span className="north-compass" aria-hidden="true">
                      <i />
                    </span>
                    True north
                  </span>
                  <h2>Make progress visible.<br />Make action inevitable.</h2>
                </div>
                <div className="confidence">
                  <div className="score-ring"><span>72</span><small>%</small></div>
                  <div><strong>Plan confidence</strong><small>Up 6% this quarter</small></div>
                </div>
              </div>
              <p className="north-copy">
                We turn strategy into a small set of measurable priorities, connect every initiative
                to an outcome, and review progress before problems become surprises.
              </p>
              <div className="objective-grid">
                {objectives.map((objective) => (
                  <article className={`objective ${objective.tone}`} key={objective.code}>
                    <div className="objective-top">
                      <span className="objective-code">{objective.code}</span>
                      <span className="status-pill neutral">{objective.owner}</span>
                    </div>
                    <h3>{objective.title}</h3>
                    <div className="progress-meta"><span>Progress</span><strong>{objective.progress}%</strong></div>
                    <div className="progress-track"><i style={{ width: `${objective.progress}%` }} /></div>
                  </article>
                ))}
              </div>
            </article>

            <aside className="card review-card">
              <div className="card-title-row">
                <div>
                  <span className="section-kicker">Next review</span>
                  <h2>September pulse</h2>
                </div>
                <span className="date-badge"><strong>16</strong><small>SEP</small></span>
              </div>
              <div className="review-progress">
                <div><span>Agenda readiness</span><strong>75%</strong></div>
                <div className="progress-track green"><i style={{ width: "75%" }} /></div>
              </div>
              <ul className="check-list">
                <li className="done"><span>✓</span><div><strong>Metrics updated</strong><small>18 of 18 owners</small></div></li>
                <li className="done"><span>✓</span><div><strong>Countermeasures reviewed</strong><small>6 items closed</small></div></li>
                <li><span>!</span><div><strong>2 decisions required</strong><small>Operations and Customer</small></div></li>
              </ul>
              <button className="text-link" type="button" onClick={() => setReviewOpen(true)}>
                View review brief <span>→</span>
              </button>
            </aside>

            <article className="card results-card">
              <div className="card-title-row">
                <div>
                  <span className="section-kicker">Outcome measures</span>
                  <h2>Key results</h2>
                </div>
                <button className="text-link compact" type="button">View scorecard <span>→</span></button>
              </div>
              <div className="results-table" role="table" aria-label="Key result performance">
                <div className="result-row result-head" role="row">
                  <span>Measure</span><span>Target</span><span>Actual</span><span>Trend</span><span>Status</span>
                </div>
                {keyResults.map((result) => (
                  <div className="result-row" role="row" key={result.metric}>
                    <strong>{result.metric}</strong>
                    <span>{result.target}</span>
                    <strong>{result.actual}</strong>
                    <span className={result.trend.startsWith("↑") ? "trend-up" : "trend-down"}>{result.trend}</span>
                    <span className={`status-pill ${result.status.toLowerCase().replace(" ", "-")}`}>{result.status}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="card activity-card">
              <span className="section-kicker">This week</span>
              <h2>Momentum</h2>
              <div className="activity-stat"><strong>12</strong><span>updates posted<br />across the plan</span></div>
              <div className="avatar-stack"><span>MC</span><span>LW</span><span>NS</span><span>+8</span></div>
              <p>Most active: <strong>Customer experience</strong></p>
            </article>
          </section>
        )}

        {view === "X-matrix" && (
          <section className="single-view">
            <div className="page-intro">
              <div><span className="section-kicker red">Alignment view</span><h2>FY2026 X-matrix</h2></div>
              <p>See how breakthrough objectives connect to annual priorities and accountable leaders.</p>
            </div>
            <article className="card matrix-card">
              <div className="matrix-head">
                <span>Strategic objective</span>
                <span>Customer trust</span><span>Flow</span><span>Quality</span><span>Capability</span>
              </div>
              {matrixRows.map((row) => (
                <div className="matrix-row" key={row.label}>
                  <strong>{row.label}</strong>
                  {row.values.map((value, index) => (
                    <span className={`matrix-cell level-${value}`} key={`${row.label}-${index}`}>{value || "—"}</span>
                  ))}
                </div>
              ))}
              <div className="matrix-legend"><span><i className="level-3" /> Strong</span><span><i className="level-2" /> Supporting</span><span><i className="level-1" /> Contributing</span></div>
            </article>
          </section>
        )}

        {view === "Initiatives" && (
          <section className="single-view">
            <div className="page-intro">
              <div><span className="section-kicker red">Execution portfolio</span><h2>Strategic initiatives</h2></div>
              <div className="filter-row">
                <label>Status
                  <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                    <option>All</option><option>On track</option><option>At risk</option>
                  </select>
                </label>
                <button className="button button-primary" type="button" onClick={() => setModalOpen(true)}>＋ Add initiative</button>
              </div>
            </div>
            <div className="initiative-grid">
              {visibleInitiatives.map((item) => (
                <article className="card initiative-card" key={item.title}>
                  <div className="initiative-title"><span className={`signal ${item.status === "At risk" ? "risk" : ""}`} /><span className={`status-pill ${item.status.toLowerCase().replace(" ", "-")}`}>{item.status}</span></div>
                  <h3>{item.title}</h3>
                  <div className="owner-row"><span className="avatar small">{item.owner.split(" ").map((part) => part[0]).join("")}</span><span><small>Owner</small><strong>{item.owner}</strong></span></div>
                  <div className="progress-meta"><span>Progress</span><strong>{item.progress}%</strong></div>
                  <div className="progress-track"><i style={{ width: `${item.progress}%` }} /></div>
                  <div className="due-row"><span>Due {item.due}</span><button type="button">Open brief →</button></div>
                </article>
              ))}
            </div>
          </section>
        )}

        {view === "Reviews" && (
          <section className="single-view">
            <div className="page-intro">
              <div><span className="section-kicker red">Review cadence</span><h2>Monthly strategy room</h2></div>
              <button className="button button-primary" type="button" onClick={() => setReviewOpen(true)}>Start September review</button>
            </div>
            <article className="card timeline-card">
              {[
                ["16 Sep", "September pulse", "Ready", "Two decisions on the agenda"],
                ["19 Aug", "August pulse", "Complete", "4 countermeasures agreed"],
                ["15 Jul", "July pulse", "Complete", "Customer metric reset"],
                ["17 Jun", "June pulse", "Complete", "Quarterly priorities confirmed"],
              ].map(([date, title, status, note], index) => (
                <div className="timeline-item" key={date}>
                  <span className={index === 0 ? "timeline-dot current" : "timeline-dot"} />
                  <span className="timeline-date">{date}</span>
                  <div><strong>{title}</strong><small>{note}</small></div>
                  <span className={`status-pill ${status === "Ready" ? "watch" : "on-track"}`}>{status}</span>
                  <button type="button" aria-label={`Open ${title}`}>→</button>
                </div>
              ))}
            </article>
          </section>
        )}
      </main>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModalOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="initiative-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" aria-label="Close" onClick={() => setModalOpen(false)}>×</button>
            <span className="section-kicker red">New work item</span>
            <h2 id="initiative-title">Add strategic initiative</h2>
            <p>Connect a focused piece of work to the FY2026 plan.</p>
            <form onSubmit={addInitiative}>
              <label>Initiative title<input name="title" placeholder="e.g. Simplify quote approval" autoFocus required /></label>
              <label>Accountable owner<input name="owner" placeholder="Full name" required /></label>
              <label>Linked objective<select defaultValue="O1"><option value="O1">O1 · Customer experience</option><option value="O2">O2 · Delivery engine</option><option value="O3">O3 · People and culture</option></select></label>
              <div className="modal-actions"><button className="button button-ghost" type="button" onClick={() => setModalOpen(false)}>Cancel</button><button className="button button-primary" type="submit">Add initiative</button></div>
            </form>
          </section>
        </div>
      )}

      {reviewOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setReviewOpen(false)}>
          <section className="modal review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" aria-label="Close" onClick={() => setReviewOpen(false)}>×</button>
            <span className="section-kicker red">September pulse</span>
            <h2 id="review-title">The room is nearly ready.</h2>
            <p>18 measure owners have updated their results. Resolve the two open decisions before the session.</p>
            <div className="decision-box"><span>01</span><div><strong>Approve additional weekend shift?</strong><small>Owner · Liam Ward</small></div><button type="button">Review →</button></div>
            <div className="decision-box"><span>02</span><div><strong>Reset customer effort target?</strong><small>Owner · Maya Chen</small></div><button type="button">Review →</button></div>
            <button className="button button-primary full" type="button" onClick={() => { setReviewOpen(false); setNotice("Review brief opened — ready for the strategy room"); }}>Open review brief</button>
          </section>
        </div>
      )}

      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </div>
  );
}
