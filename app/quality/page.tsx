"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type QualityEvent = {
  id: string;
  status: string;
  progression: string;
  category: string;
  origin: string;
  date: string | null;
  dateLabel: string;
  jobNumber: string;
  department: string;
  reportedBy: string;
  assignedTo: string;
  description: string;
  severity: number | null;
  rootCause: string;
  action: string;
  remediationCost: string;
  sopOutcome: string;
  processed: string;
};

type QualityResponse = {
  events: QualityEvent[];
  refreshedAt?: string;
  source?: string;
  error?: string;
};

const SHEET_LINK =
  "https://docs.google.com/spreadsheets/d/1aKVB1RjaQSoEW9yw14YJ2asSrsSwDDR3EB2KnSfPRMc/edit?gid=407617143#gid=407617143";

function isComplete(status: string) {
  return status === "Completed";
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: string) {
  if (status === "Completed") return "is-complete";
  if (status === "In progress") return "is-progress";
  if (status === "Investigation") return "is-investigation";
  return "is-open";
}

function severityClass(severity: number | null) {
  if (!severity) return "severity-none";
  if (severity >= 4) return "severity-high";
  if (severity === 3) return "severity-medium";
  return "severity-low";
}

export default function QualityPage() {
  const [data, setData] = useState<QualityResponse>({ events: [] });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [category, setCategory] = useState("All categories");
  const [department, setDepartment] = useState("All departments");
  const [selected, setSelected] = useState<QualityEvent | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/non-conformance", { cache: "no-store" });
      const payload = (await response.json()) as QualityResponse;
      setData(payload);
    } catch {
      setData({ events: [], error: "The live event log could not be reached." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const categories = useMemo(
    () =>
      Array.from(new Set(data.events.map((event) => event.category))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [data.events],
  );

  const departments = useMemo(
    () =>
      Array.from(new Set(data.events.map((event) => titleCase(event.department)))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [data.events],
  );

  const statuses = useMemo(
    () =>
      Array.from(new Set(data.events.map((event) => event.status))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [data.events],
  );

  const sortedEvents = useMemo(
    () =>
      [...data.events].sort((a, b) => {
        const first = a.date ? new Date(a.date).getTime() : 0;
        const second = b.date ? new Date(b.date).getTime() : 0;
        return second - first;
      }),
    [data.events],
  );

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sortedEvents.filter((event) => {
      const matchesQuery =
        !needle ||
        [
          event.jobNumber,
          event.description,
          event.department,
          event.category,
          event.assignedTo,
          event.reportedBy,
          event.rootCause,
        ].some((value) => value.toLowerCase().includes(needle));
      const matchesStatus = status === "All statuses" || event.status === status;
      const matchesCategory = category === "All categories" || event.category === category;
      const matchesDepartment =
        department === "All departments" || titleCase(event.department) === department;
      return matchesQuery && matchesStatus && matchesCategory && matchesDepartment;
    });
  }, [category, department, query, sortedEvents, status]);

  const summary = useMemo(() => {
    const total = data.events.length;
    const completed = data.events.filter((event) => isComplete(event.status)).length;
    const open = total - completed;
    const highSeverity = data.events.filter(
      (event) => !isComplete(event.status) && (event.severity ?? 0) >= 4,
    ).length;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;

    return { total, completed, open, highSeverity, completionRate };
  }, [data.events]);

  const monthlyTrend = useMemo(() => {
    const months = new Map<string, { label: string; count: number }>();
    data.events.forEach((event) => {
      if (!event.date) return;
      const date = new Date(event.date);
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("en-AU", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      });
      const current = months.get(key) ?? { label, count: 0 };
      current.count += 1;
      months.set(key, current);
    });

    return Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-10)
      .map(([, value]) => value);
  }, [data.events]);

  const categoryMix = useMemo(() => {
    const counts = new Map<string, number>();
    data.events.forEach((event) => {
      counts.set(event.category, (counts.get(event.category) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [data.events]);

  const maxMonthly = Math.max(...monthlyTrend.map((month) => month.count), 1);
  const maxCategory = Math.max(...categoryMix.map((item) => item.count), 1);
  const updatedLabel = data.refreshedAt
    ? new Date(data.refreshedAt).toLocaleTimeString("en-AU", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "Not connected";

  function resetFilters() {
    setQuery("");
    setStatus("All statuses");
    setCategory("All categories");
    setDepartment("All departments");
  }

  return (
    <div className="quality-shell">
      <aside className="quality-sidebar">
        <Link className="quality-brand" href="/" aria-label="Vivad home">
          <img src="/vivad-logo.png" alt="Vivad" />
        </Link>
        <nav aria-label="Vivad workspace">
          <span className="quality-nav-label">Workspace</span>
          <Link href="/strategy"><i>◎</i> Strategy</Link>
          <Link className="active" href="/quality"><i>◇</i> Quality events</Link>
          <Link href="/training"><i>▷</i> Training academy</Link>
          <a href="#trends"><i>↗</i> Trends</a>
          <a href="#event-log"><i>☷</i> Event log</a>
        </nav>
        <div className="quality-sidebar-note">
          <span>LIVE SOURCE</span>
          <strong>Google Sheets</strong>
          <small>Read-only connection</small>
          <a href={SHEET_LINK} target="_blank" rel="noreferrer">Open source log ↗</a>
        </div>
      </aside>

      <main className="quality-main">
        <header className="quality-topbar">
          <div>
            <span className="quality-eyebrow">VIVAD QUALITY SYSTEM</span>
            <h1>Non-Conformance Events</h1>
            <p>See where quality is breaking down, what needs attention, and whether corrective action is closing the loop.</p>
          </div>
          <div className="quality-source">
            <div>
              <span className={data.error ? "source-dot error" : "source-dot"} />
              <p><strong>{data.error ? "Connection issue" : "Sheet connected"}</strong><small>Refreshed {updatedLabel}</small></p>
            </div>
            <button type="button" onClick={() => void loadEvents()} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh data"}
            </button>
          </div>
        </header>

        {data.error && (
          <section className="quality-alert" role="alert">
            <div><strong>We couldn’t refresh the live log.</strong><span>{data.error}</span></div>
            <button type="button" onClick={() => void loadEvents()}>Try again</button>
          </section>
        )}

        <section className="quality-kpis" aria-label="Quality event summary">
          <article>
            <div className="kpi-icon blue">Σ</div>
            <div><span>Total events</span><strong>{loading ? "—" : summary.total}</strong><small>All recorded events</small></div>
          </article>
          <article>
            <div className="kpi-icon red">!</div>
            <div><span>Open attention</span><strong>{loading ? "—" : summary.open}</strong><small>Not marked complete</small></div>
          </article>
          <article>
            <div className="kpi-icon amber">◆</div>
            <div><span>High severity open</span><strong>{loading ? "—" : summary.highSeverity}</strong><small>Severity 4 or higher</small></div>
          </article>
          <article>
            <div className="kpi-icon green">✓</div>
            <div><span>Completion rate</span><strong>{loading ? "—" : `${summary.completionRate}%`}</strong><small>{summary.completed} events closed</small></div>
          </article>
        </section>

        <section className="quality-insights" id="trends">
          <article className="quality-panel trend-panel">
            <div className="quality-panel-head">
              <div><span>EVENT FREQUENCY</span><h2>Monthly trend</h2></div>
              <small>Latest 10 recorded months</small>
            </div>
            <div className="trend-chart" aria-label="Monthly event counts">
              {monthlyTrend.map((month) => (
                <div className="trend-column" key={month.label}>
                  <span>{month.count}</span>
                  <div><i style={{ height: `${Math.max(10, (month.count / maxMonthly) * 100)}%` }} /></div>
                  <small>{month.label.replace(" ", " ’")}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="quality-panel mix-panel">
            <div className="quality-panel-head">
              <div><span>CAUSE SIGNALS</span><h2>Event mix</h2></div>
            </div>
            <div className="mix-list">
              {categoryMix.map((item, index) => (
                <div key={item.label}>
                  <div><span><i className={`mix-swatch mix-${index}`} />{item.label}</span><strong>{item.count}</strong></div>
                  <div className="mix-track"><i className={`mix-${index}`} style={{ width: `${(item.count / maxCategory) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </article>

          <article className="quality-panel action-panel">
            <div className="quality-panel-head">
              <div><span>ACTION FOCUS</span><h2>What needs follow-up</h2></div>
            </div>
            <div className="action-number"><strong>{summary.highSeverity}</strong><span>high-severity events remain open</span></div>
            <p>Start with events that combine elevated severity with an incomplete status, then confirm an owner and remedial action.</p>
            <button type="button" onClick={() => { setStatus("Open / unclassified"); document.querySelector("#event-log")?.scrollIntoView(); }}>
              Review open events <span>↓</span>
            </button>
          </article>
        </section>

        <section className="quality-log" id="event-log">
          <div className="quality-log-heading">
            <div>
              <span className="quality-eyebrow">SOURCE RECORDS</span>
              <h2>Event log</h2>
              <p>{filteredEvents.length} of {data.events.length} records shown</p>
            </div>
            <a href={SHEET_LINK} target="_blank" rel="noreferrer">Open Google Sheet <span>↗</span></a>
          </div>

          <div className="quality-filters">
            <label className="quality-search">
              <span>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search job, issue, owner or cause"
                aria-label="Search quality events"
              />
            </label>
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">
              <option>All statuses</option>
              {statuses.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
              <option>All categories</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filter by department">
              <option>All departments</option>
              {departments.map((item) => <option key={item}>{item}</option>)}
            </select>
            {(query || status !== "All statuses" || category !== "All categories" || department !== "All departments") && (
              <button className="clear-filters" type="button" onClick={resetFilters}>Clear</button>
            )}
          </div>

          <div className="quality-table-wrap">
            <table className="quality-table">
              <thead>
                <tr>
                  <th>Date / job</th>
                  <th>Event</th>
                  <th>Department</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th><span className="sr-only">View</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.slice(0, 40).map((event) => (
                  <tr key={event.id}>
                    <td><strong>{event.dateLabel}</strong><small>Job {event.jobNumber}</small></td>
                    <td><button className="event-title" type="button" onClick={() => setSelected(event)}>{event.description}</button><small>{event.origin}</small></td>
                    <td>{titleCase(event.department)}</td>
                    <td><span className="category-chip">{event.category}</span></td>
                    <td><span className={`severity-badge ${severityClass(event.severity)}`}>{event.severity ?? "—"}</span></td>
                    <td><span className={`quality-status ${statusClass(event.status)}`}><i />{event.status}</span></td>
                    <td>{titleCase(event.assignedTo)}</td>
                    <td><button className="row-open" type="button" aria-label={`View event ${event.jobNumber}`} onClick={() => setSelected(event)}>→</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && filteredEvents.length === 0 && (
              <div className="quality-empty"><strong>No events match these filters.</strong><button type="button" onClick={resetFilters}>Clear filters</button></div>
            )}
          </div>
          {filteredEvents.length > 40 && <p className="quality-table-note">Showing the first 40 matching records. Narrow the filters to find a specific event.</p>}
        </section>
      </main>

      {selected && (
        <div className="quality-drawer-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
          <aside className="quality-drawer" role="dialog" aria-modal="true" aria-label={`Quality event ${selected.jobNumber}`} onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-head">
              <div><span className="quality-eyebrow">NCE DETAIL</span><h2>Job {selected.jobNumber}</h2></div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close event details">×</button>
            </div>
            <div className="drawer-meta">
              <span className={`quality-status ${statusClass(selected.status)}`}><i />{selected.status}</span>
              <span className={`severity-badge ${severityClass(selected.severity)}`}>Severity {selected.severity ?? "not set"}</span>
            </div>
            <dl>
              <div><dt>Date reported</dt><dd>{selected.dateLabel}</dd></div>
              <div><dt>Department</dt><dd>{titleCase(selected.department)}</dd></div>
              <div><dt>Category</dt><dd>{selected.category}</dd></div>
              <div><dt>Origin</dt><dd>{selected.origin}</dd></div>
              <div><dt>Reported by</dt><dd>{titleCase(selected.reportedBy)}</dd></div>
              <div><dt>Assigned to</dt><dd>{titleCase(selected.assignedTo)}</dd></div>
            </dl>
            <section><span>EVENT DESCRIPTION</span><p>{selected.description}</p></section>
            <section><span>ROOT CAUSE</span><p>{selected.rootCause || "Not yet recorded."}</p></section>
            <section><span>REMEDIAL ACTION</span><p>{selected.action || "No remedial action recorded yet."}</p></section>
            <a className="drawer-source" href={SHEET_LINK} target="_blank" rel="noreferrer">Continue in Google Sheet <span>↗</span></a>
          </aside>
        </div>
      )}
    </div>
  );
}
