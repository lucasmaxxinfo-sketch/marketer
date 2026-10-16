-- Atomic, server-only counter for owner-login throttling.
-- This function is called through PostgREST RPC by the Edge Function's service role.
CREATE OR REPLACE FUNCTION public.mg_increment_login_failures(
  p_key text,
  p_ttl_seconds integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  attempt_count integer;
BEGIN
  IF p_key IS NULL
     OR p_key NOT LIKE 'login-attempt:%'
     OR p_ttl_seconds IS NULL
     OR p_ttl_seconds < 1
     OR p_ttl_seconds > 3600 THEN
    RAISE EXCEPTION 'Invalid login rate-limit counter request';
  END IF;

  INSERT INTO public.mg_kv AS stored (key, value, expires_at, updated_at)
  VALUES (
    p_key,
    '1',
    now() + make_interval(secs => p_ttl_seconds),
    now()
  )
  ON CONFLICT (key) DO UPDATE
  SET
    value = CASE
      WHEN stored.expires_at IS NULL OR stored.expires_at <= now() THEN '1'
      WHEN stored.value ~ '^[0-9]+$' THEN (stored.value::integer + 1)::text
      ELSE '1'
    END,
    expires_at = CASE
      WHEN stored.expires_at IS NULL OR stored.expires_at <= now()
        THEN now() + make_interval(secs => p_ttl_seconds)
      ELSE stored.expires_at
    END,
    updated_at = now()
  RETURNING value::integer INTO attempt_count;

  RETURN attempt_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.mg_increment_login_failures(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mg_increment_login_failures(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.mg_increment_login_failures(text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mg_increment_login_failures(text, integer) TO service_role;
