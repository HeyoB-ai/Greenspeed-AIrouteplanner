BEGIN;

DROP POLICY IF EXISTS "privileged can update any profile" ON public.user_profiles;
CREATE POLICY "privileged can update any profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING      (public.is_privileged())
WITH CHECK (public.is_privileged());

COMMIT;
