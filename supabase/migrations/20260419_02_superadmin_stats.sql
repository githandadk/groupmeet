CREATE OR REPLACE FUNCTION superadmin_event_counts()
RETURNS TABLE(event_id uuid, participant_count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT event_id, count(*) FROM participants
  WHERE event_id IS NOT NULL
  GROUP BY event_id;
$$;

CREATE OR REPLACE FUNCTION superadmin_signup_counts()
RETURNS TABLE(signup_id uuid, claim_count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT signup_id, count(*) FROM signup_claims
  GROUP BY signup_id;
$$;
