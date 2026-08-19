-- ════════════════════════════════════════════════════════════════════════════
-- Migratie 013 — RLS op packages scopen per rol
--
-- NIET UITVOEREN ZONDER DE STAPPEN TE LEZEN. Deze migratie is bewust in twee
-- helften gesplitst: deel A voegt alleen toe en verandert niets aan wat mensen
-- kunnen zien, deel B is de daadwerkelijke aanscherping.
--
-- Aanleiding: de live policy is
--     "ingelogd volledige toegang"  FOR ALL  USING (auth.uid() IS NOT NULL)
-- waardoor elke ingelogde gebruiker alle pakketten van alle apotheken kan lezen.
-- De scheiding gebeurt nu uitsluitend client-side in visiblePackages (App.tsx).
--
-- Deze policy spiegelt die client-logica, met één bewuste verruiming: een koerier
-- krijgt toegang tot de pakketten van zijn gekoppelde apotheken in plaats van
-- alleen zijn eigen pakketten van vandaag. Dat is nodig omdat de client zelf al
-- op courierId en datum filtert; RLS krapper maken dan de client zou de rit
-- breken zodra die filtering verandert.
-- ════════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────────
-- DEEL A — helpers en de nieuwe policy ernaast. Voegt alleen toe.
--
-- Zolang de oude policy nog bestaat is de toegang de UNIE van beide, dus na
-- deel A ziet nog niemand minder dan nu. Pas deel B scherpt aan.
-- ────────────────────────────────────────────────────────────────────────────

-- SECURITY DEFINER: leest user_profiles buiten RLS om, anders krijg je
-- "infinite recursion in policy" — zelfde patroon als is_privileged() in 007.

-- Superuser en supervisor zien alles. Bewust NIET is_privileged(): die bevat ook
-- admin, en een admin hoort alleen zijn eigen apotheken te zien.
CREATE OR REPLACE FUNCTION public.sees_all_packages()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('superuser', 'supervisor')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Apotheken van een apotheek- of admin-account (user_profiles.pharmacy_ids).
CREATE OR REPLACE FUNCTION public.my_pharmacy_ids()
RETURNS text[] AS $$
  SELECT COALESCE(
    (SELECT pharmacy_ids FROM public.user_profiles WHERE id = auth.uid()),
    '{}'::text[]
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Apotheken waar een koerier aan gekoppeld is (many-to-many uit migratie 001).
CREATE OR REPLACE FUNCTION public.my_courier_pharmacy_ids()
RETURNS text[] AS $$
  SELECT COALESCE(array_agg(pharmacy_id), '{}'::text[])
  FROM public.courier_pharmacy_access
  WHERE courier_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- De nieuwe policy. Naam wijkt af van de bestaande zodat beide even naast
-- elkaar kunnen bestaan.
DROP POLICY IF EXISTS "pakketten scoped op rol" ON public.packages;
CREATE POLICY "pakketten scoped op rol" ON public.packages
FOR ALL
USING (
  auth.uid() IS NOT NULL
  AND (
    -- superuser + supervisor: alles
    public.sees_all_packages()
    -- apotheek + admin: eigen apotheken
    OR "pharmacyId" = ANY (public.my_pharmacy_ids())
    -- koerier: apotheken waar hij aan gekoppeld is
    OR "pharmacyId" = ANY (public.my_courier_pharmacy_ids())
    -- vangnet: eigen scans blijven zichtbaar, ook als de koppeling wegvalt
    -- of als het pakket op een spook-apotheek staat. courierId is voor echte
    -- accounts gelijk aan de auth-uid (authService.ts:72 en :159).
    OR "courierId" = auth.uid()::text
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    public.sees_all_packages()
    OR "pharmacyId" = ANY (public.my_pharmacy_ids())
    OR "pharmacyId" = ANY (public.my_courier_pharmacy_ids())
    OR "courierId" = auth.uid()::text
    -- Scan met een onbekend etiket: handleNewScan zet pharmacyId op '' zodat het
    -- pakket in de niet-toegewezen groep valt. Zonder deze regel weigert de
    -- INSERT en gaat de scan verloren. Lezen mag alleen de superuser (hierboven),
    -- dus dit opent geen inzage — alleen het wegschrijven.
    OR COALESCE("pharmacyId", '') = ''
  )
);


-- ────────────────────────────────────────────────────────────────────────────
-- CONTROLE — draaien tussen deel A en deel B.
-- ────────────────────────────────────────────────────────────────────────────

-- Beide policies moeten nu bestaan.
--   SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
--   FROM pg_policy WHERE polrelid = 'packages'::regclass;

-- Per rol tellen wat de nieuwe policy zou toelaten. Draai als de betreffende
-- gebruiker (of via een impersonated JWT in de SQL-editor):
--   SELECT count(*) FROM packages;
-- Vergelijk met het aantal dat die rol nu in de app ziet.

-- Koeriers zonder koppeling zijn het grootste risico — die zien na deel B nog
-- alleen hun eigen pakketten via het courierId-vangnet:
--   SELECT p.id, p.name
--   FROM public.user_profiles p
--   WHERE p.role = 'courier'
--     AND NOT EXISTS (
--       SELECT 1 FROM public.courier_pharmacy_access a WHERE a.courier_id = p.id
--     );

-- Apotheek- en adminaccounts zonder gevulde pharmacy_ids zien na deel B niets:
--   SELECT id, name, role, pharmacy_ids
--   FROM public.user_profiles
--   WHERE role IN ('pharmacy', 'admin')
--     AND (pharmacy_ids IS NULL OR cardinality(pharmacy_ids) = 0);

-- Pakketten die na deel B door niemand behalve superuser/supervisor te zien zijn
-- (spook-apotheek of leeg id, en geen bekende koerier):
--   SELECT count(*) FROM packages pk
--   WHERE COALESCE(pk."pharmacyId", '') = ''
--      OR NOT EXISTS (SELECT 1 FROM pharmacies ph WHERE ph.id = pk."pharmacyId");


-- ────────────────────────────────────────────────────────────────────────────
-- DEEL B — de aanscherping. Pas draaien als de controles hierboven kloppen.
-- Tot dit moment is er niets krapper geworden.
-- ────────────────────────────────────────────────────────────────────────────

-- DROP POLICY IF EXISTS "ingelogd volledige toegang" ON public.packages;


-- ────────────────────────────────────────────────────────────────────────────
-- TERUGDRAAIEN — herstelt de oude situatie in één statement.
-- ────────────────────────────────────────────────────────────────────────────

-- CREATE POLICY "ingelogd volledige toegang" ON public.packages
--   FOR ALL USING (auth.uid() IS NOT NULL);
