CREATE TABLE IF NOT EXISTS vivadocs_video_completions (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES vivadocs_people(id) ON DELETE CASCADE,
  video_uid TEXT NOT NULL,
  video_title TEXT NOT NULL,
  category TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (person_id, video_uid)
);

CREATE INDEX IF NOT EXISTS idx_vivadocs_video_completion_person
  ON vivadocs_video_completions (person_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_vivadocs_video_completion_category
  ON vivadocs_video_completions (category, completed_at DESC);
