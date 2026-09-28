BEGIN;

CREATE OR REPLACE FUNCTION public.is_privileged()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND LOWER(role) IN ('superuser', 'supervisor', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMIT;
