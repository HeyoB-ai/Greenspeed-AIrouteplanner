-- Opruimen van verweesde deliveredAt-waarden
--
-- GEEN AUTOMATISCHE MIGRATIE. Dit bestand staat bewust buiten supabase/migrations/
-- zodat het niet meeloopt met een deploy. Handmatig draaien in de SQL-editor,
-- query voor query, in de volgorde hieronder.
--
-- Aanleiding: updateMultipleStatus behield deliveredAt bij elke statuswijziging
-- zonder evidence. De knop "Ongedaan maken" (commit 6edf051, live 17-19 aug 2026)
-- zette DELIVERED terug naar ASSIGNED en liet het bezorgtijdstip staan. Die
-- waarden werken door in de urenberekening (lastDelivery -> totalHours) en in het
-- tijdstip dat Track & Trace aan de patiënt toont.
--
-- De code schrijft ze sinds deze commit niet meer; dit ruimt de bestaande op.


-- ---------------------------------------------------------------------------
-- 0. Bestaat de kolom statusHistory? Bepaalt of query 2 en 3 bruikbaar zijn.
-- ---------------------------------------------------------------------------
select column_name, data_type
from information_schema.columns
where table_name = 'packages'
  and column_name in ('statusHistory', 'deliveredAt');


-- ---------------------------------------------------------------------------
-- 1. TELLEN — hoeveel rijen raakt dit in totaal, uitgesplitst per status?
--    Draai dit eerst. Niets wordt gewijzigd.
-- ---------------------------------------------------------------------------
select status, count(*) as rijen, min("deliveredAt") as oudste, max("deliveredAt") as nieuwste
from packages
where "deliveredAt" is not null
  and status in ('ASSIGNED', 'PICKED_UP', 'REMOVED')
group by status
order by rijen desc;


-- ---------------------------------------------------------------------------
-- 2. RISICO — welke van die rijen hebben GEEN bezorgpoging in statusHistory?
--    Bij deze rijen is deliveredAt het enige spoor van de poging; leegmaken
--    gooit dat weg. Verwacht: 0 rijen. Is het meer, lees eerst het rapport.
-- ---------------------------------------------------------------------------
select id, status, "createdAt", "deliveredAt", "statusHistory"
from packages
where "deliveredAt" is not null
  and status in ('ASSIGNED', 'PICKED_UP', 'REMOVED')
  and not exists (
    select 1
    from jsonb_array_elements(coalesce("statusHistory", '[]'::jsonb)) as ev
    where ev->>'status' in ('DELIVERED', 'MAILBOX', 'NEIGHBOUR', 'RETURN', 'MOVED', 'OTHER_LOCATION', 'FAILED')
  )
order by "deliveredAt" desc;


-- ---------------------------------------------------------------------------
-- 3. OPSCHONEN — variant A (veilig, aanbevolen)
--    Alleen rijen waarvan de bezorgpoging aantoonbaar in statusHistory staat.
--    Rijen uit query 2 blijven ongemoeid.
-- ---------------------------------------------------------------------------
-- update packages
-- set "deliveredAt" = null
-- where "deliveredAt" is not null
--   and status in ('ASSIGNED', 'PICKED_UP', 'REMOVED')
--   and exists (
--     select 1
--     from jsonb_array_elements(coalesce("statusHistory", '[]'::jsonb)) as ev
--     where ev->>'status' in ('DELIVERED', 'MAILBOX', 'NEIGHBOUR', 'RETURN', 'MOVED', 'OTHER_LOCATION', 'FAILED')
--   );


-- ---------------------------------------------------------------------------
-- 4. OPSCHONEN — variant B (volledig)
--    Alles leeg, ook waar geen historie is. Draai dit alleen als query 2
--    0 rijen gaf, of als je bewust accepteert dat die tijdstippen verdwijnen.
-- ---------------------------------------------------------------------------
-- update packages
-- set "deliveredAt" = null
-- where "deliveredAt" is not null
--   and status in ('ASSIGNED', 'PICKED_UP', 'REMOVED');


-- ---------------------------------------------------------------------------
-- 5. CONTROLE ACHTERAF — hoort 0 rijen te geven.
-- ---------------------------------------------------------------------------
select count(*) as resterend
from packages
where "deliveredAt" is not null
  and status in ('ASSIGNED', 'PICKED_UP', 'REMOVED');
