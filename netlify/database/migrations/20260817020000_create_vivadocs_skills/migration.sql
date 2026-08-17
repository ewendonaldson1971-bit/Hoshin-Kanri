CREATE TABLE IF NOT EXISTS vivadocs_people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL CHECK (department IN (
    'CST', 'Prepress', 'Printers', 'Cutters', 'Fab1', 'Framing',
    'Sew', 'Light Box', 'Office', 'Despatch'
  )),
  role TEXT NOT NULL DEFAULT 'Team member',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vivadocs_people_name
  ON vivadocs_people (LOWER(name));

CREATE INDEX IF NOT EXISTS idx_vivadocs_people_department
  ON vivadocs_people (department, name);

CREATE TABLE IF NOT EXISTS vivadocs_training_records (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES vivadocs_people(id) ON DELETE CASCADE,
  sop_id TEXT NOT NULL REFERENCES sops(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN (
    'Gap', 'In training', 'Competent', 'Trainer', 'Expired'
  )),
  source TEXT NOT NULL DEFAULT 'Manual' CHECK (source IN ('Manual', 'SOP completion')),
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (person_id, sop_id)
);

CREATE INDEX IF NOT EXISTS idx_vivadocs_training_person
  ON vivadocs_training_records (person_id);

CREATE INDEX IF NOT EXISTS idx_vivadocs_training_sop
  ON vivadocs_training_records (sop_id);
