CREATE TABLE IF NOT EXISTS sop_counters (
  department TEXT PRIMARY KEY,
  prefix TEXT NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);

CREATE TABLE IF NOT EXISTS sops (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  author TEXT NOT NULL,
  created_date TEXT NOT NULL,
  version TEXT NOT NULL,
  review_date TEXT,
  status TEXT NOT NULL DEFAULT 'Published',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sops_department_created
  ON sops (department, created_at);

CREATE TABLE IF NOT EXISTS sop_assets (
  key TEXT PRIMARY KEY,
  sop_id TEXT NOT NULL REFERENCES sops(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  data BYTEA NOT NULL,
  content_type TEXT NOT NULL,
  original_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sop_assets_sop_id
  ON sop_assets (sop_id);

CREATE TABLE IF NOT EXISTS sop_steps (
  id TEXT PRIMARY KEY,
  sop_id TEXT NOT NULL REFERENCES sops(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  instruction TEXT NOT NULL,
  image_key TEXT REFERENCES sop_assets(key) ON DELETE SET NULL,
  image_name TEXT,
  image_type TEXT,
  image_caption TEXT,
  UNIQUE (sop_id, position)
);

CREATE INDEX IF NOT EXISTS idx_sop_steps_sop_id
  ON sop_steps (sop_id);
