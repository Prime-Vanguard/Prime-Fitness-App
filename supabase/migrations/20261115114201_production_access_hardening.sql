-- Legacy managed-member reads must recheck authority after role removal/pause.
-- Keep current Pod scope; wellness continues using the narrower coach helper.
CREATE OR REPLACE FUNCTION private.manages_member(_manager uuid, _member uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.is_active(_manager) AND (
    (private.has_role(_manager, 'coach') AND EXISTS (
      SELECT 1 FROM public.coach_assignments
      WHERE coach_id = _manager AND member_id = _member AND active
    )) OR
    (private.has_role(_manager, 'pod_leader') AND EXISTS (
      SELECT 1 FROM public.pods p JOIN public.pod_members pm ON pm.pod_id = p.id
      WHERE p.leader_id = _manager AND pm.member_id = _member
    ))
  )
$$;

-- These whole-table privileges bypass row policies and are never client operations.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
DO $$
DECLARE creator text;
BEGIN
  -- Cover actual owners/default-grant creators as well as this migration's role.
  FOR creator IN
    SELECT DISTINCT pg_get_userbyid(owner_id) FROM (
      SELECT relowner owner_id FROM pg_class WHERE relnamespace = 'public'::regnamespace
      UNION SELECT defaclrole FROM pg_default_acl WHERE defaclnamespace IN (0, 'public'::regnamespace)
      UNION SELECT oid FROM pg_roles WHERE rolname = current_user
    ) owners
    WHERE pg_has_role(current_user, owner_id, 'USAGE')
  LOOP
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM PUBLIC, anon, authenticated', creator);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM PUBLIC, anon, authenticated', creator);
  END LOOP;
  -- Provider-owned defaults need provider authority; application tables above
  -- must still be hardened without pretending those managed defaults changed.
  IF EXISTS (SELECT 1 FROM pg_default_acl
    WHERE defaclnamespace IN (0, 'public'::regnamespace)
      AND defaclobjtype = 'r' AND NOT pg_has_role(current_user, defaclrole, 'USAGE')) THEN
    RAISE WARNING 'Managed-role table defaults require separate provider review';
  END IF;
END $$;
