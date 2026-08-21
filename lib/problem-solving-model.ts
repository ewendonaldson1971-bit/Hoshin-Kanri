export const ISHIKAWA_CATEGORIES = ["People", "Process", "Equipment", "Materials", "Environment", "Measurement"] as const;

export type QualityEventSnapshot = {
  id: string; status: string; category: string; origin: string; dateLabel: string;
  jobNumber: string; department: string; reportedBy: string; assignedTo: string;
  description: string; severity: number | null; rootCause: string; action: string;
};

export type ResearchSource = { title: string; url: string; publisher: string; relevance: string };
export type CauseCategory = { category: typeof ISHIKAWA_CATEGORIES[number]; findings: string[]; evidenceGap: string };
export type SuggestedSolution = { id: string; title: string; rationale: string; priority: "High" | "Medium" | "Low"; sourceUrls: string[] };
export type NextStep = { id: string; action: string; owner: string; dueDate: string; priority: "High" | "Medium" | "Low" };
export type ProblemAnalysis = {
  summary: string;
  causes: CauseCategory[];
  sources: ResearchSource[];
  solutions: SuggestedSolution[];
  nextSteps: NextStep[];
  researchAvailable: boolean;
  researchMessage: string;
};

export function sanitiseTechnicalContext(event: QualityEventSnapshot, notes: string) {
  return {
    status: event.status.slice(0, 80),
    category: event.category.slice(0, 100),
    origin: event.origin.slice(0, 80),
    department: event.department.slice(0, 100),
    description: event.description.slice(0, 4000),
    severity: event.severity,
    recordedCause: event.rootCause.slice(0, 2000),
    recordedAction: event.action.slice(0, 2000),
    analysisNotes: notes.slice(0, 4000),
  };
}

export const problemAnalysisJsonSchema = {
  type: "object", additionalProperties: false,
  required: ["summary", "causes", "sources", "solutions", "nextSteps", "researchAvailable", "researchMessage"],
  properties: {
    summary: { type: "string" },
    causes: { type: "array", minItems: 6, maxItems: 6, items: { type: "object", additionalProperties: false, required: ["category", "findings", "evidenceGap"], properties: { category: { type: "string", enum: [...ISHIKAWA_CATEGORIES] }, findings: { type: "array", items: { type: "string" } }, evidenceGap: { type: "string" } } } },
    sources: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "url", "publisher", "relevance"], properties: { title: { type: "string" }, url: { type: "string" }, publisher: { type: "string" }, relevance: { type: "string" } } } },
    solutions: { type: "array", minItems: 1, items: { type: "object", additionalProperties: false, required: ["id", "title", "rationale", "priority", "sourceUrls"], properties: { id: { type: "string" }, title: { type: "string" }, rationale: { type: "string" }, priority: { type: "string", enum: ["High", "Medium", "Low"] }, sourceUrls: { type: "array", items: { type: "string" } } } } },
    nextSteps: { type: "array", minItems: 1, items: { type: "object", additionalProperties: false, required: ["id", "action", "owner", "dueDate", "priority"], properties: { id: { type: "string" }, action: { type: "string" }, owner: { type: "string" }, dueDate: { type: "string" }, priority: { type: "string", enum: ["High", "Medium", "Low"] } } } },
    researchAvailable: { type: "boolean" }, researchMessage: { type: "string" },
  },
} as const;

export function validateProblemAnalysis(value: unknown): value is ProblemAnalysis {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<ProblemAnalysis>;
  const categories = data.causes?.map((item) => item.category);
  return typeof data.summary === "string" && Array.isArray(data.causes) && data.causes.length === 6
    && ISHIKAWA_CATEGORIES.every((category) => categories?.includes(category))
    && data.causes.every((item) => Array.isArray(item.findings) && typeof item.evidenceGap === "string")
    && Array.isArray(data.sources) && data.sources.every((source) => {
      try { const url = new URL(source.url); return (url.protocol === "https:" || url.protocol === "http:") && Boolean(source.title); } catch { return false; }
    }) && Array.isArray(data.solutions) && data.solutions.length > 0
    && Array.isArray(data.nextSteps) && data.nextSteps.length > 0
    && typeof data.researchAvailable === "boolean" && typeof data.researchMessage === "string";
}

export function buildInternalAnalysis(event: QualityEventSnapshot, notes: string, reason: string): ProblemAnalysis {
  const context = [event.description, notes].filter(Boolean).join(" ");
  const causes = ISHIKAWA_CATEGORIES.map((category): CauseCategory => ({
    category,
    findings: category === "Process"
      ? [event.rootCause || "Review whether the documented method was available, understood and followed."]
      : category === "Equipment"
        ? ["Confirm equipment condition, settings and maintenance status at the time of the event."]
        : category === "Materials"
          ? ["Check material specification, batch condition, storage and handling history."]
          : category === "People"
            ? ["Confirm training, handover, workload and task ownership without attributing blame."]
            : category === "Environment"
              ? ["Check workplace conditions, layout, lighting, temperature and interruptions."]
              : ["Confirm the measurement method, acceptance criteria and available records."],
    evidenceGap: "Insufficient evidence: validate this category with the people who performed the work and objective records.",
  }));
  return {
    summary: `Initial structured review of ${event.category.toLowerCase()} event: ${context || "No detailed event description was available."}`,
    causes,
    sources: [],
    solutions: [
      { id: "contain", title: "Confirm immediate containment", rationale: "Protect the customer and prevent recurrence while the cause is being verified.", priority: "High", sourceUrls: [] },
      { id: "verify", title: "Verify the cause at the work area", rationale: "Test the strongest hypotheses using records, observation and operator input before changing the process.", priority: "High", sourceUrls: [] },
      { id: "standardise", title: "Update and confirm the standard", rationale: "Once verified, update the SOP, train affected people and confirm the change is effective.", priority: "Medium", sourceUrls: [] },
    ],
    nextSteps: [
      { id: crypto.randomUUID(), action: "Confirm containment and collect evidence", owner: "", dueDate: "", priority: "High" },
      { id: crypto.randomUUID(), action: "Review the six cause categories with the affected team", owner: "", dueDate: "", priority: "High" },
      { id: crypto.randomUUID(), action: "Verify corrective actions and record effectiveness", owner: "", dueDate: "", priority: "Medium" },
    ],
    researchAvailable: false,
    researchMessage: reason,
  };
}
