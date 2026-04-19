-- Atomic claim function: lock the item row, count existing claims, insert if capacity allows.
-- Raises 'capacity_full' so the API route can return 409.
CREATE OR REPLACE FUNCTION claim_signup_item(
  p_item_id uuid,
  p_signup_id uuid,
  p_participant_name text,
  p_participant_email text,
  p_session_token text
)
RETURNS signup_claims
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacity int;
  v_existing_count int;
  v_my_count int;
  v_claim signup_claims;
BEGIN
  -- Lock the item row so concurrent claims wait
  SELECT capacity INTO v_capacity
  FROM signup_items
  WHERE id = p_item_id AND signup_id = p_signup_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  -- Same-session duplicate check
  SELECT count(*) INTO v_my_count
  FROM signup_claims
  WHERE item_id = p_item_id AND session_token = p_session_token;
  IF v_my_count > 0 THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  -- Capacity check
  SELECT count(*) INTO v_existing_count
  FROM signup_claims
  WHERE item_id = p_item_id;
  IF v_existing_count >= v_capacity THEN
    RAISE EXCEPTION 'capacity_full';
  END IF;

  INSERT INTO signup_claims (item_id, signup_id, participant_name, participant_email, session_token)
  VALUES (p_item_id, p_signup_id, p_participant_name, p_participant_email, p_session_token)
  RETURNING * INTO v_claim;

  RETURN v_claim;
END;
$$;
