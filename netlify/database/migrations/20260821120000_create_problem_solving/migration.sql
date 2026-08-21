CREATE TABLE IF NOT EXISTS problem_solving_analyses (
  id text PRIMARY KEY, quality_event_id text NOT NULL, event_snapshot jsonb NOT NULL,
  analysis_notes text NOT NULL DEFAULT '', version integer NOT NULL, diagnosis jsonb NOT NULL,
  research_sources jsonb NOT NULL DEFAULT '[]', solutions jsonb NOT NULL DEFAULT '[]',
  suggested_next_steps jsonb NOT NULL DEFAULT '[]', provider text NOT NULL, model text NOT NULL,
  created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quality_event_id, version)
);
CREATE INDEX IF NOT EXISTS idx_problem_analyses_event ON problem_solving_analyses (quality_event_id, version DESC);

CREATE TABLE IF NOT EXISTS problem_solving_plans (
  id text PRIMARY KEY, analysis_id text NOT NULL UNIQUE REFERENCES problem_solving_analyses(id) ON DELETE CASCADE,
  quality_event_id text NOT NULL, selected_solution_ids jsonb NOT NULL DEFAULT '[]', next_steps jsonb NOT NULL DEFAULT '[]',
  created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_problem_plans_event ON problem_solving_plans (quality_event_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS problem_solving_audit (
  id text PRIMARY KEY, quality_event_id text NOT NULL, analysis_id text REFERENCES problem_solving_analyses(id) ON DELETE SET NULL,
  action text NOT NULL, details jsonb NOT NULL DEFAULT '{}', actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_problem_audit_event ON problem_solving_audit (quality_event_id, created_at DESC);
