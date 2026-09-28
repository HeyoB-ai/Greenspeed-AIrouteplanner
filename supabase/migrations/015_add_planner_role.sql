-- ════════════════════════════════════════
-- Greenspeed — planner-rol toevoegen — migratie 015
-- Uitvoeren in Supabase SQL Editor
-- ════════════════════════════════════════
--
-- Draai migratie 014 eerst: die voegde region_manager toe en gaf de CHECK een
-- vaste naam (user_profiles_role_check). Daarom kan het hier zonder de
-- opzoek-lus uit 014 — maar de DROP blijft voorwaardelijk, zodat dit bestand ook
-- draait op een database waar 014 nog niet langs is geweest.
--
-- WAAROM DE PLANNER-ROL IN DEZE DATABASE STAAT
--   De planner is een aparte app (planner.go-bob.nl) op dezelfde database. Zonder
--   deze rol zou een planner die per ongeluk op go-bob.nl inlogt door de fallback
--   in authService als apotheek-gebruiker binnenkomen. Met de rol erin krijgt hij
--   een pagina die hem doorstuurt.
-- ════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_name TEXT;
BEGIN
  SELECT conname INTO v_name
    FROM pg_constraint
   WHERE conrelid = 'public.user_profiles'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%role%';

  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_profiles DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('superuser','supervisor','admin','pharmacy','courier','region_manager','planner'));

COMMENT ON COLUMN public.user_profiles.role IS
  'Rol in de app. region_manager (migratie 014) ziet alleen de apotheken die in '
  'user_pharmacy_access aan hem gekoppeld zijn. planner (migratie 015) hoort in '
  'de planner-app op planner.go-bob.nl; in de bezorg-app krijgt hij alleen een '
  'doorverwijspagina.';


-- ────────────────────────────────────────
-- Verificatie
-- ────────────────────────────────────────
-- SELECT role, count(*) FROM public.user_profiles GROUP BY 1 ORDER BY 1;
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'public.user_profiles'::regclass AND contype = 'c';

COMMIT;
