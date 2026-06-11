-- 009_groups.sql — beheerde groepen (regio's) + supervisor-koppeling

CREATE TABLE IF NOT EXISTS public.groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groepen lezen" ON public.groups;
CREATE POLICY "groepen lezen" ON public.groups
  FOR SELECT USING (true);
-- Aanmaken/hernoemen van groepen gebeurt via de service-role (superuser-function
-- in een latere prompt), daarom bewust geen INSERT/UPDATE/DELETE policy voor
-- gewone gebruikers.

-- Supervisor (en evt. admin) hoort bij één groep
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS group_id TEXT;

-- pharmacies."groupId" bestaat al (TEXT) en verwijst voortaan naar groups.id.
-- Geen harde foreign key, om bestaande vrije-tekst-waarden niet te breken.
