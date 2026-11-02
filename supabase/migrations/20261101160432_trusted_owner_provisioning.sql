SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- A private, one-time receipt. Historical owner IDs intentionally survive Auth deletion.
CREATE TABLE private.owner_provisioning (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  owner_id uuid,
  email text,
  token_hash text,
  expires_at timestamptz,
  consumed_at timestamptz,
  CHECK (consumed_at IS NOT NULL OR (
    owner_id IS NOT NULL AND email IS NOT NULL AND email = lower(btrim(email))
    AND email <> '' AND token_hash IS NOT NULL AND token_hash ~ '^[a-f0-9]{64}$' AND expires_at IS NOT NULL
  ))
);
ALTER TABLE private.owner_provisioning ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.owner_provisioning FROM PUBLIC, anon, authenticated, service_role;

-- Existing installations stay closed, without granting or changing any role.
INSERT INTO private.owner_provisioning(singleton, consumed_at)
SELECT true, now() WHERE EXISTS (SELECT 1 FROM public.profiles);

CREATE FUNCTION private.prepare_owner_provisioning(_owner uuid, _email text, _hash text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('prime-owner-provisioning', 0));
  IF EXISTS (SELECT 1 FROM public.profiles) OR EXISTS (
    SELECT 1 FROM private.owner_provisioning WHERE consumed_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'Owner provisioning is closed for this installation'; END IF;
  IF _owner IS NULL OR _email IS NULL OR btrim(_email) = '' OR _email NOT LIKE '%@%'
    OR _hash IS NULL OR _hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'A valid owner identity and token hash are required';
  END IF;
  INSERT INTO private.owner_provisioning(singleton, owner_id, email, token_hash, expires_at)
  VALUES(true, _owner, lower(btrim(_email)), _hash, clock_timestamp() + interval '30 minutes')
  ON CONFLICT(singleton) DO UPDATE SET owner_id = EXCLUDED.owner_id, email = EXCLUDED.email,
    token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at;
END $$;
REVOKE ALL ON FUNCTION private.prepare_owner_provisioning(uuid,text,text)
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE invitation public.invites; provisioning private.owner_provisioning; first_user boolean;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('prime-owner-provisioning', 0));
  SELECT NOT EXISTS(SELECT 1 FROM public.profiles) INTO first_user;
  IF first_user THEN
    SELECT * INTO provisioning FROM private.owner_provisioning WHERE singleton FOR UPDATE;
    IF provisioning.consumed_at IS NOT NULL OR provisioning.owner_id IS DISTINCT FROM NEW.id
      OR provisioning.email IS DISTINCT FROM lower(NEW.email)
      OR provisioning.expires_at IS NULL OR provisioning.expires_at <= clock_timestamp()
      OR provisioning.token_hash IS NULL
    THEN RAISE EXCEPTION 'Trusted owner provisioning is required before registration'; END IF;
  ELSE
    INSERT INTO private.owner_provisioning(singleton, consumed_at) VALUES(true, now())
      ON CONFLICT(singleton) DO UPDATE SET consumed_at = coalesce(private.owner_provisioning.consumed_at, now());
    SELECT * INTO invitation FROM public.invites
      WHERE lower(email) = lower(NEW.email) AND accepted_at IS NULL AND revoked_at IS NULL
        AND expires_at > now() ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
    IF invitation.id IS NULL THEN
      RAISE EXCEPTION 'Prime Fitness is invite-only. No valid invitation for this email.';
    END IF;
  END IF;
  INSERT INTO public.profiles(id,email,display_name)
    VALUES(NEW.id, NEW.email, coalesce(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'member');
  IF first_user THEN
    INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'super_admin');
    UPDATE private.owner_provisioning SET consumed_at = clock_timestamp()
      WHERE singleton;
  ELSE
    IF invitation.role <> 'member' THEN
      INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,invitation.role) ON CONFLICT DO NOTHING;
    END IF;
    IF invitation.pod_id IS NOT NULL THEN
      INSERT INTO public.pod_members(pod_id,member_id) VALUES(invitation.pod_id,NEW.id) ON CONFLICT DO NOTHING;
    END IF;
    IF invitation.coach_id IS NOT NULL THEN
      INSERT INTO public.coach_assignments(coach_id,member_id) VALUES(invitation.coach_id,NEW.id) ON CONFLICT DO NOTHING;
    END IF;
    UPDATE public.invites SET accepted_at = now() WHERE id = invitation.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;

-- GoTrue Admin createUser inserts auth.users before updating app_metadata in the
-- same transaction. Check the stored final metadata at commit, not NEW's insert
-- snapshot. A failed check rolls back the Auth row, profile, roles and receipt.
CREATE FUNCTION private.check_owner_provisioning() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE provisioning private.owner_provisioning; marker text; final_email text;
BEGIN
  SELECT * INTO provisioning FROM private.owner_provisioning
    WHERE singleton AND owner_id = NEW.id AND token_hash IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT raw_app_meta_data->>'prime_owner_provisioning_token', lower(email)
    INTO marker, final_email FROM auth.users WHERE id = NEW.id;
  IF provisioning.consumed_at IS NULL OR provisioning.expires_at IS NULL
    OR provisioning.expires_at <= clock_timestamp()
    OR final_email IS DISTINCT FROM provisioning.email
    OR marker IS NULL OR marker !~ '^[a-f0-9]{64}$'
    OR provisioning.token_hash IS DISTINCT FROM
      encode(sha256(convert_to(coalesce(marker, ''), 'UTF8')), 'hex')
  THEN RAISE EXCEPTION 'Trusted owner provisioning token is required before registration commits'; END IF;
  UPDATE private.owner_provisioning SET token_hash = NULL, expires_at = NULL WHERE singleton;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.check_owner_provisioning() FROM PUBLIC, anon, authenticated, service_role;
CREATE CONSTRAINT TRIGGER check_owner_provisioning_before_commit
AFTER INSERT ON auth.users DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION private.check_owner_provisioning();
