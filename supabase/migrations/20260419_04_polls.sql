CREATE TABLE IF NOT EXISTS polls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  admin_token text NOT NULL,
  title       text NOT NULL,
  description text,
  closed      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_options (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id   uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label     text NOT NULL,
  position  int  NOT NULL
);
CREATE INDEX IF NOT EXISTS poll_options_poll_id_idx ON poll_options(poll_id);

CREATE TABLE IF NOT EXISTS poll_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id     uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id   uuid NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  voter_name  text NOT NULL,
  voter_key   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, voter_key)
);
CREATE INDEX IF NOT EXISTS poll_votes_poll_id_idx ON poll_votes(poll_id);

-- Enable Realtime on poll_votes so the participant page sees live counts.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE poll_votes;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END$$;
