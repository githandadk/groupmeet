ALTER TABLE signups
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS dietary_notes text,
  ADD COLUMN IF NOT EXISTS dropoff_location text;

-- Update the type CHECK constraint to allow 'mealtrain'.
-- The original constraint name may differ; drop by introspection.
DO $$
DECLARE c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'signups'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%type%';
  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE signups DROP CONSTRAINT %I', c_name);
  END IF;
END$$;

ALTER TABLE signups
  ADD CONSTRAINT signups_type_check
  CHECK (type IN ('timeslot', 'potluck', 'mealtrain'));
