-- ════════════════════════════════════════
-- Greenspeed — regiomanager-koppeling — migratie 014
-- Uitvoeren in Supabase SQL Editor
-- ════════════════════════════════════════
--
-- WAAROM EEN EIGEN TABEL EN NIET user_profiles.pharmacy_ids
--   Die array bestaat al, maar hij is een kopie: hij loopt uiteen met de
--   werkelijkheid zodra een apotheek wordt verwijderd of overgezet, en niemand
--   ziet dat. courier_pharmacy_access (migratie 001) is om die reden een echte
--   koppeltabel, en dit wordt de tegenhanger daarvan voor regiomanagers.
--
-- pharmacy_id IS TEXT, NIET UUID
--   public.pharmacies komt uit de bezorg-app en heeft een TEXT-id ('ph-1',
--   'ph-1779784742417'). Elke bestaande koppeltabel gebruikt daarom TEXT;
--   een UUID-kolom zou hier geen foreign key kunnen leggen.
--
-- LET OP — DE RLS OP pharmacies IS NU NOG OPEN
--   Migratie 006 zet op pharmacies één policy: FOR ALL USING (true). Zolang die
--   er staat, mag iedereen elke apotheek al lezen en voegt de policy onderaan
--   dit bestand niets toe: policies worden ge-OR'd, en true wint altijd. De
--   policy staat er wél in, zodat de bedoeling vastligt en de beperking meteen
--   werkt op de dag dat die open policy wordt vervangen. Die vervanging zit hier
--   bewust NIET in: koeriers valideren hun koppelcode via pharmacies, en dat
--   dichtzetten hoort een eigen migratie met eigen tests te zijn.
-- ════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────
-- 1. region_manager als geldige rol
--    De CHECK uit migratie 001 is inline (auto-benoemd), dus eerst opzoeken hoe
--    hij heet voordat we hem kunnen vervangen.
-- ────────────────────────────────────────
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
  CHECK (role IN ('superuser','supervisor','admin','pharmacy','courier','region_manager'));

COMMENT ON COLUMN public.user_profiles.role IS
  'Rol in de app. region_manager (migratie 014) ziet alleen de apotheken die in '
  'user_pharmacy_access aan hem gekoppeld zijn.';


-- ────────────────────────────────────────
-- 2. user_pharmacy_access — koppeling gebruiker ↔ apotheek
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_pharmacy_access (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pharmacy_id TEXT NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  created_by  UUID REFERENCES auth.users(id),
  UNIQUE (user_id, pharmacy_id)
);

CREATE INDEX IF NOT EXISTS user_pharmacy_access_user_idx
  ON public.user_pharmacy_access (user_id);
CREATE INDEX IF NOT EXISTS user_pharmacy_access_pharmacy_idx
  ON public.user_pharmacy_access (pharmacy_id);


-- ────────────────────────────────────────
-- 3. RLS op user_pharmacy_access
--    Lezen: je eigen koppelingen, of alles als je privileged bent. is_privileged()
--    (migratie 007) is SECURITY DEFINER en omzeilt RLS binnenin, wat de
--    "infinite recursion in policy"-fout voorkomt.
--
--    Schrijven: alleen superuser en supervisor. Admin mag wél meekijken maar niet
--    koppelen — een admin beheert één keten, en wie een regiomanager ergens aan
--    hangt bepaalt daarmee wie over ketengrenzen heen kijkt.
-- ────────────────────────────────────────
ALTER TABLE public.user_pharmacy_access ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_pharmacy_access()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('superuser', 'supervisor')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "eigen of privileged koppelingen lezen" ON public.user_pharmacy_access;
CREATE POLICY "eigen of privileged koppelingen lezen" ON public.user_pharmacy_access
  FOR SELECT USING (user_id = auth.uid() OR public.is_privileged());

DROP POLICY IF EXISTS "koppeling aanmaken" ON public.user_pharmacy_access;
CREATE POLICY "koppeling aanmaken" ON public.user_pharmacy_access
  FOR INSERT WITH CHECK (public.can_manage_pharmacy_access());

DROP POLICY IF EXISTS "koppeling verwijderen" ON public.user_pharmacy_access;
CREATE POLICY "koppeling verwijderen" ON public.user_pharmacy_access
  FOR DELETE USING (public.can_manage_pharmacy_access());


-- ────────────────────────────────────────
-- 4. pharmacies: leesrecht voor de gekoppelde regiomanager
--    Zie de waarschuwing bovenaan: zolang "Allow public access" bestaat is dit
--    een no-op. De helper is SECURITY DEFINER zodat de policy op pharmacies niet
--    via user_pharmacy_access opnieuw RLS hoeft te evalueren.
-- ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_pharmacy_access_ids()
RETURNS TEXT[] AS $$
  SELECT COALESCE(array_agg(pharmacy_id), '{}')
    FROM public.user_pharmacy_access
   WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "regiomanager leest gekoppelde apotheken" ON public.pharmacies;
CREATE POLICY "regiomanager leest gekoppelde apotheken" ON public.pharmacies
  FOR SELECT USING (id = ANY (public.my_pharmacy_access_ids()));


-- ────────────────────────────────────────
-- Verificatie
-- ────────────────────────────────────────
-- SELECT role, count(*) FROM public.user_profiles GROUP BY 1 ORDER BY 1;
-- SELECT u.name, p.name AS apotheek
--   FROM public.user_pharmacy_access a
--   JOIN public.user_profiles u ON u.id = a.user_id
--   JOIN public.pharmacies p    ON p.id = a.pharmacy_id
--  ORDER BY u.name, p.name;
-- -- Staat de open policy er nog? Dan is punt 4 nog zonder effect:
-- SELECT policyname, cmd, qual FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'pharmacies';

COMMIT;
