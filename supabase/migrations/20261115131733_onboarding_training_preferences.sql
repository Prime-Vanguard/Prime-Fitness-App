-- A profile-owned, optional coaching context; existing role/owner policies apply.
ALTER TABLE public.profiles ADD COLUMN training_preferences jsonb;
CREATE FUNCTION private.valid_training_preferences(value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF value IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(value) <> 'object' OR NOT value ?& ARRAY['goals','experience','weekly_days','equipment']
    OR value - ARRAY['goals','experience','weekly_days','equipment'] <> '{}'::jsonb THEN RETURN false; END IF;
  IF jsonb_typeof(value->'goals') <> 'array' OR jsonb_typeof(value->'equipment') <> 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(value->'goals') > 4 OR jsonb_array_length(value->'equipment') > 4
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(value->'goals') e WHERE e NOT IN ('"hypertrophy"','"strength"','"conditioning"','"recomposition"'))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(value->'equipment') e WHERE e NOT IN ('"full_gym"','"barbell"','"dumbbells"','"bodyweight"'))
    OR (SELECT count(*) <> count(DISTINCT e) FROM jsonb_array_elements(value->'goals') e)
    OR (SELECT count(*) <> count(DISTINCT e) FROM jsonb_array_elements(value->'equipment') e) THEN RETURN false; END IF;
  IF value->'experience' NOT IN ('null','"novice"','"intermediate"','"advanced"') THEN RETURN false; END IF;
  IF value->'weekly_days' <> 'null'::jsonb THEN
    IF jsonb_typeof(value->'weekly_days') <> 'number' THEN RETURN false; END IF;
    IF (value->>'weekly_days')::numeric NOT BETWEEN 1 AND 7
      OR trunc((value->>'weekly_days')::numeric) <> (value->>'weekly_days')::numeric THEN RETURN false; END IF;
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION private.valid_training_preferences(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.valid_training_preferences(jsonb) TO authenticated, service_role;
ALTER TABLE public.profiles ADD CONSTRAINT valid_training_preferences
  CHECK (private.valid_training_preferences(training_preferences));
-- No rewards, assignments, targets or existing setup completion flags change.

-- Preserve new preferences in personal restores without clearing them for v1 backups.
-- Guard the replacement so a divergent restore contract fails visibly on replay.
DO $$
DECLARE definition text; updated text;
BEGIN
  SELECT pg_get_functiondef('public.restore_personal_data(jsonb,boolean)'::regprocedure) INTO definition;
  updated := replace(definition,
    'avatar_url=_data->''profile''->>''avatar_url'' WHERE id=uid',
    'avatar_url=_data->''profile''->>''avatar_url'',training_preferences=CASE WHEN (_data->''profile'') ? ''training_preferences'' THEN nullif(_data->''profile''->''training_preferences'',''null''::jsonb) ELSE training_preferences END WHERE id=uid');
  IF updated = definition THEN RAISE EXCEPTION 'Personal restore profile contract changed'; END IF;
  EXECUTE updated;
END $$;
