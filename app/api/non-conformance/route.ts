import { NextResponse } from "next/server";
import { qualityEventJobNumber } from "../../../lib/quality-event-reference";

const SHEET_ID = "1aKVB1RjaQSoEW9yw14YJ2asSrsSwDDR3EB2KnSfPRMc";
const SHEET_GID = "407617143";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (character === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }

  return rows;
}

function clean(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function normaliseStatus(value: string) {
  const status = clean(value).toLowerCase();
  if (status.startsWith("complete")) return "Completed";
  if (status.includes("progress") || status.includes("ongoing")) return "In progress";
  if (status.includes("investigation")) return "Investigation";
  return status ? clean(value) : "Open / unclassified";
}

function normaliseCategory(value: string) {
  const category = clean(value).toUpperCase();
  if (!category) return "Unclassified";

  const labels: Record<string, string> = {
    D: "Defect",
    T: "Training",
    F: "Foam",
    P: "Procedure",
    S: "System",
  };

  const codes = Array.from(new Set(category.match(/[DTFPS]/g) ?? []));
  if (codes.length) return codes.map((code) => labels[code]).join(" + ");
  return clean(value);
}

function normaliseOrigin(value: string) {
  const origin = clean(value).toUpperCase();
  if (origin.startsWith("E")) return "External";
  if (origin.startsWith("I")) return "Internal";
  return origin ? clean(value) : "Unclassified";
}

function parseDate(value: string) {
  const match = clean(value).match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString();
}

export async function GET() {
  try {
    const response = await fetch(SHEET_URL, {
      cache: "no-store",
      headers: { "User-Agent": "Vivad quality workspace" },
    });

    if (!response.ok) {
      throw new Error(`Google Sheets returned ${response.status}`);
    }

    const csv = await response.text();
    const [, ...dataRows] = parseCsv(csv);
    const events = dataRows
      .filter((row) => row.some((cell) => clean(cell)))
      .map((row, index) => {
        const sourceRowNumber = index + 2;
        const jobNumber = qualityEventJobNumber(row[5], row[4], sourceRowNumber);
        return {
          id: `${jobNumber}-${sourceRowNumber}`,
          status: normaliseStatus(row[0]),
          progression: clean(row[1]),
          category: normaliseCategory(row[2]),
          origin: normaliseOrigin(row[3]),
          date: parseDate(row[4]),
          dateLabel: clean(row[4]) || "Date not recorded",
          jobNumber,
          department: clean(row[6]) || "Unclassified",
          reportedBy: clean(row[7]) || "Unassigned",
          assignedTo: clean(row[8]) || "Unassigned",
          description: clean(row[9]) || "No description recorded",
          severity: Number.parseInt(clean(row[10]), 10) || null,
          rootCause: clean(row[11]),
          action: clean(row[12]),
          remediationCost: clean(row[13]),
          sopOutcome: clean(row[14]),
          processed: clean(row[15]),
        };
      });

    return NextResponse.json({
      events,
      refreshedAt: new Date().toISOString(),
      source: "Vivad Non-Conformance Event Log",
    });
  } catch (error) {
    return NextResponse.json(
      {
        events: [],
        error: error instanceof Error ? error.message : "The event log could not be loaded.",
      },
      { status: 502 },
    );
  }
}
