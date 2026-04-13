-- ════════════════════════════════════════
-- Greenspeed Auth System — migratie 001
-- Uitvoeren in Supabase SQL Editor
-- ════════════════════════════════════════

-- Gebruikersprofielen (uitbreiding op auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN
                  ('superuser','supervisor','admin','pharmacy','courier')),
  pharmacy_ids  TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Uitnodigingen (voor apotheker/supervisor flows)
CREATE TABLE IF NOT EXISTS public.invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  role          TEXT NOT NULL,
  pharmacy_id   TEXT NOT NULL,
  invited_by    UUID REFERENCES auth.users(id),
  token         TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '48 hours',
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Apotheekcodes voor koeriers (tijdelijke koppelcodes)
CREATE TABLE IF NOT EXISTS public.pharmacy_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id   TEXT NOT NULL,
  code          TEXT UNIQUE NOT NULL,
  created_by    UUID REFERENCES auth.users(id),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Koppeling koerier ↔ apotheek (many-to-many)
CREATE TABLE IF NOT EXISTS public.courier_pharmacy_access (
  courier_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pharmacy_id   TEXT NOT NULL,
  linked_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (courier_id, pharmacy_id)
);

-- RLS inschakelen
ALTER TABLE public.user_profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_codes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_pharmacy_access ENABLE ROW LEVEL SECURITY;

-- user_profiles: eigen profiel lezen
DROP POLICY IF EXISTS "eigen profiel lezen" ON public.user_profiles;
CREATE POLICY "eigen profiel lezen" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

-- user_profiles: eigen profiel aanmaken (bij registratie)
DROP POLICY IF EXISTS "eigen profiel aanmaken" ON public.user_profiles;
CREATE POLICY "eigen profiel aanmaken" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- user_profiles: eigen profiel bijwerken
DROP POLICY IF EXISTS "eigen profiel bijwerken" ON public.user_profiles;
CREATE POLICY "eigen profiel bijwerken" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- invitations: iedereen mag uitnodigingen lezen op token (voor accept-flow)
DROP POLICY IF EXISTS "uitnodiging lezen op token" ON public.invitations;
CREATE POLICY "uitnodiging lezen op token" ON public.invitations
  FOR SELECT USING (true);

-- pharmacy_codes: iedereen mag codes lezen (validatie aan serverside)
DROP POLICY IF EXISTS "code lezen" ON public.pharmacy_codes;
CREATE POLICY "code lezen" ON public.pharmacy_codes
  FOR SELECT USING (true);

-- courier_pharmacy_access: koerier ziet eigen koppelingen
DROP POLICY IF EXISTS "eigen koppelingen" ON public.courier_pharmacy_access;
CREATE POLICY "eigen koppelingen" ON public.courier_pharmacy_access
  FOR SELECT USING (auth.uid() = courier_id);

DROP POLICY IF EXISTS "eigen koppeling aanmaken" ON public.courier_pharmacy_access;
CREATE POLICY "eigen koppeling aanmaken" ON public.courier_pharmacy_access
  FOR INSERT WITH CHECK (auth.uid() = courier_id);

-- ════════════════════════════════════════
-- Cleanup: herbereken scanNumbers (uitvoeren na migratie)
-- ════════════════════════════════════════
-- WITH ordered AS (
--   SELECT id,
--     ROW_NUMBER() OVER (
--       PARTITION BY "pharmacyId", DATE("createdAt")
--       ORDER BY "createdAt" ASC
--     ) as rn
--   FROM packages
-- )
-- UPDATE packages
-- SET "scanNumber" = ordered.rn
-- FROM ordered
-- WHERE packages.id = ordered.id;
