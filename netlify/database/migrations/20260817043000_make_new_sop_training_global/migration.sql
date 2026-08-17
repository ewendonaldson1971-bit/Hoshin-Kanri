ALTER TABLE sops
  ADD COLUMN IF NOT EXISTS available_to_all_departments BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE sops
SET available_to_all_departments = TRUE,
    updated_at = NOW()::TEXT
WHERE reference = 'OFF-000001'
   OR (
     department = 'Office'
     AND LOWER(title) = LOWER('Office - How to create a new SOP')
   );
