"use client";

import { FormEvent, type CSSProperties, useEffect, useMemo, useState } from "react";

const DEPARTMENTS = [
  "CST",
  "Prepress",
  "Printers",
  "Cutters",
  "Fab1",
  "Framing",
  "Sew",
  "Light Box",
  "Office",
  "Despatch",
] as const;

const TRAINING_STATUSES = [
  "Gap",
  "In training",
  "Competent",
  "Trainer",
  "Expired",
] as const;

type TrainingStatus = (typeof TRAINING_STATUSES)[number];
type Department = (typeof DEPARTMENTS)[number];
type MatrixSop = {
  id: string;
  reference: string;
  title: string;
  category: string;
  status: string;
};
type Person = {
  id: string;
  name: string;
  department: string;
  role: string;
};
type TrainingRecord = {
  id: string;
  personId: string;
  sopId: string;
  status: TrainingStatus;
  source: "Manual" | "SOP completion";
  completedAt: string;
  updatedAt: string;
};
type Dialog =
  | { kind: "add" }
  | { kind: "transfer" }
  | { kind: "remove" }
  | { kind: "training"; personId: string; sopId: string }
  | null;

export function SkillsMatrix({
  sops,
  onToast,
}: {
  sops: MatrixSop[];
  onToast: (message: string) => void;
}) {
  const [department, setDepartment] = useState<Department>("Despatch");
  const [people, setPeople] = useState<Person[]>([]);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [dialog]);

  const departmentPeople = useMemo(
    () => people.filter((person) => person.department === department),
    [department, people],
  );
  const departmentSops = useMemo(
    () =>
      sops.filter(
        (sop) => sop.category === department && sop.status === "Published",
      ),
    [department, sops],
  );
  const recordsByCell = useMemo(
    () => new Map(records.map((record) => [`${record.personId}:${record.sopId}`, record])),
    [records],
  );

  async function refresh() {
    try {
      setError("");
      const response = await fetch("/api/vivadocs/skills", { cache: "no-store" });
      const result = (await response.json()) as {
        people?: Person[];
        records?: TrainingRecord[];
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Could not load skills data.");
      setPeople(result.people ?? []);
      setRecords(result.records ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load skills data.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(action: string, fields: Record<string, string>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/vivadocs/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...fields }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not update the skills matrix.");
      await refresh();
      setDialog(null);
      onToast(
        action === "addPerson"
          ? "Person added to the skills matrix."
          : action === "transferPerson"
            ? "Person transferred to the selected department."
            : action === "removePerson"
              ? "Person removed from the skills matrix."
              : "Training record updated.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the skills matrix.");
    } finally {
      setBusy(false);
    }
  }

  function initials(name: string) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }

  function statusIcon(status: TrainingStatus) {
    if (status === "Trainer") return "★";
    if (status === "Competent") return "✓";
    if (status === "In training") return "◷";
    return "!";
  }

  return (
    <section className="vivadocs-section skills-matrix-section">
      <div className="vivadocs-section-head skills-section-head">
        <div>
          <span>CAPABILITY</span>
          <h2>Skills matrix</h2>
          <p>People and competency against published procedures for one department.</p>
        </div>
        <div className="skills-legend" aria-label="Training status legend">
          <span className="competent">● Competent</span>
          <span className="training">● In training</span>
          <span className="gap">● Gap</span>
        </div>
      </div>

      <div className="skills-toolbar">
        <label>
          <span>Department</span>
          <select
            aria-label="Select department"
            value={department}
            onChange={(event) => setDepartment(event.target.value as Department)}
          >
            {DEPARTMENTS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <div className="skills-actions" aria-label="People management">
          <button type="button" onClick={() => setDialog({ kind: "add" })}>
            ＋ Add person
          </button>
          <button
            type="button"
            disabled={!departmentPeople.length}
            onClick={() => setDialog({ kind: "transfer" })}
          >
            ⇄ Transfer person
          </button>
          <button
            className="danger"
            type="button"
            disabled={!departmentPeople.length}
            onClick={() => setDialog({ kind: "remove" })}
          >
            − Remove person
          </button>
        </div>
      </div>

      {error && <div className="skills-feedback error" role="alert">{error}</div>}
      {loading ? (
        <div className="vivadocs-empty tall" aria-live="polite">
          <strong>Loading skills matrix…</strong>
        </div>
      ) : !departmentPeople.length ? (
        <div className="vivadocs-empty tall">
          <strong>No people in {department}</strong>
          <span>Add a person to start this department&apos;s skills matrix.</span>
          <button type="button" onClick={() => setDialog({ kind: "add" })}>＋ Add person</button>
        </div>
      ) : !departmentSops.length ? (
        <div className="vivadocs-empty tall">
          <strong>No published SOPs for {department}</strong>
          <span>People are ready. Published {department} SOPs will appear here automatically.</span>
        </div>
      ) : (
        <div className="skills-table-scroll" tabIndex={0} aria-label={`${department} skills matrix`}>
          <div
            className="skills-table"
            style={{ "--skill-columns": departmentSops.length } as CSSProperties}
          >
            <div className="skills-head">
              <span>Team member</span>
              {departmentSops.map((sop) => (
                <span key={sop.id}>
                  {sop.reference}
                  <small>{sop.title}</small>
                </span>
              ))}
            </div>
            {departmentPeople.map((person) => (
              <div className="skills-row" key={person.id}>
                <span className="skills-person">
                  <i>{initials(person.name)}</i>
                  <span>
                    <strong>{person.name}</strong>
                    <small>{person.role}</small>
                  </span>
                </span>
                {departmentSops.map((sop) => {
                  const record = recordsByCell.get(`${person.id}:${sop.id}`);
                  const status = record?.status ?? "Gap";
                  return (
                    <button
                      key={sop.id}
                      className={status.toLowerCase().replace(" ", "-")}
                      type="button"
                      aria-label={`Update ${person.name} training for ${sop.reference}. Current status: ${status}`}
                      title={record ? `${record.source}${record.completedAt ? ` · ${new Date(record.completedAt).toLocaleDateString("en-AU")}` : ""}` : "No training recorded"}
                      onClick={() =>
                        setDialog({ kind: "training", personId: person.id, sopId: sop.id })
                      }
                    >
                      <i>{statusIcon(status)}</i>
                      <span>{status}</span>
                      {record?.source === "SOP completion" && <small>Completed SOP</small>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {dialog && (
        <SkillsDialog
          dialog={dialog}
          department={department}
          people={departmentPeople}
          sops={departmentSops}
          records={recordsByCell}
          busy={busy}
          close={() => setDialog(null)}
          submit={submit}
        />
      )}
    </section>
  );
}

function SkillsDialog({
  dialog,
  department,
  people,
  sops,
  records,
  busy,
  close,
  submit,
}: {
  dialog: Exclude<Dialog, null>;
  department: Department;
  people: Person[];
  sops: MatrixSop[];
  records: Map<string, TrainingRecord>;
  busy: boolean;
  close: () => void;
  submit: (action: string, fields: Record<string, string>) => Promise<void>;
}) {
  const trainingPerson = dialog.kind === "training"
    ? people.find((person) => person.id === dialog.personId)
    : undefined;
  const trainingSop = dialog.kind === "training"
    ? sops.find((sop) => sop.id === dialog.sopId)
    : undefined;
  const trainingRecord = dialog.kind === "training"
    ? records.get(`${dialog.personId}:${dialog.sopId}`)
    : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fields = Object.fromEntries(
      Array.from(data.entries()).map(([key, value]) => [key, String(value)]),
    );
    const action =
      dialog.kind === "add"
        ? "addPerson"
        : dialog.kind === "transfer"
          ? "transferPerson"
          : dialog.kind === "remove"
            ? "removePerson"
            : "updateTraining";
    void submit(action, fields);
  }

  const title =
    dialog.kind === "add"
      ? "Add a new person"
      : dialog.kind === "transfer"
        ? "Transfer a person"
        : dialog.kind === "remove"
          ? "Remove a person"
          : "Update training record";

  return (
    <div className="vivadocs-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) close();
    }}>
      <div className="vivadocs-modal skills-modal" role="dialog" aria-modal="true" aria-labelledby="skills-dialog-title">
        <div>
          <span>SKILLS MATRIX</span>
          <button type="button" onClick={close} aria-label="Close dialog">×</button>
        </div>
        <h2 id="skills-dialog-title">{title}</h2>
        <p>
          {dialog.kind === "training"
            ? `${trainingPerson?.name ?? "Team member"} · ${trainingSop?.reference ?? "SOP"}`
            : `${department} department`}
        </p>
        <form onSubmit={handleSubmit}>
          {dialog.kind === "add" && (
            <>
              <label><span>Full name</span><input name="name" autoFocus required maxLength={120} /></label>
              <label><span>Role</span><input name="role" defaultValue="Team member" maxLength={120} /></label>
              <label><span>Department</span><select name="department" defaultValue={department}>{DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}</select></label>
            </>
          )}
          {(dialog.kind === "transfer" || dialog.kind === "remove") && (
            <label><span>Person</span><select name="personId" autoFocus required>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
          )}
          {dialog.kind === "transfer" && (
            <label><span>New department</span><select name="department" required defaultValue={DEPARTMENTS.find((item) => item !== department)}>{DEPARTMENTS.filter((item) => item !== department).map((item) => <option key={item}>{item}</option>)}</select></label>
          )}
          {dialog.kind === "remove" && (
            <div className="skills-warning" role="note">Removing a person also removes their stored training records. This cannot be undone.</div>
          )}
          {dialog.kind === "training" && (
            <>
              <input type="hidden" name="personId" value={dialog.personId} />
              <input type="hidden" name="sopId" value={dialog.sopId} />
              <label><span>Training status</span><select name="status" autoFocus defaultValue={trainingRecord?.status ?? "Gap"}>{TRAINING_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
              {trainingRecord && <div className="vivadocs-modal-note"><b>Current source</b><span>{trainingRecord.source}</span></div>}
            </>
          )}
          <footer>
            <button type="button" onClick={close}>Cancel</button>
            <button className={dialog.kind === "remove" ? "danger" : ""} type="submit" disabled={busy}>
              {busy ? "Saving…" : dialog.kind === "remove" ? "Remove person" : "Save"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
