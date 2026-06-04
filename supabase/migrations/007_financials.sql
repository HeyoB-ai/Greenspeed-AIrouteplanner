-- ════════════════════════════════════════
-- Greenspeed Financiële module — migratie 007
-- Voer uit in Supabase SQL Editor
-- ════════════════════════════════════════
-- NB: genummerd 007 (niet 005) omdat 005 en 006 al bestaan.

-- Uurtarief per apotheek (wat Greenspeed factureert)
ALTER TABLE pharmacies
  ADD COLUMN IF NOT EXISTS "hourlyRate" DECIMAL(8,2) DEFAULT 0;

-- Uurloon per koerier
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS "hourlyWage"    DECIMAL(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "wageStartDate" DATE;

-- ════════════════════════════════════════
-- RLS: privileged rollen mogen ALLE profielen lezen + uurlonen bijwerken
-- ════════════════════════════════════════
-- LET OP — review dit blok vóór uitvoeren.
-- Zonder deze policies werkt de financiële module NIET:
--   * migratie 001 staat alleen toe dat een gebruiker zijn EIGEN profiel
--     leest/bijwerkt (auth.uid() = id);
--   * een superuser/supervisor/admin kan dan geen koerier-uurlonen lezen
--     (loonkosten blijven 0) en niet instellen.
-- De SECURITY DEFINER helper omzeilt RLS binnenin de functie en voorkomt zo
-- de bekende "infinite recursion in policy"-fout bij een policy die de eigen
-- tabel bevraagt.

CREATE OR REPLACE FUNCTION public.is_privileged()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('superuser', 'supervisor', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "privileged profielen lezen" ON public.user_profiles;
CREATE POLICY "privileged profielen lezen" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id OR public.is_privileged());

DROP POLICY IF EXISTS "privileged uurloon bijwerken" ON public.user_profiles;
CREATE POLICY "privileged uurloon bijwerken" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_privileged());
