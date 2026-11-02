-- The reviewed state must be checked under the same lock as the write.
-- Three-argument clients fail closed instead of bypassing concurrency protection.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
DROP FUNCTION public.configure_program_schedule(uuid, text, date);

CREATE FUNCTION public.configure_program_schedule(
  _assignment uuid, _mode text, _start date, _expected jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  assignment public.program_assignments;
  version public.program_versions;
  current_schedule jsonb;
  target jsonb;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(_assignment::text, 0));
  SELECT * INTO assignment FROM public.program_assignments WHERE id = _assignment AND active;
  IF assignment.id IS NULL OR NOT private.can_coach_member(assignment.member_id)
     OR NOT private.training_enabled('scheduling') OR _mode NOT IN ('calendar', 'rotation')
     OR _mode IS NULL OR _start IS NULL THEN
    RAISE EXCEPTION 'Current coach or active admin required';
  END IF;
  SELECT jsonb_build_object('mode', mode, 'start_date', start_date)
    INTO current_schedule FROM public.program_schedules WHERE assignment_id = _assignment;
  target := jsonb_build_object('mode', _mode, 'start_date', _start);
  IF current_schedule IS NOT DISTINCT FROM target THEN RETURN; END IF;
  IF current_schedule IS DISTINCT FROM nullif(_expected, 'null'::jsonb) THEN
    RAISE EXCEPTION 'The schedule changed. Reload and review the current dates.';
  END IF;
  SELECT * INTO version FROM public.program_versions WHERE id = assignment.program_version_id;
  INSERT INTO public.program_schedules(assignment_id, member_id, mode, start_date)
    VALUES(assignment.id, assignment.member_id, _mode, _start)
    ON CONFLICT(assignment_id) DO UPDATE SET mode = EXCLUDED.mode, start_date = EXCLUDED.start_date;
  INSERT INTO public.session_occurrences(
    assignment_id, member_id, program_version_id, week, day, ordinal, due_date
  )
  SELECT assignment.id, assignment.member_id, version.id, w, d, (w-1)*7+d,
    CASE WHEN _mode = 'calendar' THEN _start+(w-1)*7+d-1 ELSE NULL END
  FROM (SELECT DISTINCT (i->>'week')::int w, (i->>'day')::int d
    FROM pg_catalog.jsonb_array_elements(version.items) i) sessions
  ON CONFLICT(assignment_id, week, day) DO NOTHING;
  UPDATE public.session_occurrences
    SET due_date = CASE WHEN _mode = 'calendar' THEN _start+(week-1)*7+day-1 ELSE NULL END
    WHERE assignment_id = assignment.id AND status = 'scheduled';
END $$;
REVOKE ALL ON FUNCTION public.configure_program_schedule(uuid,text,date,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.configure_program_schedule(uuid,text,date,jsonb) TO authenticated;
